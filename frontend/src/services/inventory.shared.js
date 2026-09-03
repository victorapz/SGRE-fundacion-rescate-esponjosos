import api from "../api/axios";
import { toNullableNumber } from "../utils/financial";

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function isClosedReceiptState(value) {
  return value === "COMPLETO" || value === "CERRADO_INCOMPLETO";
}

function deriveDetailReceiptState(item = {}) {
  const expected = toNumber(item.cantidad);
  const received = toNumber(item.cantidad_recepcionada);
  const closeDetail = Boolean(item.recepcion_parcial_definitiva);
  const pending = Number(Math.max(expected - received, 0).toFixed(2));

  if (received <= 0) {
    return {
      estado: "PENDIENTE",
      cantidadPendiente: expected,
      cerrado: false,
      cierreIncompleto: false,
    };
  }

  if (received >= expected) {
    return {
      estado: "COMPLETO",
      cantidadPendiente: 0,
      cerrado: true,
      cierreIncompleto: false,
    };
  }

  if (closeDetail) {
    return {
      estado: "CERRADO_INCOMPLETO",
      cantidadPendiente: pending,
      cerrado: true,
      cierreIncompleto: true,
    };
  }

  return {
    estado: "PARCIAL",
    cantidadPendiente: pending,
    cerrado: false,
    cierreIncompleto: false,
  };
}

function deriveHeaderReceiptState(lines = []) {
  const detailLines = Array.isArray(lines) ? lines : [];
  if (!detailLines.length) return "PENDIENTE";

  const hasReceipts = detailLines.some((line) => toNumber(line.cantidadRecepcionada) > 0);
  if (!hasReceipts) return "PENDIENTE";

  return detailLines.every((line) => isClosedReceiptState(line.estado))
    ? "COMPLETA"
    : "PARCIAL";
}

export function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  const details = error?.response?.data?.details;
  if (Array.isArray(details) && details.length > 0) {
    return new Error(`${message}: ${details.join(", ")}`);
  }
  if (details && typeof details === "string") {
    return new Error(`${message}: ${details}`);
  }
  return new Error(message);
}

export function extractData(response) {
  return response?.data?.data ?? null;
}

export function extractItems(response) {
  const data = extractData(response);
  return Array.isArray(data) ? data : [];
}

export function normalizeLocation(item = {}) {
  if (!item) return null;

  const region = item.region
    ? {
        id: item.region.id_region || "",
        clave: item.region.clave || "",
        nombre: item.region.nombre || "",
      }
    : null;

  const comuna = item.comuna
    ? {
        id: item.comuna.id_comuna || "",
        nombre: item.comuna.nombre || "",
        activo: item.comuna.activo !== undefined ? Boolean(item.comuna.activo) : true,
      }
    : null;

  return {
    id: item.ubicacion_id || "",
    tipo: item.tipo || "",
    nombre: item.nombre_ubicacion || "",
    direccion: item.direccion || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    observaciones: item.observaciones || "",
    region,
    comuna,
    label: [item.nombre_ubicacion, item.tipo, item.comuna?.nombre].filter(Boolean).join(" · "),
  };
}

export function normalizeUserSummary(item = {}) {
  if (!item) return null;

  return {
    id: item.id_usuario || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
    email: item.email || "",
  };
}

export function normalizeDonor(item = {}) {
  if (!item) return null;

  return {
    id: item.donante_id || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim() || item.nombre || "",
    email: item.email || "",
    telefono: item.telefono || "",
    usuarioInstagram: item.usuario_instagram || "",
    direccion: item.direccion || "",
    observaciones: item.observaciones || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
  };
}

export function normalizeInventoryItem(item = {}) {
  if (!item) return null;

  const categoria = item.categoria
    ? {
        id: item.categoria.categoria_item_id || "",
        nombre: item.categoria.nombre_categoria || "",
        activo: item.categoria.activo !== undefined ? Boolean(item.categoria.activo) : true,
      }
    : null;

  const unidadMedida = item.unidad_medida
    ? {
        id: item.unidad_medida.unidad_medida_id || "",
        nombre: item.unidad_medida.nombre || "",
        descripcion: item.unidad_medida.descripcion || "",
        activo:
          item.unidad_medida.activo !== undefined
            ? Boolean(item.unidad_medida.activo)
            : true,
      }
    : null;

  return {
    id: item.item_id || "",
    nombre: item.nombre || "",
    descripcion: item.descripcion || "",
    stockMinimo: toNullableNumber(item.stock_minimo),
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    categoria,
    categoriaId: categoria?.id || "",
    categoriaNombre: categoria?.nombre || "",
    unidadMedida,
    unidadMedidaId: unidadMedida?.id || "",
    unidadMedidaNombre: unidadMedida?.nombre || "",
  };
}

