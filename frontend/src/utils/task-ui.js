import DOMPurify from "dompurify";

export function toApiDate(dateValue) {
	if (!dateValue) {
		return "";
	}

	return `${dateValue}T12:00:00.000Z`;
}

export function toSortKey(dateValue) {
	if (!dateValue) {
		return 0;
	}

	const parsedDate = new Date(`${dateValue}T12:00:00`);
	return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

export function formatShortDate(dateValue) {
	if (!dateValue) {
		return "Sin fecha";
	}

	const parsedDate = new Date(`${dateValue}T12:00:00`);
	if (Number.isNaN(parsedDate.getTime())) {
		return dateValue;
	}

	return new Intl.DateTimeFormat("es-CL", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(parsedDate);
}

export function formatDateTime(dateValue) {
	if (!dateValue) {
		return "Sin registro";
	}

	const parsedDate = new Date(dateValue);
	if (Number.isNaN(parsedDate.getTime())) {
		return dateValue;
	}

	return new Intl.DateTimeFormat("es-CL", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(parsedDate);
}

export function userLabel(user) {
	if (!user) {
		return "Sin usuario";
	}

	return user.fullName || [user.nombre, user.apellido].filter(Boolean).join(" ").trim() || `Usuario ${user.id}`;
}

export function statusLabel(status) {
	if (status === "en_progreso") return "En proceso";
	if (status === "completada") return "Completada";
	if (status === "archivada") return "Archivada";
	return "Pendiente";
}

export function historyActionLabel(item) {
	if (item.action === "created") return "Creó la tarea";
	if (item.action === "updated") return "Actualizó la tarea";
	if (item.action === "assignment_added") return "Agregó una asignación";
	if (item.action === "assignment_removed") return "Quitó una asignación";
	if (item.action === "status_changed") return "Cambió el estado";
	if (item.action === "archived") return "Archivó la tarea";
	return item.action || "Acción";
}

export function profileDescription(profile) {
	if (profile === "global") {
		return "Visibilidad completa del módulo, con filtros globales y control operativo de todas las tareas.";
	}

	if (profile === "creator") {
		return "Seguimiento de tus tareas creadas, tus asignaciones y las archivadas dentro de tu alcance.";
	}

	if (profile === "assignee") {
		return "Vista personal de tus tareas asignadas y su historial operativo.";
	}

	return "El backend define qué vistas y acciones del módulo están disponibles para tu usuario.";
}

export function matchesTaskSearch(task, search) {
	const normalizedSearch = search.trim().toLowerCase();
	if (!normalizedSearch) {
		return true;
	}

	const searchableText = [
		task.title,
		htmlToTaskPreview(task.description),
		task.priority,
		task.status,
		task.area?.name,
		userLabel(task.creator),
		...task.assignments.map((assignment) => userLabel(assignment.user)),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	return searchableText.includes(normalizedSearch);
}

export function isTaskOwnedOrAssigned(task, currentUserId) {
	return task.creator?.id === currentUserId
		|| task.assignments.some((assignment) => assignment.user?.id === currentUserId);
}

export function getCurrentUserTaskAssignment(task, currentUserId) {
	if (!task || !Array.isArray(task.assignments) || task.assignments.length === 0) {
		return null;
	}

	const explicitAssignment = task.assignments.find(
		(assignment) => assignment.isCurrentUserAssignment,
	);
	if (explicitAssignment) {
		return explicitAssignment;
	}

	if (task.currentUserAssignmentId) {
		const matchedByAssignmentId = task.assignments.find(
			(assignment) => String(assignment.id) === String(task.currentUserAssignmentId),
		);
		if (matchedByAssignmentId) {
			return matchedByAssignmentId;
		}
	}

	if (currentUserId == null) {
		return null;
	}

	return task.assignments.find(
		(assignment) => String(assignment.user?.id) === String(currentUserId),
	) || null;
}

export function getTaskKanbanStatus(task, activeView, currentUserId) {
	if (activeView === "assigned") {
		const currentAssignment = getCurrentUserTaskAssignment(task, currentUserId);
		return currentAssignment?.status || task.status;
	}

	return task.status;
}

export function sanitizeTaskHtml(value) {
	if (!value) {
		return "<p></p>";
	}

	return DOMPurify.sanitize(value, { USE_PROFILES: { html: true } });
}

export function htmlToTaskPreview(value) {
	const sanitized = sanitizeTaskHtml(value);

	if (typeof window !== "undefined" && window.DOMParser) {
		const parser = new window.DOMParser();
		const documentNode = parser.parseFromString(sanitized, "text/html");
		return documentNode.body.textContent?.trim() || "";
	}

	return sanitized.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
