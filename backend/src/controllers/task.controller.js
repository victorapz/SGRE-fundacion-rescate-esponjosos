"use strict";

import {
  taskAssignmentStatusBodyValidation,
  taskAssignmentStatusQueryValidation,
  taskCommentCreateValidation,
  taskCommentListValidation,
  taskCreateValidation,
  taskHistoryListValidation,
  taskListQueryValidation,
  taskQueryValidation,
  taskUpdateBodyValidation,
} from "../validations/task.validation.js";

import {
  archiveTaskService,
  createTaskCommentService,
  createTaskService,
  deleteTaskService,
  getTaskCommentsService,
  getTaskHistoryService,
  getTaskModuleAccessService,
  getTaskService,
  getTasksService,
  updateTaskAssignmentStatusService,
  updateTaskService,
} from "../services/task.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export async function getTaskModuleAccess(req, res) {
  try {
    const { user, permissions } = req;
    const [access, accessError] = await getTaskModuleAccessService(user, permissions);

    if (accessError) {
      const statusCode = accessError === "Usuario inválido" ? 401 : 500;
      return handleErrorClient(res, statusCode, "Error obteniendo acceso al módulo", accessError);
    }

    return handleSuccess(res, 200, "Acceso del módulo de tareas", access);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export const createTask = async (req, res) => {
  try {
    const { body, user, permissions } = req;
    const { error } = taskCreateValidation.validate(body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [task, taskError] = await createTaskService(body, user, permissions);
    if (taskError) {
      return handleErrorClient(res, 400, "Error creando la tarea", taskError);
    }

    return handleSuccess(res, 201, "Tarea creada correctamente", task);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
};

export async function getTask(req, res) {
  try {
    const { id } = req.query;
    const { user, permissions } = req;
    const { error } = taskQueryValidation.validate({ id });

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [task, taskError] = await getTaskService({ id }, user, permissions);
    if (taskError) {
      const statusCode = taskError === "Tarea no encontrada" ? 404 : 403;
      return handleErrorClient(res, statusCode, "Error obteniendo la tarea", taskError);
    }

    return handleSuccess(res, 200, "Tarea encontrada", task);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getTasks(req, res) {
  try {
    const { query, user, permissions } = req;
    const { error } = taskListQueryValidation.validate(query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [tasks, tasksError] = await getTasksService(query, user, permissions);
    if (tasksError) {
      const statusCode = tasksError === "No autorizado" ? 403 : 400;
      return handleErrorClient(res, statusCode, "Error obteniendo tareas", tasksError);
    }

    return handleSuccess(res, 200, "Tareas encontradas", tasks ?? []);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateTask(req, res) {
  try {
    const { id } = req.query;
    const { body, user, permissions } = req;
    const { error: queryError } = taskQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = taskUpdateBodyValidation.validate(body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        bodyError.message,
      );
    }

    const [task, taskError] = await updateTaskService({ id }, body, user, permissions);
    if (taskError) {
      const statusCode = taskError === "Tarea no encontrada"
        ? 404
        : taskError.includes("No autorizado")
          ? 403
          : 400;

      return handleErrorClient(res, statusCode, "Error modificando la tarea", taskError);
    }

    return handleSuccess(res, 200, "Tarea modificada correctamente", task);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function archiveTask(req, res) {
  try {
    const { id } = req.query;
    const { user, permissions } = req;
    const { error: queryError } = taskQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validaciÃ³n en la consulta",
        queryError.message,
      );
    }

    const [task, taskError] = await archiveTaskService({ id }, user, permissions);
    if (taskError) {
      const statusCode = taskError === "Tarea no encontrada"
        ? 404
        : taskError.includes("No autorizado")
          ? 403
          : 400;

      return handleErrorClient(res, statusCode, "Error archivando la tarea", taskError);
    }

    return handleSuccess(res, 200, "Tarea archivada correctamente", task);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteTask(req, res) {
  try {
    const { id } = req.query;
    const { user, permissions } = req;
    const { error: queryError } = taskQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    const [taskDeleted, taskError] = await deleteTaskService({ id }, user, permissions);
    if (taskError) {
      const statusCode = taskError === "No se encontró la tarea"
        ? 404
        : taskError.includes("No autorizado")
          ? 403
          : 400;

      return handleErrorClient(res, statusCode, "Error eliminando la tarea", taskError);
    }

    return handleSuccess(res, 200, "Tarea eliminada correctamente", taskDeleted);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateTaskAssignmentStatus(req, res) {
  try {
    const { query, body, user, permissions } = req;
    const { error: queryError } = taskAssignmentStatusQueryValidation.validate(query);

    if (queryError) {
      return handleErrorClient(res, 400, "Error de validación", queryError.message);
    }

    const { error: bodyError } = taskAssignmentStatusBodyValidation.validate(body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validación", bodyError.message);
    }

    const [result, statusError] = await updateTaskAssignmentStatusService(query, body, user, permissions);
    if (statusError) {
      const statusCode = statusError === "Asignación no encontrada"
        ? 404
        : statusError.includes("No autorizado")
          ? 403
          : 400;
      return handleErrorClient(res, statusCode, "Error actualizando estado de asignación", statusError);
    }

    return handleSuccess(res, 200, "Estado de asignación actualizado", result);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function createTaskComment(req, res) {
  try {
    const { body, user, permissions } = req;
    const { error } = taskCommentCreateValidation.validate(body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [comment, commentError] = await createTaskCommentService(body, user, permissions);
    if (commentError) {
      const statusCode = commentError === "Tarea no encontrada" ? 404 : 400;
      return handleErrorClient(res, statusCode, "Error creando comentario", commentError);
    }

    return handleSuccess(res, 201, "Comentario creado correctamente", comment);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getTaskComments(req, res) {
  try {
    const { query, user, permissions } = req;
    const { error } = taskCommentListValidation.validate(query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [comments, commentsError] = await getTaskCommentsService(query, user, permissions);
    if (commentsError) {
      const statusCode = commentsError === "Tarea no encontrada"
        ? 404
        : commentsError.includes("No autorizado")
          ? 403
          : 400;
      return handleErrorClient(res, statusCode, "Error obteniendo comentarios", commentsError);
    }

    return handleSuccess(res, 200, "Comentarios encontrados", comments ?? []);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getTaskHistory(req, res) {
  try {
    const { query, user, permissions } = req;
    const { error } = taskHistoryListValidation.validate(query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [historyItems, historyError] = await getTaskHistoryService(query, user, permissions);
    if (historyError) {
      const statusCode = historyError === "Tarea no encontrada"
        ? 404
        : historyError.includes("No autorizado")
          ? 403
          : 400;
      return handleErrorClient(res, statusCode, "Error obteniendo historial", historyError);
    }

    return handleSuccess(res, 200, "Historial de tareas", historyItems ?? []);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
