"use strict";

import { In } from "typeorm";
import { AppDataSource } from "../config/configDb.js";
import Area from "../entities/area.entity.js";
import Task from "../entities/task.entity.js";
import TaskAssignment from "../entities/task_assignment.entity.js";
import TaskComment from "../entities/task_comment.entity.js";
import TaskHistory from "../entities/task_history.entity.js";
import User from "../entities/user.entity.js";
import {
  canAreaScopedActorAssignTarget,
  getTaskPermissionProfileForUser,
  getUserAreas,
} from "./task.scope.shared.js";

const TASK_ACTIVE_STATUS = ["pendiente", "en_progreso", "completada"];
const TASK_ASSIGNMENT_STATUS = ["pendiente", "en_progreso", "completada"];
const TASK_VIEW_IDS = {
  ALL: "all",
  ASSIGNED: "assigned",
  CREATED: "created",
  ARCHIVED: "archived",
};
const TASK_HISTORY_ACTIONS = {
  CREATED: "created",
  UPDATED: "updated",
  ASSIGNMENT_ADDED: "assignment_added",
  ASSIGNMENT_REMOVED: "assignment_removed",
  STATUS_CHANGED: "status_changed",
  ARCHIVED: "archived",
};
const TASK_PROFILE_IDS = {
  GLOBAL: "global",
  CREATOR: "creator",
  ASSIGNEE: "assignee",
  NONE: "none",
};

function getTaskId(query) {
  return Number(query?.id ?? query?.id_tarea ?? query?.taskId);
}

function getAssignmentId(query) {
  return Number(query?.assignmentId ?? query?.id_asignacion ?? query);
}

function toUserRef(id) {
  return { id_usuario: Number(id) };
}

function toAreaRef(id) {
  return { id_area: Number(id) };
}

function buildTaskPermissions(permissions = []) {
  const permissionSet = new Set(permissions);

  return {
    readAny: permissionSet.has("home:task:read:any"),
    readArea: permissionSet.has("home:task:read:area"),
    readMine: permissionSet.has("home:task:read:mine"),
    historyAny: permissionSet.has("home:task:history:read:any"),
    historyArea: permissionSet.has("home:task:history:read:area"),
    historyMine: permissionSet.has("home:task:history:read:mine"),
    createAny: permissionSet.has("home:task:create:any"),
    createArea: permissionSet.has("home:task:create:area"),
    updateAny: permissionSet.has("home:task:update:any"),
    updateArea: permissionSet.has("home:task:update:area"),
    updateStatusMine: permissionSet.has("home:task:update:status:mine"),
    assignAny: permissionSet.has("home:task:assign:any"),
    assignArea: permissionSet.has("home:task:assign:area"),
    deleteAny: permissionSet.has("home:task:delete:any"),
    deleteArea: permissionSet.has("home:task:delete:area"),
    deleteMine: permissionSet.has("home:task:delete:mine"),
    commentAny: permissionSet.has("home:task:comment:any"),
    commentArea: permissionSet.has("home:task:comment:area"),
    commentMine: permissionSet.has("home:task:comment:mine"),
  };
}

