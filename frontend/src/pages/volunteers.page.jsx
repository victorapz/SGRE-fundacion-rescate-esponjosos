import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import FilterSummaryBar from "../components/FilterSummaryBar";
import FileUploader from "../components/files/FileUploader";
import HomeTabs from "../components/home/HomeTabs";
import PaginationControls from "../components/PaginationControls";
import {
  getPermissionMetadata,
  PERMISSION_GROUP_ORDER,
  PERMISSION_MODULE_ORDER,
} from "../constants/permissionCatalog";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import { deleteFile, downloadFile, listFiles } from "../services/file.service";
import { getAreas } from "../services/area.service";
import { getComunas } from "../services/comuna.service";
import { getPermissions } from "../services/permission.service";
import { getRegions } from "../services/region.service";
import { createRole, deleteRole, getRoles, updateRole } from "../services/role.service";
import {
  createUser,
  deleteUser,
  getUser,
  getUsers,
  resetUserPassword,
  updateUser,
} from "../services/user.service";
import {
  buildUserPasswordResetPayload,
  buildUserPayload,
  createUserFormFromDetail,
  PASSWORD_FIELD,
} from "./volunteers.page.helpers.js";
import { useAuth } from "../hooks/useAuth";
import { PASSWORD_POLICY } from "../utils/passwordPolicy";
import "../styles/home.page.css";
import "../styles/files.css";
import "../styles/profile.page.css";

const MODULE_TABS = [
  { id: "volunteers", label: "Voluntarios" },
  { id: "roles", label: "Roles" },
];

const USER_CONTRACT_CONTEXTS = [
  {
    context: "USER_CONTRACT_VOLUNTEER",
    title: "Contrato de voluntario",
    emptyMessage: "No hay contrato de voluntario asociado.",
  },
  {
    context: "USER_CONTRACT_FOSTER_HOME",
    title: "Contrato de hogar temporal",
    emptyMessage: "No hay contrato de hogar temporal asociado.",
  },
  {
    context: "USER_CONTRACT_ADOPTION",
    title: "Contrato de adopción",
    emptyMessage: "No hay contrato de adopción asociado.",
  },
];

function emptyUserForm() {
  return {
    nombre: "",
    apellido: "",
    rut: "",
    email: "",
    telefono: "",
    area_ids: [],
    role_ids: [],
    [PASSWORD_FIELD]: "",
    activo: true,
    location: {
      direccion: "",
      region_id: "",
      comuna_id: "",
      observaciones: "",
    },
  };
}

function emptyRoleForm() {
  return {
    nombre: "",
    permisos: [],
  };
}

const permissionModuleOrderMap = new Map(
  PERMISSION_MODULE_ORDER.map((moduleName, index) => [moduleName, index]),
);
const permissionGroupOrderMap = new Map(
  PERMISSION_GROUP_ORDER.map((groupName, index) => [groupName, index]),
);

function hasCheckedId(collection, targetId) {
  return collection.some((item) => String(item) === String(targetId));
}

function getPermissionKey(permission) {
  return (
    permission?.nombre
    || permission?.name
    || permission?.key
    || permission?.permission
    || permission?.permiso
    || ""
  );
}

function getPermissionValue(permission) {
  const rawValue = permission?.id_permiso ?? permission?.id ?? permission?.value ?? null;
  return rawValue == null ? null : Number(rawValue);
}

function normalizePermissionForDisplay(permission) {
  const key = getPermissionKey(permission);
  const value = getPermissionValue(permission);
  const metadata = getPermissionMetadata(key);

  return {
    originalPermission: permission,
    key,
    value,
    metadata,
  };
}

function comparePermissions(left, right) {
  const leftModuleOrder = permissionModuleOrderMap.get(left.metadata.module) ?? 999;
  const rightModuleOrder = permissionModuleOrderMap.get(right.metadata.module) ?? 999;

  if (leftModuleOrder !== rightModuleOrder) {
    return leftModuleOrder - rightModuleOrder;
  }

  const leftGroupOrder = permissionGroupOrderMap.get(left.metadata.group) ?? 999;
  const rightGroupOrder = permissionGroupOrderMap.get(right.metadata.group) ?? 999;

  if (leftGroupOrder !== rightGroupOrder) {
    return leftGroupOrder - rightGroupOrder;
  }

  if (left.metadata.sortOrder !== right.metadata.sortOrder) {
    return left.metadata.sortOrder - right.metadata.sortOrder;
  }

  return left.metadata.label.localeCompare(right.metadata.label, "es");
}

