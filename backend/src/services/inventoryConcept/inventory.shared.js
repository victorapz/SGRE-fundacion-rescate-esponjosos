"use strict";

import { AppDataSource } from "../../config/configDb.js";
import Donation from "../../entities/inventoryConcept/donation.entity.js";
import DonationItem from "../../entities/inventoryConcept/donation_item.entity.js";
import InventoryAdjustment from "../../entities/inventoryConcept/inventory_adjustment.entity.js";
import InventoryAdjustmentDetail from "../../entities/inventoryConcept/inventory_adjustment_detail.entity.js";
import InventoryExistence from "../../entities/inventoryConcept/inventory_existence.entity.js";
import InventoryMovement from "../../entities/inventoryConcept/inventory_movement.entity.js";
import InventoryReceipt from "../../entities/inventoryConcept/inventory_receipt.entity.js";
import Item from "../../entities/inventoryConcept/item.entity.js";
import Location from "../../entities/inventoryConcept/location.entity.js";
import Purchase from "../../entities/inventoryConcept/purchase.entity.js";
import PurchaseDetail from "../../entities/inventoryConcept/purchase_detail.entity.js";
import StockCount from "../../entities/inventoryConcept/stock_count.entity.js";
import StockCountDetail from "../../entities/inventoryConcept/stock_count_detail.entity.js";
import Supplier from "../../entities/inventoryConcept/supplier.entity.js";
import User from "../../entities/user.entity.js";
import { locationRelations, mapLocationSummary, normalizeNullableString } from "../location.shared.js";

const GLOBAL_READ_PERMISSIONS = [
  "inventory:read:any",
  "inventory:item:read",
  "inventory:inventory_movement:read",
  "inventory:stock_count:read",
  "inventory:inventory_adjustment:read",
  "inventory:donation:read",
  "inventory:donation_item:read",
  "inventory:purchase:read",
  "inventory:purchase_detail:read",
  "inventory:inventory_existence:read",
];

const LOCATION_READ_PERMISSIONS = [
  "inventory:read:location",
];

const GLOBAL_MOVEMENT_PERMISSIONS = [
  "inventory:movement:create:any",
  "inventory:inventory_movement:create",
  "inventory:inventory_movement:update",
  "inventory:donation_item:update",
  "inventory:purchase_detail:update",
];

const LOCATION_MOVEMENT_PERMISSIONS = [
  "inventory:movement:create:location",
];

const GLOBAL_ADJUSTMENT_CREATE_PERMISSIONS = [
  "inventory:adjustment:create:any",
  "inventory:inventory_adjustment:create",
  "inventory:inventory_adjustment:update",
  "inventory:inventory_adjustment:delete",
];

const GLOBAL_ADJUSTMENT_APPLY_PERMISSIONS = [
  "inventory:adjustment:apply:any",
  "inventory:inventory_adjustment:update",
];

const LOCATION_ADJUSTMENT_PERMISSIONS = [
  "inventory:adjustment:create:location",
];

const GLOBAL_INITIAL_LOAD_PERMISSIONS = [
  "inventory:initial_load:create",
  "inventory:inventory_movement:create",
];

function hasAnyPermission(permissions = [], expected = []) {
  return expected.some((permission) => permissions.includes(permission));
}

export function toNumericNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

export function toDateOnly(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

export function assertPositiveAmount(value, label = "La cantidad") {
  const amount = toNumericNumber(value, NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} debe ser mayor a 0.`);
  }
  return amount;
}

export function assertNonNegativeAmount(value, label = "La cantidad") {
  const amount = toNumericNumber(value, NaN);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} no puede ser negativa.`);
  }
  return amount;
}

export function buildMovementReference(type, id) {
  return {
    referencia_tipo: type || null,
    referencia_id: id ? Number(id) : null,
  };
}

export const INVENTORY_RECEIPT_DETAIL_STATES = {
  PENDING: "PENDIENTE",
  PARTIAL: "PARCIAL",
  COMPLETE: "COMPLETO",
  CLOSED_INCOMPLETE: "CERRADO_INCOMPLETO",
  CANCELLED: "CANCELADO",
};

export const INVENTORY_RECEIPT_HEADER_STATES = {
  PENDING: "PENDIENTE",
  PARTIAL: "PARCIAL",
  COMPLETE: "COMPLETA",
};

export function isInventoryReceiptDetailClosed(detail) {
  return [
    INVENTORY_RECEIPT_DETAIL_STATES.COMPLETE,
    INVENTORY_RECEIPT_DETAIL_STATES.CLOSED_INCOMPLETE,
  ].includes(detail?.estado);
}

