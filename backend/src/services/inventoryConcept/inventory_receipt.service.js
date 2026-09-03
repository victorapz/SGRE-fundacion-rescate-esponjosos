"use strict";

import { v5 as uuidv5 } from "uuid";

import {
  InventoryReceipt,
  Purchase,
  PurchaseDetail,
  Donation,
  DonationItem,
  createMovementRecord,
  createOrIncreaseExistence,
  getLocationOrThrow,
  getUserOrThrow,
  resolveMovementScope,
  assertLocationWithinScope,
  mapInventoryExistence,
  mapInventoryMovement,
  mapInventoryReceipt,
  mapPurchaseDetail,
  mapDonationItem,
  toNumericNumber,
  deriveInventoryReceiptDetailState,
  deriveInventoryReceiptHeaderState,
  INVENTORY_RECEIPT_DETAIL_STATES,
  INVENTORY_RECEIPT_HEADER_STATES,
  recalculatePurchaseState,
  recalculateDonationState,
} from "./inventory.shared.js";

const SOURCE_CONFIG = {
  PURCHASE: {
    detailEntity: PurchaseDetail,
    parentEntity: Purchase,
    detailIdField: "detalle_compra_id",
    parentIdField: "compra_id",
    relationName: "purchase_detail",
    movementReferenceType: "COMPRA",
    closedParentError: "La compra debe estar confirmada antes de registrar recepciones.",
  },
  DONATION: {
    detailEntity: DonationItem,
    parentEntity: Donation,
    detailIdField: "donacion_individual_id",
    parentIdField: "donacion_id",
    relationName: "donation_item",
    movementReferenceType: "DONACION",
    closedParentError: "No se puede registrar una recepcion sobre una donacion cancelada.",
  },
};

const BULK_RECEIPT_UUID_NAMESPACE = uuidv5.URL;

function getSourceConfig(sourceType) {
  const config = SOURCE_CONFIG[sourceType];
  if (!config) {
    throw new Error("Tipo de recepcion no soportado.");
  }
  return config;
}

export function isInventoryReceiptUniqueViolation(error) {
  const details = String(error?.detail || error?.message || "");
  return error?.code === "23505" && details.includes("idempotency_key");
}

export function buildLockedRowQuery(repository, alias, idField, idValue) {
  return repository
    .createQueryBuilder(alias)
    .setLock("pessimistic_write")
    .where(`${alias}.${idField} = :idValue`, { idValue: Number(idValue) });
}

export async function lockBaseRowOrThrow(
  repository,
  {
    alias,
    idField,
    idValue,
    notFoundMessage,
  },
) {
  const queryBuilder = buildLockedRowQuery(repository, alias, idField, idValue);
  const entity = await queryBuilder.getOne();

  if (!entity) {
    throw new Error(notFoundMessage);
  }

  return entity;
}

export function sumInventoryReceiptQuantities(receipts = []) {
  return Number(
    (Array.isArray(receipts) ? receipts : []).reduce(
      (total, receipt) => total + toNumericNumber(receipt?.cantidad, 0),
      0,
    ).toFixed(2),
  );
}

function buildPurchaseDetailRelations() {
  return {
    purchase: {
      supplier: {
        location: {
          region: true,
          comuna: {
            region: true,
          },
        },
      },
    },
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
  };
}

