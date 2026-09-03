import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";

export default function RoleRoute({
  children,
  permissions = [],
  roles = [],
  permissionPrefixes = [],
  fallbackPath = "/inicio",
  requireAllRoles = false,
  requireAllPermissions = false,
}) {
  const location = useLocation();
  const {
    hasAnyRole,
    hasAllRoles,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyPermissionPrefix,
  } = usePermissions();

  const roleAllowed = roles.length === 0
    || (requireAllRoles ? hasAllRoles(roles) : hasAnyRole(roles));
  const permissionAllowed = permissions.length === 0
    || (requireAllPermissions ? hasAllPermissions(permissions) : hasAnyPermission(permissions));
  const prefixAllowed = permissionPrefixes.length === 0 || hasAnyPermissionPrefix(permissionPrefixes);

  if (!roleAllowed || !permissionAllowed || !prefixAllowed) {
    if (location.pathname === fallbackPath) {
      return null;
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}
