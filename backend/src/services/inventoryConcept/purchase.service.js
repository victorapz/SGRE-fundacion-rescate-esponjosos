"use strict";

import {
  AppDataSource,
  Purchase,
  PurchaseDetail,
  getSupplierOrThrow,
  getUserOrThrow,
  mapPurchase,
  toNumericNumber,
} from "./inventory.shared.js";
import {
  cancelPayableForSourceIfNoPayments,
  findPayableBySource,
  mapPayableIntegrationSummary,
  syncPayableFromSource,
} from "../financialConcept/payableIntegration.service.js";

const PURCHASE_STATE_DRAFT = "BORRADOR";
const PURCHASE_STATE_CONFIRMED = "CONFIRMADA";
const PURCHASE_STATE_CANCELLED = "CANCELADA";

async function getPurchaseWithRelations(repository, purchaseId) {
  return repository.findOne({
    where: { compra_id: Number(purchaseId) },
    relations: {
      supplier: {
        location: {
          region: true,
          comuna: {
            region: true,
          },
        },
      },
      transaction: true,
      registered_by: true,
      purchase_details: {
        item: {
          categoria: true,
          unidad_medida: true,
        },
        inventory_movements: {
          item: true,
          source_location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          destination_location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          performed_by: true,
        },
        inventory_receipts: {
          destination_location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          performed_by: true,
          movement: {
            item: true,
            source_location: {
              region: true,
              comuna: {
                region: true,
              },
            },
            destination_location: {
              region: true,
              comuna: {
                region: true,
              },
            },
            performed_by: true,
          },
        },
      },
    },
  });
}

function derivePurchaseCategoryKeys(purchase) {
  const detailCategories = Array.isArray(purchase?.purchase_details)
    ? purchase.purchase_details
      .map((detail) => detail.item?.categoria?.nombre_categoria || "")
      .map((name) => String(name).trim().toUpperCase())
      .filter(Boolean)
    : [];

  if (detailCategories.some((name) => name.includes("MEDIC"))) {
    return ["COMPRA_MEDICAMENTO", "COMPRA_INSUMOS", "OTRO_EGRESO"];
  }

  if (detailCategories.some((name) => name.includes("ALIMENTO"))) {
    return ["COMPRA_ALIMENTO", "COMPRA_INSUMOS", "OTRO_EGRESO"];
  }

  return ["COMPRA_INSUMOS", "OTRO_EGRESO"];
}

function buildPurchasePayableDescription(purchase) {
  const baseDescription = purchase.descripcion || `Compra #${purchase.compra_id}`;
  const supplierName = purchase.supplier?.nombre
    ? ` - ${purchase.supplier.nombre}`
    : "";
  return `${baseDescription}${supplierName}`;
}

function attachPurchasePayableSummary(purchase, syncResult) {
  return {
    ...purchase,
    payable_account: mapPayableIntegrationSummary(syncResult),
  };
}

function hasPurchaseInventoryReceipts(purchase) {
  const details = Array.isArray(purchase?.purchase_details) ? purchase.purchase_details : [];
  return details.some(
    (detail) =>
      Number(detail.cantidad_recepcionada || 0) > 0
      || (detail.inventory_receipts || []).length > 0
      || (detail.inventory_movements || []).length > 0,
  );
}

export function calculatePurchaseDetailSubtotal(detail, { moneda = "CLP" } = {}) {
  const quantity = toNumericNumber(detail?.cantidad, NaN);
  const unitPrice = toNumericNumber(detail?.precio_unitario, NaN);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("La cantidad del detalle debe ser mayor a 0.");
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error("El precio unitario del detalle debe ser mayor a 0.");
  }

  if (String(moneda || "CLP").toUpperCase() === "CLP" && !Number.isInteger(unitPrice)) {
    throw new Error("El precio unitario de una compra en CLP debe ser un numero entero.");
  }

  return Number((quantity * unitPrice).toFixed(2));
}

export function calculatePurchaseTotalFromDetails(details = [], { moneda = "CLP" } = {}) {
  return Number(
    details.reduce(
      (total, detail) => total + calculatePurchaseDetailSubtotal(detail, { moneda }),
      0,
    ).toFixed(2),
  );
}

