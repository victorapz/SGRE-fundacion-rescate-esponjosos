export function buildUserMenuIdentity(user = {}) {
  const fullName = [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim();
  const displayName = fullName || user?.nombre || user?.email || "Usuario autenticado";
  const roleLabel = user?.rol || "Sin rol";
  const initial = displayName.charAt(0).toUpperCase() || "U";

  return {
    displayName,
    roleLabel,
    initial,
  };
}