export function calculateInventoryReceiptPendingQuantity(expectedQuantity, receivedQuantity) {
  const expected = assertNonNegativeAmount(expectedQuantity, "La cantidad esperada");
  const received = assertNonNegativeAmount(receivedQuantity, "La cantidad recibida");
  return Number(Math.max(expected - received, 0).toFixed(2));
}

export function deriveInventoryReceiptDetailState({
  expectedQuantity,
  receivedQuantity,
  closeDetail = false,
}) {
  const expected = assertNonNegativeAmount(expectedQuantity, "La cantidad esperada");
  const received = assertNonNegativeAmount(receivedQuantity, "La cantidad recibida");

  if (received > expected) {
    throw new Error("La cantidad recibida no puede exceder la cantidad esperada.");
  }

  if (received === 0) {
    return {
      estado: INVENTORY_RECEIPT_DETAIL_STATES.PENDING,
      cerrado: false,
      cierre_incompleto: false,
      cantidad_pendiente: expected,
    };
  }

  if (received === expected) {
    return {
      estado: INVENTORY_RECEIPT_DETAIL_STATES.COMPLETE,
      cerrado: true,
      cierre_incompleto: false,
      cantidad_pendiente: 0,
    };
  }

  if (closeDetail) {
    return {
      estado: INVENTORY_RECEIPT_DETAIL_STATES.CLOSED_INCOMPLETE,
      cerrado: true,
      cierre_incompleto: true,
      cantidad_pendiente: calculateInventoryReceiptPendingQuantity(expected, received),
    };
  }

  return {
    estado: INVENTORY_RECEIPT_DETAIL_STATES.PARTIAL,
    cerrado: false,
    cierre_incompleto: false,
    cantidad_pendiente: calculateInventoryReceiptPendingQuantity(expected, received),
  };
}

export function deriveInventoryReceiptHeaderState(details = []) {
  const normalizedDetails = Array.isArray(details) ? details : [];

  if (!normalizedDetails.length) {
    return INVENTORY_RECEIPT_HEADER_STATES.PENDING;
  }

  const hasAnyReceipt = normalizedDetails.some(
    (detail) => toNumericNumber(detail?.cantidad_recepcionada, 0) > 0,
  );

  if (!hasAnyReceipt) {
    return INVENTORY_RECEIPT_HEADER_STATES.PENDING;
  }

  const allClosed = normalizedDetails.every((detail) => isInventoryReceiptDetailClosed(detail));

  return allClosed
    ? INVENTORY_RECEIPT_HEADER_STATES.COMPLETE
    : INVENTORY_RECEIPT_HEADER_STATES.PARTIAL;
}

export function mapInventoryItem(item) {
  if (!item) return null;

  return {
    item_id: item.item_id,
    nombre: item.nombre || "",
    descripcion: item.descripcion || null,
    stock_minimo:
      item.stock_minimo === null || item.stock_minimo === undefined
        ? null
        : toNumericNumber(item.stock_minimo, null),
    activo: Boolean(item.activo),
    categoria: item.categoria
      ? {
          categoria_item_id: item.categoria.categoria_item_id,
          nombre_categoria: item.categoria.nombre_categoria || "",
          activo: Boolean(item.categoria.activo),
        }
      : null,
    unidad_medida: item.unidad_medida
      ? {
          unidad_medida_id: item.unidad_medida.unidad_medida_id,
          nombre: item.unidad_medida.nombre || "",
          descripcion: item.unidad_medida.descripcion || null,
          activo: Boolean(item.unidad_medida.activo),
        }
      : null,
  };
}

export function mapInventoryExistence(existence) {
  if (!existence) return null;

  return {
    existencia_id: existence.existencia_id,
    cantidad_actual: toNumericNumber(existence.cantidad_actual),
    fecha_vencimiento: toDateOnly(existence.fecha_vencimiento),
    fecha_apertura: toDateOnly(existence.fecha_apertura),
    condicion: existence.condicion || null,
    estado: existence.estado || "",
    origen_tipo: existence.origen_tipo || null,
    origen_id: existence.origen_id ?? null,
    observaciones: existence.observaciones || null,
    item: mapInventoryItem(existence.item),
    location: mapLocationSummary(existence.location),
    createdAt: existence.createdAt || null,
    updatedAt: existence.updatedAt || null,
  };
}

