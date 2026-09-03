export const FOSTER_SPECIES_OPTIONS = [
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

export const FOSTER_ALLOWED_STATUS_OPTIONS = [
  "SANO",
  "EN_TRATAMIENTO",
  "CRITICO",
  "CUALQUIERA",
];

export const FOSTER_ASSIGNMENT_CLOSE_STATUS_OPTIONS = [
  "FINALIZADO",
  "TRASLADADO",
];

export function formatEnumLabel(value) {
  if (!value) return "Sin definir";

  return value
    .toString()
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getUserFullName(user) {
  if (!user) return "Sin responsable";

  const name = `${user.nombre || ""} ${user.apellido || ""}`.trim();
  return name || user.email || `Usuario ${user.id || ""}`.trim();
}

export function buildAllowedAnimalKey(rule = {}) {
  const species = rule.especie || "";
  const allowedStatus = rule.estadoPermitido || rule.estado_permitido || "";
  return `${species}::${allowedStatus}`;
}

export function getSpeciesSummary(rules = []) {
  const activeSpecies = Array.from(
    new Set(
      rules
        .filter((rule) => rule?.activo !== false)
        .map((rule) => rule?.especie)
        .filter(Boolean),
    ),
  );

  if (activeSpecies.length === 0) {
    return "Sin reglas activas";
  }

  return activeSpecies.map(formatEnumLabel).join(", ");
}

export function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}