async function recalculateDraftPurchaseTotal(manager, purchaseId) {
  const detailRepository = manager.getRepository(PurchaseDetail);
  const purchaseRepository = manager.getRepository(Purchase);
  const purchase = await purchaseRepository.findOne({
    where: { compra_id: Number(purchaseId) },
  });

  if (!purchase) {
    throw new Error("Compra no encontrada.");
  }

  const details = await detailRepository.find({
    where: { purchase: { compra_id: Number(purchaseId) } },
  });

  const total = calculatePurchaseTotalFromDetails(details, { moneda: purchase.moneda || "CLP" });

  await purchaseRepository.update(
    { compra_id: Number(purchaseId) },
    { monto_total: total },
  );

  return total;
}

async function normalizePurchaseDetailSubtotals(manager, purchase) {
  const detailRepository = manager.getRepository(PurchaseDetail);
  const details = Array.isArray(purchase?.purchase_details) ? purchase.purchase_details : [];

  for (const detail of details) {
    const subtotal = calculatePurchaseDetailSubtotal(detail, { moneda: purchase.moneda || "CLP" });
    if (Number(toNumericNumber(detail.subtotal, 0).toFixed(2)) !== subtotal) {
      await detailRepository.update(
        { detalle_compra_id: Number(detail.detalle_compra_id) },
        { subtotal },
      );
      detail.subtotal = subtotal;
    }
  }

  return details;
}

async function buildPurchaseWithAccountingSummary(manager, purchase) {
  if (!purchase) return null;

  const payable = await findPayableBySource(manager, {
    originType: "PURCHASE",
    originId: purchase.compra_id,
  });

  return {
    ...mapPurchase(purchase),
    payable_account: mapPayableIntegrationSummary({
      payable,
      transaction: purchase.transaction || null,
    }),
  };
}

export function assertPurchaseCanBeCancelledFromInventory(purchase) {
  if (!purchase) {
    throw new Error("Compra no encontrada");
  }

  if (purchase.estado === PURCHASE_STATE_CANCELLED) {
    throw new Error("La compra ya fue cancelada.");
  }

  const details = Array.isArray(purchase.purchase_details) ? purchase.purchase_details : [];
  const hasInventoryMovements = details.some(
    (detail) => (detail.inventory_movements || []).length > 0,
  );
  const hasReceivedDetails = details.some(
    (detail) => Number(detail.cantidad_recepcionada || 0) > 0,
  );

  if (hasReceivedDetails || hasInventoryMovements) {
    throw new Error("No se puede cancelar o eliminar una compra con recepciones registradas.");
  }

  if (
    purchase.estado === PURCHASE_STATE_CONFIRMED
    && (purchase.transaction?.transaccion_id || purchase.payable_account?.transaccion_id)
  ) {
    throw new Error("No se puede cancelar una compra que ya tiene movimientos contables asociados.");
  }

  if (purchase.estado === PURCHASE_STATE_DRAFT && details.length > 0) {
    return;
  }

  if (purchase.estado === PURCHASE_STATE_CONFIRMED && details.length > 0) {
    return;
  }
}

function assertPurchaseHeaderEditable(purchase) {
  if (!purchase) {
    throw new Error("Compra no encontrada");
  }

  if (purchase.estado === PURCHASE_STATE_CANCELLED) {
    throw new Error("No se puede editar una compra cancelada.");
  }

  if (purchase.estado !== PURCHASE_STATE_DRAFT) {
    throw new Error("Solo se pueden editar compras en borrador.");
  }

  if (hasPurchaseInventoryReceipts(purchase)) {
    throw new Error("No se puede editar una compra que ya tiene recepciones registradas.");
  }
}

async function syncPurchasePayable(manager, purchase, authContext = {}) {
  if (purchase.estado === PURCHASE_STATE_CANCELLED) {
    const payable = await cancelPayableForSourceIfNoPayments(manager, {
      originType: "PURCHASE",
      originId: purchase.compra_id,
      sourceLabel: "compra",
      reason: "Compra cancelada desde modulo de inventario",
      metadata: {
        cancelled_from_source: true,
        source_type: "PURCHASE",
        source_id: Number(purchase.compra_id),
      },
    });

    return {
      payable,
      payment: null,
      transaction: null,
      message: payable
        ? "Compra cancelada logicamente y cuenta por pagar anulada."
        : "Compra cancelada logicamente sin cuenta por pagar asociada.",
    };
  }

  if (purchase.estado !== PURCHASE_STATE_CONFIRMED) {
    return {
      payable: null,
      payment: null,
      transaction: null,
      message: "La compra aun no esta confirmada.",
    };
  }

  return syncPayableFromSource(manager, {
    originType: "PURCHASE",
    originId: purchase.compra_id,
    providerType: "SUPPLIER",
    providerId: purchase.supplier?.proveedor_id || null,
    categoryKeys: derivePurchaseCategoryKeys(purchase),
    description: buildPurchasePayableDescription(purchase),
    moneda: purchase.moneda || "CLP",
    montoTotal: purchase.monto_total,
    fechaEmision: purchase.fecha_compra,
    fechaVencimiento: purchase.fecha_vencimiento_pago || null,
    metadata: {
      purchase: {
        compra_id: Number(purchase.compra_id),
        supplier_id: purchase.supplier?.proveedor_id || null,
        estado: purchase.estado || null,
        observacion_financiera: purchase.observacion_financiera || null,
      },
    },
    reactivateDisabled: true,
    autoPayment: null,
  }, authContext);
}

