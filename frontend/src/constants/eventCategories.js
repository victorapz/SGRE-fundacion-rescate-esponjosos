export const EVENT_CATEGORY = {
  RECAUDACION_FONDOS: "RECAUDACION_FONDOS",
  EDUCATIVO: "EDUCATIVO",
  COMUNITARIO: "COMUNITARIO",
  INSTITUCIONAL: "INSTITUCIONAL",
  CULTURAL: "CULTURAL",
};

export const EVENT_CATEGORY_OPTIONS = [
  { value: EVENT_CATEGORY.RECAUDACION_FONDOS, label: "Recaudacion de fondos" },
  { value: EVENT_CATEGORY.EDUCATIVO, label: "Educativo" },
  { value: EVENT_CATEGORY.COMUNITARIO, label: "Comunitario" },
  { value: EVENT_CATEGORY.INSTITUCIONAL, label: "Institucional" },
  { value: EVENT_CATEGORY.CULTURAL, label: "Cultural" },
];

const EVENT_CATEGORY_LABELS = Object.fromEntries(
  EVENT_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

const EVENT_CATEGORY_CLASSES = {
  [EVENT_CATEGORY.RECAUDACION_FONDOS]: "event-category-fundraising",
  [EVENT_CATEGORY.EDUCATIVO]: "event-category-educational",
  [EVENT_CATEGORY.COMUNITARIO]: "event-category-community",
  [EVENT_CATEGORY.INSTITUCIONAL]: "event-category-institutional",
  [EVENT_CATEGORY.CULTURAL]: "event-category-cultural",
};

export function normalizeEventCategory(value) {
  if (value && EVENT_CATEGORY_LABELS[value]) {
    return value;
  }

  return EVENT_CATEGORY.COMUNITARIO;
}

export function formatEventCategory(value) {
  const normalizedValue = normalizeEventCategory(value);
  return EVENT_CATEGORY_LABELS[normalizedValue] || "Sin categoria";
}

export function getEventCategoryClass(value) {
  const normalizedValue = normalizeEventCategory(value);
  return EVENT_CATEGORY_CLASSES[normalizedValue] || EVENT_CATEGORY_CLASSES[EVENT_CATEGORY.COMUNITARIO];
}
