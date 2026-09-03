import { useMemo } from "react";
import { NAVIGATION_ITEMS } from "../config/navigation";
import { useAuth } from "./useAuth";

export function usePermissions() {
	const { user } = useAuth();
	const role = user?.rol;
	const roles = Array.isArray(user?.roles) ? user.roles : role ? [role] : [];
	const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
	const permissionSet = useMemo(() => new Set(permissions), [permissions]);
	const roleSet = useMemo(() => new Set(roles), [roles]);

	const visibleNavigationItems = useMemo(() => {
		if (!permissions.length) return [];

		return NAVIGATION_ITEMS
			.filter((item) => {
				if (!item.active) {
					return false;
				}

				if (!item.permissions && !item.permissionPrefixes) {
					return true;
				}

				const permissionAllowed = Array.isArray(item.permissions)
					? item.permissions.some((permission) => permissionSet.has(permission))
					: false;

				const prefixAllowed = Array.isArray(item.permissionPrefixes)
					? item.permissionPrefixes.some((prefix) =>
						permissions.some((permission) => permission.startsWith(prefix)),
					)
					: false;

				return permissionAllowed || prefixAllowed;
			})
			.sort((a, b) => a.order - b.order);
	}, [permissionSet, permissions]);

	const hasRole = (targetRole) => {
		if (!targetRole) return false;
		return roleSet.has(targetRole);
	};

	const hasAnyRole = (requiredRoles = []) => {
		if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
			return true;
		}

		return requiredRoles.some((requiredRole) => roleSet.has(requiredRole));
	};

	const hasAllRoles = (requiredRoles = []) => {
		if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
			return true;
		}

		return requiredRoles.every((requiredRole) => roleSet.has(requiredRole));
	};

	const hasPermission = (permission) => {
		if (!permission) return false;
		return permissionSet.has(permission);
	};

	const hasPermissionPrefix = (prefix) => {
		if (!prefix) return false;
		return permissions.some((permission) => permission.startsWith(prefix));
	};

	const hasAnyPermission = (requiredPermissions = []) => {
		if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
			return true;
		}

		return requiredPermissions.some((permission) => permissionSet.has(permission));
	};

	const hasAllPermissions = (requiredPermissions = []) => {
		if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
			return true;
		}

		return requiredPermissions.every((permission) => permissionSet.has(permission));
	};

	const hasAnyPermissionPrefix = (prefixes = []) => {
		if (!Array.isArray(prefixes) || prefixes.length === 0) {
			return true;
		}

		return prefixes.some((prefix) => permissions.some((permission) => permission.startsWith(prefix)));
	};

	return {
		role,
		roles,
		permissions,
		visibleNavigationItems,
		hasRole,
		hasAnyRole,
		hasAllRoles,
		hasPermission,
		hasPermissionPrefix,
		hasAnyPermission,
		hasAllPermissions,
		hasAnyPermissionPrefix,
	};
}