async function getUserContext(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({
    where: { id_usuario: userId, activo: true },
    relations: {
      area: true,
      UserArea: { area: true },
      UserRole: {
        role: {
          RolePermission: {
            permission: true,
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const areas = getUserAreas(user);
  const permissionProfile = getTaskPermissionProfileForUser(user);

  return {
    id: user.id_usuario,
    areaId: areas[0]?.id_area ?? user.area?.id_area ?? null,
    areaName: areas[0]?.nombre ?? user.area?.nombre ?? "",
    areaIds: areas.map((area) => Number(area.id_area)),
    areas,
    primaryAreaId: areas[0]?.id_area ?? user.area?.id_area ?? null,
    primaryAreaName: areas[0]?.nombre ?? user.area?.nombre ?? "",
    fullName: [user.nombre, user.apellido].filter(Boolean).join(" ").trim(),
    roleNames: permissionProfile.roleNames,
    permissionNames: permissionProfile.permissionNames,
  };
}

function resolveScope(permissionFlags, scopeType) {
  if (scopeType === "read") {
    if (permissionFlags.readAny) return "any";
    if (permissionFlags.readArea) return "area";
    if (permissionFlags.readMine) return "mine";
    return "none";
  }

  if (scopeType === "history") {
    if (permissionFlags.historyAny) return "any";
    if (permissionFlags.historyArea) return "area";
    if (permissionFlags.historyMine) return "mine";
    return "none";
  }

  if (scopeType === "create") {
    if (permissionFlags.createAny) return "any";
    if (permissionFlags.createArea) return "area";
    return "none";
  }

  if (scopeType === "update") {
    if (permissionFlags.updateAny) return "any";
    if (permissionFlags.updateArea) return "area";
    if (permissionFlags.updateStatusMine) return "mine";
    return "none";
  }

  if (scopeType === "assign") {
    if (permissionFlags.assignAny) return "any";
    if (permissionFlags.assignArea) return "area";
    return "none";
  }

  if (scopeType === "delete") {
    if (permissionFlags.deleteAny) return "any";
    if (permissionFlags.deleteArea) return "area";
    if (permissionFlags.deleteMine) return "mine";
    return "none";
  }

  if (scopeType === "comment") {
    if (permissionFlags.commentAny) return "any";
    if (permissionFlags.commentArea) return "area";
    if (permissionFlags.commentMine) return "mine";
    return "none";
  }

  return "none";
}

function resolveProfile(scopes) {
  if (scopes.read === "any" || scopes.create === "any" || scopes.update === "any") {
    return TASK_PROFILE_IDS.GLOBAL;
  }

  if (scopes.create !== "none" || scopes.update === "area") {
    return TASK_PROFILE_IDS.CREATOR;
  }

  if (scopes.read !== "none") {
    return TASK_PROFILE_IDS.ASSIGNEE;
  }

  return TASK_PROFILE_IDS.NONE;
}

function buildAvailableViews(scopes) {
  const views = [];

  if (scopes.read === "any" || scopes.read === "area") {
    views.push({ id: TASK_VIEW_IDS.ALL, label: "Todas las tareas" });
  }

  if (scopes.read !== "none") {
    views.push({ id: TASK_VIEW_IDS.ASSIGNED, label: "Mis tareas" });
  }

  if (scopes.create !== "none") {
    views.push({ id: TASK_VIEW_IDS.CREATED, label: "Creadas por mí" });
  }

  if (scopes.read !== "none" || scopes.create !== "none") {
    views.push({ id: TASK_VIEW_IDS.ARCHIVED, label: "Archivadas" });
  }

  return views;
}

function profileLabelFromId(profileId) {
  if (profileId === TASK_PROFILE_IDS.GLOBAL) return "Directiva";
  if (profileId === TASK_PROFILE_IDS.CREATOR) return "Encargado de área";
  if (profileId === TASK_PROFILE_IDS.ASSIGNEE) return "Voluntario";
  return "Sin acceso";
}

function buildTaskAccess(userContext, permissions = []) {
  const permissionFlags = buildTaskPermissions(permissions);
  const scopes = {
    read: resolveScope(permissionFlags, "read"),
    history: resolveScope(permissionFlags, "history"),
    create: resolveScope(permissionFlags, "create"),
    update: resolveScope(permissionFlags, "update"),
    assign: resolveScope(permissionFlags, "assign"),
    delete: resolveScope(permissionFlags, "delete"),
    comment: resolveScope(permissionFlags, "comment"),
  };
  const views = buildAvailableViews(scopes);
  const actorProfile = getTaskPermissionProfileForUser(
    {
      id_usuario: userContext?.id,
      area: userContext?.areaId
        ? { id_area: userContext.areaId, nombre: userContext.areaName }
        : null,
      areas: userContext?.areas || [],
      roleNames: userContext?.roleNames || [],
      permissionNames: userContext?.permissionNames || permissions,
    },
    permissions,
  );
  const profileId = resolveProfile(scopes);
  const profileLabel = actorProfile.taskProfile === "content_manager"
    ? "Encargado de Contenido"
    : profileLabelFromId(profileId);

  return {
    permissionFlags,
    scopes,
    profileId,
    profileLabel,
    views,
    defaultView: views[0]?.id ?? null,
    actorProfile,
    capabilities: {
      canAccessModule: views.length > 0 || scopes.create !== "none",
      canCreateTask: scopes.create !== "none",
      canEditTask: scopes.update === "any" || scopes.update === "area",
      canArchiveTask: scopes.update === "any" || scopes.update === "area",
      canUpdateOwnAssignmentStatus:
        scopes.update === "any" || scopes.update === "area" || scopes.update === "mine",
      canDeleteTask: scopes.delete !== "none",
      canDeleteOnlyUnassigned: true,
      canAssignUsers: scopes.assign !== "none",
      canReadHistory: scopes.history !== "none",
      canCommentTasks: scopes.comment !== "none",
      canFilterByStatus: true,
      canFilterByPriority: true,
      canFilterByDate: scopes.read === "any" || scopes.read === "area",
      canFilterByCreator: scopes.read === "any" || scopes.read === "area",
      canFilterByAssignee: scopes.read === "any" || scopes.read === "area",
    },
    context: {
      currentUserId: userContext?.id ?? null,
      currentUserAreaId: userContext?.areaId ?? null,
      currentUserAreaName: userContext?.areaName ?? "",
      currentUserAreaIds: userContext?.areaIds || [],
      currentUserAreas: userContext?.areas || [],
      currentUserName: userContext?.fullName ?? "",
    },
  };
}

function normalizeUser(user) {
  if (!user) return null;

  const areas = getUserAreas(user);
  const primaryArea = areas[0]
    || (user.area
      ? {
          id_area: user.area.id_area,
          nombre: user.area.nombre ?? "",
          clave: user.area.clave ?? "",
        }
      : null);

  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre ?? "",
    apellido: user.apellido ?? "",
    email: user.email ?? "",
    area: primaryArea
      ? {
          id_area: primaryArea.id_area,
          nombre: primaryArea.nombre ?? "",
        }
      : null,
    areaId: primaryArea?.id_area ?? null,
    areaName: primaryArea?.nombre ?? "",
    areaIds: areas.map((area) => Number(area.id_area)),
    areas: areas.map((area) => ({
      id_area: area.id_area,
      nombre: area.nombre ?? "",
      clave: area.clave ?? "",
    })),
  };
}

function normalizeAssignment(assignment, currentUserId) {
  if (!assignment) return null;

  return {
    id_asignacion: assignment.id_asignacion,
    estado: assignment.estado,
    fecha_asignacion: assignment.fecha_asignacion,
    completed_at: assignment.completed_at,
    nota_final: assignment.nota_final,
    user: normalizeUser(assignment.user),
    asignado_por: normalizeUser(assignment.asignado_por),
    isCurrentUserAssignment: assignment.user?.id_usuario === currentUserId,
  };
}

function normalizeComment(comment) {
  if (!comment) return null;

  return {
    id_comentario: comment.id_comentario,
    tipo: comment.tipo ?? "general",
    comentario: comment.comentario,
    createdAt: comment.createdAt,
    author: normalizeUser(comment.author),
    assignment_id: comment.assignment?.id_asignacion ?? null,
    assignment_user: normalizeUser(comment.assignment?.user),
    task_id: comment.task?.id_tarea ?? null,
  };
}

function normalizeHistoryItem(item) {
  if (!item) return null;

  return {
    id_historial: item.id_historial,
    entity_type: item.entity_type,
    action: item.action,
    from_status: item.from_status,
    to_status: item.to_status,
    comentario: item.comentario,
    metadata: item.metadata ?? null,
    createdAt: item.createdAt,
    actor: normalizeUser(item.actor),
    assignment_id: item.assignment?.id_asignacion ?? null,
    task_id: item.task?.id_tarea ?? null,
  };
}

function computeGlobalTaskStatusFromAssignments(assignments = []) {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return "pendiente";
  }

  const statuses = assignments.map((assignment) => assignment.estado);
  if (statuses.every((status) => status === "completada")) {
    return "completada";
  }
  if (statuses.some((status) => status === "en_progreso" || status === "completada")) {
    return "en_progreso";
  }

  return "pendiente";
}

async function syncTaskGlobalStatus(taskOrId, assignmentRepository) {
  const taskRepository = AppDataSource.getRepository(Task);
  const taskId = typeof taskOrId === "object" ? taskOrId?.id_tarea : Number(taskOrId);
  if (!Number.isInteger(taskId) || taskId <= 0) return null;

  const task = await taskRepository.findOne({ where: { id_tarea: taskId } });
  if (!task || task.estado === "archivada") {
    return task?.estado ?? null;
  }

  const assignments = await assignmentRepository.find({
    where: { task: { id_tarea: taskId } },
  });

  const nextStatus = computeGlobalTaskStatusFromAssignments(assignments);
  if (task.estado !== nextStatus) {
    task.estado = nextStatus;
    await taskRepository.save(task);
  }

  return task.estado;
}

async function createHistoryRecord(historyRepository, payload) {
  const history = historyRepository.create(payload);
  await historyRepository.save(history);
}

async function ensureAreaExists(areaId) {
  const parsedId = Number(areaId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) return null;

  return AppDataSource.getRepository(Area).findOne({
    where: { id_area: parsedId },
  });
}

function isTaskCreatedBy(task, userId) {
  return task?.creado_por?.id_usuario === userId;
}

function isTaskAssignedToUser(task, userId) {
  return (task?.assignments || []).some((assignment) => assignment.user?.id_usuario === userId);
}

function isTaskAccessibleAsOwnerOrAssignee(task, access) {
  return isTaskCreatedBy(task, access.context.currentUserId)
    || isTaskAssignedToUser(task, access.context.currentUserId);
}

function isTaskInActorAreas(task, access) {
  const actorAreaIds = new Set((access.context.currentUserAreaIds || []).map((id) => Number(id)));
  return actorAreaIds.has(Number(task?.area?.id_area));
}

function canReadTask(task, access) {
  if (access.scopes.read === "any") {
    return true;
  }

  if (access.scopes.read === "mine") {
    return isTaskAssignedToUser(task, access.context.currentUserId);
  }

  if (access.scopes.read === "area") {
    return isTaskInActorAreas(task, access);
  }

  if (access.scopes.create === "area") {
    return isTaskInActorAreas(task, access);
  }

  if (access.scopes.create !== "none") {
    return isTaskAccessibleAsOwnerOrAssignee(task, access);
  }

  return false;
}

function canEditTask(task, access) {
  if (access.scopes.update === "any") {
    return true;
  }

  if (access.scopes.update === "area") {
    return isTaskInActorAreas(task, access);
  }

  return false;
}

function canDeleteTaskRecord(task, access) {
  if (access.scopes.delete === "any") {
    return true;
  }

  if (access.scopes.delete === "area") {
    return isTaskInActorAreas(task, access);
  }

  if (access.scopes.delete === "mine") {
    return isTaskAssignedToUser(task, access.context.currentUserId);
  }

  return false;
}

function canReadTaskHistory(task, access) {
  if (access.scopes.history === "any") {
    return true;
  }

  if (access.scopes.history === "mine") {
    return isTaskAssignedToUser(task, access.context.currentUserId);
  }

  if (access.scopes.history === "area") {
    return isTaskInActorAreas(task, access);
  }

  if (access.scopes.create === "area") {
    return isTaskInActorAreas(task, access);
  }

  if (access.scopes.create !== "none") {
    return isTaskAccessibleAsOwnerOrAssignee(task, access);
  }

  return false;
}

function canViewScopedAssignmentRecord(assignment, task, access) {
  if (!assignment) {
    return true;
  }

  if (access.scopes.read === "any" || access.scopes.comment === "any" || access.scopes.history === "any") {
    return true;
  }

  if (access.scopes.read === "area" || access.scopes.comment === "area" || access.scopes.history === "area") {
    return isTaskInActorAreas(task, access);
  }

  if (isTaskCreatedBy(task, access.context.currentUserId)) {
    return true;
  }

  return assignment.user?.id_usuario === access.context.currentUserId;
}

function canViewCommentRecord(comment, task, access) {
  if (!comment) {
    return false;
  }

  if (comment.tipo === "general") {
    if (access.scopes.read === "any" || access.scopes.comment === "any") {
      return true;
    }

    if (access.scopes.comment === "area" || access.scopes.read === "area") {
      return isTaskInActorAreas(task, access);
    }

    return isTaskCreatedBy(task, access.context.currentUserId)
      || isTaskAssignedToUser(task, access.context.currentUserId);
  }

  return canViewScopedAssignmentRecord(comment.assignment, task, access);
}

function canViewHistoryRecord(item, task, access) {
  if (!item?.assignment) {
    return true;
  }

  return canViewScopedAssignmentRecord(item.assignment, task, access);
}

function canCommentOnTask(task, access, assignment = null, commentType = "general") {
  if (access.scopes.comment === "none") {
    return false;
  }

  if (access.scopes.comment === "any") {
    return true;
  }

  if (commentType === "general") {
    if (access.scopes.comment === "area") {
      return isTaskInActorAreas(task, access);
    }

    return isTaskCreatedBy(task, access.context.currentUserId)
      || isTaskAssignedToUser(task, access.context.currentUserId);
  }

  if (!assignment) {
    return false;
  }

  return isTaskCreatedBy(task, access.context.currentUserId)
    || assignment.user?.id_usuario === access.context.currentUserId;
}

function sanitizeTaskForAccess(task, access) {
  if (!task) return null;

  const isMineOnly = access.scopes.read === "mine" && access.scopes.create === "none";
  if (!isMineOnly) {
    return task;
  }

  const visibleAssignments = (task.assignments || []).filter(
    (assignment) => assignment.user?.id_usuario === access.context.currentUserId,
  );
  const visibleAssignmentIds = new Set(visibleAssignments.map((assignment) => assignment.id_asignacion));

  return {
    ...task,
    assignments: visibleAssignments,
    comments: (task.comments || []).filter((comment) => {
      if (comment.tipo === "assignment" && isMineOnly) {
        return visibleAssignmentIds.has(comment.assignment?.id_asignacion);
      }

      return canViewCommentRecord(comment, task, access);
    }),
    history: (task.history || []).filter((item) => {
      if (item.assignment && isMineOnly) {
        return visibleAssignmentIds.has(item.assignment?.id_asignacion);
      }

      return canViewHistoryRecord(item, task, access);
    }),
  };
}

function mapTask(task, access) {
  if (!task) return null;

  const safeTask = sanitizeTaskForAccess(task, access);
  const currentAssignment = (safeTask.assignments || []).find(
    (assignment) => assignment.user?.id_usuario === access.context.currentUserId,
  );

  return {
    id_tarea: safeTask.id_tarea,
    titulo: safeTask.titulo,
    descripcion: safeTask.descripcion,
    prioridad: safeTask.prioridad,
    estado: safeTask.estado,
    fecha_limite: safeTask.fecha_limite,
    createdAt: safeTask.createdAt,
    updatedAt: safeTask.updatedAt,
    area: safeTask.area
      ? {
          id_area: safeTask.area.id_area,
          nombre: safeTask.area.nombre ?? "",
        }
      : null,
    creado_por: normalizeUser(safeTask.creado_por),
    assignments: (safeTask.assignments || []).map((assignment) =>
      normalizeAssignment(assignment, access.context.currentUserId),
    ),
    current_user_assignment_id: currentAssignment?.id_asignacion ?? null,
    comments: (safeTask.comments || []).map(normalizeComment),
    history: (safeTask.history || []).map(normalizeHistoryItem),
  };
}

async function loadTaskAggregate(taskId) {
  const taskRepository = AppDataSource.getRepository(Task);
  const task = await taskRepository.findOne({
    where: { id_tarea: Number(taskId) },
    relations: {
      area: true,
      creado_por: {
        area: true,
        UserArea: { area: true },
      },
      assignments: {
        user: {
          area: true,
          UserArea: { area: true },
        },
        asignado_por: {
          area: true,
          UserArea: { area: true },
        },
      },
      comments: {
        author: {
          area: true,
          UserArea: { area: true },
        },
        assignment: {
          user: {
            area: true,
            UserArea: { area: true },
          },
        },
        task: true,
      },
      history: {
        actor: {
          area: true,
          UserArea: { area: true },
        },
        assignment: {
          user: {
            area: true,
            UserArea: { area: true },
          },
        },
        task: true,
      },
    },
  });

  if (!task) return null;

  task.assignments = [...(task.assignments || [])].sort((left, right) =>
    (left.user?.nombre || "").localeCompare(right.user?.nombre || ""),
  );
  task.comments = [...(task.comments || [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  task.history = [...(task.history || [])].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return task;
}

async function getAssignableUsers(access) {
  if (!access.capabilities.canAssignUsers) {
    return [];
  }

  const userRepository = AppDataSource.getRepository(User);
  const users = await userRepository.find({
    where: { activo: true },
    relations: {
      area: true,
      UserArea: { area: true },
      UserRole: {
        role: {
          RolePermission: {
            permission: true,
          },
        },
      },
    },
    order: { nombre: "ASC", apellido: "ASC" },
  });

  return users
    .map((user) => {
      const profile = getTaskPermissionProfileForUser(user);
      if (access.scopes.assign === "area") {
        const validation = canAreaScopedActorAssignTarget(access.actorProfile, profile, user);
        if (!validation.allowed) {
          return null;
        }
      }

      const normalizedUser = normalizeUser(user);
      return {
        id: user.id_usuario,
        nombre: user.nombre ?? "",
        apellido: user.apellido ?? "",
        fullName: [user.nombre, user.apellido].filter(Boolean).join(" ").trim(),
        email: user.email ?? "",
        areaId: normalizedUser.areaId,
        areaName: normalizedUser.areaName,
        areaIds: normalizedUser.areaIds,
        areas: normalizedUser.areas,
        taskProfile: profile.taskProfile,
        assignmentScopeLabel: profile.assignmentScopeLabel,
      };
    })
    .filter(Boolean);
}

async function getAreaOptions(access) {
  if (access.scopes.create === "none" && access.scopes.assign === "none") {
    return [];
  }

  if (access.scopes.create === "area" || access.scopes.assign === "area") {
    return (access.context.currentUserAreas || []).map((area) => ({
      id: area.id_area,
      name: area.nombre ?? "",
    }));
  }

  const areas = await AppDataSource.getRepository(Area).find({
    order: { nombre: "ASC" },
  });

  return areas.map((area) => ({
    id: area.id_area,
    name: area.nombre ?? "",
  }));
}

async function ensureUsersExist(userIds = []) {
  const ids = Array.from(new Set((userIds || []).map((id) => Number(id)).filter(Boolean)));
  if (!ids.length) return [];

  return AppDataSource.getRepository(User).find({
    where: { id_usuario: In(ids), activo: true },
    relations: {
      area: true,
      UserArea: { area: true },
      UserRole: {
        role: {
          RolePermission: {
            permission: true,
          },
        },
      },
    },
  });
}

async function validateAssigneesForScope(userIds, access) {
  const users = await ensureUsersExist(userIds);
  const requestedIds = Array.from(new Set((userIds || []).map((id) => Number(id)).filter(Boolean)));

  if (users.length !== requestedIds.length) {
    return [null, "Hay usuarios asignados que no existen o están inactivos."];
  }

  if (access.scopes.assign === "area") {
    const invalidUser = users.find((user) => {
      const validation = canAreaScopedActorAssignTarget(
        access.actorProfile,
        getTaskPermissionProfileForUser(user),
        user,
      );
      return !validation.allowed;
    });
    if (invalidUser) {
      const validation = canAreaScopedActorAssignTarget(
        access.actorProfile,
        getTaskPermissionProfileForUser(invalidUser),
        invalidUser,
      );

      if (validation.reason === "higher_hierarchy") {
        return [null, "No puedes asignar tareas a usuarios con mayor jerarquía."];
      }

      if (validation.reason === "outside_scope") {
        return [null, "Solo puedes asignar usuarios de tus áreas o al Encargado de Contenido."];
      }

      return [null, "No puedes asignar tareas a ese usuario."];
    }
  }

  return [users, null];
}

async function createAssignmentsForTask({ task, assigneeIds, actorUserId, access }) {
  const assignmentRepository = AppDataSource.getRepository(TaskAssignment);
  const historyRepository = AppDataSource.getRepository(TaskHistory);

  const ids = Array.from(new Set((assigneeIds || []).map((id) => Number(id)).filter(Boolean)));
  if (!ids.length) return [[], null];

  const [users, errorMessage] = await validateAssigneesForScope(ids, access);
  if (errorMessage) {
    return [null, errorMessage];
  }

  const assignments = [];
  for (const user of users) {
    const assignment = assignmentRepository.create({
      task: { id_tarea: task.id_tarea },
      user: { id_usuario: user.id_usuario },
      asignado_por: { id_usuario: actorUserId },
      estado: "pendiente",
    });

    const savedAssignment = await assignmentRepository.save(assignment);
    assignments.push(savedAssignment);

    await createHistoryRecord(historyRepository, {
      task: { id_tarea: task.id_tarea },
      assignment: { id_asignacion: savedAssignment.id_asignacion },
      actor: { id_usuario: actorUserId },
      entity_type: "assignment",
      action: TASK_HISTORY_ACTIONS.ASSIGNMENT_ADDED,
      metadata: { assignedUserId: user.id_usuario },
    });
  }

  await syncTaskGlobalStatus(task.id_tarea, assignmentRepository);
  return [assignments, null];
}

async function replaceAssignmentsForTask({ task, nextAssigneeIds, actorUserId, access }) {
  const assignmentRepository = AppDataSource.getRepository(TaskAssignment);
  const historyRepository = AppDataSource.getRepository(TaskHistory);
  const currentAssignments = await assignmentRepository.find({
    where: { task: { id_tarea: task.id_tarea } },
    relations: { user: true },
  });

  const currentIds = new Set(currentAssignments.map((assignment) => assignment.user?.id_usuario));
  const nextIds = new Set((nextAssigneeIds || []).map((id) => Number(id)).filter(Boolean));
  const addedIds = [...nextIds].filter((id) => !currentIds.has(id));
  const removedAssignments = currentAssignments.filter(
    (assignment) => !nextIds.has(assignment.user?.id_usuario),
  );

  if (addedIds.length) {
    const [, addError] = await createAssignmentsForTask({
      task,
      assigneeIds: addedIds,
      actorUserId,
      access,
    });

    if (addError) return addError;
  }

  for (const assignment of removedAssignments) {
    await createHistoryRecord(historyRepository, {
      task: { id_tarea: task.id_tarea },
      assignment: { id_asignacion: assignment.id_asignacion },
      actor: { id_usuario: actorUserId },
      entity_type: "assignment",
      action: TASK_HISTORY_ACTIONS.ASSIGNMENT_REMOVED,
      metadata: { removedUserId: assignment.user?.id_usuario ?? null },
    });

    await assignmentRepository.remove(assignment);
  }

  await syncTaskGlobalStatus(task.id_tarea, assignmentRepository);
  return null;
}

function buildTaskUpdateMetadata(task, body) {
  const metadata = {};

  if (body.titulo !== undefined && body.titulo !== task.titulo) {
    metadata.titulo = { from: task.titulo, to: body.titulo };
  }
  if (body.descripcion !== undefined && body.descripcion !== task.descripcion) {
    metadata.descripcion = { from: task.descripcion, to: body.descripcion };
  }
  if (body.prioridad !== undefined && body.prioridad !== task.prioridad) {
    metadata.prioridad = { from: task.prioridad, to: body.prioridad };
  }
  if (
    body.fecha_limite !== undefined
    && new Date(body.fecha_limite).getTime() !== new Date(task.fecha_limite).getTime()
  ) {
    metadata.fecha_limite = { from: task.fecha_limite, to: body.fecha_limite };
  }
  if (body.area_id !== undefined && Number(body.area_id) !== task.area?.id_area) {
    metadata.area_id = { from: task.area?.id_area ?? null, to: Number(body.area_id) };
  }

  return metadata;
}

function applyTaskListScope(qb, view, access) {
  const userId = access.context.currentUserId;

  if (view === TASK_VIEW_IDS.ALL) {
    if (access.scopes.read !== "any" && access.scopes.read !== "area") {
      return [false, "No autorizado"];
    }

    qb.andWhere("task.estado != :archivedStatus", { archivedStatus: "archivada" });
    if (access.scopes.read === "area") {
      qb.andWhere("taskArea.id_area IN (:...taskAreaIds)", {
        taskAreaIds: access.context.currentUserAreaIds,
      });
    }
    return [true, null];
  }

  if (view === TASK_VIEW_IDS.ASSIGNED) {
    qb.andWhere("assignmentUser.id_usuario = :assignedUserId", { assignedUserId: userId });
    qb.andWhere("task.estado != :archivedStatus", { archivedStatus: "archivada" });
    return [true, null];
  }

  if (view === TASK_VIEW_IDS.CREATED) {
    if (access.scopes.create === "none") {
      return [false, "No autorizado"];
    }

    qb.andWhere("creator.id_usuario = :creatorId", { creatorId: userId });
    qb.andWhere("task.estado != :archivedStatus", { archivedStatus: "archivada" });
    return [true, null];
  }

  if (view === TASK_VIEW_IDS.ARCHIVED) {
    qb.andWhere("task.estado = :archivedStatus", { archivedStatus: "archivada" });

    if (access.scopes.read === "any") {
      return [true, null];
    }

    if (access.scopes.read === "area" || access.scopes.create === "area") {
      qb.andWhere("taskArea.id_area IN (:...archivedAreaIds)", {
        archivedAreaIds: access.context.currentUserAreaIds,
      });
      return [true, null];
    }

    if (access.scopes.create !== "none") {
      qb.andWhere("(creator.id_usuario = :ownerId OR assignmentUser.id_usuario = :ownerId)", {
        ownerId: userId,
      });
      return [true, null];
    }

    qb.andWhere("assignmentUser.id_usuario = :assignedArchivedUserId", {
      assignedArchivedUserId: userId,
    });
    return [true, null];
  }

  return [false, "Vista no soportada"];
}

export async function getTaskModuleAccessService(user, permissions = []) {
  try {
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) {
      return [null, "Usuario inválido"];
    }

    const access = buildTaskAccess(userContext, permissions);
    const [areas, assignableUsers] = await Promise.all([
      getAreaOptions(access),
      getAssignableUsers(access),
    ]);

    return [
      {
        profile: access.profileId,
        profileLabel: access.profileLabel,
        scopes: access.scopes,
        capabilities: access.capabilities,
        views: access.views,
        defaultView: access.defaultView,
        context: access.context,
        policies: {
          deleteRequiresNoAssignees: true,
          assignmentStatuses: TASK_ASSIGNMENT_STATUS,
        },
        areas,
        assignableUsers,
      },
      null,
    ];
  } catch (error) {
    console.error("Error obteniendo acceso del módulo de tareas:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function createTaskService(body, user, permissions = []) {
  try {
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];

    const access = buildTaskAccess(userContext, permissions);
    if (!access.capabilities.canCreateTask) {
      return [null, "No tienes permisos para crear tareas"];
    }

    let targetAreaId = Number(body.area_id);
    if (access.scopes.create === "area") {
      if (!Number.isInteger(targetAreaId) || targetAreaId <= 0) {
        targetAreaId = access.context.currentUserAreaIds[0] ?? access.context.currentUserAreaId;
      }

      if (!access.context.currentUserAreaIds.includes(Number(targetAreaId))) {
        return [null, "Solo puedes crear tareas dentro de tus áreas asignadas."];
      }
    }
    if (!Number.isInteger(targetAreaId) || targetAreaId <= 0) {
      targetAreaId = access.context.currentUserAreaId;
    }

    const area = await ensureAreaExists(targetAreaId);
    if (!area) {
      return [null, "El área de la tarea no existe"];
    }

    const taskRepository = AppDataSource.getRepository(Task);
    const historyRepository = AppDataSource.getRepository(TaskHistory);
    const task = taskRepository.create({
      titulo: body.titulo,
      descripcion: body.descripcion,
      prioridad: body.prioridad,
      fecha_limite: body.fecha_limite,
      creado_por: toUserRef(userContext.id),
      area: toAreaRef(area.id_area),
      estado: "pendiente",
    });

    await taskRepository.save(task);
    await createHistoryRecord(historyRepository, {
      task: { id_tarea: task.id_tarea },
      actor: { id_usuario: userContext.id },
      entity_type: "task",
      action: TASK_HISTORY_ACTIONS.CREATED,
      metadata: {
        titulo: task.titulo,
        areaId: area.id_area,
      },
    });

    const [, assignmentError] = await createAssignmentsForTask({
      task,
      assigneeIds: body.usuarios_asignados || [],
      actorUserId: userContext.id,
      access,
    });
    if (assignmentError) {
      return [null, assignmentError];
    }

    const createdTask = await loadTaskAggregate(task.id_tarea);
    return [mapTask(createdTask, access), null];
  } catch (error) {
    console.error("Error al crear tarea:", error);
    return [null, "Error interno al crear tarea"];
  }
}

export async function getTaskService(query, user, permissions = []) {
  try {
    const taskId = getTaskId(query);
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(taskId) || taskId <= 0) return [null, "Id de tarea inválido"];

    const access = buildTaskAccess(userContext, permissions);
    const task = await loadTaskAggregate(taskId);
    if (!task) return [null, "Tarea no encontrada"];
    if (!canReadTask(task, access)) return [null, "No autorizado"];

    return [mapTask(task, access), null];
  } catch (error) {
    console.error("Error obteniendo la tarea:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getTasksService(query, user, permissions = []) {
  try {
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];

    const access = buildTaskAccess(userContext, permissions);
    const requestedView = query?.view ?? access.defaultView;
    if (!Object.values(TASK_VIEW_IDS).includes(requestedView)) {
      return [null, "Vista no soportada"];
    }
    if (!access.views.some((view) => view.id === requestedView)) {
      return [null, "No autorizado"];
    }

    const taskRepository = AppDataSource.getRepository(Task);
    const qb = taskRepository
      .createQueryBuilder("task")
      .leftJoinAndSelect("task.creado_por", "creator")
      .leftJoinAndSelect("creator.area", "creatorArea")
      .leftJoinAndSelect("creator.UserArea", "creatorUserArea")
      .leftJoinAndSelect("creatorUserArea.area", "creatorUserAreaArea")
      .leftJoinAndSelect("task.area", "taskArea")
      .leftJoinAndSelect("task.assignments", "assignment")
      .leftJoinAndSelect("assignment.user", "assignmentUser")
      .leftJoinAndSelect("assignmentUser.area", "assignmentUserArea")
      .leftJoinAndSelect("assignmentUser.UserArea", "assignmentUserAreas")
      .leftJoinAndSelect("assignmentUserAreas.area", "assignmentUserAreasArea")
      .leftJoinAndSelect("assignment.asignado_por", "assignedBy")
      .leftJoinAndSelect("assignedBy.area", "assignedByArea")
      .leftJoinAndSelect("assignedBy.UserArea", "assignedByUserAreas")
      .leftJoinAndSelect("assignedByUserAreas.area", "assignedByUserAreasArea")
      .distinct(true);

    const [isAllowed, scopeError] = applyTaskListScope(qb, requestedView, access);
    if (!isAllowed) return [null, scopeError];

    if (requestedView !== TASK_VIEW_IDS.ARCHIVED && query?.estado && query.estado !== "archivada") {
      qb.andWhere("task.estado = :estado", { estado: query.estado });
    }
    if (requestedView === TASK_VIEW_IDS.ARCHIVED) {
      qb.andWhere("task.estado = :estadoArchivado", { estadoArchivado: "archivada" });
    }
    if (query?.prioridad) {
      qb.andWhere("task.prioridad = :prioridad", { prioridad: query.prioridad });
    }
    if (query?.dueFrom) {
      qb.andWhere("task.fecha_limite >= :dueFrom", { dueFrom: query.dueFrom });
    }
    if (query?.dueTo) {
      qb.andWhere("task.fecha_limite <= :dueTo", { dueTo: query.dueTo });
    }
    if (query?.creatorId && access.capabilities.canFilterByCreator) {
      qb.andWhere("creator.id_usuario = :creatorId", { creatorId: Number(query.creatorId) });
    }
    if (query?.assigneeId && access.capabilities.canFilterByAssignee) {
      qb.andWhere("assignmentUser.id_usuario = :assigneeId", { assigneeId: Number(query.assigneeId) });
    }

    qb.orderBy("task.fecha_limite", "ASC").addOrderBy("task.createdAt", "DESC");

    const tasks = await qb.getMany();
    return [tasks.map((task) => mapTask(task, access)), null];
  } catch (error) {
    console.error("Error al obtener las tareas:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateTaskService(query, body, user, permissions = []) {
  try {
    const taskId = getTaskId(query);
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(taskId) || taskId <= 0) return [null, "Id de tarea inválido"];

    const access = buildTaskAccess(userContext, permissions);
    const task = await loadTaskAggregate(taskId);
    if (!task) return [null, "Tarea no encontrada"];
    if (!canEditTask(task, access)) return [null, "No autorizado para modificar esta tarea"];
    if (task.estado === "archivada") {
      return [null, "No se puede editar una tarea archivada"];
    }

    const taskRepository = AppDataSource.getRepository(Task);
    const historyRepository = AppDataSource.getRepository(TaskHistory);
    const metadata = buildTaskUpdateMetadata(task, body);

    if (body.area_id !== undefined) {
      const nextArea = await ensureAreaExists(body.area_id);
      if (!nextArea) {
        return [null, "El área de la tarea no existe"];
      }
      if (
        access.scopes.update === "area"
        && !access.context.currentUserAreaIds.includes(Number(nextArea.id_area))
      ) {
        return [null, "Solo puedes mover tareas dentro de tus áreas asignadas."];
      }
      task.area = toAreaRef(nextArea.id_area);
    }

    if (body.titulo !== undefined) task.titulo = body.titulo;
    if (body.descripcion !== undefined) task.descripcion = body.descripcion;
    if (body.prioridad !== undefined) task.prioridad = body.prioridad;
    if (body.fecha_limite !== undefined) task.fecha_limite = body.fecha_limite;

    await taskRepository.save(task);

    if (body.usuarios_asignados !== undefined) {
      if (access.scopes.assign === "none") {
        return [null, "No tienes permisos para reasignar usuarios"];
      }

      const assignmentError = await replaceAssignmentsForTask({
        task,
        nextAssigneeIds: body.usuarios_asignados,
        actorUserId: userContext.id,
        access,
      });

      if (assignmentError) return [null, assignmentError];
    }

    if (Object.keys(metadata).length > 0) {
      await createHistoryRecord(historyRepository, {
        task: { id_tarea: task.id_tarea },
        actor: { id_usuario: userContext.id },
        entity_type: "task",
        action: TASK_HISTORY_ACTIONS.UPDATED,
        metadata,
      });
    }

    const updatedTask = await loadTaskAggregate(task.id_tarea);
    return [mapTask(updatedTask, access), null];
  } catch (error) {
    console.error("Error al modificar una tarea:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function archiveTaskService(query, user, permissions = []) {
  try {
    const taskId = getTaskId(query);
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(taskId) || taskId <= 0) return [null, "Id de tarea inválido"];

    const access = buildTaskAccess(userContext, permissions);
    const task = await loadTaskAggregate(taskId);
    if (!task) return [null, "Tarea no encontrada"];
    if (!canEditTask(task, access)) return [null, "No autorizado para archivar esta tarea"];
    if (task.estado === "archivada") return [null, "La tarea ya está archivada"];
    if (task.estado !== "completada") {
      return [null, "Solo se puede archivar una tarea completada"];
    }

    const taskRepository = AppDataSource.getRepository(Task);
    const historyRepository = AppDataSource.getRepository(TaskHistory);
    task.estado = "archivada";
    await taskRepository.save(task);

    await createHistoryRecord(historyRepository, {
      task: { id_tarea: task.id_tarea },
      actor: { id_usuario: userContext.id },
      entity_type: "task",
      action: TASK_HISTORY_ACTIONS.ARCHIVED,
      from_status: "completada",
      to_status: "archivada",
    });

    const archivedTask = await loadTaskAggregate(task.id_tarea);
    return [mapTask(archivedTask, access), null];
  } catch (error) {
    console.error("Error archivando tarea:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteTaskService(query, user, permissions = []) {
  try {
    const taskId = getTaskId(query);
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(taskId) || taskId <= 0) return [null, "Id de tarea inválido"];

    const access = buildTaskAccess(userContext, permissions);
    const task = await loadTaskAggregate(taskId);
    if (!task) return [null, "No se encontró la tarea"];
    if (!canDeleteTaskRecord(task, access)) {
      return [null, "No autorizado para eliminar esta tarea"];
    }
    if ((task.assignments || []).length > 0) {
      return [null, "No se puede eliminar una tarea con usuarios asignados"];
    }

    await AppDataSource.getRepository(Task).remove(task);
    return [task, null];
  } catch (error) {
    console.error("Error al eliminar tarea:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateTaskAssignmentStatusService(query, body, user, permissions = []) {
  try {
    const assignmentId = getAssignmentId(query);
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return [null, "Asignación no encontrada"];
    }

    const access = buildTaskAccess(userContext, permissions);
    const assignmentRepository = AppDataSource.getRepository(TaskAssignment);
    const historyRepository = AppDataSource.getRepository(TaskHistory);
    const assignment = await assignmentRepository.findOne({
      where: { id_asignacion: assignmentId },
      relations: {
        user: {
          area: true,
          UserArea: { area: true },
        },
        asignado_por: {
          area: true,
          UserArea: { area: true },
        },
        task: {
          area: true,
          creado_por: {
            area: true,
            UserArea: { area: true },
          },
          assignments: {
            user: {
              area: true,
              UserArea: { area: true },
            },
            asignado_por: {
              area: true,
              UserArea: { area: true },
            },
          },
        },
      },
    });

    if (!assignment) return [null, "Asignación no encontrada"];
    if (assignment.task?.estado === "archivada") {
      return [null, "No se puede cambiar el estado de una tarea archivada"];
    }

    const canUpdate =
      access.scopes.update === "any"
      || (access.scopes.update === "area" && isTaskInActorAreas(assignment.task, access))
      || (access.scopes.update === "mine" && assignment.user?.id_usuario === access.context.currentUserId);

    if (!canUpdate) {
      return [null, "No autorizado para modificar esta asignación"];
    }

    const previousStatus = assignment.estado;
    assignment.estado = body.estado;
    assignment.completed_at = body.estado === "completada" ? new Date() : null;
    if (body.estado === "completada") {
      assignment.nota_final = body.comentario || assignment.nota_final || null;
    }

    await assignmentRepository.save(assignment);
    await syncTaskGlobalStatus(assignment.task.id_tarea, assignmentRepository);

    await createHistoryRecord(historyRepository, {
      task: { id_tarea: assignment.task.id_tarea },
      assignment: { id_asignacion: assignment.id_asignacion },
      actor: { id_usuario: userContext.id },
      entity_type: "assignment",
      action: TASK_HISTORY_ACTIONS.STATUS_CHANGED,
      from_status: previousStatus,
      to_status: body.estado,
      comentario: body.comentario || null,
    });

    const refreshedTask = await loadTaskAggregate(assignment.task.id_tarea);
    const updatedAssignment = refreshedTask.assignments.find(
      (item) => item.id_asignacion === assignment.id_asignacion,
    );

    return [
      {
        assignment: normalizeAssignment(updatedAssignment, access.context.currentUserId),
        task: mapTask(refreshedTask, access),
      },
      null,
    ];
  } catch (error) {
    console.error("Error actualizando estado de asignación:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function createTaskCommentService(body, user, permissions = []) {
  try {
    const taskId = Number(body?.taskId);
    const commentType = body?.tipo ?? "general";
    const assignmentId = body?.assignmentId ? Number(body.assignmentId) : null;
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(taskId) || taskId <= 0) return [null, "Tarea no encontrada"];

    const access = buildTaskAccess(userContext, permissions);
    const task = await loadTaskAggregate(taskId);
    if (!task) return [null, "Tarea no encontrada"];
    if (!canReadTask(task, access)) return [null, "No autorizado"];

    const assignment = assignmentId
      ? (task.assignments || []).find((item) => item.id_asignacion === assignmentId) ?? null
      : null;
    if (assignmentId && !assignment) {
      return [null, "La asignación indicada no pertenece a la tarea"];
    }
    if (commentType === "general" && assignmentId) {
      return [null, "Los comentarios generales no deben incluir assignmentId"];
    }
    if (commentType === "assignment" && !assignmentId) {
      return [null, "Los comentarios de asignación requieren assignmentId"];
    }
    if (!canCommentOnTask(task, access, assignment, commentType)) {
      return [null, "No autorizado para comentar esta tarea"];
    }

    const commentRepository = AppDataSource.getRepository(TaskComment);
    const comment = commentRepository.create({
      task: { id_tarea: task.id_tarea },
      tipo: commentType,
      assignment: assignment ? { id_asignacion: assignment.id_asignacion } : null,
      author: { id_usuario: userContext.id },
      comentario: body.comentario,
    });

    const savedComment = await commentRepository.save(comment);
    const createdComment = await commentRepository.findOne({
      where: { id_comentario: savedComment.id_comentario },
      relations: {
        author: {
          area: true,
          UserArea: { area: true },
        },
        assignment: {
          user: {
            area: true,
            UserArea: { area: true },
          },
        },
        task: true,
      },
    });

    return [normalizeComment(createdComment), null];
  } catch (error) {
    console.error("Error creando comentario de tarea:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getTaskCommentsService(query, user, permissions = []) {
  try {
    const taskId = Number(query?.taskId);
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(taskId) || taskId <= 0) return [null, "Tarea no encontrada"];

    const access = buildTaskAccess(userContext, permissions);
    const task = await loadTaskAggregate(taskId);
    if (!task) return [null, "Tarea no encontrada"];
    if (!canReadTask(task, access)) return [null, "No autorizado"];

    const safeTask = sanitizeTaskForAccess(task, access);
    return [((safeTask?.comments) || []).map(normalizeComment), null];
  } catch (error) {
    console.error("Error obteniendo comentarios de tareas:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getTaskHistoryService(query, user, permissions = []) {
  try {
    const taskId = Number(query?.taskId);
    const userId = Number(user?.id_usuario ?? user?.id ?? user?.sub);
    const userContext = await getUserContext(userId);
    if (!userContext) return [null, "Usuario inválido"];
    if (!Number.isInteger(taskId) || taskId <= 0) return [null, "Tarea no encontrada"];

    const access = buildTaskAccess(userContext, permissions);
    const task = await loadTaskAggregate(taskId);
    if (!task) return [null, "Tarea no encontrada"];
    if (!canReadTaskHistory(task, access)) return [null, "No autorizado"];

    const safeTask = sanitizeTaskForAccess(task, access);
    return [((safeTask?.history) || []).map(normalizeHistoryItem), null];
  } catch (error) {
    console.error("Error obteniendo historial de tareas:", error);
    return [null, "Error interno del servidor"];
  }
}

export const taskServiceInternals = {
  buildTaskAccess,
  canReadTask,
  canEditTask,
  canDeleteTaskRecord,
  canReadTaskHistory,
  applyTaskListScope,
  normalizeUser,
};
