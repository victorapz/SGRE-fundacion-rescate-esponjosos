"use strict";

import { AppDataSource } from "../config/configDb.js";
import User from "../entities/user.entity.js";
import Role from "../entities/RolesConcept/role.entity.js";
import Permission from "../entities/RolesConcept/permission.entity.js";
import UserRole from "../entities/user_role.entity.js";
import RolePermission from "../entities/RolesConcept/role_permission.entity.js";

/**
 * Middleware RBAC factory: retorna un middleware que verifica permisos específicos
 * @param {...string} requiredPermissions - Nombres de los permisos requeridos
 * @returns {Function} Middleware que verifica los permisos
 * 
 * Ejemplo de uso:
 * router.delete("/detail/", checkRbac("users:delete"), deleteUser);
 * router.post("/crear", checkRbac("users:create", "users:update"), createUser);
 */
export function checkRbac(...requiredPermissions) {
  return async (req, res, next) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "No autorizado",
          error: "Usuario no autenticado",
        });
      }

      const userId = req.user.id_usuario;

      // Obtener los roles del usuario con sus permisos precargados
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id_usuario: userId },
        relations: {
          UserRole: {
            role: {
              RolePermission: {
                permission: true,
              },
            },
          },
        },
      });

      if (!user || !user.UserRole || user.UserRole.length === 0) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para realizar esta acción.",
        });
      }

      // Extraer todos los permisos del usuario (flatten de roles-permisos)
      const userPermissions = new Set();
      user.UserRole.forEach((userRole) => {
        userRole.role.RolePermission.forEach((rolePermission) => {
          userPermissions.add(rolePermission.permission.nombre);
        });
      });

      req.permissions = Array.from(userPermissions);

      // Verificar que el usuario tenga al menos uno de los permisos requeridos
      const hasPermission = requiredPermissions.some((permission) =>
        userPermissions.has(permission),
      );

      if (!hasPermission) {
        console.warn("RBAC denegado para usuario autenticado", {
          userId,
          requiredPermissions,
        });
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para realizar esta acción.",
        });
      }

      // Continuar al siguiente middleware
      next();
    } catch (error) {
      console.error("Error en middleware RBAC:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
        error: error.message,
      });
    }
  };
}