export function mapInventoryMovement(movement) {
  if (!movement) return null;

  return {
    movimiento_id: movement.movimiento_id,
    tipo_movimiento: movement.tipo_movimiento || "",
    cantidad: toNumericNumber(movement.cantidad),
    fecha_movimiento: toDateOnly(movement.fecha_movimiento),
    referencia_tipo: movement.referencia_tipo || null,
    referencia_id: movement.referencia_id ?? null,
    observaciones: movement.observaciones || null,
    item: mapInventoryItem(movement.item),
    source_location: mapLocationSummary(movement.source_location),
    destination_location: mapLocationSummary(movement.destination_location),
    performed_by: movement.performed_by
      ? {
          id_usuario: movement.performed_by.id_usuario,
          nombre: movement.performed_by.nombre || "",
          apellido: movement.performed_by.apellido || "",
          email: movement.performed_by.email || "",
        }
      : null,
    donation_item_id: movement.donation_item?.donacion_individual_id || null,
    purchase_detail_id: movement.purchase_detail?.detalle_compra_id || null,
    createdAt: movement.createdAt || null,
    updatedAt: movement.updatedAt || null,
  };
}

export function mapInventoryReceipt(receipt) {
  if (!receipt) return null;

  return {
    recepcion_inventario_id: receipt.recepcion_inventario_id,
    cantidad: toNumericNumber(receipt.cantidad),
    fecha_recepcion: toDateOnly(receipt.fecha_recepcion),
    observaciones: receipt.observaciones || null,
    cierra_detalle: Boolean(receipt.cierra_detalle),
    idempotency_key: receipt.idempotency_key || null,
    movement_id: receipt.movement?.movimiento_id || null,
    destination_location: mapLocationSummary(receipt.destination_location),
    performed_by: receipt.performed_by
      ? {
          id_usuario: receipt.performed_by.id_usuario,
          nombre: receipt.performed_by.nombre || "",
          apellido: receipt.performed_by.apellido || "",
          email: receipt.performed_by.email || "",
        }
      : null,
    movement: receipt.movement ? mapInventoryMovement(receipt.movement) : null,
    createdAt: receipt.createdAt || null,
    updatedAt: receipt.updatedAt || null,
  };
}

export function mapDonationItem(donationItem) {
  if (!donationItem) return null;

  const cantidad = toNumericNumber(donationItem.cantidad);
  const cantidadRecepcionada = toNumericNumber(donationItem.cantidad_recepcionada);
  const derivedState = deriveInventoryReceiptDetailState({
    expectedQuantity: cantidad,
    receivedQuantity: cantidadRecepcionada,
    closeDetail: Boolean(donationItem.recepcion_parcial_definitiva),
  });

  return {
    donacion_individual_id: donationItem.donacion_individual_id,
    cantidad,
    cantidad_recepcionada: cantidadRecepcionada,
    cantidad_pendiente: derivedState.cantidad_pendiente,
    fecha_vencimiento: toDateOnly(donationItem.fecha_vencimiento),
    fecha_apertura: toDateOnly(donationItem.fecha_apertura),
    condiciones_almacenamiento: donationItem.condiciones_almacenamiento || null,
    condicion: donationItem.condicion || null,
    estado: donationItem.estado || derivedState.estado,
    cerrado: derivedState.cerrado,
    cierre_incompleto: derivedState.cierre_incompleto,
    observaciones: donationItem.observaciones || null,
    recepcion_parcial_definitiva: Boolean(donationItem.recepcion_parcial_definitiva),
    item: mapInventoryItem(donationItem.item),
    donation: donationItem.donation
      ? {
          donacion_id: donationItem.donation.donacion_id,
          motivo_donacion: donationItem.donation.motivo_donacion || "",
          estado: donationItem.donation.estado || "",
        }
      : null,
    inventory_movements: Array.isArray(donationItem.inventory_movement)
      ? donationItem.inventory_movement.map(mapInventoryMovement)
      : [],
    inventory_receipts: Array.isArray(donationItem.inventory_receipts)
      ? donationItem.inventory_receipts.map(mapInventoryReceipt)
      : [],
  };
}

