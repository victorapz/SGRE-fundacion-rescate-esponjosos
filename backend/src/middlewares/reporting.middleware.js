"use strict";

export function requireResolvedPermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "No autorizado",
        error: "Usuario no autenticado",
      });
    }

    const resolvedPermissions = new Set(
      Array.isArray(req.permissions) ? req.permissions : [],
    );

    const missingPermissions = requiredPermissions.filter(
      (permission) => !resolvedPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      console.warn("Permisos resueltos insuficientes para reporte", {
        userId: req.user?.id_usuario || null,
        requiredPermissions,
        missingPermissions,
      });
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para realizar esta acción.",
      });
    }

    return next();
  };
}

export function requireAnyResolvedPermission(...acceptedPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "No autorizado",
        error: "Usuario no autenticado",
      });
    }

    const resolvedPermissions = new Set(
      Array.isArray(req.permissions) ? req.permissions : [],
    );

    const hasAnyPermission = acceptedPermissions.some((permission) =>
      resolvedPermissions.has(permission));

    if (!hasAnyPermission) {
      console.warn("Permisos resueltos insuficientes para reporte", {
        userId: req.user?.id_usuario || null,
        acceptedPermissions,
      });
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para realizar esta acción.",
      });
    }

    return next();
  };
}
