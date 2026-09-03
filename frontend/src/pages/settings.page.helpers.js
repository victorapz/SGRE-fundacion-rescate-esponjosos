export function emptyVeterinarianForm() {
  return {
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    clinicIds: [],
    activo: true,
  };
}

export function buildVeterinarianPayload(form) {
  const clinicIds = Array.from(
    new Set(
      (Array.isArray(form?.clinicIds) ? form.clinicIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  return {
    nombre: String(form?.nombre || "").trim(),
    apellido: String(form?.apellido || "").trim(),
    email: String(form?.email || "").trim(),
    telefono: String(form?.telefono || "").trim(),
    clinic_ids: clinicIds,
    clinic_id: clinicIds[0] || null,
    activo: Boolean(form?.activo),
  };
}

export function formatVeterinarianClinics(item) {
  if (!Array.isArray(item?.clinics) || item.clinics.length === 0) {
    return "Sin clínica";
  }

  return item.clinics
    .map((clinic) => clinic?.nombre)
    .filter(Boolean)
    .join(", ");
}

function dedupeById(items = []) {
  const uniqueItems = new Map();

  items.forEach((item) => {
    if (!item?.id) return;
    uniqueItems.set(String(item.id), item);
  });

  return Array.from(uniqueItems.values());
}

export function buildVeterinarianClinicOptions(clinics = [], selectedClinicIds = []) {
  const selectedIds = new Set((selectedClinicIds || []).map((id) => String(id)));
  const activeClinics = clinics.filter((item) => item?.activo);
  const selectedInactiveClinics = clinics.filter(
    (item) => selectedIds.has(String(item?.id)) && item?.activo === false,
  );

  return dedupeById([...activeClinics, ...selectedInactiveClinics])
    .sort((left, right) => String(left?.nombre || "").localeCompare(String(right?.nombre || ""), "es"));
}

export function buildClinicVeterinarianOptions(veterinarians = [], selectedVeterinarianIds = []) {
  const selectedIds = new Set((selectedVeterinarianIds || []).map((id) => String(id)));
  const activeVeterinarians = veterinarians.filter((item) => item?.activo);
  const selectedInactiveVeterinarians = veterinarians.filter(
    (item) => selectedIds.has(String(item?.id)) && item?.activo === false,
  );

  return dedupeById([...activeVeterinarians, ...selectedInactiveVeterinarians])
    .sort((left, right) =>
      String(left?.nombreCompleto || left?.nombre || "").localeCompare(
        String(right?.nombreCompleto || right?.nombre || ""),
        "es",
      ));
}