export function mapPurchaseDetail(purchaseDetail) {
  if (!purchaseDetail) return null;

  const cantidad = toNumericNumber(purchaseDetail.cantidad);
  const cantidadRecepcionada = toNumericNumber(purchaseDetail.cantidad_recepcionada);
  const derivedState = deriveInventoryReceiptDetailState({
    expectedQuantity: cantidad,
    receivedQuantity: cantidadRecepcionada,
    closeDetail: Boolean(purchaseDetail.recepcion_parcial_definitiva),
  });

  return {
    detalle_compra_id: purchaseDetail.detalle_compra_id,
    cantidad,
    cantidad_recepcionada: cantidadRecepcionada,
    cantidad_pendiente: derivedState.cantidad_pendiente,
    precio_unitario: toNumericNumber(purchaseDetail.precio_unitario),
    subtotal: toNumericNumber(purchaseDetail.subtotal),
    fecha_vencimiento: toDateOnly(purchaseDetail.fecha_vencimiento),
    fecha_apertura: toDateOnly(purchaseDetail.fecha_apertura),
    condiciones_almacenamiento: purchaseDetail.condiciones_almacenamiento || null,
    condicion: purchaseDetail.condicion || null,
    estado: purchaseDetail.estado || derivedState.estado,
    cerrado: derivedState.cerrado,
    cierre_incompleto: derivedState.cierre_incompleto,
    observaciones: purchaseDetail.observaciones || null,
    recepcion_parcial_definitiva: Boolean(purchaseDetail.recepcion_parcial_definitiva),
    item: mapInventoryItem(purchaseDetail.item),
    purchase: purchaseDetail.purchase
      ? {
          compra_id: purchaseDetail.purchase.compra_id,
          estado: purchaseDetail.purchase.estado || "",
          fecha_compra: toDateOnly(purchaseDetail.purchase.fecha_compra),
        }
      : null,
    inventory_movements: Array.isArray(purchaseDetail.inventory_movements)
      ? purchaseDetail.inventory_movements.map(mapInventoryMovement)
      : [],
    inventory_receipts: Array.isArray(purchaseDetail.inventory_receipts)
      ? purchaseDetail.inventory_receipts.map(mapInventoryReceipt)
      : [],
  };
}

export function mapPurchase(purchase) {
  if (!purchase) return null;

  const purchaseDetails = Array.isArray(purchase.purchase_details)
    ? purchase.purchase_details.map(mapPurchaseDetail)
    : [];
  const estadoRecepcion = deriveInventoryReceiptHeaderState(purchaseDetails);

  return {
    compra_id: purchase.compra_id,
    fecha_compra: toDateOnly(purchase.fecha_compra),
    fecha_recepcion: toDateOnly(purchase.fecha_recepcion),
    estado: purchase.estado || "",
    estado_recepcion: estadoRecepcion,
    monto_total: toNumericNumber(purchase.monto_total),
    moneda: purchase.moneda || "CLP",
    estado_pago: purchase.estado_pago || "PENDIENTE",
    fecha_vencimiento_pago: toDateOnly(purchase.fecha_vencimiento_pago),
    observacion_financiera: purchase.observacion_financiera || null,
    descripcion: purchase.descripcion || null,
    observaciones: purchase.observaciones || null,
    supplier: purchase.supplier
      ? {
          proveedor_id: purchase.supplier.proveedor_id,
          nombre: purchase.supplier.nombre || "",
          activo: Boolean(purchase.supplier.activo),
          location: mapLocationSummary(purchase.supplier.location),
        }
      : null,
    transaction_id: purchase.transaction?.transaccion_id || null,
    registered_by: purchase.registered_by
      ? {
          id_usuario: purchase.registered_by.id_usuario,
          nombre: purchase.registered_by.nombre || "",
          apellido: purchase.registered_by.apellido || "",
          email: purchase.registered_by.email || "",
        }
      : null,
    purchase_details: purchaseDetails,
  };
}

export function mapStockCount(stockCount) {
  if (!stockCount) return null;

  return {
    conteo_fisico_id: stockCount.conteo_fisico_id,
    fecha_conteo: toDateOnly(stockCount.fecha_conteo),
    observaciones: stockCount.observaciones || null,
    location: mapLocationSummary(stockCount.location),
    performed_by: stockCount.performed_by
      ? {
          id_usuario: stockCount.performed_by.id_usuario,
          nombre: stockCount.performed_by.nombre || "",
          apellido: stockCount.performed_by.apellido || "",
          email: stockCount.performed_by.email || "",
        }
      : null,
    detalles: Array.isArray(stockCount.details)
      ? stockCount.details.map((detail) => ({
          conteo_detalle_id: detail.conteo_detalle_id,
          cantidad_contada: toNumericNumber(detail.cantidad_contada),
          observaciones: detail.observaciones || null,
          item: mapInventoryItem(detail.item),
          existence: mapInventoryExistence(detail.existence),
        }))
      : [],
  };
}

export function mapInventoryAdjustment(adjustment) {
  if (!adjustment) return null;

  return {
    ajuste_inventario_id: adjustment.ajuste_inventario_id,
    fecha_ajuste: toDateOnly(adjustment.fecha_ajuste),
    motivo: adjustment.motivo || "",
    estado: adjustment.estado || "",
    observaciones: adjustment.observaciones || null,
    location: mapLocationSummary(adjustment.location),
    performed_by: adjustment.performed_by
      ? {
          id_usuario: adjustment.performed_by.id_usuario,
          nombre: adjustment.performed_by.nombre || "",
          apellido: adjustment.performed_by.apellido || "",
          email: adjustment.performed_by.email || "",
        }
      : null,
    stock_count_id: adjustment.stock_count?.conteo_fisico_id || null,
    details: Array.isArray(adjustment.inventory_adjustment_detail)
      ? adjustment.inventory_adjustment_detail.map((detail) => ({
          ajuste_detalle_id: detail.ajuste_detalle_id,
          cantidad_antes: toNumericNumber(detail.cantidad_antes),
          cantidad_contada: toNumericNumber(detail.cantidad_contada),
          diferencia: toNumericNumber(detail.diferencia),
          tipo_ajuste: detail.tipo_ajuste || "",
          item: mapInventoryItem(detail.item),
          existence: mapInventoryExistence(detail.existence),
        }))
      : [],
  };
}

