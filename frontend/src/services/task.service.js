import api from "../api/axios";

const TASK_BASE_PATH = "/task";

function toInputDate(dateValue) {
	if (typeof dateValue !== "string" && !(dateValue instanceof Date)) {
		return "";
	}

	const parsedDate = new Date(dateValue);
	if (Number.isNaN(parsedDate.getTime())) {
		if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
			return dateValue.slice(0, 10);
		}
		return "";
	}

	return parsedDate.toISOString().slice(0, 10);
}

function normalizeUser(item) {
	if (!item) {
		return null;
	}

	const rawAreas = Array.isArray(item.areas)
		? item.areas
		: item.area
			? [item.area]
			: [];
	const areas = rawAreas
		.map((area) => ({
			id_area: area?.id_area ?? area?.id ?? null,
			nombre: area?.nombre ?? area?.name ?? "",
			clave: area?.clave ?? "",
		}))
		.filter((area) => area.id_area);
	const primaryArea = areas[0] || null;

	return {
		id: item.id_usuario ?? item.id,
		nombre: item.nombre || "",
		apellido: item.apellido || "",
		email: item.email || "",
		areaId: primaryArea?.id_area ?? item.area?.id_area ?? item.areaId ?? null,
		areaName: primaryArea?.nombre ?? item.area?.nombre ?? item.areaName ?? "",
		areaIds: Array.isArray(item.areaIds)
			? item.areaIds.map((value) => Number(value)).filter((value) => Number.isInteger(value))
			: areas.map((area) => Number(area.id_area)),
		areas,
		fullName: item.fullName || [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
	};
}

function normalizeAssignment(item) {
	if (!item) {
		return null;
	}

	return {
		id: item.id_asignacion ?? item.id,
		status: item.estado || "pendiente",
		assignedAt: item.fecha_asignacion || "",
		completedAt: item.completed_at || "",
		completionNote: item.nota_final || "",
		user: normalizeUser(item.user),
		assignedBy: normalizeUser(item.asignado_por),
		isCurrentUserAssignment: Boolean(item.isCurrentUserAssignment),
	};
}

function normalizeComment(item) {
	if (!item) {
		return null;
	}

	return {
		id: item.id_comentario ?? item.id,
		type: item.tipo || "general",
		text: item.comentario || "",
		createdAt: item.createdAt || "",
		author: normalizeUser(item.author),
		taskId: item.task_id ?? item.task?.id_tarea ?? null,
		taskTitle: item.task?.titulo || "",
		assignmentId: item.assignment_id ?? null,
		assignmentUser: normalizeUser(item.assignment_user),
	};
}

function normalizeHistoryItem(item) {
	if (!item) {
		return null;
	}

	return {
		id: item.id_historial ?? item.id,
		entityType: item.entity_type || "task",
		action: item.action || "",
		fromStatus: item.from_status || "",
		toStatus: item.to_status || "",
		comment: item.comentario || "",
		metadata: item.metadata || null,
		createdAt: item.createdAt || "",
		actor: normalizeUser(item.actor),
		taskId: item.task_id ?? item.task?.id_tarea ?? null,
		taskTitle: item.task?.titulo || "",
		assignmentId: item.assignment_id ?? null,
	};
}

function normalizeTask(item) {
	if (!item) {
		return null;
	}

	return {
		id: item.id_tarea ?? item.id,
		title: item.titulo || "",
		description: item.descripcion || "",
		status: item.estado || "pendiente",
		priority: item.prioridad || "media",
		dueDate: toInputDate(item.fecha_limite),
		createdAt: item.createdAt || "",
		updatedAt: item.updatedAt || "",
		area: item.area
			? {
					id: item.area.id_area,
					name: item.area.nombre || "",
				}
			: null,
		creator: normalizeUser(item.creado_por),
		assignments: Array.isArray(item.assignments)
			? item.assignments.map(normalizeAssignment).filter(Boolean)
			: [],
		currentUserAssignmentId: item.current_user_assignment_id ?? null,
		comments: Array.isArray(item.comments)
			? item.comments.map(normalizeComment).filter(Boolean)
			: [],
		history: Array.isArray(item.history)
			? item.history.map(normalizeHistoryItem).filter(Boolean)
			: [],
		counts: {
			assignments: item.counts?.assignments ?? 0,
			comments: item.counts?.comments ?? 0,
			history: item.counts?.history ?? 0,
		},
	};
}

function extractItems(response, normalizer) {
	const data = response?.data?.data;
	if (!Array.isArray(data)) {
		return [];
	}

	return data.map(normalizer).filter(Boolean);
}

function buildError(error, fallback) {
	const message = error?.response?.data?.details || error?.response?.data?.message || error?.message || fallback;
	return new Error(message);
}

function buildTaskPayload(payload = {}) {
	return {
		...payload,
		area_id: payload.area_id ? Number(payload.area_id) : undefined,
		usuarios_asignados: Array.isArray(payload.usuarios_asignados)
			? payload.usuarios_asignados.map((id) => Number(id))
			: [],
	};
}

function buildAssignmentStatusPayload(payload = {}) {
	return {
		estado: payload.estado,
		comentario: payload.comentario || undefined,
	};
}

function normalizeTaskAccess(data) {
	const rawData = data || {};
	const rawViews = Array.isArray(rawData.views) ? rawData.views : [];
	const rawAreas = Array.isArray(rawData.areas) ? rawData.areas : [];
	const rawAssignableUsers = Array.isArray(rawData.assignableUsers) ? rawData.assignableUsers : [];

	return {
		profile: rawData.profile || "none",
		profileLabel: rawData.profileLabel || "Sin acceso",
		scopes: rawData.scopes || {},
		capabilities: {
			canAccessModule: Boolean(rawData.capabilities?.canAccessModule),
			canCreateTask: Boolean(rawData.capabilities?.canCreateTask),
			canEditTask: Boolean(rawData.capabilities?.canEditTask),
			canArchiveTask: Boolean(rawData.capabilities?.canArchiveTask),
			canUpdateOwnAssignmentStatus: Boolean(rawData.capabilities?.canUpdateOwnAssignmentStatus),
			canDeleteTask: Boolean(rawData.capabilities?.canDeleteTask),
			canDeleteOnlyUnassigned: Boolean(rawData.capabilities?.canDeleteOnlyUnassigned),
			canAssignUsers: Boolean(rawData.capabilities?.canAssignUsers),
			canReadHistory: Boolean(rawData.capabilities?.canReadHistory),
			canCommentTasks: Boolean(rawData.capabilities?.canCommentTasks),
			canFilterByStatus: Boolean(rawData.capabilities?.canFilterByStatus),
			canFilterByPriority: Boolean(rawData.capabilities?.canFilterByPriority),
			canFilterByDate: Boolean(rawData.capabilities?.canFilterByDate),
			canFilterByCreator: Boolean(rawData.capabilities?.canFilterByCreator),
			canFilterByAssignee: Boolean(rawData.capabilities?.canFilterByAssignee),
		},
		views: rawViews.map((view) => ({
			id: view.id,
			label: view.label,
		})),
		defaultView: rawData.defaultView || rawViews[0]?.id || "",
		context: {
			currentUserId: rawData.context?.currentUserId ?? null,
			currentUserAreaId: rawData.context?.currentUserAreaId ?? null,
			currentUserAreaName: rawData.context?.currentUserAreaName ?? "",
			currentUserAreaIds: Array.isArray(rawData.context?.currentUserAreaIds)
				? rawData.context.currentUserAreaIds.map((value) => Number(value)).filter((value) => Number.isInteger(value))
				: [],
			currentUserAreas: Array.isArray(rawData.context?.currentUserAreas)
				? rawData.context.currentUserAreas.map((area) => ({
					id: area?.id_area ?? area?.id ?? null,
					name: area?.nombre ?? area?.name ?? "",
					clave: area?.clave ?? "",
				})).filter((area) => area.id)
				: [],
			currentUserName: rawData.context?.currentUserName ?? "",
		},
		policies: {
			deleteRequiresNoAssignees: Boolean(rawData.policies?.deleteRequiresNoAssignees),
			assignmentStatuses: Array.isArray(rawData.policies?.assignmentStatuses)
				? rawData.policies.assignmentStatuses
				: ["pendiente", "en_progreso", "completada"],
		},
		areas: rawAreas.map((area) => ({
			id: area.id,
			name: area.name || "",
		})),
		assignableUsers: rawAssignableUsers.map((item) => ({
			id: item.id,
			nombre: item.nombre || "",
			apellido: item.apellido || "",
			email: item.email || "",
			fullName: item.fullName || [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
			areaId: item.areaId ?? null,
			areaName: item.areaName || "",
			areaIds: Array.isArray(item.areaIds)
				? item.areaIds.map((value) => Number(value)).filter((value) => Number.isInteger(value))
				: [],
			areas: Array.isArray(item.areas)
				? item.areas.map((area) => ({
					id_area: area?.id_area ?? area?.id ?? null,
					nombre: area?.nombre ?? area?.name ?? "",
					clave: area?.clave ?? "",
				})).filter((area) => area.id_area)
				: [],
			taskProfile: item.taskProfile || "none",
			assignmentScopeLabel: item.assignmentScopeLabel || "",
		})),
	};
}

export async function getTaskModuleAccess() {
	try {
		const response = await api.get(`${TASK_BASE_PATH}/access`);
		return normalizeTaskAccess(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible obtener la configuración del módulo de tareas");
	}
}

export async function getTasks(filters = {}) {
	try {
		const response = await api.get(TASK_BASE_PATH, { params: filters });
		return extractItems(response, normalizeTask);
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}

		throw buildError(error, "No fue posible obtener las tareas");
	}
}

export async function getTaskDetail(id) {
	try {
		const response = await api.get(`${TASK_BASE_PATH}/detail`, {
			params: { id },
		});
		return normalizeTask(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible obtener el detalle de la tarea");
	}
}

export async function getTaskHistory(filters = {}) {
	try {
		const response = await api.get(`${TASK_BASE_PATH}/history`, { params: filters });
		return extractItems(response, normalizeHistoryItem);
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}

		throw buildError(error, "No fue posible obtener el historial de tareas");
	}
}

export async function getTaskComments(filters = {}) {
	try {
		const response = await api.get(`${TASK_BASE_PATH}/comments`, { params: filters });
		return extractItems(response, normalizeComment);
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}

		throw buildError(error, "No fue posible obtener los comentarios de tareas");
	}
}

export async function createTask(payload) {
	try {
		const response = await api.post(`${TASK_BASE_PATH}/create`, buildTaskPayload(payload));
		return normalizeTask(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible crear la tarea");
	}
}

export async function updateTask(id, payload) {
	try {
		const response = await api.patch(`${TASK_BASE_PATH}/detail`, buildTaskPayload(payload), {
			params: { id },
		});
		return normalizeTask(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible actualizar la tarea");
	}
}

export async function archiveTask(id) {
	try {
		const response = await api.patch(`${TASK_BASE_PATH}/detail/archive`, null, {
			params: { id },
		});
		return normalizeTask(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible archivar la tarea");
	}
}

export async function deleteTask(id) {
	try {
		const response = await api.delete(`${TASK_BASE_PATH}/detail`, { params: { id } });
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible eliminar la tarea");
	}
}

export async function updateTaskAssignmentStatus(assignmentId, payload) {
	try {
		const response = await api.patch(
			`${TASK_BASE_PATH}/assignment/status`,
			buildAssignmentStatusPayload(payload),
			{ params: { assignmentId } },
		);
		return {
			assignment: normalizeAssignment(response?.data?.data?.assignment || {}),
			task: normalizeTask(response?.data?.data?.task || {}),
		};
	} catch (error) {
		throw buildError(error, "No fue posible actualizar el estado de la asignación");
	}
}

export async function createTaskComment(payload) {
	try {
		const response = await api.post(`${TASK_BASE_PATH}/comments`, payload);
		return normalizeComment(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible crear el comentario");
	}
}
