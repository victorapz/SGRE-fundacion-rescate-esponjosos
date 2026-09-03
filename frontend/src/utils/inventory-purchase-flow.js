export function parseEntityIdOrThrow(id, label = "registro") {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error(`No fue posible determinar el ${label} que intentas editar.`);
  }

  return parsedId;
}

export function calculatePurchaseSubtotal(quantity, unitPrice) {
  const normalizedQuantity = Number(quantity);
  const normalizedUnitPrice = Number(unitPrice);

  if (!Number.isFinite(normalizedQuantity) || !Number.isFinite(normalizedUnitPrice)) {
    return NaN;
  }

  return Number((normalizedQuantity * normalizedUnitPrice).toFixed(2));
}

export function calculatePurchaseTotal(details = []) {
  return Number(
    details.reduce((total, detail) => {
      const subtotal = Number(detail?.subtotal);
      return total + (Number.isFinite(subtotal) ? subtotal : 0);
    }, 0).toFixed(2),
  );
}
