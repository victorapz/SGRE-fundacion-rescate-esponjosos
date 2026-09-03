export function bulkReceiptPendingQuantity(line = {}) {
  const expected = Number(line.cantidad || 0);
  const received = Number(line.cantidadRecepcionada || 0);
  const explicitPending = Number(line.cantidadPendiente);

  if (Number.isFinite(explicitPending)) {
    return Number(Math.max(explicitPending, 0).toFixed(2));
  }

  return Number(Math.max(expected - received, 0).toFixed(2));
}

export function generateBulkReceiptIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isBulkReceiptClosed(line = {}) {
  return Boolean(line.cerrado)
    || ["COMPLETO", "CERRADO_INCOMPLETO", "CANCELADO"].includes(line.estado);
}

export function isBulkReceiptPartial(line = {}) {
  return line.estado === "PARCIAL" || Number(line.cantidadRecepcionada || 0) > 0;
}

export function isBulkReceiptPristinePending(line = {}) {
  const hasReceipts = Array.isArray(line.inventoryReceipts)
    && line.inventoryReceipts.length > 0;

  return !isBulkReceiptClosed(line)
    && bulkReceiptPendingQuantity(line) > 0
    && !isBulkReceiptPartial(line)
    && !hasReceipts;
}

export function isBulkReceiptSelectable(line = {}, includePartial = false) {
  if (isBulkReceiptClosed(line) || bulkReceiptPendingQuantity(line) <= 0) {
    return false;
  }

  if (isBulkReceiptPartial(line)) {
    return includePartial;
  }

  return true;
}

export function defaultBulkReceiptSelection(lines = [], includePartial = false) {
  return (Array.isArray(lines) ? lines : [])
    .filter((line) => (
      includePartial
        ? isBulkReceiptSelectable(line, true)
        : isBulkReceiptPristinePending(line)
    ))
    .map((line) => String(line.id));
}

export function reconcileBulkReceiptSelection(
  lines = [],
  currentSelection = [],
  includePartial = false,
) {
  const selected = new Set((currentSelection || []).map(String));

  for (const line of Array.isArray(lines) ? lines : []) {
    const id = String(line.id);
    if (!isBulkReceiptSelectable(line, includePartial)) {
      selected.delete(id);
      continue;
    }

    if (includePartial && isBulkReceiptPartial(line)) {
      selected.add(id);
    }
  }

  return [...selected];
}
