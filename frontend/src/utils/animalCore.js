export const ANIMAL_HEALTH_OPTIONS = [
  { value: "SANO", label: "Sano" },
  { value: "EN_TRATAMIENTO", label: "En tratamiento" },
  { value: "CRITICO", label: "Critico" },
];

export const ANIMAL_ADOPTION_OPTIONS = [
  { value: "DISPONIBLE", label: "Disponible" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "ADOPTADO", label: "Adoptado" },
  { value: "NO_APTO", label: "No apto" },
];

export const ANIMAL_SEX_OPTIONS = [
  { value: "MACHO", label: "Macho" },
  { value: "HEMBRA", label: "Hembra" },
];

export const ANIMAL_BIRTH_DATE_TYPE_OPTIONS = [
  { value: "REAL", label: "Real" },
  { value: "ESTIMADA", label: "Estimada" },
  { value: "DESCONOCIDA", label: "Desconocida" },
];

export const ANIMAL_SPECIES_OPTIONS = [
  "PERRO",
  "GATO",
  "HURON",
  "HAMSTER SIRIO",
  "HAMSTER RUSO",
  "CONEJO",
  "TORTUGA",
  "CATITA AUSTRALIANA",
  "CATITA INGLESA",
  "NINFA",
  "RATA",
  "RATON",
  "CUY",
  "CHINCHILLA",
  "COBAYA",
  "ERIZO",
  "JERBO",
  "OTRA",
];

export function emptyAnimalForm() {
  return {
    nombre: "",
    especie: "",
    sexo: "",
    estado_salud_actual: "",
    estado_adopcion: "",
    region_id: "",
    fecha_llegada_fundacion: "",
    fecha_nacimiento: "",
    tipo_fecha_nacimiento: "DESCONOCIDA",
    fallecido: false,
    fecha_fallecimiento: "",
  };
}

export function buildAnimalPayload(form, mode) {
  const tipoFechaNacimiento = form.tipo_fecha_nacimiento || "DESCONOCIDA";

  return {
    nombre: String(form.nombre || "").trim(),
    especie: String(form.especie || "").trim(),
    sexo: String(form.sexo || "").trim(),
    estado_salud_actual: form.estado_salud_actual,
    estado_adopcion: form.estado_adopcion || null,
    region_id: Number(form.region_id),
    fecha_llegada_fundacion: form.fecha_llegada_fundacion || null,
    tipo_fecha_nacimiento: tipoFechaNacimiento,
    fecha_nacimiento:
      tipoFechaNacimiento === "DESCONOCIDA" ? null : form.fecha_nacimiento || null,
    fallecido: mode === "edit" ? Boolean(form.fallecido) : false,
    fecha_fallecimiento:
      mode === "edit" && form.fallecido ? form.fecha_fallecimiento || null : null,
  };
}

export function normalizeRegionCatalog(regions = []) {
  return [...regions]
    .map((region) => ({
      id: Number(region?.id),
      nombre: String(region?.nombre || "").trim(),
      clave: String(region?.clave || "").trim(),
    }))
    .filter((region) => Number.isInteger(region.id) && region.id > 0 && region.nombre)
    .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
}

export function getAnimalOptionLabel(options, value, emptyLabel = "") {
  const match = options.find((option) => option.value === value);
  return match?.label || emptyLabel;
}

export function canSubmitAnimalForm({
  mode = "create",
  form = {},
  regionsLoading = false,
  regionsError = "",
  regions = [],
} = {}) {
  if (regionsLoading || Boolean(regionsError)) {
    return false;
  }

  const selectedRegionId = Number(form.region_id);
  const hasValidRegion = regions.some((region) => Number(region.id) === selectedRegionId);

  if (!hasValidRegion) {
    return false;
  }

  if (!String(form.nombre || "").trim()) return false;
  if (!String(form.especie || "").trim()) return false;
  if (!String(form.sexo || "").trim()) return false;
  if (!String(form.estado_salud_actual || "").trim()) return false;

  if (mode === "edit" && form.fallecido && !form.fecha_fallecimiento) {
    return false;
  }

  return true;
}
