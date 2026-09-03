"use strict";

function normalizeForComparison(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mapAreaSummary(area) {
  if (!area) return null;

  return {
    id_area: Number(area.id_area),
    nombre: area.nombre || "",
    clave: area.clave || "",
  };
}

export function getUserAreas(user = {}) {
  const uniqueAreas = new Map();

  if (Array.isArray(user.areas)) {
    user.areas.forEach((area) => {
      const summary = mapAreaSummary(area);
      if (summary?.id_area) {
        uniqueAreas.set(summary.id_area, summary);
      }
    });
  }

  if (Array.isArray(user.UserArea)) {
    user.UserArea.forEach((entry) => {
      const summary = mapAreaSummary(entry?.area);
      if (summary?.id_area) {
        uniqueAreas.set(summary.id_area, summary);
      }
    });
  }

  const legacyArea = mapAreaSummary(user.area);
  if (legacyArea?.id_area && uniqueAreas.size === 0) {
    uniqueAreas.set(legacyArea.id_area, legacyArea);
  }

  return Array.from(uniqueAreas.values()).sort((left, right) =>
    String(left.nombre || "").localeCompare(String(right.nombre || ""), "es"),
  );
}

function getRoleNames(user = {}) {
  if (Array.isArray(user.roleNames)) {
    return user.roleNames.filter(Boolean);
  }

  if (!Array.isArray(user.UserRole)) {
    return [];
  }

  return user.UserRole
    .map((entry) => entry?.role?.nombre)
    .filter(Boolean);
}

function getPermissionNames(user = {}, permissionNamesOverride = []) {
  if (Array.isArray(permissionNamesOverride) && permissionNamesOverride.length > 0) {
    return permissionNamesOverride
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.nombre || item?.name || "";
      })
      .filter(Boolean);
  }

  if (Array.isArray(user.permissionNames)) {
    return user.permissionNames.filter(Boolean);
  }

  if (!Array.isArray(user.UserRole)) {
    return [];
  }

  return user.UserRole.flatMap((entry) =>
    Array.isArray(entry?.role?.RolePermission)
      ? entry.role.RolePermission
        .map((rolePermission) => rolePermission?.permission?.nombre)
        .filter(Boolean)
      : [],
  );
}

export function hasAnyTaskScope(profile = {}) {
  return Boolean(profile.permissionNames?.some((permissionName) =>
    String(permissionName || "").startsWith("home:task:"),
  ));
}

export function hasAreaTaskScope(profile = {}) {
  return Boolean(profile.permissionNames?.some((permissionName) =>
    /home:task:.*:area$/.test(String(permissionName || "")),
  ));
}

export function hasMineTaskScope(profile = {}) {
  return Boolean(profile.permissionNames?.some((permissionName) =>
    /home:task:.*:mine$/.test(String(permissionName || "")),
  ));
}

export function isAdministrativeRole(profile = {}) {
  const normalizedRoleNames = new Set((profile.roleNames || []).map(normalizeForComparison));
  return normalizedRoleNames.has("administrador") || normalizedRoleNames.has("directiva");
}

export function isGlobalTaskUser(profile = {}) {
  return Boolean(profile.permissionNames?.some((permissionName) =>
    /home:task:.*:any$/.test(String(permissionName || "")),
  )) || isAdministrativeRole(profile);
}

export function isAreaTaskManager(profile = {}) {
  if (isGlobalTaskUser(profile)) {
    return false;
  }

  const permissionSet = new Set(profile.permissionNames || []);
  return permissionSet.has("home:task:create:area")
    || permissionSet.has("home:task:update:area")
    || permissionSet.has("home:task:assign:area");
}

export function isContentArea(area = {}) {
  return normalizeForComparison(area?.clave) === "con"
    || normalizeForComparison(area?.nombre) === "contenido";
}

export function isContentAreaManager(profile = {}) {
  return isAreaTaskManager(profile)
    && (profile.areas || []).some((area) => isContentArea(area));
}

export function isBasicAssignee(profile = {}) {
  return hasAnyTaskScope(profile)
    && !isGlobalTaskUser(profile)
    && !isAreaTaskManager(profile);
}

export function getTaskPermissionProfileForUser(user = {}, permissionNamesOverride = []) {
  const areas = getUserAreas(user);
  const roleNames = getRoleNames(user);
  const permissionNames = getPermissionNames(user, permissionNamesOverride);
  const profile = {
    userId: Number(user.id_usuario ?? user.id ?? 0) || null,
    areas,
    areaIds: areas.map((area) => Number(area.id_area)),
    roleNames,
    permissionNames,
  };

  if (isGlobalTaskUser(profile)) {
    return {
      ...profile,
      taskProfile: "global",
      assignmentScopeLabel: "Alcance global",
    };
  }

  if (isContentAreaManager(profile)) {
    return {
      ...profile,
      taskProfile: "content_manager",
      assignmentScopeLabel: "Encargado de Contenido",
    };
  }

  if (isAreaTaskManager(profile)) {
    return {
      ...profile,
      taskProfile: "area_manager",
      assignmentScopeLabel: "Misma area",
    };
  }

  if (isBasicAssignee(profile)) {
    return {
      ...profile,
      taskProfile: "assignee",
      assignmentScopeLabel: "Misma area",
    };
  }

  return {
    ...profile,
    taskProfile: "none",
    assignmentScopeLabel: "Sin alcance",
  };
}

function hasSharedArea(actorProfile = {}, targetProfile = {}) {
  const actorAreaIds = new Set((actorProfile.areaIds || []).map((id) => Number(id)));
  return (targetProfile.areaIds || []).some((id) => actorAreaIds.has(Number(id)));
}

export function canAreaScopedActorAssignTarget(actorProfile = {}, targetProfile = {}, targetUser = {}) {
  if (!targetUser || targetUser.activo === false) {
    return { allowed: false, reason: "missing_or_inactive" };
  }

  if (isGlobalTaskUser(targetProfile) || isAdministrativeRole(targetProfile)) {
    return { allowed: false, reason: "higher_hierarchy" };
  }

  if (isAreaTaskManager(targetProfile) && !isContentAreaManager(targetProfile)) {
    return { allowed: false, reason: "higher_hierarchy" };
  }

  if (isContentAreaManager(targetProfile)) {
    return { allowed: true, reason: "content_manager" };
  }

  if (isBasicAssignee(targetProfile) && hasSharedArea(actorProfile, targetProfile)) {
    return { allowed: true, reason: "shared_area" };
  }

  return { allowed: false, reason: "outside_scope" };
}
