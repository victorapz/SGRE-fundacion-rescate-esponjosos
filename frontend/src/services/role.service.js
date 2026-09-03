import api from "../api/axios";

const ROLE_BASE_PATH = "/role";

function normalizeRole(item) {
	const permisos = Array.isArray(item.permisos) ? item.permisos : [];
	const permisosIds = Array.isArray(item.permisos_ids)
		? item.permisos_ids
		: permisos.map((permiso) => permiso.id_permiso).filter(Boolean);
	return {
		id: item.id_rol,
		nombre: item.nombre || "",
		permisos,
		permisosIds,
	};
}

function extractItems(response) {
	const data = response?.data?.data;
	if (!Array.isArray(data)) {
		return [];
	}

	return data.map(normalizeRole);
}

function buildError(error, fallback) {
	const details = error?.response?.data?.details;
	const message = typeof details === "string"
		? details
		: error?.response?.data?.message || error?.message || fallback;
	return new Error(message);
}

export async function getRoles() {
	try {
		const response = await api.get(ROLE_BASE_PATH);
		return extractItems(response);
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}

		throw buildError(error, "No fue posible obtener los roles");
	}
}

export async function createRole(payload) {
	try {
		const response = await api.post(`${ROLE_BASE_PATH}/create`, payload);
		return normalizeRole(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible crear el rol");
	}
}

export async function updateRole(id, payload) {
	try {
		const response = await api.patch(`${ROLE_BASE_PATH}/detail`, payload, {
			params: { id },
		});
		return normalizeRole(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible actualizar el rol");
	}
}

export async function deleteRole(id) {
	try {
		const response = await api.delete(`${ROLE_BASE_PATH}/detail`, { params: { id } });
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible eliminar el rol");
	}
}