async function getUserLocation(manager, userId) {
  const user = await manager.getRepository(User).findOne({
    where: { id_usuario: Number(userId), activo: true },
    relations: {
      location: locationRelations,
    },
  });

  if (!user) {
    throw new Error("Usuario autenticado no encontrado.");
  }

  return {
    user,
    locationId: user.location?.ubicacion_id ? Number(user.location.ubicacion_id) : null,
  };
}

export async function resolveInventoryScope(
  manager,
  authContext = {},
  {
    globalPermissions = [],
    locationPermissions = [],
  } = {},
) {
  const permissions = Array.isArray(authContext.permissions) ? authContext.permissions : [];
  const hasGlobal = hasAnyPermission(permissions, globalPermissions);
  const hasLocation = hasAnyPermission(permissions, locationPermissions);

  if (hasGlobal) {
    return {
      mode: "global",
      userId: authContext.userId ? Number(authContext.userId) : null,
      userLocationId: null,
    };
  }

  if (hasLocation) {
    const { locationId } = await getUserLocation(manager, authContext.userId);
    if (!locationId) {
      throw new Error("El usuario no tiene una ubicacion asociada para operar inventario.");
    }
    return {
      mode: "location",
      userId: Number(authContext.userId),
      userLocationId: Number(locationId),
    };
  }

  throw new Error("El usuario no tiene permisos suficientes para operar inventario.");
}

export async function resolveReadScope(manager, authContext = {}) {
  return resolveInventoryScope(manager, authContext, {
    globalPermissions: GLOBAL_READ_PERMISSIONS,
    locationPermissions: LOCATION_READ_PERMISSIONS,
  });
}

export async function resolveMovementScope(manager, authContext = {}) {
  return resolveInventoryScope(manager, authContext, {
    globalPermissions: GLOBAL_MOVEMENT_PERMISSIONS,
    locationPermissions: LOCATION_MOVEMENT_PERMISSIONS,
  });
}

export async function resolveAdjustmentCreateScope(manager, authContext = {}) {
  return resolveInventoryScope(manager, authContext, {
    globalPermissions: GLOBAL_ADJUSTMENT_CREATE_PERMISSIONS,
    locationPermissions: LOCATION_ADJUSTMENT_PERMISSIONS,
  });
}

export async function resolveAdjustmentApplyScope(manager, authContext = {}) {
  return resolveInventoryScope(manager, authContext, {
    globalPermissions: GLOBAL_ADJUSTMENT_APPLY_PERMISSIONS,
    locationPermissions: LOCATION_ADJUSTMENT_PERMISSIONS,
  });
}

export async function resolveInitialLoadScope(manager, authContext = {}) {
  return resolveInventoryScope(manager, authContext, {
    globalPermissions: GLOBAL_INITIAL_LOAD_PERMISSIONS,
    locationPermissions: LOCATION_MOVEMENT_PERMISSIONS,
  });
}

export function assertLocationWithinScope(scope, locationId) {
  if (!scope || scope.mode !== "location") return;
  if (Number(scope.userLocationId) !== Number(locationId)) {
    throw new Error("No tienes permisos para operar sobre una ubicacion ajena.");
  }
}

export async function getLocationOrThrow(manager, locationId, { requireActive = false } = {}) {
  const location = await manager.getRepository(Location).findOne({
    where: { ubicacion_id: Number(locationId) },
    relations: locationRelations,
  });

  if (!location) {
    throw new Error("Ubicacion no encontrada.");
  }

  if (requireActive && !location.activo) {
    throw new Error("La ubicacion indicada esta inactiva.");
  }

  return location;
}

export async function getItemOrThrow(manager, itemId, { requireActive = false } = {}) {
  const item = await manager.getRepository(Item).findOne({
    where: { item_id: Number(itemId) },
    relations: {
      categoria: true,
      unidad_medida: true,
    },
  });

  if (!item) {
    throw new Error("Item no encontrado.");
  }

  if (requireActive && !item.activo) {
    throw new Error("El item indicado esta inactivo.");
  }

  return item;
}

export async function getUserOrThrow(manager, userId) {
  const user = await manager.getRepository(User).findOne({
    where: { id_usuario: Number(userId), activo: true },
  });

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  return user;
}