function buildDonationItemRelations() {
  return {
    donation: {
      donor: true,
      region: true,
      receiving_user: true,
    },
    item: {
      categoria: true,
      unidad_medida: true,
    },
    inventory_movement: {
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
  };
}

export async function getPurchaseDetailWithReceiptRelations(repository, detailId) {
  return repository.findOne({
    where: { detalle_compra_id: Number(detailId) },
    relations: buildPurchaseDetailRelations(),
  });
}

export async function getDonationItemWithReceiptRelations(repository, detailId) {
  return repository.findOne({
    where: { donacion_individual_id: Number(detailId) },
    relations: buildDonationItemRelations(),
  });
}

async function getDetailWithRelations(manager, sourceType, detailId) {
  const config = getSourceConfig(sourceType);
  const repository = manager.getRepository(config.detailEntity);

  if (sourceType === "PURCHASE") {
    return getPurchaseDetailWithReceiptRelations(repository, detailId);
  }

  return getDonationItemWithReceiptRelations(repository, detailId);
}

async function getReceiptWithRelations(manager, receiptId) {
  return manager.getRepository(InventoryReceipt).findOne({
    where: { recepcion_inventario_id: Number(receiptId) },
    relations: {
      purchase_detail: buildPurchaseDetailRelations(),
      donation_item: buildDonationItemRelations(),
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
  });
}

export async function findReceiptByIdempotencyKey(manager, idempotencyKey) {
  if (!idempotencyKey) return null;

  return manager.getRepository(InventoryReceipt).findOne({
    where: { idempotency_key: idempotencyKey },
    relations: {
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
      purchase_detail: true,
      donation_item: true,
    },
  });
}

export function normalizeBulkReceiptDetailIds(detailIds = []) {
  const normalized = [...new Set(
    (Array.isArray(detailIds) ? detailIds : [])
      .map((detailId) => Number(detailId))
      .filter((detailId) => Number.isInteger(detailId) && detailId > 0),
  )].sort((left, right) => left - right);

  if (!normalized.length) {
    throw new Error("Debes seleccionar al menos un detalle para recepcionar.");
  }

  return normalized;
}

export function deriveBulkReceiptIdempotencyKey({
  batchIdempotencyKey,
  sourceType,
  parentId,
  detailId,
}) {
  if (!batchIdempotencyKey) {
    throw new Error("La clave de idempotencia del lote es obligatoria.");
  }

  const normalizedSourceType = String(sourceType || "").trim().toUpperCase();
  getSourceConfig(normalizedSourceType);

  return uuidv5(
    [
      "inventory-bulk-receipt",
      normalizedSourceType,
      Number(parentId),
      Number(detailId),
      String(batchIdempotencyKey).trim(),
    ].join(":"),
    BULK_RECEIPT_UUID_NAMESPACE,
  );
}

export function assertInventoryReceiptIdempotencyMatch(
  receipt,
  { sourceType, detailId },
) {
  if (!receipt) return;

  const normalizedSourceType = String(sourceType || "").trim().toUpperCase();
  const expectedDetailId = Number(detailId);
  const purchaseDetailId = Number(
    receipt.purchase_detail?.detalle_compra_id || 0,
  );
  const donationItemId = Number(
    receipt.donation_item?.donacion_individual_id || 0,
  );

  const matches = normalizedSourceType === "PURCHASE"
    ? purchaseDetailId === expectedDetailId && donationItemId === 0
    : normalizedSourceType === "DONATION"
      ? donationItemId === expectedDetailId && purchaseDetailId === 0
      : false;

  if (!matches) {
    throw new Error(
      "La clave de idempotencia ya fue utilizada para otra recepcion de inventario.",
    );
  }
}

async function mapExistingReceiptResult(
  manager,
  sourceType,
  detailId,
  existingReceipt,
) {
  assertInventoryReceiptIdempotencyMatch(existingReceipt, {
    sourceType,
    detailId,
  });

  const existingDetail = await getDetailWithRelations(
    manager,
    sourceType,
    detailId,
  );

  return mapReceiptResultFromDetail(
    sourceType,
    existingDetail,
    existingReceipt,
    existingReceipt.movement,
    null,
  );
}

function mapReceiptResultFromDetail(sourceType, detail, receipt, movement, existence) {
  if (sourceType === "PURCHASE") {
    return {
      receipt: receipt ? mapInventoryReceipt(receipt) : null,
      purchase_detail: detail ? mapPurchaseDetail(detail) : null,
      movement: movement ? mapInventoryMovement(movement) : null,
      existence: existence ? mapInventoryExistence(existence) : null,
    };
  }

  return {
    receipt: receipt ? mapInventoryReceipt(receipt) : null,
    donation_item: detail ? mapDonationItem(detail) : null,
    movement: movement ? mapInventoryMovement(movement) : null,
    existence: existence ? mapInventoryExistence(existence) : null,
  };
}

function getParentFromDetail(sourceType, detail) {
  return sourceType === "PURCHASE" ? detail?.purchase : detail?.donation;
}

function getMovementCollection(detail) {
  return Array.isArray(detail?.inventory_movements)
    ? detail.inventory_movements
    : Array.isArray(detail?.inventory_movement)
      ? detail.inventory_movement
      : [];
}

function getReceiptCollection(detail) {
  return Array.isArray(detail?.inventory_receipts) ? detail.inventory_receipts : [];
}

function assertReceiptParentState(sourceType, detail) {
  if (!detail) {
    throw new Error("Detalle no encontrado.");
  }

  if (detail.estado === INVENTORY_RECEIPT_DETAIL_STATES.CANCELLED) {
    throw new Error("No se puede recepcionar un detalle cancelado.");
  }

  if (
    [
      INVENTORY_RECEIPT_DETAIL_STATES.COMPLETE,
      INVENTORY_RECEIPT_DETAIL_STATES.CLOSED_INCOMPLETE,
    ].includes(detail.estado)
  ) {
    throw new Error("El detalle ya se encuentra cerrado y no admite nuevas recepciones.");
  }

  const parent = getParentFromDetail(sourceType, detail);

  if (sourceType === "PURCHASE") {
    if (!parent) {
      throw new Error("La compra asociada no fue encontrada.");
    }

    if (parent.estado === "CANCELADA") {
      throw new Error("No se puede registrar una recepcion sobre una compra cancelada.");
    }

    if (parent.estado !== "CONFIRMADA") {
      throw new Error("La compra debe estar confirmada antes de registrar recepciones.");
    }

    return;
  }

  if (!parent) {
    throw new Error("La donacion asociada no fue encontrada.");
  }

  if (parent.estado === "CANCELADO") {
    throw new Error("No se puede registrar una recepcion sobre una donacion cancelada.");
  }
}

function updateDetailReceiptCache(detail, receivedQuantity, closeDetail) {
  const derivedState = deriveInventoryReceiptDetailState({
    expectedQuantity: detail.cantidad,
    receivedQuantity,
    closeDetail,
  });

  detail.cantidad_recepcionada = receivedQuantity;
  detail.estado = derivedState.estado;
  detail.recepcion_parcial_definitiva = derivedState.cierre_incompleto;
  return derivedState;
}

async function recalculateParentReceiptDate(manager, sourceType, parentId) {
  if (sourceType === "PURCHASE") {
    return recalculatePurchaseState(manager, parentId);
  }

  return recalculateDonationState(manager, parentId);
}

export async function registerInventoryReceipt(manager, {
  sourceType,
  detailId,
  amount,
  receiptDate,
  destinationLocationId,
  observaciones = null,
  closeDetail = false,
  idempotencyKey,
  authContext = {},
  movementPayload = {},
  locksAlreadyHeld = false,
  recalculateParent = true,
}) {
  const config = getSourceConfig(sourceType);
  const receiptRepository = manager.getRepository(InventoryReceipt);
  const detailRepository = manager.getRepository(config.detailEntity);
  const parentRepository = manager.getRepository(config.parentEntity);

  const existingReceipt = await findReceiptByIdempotencyKey(manager, idempotencyKey);
  if (existingReceipt) {
    return mapExistingReceiptResult(
      manager,
      sourceType,
      detailId,
      existingReceipt,
    );
  }

  const scope = await resolveMovementScope(manager, authContext);
  const performedBy = await getUserOrThrow(manager, authContext.userId);
  const destinationLocation = await getLocationOrThrow(manager, destinationLocationId, {
    requireActive: true,
  });
  assertLocationWithinScope(scope, destinationLocation.ubicacion_id);

  if (!locksAlreadyHeld) {
    await lockBaseRowOrThrow(detailRepository, {
      alias: sourceType === "PURCHASE" ? "purchaseDetail" : "donationItem",
      idField: config.detailIdField,
      idValue: detailId,
      notFoundMessage:
        sourceType === "PURCHASE"
          ? "Detalle de compra no encontrado."
          : "Item de donacion no encontrado.",
    });
  }

  const detail = await getDetailWithRelations(manager, sourceType, detailId);
  assertReceiptParentState(sourceType, detail);

  const parent = getParentFromDetail(sourceType, detail);
  if (!locksAlreadyHeld) {
    await lockBaseRowOrThrow(parentRepository, {
      alias: sourceType === "PURCHASE" ? "purchase" : "donation",
      idField: config.parentIdField,
      idValue: parent?.[config.parentIdField],
      notFoundMessage:
        sourceType === "PURCHASE"
          ? "Compra no encontrada."
          : "Donacion no encontrada.",
    });

    const receiptAfterLock = await findReceiptByIdempotencyKey(
      manager,
      idempotencyKey,
    );
    if (receiptAfterLock) {
      return mapExistingReceiptResult(
        manager,
        sourceType,
        detailId,
        receiptAfterLock,
      );
    }
  }

  const receiptRows = getReceiptCollection(detail);
  const currentReceived = sumInventoryReceiptQuantities(receiptRows);
  const declaredAmount = toNumericNumber(detail.cantidad, 0);
  const amountToReceive = toNumericNumber(amount, NaN);

  if (!Number.isFinite(amountToReceive) || amountToReceive <= 0) {
    throw new Error("La cantidad a recepcionar debe ser mayor a 0.");
  }

  const pendingQuantity = Number(Math.max(declaredAmount - currentReceived, 0).toFixed(2));

  if (amountToReceive > pendingQuantity) {
    throw new Error("La cantidad recibida supera la cantidad pendiente del detalle.");
  }

  const movement = await createMovementRecord(manager, {
    tipo_movimiento: "ENTRADA",
    cantidad: amountToReceive,
    fecha_movimiento: receiptDate,
    referencia_tipo: config.movementReferenceType,
    referencia_id: Number(detail[config.detailIdField]),
    observaciones,
    item_id: Number(detail.item?.item_id),
    destination_location_id: Number(destinationLocation.ubicacion_id),
    performed_by_id: Number(performedBy.id_usuario),
    donation_item_id:
      sourceType === "DONATION" ? Number(detail.donacion_individual_id) : null,
    purchase_detail_id:
      sourceType === "PURCHASE" ? Number(detail.detalle_compra_id) : null,
  });

  const existence = await createOrIncreaseExistence(manager, {
    item_id: Number(detail.item?.item_id),
    location_id: Number(destinationLocation.ubicacion_id),
    cantidad_actual: amountToReceive,
    fecha_vencimiento: movementPayload.fecha_vencimiento || null,
    fecha_apertura: movementPayload.fecha_apertura || null,
    condicion: movementPayload.condicion || null,
    origen_tipo: config.movementReferenceType,
    origen_id: Number(detail[config.detailIdField]),
    observaciones,
  });

  let receipt;

  try {
    receipt = await receiptRepository.save(
      receiptRepository.create({
        cantidad: amountToReceive,
        fecha_recepcion: receiptDate,
        observaciones,
        cierra_detalle: Boolean(closeDetail),
        idempotency_key: idempotencyKey,
        destination_location: { ubicacion_id: Number(destinationLocation.ubicacion_id) },
        performed_by: { id_usuario: Number(performedBy.id_usuario) },
        movement: { movimiento_id: Number(movement.movimiento_id) },
        purchase_detail:
          sourceType === "PURCHASE"
            ? { detalle_compra_id: Number(detail.detalle_compra_id) }
            : null,
        donation_item:
          sourceType === "DONATION"
            ? { donacion_individual_id: Number(detail.donacion_individual_id) }
            : null,
      }),
    );
  } catch (error) {
    if (!isInventoryReceiptUniqueViolation(error)) {
      throw error;
    }

    throw new Error(
      "La clave de idempotencia ya fue utilizada para otra recepcion de inventario.",
    );
  }

  const nextReceived = Number(
    (currentReceived + amountToReceive).toFixed(2),
  );

  const derivedState = updateDetailReceiptCache(
    detail,
    nextReceived,
    Boolean(closeDetail),
  );

  /*
   * Se actualizan únicamente las columnas escalares del detalle.
   *
   * No se utiliza detailRepository.save(detail), porque detail contiene
   * relaciones cargadas antes de crear la recepción. Guardar la entidad
   * completa puede provocar que TypeORM intente sincronizar la colección
   * inventory_receipts y desvincule la recepción recién creada.
   */
  await detailRepository.update(
    {
      [config.detailIdField]: Number(detail[config.detailIdField]),
    },
    {
      cantidad_recepcionada: nextReceived,
      estado: derivedState.estado,
      recepcion_parcial_definitiva: derivedState.cierre_incompleto,
    },
  );

  if (recalculateParent) {
    await recalculateParentReceiptDate(
      manager,
      sourceType,
      parent?.[config.parentIdField],
    );
  }

  const refreshedDetail = await getDetailWithRelations(manager, sourceType, detailId);
  const savedReceipt = await getReceiptWithRelations(manager, receipt.recepcion_inventario_id);

  return mapReceiptResultFromDetail(
    sourceType,
    refreshedDetail,
    savedReceipt,
    movement,
    existence,
  );
}

export async function registerBulkInventoryReceipts(manager, {
  sourceType,
  parentId,
  detailIds,
  receiptDate,
  destinationLocationId,
  observaciones = null,
  batchIdempotencyKey,
  authContext = {},
}) {
  const config = getSourceConfig(sourceType);
  const normalizedParentId = Number(parentId);
  const normalizedDetailIds = normalizeBulkReceiptDetailIds(detailIds);
  const detailRepository = manager.getRepository(config.detailEntity);
  const parentRepository = manager.getRepository(config.parentEntity);

  for (const detailId of normalizedDetailIds) {
    await lockBaseRowOrThrow(detailRepository, {
      alias: sourceType === "PURCHASE" ? "purchaseDetail" : "donationItem",
      idField: config.detailIdField,
      idValue: detailId,
      notFoundMessage:
        sourceType === "PURCHASE"
          ? `Detalle de compra ${detailId} no encontrado.`
          : `Item de donacion ${detailId} no encontrado.`,
    });
  }

  const lockedDetails = [];
  for (const detailId of normalizedDetailIds) {
    const detail = await getDetailWithRelations(manager, sourceType, detailId);
    const detailParentId = Number(
      getParentFromDetail(sourceType, detail)?.[config.parentIdField] || 0,
    );

    if (detailParentId !== normalizedParentId) {
      throw new Error(
        sourceType === "PURCHASE"
          ? `El detalle de compra ${detailId} no pertenece a la compra indicada.`
          : `El item de donacion ${detailId} no pertenece a la donacion indicada.`,
      );
    }

    lockedDetails.push(detail);
  }

  await lockBaseRowOrThrow(parentRepository, {
    alias: sourceType === "PURCHASE" ? "purchase" : "donation",
    idField: config.parentIdField,
    idValue: normalizedParentId,
    notFoundMessage:
      sourceType === "PURCHASE"
        ? "Compra no encontrada."
        : "Donacion no encontrada.",
  });

  const results = [];

  for (const lockedDetail of lockedDetails) {
    const detailId = Number(lockedDetail[config.detailIdField]);
    const lineIdempotencyKey = deriveBulkReceiptIdempotencyKey({
      batchIdempotencyKey,
      sourceType,
      parentId: normalizedParentId,
      detailId,
    });
    const existingReceipt = await findReceiptByIdempotencyKey(
      manager,
      lineIdempotencyKey,
    );

    if (existingReceipt) {
      results.push(
        await mapExistingReceiptResult(
          manager,
          sourceType,
          detailId,
          existingReceipt,
        ),
      );
      continue;
    }

    const detail = await getDetailWithRelations(manager, sourceType, detailId);
    assertReceiptParentState(sourceType, detail);

    const currentReceived = sumInventoryReceiptQuantities(
      getReceiptCollection(detail),
    );
    const pendingQuantity = Number(
      Math.max(
        toNumericNumber(detail.cantidad, 0) - currentReceived,
        0,
      ).toFixed(2),
    );

    if (pendingQuantity <= 0) {
      throw new Error(
        sourceType === "PURCHASE"
          ? `El detalle de compra ${detailId} no tiene cantidad pendiente.`
          : `El item de donacion ${detailId} no tiene cantidad pendiente.`,
      );
    }

    results.push(
      await registerInventoryReceipt(manager, {
        sourceType,
        detailId,
        amount: pendingQuantity,
        receiptDate,
        destinationLocationId,
        observaciones,
        closeDetail: false,
        idempotencyKey: lineIdempotencyKey,
        authContext,
        movementPayload: {
          fecha_vencimiento: detail.fecha_vencimiento || null,
          fecha_apertura: detail.fecha_apertura || null,
          condicion: detail.condicion || null,
        },
        locksAlreadyHeld: true,
        recalculateParent: false,
      }),
    );
  }

  await recalculateParentReceiptDate(
    manager,
    sourceType,
    normalizedParentId,
  );

  return {
    batch_idempotency_key: batchIdempotencyKey,
    source_type: sourceType,
    parent_id: normalizedParentId,
    processed_count: results.length,
    receipts: results,
  };
}
