"use strict";

import Permission from "../entities/RolesConcept/permission.entity.js";
import { AppDataSource } from "../config/configDb.js";

function groupPermissions(permissions) {
  const groups = new Map();

  permissions.forEach((permission) => {
    const name = permission.nombre || "";
    const [groupKey] = name.split(":");
    const key = groupKey || "otros";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push({
      id_permiso: permission.id_permiso,
      nombre: permission.nombre,
    });
  });

  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    items: items.sort((a, b) => a.nombre.localeCompare(b.nombre)),
  }));
}

export async function getPermissionsService() {
  try {
    const permissionRepository = AppDataSource.getRepository(Permission);
    const permissions = await permissionRepository.find({
      order: { nombre: "ASC" },
    });

    if (!permissions || permissions.length === 0) {
      return [null, "No hay permisos"];
    }

    const items = permissions.map((permission) => ({
      id_permiso: permission.id_permiso,
      nombre: permission.nombre,
    }));

    const grouped = groupPermissions(permissions);

    return [{ items, grouped }, null];
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    return [null, "Error interno del servidor"];
  }
}
