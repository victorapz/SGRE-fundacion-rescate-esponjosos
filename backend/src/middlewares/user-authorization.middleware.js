"use strict";

function hasResolvedPermission(req, permission) {
  return Array.isArray(req.permissions) && req.permissions.includes(permission);
}

function buildForbiddenResponse(res) {
  return res.status(403).json({
    success: false,
    message: "No tienes permisos para realizar esta acciÃ³n.",
  });
}

export function requireUserCreateAssignmentPermissions(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "No autorizado",
      error: "Usuario no autenticado",
    });
  }

  const requiredPermissions = [
    "users:user:create",
    "users:user_role:assign",
    "users:user_area:assign",
  ];

  const hasAllPermissions = requiredPermissions.every((permission) =>
    hasResolvedPermission(req, permission),
  );

  if (!hasAllPermissions) {
    return buildForbiddenResponse(res);
  }

  return next();
}

export function requireUserUpdateAssignmentPermissions(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "No autorizado",
      error: "Usuario no autenticado",
    });
  }

  const payload = req.body || {};

  if (
    Object.prototype.hasOwnProperty.call(payload, "role_ids")
    && !hasResolvedPermission(req, "users:user_role:assign")
  ) {
    return buildForbiddenResponse(res);
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "area_ids")
    && !hasResolvedPermission(req, "users:user_area:assign")
  ) {
    return buildForbiddenResponse(res);
  }

  return next();
}
