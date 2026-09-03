function normalizeNullableString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildProfileFormFromUser(user = {}) {
  return {
    nombre: user.nombre || "",
    apellido: user.apellido || "",
    email: user.email || "",
    telefono: user.telefono || "",
    current_password: "",
  };
}

export function buildProfileUpdatePayload(form, currentUser = {}) {
  const payload = {
    nombre: normalizeNullableString(form.nombre),
    apellido: normalizeNullableString(form.apellido),
    email: normalizeNullableString(form.email).toLowerCase(),
    telefono: normalizeNullableString(form.telefono),
  };

  const currentEmail = normalizeNullableString(currentUser.email).toLowerCase();
  if (payload.email && payload.email !== currentEmail) {
    payload.current_password = normalizeNullableString(form.current_password);
  }

  return payload;
}

export function buildMyPasswordPayload(form = {}) {
  return {
    current_password: normalizeNullableString(form.current_password),
    new_password: normalizeNullableString(form.new_password),
    confirm_password: normalizeNullableString(form.confirm_password),
  };
}

export function profileFormsEqual(left = {}, right = {}) {
  return (
    normalizeNullableString(left.nombre) === normalizeNullableString(right.nombre)
    && normalizeNullableString(left.apellido) === normalizeNullableString(right.apellido)
    && normalizeNullableString(left.email).toLowerCase()
      === normalizeNullableString(right.email).toLowerCase()
    && normalizeNullableString(left.telefono) === normalizeNullableString(right.telefono)
  );
}