export async function getSupplierOrThrow(manager, supplierId) {
  const supplier = await manager.getRepository(Supplier).findOne({
    where: { proveedor_id: Number(supplierId) },
    relations: {
      location: locationRelations,
    },
  });

  if (!supplier) {
    throw new Error("Proveedor no encontrado.");
  }

  return supplier;
}

export async function findExistenceById(manager, existenciaId, { withRelations = true } = {}) {
  const repository = manager.getRepository(InventoryExistence);
  return repository.findOne({
    where: { existencia_id: Number(existenciaId) },
    relations: withRelations
      ? {
          item: {
            categoria: true,
            unidad_medida: true,
          },
          location: locationRelations,
        }
      : undefined,
  });
}

export async function findAvailableExistences(
  manager,
  {
    itemId,
    locationId,
  } = {},
) {
  const queryBuilder = manager
    .getRepository(InventoryExistence)
    .createQueryBuilder("existence")
    .leftJoinAndSelect("existence.item", "item")
    .leftJoinAndSelect("item.categoria", "categoria")
    .leftJoinAndSelect("item.unidad_medida", "unidad")
    .leftJoinAndSelect("existence.location", "location")
    .leftJoinAndSelect("location.region", "region")
    .leftJoinAndSelect("location.comuna", "comuna")
    .where("existence.estado = :estado", { estado: "DISPONIBLE" })
    .andWhere("CAST(existence.cantidad_actual AS numeric) > 0");

  if (itemId) {
    queryBuilder.andWhere("item.item_id = :itemId", { itemId: Number(itemId) });
  }

  if (locationId) {
    queryBuilder.andWhere("location.ubicacion_id = :locationId", {
      locationId: Number(locationId),
    });
  }

  queryBuilder
    .orderBy("existence.fecha_vencimiento", "ASC", "NULLS LAST")
    .addOrderBy("existence.fecha_apertura", "ASC", "NULLS LAST")
    .addOrderBy("existence.createdAt", "ASC");

  return queryBuilder.getMany();
}

export async function getExistencesByItem(manager, itemId, { locationId = null } = {}) {
  const where = {
    item: { item_id: Number(itemId) },
  };

  if (locationId) {
    where.location = { ubicacion_id: Number(locationId) };
  }

  return manager.getRepository(InventoryExistence).find({
    where,
    relations: {
      item: {
        categoria: true,
        unidad_medida: true,
      },
      location: locationRelations,
    },
    order: {
      createdAt: "DESC",
    },
  });
}

export async function getExistencesByLocation(manager, locationId) {
  return manager.getRepository(InventoryExistence).find({
    where: {
      location: { ubicacion_id: Number(locationId) },
    },
    relations: {
      item: {
        categoria: true,
        unidad_medida: true,
      },
      location: locationRelations,
    },
    order: {
      createdAt: "DESC",
    },
  });
}

function isEquivalentExistence(existence, payload) {
  return (
    Number(existence.item?.item_id || existence.item_id) === Number(payload.item_id)
    && Number(existence.location?.ubicacion_id || existence.ubicacion_id)
      === Number(payload.location_id)
    && toDateOnly(existence.fecha_vencimiento) === toDateOnly(payload.fecha_vencimiento)
    && toDateOnly(existence.fecha_apertura) === toDateOnly(payload.fecha_apertura)
    && (existence.condicion || null) === (payload.condicion || null)
    && (existence.origen_tipo || null) === (payload.origen_tipo || null)
    && Number(existence.origen_id || 0) === Number(payload.origen_id || 0)
    && normalizeNullableString(existence.observaciones)
      === normalizeNullableString(payload.observaciones)
  );
}

export async function resolveEquivalentExistence(manager, payload) {
  const candidates = await manager.getRepository(InventoryExistence).find({
    where: {
      item: { item_id: Number(payload.item_id) },
      location: { ubicacion_id: Number(payload.location_id) },
    },
    relations: {
      item: true,
      location: true,
    },
  });

  return (
    candidates.find(
      (candidate) =>
        candidate.estado !== "DESCARTADO" && isEquivalentExistence(candidate, payload),
    ) || null
  );
}

export async function markAsAgotadoIfZero(manager, existence) {
  const repository = manager.getRepository(InventoryExistence);
  const current = existence.existencia_id
    ? existence
    : await repository.findOne({
        where: { existencia_id: Number(existence) },
      });

  if (!current) {
    throw new Error("Existencia no encontrada.");
  }

  if (toNumericNumber(current.cantidad_actual) <= 0) {
    current.cantidad_actual = 0;
    current.estado = "AGOTADO";
  } else if (current.estado === "AGOTADO") {
    current.estado = "DISPONIBLE";
  }

  return repository.save(current);
}

