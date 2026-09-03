"use strict";

import {
  AppDataSource,
  PurchaseDetail,
  getItemOrThrow,
  mapPurchaseDetail,
  toNumericNumber,
} from "./inventory.shared.js";
import {
  PURCHASE_STATE_CONFIRMED,
  calculatePurchaseDetailSubtotal,
  recalculateDraftPurchaseTotal,
} from "./purchase.service.js";
import {
  getPurchaseDetailWithReceiptRelations,
  registerBulkInventoryReceipts,
  registerInventoryReceipt,
} from "./inventory_receipt.service.js";

async function getPurchaseDetailWithRelations(repository, purchaseDetailId) {
  return getPurchaseDetailWithReceiptRelations(repository, purchaseDetailId);
}

export function assertPurchaseDetailMutable(purchaseDetail, {
  action = "modificar",
} = {}) {
  if (!purchaseDetail) {
    throw new Error("Detalle de compra no encontrado");
  }

  if (purchaseDetail.purchase?.estado === "CANCELADA") {
    throw new Error("No se puede modificar un detalle de una compra cancelada.");
  }

  if (purchaseDetail.purchase?.estado !== "BORRADOR") {
    throw new Error("Solo se pueden modificar detalles de compras en borrador.");
  }

  if (toNumericNumber(purchaseDetail.cantidad_recepcionada) > 0) {
    throw new Error(
      `No se puede ${action} un detalle de compra que ya tiene recepciones registradas.`,
    );
  }

  if ((purchaseDetail.inventory_receipts || []).length > 0) {
    throw new Error(
      `No se puede ${action} un detalle de compra que ya tiene recepciones registradas.`,
    );
  }

  if ((purchaseDetail.inventory_movements || []).length > 0) {
    throw new Error(
      "No se puede modificar este detalle porque ya genero movimientos de inventario.",
    );
  }
}

export async function createPurchaseDetailService(body) {
  try {
    const purchaseDetail = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PurchaseDetail);
      await getItemOrThrow(manager, body.item_id, { requireActive: true });

      const purchase = await manager.getRepository("Purchase").findOne({
        where: { compra_id: Number(body.purchase_id) },
      });

      if (!purchase) {
        throw new Error("Compra no encontrada.");
      }

      if (purchase.estado !== "BORRADOR") {
        throw new Error("Solo se pueden agregar detalles a compras en borrador.");
      }

      const subtotal = calculatePurchaseDetailSubtotal(body, { moneda: purchase.moneda || "CLP" });

      const newPurchaseDetail = repository.create({
        cantidad: body.cantidad,
        cantidad_recepcionada: 0,
        precio_unitario: body.precio_unitario,
        subtotal,
        fecha_vencimiento: body.fecha_vencimiento || null,
        fecha_apertura: body.fecha_apertura || null,
        condiciones_almacenamiento: body.condiciones_almacenamiento || null,
        condicion: body.condicion || "NUEVO",
        estado: "PENDIENTE",
        observaciones: body.observaciones || null,
        recepcion_parcial_definitiva: false,
        purchase: { compra_id: Number(body.purchase_id) },
        item: { item_id: Number(body.item_id) },
      });

      const savedPurchaseDetail = await repository.save(newPurchaseDetail);
      await recalculateDraftPurchaseTotal(manager, purchase.compra_id);
      return getPurchaseDetailWithRelations(repository, savedPurchaseDetail.detalle_compra_id);
    });

    return [mapPurchaseDetail(purchaseDetail), null];
  } catch (error) {
    console.error("Error al crear detalle de compra:", error);
    return [null, error.message || "Error interno al crear detalle de compra"];
  }
}

