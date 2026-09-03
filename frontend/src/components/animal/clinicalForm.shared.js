export function mergeHistoricalVeterinarianOption(veterinarians = [], currentVeterinarian = null) {
  const normalizedVeterinarians = Array.isArray(veterinarians) ? veterinarians : [];

  if (!currentVeterinarian?.id) {
    return normalizedVeterinarians;
  }

  const currentId = String(currentVeterinarian.id);
  const alreadyPresent = normalizedVeterinarians.some(
    (item) => String(item?.id || "") === currentId,
  );

  if (alreadyPresent) {
    return normalizedVeterinarians;
  }

  return [
    ...normalizedVeterinarians,
    {
      ...currentVeterinarian,
      activo: false,
      isHistorical: true,
      nombreCompleto:
        currentVeterinarian.nombreCompleto
        || [currentVeterinarian.nombre, currentVeterinarian.apellido].filter(Boolean).join(" ").trim()
        || "Veterinario histórico",
    },
  ];
}
