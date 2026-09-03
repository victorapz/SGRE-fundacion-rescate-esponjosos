export function normalizeDonorPhone(value) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized || "";
}

export function normalizeInstagramUsername(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "");
}

export function normalizeDonorEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function formatInstagramUsername(value) {
  const normalized = normalizeInstagramUsername(value);
  return normalized ? `@${normalized}` : "";
}

export function buildDonorSearchText(donor = {}) {
  return [
    donor.nombre,
    donor.apellido,
    donor.nombreCompleto,
    donor.email,
    donor.telefono,
    normalizeDonorPhone(donor.telefono),
    donor.usuarioInstagram,
    normalizeInstagramUsername(donor.usuarioInstagram),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function findMatchingDonor(donors = [], values = {}, { excludeId = null } = {}) {
  const phone = normalizeDonorPhone(values.telefono);
  const instagram = normalizeInstagramUsername(
    values.usuarioInstagram ?? values.usuario_instagram,
  );
  const email = normalizeDonorEmail(values.email);

  if (!phone && !instagram && !email) return null;

  for (const donor of donors) {
    if (!donor || (excludeId && String(donor.id) === String(excludeId))) continue;

    if (phone && normalizeDonorPhone(donor.telefono) === phone) {
      return { donor, matchedBy: "telefono" };
    }

    if (
      instagram
      && normalizeInstagramUsername(donor.usuarioInstagram ?? donor.usuario_instagram) === instagram
    ) {
      return { donor, matchedBy: "instagram" };
    }

    if (email && normalizeDonorEmail(donor.email) === email) {
      return { donor, matchedBy: "email" };
    }
  }

  return null;
}

export function validateInlineDonor(values = {}) {
  const errors = {};

  if (!String(values.nombre ?? "").trim()) {
    errors.nombre = "El nombre es obligatorio.";
  }
  if (!String(values.apellido ?? "").trim()) {
    errors.apellido = "El apellido es obligatorio.";
  }
  if (!normalizeDonorPhone(values.telefono)) {
    errors.telefono = "El teléfono es obligatorio.";
  }
  if (!normalizeInstagramUsername(values.usuarioInstagram)) {
    errors.usuarioInstagram = "El usuario de Instagram es obligatorio.";
  }

  const email = normalizeDonorEmail(values.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "El correo electrónico no es válido.";
  }

  return errors;
}