export async function createPurchaseService(body, authContext = {}) {
  try {
    const purchase = await AppDataSource.transaction(async (manager) => {
      const purchaseRepository = manager.getRepository(Purchase);
      const registeredById = body.registered_by_id || authContext.userId;

      await getSupplierOrThrow(manager, body.supplier_id);
      await getUserOrThrow(manager, registeredById);

      const newPurchase = purchaseRepository.create({
        fecha_compra: body.fecha_compra,
        fecha_recepcion: null,
        estado: PURCHASE_STATE_DRAFT,
        monto_total: 0,
        moneda: body.moneda || "CLP",
        estado_pago: "PENDIENTE",
        fecha_vencimiento_pago: body.fecha_vencimiento_pago || null,
        observacion_financiera: body.observacion_financiera || null,
        descripcion: body.descripcion || null,
        observaciones: body.observaciones || null,
        supplier: { proveedor_id: Number(body.supplier_id) },
        transaction: null,
        registered_by: { id_usuario: Number(registeredById) },
      });

      const savedPurchase = await purchaseRepository.save(newPurchase);
      const purchaseWithRelations = await getPurchaseWithRelations(
        purchaseRepository,
        savedPurchase.compra_id,
      );

      return buildPurchaseWithAccountingSummary(manager, purchaseWithRelations);
    });

    return [purchase, null];
  } catch (error) {
    console.error("Error al crear compra:", error);
    return [null, error.message || "Error interno al crear compra"];
  }
}

