"use strict";

function asNumber(value) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getActorAreaOptions(access = {}) {
	const areas = Array.isArray(access?.context?.currentUserAreas)
		? access.context.currentUserAreas
		: [];

	if (areas.length > 0) {
		return areas
			.map((area) => ({
				id: asNumber(area?.id ?? area?.id_area),
				name: area?.name ?? area?.nombre ?? "",
			}))
			.filter((area) => area.id);
	}

	const legacyAreaId = asNumber(access?.context?.currentUserAreaId);
	if (!legacyAreaId) {
		return [];
	}

	return [{
		id: legacyAreaId,
		name: access?.context?.currentUserAreaName ?? "",
	}];
}

export function filterAssignableUsersByArea(assignableUsers = [], selectedAreaId, scopes = {}) {
	const areaId = asNumber(selectedAreaId);
	if (!areaId) {
		return Array.isArray(assignableUsers) ? assignableUsers : [];
	}

	return (Array.isArray(assignableUsers) ? assignableUsers : []).filter((user) => {
		const areaIds = Array.isArray(user?.areaIds)
			? user.areaIds.map((value) => Number(value))
			: [];

		if (scopes.assign === "area" && user?.taskProfile === "content_manager") {
			return true;
		}

		return areaIds.includes(areaId);
	});
}

export function sanitizeAssigneeSelection(selectedIds = [], visibleUsers = []) {
	const allowedIds = new Set(
		(Array.isArray(visibleUsers) ? visibleUsers : [])
			.map((user) => String(user?.id))
			.filter(Boolean),
	);

	return (Array.isArray(selectedIds) ? selectedIds : [])
		.map((value) => String(value))
		.filter((value) => allowedIds.has(value));
}

export function formatUserAreaNames(user = {}) {
	const areas = Array.isArray(user?.areas) ? user.areas : [];
	const names = areas
		.map((area) => area?.nombre || area?.name || "")
		.filter(Boolean);

	if (names.length > 0) {
		return names.join(", ");
	}

	return user?.areaName || "";
}

export function buildTaskEditorPayload(form = {}) {
	return {
		titulo: String(form?.title || "").trim(),
		descripcion: form?.description || "",
		prioridad: form?.priority || "media",
		fecha_limite: form?.dueDate || "",
		area_id: form?.areaId ? Number(form.areaId) : undefined,
		usuarios_asignados: Array.isArray(form?.assigneeIds)
			? form.assigneeIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
			: [],
	};
}