export async function createOrIncreaseExistence(manager, payload) {
  const repository = manager.getRepository(InventoryExistence);
  const amount = assertPositiveAmount(payload.cantidad_actual, "La cantidad actual");
  const equivalent = await resolveEquivalentExistence(manager, payload);

  if (equivalent) {
    equivalent.cantidad_actual = toNumericNumber(equivalent.cantidad_actual) + amount;
    equivalent.estado = "DISPONIBLE";
    if (payload.observaciones !== undefined) {
      equivalent.observaciones = normalizeNullableString(payload.observaciones);
    }
    const savedEquivalent = await repository.save(equivalent);
    return findExistenceById(manager, savedEquivalent.existencia_id);
  }

  const existence = repository.create({
    cantidad_actual: amount,
    fecha_vencimiento: payload.fecha_vencimiento || null,
    fecha_apertura: payload.fecha_apertura || null,
    condicion: payload.condicion || null,
    estado: amount > 0 ? "DISPONIBLE" : "AGOTADO",
    origen_tipo: payload.origen_tipo,
    origen_id: payload.origen_id ? Number(payload.origen_id) : null,
    observaciones: normalizeNullableString(payload.observaciones),
    item: { item_id: Number(payload.item_id) },
    location: { ubicacion_id: Number(payload.location_id) },
  });

  const savedExistence = await repository.save(existence);
  return findExistenceById(manager, savedExistence.existencia_id);
}

export async function decreaseExistence(manager, existence, quantity) {
  const repository = manager.getRepository(InventoryExistence);
  const amount = assertPositiveAmount(quantity, "La cantidad");
  const target = existence.existencia_id
    ? existence
    : await findExistenceById(manager, existence, { withRelations: false });

  if (!target) {
    throw new Error("Existencia no encontrada.");
  }

  const currentAmount = toNumericNumber(target.cantidad_actual);
  if (currentAmount < amount) {
    throw new Error("La existencia no tiene stock suficiente.");
  }

  target.cantidad_actual = currentAmount - amount;
  await markAsAgotadoIfZero(manager, target);
  return repository.findOne({
    where: { existencia_id: Number(target.existencia_id) },
    relations: {
      item: {
        categoria: true,
        unidad_medida: true,
      },
      location: locationRelations,
    },
  });
}

export async function createMovementRecord(manager, payload) {
  const repository = manager.getRepository(InventoryMovement);
  const movement = repository.create({
    tipo_movimiento: payload.tipo_movimiento,
    cantidad: assertPositiveAmount(payload.cantidad, "La cantidad"),
    fecha_movimiento: payload.fecha_movimiento || new Date().toISOString().slice(0, 10),
    referencia_tipo: payload.referencia_tipo || null,
    referencia_id: payload.referencia_id ? Number(payload.referencia_id) : null,
    observaciones: normalizeNullableString(payload.observaciones),
    item: { item_id: Number(payload.item_id) },
    source_location: payload.source_location_id
      ? { ubicacion_id: Number(payload.source_location_id) }
      : null,
    destination_location: payload.destination_location_id
      ? { ubicacion_id: Number(payload.destination_location_id) }
      : null,
    performed_by: { id_usuario: Number(payload.performed_by_id) },
    donation_item: payload.donation_item_id
      ? { donacion_individual_id: Number(payload.donation_item_id) }
      : null,
    purchase_detail: payload.purchase_detail_id
      ? { detalle_compra_id: Number(payload.purchase_detail_id) }
      : null,
  });

  const savedMovement = await repository.save(movement);
  return repository.findOne({
    where: { movimiento_id: Number(savedMovement.movimiento_id) },
    relations: {
      item: {
        categoria: true,
        unidad_medida: true,
      },
      source_location: locationRelations,
      destination_location: locationRelations,
      performed_by: true,
      donation_item: true,
      purchase_detail: true,
    },
  });
}

export async function assertScopedLocationOperation(manager, scope, locationId) {
  await getLocationOrThrow(manager, locationId, { requireActive: true });
  assertLocationWithinScope(scope, locationId);
}

export async function getScopedExistenceOrThrow(manager, scope, existenciaId) {
  const existence = await findExistenceById(manager, existenciaId);

  if (!existence) {
    throw new Error("Existencia no encontrada.");
  }

  assertLocationWithinScope(scope, existence.location?.ubicacion_id);

  return existence;
}