export async function getPurchaseService(query) {
  try {
    const purchaseRepository = AppDataSource.getRepository(Purchase);
    const purchase = await getPurchaseWithRelations(purchaseRepository, query.compra_id);

    if (!purchase) return [null, "Compra no encontrada"];

    return [await buildPurchaseWithAccountingSummary(purchaseRepository.manager, purchase), null];
  } catch (error) {
    console.error("Error al obtener compra:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getPurchasesService() {
  try {
    const purchaseRepository = AppDataSource.getRepository(Purchase);
    const purchases = await purchaseRepository.find({
      relations: {
        supplier: {
          location: {
            region: true,
            comuna: {
              region: true,
            },
          },
        },
        transaction: true,
        registered_by: true,
        purchase_details: true,
      },
      order: {
        fecha_compra: "DESC",
        compra_id: "DESC",
      },
    });

    if (!purchases || purchases.length === 0) return [null, "No hay compras"];

    return [
      await Promise.all(
        purchases.map((purchase) =>
          buildPurchaseWithAccountingSummary(purchaseRepository.manager, purchase)),
      ),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener compras:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updatePurchaseService(query, body, authContext = {}) {
  try {
    const purchase = await AppDataSource.transaction(async (manager) => {
      const purchaseRepository = manager.getRepository(Purchase);
      const purchaseFound = await getPurchaseWithRelations(
        purchaseRepository,
        Number(query.compra_id),
      );

      assertPurchaseHeaderEditable(purchaseFound);

      const registeredById = body.registered_by_id
        || authContext.userId
        || purchaseFound.registered_by?.id_usuario;

      if (body.supplier_id !== undefined) {
        await getSupplierOrThrow(manager, body.supplier_id);
      }

      if (registeredById) {
        await getUserOrThrow(manager, registeredById);
      }

      await purchaseRepository.save({
        compra_id: Number(purchaseFound.compra_id),
        fecha_compra:
          body.fecha_compra !== undefined ? body.fecha_compra : purchaseFound.fecha_compra,
        moneda:
          body.moneda !== undefined ? body.moneda || "CLP" : purchaseFound.moneda || "CLP",
        fecha_vencimiento_pago:
          body.fecha_vencimiento_pago !== undefined
            ? body.fecha_vencimiento_pago || null
            : purchaseFound.fecha_vencimiento_pago,
        observacion_financiera:
          body.observacion_financiera !== undefined
            ? body.observacion_financiera || null
            : purchaseFound.observacion_financiera,
        descripcion:
          body.descripcion !== undefined
            ? body.descripcion || null
            : purchaseFound.descripcion,
        observaciones:
          body.observaciones !== undefined
            ? body.observaciones || null
            : purchaseFound.observaciones,
        supplier: {
          proveedor_id:
            body.supplier_id !== undefined
              ? Number(body.supplier_id)
              : purchaseFound.supplier?.proveedor_id,
        },
        registered_by: registeredById
          ? { id_usuario: Number(registeredById) }
          : null,
      });

      await recalculateDraftPurchaseTotal(manager, purchaseFound.compra_id);

      const updatedPurchase = await getPurchaseWithRelations(
        purchaseRepository,
        purchaseFound.compra_id,
      );

      return buildPurchaseWithAccountingSummary(manager, updatedPurchase);
    });

    return [purchase, null];
  } catch (error) {
    console.error("Error al actualizar compra:", error);
    return [null, error.message || "Error interno al actualizar compra"];
  }
}

export async function confirmPurchaseService(query, authContext = {}) {
  try {
    const purchase = await AppDataSource.transaction(async (manager) => {
      const purchaseRepository = manager.getRepository(Purchase);
      const purchaseId = Number(query.compra_id);

      if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
        throw new Error("El identificador de la compra no es válido.");
      }

      const lockedPurchase = await purchaseRepository
        .createQueryBuilder("purchase")
        .setLock("pessimistic_write")
        .where("purchase.compra_id = :purchaseId", { purchaseId })
        .getOne();

      if (!lockedPurchase) {
        throw new Error("Compra no encontrada.");
      }

      const purchase = await getPurchaseWithRelations(
        purchaseRepository,
        lockedPurchase.compra_id,
      );

      if (!purchase) {
        throw new Error("No fue posible cargar la compra.");
      }

      if (purchase.estado !== PURCHASE_STATE_DRAFT) {
        throw new Error(
          "Solo se pueden confirmar compras en borrador.",
        );
      }

      await getSupplierOrThrow(
        manager,
        purchase.supplier?.proveedor_id,
      );

      const details = await normalizePurchaseDetailSubtotals(
        manager,
        purchase,
      );

      if (!details.length) {
        throw new Error(
          "Debes agregar al menos un detalle antes de confirmar la compra.",
        );
      }

      const total = calculatePurchaseTotalFromDetails(details, {
        moneda: purchase.moneda || "CLP",
      });

      if (!(total > 0)) {
        throw new Error(
          "La compra debe tener un total mayor a 0 para poder confirmarse.",
        );
      }

      await purchaseRepository.update(
        { compra_id: purchaseId },
        {
          estado: PURCHASE_STATE_CONFIRMED,
          monto_total: total,
        },
      );

      const confirmedPurchase = await getPurchaseWithRelations(
        purchaseRepository,
        purchaseId,
      );

      if (!confirmedPurchase) {
        throw new Error(
          "No fue posible cargar la compra confirmada.",
        );
      }

      const syncResult = await syncPurchasePayable(
        manager,
        confirmedPurchase,
        authContext,
      );

      const refreshedPurchase = await getPurchaseWithRelations(
        purchaseRepository,
        purchaseId,
      );

      if (!refreshedPurchase) {
        throw new Error(
          "No fue posible cargar la compra después de generar la cuenta por pagar.",
        );
      }

      return attachPurchasePayableSummary(
        mapPurchase(refreshedPurchase),
        syncResult,
      );
    });

    return [purchase, null];
  } catch (error) {
    console.error("Error al confirmar compra:", error);

    return [
      null,
      error.message || "Error interno al confirmar compra",
    ];
  }
}
export async function revertPurchaseToDraftService(query) {
  try {
    const purchase = await AppDataSource.transaction(async (manager) => {
      const purchaseRepository = manager.getRepository(Purchase);
      const purchaseId = Number(query.compra_id);

      if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
        throw new Error("El identificador de la compra no es válido.");
      }

      /*
       * Bloquea exclusivamente la fila de Purchases.
       *
       * No deben agregarse LEFT JOIN a esta consulta porque PostgreSQL
       * no permite aplicar FOR UPDATE sobre el lado anulable de un
       * outer join.
       */
      const lockedPurchase = await purchaseRepository
        .createQueryBuilder("purchase")
        .setLock("pessimistic_write")
        .where("purchase.compra_id = :purchaseId", {
          purchaseId,
        })
        .getOne();

      if (!lockedPurchase) {
        throw new Error("Compra no encontrada.");
      }

      /*
       * La fila principal permanece bloqueada hasta que termine esta
       * transacción. Ahora las relaciones se cargan en otra consulta.
       */
      const purchaseWithRelations = await getPurchaseWithRelations(
        purchaseRepository,
        purchaseId,
      );

      if (!purchaseWithRelations) {
        throw new Error("No fue posible cargar la compra.");
      }

      if (purchaseWithRelations.estado !== PURCHASE_STATE_CONFIRMED) {
        throw new Error(
          "Solo se pueden volver a borrador compras confirmadas.",
        );
      }

      if (hasPurchaseInventoryReceipts(purchaseWithRelations)) {
        throw new Error(
          "No se puede volver a borrador una compra con recepciones registradas.",
        );
      }

      if (purchaseWithRelations.transaction?.transaccion_id) {
        throw new Error(
          "No se puede volver a borrador una compra con movimientos contables asociados.",
        );
      }

      await cancelPayableForSourceIfNoPayments(manager, {
        originType: "PURCHASE",
        originId: purchaseId,
        sourceLabel: "compra",
        reason: "Compra revertida a borrador desde modulo de inventario",
        metadata: {
          reverted_to_draft: true,
          source_type: "PURCHASE",
          source_id: purchaseId,
        },
      });

      await purchaseRepository.update(
        { compra_id: purchaseId },
        {
          estado: PURCHASE_STATE_DRAFT,
          fecha_recepcion: null,
        },
      );

      const revertedPurchase = await getPurchaseWithRelations(
        purchaseRepository,
        purchaseId,
      );

      if (!revertedPurchase) {
        throw new Error(
          "No fue posible cargar la compra después de volverla a borrador.",
        );
      }

      return buildPurchaseWithAccountingSummary(
        manager,
        revertedPurchase,
      );
    });

    return [purchase, null];
  } catch (error) {
    console.error("Error al volver compra a borrador:", error);

    return [
      null,
      error.message || "Error interno al volver compra a borrador",
    ];
  }
}

export async function deletePurchaseService(query) {
  try {
    const purchase = await AppDataSource.transaction(async (manager) => {
      const purchaseRepository = manager.getRepository(Purchase);
      const purchaseFound = await purchaseRepository.findOne({
        where: { compra_id: Number(query.compra_id) },
        relations: {
          supplier: true,
          transaction: true,
          registered_by: true,
          purchase_details: {
            item: {
              categoria: true,
              unidad_medida: true,
            },
            inventory_movements: true,
            inventory_receipts: true,
          },
        },
      });

      if (!purchaseFound) {
        throw new Error("Compra no encontrada");
      }

      assertPurchaseCanBeCancelledFromInventory(purchaseFound);

      const existingPayable = await findPayableBySource(manager, {
        originType: "PURCHASE",
        originId: purchaseFound.compra_id,
      });

      if (purchaseFound.estado === PURCHASE_STATE_DRAFT && !existingPayable) {
        if ((purchaseFound.purchase_details || []).length === 0) {
          return purchaseRepository.remove(purchaseFound);
        }

        await purchaseRepository.update(
          { compra_id: Number(purchaseFound.compra_id) },
          { estado: PURCHASE_STATE_CANCELLED },
        );

        const cancelledDraft = await getPurchaseWithRelations(
          purchaseRepository,
          purchaseFound.compra_id,
        );

        return {
          ...mapPurchase(cancelledDraft),
          operacion: "cancelacion_logica",
        };
      }

      if (existingPayable) {
        await purchaseRepository.update(
          { compra_id: Number(purchaseFound.compra_id) },
          { estado: PURCHASE_STATE_CANCELLED },
        );

        const refreshedPurchase = await getPurchaseWithRelations(
          purchaseRepository,
          purchaseFound.compra_id,
        );
        const syncResult = await syncPurchasePayable(manager, refreshedPurchase);
        const cancelledPurchase = await getPurchaseWithRelations(
          purchaseRepository,
          purchaseFound.compra_id,
        );

        return {
          ...attachPurchasePayableSummary(mapPurchase(cancelledPurchase), syncResult),
          operacion: "cancelacion_logica",
        };
      }

      return purchaseRepository.remove(purchaseFound);
    });

    return [purchase, null];
  } catch (error) {
    console.error("Error al eliminar compra:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export {
  PURCHASE_STATE_CANCELLED,
  PURCHASE_STATE_CONFIRMED,
  PURCHASE_STATE_DRAFT,
  recalculateDraftPurchaseTotal,
};
