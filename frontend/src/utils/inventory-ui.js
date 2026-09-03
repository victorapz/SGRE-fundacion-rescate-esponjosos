export const INVENTORY_UPDATED_EVENT = "inventory:updated";

export function emitInventoryUpdated(detail = {}) {
  window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT, { detail }));
}

export function formatQuantity(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatCurrency(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(number);
}

export function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatLocationLine(location) {
  if (!location) return "Sin ubicacion";

  const line = [location.nombre, location.comuna?.nombre, location.direccion]
    .filter(Boolean)
    .join(" · ");

  return line || "Sin ubicacion";
}

export function formatPersonName(person) {
  if (!person) return "Sin usuario";
  return [person.nombre, person.apellido].filter(Boolean).join(" ").trim() || person.email || "Sin usuario";
}

export function stockStateLabel(value) {
  switch (value) {
    case "SIN_STOCK":
      return "Sin stock";
    case "BAJO_MINIMO":
      return "Bajo minimo";
    case "OK":
      return "OK";
    default:
      return value || "Sin estado";
  }
}

export function movementLabel(value) {
  switch (value) {
    case "ENTRADA":
      return "Entrada";
    case "SALIDA":
      return "Salida";
    case "CONSUMO":
      return "Consumo";
    case "TRASLADO":
      return "Traslado";
    case "AJUSTE":
      return "Ajuste";
    default:
      return value || "Sin tipo";
  }
}

export function adjustmentStateLabel(value) {
  switch (value) {
    case "PENDIENTE":
      return "Pendiente";
    case "APLICADO":
      return "Aplicado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return value || "Sin estado";
  }
}

export function yesNoLabel(value) {
  return value ? "Si" : "No";
}

export function parsePositiveDecimal(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const normalized = String(value || "").replace(",", ".").trim();
  if (!normalized) return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function buildLocationPayload(form) {
  if (!form.regionId || !form.comunaId || !String(form.direccion || "").trim()) {
    return null;
  }

  return {
    direccion: String(form.direccion || "").trim(),
    region_id: Number(form.regionId),
    comuna_id: Number(form.comunaId),
    observaciones: String(form.observaciones || "").trim() || null,
  };
}

function hasInventoryMovements(line) {
  return Array.isArray(line?.inventoryMovements) && line.inventoryMovements.length > 0;
}

function hasInventoryReceipts(line) {
  return Array.isArray(line?.inventoryReceipts) && line.inventoryReceipts.length > 0;
}

function hasReceivedQuantity(line) {
  return Number(line?.cantidadRecepcionada || 0) > 0;
}

function isClosedDetail(line) {
  return line?.estado === "COMPLETO" || line?.estado === "CERRADO_INCOMPLETO";
}

export function getSupplierActionState(supplier) {
  if (!supplier) {
    return {
      canEdit: false,
      canDeactivate: false,
      canReactivate: false,
      reason: "Proveedor no disponible.",
    };
  }

  return {
    canEdit: true,
    canDeactivate: Boolean(supplier.activo),
    canReactivate: !supplier.activo,
    reason: "",
  };
}

export function getDonorActionState(donor) {
  if (!donor) {
    return {
      canEdit: false,
      canDeactivate: false,
      canReactivate: false,
      reason: "Donante no disponible.",
    };
  }

  return {
    canEdit: true,
    canDeactivate: Boolean(donor.activo),
    canReactivate: !donor.activo,
    reason: "",
  };
}

export function getDonationActionState(donation) {
  if (!donation) {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canEditDetails: false,
      reason: "Donacion no disponible.",
    };
  }

  if (donation.estado === "CANCELADO") {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canEditDetails: false,
      reason: "La donacion ya fue cancelada.",
    };
  }

  const items = Array.isArray(donation.donationItems) ? donation.donationItems : [];
  const hasReceivedItems = items.some(
    (line) => hasReceivedQuantity(line) || hasInventoryReceipts(line) || hasInventoryMovements(line),
  );

  if (hasReceivedItems) {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canEditDetails: false,
      reason: "La donacion ya tiene recepciones o movimientos registrados.",
    };
  }

  if (items.length > 0) {
    return {
      canEdit: true,
      canDelete: false,
      canCancel: true,
      canEditDetails: true,
      reason: "Debes eliminar primero las lineas si quieres borrar la donacion.",
    };
  }

  return {
    canEdit: true,
    canDelete: true,
    canCancel: true,
    canEditDetails: true,
    reason: "",
  };
}

