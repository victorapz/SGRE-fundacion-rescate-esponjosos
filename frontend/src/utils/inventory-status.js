const STATUS_META = {
  ACTIVA: { label: "Activa", tone: "success" },
  ACTIVO: { label: "Activo", tone: "success" },
  INACTIVO: { label: "Inactivo", tone: "neutral" },
  BORRADOR: { label: "Borrador", tone: "neutral" },
  CONFIRMADA: { label: "Confirmada", tone: "success" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
  CANCELADO: { label: "Cancelado", tone: "danger" },
  PENDIENTE: { label: "Pendiente", tone: "warning" },
  PARCIAL: { label: "Parcial", tone: "warning" },
  COMPLETA: { label: "Completa", tone: "success" },
  COMPLETO: { label: "Completo", tone: "success" },
  CERRADO_INCOMPLETO: { label: "Cerrado incompleto", tone: "warning" },
  RECEPCIONADO: { label: "Recepcionada", tone: "success" },
  RECEPCIONADA: { label: "Recepcionada", tone: "success" },
  PAGADA_PARCIAL: { label: "Pagada parcialmente", tone: "warning" },
  PARCIALMENTE_PAGADA: { label: "Pagada parcialmente", tone: "warning" },
  PAGADA: { label: "Pagada", tone: "success" },
  VENCIDA: { label: "Vencida", tone: "danger" },
  ANULADA: { label: "Anulada", tone: "neutral" },
  CONDONADA: { label: "Condonada", tone: "neutral" },
  SIN_CUENTA: { label: "Sin cuenta", tone: "neutral" },
  APLICADO: { label: "Aplicado", tone: "success" },
};

function humanizeStatus(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Sin estado";

  const sentence = normalized
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function getInventoryStatusMeta(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return STATUS_META[normalized] || {
    label: humanizeStatus(normalized),
    tone: "neutral",
  };
}

export function inventoryStatusLabel(value) {
  return getInventoryStatusMeta(value).label;
}

export function getDonationGeneralStatus(donation = {}) {
  return donation.estado === "CANCELADO" || donation.estado === "CANCELADA"
    ? "CANCELADA"
    : "ACTIVA";
}
