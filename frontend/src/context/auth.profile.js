export function normalizeAuthProfile(profile = {}, fallbackUser = null) {
  return {
    ...(fallbackUser || {}),
    id: profile.id ?? fallbackUser?.id ?? null,
    nombre: profile.nombre ?? fallbackUser?.nombre ?? "",
    apellido: profile.apellido ?? fallbackUser?.apellido ?? "",
    email: profile.email ?? fallbackUser?.email ?? "",
    telefono: profile.telefono ?? fallbackUser?.telefono ?? "",
    rol: profile.rol ?? fallbackUser?.rol ?? "",
    roles: Array.isArray(profile.roles) ? profile.roles : fallbackUser?.roles || [],
    permissions: Array.isArray(profile.permissions)
      ? profile.permissions
      : fallbackUser?.permissions || [],
  };
}

function normalizeArray(values = []) {
  return Array.isArray(values) ? values.map((value) => String(value)) : [];
}

export function areSameAuthUser(left = null, right = null) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftRoles = normalizeArray(left.roles);
  const rightRoles = normalizeArray(right.roles);
  const leftPermissions = normalizeArray(left.permissions);
  const rightPermissions = normalizeArray(right.permissions);

  return (
    left.id === right.id
    && (left.nombre || "") === (right.nombre || "")
    && (left.apellido || "") === (right.apellido || "")
    && (left.email || "") === (right.email || "")
    && (left.telefono || "") === (right.telefono || "")
    && (left.rol || "") === (right.rol || "")
    && leftRoles.length === rightRoles.length
    && leftRoles.every((value, index) => value === rightRoles[index])
    && leftPermissions.length === rightPermissions.length
    && leftPermissions.every((value, index) => value === rightPermissions[index])
  );
}