export function normalizeInventoryExistence(item = {}) {
  if (!item) return null;

  const inventoryItem = normalizeInventoryItem(item.item);
  const location = normalizeLocation(item.location);

  return {
    id: item.existencia_id || "",
    cantidadActual: toNumber(item.cantidad_actual),
    fechaVencimiento: item.fecha_vencimiento || "",
    fechaApertura: item.fecha_apertura || "",
    condicion: item.condicion || "",
    estado: item.estado || "",
    origenTipo: item.origen_tipo || "",
    origenId: item.origen_id ?? null,
    observaciones: item.observaciones || "",
    item: inventoryItem,
    itemId: inventoryItem?.id || "",
    itemNombre: inventoryItem?.nombre || "",
    location,
    locationId: location?.id || "",
    locationLabel: location?.label || location?.nombre || "Sin ubicacion",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

export function normalizeInventoryMovement(item = {}) {
  if (!item) return null;

  const inventoryItem = normalizeInventoryItem(item.item);
  const sourceLocation = normalizeLocation(item.source_location);
  const destinationLocation = normalizeLocation(item.destination_location);
  const performedBy = normalizeUserSummary(item.performed_by);

  return {
    id: item.movimiento_id || "",
    tipoMovimiento: item.tipo_movimiento || "",
    cantidad: toNumber(item.cantidad),
    fechaMovimiento: item.fecha_movimiento || "",
    referenciaTipo: item.referencia_tipo || "",
    referenciaId: item.referencia_id ?? null,
    observaciones: item.observaciones || "",
    item: inventoryItem,
    itemId: inventoryItem?.id || "",
    itemNombre: inventoryItem?.nombre || "",
    sourceLocation,
    destinationLocation,
    performedBy,
    donationItemId: item.donation_item_id || null,
    purchaseDetailId: item.purchase_detail_id || null,
  };
}

export function normalizeInventoryReceipt(item = {}) {
  if (!item) return null;

  return {
    id: item.recepcion_inventario_id || "",
    cantidad: toNumber(item.cantidad),
    fechaRecepcion: item.fecha_recepcion || "",
    observaciones: item.observaciones || "",
    cierraDetalle: Boolean(item.cierra_detalle),
    idempotencyKey: item.idempotency_key || "",
    destinationLocation: normalizeLocation(item.destination_location),
    performedBy: normalizeUserSummary(item.performed_by),
    movement: item.movement ? normalizeInventoryMovement(item.movement) : null,
  };
}

export function normalizeDonationItem(item = {}) {
  if (!item) return null;

  const inventoryItem = normalizeInventoryItem(item.item);
  const donation = item.donation
    ? {
        id: item.donation.donacion_id || "",
        motivo: item.donation.motivo_donacion || "",
        estado: item.donation.estado || "",
      }
    : null;

  const inventoryMovements = Array.isArray(item.inventory_movements)
    ? item.inventory_movements.map(normalizeInventoryMovement)
    : [];
  const inventoryReceipts = Array.isArray(item.inventory_receipts)
    ? item.inventory_receipts.map(normalizeInventoryReceipt)
    : [];
  const derivedReceiptState = deriveDetailReceiptState(item);

  return {
    id: item.donacion_individual_id || "",
    cantidad: toNumber(item.cantidad),
    cantidadRecepcionada: toNumber(item.cantidad_recepcionada),
    cantidadPendiente:
      item.cantidad_pendiente !== undefined
        ? toNumber(item.cantidad_pendiente)
        : derivedReceiptState.cantidadPendiente,
    fechaVencimiento: item.fecha_vencimiento || "",
    fechaApertura: item.fecha_apertura || "",
    condicionesAlmacenamiento: item.condiciones_almacenamiento || "",
    condicion: item.condicion || "",
    estado: item.estado || derivedReceiptState.estado,
    cerrado:
      item.cerrado !== undefined ? Boolean(item.cerrado) : derivedReceiptState.cerrado,
    cierreIncompleto:
      item.cierre_incompleto !== undefined
        ? Boolean(item.cierre_incompleto)
        : derivedReceiptState.cierreIncompleto,
    observaciones: item.observaciones || "",
    recepcionParcialDefinitiva: Boolean(item.recepcion_parcial_definitiva),
    item: inventoryItem,
    itemId: inventoryItem?.id || "",
    itemNombre: inventoryItem?.nombre || "",
    donation,
    donationId: donation?.id || "",
    inventoryMovements,
    inventoryReceipts,
  };
}

export function normalizeDonation(item = {}) {
  if (!item) return null;

  const receivingUser = normalizeUserSummary(item.receiving_user);
  const donationItems = Array.isArray(item.donation_item)
    ? item.donation_item.map(normalizeDonationItem)
    : [];

  const donor = normalizeDonor(item.donor);

  return {
    id: item.donacion_id || "",
    motivoDonacion: item.motivo_donacion || "",
    puntoEncuentro: item.punto_encuentro || "",
    fechaRegistro: item.fecha_registro || "",
    fechaRecepcion: item.fecha_recepcion || "",
    estado: item.estado || "",
    estadoRecepcion: item.estado_recepcion || deriveHeaderReceiptState(donationItems),
    observaciones: item.observaciones || "",
    donor,
    donorId: donor?.id || "",
    region: item.region
      ? {
          id: item.region.id_region || "",
          nombre: item.region.nombre || "",
          clave: item.region.clave || "",
        }
      : null,
    receivingUser,
    donationItems,
    itemCount: donationItems.length,
  };
}

export function normalizeSupplier(item = {}) {
  if (!item) return null;

  const location = normalizeLocation(item.location);

  return {
    id: item.proveedor_id || "",
    nombre: item.nombre || "",
    telefono: item.telefono || "",
    email: item.email || "",
    observaciones: item.observaciones || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    location,
    locationId: location?.id || "",
  };
}

export function normalizePurchaseDetail(item = {}) {
  if (!item) return null;

  const inventoryItem = normalizeInventoryItem(item.item);
  const purchase = item.purchase
    ? {
        id: item.purchase.compra_id || "",
        estado: item.purchase.estado || "",
        fechaCompra: item.purchase.fecha_compra || "",
      }
    : null;

  const inventoryMovements = Array.isArray(item.inventory_movements)
    ? item.inventory_movements.map(normalizeInventoryMovement)
    : [];
  const inventoryReceipts = Array.isArray(item.inventory_receipts)
    ? item.inventory_receipts.map(normalizeInventoryReceipt)
    : [];
  const derivedReceiptState = deriveDetailReceiptState(item);

  return {
    id: item.detalle_compra_id || "",
    cantidad: toNumber(item.cantidad),
    cantidadRecepcionada: toNumber(item.cantidad_recepcionada),
    cantidadPendiente:
      item.cantidad_pendiente !== undefined
        ? toNumber(item.cantidad_pendiente)
        : derivedReceiptState.cantidadPendiente,
    precioUnitario: toNumber(item.precio_unitario),
    subtotal: toNumber(item.subtotal),
    fechaVencimiento: item.fecha_vencimiento || "",
    fechaApertura: item.fecha_apertura || "",
    condicionesAlmacenamiento: item.condiciones_almacenamiento || "",
    condicion: item.condicion || "",
    estado: item.estado || derivedReceiptState.estado,
    cerrado:
      item.cerrado !== undefined ? Boolean(item.cerrado) : derivedReceiptState.cerrado,
    cierreIncompleto:
      item.cierre_incompleto !== undefined
        ? Boolean(item.cierre_incompleto)
        : derivedReceiptState.cierreIncompleto,
    observaciones: item.observaciones || "",
    recepcionParcialDefinitiva: Boolean(item.recepcion_parcial_definitiva),
    item: inventoryItem,
    itemId: inventoryItem?.id || "",
    itemNombre: inventoryItem?.nombre || "",
    purchase,
    purchaseId: purchase?.id || "",
    inventoryMovements,
    inventoryReceipts,
  };
}

export function normalizePurchase(item = {}) {
  if (!item) return null;

  const supplier = normalizeSupplier(item.supplier);
  const registeredBy = normalizeUserSummary(item.registered_by);
  const purchaseDetails = Array.isArray(item.purchase_details)
    ? item.purchase_details.map(normalizePurchaseDetail)
    : [];

  return {
    id: item.compra_id || "",
    fechaCompra: item.fecha_compra || "",
    fechaRecepcion: item.fecha_recepcion || "",
    estado: item.estado || "",
    estadoRecepcion: item.estado_recepcion || deriveHeaderReceiptState(purchaseDetails),
    montoTotal: toNumber(item.monto_total),
    moneda: item.moneda || "CLP",
    estadoPago: item.estado_pago || "PENDIENTE",
    fechaVencimientoPago: item.fecha_vencimiento_pago || "",
    observacionFinanciera: item.observacion_financiera || "",
    descripcion: item.descripcion || "",
    observaciones: item.observaciones || "",
    supplier,
    supplierId: supplier?.id || "",
    transactionId: item.transaction_id || "",
    payableAccount: item.payable_account
      ? {
          id: item.payable_account.cuenta_por_pagar_id || "",
          estado: item.payable_account.estado || "",
          saldoPendiente: toNumber(item.payable_account.saldo_pendiente),
          montoPagado: toNumber(item.payable_account.monto_pagado),
          pagoId: item.payable_account.pago_cuenta_por_pagar_id || "",
          transaccionId: item.payable_account.transaccion_id || "",
          mensaje: item.payable_account.mensaje || "",
        }
      : null,
    estadoFinanciero: item.payable_account?.estado
      ? item.payable_account.estado
      : "SIN_CUENTA",
    operacion: item.operacion || "",
    registeredBy,
    purchaseDetails,
    detailCount: purchaseDetails.length,
  };
}

export function normalizeStockCount(item = {}) {
  if (!item) return null;

  const location = normalizeLocation(item.location);
  const performedBy = normalizeUserSummary(item.performed_by);
  const details = Array.isArray(item.detalles)
    ? item.detalles.map((detail) => {
        const inventoryItem = normalizeInventoryItem(detail.item);
        const existence = normalizeInventoryExistence(detail.existence);

        return {
          id: detail.conteo_detalle_id || "",
          cantidadContada: toNumber(detail.cantidad_contada),
          observaciones: detail.observaciones || "",
          item: inventoryItem,
          itemId: inventoryItem?.id || "",
          existence,
          existenciaId: existence?.id || "",
        };
      })
    : [];

  return {
    id: item.conteo_fisico_id || "",
    fechaConteo: item.fecha_conteo || "",
    observaciones: item.observaciones || "",
    location,
    locationId: location?.id || "",
    performedBy,
    detalles: details,
  };
}

export function normalizeInventoryAdjustment(item = {}) {
  if (!item) return null;

  const location = normalizeLocation(item.location);
  const performedBy = normalizeUserSummary(item.performed_by);
  const details = Array.isArray(item.details)
    ? item.details.map((detail) => {
        const inventoryItem = normalizeInventoryItem(detail.item);
        const existence = normalizeInventoryExistence(detail.existence);

        return {
          id: detail.ajuste_detalle_id || "",
          cantidadAntes: toNumber(detail.cantidad_antes),
          cantidadContada: toNumber(detail.cantidad_contada),
          diferencia: toNumber(detail.diferencia),
          tipoAjuste: detail.tipo_ajuste || "",
          item: inventoryItem,
          itemId: inventoryItem?.id || "",
          existence,
          existenciaId: existence?.id || "",
        };
      })
    : [];

  return {
    id: item.ajuste_inventario_id || "",
    fechaAjuste: item.fecha_ajuste || "",
    motivo: item.motivo || "",
    estado: item.estado || "",
    observaciones: item.observaciones || "",
    location,
    locationId: location?.id || "",
    performedBy,
    stockCountId: item.stock_count_id || "",
    details,
  };
}

export function normalizeItemCategory(item = {}) {
  if (!item) return null;

  return {
    id: item.categoria_item_id || "",
    nombre: item.nombre_categoria || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
  };
}

export function normalizeUnitOfMeasure(item = {}) {
  if (!item) return null;

  return {
    id: item.unidad_medida_id || "",
    nombre: item.nombre || "",
    descripcion: item.descripcion || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
  };
}

export async function getList(path, params, normalizer, fallbackMessage) {
  try {
    const response = await api.get(path, { params });
    return extractItems(response).map((item) => normalizer(item));
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }
    throw buildError(error, fallbackMessage);
  }
}

export async function getDetail(path, params, normalizer, fallbackMessage) {
  try {
    const response = await api.get(path, { params });
    return normalizer(extractData(response) || {});
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

export async function createResource(path, payload, normalizer, fallbackMessage) {
  try {
    const response = await api.post(path, payload);
    return normalizer(extractData(response) || {});
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

export async function createRawResource(path, payload, fallbackMessage) {
  try {
    const response = await api.post(path, payload);
    return extractData(response);
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

export async function updateResource(path, params, payload, normalizer, fallbackMessage) {
  try {
    const response = await api.patch(path, payload, { params });
    return normalizer(extractData(response) || {});
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

export async function deleteResource(path, params, normalizer, fallbackMessage) {
  try {
    const response = await api.delete(path, { params });
    const data = extractData(response);
    return normalizer ? normalizer(data || {}) : data || null;
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}
