const PASSWORD_FIELD = "contrase\u00f1a";

function normalizeIdList(values = []) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function createUserFormFromDetail(user = {}) {
  const rolesDetailed = Array.isArray(user.rolesDetailed) ? user.rolesDetailed : [];
  const areas = Array.isArray(user.areas) ? user.areas : [];

  return {
    nombre: user.nombre || "",
    apellido: user.apellido || "",
    rut: user.rut || "",
    email: user.email || "",
    telefono: user.telefono || "",
    area_ids: areas.map((area) => String(area.id)).filter(Boolean),
    role_ids: rolesDetailed.map((role) => String(role.id)).filter(Boolean),
    [PASSWORD_FIELD]: "",
    activo: Boolean(user.activo),
    location: {
      direccion: user.direccion || "",
      region_id: user.regionId ? String(user.regionId) : "",
      comuna_id: user.comunaId ? String(user.comunaId) : "",
      observaciones: user.location?.observaciones || "",
    },
  };
}

export function buildUserPayload(
  form,
  {
    includePassword = false,
    includeRoleIds = true,
    includeAreaIds = true,
  } = {},
) {
  const payload = {
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    rut: form.rut.trim(),
    email: form.email.trim(),
    telefono: form.telefono.trim(),
    activo: Boolean(form.activo),
    location: {
      direccion: form.location.direccion.trim(),
      region_id: Number(form.location.region_id),
      comuna_id: Number(form.location.comuna_id),
      observaciones: form.location.observaciones.trim(),
    },
  };

  if (includeAreaIds) {
    payload.area_ids = normalizeIdList(form.area_ids);
  }

  if (includeRoleIds) {
    payload.role_ids = normalizeIdList(form.role_ids);
  }

  if (includePassword) {
    payload[PASSWORD_FIELD] = form[PASSWORD_FIELD];
  }

  return payload;
}

export function buildUserPasswordResetPayload(form = {}) {
  return {
    new_password: String(form.new_password || "").trim(),
    confirm_password: String(form.confirm_password || "").trim(),
  };
}

export { PASSWORD_FIELD };