export function getDonationItemActionState(donation, line) {
  const parentState = getDonationActionState(donation);

  if (!line) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: false,
      reason: "Item no disponible.",
    };
  }

  if (!parentState.canEditDetails) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive:
        donation?.estado !== "CANCELADO"
        && line.estado !== "CANCELADO"
        && !isClosedDetail(line),
      canViewReceipts: hasInventoryReceipts(line),
      reason: parentState.reason,
    };
  }

  if (isClosedDetail(line)) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: false,
      canViewReceipts: hasInventoryReceipts(line),
      reason: "Este item ya fue cerrado y no admite nuevas recepciones.",
    };
  }

  if (hasInventoryReceipts(line) || hasInventoryMovements(line)) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: true,
      canViewReceipts: true,
      reason: "No se puede modificar este item porque ya genero movimientos de inventario.",
    };
  }

  if (line.estado === "CANCELADO") {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: false,
      canViewReceipts: hasInventoryReceipts(line),
      reason: "El item ya fue cancelado.",
    };
  }

  return {
    canEdit: true,
    canDelete: true,
    canReceive: true,
    canViewReceipts: hasInventoryReceipts(line),
    reason: "",
  };
}

export function getPurchaseActionState(purchase) {
  if (!purchase) {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canEditDetails: false,
      reason: "Compra no disponible.",
    };
  }

  if (purchase.estado === "CANCELADA") {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canEditDetails: false,
      reason: "La compra ya fue cancelada.",
    };
  }

  const details = Array.isArray(purchase.purchaseDetails) ? purchase.purchaseDetails : [];
  const hasReceivedDetails = details.some(
    (line) => hasReceivedQuantity(line) || hasInventoryReceipts(line) || hasInventoryMovements(line),
  );
  const hasFinancialMovements = Boolean(purchase.transactionId)
    || Number(purchase.payableAccount?.montoPagado || 0) > 0
    || Boolean(purchase.payableAccount?.transaccionId);

  if (purchase.estado === "BORRADOR") {
    if (details.length > 0) {
      return {
        canEdit: true,
        canDelete: false,
        canCancel: true,
        canEditDetails: true,
        canConfirm: true,
        canRevertToDraft: false,
        reason: "",
      };
    }

    return {
      canEdit: true,
      canDelete: true,
      canCancel: false,
      canEditDetails: true,
      canConfirm: false,
      canRevertToDraft: false,
      reason: "Agrega al menos una líneapara confirmar la compra.",
    };
  }

  if (hasReceivedDetails) {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canEditDetails: false,
      canConfirm: false,
      canRevertToDraft: false,
      reason: "La compra ya tiene recepciones o movimientos registrados.",
    };
  }

  if (hasFinancialMovements) {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canEditDetails: false,
      canConfirm: false,
      canRevertToDraft: false,
      reason: "La compra posee movimientos contables o pagos asociados.",
    };
  }

  if (purchase.estado === "CONFIRMADA") {
    return {
      canEdit: false,
      canDelete: false,
      canCancel: true,
      canEditDetails: false,
      canConfirm: false,
      canRevertToDraft: true,
      reason: "",
    };
  }

  return {
    canEdit: false,
    canDelete: false,
    canCancel: false,
    canEditDetails: false,
    canConfirm: false,
    canRevertToDraft: false,
    reason: "La compra no admite mas acciones en su estado actual.",
  };
}

export function getPurchaseDetailActionState(purchase, line) {
  const parentState = getPurchaseActionState(purchase);

  if (!line) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: false,
      reason: "Detalle no disponible.",
    };
  }

  if (!parentState.canEditDetails) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive:
        purchase?.estado === "CONFIRMADA"
        && line.estado !== "CANCELADO"
        && !isClosedDetail(line),
      canViewReceipts: hasInventoryReceipts(line),
      reason: parentState.reason,
    };
  }

  if (isClosedDetail(line)) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: false,
      canViewReceipts: hasInventoryReceipts(line),
      reason: "Este detalle ya fue cerrado y no admite nuevas recepciones.",
    };
  }

  if (hasInventoryReceipts(line) || hasInventoryMovements(line)) {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: purchase?.estado === "CONFIRMADA",
      canViewReceipts: true,
      reason: "No se puede modificar este detalle porque ya genero movimientos de inventario.",
    };
  }

  if (line.estado === "CANCELADO") {
    return {
      canEdit: false,
      canDelete: false,
      canReceive: false,
      canViewReceipts: hasInventoryReceipts(line),
      reason: "El detalle ya fue cancelado.",
    };
  }

  return {
    canEdit: true,
    canDelete: true,
    canReceive: purchase?.estado === "CONFIRMADA",
    canViewReceipts: hasInventoryReceipts(line),
    reason: "",
  };
}