export async function getPurchaseDetailService(query) {
  try {
    const repository = AppDataSource.getRepository(PurchaseDetail);
    const purchaseDetail = await getPurchaseDetailWithRelations(
      repository,
      query.detalle_compra_id,
    );

    if (!purchaseDetail) return [null, "Detalle de compra no encontrado"];

    return [mapPurchaseDetail(purchaseDetail), null];
  } catch (error) {
    console.error("Error al obtener detalle de compra:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getPurchaseDetailsService() {
  try {
    const repository = AppDataSource.getRepository(PurchaseDetail);
    const purchaseDetails = await repository.find({
      relations: {
        purchase: true,
        item: {
          categoria: true,
          unidad_medida: true,
        },
        inventory_movements: true,
        inventory_receipts: true,
      },
      order: {
        createdAt: "DESC",
      },
    });

    if (!purchaseDetails || purchaseDetails.length === 0) {
      return [null, "No hay detalles de compra"];
    }

    return [purchaseDetails.map(mapPurchaseDetail), null];
  } catch (error) {
    console.error("Error al obtener detalles de compra:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updatePurchaseDetailService(query, body) {
  try {
    const purchaseDetail = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PurchaseDetail);
      const purchaseDetailFound = await repository.findOne({
        where: { detalle_compra_id: Number(query.detalle_compra_id) },
        relations: {
          purchase: true,
          inventory_movements: true,
          inventory_receipts: true,
        },
      });

      assertPurchaseDetailMutable(purchaseDetailFound, { action: "modificar" });

      if (body.item_id !== undefined) {
        await getItemOrThrow(manager, body.item_id, { requireActive: true });
        purchaseDetailFound.item = { item_id: Number(body.item_id) };
      }

      if (body.purchase_id !== undefined) {
        const purchase = await manager.getRepository("Purchase").findOne({
          where: { compra_id: Number(body.purchase_id) },
        });
        if (!purchase) {
          throw new Error("Compra no encontrada.");
        }
        if (purchase.estado !== "BORRADOR") {
          throw new Error("Solo se pueden mover detalles hacia compras en borrador.");
        }
        purchaseDetailFound.purchase = { compra_id: Number(body.purchase_id) };
      }

      if (body.cantidad !== undefined) purchaseDetailFound.cantidad = body.cantidad;
      if (body.precio_unitario !== undefined) {
        purchaseDetailFound.precio_unitario = body.precio_unitario;
      }
      if (body.fecha_vencimiento !== undefined) {
        purchaseDetailFound.fecha_vencimiento = body.fecha_vencimiento || null;
      }
      if (body.fecha_apertura !== undefined) {
        purchaseDetailFound.fecha_apertura = body.fecha_apertura || null;
      }
      if (body.condiciones_almacenamiento !== undefined) {
        purchaseDetailFound.condiciones_almacenamiento = body.condiciones_almacenamiento || null;
      }
      if (body.condicion !== undefined) purchaseDetailFound.condicion = body.condicion;
      if (body.observaciones !== undefined) {
        purchaseDetailFound.observaciones = body.observaciones || null;
      }

      purchaseDetailFound.subtotal = calculatePurchaseDetailSubtotal(
        {
          cantidad: purchaseDetailFound.cantidad,
          precio_unitario: purchaseDetailFound.precio_unitario,
        },
        { moneda: purchaseDetailFound.purchase?.moneda || "CLP" },
      );

      await repository.save(purchaseDetailFound);
      await recalculateDraftPurchaseTotal(
        manager,
        purchaseDetailFound.purchase?.compra_id || body.purchase_id,
      );
      return getPurchaseDetailWithRelations(
        repository,
        purchaseDetailFound.detalle_compra_id,
      );
    });

    return [mapPurchaseDetail(purchaseDetail), null];
  } catch (error) {
    console.error("Error al actualizar detalle de compra:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deletePurchaseDetailService(query) {
  try {
    const purchaseDetail = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PurchaseDetail);
      const purchaseDetailFound = await repository.findOne({
        where: { detalle_compra_id: Number(query.detalle_compra_id) },
        relations: {
          purchase: true,
          inventory_movements: true,
          inventory_receipts: true,
        },
      });

      assertPurchaseDetailMutable(purchaseDetailFound, { action: "eliminar" });

      const purchaseId = purchaseDetailFound.purchase?.compra_id;
      const deleted = await repository.remove(purchaseDetailFound);
      await recalculateDraftPurchaseTotal(manager, purchaseId);
      return deleted;
    });

    return [purchaseDetail, null];
  } catch (error) {
    console.error("Error al eliminar detalle de compra:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function receivePurchaseDetailService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PurchaseDetail);
      const currentDetail = await getPurchaseDetailWithRelations(
        repository,
        body.purchase_detail_id,
      );

      if (currentDetail && currentDetail.purchase?.estado !== PURCHASE_STATE_CONFIRMED) {
        throw new Error("La compra debe estar confirmada antes de registrar recepciones.");
      }

      return registerInventoryReceipt(manager, {
        sourceType: "PURCHASE",
        detailId: Number(body.purchase_detail_id),
        amount: body.cantidad_a_recepcionar,
        receiptDate: body.fecha_recepcion,
        destinationLocationId: Number(body.destination_location_id),
        observaciones: body.observaciones || null,
        closeDetail: Boolean(body.cierra_detalle),
        idempotencyKey: body.idempotency_key,
        authContext,
        movementPayload: {
          fecha_vencimiento: body.fecha_vencimiento ?? currentDetail?.fecha_vencimiento ?? null,
          fecha_apertura: body.fecha_apertura ?? currentDetail?.fecha_apertura ?? null,
          condicion: body.condicion ?? currentDetail?.condicion ?? null,
        },
      });
    });

    return [result, null];
  } catch (error) {
    console.error("Error al recepcionar detalle de compra:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function receivePurchaseDetailsBulkService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) =>
      registerBulkInventoryReceipts(manager, {
        sourceType: "PURCHASE",
        parentId: Number(body.purchase_id),
        detailIds: body.purchase_detail_ids,
        receiptDate: body.fecha_recepcion,
        destinationLocationId: Number(body.destination_location_id),
        observaciones: body.observaciones || null,
        batchIdempotencyKey: body.idempotency_key,
        authContext,
      }));

    return [result, null];
  } catch (error) {
    console.error("Error al recepcionar detalles de compra en lote:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