export async function recalculateDonationState(manager, donationId) {
  const donationRepository = manager.getRepository(Donation);
  const donation = await donationRepository.findOne({
    where: { donacion_id: Number(donationId) },
    relations: {
      donation_item: true,
    },
  });

  if (!donation) {
    throw new Error("Donacion no encontrada.");
  }

  if (donation.estado === "CANCELADO") {
    return donation;
  }

  const items = Array.isArray(donation.donation_item) ? donation.donation_item : [];
  const headerState = deriveInventoryReceiptHeaderState(items);
  const allClosed = headerState === INVENTORY_RECEIPT_HEADER_STATES.COMPLETE;
  donation.fecha_recepcion = allClosed ? new Date().toISOString().slice(0, 10) : null;
  await donationRepository.save(donation);
  return donation;
}

export async function recalculatePurchaseState(manager, purchaseId) {
  const purchaseRepository = manager.getRepository(Purchase);
  const purchase = await purchaseRepository.findOne({
    where: { compra_id: Number(purchaseId) },
    relations: {
      purchase_details: true,
    },
  });

  if (!purchase) {
    throw new Error("Compra no encontrada.");
  }

  if (purchase.estado === "CANCELADA") {
    return purchase;
  }

  const details = Array.isArray(purchase.purchase_details) ? purchase.purchase_details : [];
  const headerState = deriveInventoryReceiptHeaderState(details);
  const allClosed = headerState === INVENTORY_RECEIPT_HEADER_STATES.COMPLETE;
  purchase.fecha_recepcion = allClosed ? new Date().toISOString().slice(0, 10) : null;
  await purchaseRepository.save(purchase);
  return purchase;
}

export async function sumSystemQuantityForItemAtLocation(manager, itemId, locationId) {
  const rows = await manager.getRepository(InventoryExistence).find({
    where: {
      item: { item_id: Number(itemId) },
      location: { ubicacion_id: Number(locationId) },
    },
  });

  return rows.reduce(
    (accumulator, row) => accumulator + toNumericNumber(row.cantidad_actual),
    0,
  );
}

export async function getRecentMovementsForItem(manager, itemId, scope, limit = 25) {
  const queryBuilder = manager
    .getRepository(InventoryMovement)
    .createQueryBuilder("movement")
    .leftJoinAndSelect("movement.item", "item")
    .leftJoinAndSelect("item.categoria", "categoria")
    .leftJoinAndSelect("item.unidad_medida", "unidad")
    .leftJoinAndSelect("movement.source_location", "source_location")
    .leftJoinAndSelect("source_location.region", "source_region")
    .leftJoinAndSelect("source_location.comuna", "source_comuna")
    .leftJoinAndSelect("movement.destination_location", "destination_location")
    .leftJoinAndSelect("destination_location.region", "destination_region")
    .leftJoinAndSelect("destination_location.comuna", "destination_comuna")
    .leftJoinAndSelect("movement.performed_by", "performed_by")
    .leftJoinAndSelect("movement.donation_item", "donation_item")
    .leftJoinAndSelect("movement.purchase_detail", "purchase_detail")
    .where("item.item_id = :itemId", { itemId: Number(itemId) })
    .orderBy("movement.fecha_movimiento", "DESC")
    .addOrderBy("movement.movimiento_id", "DESC")
    .limit(limit);

  if (scope?.mode === "location") {
    queryBuilder.andWhere(
      "(source_location.ubicacion_id = :locationId OR destination_location.ubicacion_id = :locationId)",
      { locationId: Number(scope.userLocationId) },
    );
  }

  return queryBuilder.getMany();
}

export async function getDonationItemsForItem(manager, itemId) {
  return manager.getRepository(DonationItem).find({
    where: {
      item: { item_id: Number(itemId) },
    },
    relations: {
      donation: true,
      item: {
        categoria: true,
        unidad_medida: true,
      },
      inventory_movement: {
        item: true,
        source_location: locationRelations,
        destination_location: locationRelations,
        performed_by: true,
      },
    },
    order: {
      createdAt: "DESC",
    },
  });
}

export async function getPurchaseDetailsForItem(manager, itemId) {
  return manager.getRepository(PurchaseDetail).find({
    where: {
      item: { item_id: Number(itemId) },
    },
    relations: {
      purchase: {
        supplier: {
          location: locationRelations,
        },
      },
      item: {
        categoria: true,
        unidad_medida: true,
      },
      inventory_movements: {
        item: true,
        source_location: locationRelations,
        destination_location: locationRelations,
        performed_by: true,
      },
    },
    order: {
      createdAt: "DESC",
    },
  });
}

export {
  AppDataSource,
  Donation,
  DonationItem,
  InventoryAdjustment,
  InventoryAdjustmentDetail,
  InventoryExistence,
  InventoryMovement,
  InventoryReceipt,
  Item,
  Location,
  Purchase,
  PurchaseDetail,
  StockCount,
  StockCountDetail,
  Supplier,
  User,
  mapLocationSummary,
};