function formatContractBytes(sizeBytes = 0) {
  const size = Number(sizeBytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatContractDate(value) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function mergeCurrentOption(options = [], id, nombre, fallbackLabel) {
  if (!id || options.some((item) => String(item.id) === String(id))) {
    return options;
  }

  return [
    {
      id,
      nombre: nombre || fallbackLabel,
    },
    ...options,
  ];
}

export default function VolunteersPage() {
  const { user: authenticatedUser } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const userDetailRequestRef = useRef(0);
  const canReadUsers = hasPermission(PERMISSIONS.USERS.READ);
  const canCreateUser = hasPermission(PERMISSIONS.USERS.CREATE);
  const canUpdateUser = hasPermission(PERMISSIONS.USERS.UPDATE);
  const canDeleteUser = hasPermission(PERMISSIONS.USERS.DELETE);
  const canResetUserPasswords = hasPermission(PERMISSIONS.USERS.PASSWORD_RESET);
  const canAssignUserRoles = hasPermission(PERMISSIONS.USERS.ROLE_ASSIGN);
  const canAssignUserAreas = hasPermission(PERMISSIONS.USERS.AREA_ASSIGN);
  const canCreateUserFull = canCreateUser && canAssignUserRoles && canAssignUserAreas;
  const canReadRoles = hasPermission(PERMISSIONS.ROLES.READ);
  const canCreateRole = hasPermission(PERMISSIONS.ROLES.CREATE);
  const canUpdateRole = hasPermission(PERMISSIONS.ROLES.UPDATE);
  const canDeleteRole = hasPermission(PERMISSIONS.ROLES.DELETE);
  const canManageRoles = canCreateRole || canUpdateRole;
  const canReadUserContracts = hasAnyPermission(["files:file:read", "files:user_document:read"]);
  const canUploadUserContracts = hasAnyPermission(["files:file:upload", "files:user_document:upload"]);
  const canDeleteUserContracts = hasAnyPermission(["files:file:delete", "files:user_document:delete"]);
  const visibleTabs = useMemo(() => {
    const items = [];

    if (canReadUsers || canCreateUserFull) {
      items.push({ id: "volunteers", label: "Voluntarios" });
    }

    if (canReadRoles) {
      items.push({ id: "roles", label: "Roles" });
    }

    return items;
  }, [canCreateUserFull, canReadRoles, canReadUsers]);

  const [activeTab, setActiveTab] = useState("volunteers");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [regions, setRegions] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [rolesError, setRolesError] = useState("");
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState("");
  const [availablePermissions, setAvailablePermissions] = useState([]);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState("create");
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm());
  const [userFormError, setUserFormError] = useState("");
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [editingUserSummary, setEditingUserSummary] = useState(null);
  const [userContractsByContext, setUserContractsByContext] = useState({});
  const [userContractsLoading, setUserContractsLoading] = useState({});
  const [userContractsError, setUserContractsError] = useState({});
  const [userPasswordResetForm, setUserPasswordResetForm] = useState({
    new_password: "",
    confirm_password: "",
  });
  const [userPasswordResetError, setUserPasswordResetError] = useState("");
  const [userPasswordResetSuccess, setUserPasswordResetSuccess] = useState("");
  const [isResettingUserPassword, setIsResettingUserPassword] = useState(false);
  const [showUserPasswordResetFields, setShowUserPasswordResetFields] = useState({
    new_password: false,
    confirm_password: false,
  });

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState("create");
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm());
  const [roleFormError, setRoleFormError] = useState("");
  const [rolePermissionSearch, setRolePermissionSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userActiveFilter, setUserActiveFilter] = useState("all");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userAreaFilter, setUserAreaFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [roleSearch, setRoleSearch] = useState("");
  const [roleAssignmentFilter, setRoleAssignmentFilter] = useState("all");
  const [rolePermissionFilter, setRolePermissionFilter] = useState("all");
  const [rolePage, setRolePage] = useState(1);
  const [rolePageSize, setRolePageSize] = useState(10);

  const loadUsers = useCallback(async () => {
    if (!canReadUsers) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }

    setUsersLoading(true);
    setUsersError("");

    try {
      setUsers(await getUsers());
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "No se pudieron cargar los usuarios");
    } finally {
      setUsersLoading(false);
    }
  }, [canReadUsers]);

  const loadRoles = useCallback(async () => {
    if (!canReadRoles && !canAssignUserRoles) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }

    setRolesLoading(true);
    setRolesError("");

    try {
      setRoles(await getRoles());
    } catch (error) {
      setRolesError(error instanceof Error ? error.message : "No se pudieron cargar los roles");
    } finally {
      setRolesLoading(false);
    }
  }, [canAssignUserRoles, canReadRoles]);

  const loadAreas = useCallback(async () => {
    if (!canCreateUserFull && !canAssignUserAreas) {
      setAreas([]);
      return;
    }

    try {
      setAreas(await getAreas());
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "No se pudieron cargar las areas");
    }
  }, [canAssignUserAreas, canCreateUserFull]);

  const loadPermissions = useCallback(async () => {
    if (!canManageRoles) {
      setAvailablePermissions([]);
      setPermissionsLoading(false);
      return;
    }

    setPermissionsLoading(true);
    setPermissionsError("");

    try {
      const permissionsData = await getPermissions();
      const items = Array.isArray(permissionsData.items) ? permissionsData.items : [];
      setAvailablePermissions(items);
    } catch (error) {
      setPermissionsError(
        error instanceof Error ? error.message : "No se pudieron cargar los permisos",
      );
    } finally {
      setPermissionsLoading(false);
    }
  }, [canManageRoles]);

  const loadRegions = useCallback(async () => {
    if (!canCreateUserFull && !canUpdateUser) {
      setRegions([]);
      return;
    }

    try {
      setRegions(await getRegions({ active: true }));
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "No se pudieron cargar las regiones");
    }
  }, [canCreateUserFull, canUpdateUser]);

  const resetUserContractsState = useCallback(() => {
    setUserContractsByContext({});
    setUserContractsLoading({});
    setUserContractsError({});
  }, []);

  const loadUserContractByContext = useCallback(async (userId, context) => {
    if (!userId || !context) {
      return;
    }

    setUserContractsLoading((currentValue) => ({ ...currentValue, [context]: true }));
    setUserContractsError((currentValue) => ({ ...currentValue, [context]: "" }));

    try {
      const files = await listFiles({
        entityType: "USER",
        entityId: userId,
        context,
        status: "ACTIVO",
      });

      setUserContractsByContext((currentValue) => ({
        ...currentValue,
        [context]: Array.isArray(files) ? files.slice(0, 1) : [],
      }));
    } catch (error) {
      setUserContractsError((currentValue) => ({
        ...currentValue,
        [context]: error instanceof Error ? error.message : "No se pudo cargar el contrato.",
      }));
    } finally {
      setUserContractsLoading((currentValue) => ({ ...currentValue, [context]: false }));
    }
  }, []);

  const loadUserContracts = useCallback(async (userId) => {
    if (!userId || !canReadUserContracts) {
      resetUserContractsState();
      return;
    }

    await Promise.all(
      USER_CONTRACT_CONTEXTS.map((item) => loadUserContractByContext(userId, item.context)),
    );
  }, [canReadUserContracts, loadUserContractByContext, resetUserContractsState]);

  useEffect(() => {
    if (visibleTabs.length === 0) {
      return;
    }

    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    loadUsers();
    loadRoles();
    loadAreas();
    loadPermissions();
    loadRegions();
  }, [loadAreas, loadPermissions, loadRegions, loadRoles, loadUsers]);

  useEffect(() => {
    const regionId = userForm.location.region_id;

    if (!regionId) {
      setComunas([]);
      return;
    }

    let cancelled = false;

    getComunas({ region_id: Number(regionId), activo: true })
      .then((items) => {
        if (cancelled) return;
        setComunas(items);
      })
      .catch((error) => {
        if (cancelled) return;
        setUsersError(error instanceof Error ? error.message : "No se pudieron cargar las comunas");
      });

    return () => {
      cancelled = true;
    };
  }, [userForm.location.region_id]);

  const availableAreas = useMemo(() => {
    const names = new Set(
      users.flatMap((user) => (Array.isArray(user.areaNames) ? user.areaNames : [])),
    );

    areas
      .map((area) => area.nombre)
      .filter(Boolean)
      .forEach((name) => names.add(name));

    return Array.from(names)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  }, [areas, users]);

  const availableUserRoles = useMemo(() => {
    const roleNames = new Set();

    users.forEach((user) => {
      (user.roles || []).forEach((roleName) => {
        if (roleName) {
          roleNames.add(roleName);
        }
      });
    });

    return Array.from(roleNames).sort((left, right) => left.localeCompare(right));
  }, [users]);

  const editingUserAreaNames = useMemo(() => {
    if (Array.isArray(editingUserSummary?.areaNames) && editingUserSummary.areaNames.length > 0) {
      return editingUserSummary.areaNames.filter(Boolean);
    }

    if (Array.isArray(editingUserSummary?.areas)) {
      return editingUserSummary.areas
        .map((area) => area?.nombre || "")
        .filter(Boolean);
    }

    return [];
  }, [editingUserSummary]);

  const editingUserRoleNames = useMemo(() => {
    if (Array.isArray(editingUserSummary?.roles) && editingUserSummary.roles.length > 0) {
      return editingUserSummary.roles.filter(Boolean);
    }

    if (Array.isArray(editingUserSummary?.rolesDetailed)) {
      return editingUserSummary.rolesDetailed
        .map((role) => role?.nombre || "")
        .filter(Boolean);
    }

    return [];
  }, [editingUserSummary]);
  const regionOptions = useMemo(
    () => mergeCurrentOption(
      regions,
      userForm.location.region_id,
      editingUserSummary?.regionNombre,
      "Región actual",
    ),
    [editingUserSummary?.regionNombre, regions, userForm.location.region_id],
  );
  const comunaOptions = useMemo(
    () => mergeCurrentOption(
      comunas,
      userForm.location.comuna_id,
      editingUserSummary?.comunaNombre,
      "Comuna actual",
    ),
    [comunas, editingUserSummary?.comunaNombre, userForm.location.comuna_id],
  );
  const isEditingAuthenticatedUser = Number(editingUserId) === Number(authenticatedUser?.id);

  const roleAssignmentCounts = useMemo(() => {
    const counts = new Map();

    users.forEach((user) => {
      (user.roles || []).forEach((roleName) => {
        counts.set(roleName, (counts.get(roleName) || 0) + 1);
      });
    });

    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase();

    return users.filter((user) => {
      const areaNames = Array.isArray(user.areaNames) ? user.areaNames.join(" ") : user.area || "";
      const roleNames = Array.isArray(user.roles) ? user.roles.join(" ") : "";
      const haystack = [
        user.nombre,
        user.apellido,
        user.email,
        user.rut,
        user.telefono,
        roleNames,
        areaNames,
      ]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) {
        return false;
      }

      if (userActiveFilter === "active" && !user.activo) {
        return false;
      }

      if (userActiveFilter === "inactive" && user.activo) {
        return false;
      }

      if (userRoleFilter !== "all" && !(user.roles || []).includes(userRoleFilter)) {
        return false;
      }

      if (
        userAreaFilter !== "all"
        && !(user.areaNames || []).some((areaName) => areaName === userAreaFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [userActiveFilter, userAreaFilter, userRoleFilter, userSearch, users]);

  const filteredRoles = useMemo(() => {
    const normalizedSearch = roleSearch.trim().toLowerCase();

    return roles.filter((role) => {
      const permissionNames = (role.permisos || [])
        .map((permission) => permission?.nombre || permission?.name || "")
        .join(" ")
        .toLowerCase();
      const assignedUsers = roleAssignmentCounts.get(role.nombre) || 0;

      if (normalizedSearch) {
        const haystack = `${role.nombre || ""} ${permissionNames}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      if (roleAssignmentFilter === "assigned" && assignedUsers === 0) {
        return false;
      }

      if (roleAssignmentFilter === "unassigned" && assignedUsers > 0) {
        return false;
      }

      const permissionCount = Array.isArray(role.permisos) ? role.permisos.length : 0;
      if (rolePermissionFilter === "none" && permissionCount !== 0) {
        return false;
      }
      if (rolePermissionFilter === "few" && (permissionCount < 1 || permissionCount > 10)) {
        return false;
      }
      if (rolePermissionFilter === "many" && permissionCount <= 10) {
        return false;
      }

      return true;
    });
  }, [roleAssignmentCounts, roleAssignmentFilter, rolePermissionFilter, roleSearch, roles]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userActiveFilter, userRoleFilter, userAreaFilter]);

  useEffect(() => {
    setRolePage(1);
  }, [roleSearch, roleAssignmentFilter, rolePermissionFilter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (userPage - 1) * userPageSize;
    return filteredUsers.slice(startIndex, startIndex + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  const paginatedRoles = useMemo(() => {
    const startIndex = (rolePage - 1) * rolePageSize;
    return filteredRoles.slice(startIndex, startIndex + rolePageSize);
  }, [filteredRoles, rolePage, rolePageSize]);

  const userFilterStats = useMemo(
    () => [
      `Mostrando ${filteredUsers.length} de ${users.length}`,
      `Activos: ${filteredUsers.filter((user) => user.activo).length}`,
      `Inactivos: ${filteredUsers.filter((user) => !user.activo).length}`,
    ],
    [filteredUsers, users.length],
  );

  const roleFilterStats = useMemo(
    () => [
      `Mostrando ${filteredRoles.length} de ${roles.length}`,
      `Con usuarios: ${
        filteredRoles.filter((role) => (roleAssignmentCounts.get(role.nombre) || 0) > 0).length
      }`,
      `Sin usuarios: ${
        filteredRoles.filter((role) => (roleAssignmentCounts.get(role.nombre) || 0) === 0).length
      }`,
    ],
    [filteredRoles, roleAssignmentCounts, roles.length],
  );

  const normalizedPermissions = useMemo(() => {
    return availablePermissions
      .map(normalizePermissionForDisplay)
      .filter((permission) => permission.key && permission.value != null)
      .sort(comparePermissions);
  }, [availablePermissions]);

  const permissionsByModule = useMemo(() => {
    return normalizedPermissions.reduce((map, permission) => {
      const moduleName = permission.metadata.module || "Otros";

      if (!map.has(moduleName)) {
        map.set(moduleName, []);
      }

      map.get(moduleName).push(permission);
      return map;
    }, new Map());
  }, [normalizedPermissions]);

  const filteredPermissionModules = useMemo(() => {
    const normalizedSearch = rolePermissionSearch.trim().toLowerCase();
    const filteredPermissions = !normalizedSearch
      ? normalizedPermissions
      : normalizedPermissions.filter((permission) => {
        const haystack = [
          permission.metadata.label,
          permission.metadata.description,
          permission.metadata.module,
          permission.metadata.group,
          permission.key,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      });

    const moduleMap = new Map();

    filteredPermissions.forEach((permission) => {
      const moduleName = permission.metadata.module || "Otros";
      const groupName = permission.metadata.group || "Otros";

      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, new Map());
      }

      const groupMap = moduleMap.get(moduleName);
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }

      groupMap.get(groupName).push(permission);
    });

    return Array.from(moduleMap.entries())
      .sort(([leftName], [rightName]) => {
        const leftOrder = permissionModuleOrderMap.get(leftName) ?? 999;
        const rightOrder = permissionModuleOrderMap.get(rightName) ?? 999;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return leftName.localeCompare(rightName, "es");
      })
      .map(([moduleName, groupMap]) => ({
        module: moduleName,
        groups: Array.from(groupMap.entries())
          .sort(([leftName], [rightName]) => {
            const leftOrder = permissionGroupOrderMap.get(leftName) ?? 999;
            const rightOrder = permissionGroupOrderMap.get(rightName) ?? 999;

            if (leftOrder !== rightOrder) {
              return leftOrder - rightOrder;
            }

            return leftName.localeCompare(rightName, "es");
          })
          .map(([groupName, items]) => ({
            group: groupName,
            items: [...items].sort(comparePermissions),
          })),
      }));
  }, [normalizedPermissions, rolePermissionSearch]);

  const roleSelectedPermissionCount = roleForm.permisos.length;

  const userContractBlocks = useMemo(() => {
    return USER_CONTRACT_CONTEXTS.map((item) => {
      const files = Array.isArray(userContractsByContext[item.context])
        ? userContractsByContext[item.context]
        : [];

      return {
        ...item,
        files,
        hasActiveContract: files.length > 0,
        loading: Boolean(userContractsLoading[item.context]),
        error: userContractsError[item.context] || "",
      };
    });
  }, [userContractsByContext, userContractsError, userContractsLoading]);

  const getModulePermissionCounter = useCallback(
    (moduleName) => {
      const modulePermissions = permissionsByModule.get(moduleName) || [];
      const totalCount = modulePermissions.length;
      const selectedCount = modulePermissions.filter((permission) => (
        hasCheckedId(roleForm.permisos, permission.value)
      )).length;

      return { totalCount, selectedCount };
    },
    [permissionsByModule, roleForm.permisos],
  );

  const resetUserFilters = () => {
    setUserSearch("");
    setUserActiveFilter("all");
    setUserRoleFilter("all");
    setUserAreaFilter("all");
    setUserPage(1);
  };

  const resetRoleFilters = () => {
    setRoleSearch("");
    setRoleAssignmentFilter("all");
    setRolePermissionFilter("all");
    setRolePage(1);
  };

  const openCreateUserModal = () => {
    if (!canCreateUserFull) return;

    setUserModalMode("create");
    setEditingUserId(null);
    setEditingUserSummary(null);
    setUserForm(emptyUserForm());
    setUserFormError("");
    setUserModalLoading(false);
    setComunas([]);
    resetUserContractsState();
    setUserPasswordResetForm({
      new_password: "",
      confirm_password: "",
    });
    setUserPasswordResetError("");
    setUserPasswordResetSuccess("");
    setShowUserPasswordResetFields({
      new_password: false,
      confirm_password: false,
    });
    setIsUserModalOpen(true);
  };

  const openEditUserModal = async (user) => {
    if (!canUpdateUser) return;

    setUserModalMode("edit");
    setEditingUserId(user.id);
    setEditingUserSummary(user);
    setUserForm(emptyUserForm());
    setUserFormError("");
    setUserModalLoading(true);
    setComunas([]);
    resetUserContractsState();
    setUserPasswordResetForm({
      new_password: "",
      confirm_password: "",
    });
    setUserPasswordResetError("");
    setUserPasswordResetSuccess("");
    setShowUserPasswordResetFields({
      new_password: false,
      confirm_password: false,
    });
    setIsUserModalOpen(true);

    const requestId = ++userDetailRequestRef.current;

    try {
      const userDetail = await getUser(user.id);

      if (userDetailRequestRef.current !== requestId) {
        return;
      }

      setEditingUserSummary(userDetail);
      setUserForm(createUserFormFromDetail(userDetail));

      if (user.id && canReadUserContracts) {
        await loadUserContracts(user.id);
      }
    } catch (error) {
      if (userDetailRequestRef.current !== requestId) {
        return;
      }

      setUserFormError(
        error instanceof Error ? error.message : "No se pudo cargar el detalle del usuario",
      );
    } finally {
      if (userDetailRequestRef.current === requestId) {
        setUserModalLoading(false);
      }
    }
  };

  const closeUserModal = () => {
    if (isSubmitting) return;
    userDetailRequestRef.current += 1;
    setIsUserModalOpen(false);
    setUserForm(emptyUserForm());
    setUserFormError("");
    setEditingUserId(null);
    setEditingUserSummary(null);
    setUserModalLoading(false);
    resetUserContractsState();
    setUserPasswordResetForm({
      new_password: "",
      confirm_password: "",
    });
    setUserPasswordResetError("");
    setUserPasswordResetSuccess("");
    setShowUserPasswordResetFields({
      new_password: false,
      confirm_password: false,
    });
  };

  const handleUserFormChange = (field, value) => {
    setUserFormError("");
    setUserForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const handleLocationFormChange = (field, value) => {
    setUserFormError("");
    setUserForm((currentValue) => ({
      ...currentValue,
      location: {
        ...currentValue.location,
        [field]: value,
        ...(field === "region_id" ? { comuna_id: "" } : {}),
      },
    }));
  };

  const handleToggleArea = (areaId) => {
    setUserFormError("");
    setUserForm((currentValue) => {
      const isChecked = hasCheckedId(currentValue.area_ids, areaId);
      return {
        ...currentValue,
        area_ids: isChecked
          ? currentValue.area_ids.filter((id) => String(id) !== String(areaId))
          : [...currentValue.area_ids, String(areaId)],
      };
    });
  };

  const handleToggleRole = (roleId) => {
    setUserFormError("");
    setUserForm((currentValue) => {
      const isChecked = hasCheckedId(currentValue.role_ids, roleId);
      return {
        ...currentValue,
        role_ids: isChecked
          ? currentValue.role_ids.filter((id) => String(id) !== String(roleId))
          : [...currentValue.role_ids, String(roleId)],
      };
    });
  };

  const handleUserPasswordResetFieldChange = (field, value) => {
    setUserPasswordResetError("");
    setUserPasswordResetSuccess("");
    setUserPasswordResetForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const toggleUserPasswordResetVisibility = (field) => {
    setShowUserPasswordResetFields((currentValue) => ({
      ...currentValue,
      [field]: !currentValue[field],
    }));
  };
  const renderUserContractBlock = (contract) => {
    const activeFile = contract.files[0] || null;
    const canShowUploader = (
      userModalMode === "edit"
      && editingUserId
      && canUploadUserContracts
      && !contract.hasActiveContract
    );

    async function handleDeleteContract() {
      if (!activeFile?.file_asset_id) return;

      if (!window.confirm(`¿Eliminar "${activeFile.original_name}"?`)) {
        return;
      }

      await deleteFile(activeFile.file_asset_id);
      await loadUserContractByContext(editingUserId, contract.context);
    }

    async function handleDownloadContract() {
      if (!activeFile) return;
      await downloadFile(activeFile);
    }

    return (
      <article key={contract.context} className="user-contract-list-item">
        <div className="user-contract-list-title">{contract.title}</div>

        <div className="user-contract-list-row">
          <div className="user-contract-file-info">
            {activeFile ? (
              <>
                <span className="user-contract-file-name" title={activeFile.original_name}>
                  {activeFile.original_name}
                </span>
                <span className="user-contract-file-meta">
                  {formatContractBytes(activeFile.size_bytes)} - {formatContractDate(activeFile.uploaded_at)}
                </span>
              </>
            ) : (
              <span className="user-contract-empty">Sin contrato asociado</span>
            )}
          </div>

          <div className="user-contract-actions">
            {activeFile ? (
              <>
                <IconButton
                  icon={Download}
                  label="Descargar contrato de voluntario"
                  variant="secondary"
                  onClick={handleDownloadContract}
                />
                {canDeleteUserContracts ? (
                  <IconButton
                    icon={Trash2}
                    label="Eliminar contrato de voluntario"
                    variant="danger"
                    onClick={handleDeleteContract}
                  />
                ) : null}
              </>
            ) : null}

            {canShowUploader ? (
              <FileUploader
                entityType="USER"
                entityId={editingUserId}
                context={contract.context}
                defaultVisibility="PRIVADO"
                allowedAccept="application/pdf"
                allowVisibility={false}
                allowMain={false}
                allowMultiple={false}
                autoUpload
                buttonLabel="Subir PDF"
                compact
                onUploaded={async () => {
                  await loadUserContractByContext(editingUserId, contract.context);
                }}
              />
            ) : null}
          </div>
        </div>

        {contract.loading ? <p className="list-message">Cargando contrato...</p> : null}
        {contract.error ? <p className="error-text">{contract.error}</p> : null}
        {contract.hasActiveContract ? (
          <p className="inventory-subtle">Ya existe un contrato activo de este tipo.</p>
        ) : null}
      </article>
    );
  };

  const handleSubmitUser = async (event) => {
    event.preventDefault();
    setUserFormError("");

    if (userModalLoading) {
      return;
    }

    if (
      canAssignUserAreas
      && userForm.area_ids.length === 0
    ) {
      setUserFormError("Debe asignar al menos un area al usuario.");
      return;
    }

    if (
      canAssignUserRoles
      && userForm.role_ids.length === 0
    ) {
      setUserFormError("Debe asignar al menos un rol al usuario.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (userModalMode === "create" && !canCreateUserFull) return;
      if (userModalMode === "edit" && !canUpdateUser) return;

      if (userModalMode === "create") {
        await createUser(
          buildUserPayload(userForm, {
            includePassword: true,
            includeRoleIds: true,
            includeAreaIds: true,
          }),
        );
      } else {
        await updateUser(
          editingUserId,
          buildUserPayload(userForm, {
            includeRoleIds: canAssignUserRoles,
            includeAreaIds: canAssignUserAreas,
          }),
        );
      }

      if (canReadUsers) {
        await loadUsers();
      }
      closeUserModal();
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Error guardando el usuario");
      setUserFormError(error instanceof Error ? error.message : "Error guardando el usuario");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetUserPassword = async () => {
    setUserPasswordResetError("");
    setUserPasswordResetSuccess("");

    if (!canResetUserPasswords || !editingUserId) {
      return;
    }

    if (Number(editingUserId) === Number(authenticatedUser?.id)) {
      setUserPasswordResetError("Para cambiar tu propia contraseña utiliza Mi Perfil.");
      return;
    }

    const payload = buildUserPasswordResetPayload(userPasswordResetForm);

    if (!payload.new_password || !payload.confirm_password) {
      setUserPasswordResetError("Debes completar ambos campos de contraseña.");
      return;
    }

    if (payload.new_password !== payload.confirm_password) {
      setUserPasswordResetError("Las contraseñas no coinciden.");
      return;
    }

    setIsResettingUserPassword(true);

    try {
      await resetUserPassword(editingUserId, payload);
      setUserPasswordResetForm({
        new_password: "",
        confirm_password: "",
      });
      setShowUserPasswordResetFields({
        new_password: false,
        confirm_password: false,
      });
      setUserPasswordResetSuccess("La contraseña fue restablecida correctamente.");
    } catch (error) {
      setUserPasswordResetError(
        error instanceof Error
          ? error.message
          : "No fue posible restablecer la contraseña del usuario.",
      );
    } finally {
      setIsResettingUserPassword(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!canDeleteUser) return;

    const confirmed = window.confirm(`Seguro que deseas eliminar a ${user.nombre} ${user.apellido}?`);
    if (!confirmed) return;

    try {
      await deleteUser(user.id);
      await loadUsers();
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Error eliminando el usuario");
    }
  };

  const openCreateRoleModal = () => {
    if (!canCreateRole) return;

    setRoleModalMode("create");
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm());
    setRoleFormError("");
    setRolePermissionSearch("");
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role) => {
    if (!canUpdateRole) return;

    setRoleModalMode("edit");
    setEditingRoleId(role.id);
    setRoleForm({
      nombre: role.nombre,
      permisos: role.permisosIds || [],
    });
    setRoleFormError("");
    setRolePermissionSearch("");
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    if (isSubmitting) return;
    setIsRoleModalOpen(false);
    setRoleFormError("");
    setRolePermissionSearch("");
  };

  const handleRoleNameChange = (value) => {
    setRoleFormError("");
    setRoleForm((currentValue) => ({
      ...currentValue,
      nombre: value,
    }));
  };

  const toggleRolePermission = (permissionId) => {
    setRoleFormError("");
    setRoleForm((currentValue) => {
      const hasCurrentPermission = hasCheckedId(currentValue.permisos, permissionId);
      return {
        ...currentValue,
        permisos: hasCurrentPermission
          ? currentValue.permisos.filter((id) => String(id) !== String(permissionId))
          : [...currentValue.permisos, permissionId],
      };
    });
  };

  const isRolePermissionSelected = useCallback(
    (permissionId) => hasCheckedId(roleForm.permisos, permissionId),
    [roleForm.permisos],
  );

  const setModulePermissionsSelection = (moduleName, nextChecked) => {
    const modulePermissions = permissionsByModule.get(moduleName) || [];
    const modulePermissionIds = modulePermissions
      .map((permission) => permission.value)
      .filter((value) => value != null);

    setRoleFormError("");
    setRoleForm((currentValue) => {
      const nextSelected = new Set(currentValue.permisos.map((value) => String(value)));

      modulePermissionIds.forEach((permissionId) => {
        if (nextChecked) {
          nextSelected.add(String(permissionId));
        } else {
          nextSelected.delete(String(permissionId));
        }
      });

      return {
        ...currentValue,
        permisos: Array.from(nextSelected).map(Number),
      };
    });
  };

  const handleSubmitRole = async (event) => {
    event.preventDefault();
    setRoleFormError("");
    setIsSubmitting(true);

    try {
      if (roleModalMode === "create" && !canCreateRole) return;
      if (roleModalMode === "edit" && !canUpdateRole) return;

      if (roleForm.permisos.length === 0) {
        setRoleFormError("Debes seleccionar al menos un permiso.");
        return;
      }

      const payload = {
        nombre: roleForm.nombre.trim(),
        permisos: roleForm.permisos,
      };

      if (roleModalMode === "create") {
        await createRole(payload);
      } else {
        await updateRole(editingRoleId, payload);
      }

      await loadRoles();
      setIsRoleModalOpen(false);
    } catch (error) {
      setRolesError(error instanceof Error ? error.message : "Error guardando el rol");
      setRoleFormError(error instanceof Error ? error.message : "Error guardando el rol");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!canDeleteRole) return;

    const confirmed = window.confirm(`Seguro que deseas eliminar el rol ${role.nombre}?`);
    if (!confirmed) return;

    try {
      await deleteRole(role.id);
      await loadRoles();
    } catch (error) {
      setRolesError(error instanceof Error ? error.message : "Error eliminando el rol");
    }
  };

  return (
    <section className="main-content home-content">
      <header className="main-header">
        <h1>Voluntarios</h1>
        <p>Administra usuarios y roles del módulo de voluntarios.</p>
      </header>

      {visibleTabs.length === 0 ? (
        <section className="crud-card">
          <p className="list-message">
            No tienes permisos suficientes para acceder a este módulo.
          </p>
        </section>
      ) : (
        <HomeTabs tabs={visibleTabs} activeTab={activeTab} onChange={setActiveTab} />
      )}

      {visibleTabs.length > 0 && activeTab === "volunteers" ? (
        <section className="crud-card">
          <div className="crud-header">
            <h3>Listado de voluntarios</h3>
            {canCreateUserFull ? (
              <button type="button" className="btn btn-primary" onClick={openCreateUserModal}>
                Crear usuario
              </button>
            ) : null}
          </div>

          {!canReadUsers ? (
            <p className="list-message">
              No tienes permisos para listar usuarios.
            </p>
          ) : (
            <>

          <div className="table-tools">
            <label>
              <span>Buscar</span>
              <input
                type="search"
                className="search-input"
                placeholder="Buscar por nombre, apellido, correo, rut, teléfono, rol o area"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
              />
            </label>

            <label>
              <span>Estado</span>
              <select
                className="filter-select"
                value={userActiveFilter}
                onChange={(event) => setUserActiveFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>

            <label>
              <span>Rol</span>
              <select
                className="filter-select"
                value={userRoleFilter}
                onChange={(event) => setUserRoleFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                {availableUserRoles.map((roleName) => (
                  <option key={roleName} value={roleName}>
                    {roleName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Área</span>
              <select
                className="filter-select"
                value={userAreaFilter}
                onChange={(event) => setUserAreaFilter(event.target.value)}
              >
                <option value="all">Todas</option>
                {availableAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <FilterSummaryBar stats={userFilterStats} onClear={resetUserFilters} />

          <div className="table-scroll">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Apellidos</th>
                  <th>Roles</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Áreas</th>
                  <th>Comuna</th>
                  <th>Activo</th>
                  <th className="table-actions-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan="9">Cargando usuarios...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="9">No hay usuarios que coincidan con los filtros.</td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.nombre || "-"}</td>
                      <td>{user.apellido || "-"}</td>
                      <td>{user.roles?.join(", ") || "-"}</td>
                      <td>{user.email || "-"}</td>
                      <td>{user.telefono || "-"}</td>
                      <td>{user.areaNames?.join(", ") || "-"}</td>
                      <td>{user.comunaNombre || "-"}</td>
                      <td>{user.activo ? "Si" : "No"}</td>
                      <td className="table-actions-cell">
                        <div className="row-actions table-actions">
                          {canUpdateUser ? (
                            <IconButton
                              icon={Pencil}
                              label={`Editar usuario ${user.nombre || ""} ${user.apellido || ""}`.trim()}
                              variant="secondary"
                              onClick={() => openEditUserModal(user)}
                            />
                          ) : null}
                          {canDeleteUser ? (
                            <IconButton
                              icon={Trash2}
                              label={`Eliminar usuario ${user.nombre || ""} ${user.apellido || ""}`.trim()}
                              variant="danger"
                              onClick={() => handleDeleteUser(user)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!usersLoading && filteredUsers.length > 0 ? (
            <PaginationControls
              page={userPage}
              pageSize={userPageSize}
              totalItems={filteredUsers.length}
              onPageChange={setUserPage}
              onPageSizeChange={(nextPageSize) => {
                setUserPageSize(nextPageSize);
                setUserPage(1);
              }}
            />
          ) : null}
            </>
          )}

          {usersError ? <p className="error-text">{usersError}</p> : null}
        </section>
      ) : visibleTabs.length > 0 ? (
        <section className="crud-card">
          <div className="crud-header">
            <h3>Listado de roles</h3>
            {canCreateRole ? (
              <button type="button" className="btn btn-primary" onClick={openCreateRoleModal}>
                Crear rol
              </button>
            ) : null}
          </div>

          <div className="table-tools">
            <label>
              <span>Buscar</span>
              <input
                type="search"
                className="search-input"
                placeholder="Buscar por nombre del rol o permiso asociado"
                value={roleSearch}
                onChange={(event) => setRoleSearch(event.target.value)}
              />
            </label>

            <label>
              <span>Usuarios asignados</span>
              <select
                className="filter-select"
                value={roleAssignmentFilter}
                onChange={(event) => setRoleAssignmentFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="assigned">Con usuarios</option>
                <option value="unassigned">Sin usuarios</option>
              </select>
            </label>

            <label>
              <span>Cantidad de permisos</span>
              <select
                className="filter-select"
                value={rolePermissionFilter}
                onChange={(event) => setRolePermissionFilter(event.target.value)}
              >
                <option value="all">Todas</option>
                <option value="none">0 permisos</option>
                <option value="few">1 a 10 permisos</option>
                <option value="many">Mas de 10 permisos</option>
              </select>
            </label>
          </div>

          <FilterSummaryBar stats={roleFilterStats} onClear={resetRoleFilters} />

          <div className="table-scroll">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Permisos</th>
                  <th>Usuarios asignados</th>
                  <th className="table-actions-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rolesLoading ? (
                  <tr>
                    <td colSpan="4">Cargando roles...</td>
                  </tr>
                ) : filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan="4">No hay roles que coincidan con los filtros.</td>
                  </tr>
                ) : (
                  paginatedRoles.map((role) => (
                    <tr key={role.id}>
                      <td>{role.nombre}</td>
                      <td>{role.permisos?.length ? `${role.permisos.length} permisos` : "-"}</td>
                      <td>{roleAssignmentCounts.get(role.nombre) || 0}</td>
                      <td className="table-actions-cell">
                        <div className="row-actions table-actions">
                          {canUpdateRole ? (
                            <IconButton
                              icon={Pencil}
                              label={`Editar rol ${role.nombre || ""}`.trim()}
                              variant="secondary"
                              onClick={() => openEditRoleModal(role)}
                            />
                          ) : null}
                          {canDeleteRole ? (
                            <IconButton
                              icon={Trash2}
                              label={`Eliminar rol ${role.nombre || ""}`.trim()}
                              variant="danger"
                              onClick={() => handleDeleteRole(role)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!rolesLoading && filteredRoles.length > 0 ? (
            <PaginationControls
              page={rolePage}
              pageSize={rolePageSize}
              totalItems={filteredRoles.length}
              onPageChange={setRolePage}
              onPageSizeChange={(nextPageSize) => {
                setRolePageSize(nextPageSize);
                setRolePage(1);
              }}
            />
          ) : null}

          {rolesError ? <p className="error-text">{rolesError}</p> : null}
        </section>
      ) : null}

      {isUserModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeUserModal}>
          <div
            className="event-modal user-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>{userModalMode === "create" ? "Crear usuario" : "Editar usuario"}</h3>
                <ModalCloseButton onClick={closeUserModal} />
            </div>

            <form className="crud-form-grid" onSubmit={handleSubmitUser}>
              {userModalLoading ? (
                <div className="user-form-loading" role="status" aria-live="polite">
                  Cargando detalle del usuario...
                </div>
              ) : null}
              <label>
                <span>Nombre</span>
                <input
                  type="text"
                  value={userForm.nombre}
                  onChange={(event) => handleUserFormChange("nombre", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Apellido</span>
                <input
                  type="text"
                  value={userForm.apellido}
                  onChange={(event) => handleUserFormChange("apellido", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>RUT</span>
                <input
                  type="text"
                  value={userForm.rut}
                  onChange={(event) => handleUserFormChange("rut", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Correo</span>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(event) => handleUserFormChange("email", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Teléfono</span>
                <input
                  type="text"
                  value={userForm.telefono}
                  onChange={(event) => handleUserFormChange("telefono", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Activo</span>
                <select
                  value={String(userForm.activo)}
                  onChange={(event) => handleUserFormChange("activo", event.target.value === "true")}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
              <label>
                <span>Región</span>
                <select
                  value={userForm.location.region_id}
                  onChange={(event) => handleLocationFormChange("region_id", event.target.value)}
                  required
                >
                  <option value="">Selecciona región</option>
                  {regionOptions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Comuna</span>
                <select
                  value={userForm.location.comuna_id}
                  onChange={(event) => handleLocationFormChange("comuna_id", event.target.value)}
                  disabled={!userForm.location.region_id}
                  required
                >
                  <option value="">Selecciona comuna</option>
                  {comunaOptions.map((comuna) => (
                    <option key={comuna.id} value={comuna.id}>
                      {comuna.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Dirección</span>
                <input
                  placeholder="Calle Ejemplo 456 / Casa A o Dpto 12"
                  type="text"
                  value={userForm.location.direccion}
                  onChange={(event) => handleLocationFormChange("direccion", event.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              {userModalMode === "create" ? (
                <label>
                  <span>Contraseña</span>
                  <input
                  placeholder="Ingresa tu contraseña"
                    type="password"
                    value={userForm[PASSWORD_FIELD]}
                    onChange={(event) => handleUserFormChange(PASSWORD_FIELD, event.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </label>
              ) : null}
              <label>
                <span>Observaciones de ubicación</span>
                <textarea
                  rows="3"
                  value={userForm.location.observaciones}
                  onChange={(event) =>
                    handleLocationFormChange("observaciones", event.target.value)
                  }
                />
              </label>

              {userModalMode === "create" || canAssignUserAreas ? (
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div>
                      <h4>Áreas</h4>
                      <p>Selecciona una o varias áreas para el usuario.</p>
                    </div>
                    <span className="permission-count">{userForm.area_ids.length} seleccionadas</span>
                  </div>
                  <div className="user-checkbox-panel">
                    {areas.length === 0 ? (
                      <p className="list-message">No hay áreas disponibles.</p>
                    ) : (
<div className="user-checkbox-list task-user-checkbox-list">
  {areas.map((area) => {
    const isChecked = hasCheckedId(userForm.area_ids, area.id);

    return (
      <label
        key={area.id}
        className={`checkbox-item task-user-checkbox-item${
          isChecked ? " is-checked" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => handleToggleArea(area.id)}
        />

        <span>{area.nombre}</span>
      </label>
    );
  })}
</div>
                    )}
                  </div>
                </div>
              ) : userModalMode === "edit" ? (
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div>
                      <h4>Áreas</h4>
                      <p>No tienes permiso para reasignar áreas.</p>
                    </div>
                  </div>
                  <div className="user-checkbox-panel">
                    {editingUserAreaNames.length > 0 ? (
                      <div className="user-form-readonly-list">
                        {editingUserAreaNames.map((areaName) => (
                          <span key={areaName} className="user-form-readonly-pill">
                            {areaName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="list-message">El usuario no tiene áreas registradas.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {userModalMode === "create" || canAssignUserRoles ? (
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div>
                      <h4>Roles</h4>
                      <p>Selecciona uno o varios roles para el usuario.</p>
                    </div>
                    <span className="permission-count">{userForm.role_ids.length} seleccionados</span>
                  </div>
                  <div className="user-checkbox-panel">
                    {roles.length === 0 ? (
                      <p className="list-message">No hay roles disponibles.</p>
                    ) : (
                      <div className="user-checkbox-list task-user-checkbox-list">
                        {roles.map((role) => {
                          const isChecked = hasCheckedId(userForm.role_ids, role.id);

                          return (
                            <label
                              key={role.id}
                              className={`checkbox-item task-user-checkbox-item${isChecked ? " is-checked" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleRole(role.id)}
                              />
                              <span>{role.nombre}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : userModalMode === "edit" ? (
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div>
                      <h4>Roles</h4>
                      <p>No tienes permiso para reasignar roles.</p>
                    </div>
                  </div>
                  <div className="user-checkbox-panel">
                    {editingUserRoleNames.length > 0 ? (
                      <div className="user-form-readonly-list">
                        {editingUserRoleNames.map((roleName) => (
                          <span key={roleName} className="user-form-readonly-pill">
                            {roleName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="list-message">El usuario no tiene roles registrados.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {userModalMode === "edit" && editingUserId && canResetUserPasswords ? (
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div>
                      <h4>Restablecer contraseña</h4>
                      <p>
                        Accion separada del formulario general. {PASSWORD_POLICY.hint}
                      </p>
                    </div>
                  </div>

                  {isEditingAuthenticatedUser ? (
                    <div className="user-checkbox-panel">
                      <p className="list-message">
                        Para cambiar tu propia contraseña utiliza Mi Perfil.
                      </p>
                    </div>
                  ) : (
                    <div className="user-password-reset-panel">
                      <label>
                        <span>Nueva contraseña</span>
                        <div className="profile-password-input">
                          <input
                            type={showUserPasswordResetFields.new_password ? "text" : "password"}
                            value={userPasswordResetForm.new_password}
                            onChange={(event) =>
                              handleUserPasswordResetFieldChange(
                                "new_password",
                                event.target.value,
                              )
                            }
                            autoComplete="new-password"
                          />
                          <IconButton
                            icon={showUserPasswordResetFields.new_password ? EyeOff : Eye}
                            label={
                              showUserPasswordResetFields.new_password
                                ? "Ocultar nueva contraseña"
                                : "Mostrar nueva contraseña"
                            }
                            variant="secondary"
                            type="button"
                            className="profile-password-toggle"
                            onClick={() => toggleUserPasswordResetVisibility("new_password")}
                          />
                        </div>
                      </label>

                      <label>
                        <span>Confirmar nueva contraseña</span>
                        <div className="profile-password-input">
                          <input
                            type={showUserPasswordResetFields.confirm_password ? "text" : "password"}
                            value={userPasswordResetForm.confirm_password}
                            onChange={(event) =>
                              handleUserPasswordResetFieldChange(
                                "confirm_password",
                                event.target.value,
                              )
                            }
                            autoComplete="new-password"
                          />
                          <IconButton
                            icon={showUserPasswordResetFields.confirm_password ? EyeOff : Eye}
                            label={
                              showUserPasswordResetFields.confirm_password
                                ? "Ocultar confirmación de contraseña"
                                : "Mostrar confirmación de contraseña"
                            }
                            variant="secondary"
                            type="button"
                            className="profile-password-toggle"
                            onClick={() => toggleUserPasswordResetVisibility("confirm_password")}
                          />
                        </div>
                      </label>

                      <small className="profile-help-text">{PASSWORD_POLICY.hint}</small>
                      {userPasswordResetError ? (
                        <p className="error-text" role="alert">{userPasswordResetError}</p>
                      ) : null}
                      {userPasswordResetSuccess ? (
                        <p className="profile-success">{userPasswordResetSuccess}</p>
                      ) : null}
                      <div className="profile-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleResetUserPassword}
                          disabled={isResettingUserPassword}
                        >
                          {isResettingUserPassword
                            ? "Restableciendo..."
                            : "Restablecer contraseña"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {userModalMode === "edit" && editingUserId ? (
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div>
                      <h4>Contratos del usuario</h4>
                      <p>Gestiona contratos PDF privados asociados al usuario. Solo se permite un PDF activo por tipo.</p>
                    </div>
                  </div>
                  <section className="attachment-list crud-card user-contracts-list">
                    {userContractBlocks.map((contract) => renderUserContractBlock(contract))}
                  </section>
                </div>
              ) : null}

              {userFormError ? <p className="error-text user-form-error">{userFormError}</p> : null}

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeUserModal}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    isSubmitting
                    || userModalLoading
                    || (userModalMode === "create" ? !canCreateUserFull : !canUpdateUser)
                  }
                >
                  {isSubmitting
                    ? "Guardando..."
                    : userModalMode === "create"
                      ? "Crear usuario"
                      : "Actualizar usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isRoleModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeRoleModal}>
          <div
            className="event-modal role-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>{roleModalMode === "create" ? "Crear rol" : "Editar rol"}</h3>
                <ModalCloseButton onClick={closeRoleModal} />
            </div>

            <form className="crud-form-grid" onSubmit={handleSubmitRole}>
              <label className="role-name-field">
                <span>Nombre del rol</span>
                <input
                  type="text"
                  placeholder="Nombre del rol"
                  value={roleForm.nombre}
                  onChange={(event) => handleRoleNameChange(event.target.value)}
                  required
                />
              </label>

              <div className="role-permissions">
                <div className="role-permissions-header">
                  <div>
                    <h4>Permisos</h4>
                    <p>Selecciona al menos un permiso para el rol.</p>
                  </div>
                  <span className="permission-count">
                    {roleSelectedPermissionCount} seleccionados
                  </span>
                </div>

                <div className="permissions-toolbar">
                  <label className="permission-search-field">
                    <span>Buscar permisos</span>
                    <input
                      type="search"
                      className="search-input"
                      placeholder="Buscar por nombre, descripción, módulo o grupo"
                      value={rolePermissionSearch}
                      onChange={(event) => setRolePermissionSearch(event.target.value)}
                    />
                  </label>
                  <div className="permission-toolbar-summary">
                    <span className="permission-count">
                      {normalizedPermissions.length} permisos disponibles
                    </span>
                  </div>
                </div>

                {permissionsLoading ? (
                  <p className="list-message">Cargando permisos...</p>
                ) : permissionsError ? (
                  <p className="error-text">{permissionsError}</p>
                ) : normalizedPermissions.length === 0 ? (
                  <p className="list-message">No hay permisos disponibles.</p>
                ) : filteredPermissionModules.length === 0 ? (
                  <p className="list-message">
                    No hay permisos que coincidan con la busqueda actual.
                  </p>
                ) : (
                  <div className="permission-groups">
                    {filteredPermissionModules.map((moduleItem) => {
                      const { selectedCount, totalCount } = getModulePermissionCounter(
                        moduleItem.module,
                      );

                      return (
                        <section key={moduleItem.module} className="permission-module">
                          <div className="permission-module-header">
                            <div>
                              <h5>{moduleItem.module}</h5>
                              <p>{selectedCount} de {totalCount} seleccionados</p>
                            </div>
                            <div className="permission-module-actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => setModulePermissionsSelection(moduleItem.module, true)}
                              >
                                Seleccionar todo
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => setModulePermissionsSelection(moduleItem.module, false)}
                              >
                                Limpiar módulo
                              </button>
                            </div>
                          </div>

                          <div className="permission-module-groups">
                            {moduleItem.groups.map((groupItem) => (
                              <div key={`${moduleItem.module}-${groupItem.group}`} className="permission-group">
                                <h6>{groupItem.group}</h6>
                                <div className="permission-items">
                                  {groupItem.items.map((permission) => {
                                    const isChecked = isRolePermissionSelected(permission.value);

                                    return (
                                      <label
                                        key={permission.value}
                                        className={`permission-item${
                                          isChecked ? " is-checked" : ""
                                        }${
                                          permission.metadata.isDangerous ? " permission-item-danger" : ""
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleRolePermission(permission.value)}
                                        />
                                        <div className="permission-item-body">
                                          <div className="permission-item-topline">
                                            <span className="permission-label">
                                              {permission.metadata.label}
                                            </span>
                                            {permission.metadata.isDangerous ? (
                                              <span className="permission-badge">Sensible</span>
                                            ) : null}
                                          </div>
                                          <p className="permission-description">
                                            {permission.metadata.description}
                                          </p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}

                {roleFormError ? (
                  <p className="error-text role-form-error">{roleFormError}</p>
                ) : null}
              </div>

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeRoleModal}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    isSubmitting
                    || (roleModalMode === "create" ? !canCreateRole : !canUpdateRole)
                  }
                >
                  {isSubmitting
                    ? "Guardando..."
                    : roleModalMode === "create"
                      ? "Crear rol"
                      : "Actualizar rol"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
