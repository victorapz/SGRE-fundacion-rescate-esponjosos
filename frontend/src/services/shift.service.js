import api from "../api/axios";

const SHIFT_BASE_PATH = "/shift";

function toBackendDate(dateValue) {
	return dateValue;
}

function normalizeTimeValue(timeValue) {
	if (typeof timeValue !== "string") {
		return "";
	}

	const trimmedValue = timeValue.trim();
	if (!trimmedValue) {
		return "";
	}

	if (/^\d{2}:\d{2}:\d{2}$/.test(trimmedValue)) {
		return trimmedValue.slice(0, 5);
	}

	if (/^\d{2}:\d{2}$/.test(trimmedValue)) {
		return trimmedValue;
	}

	const parsedDate = new Date(`1970-01-01T${trimmedValue}`);
	if (Number.isNaN(parsedDate.getTime())) {
		return trimmedValue.slice(0, 5);
	}

	return parsedDate.toISOString().slice(11, 16);
}

function toInputDate(dateValue) {
	if (typeof dateValue !== "string") {
		return "";
	}

	if (/^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
		const [day, month, year] = dateValue.split("-");
		return `${year}-${month}-${day}`;
	}

	if (/^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
		return dateValue.slice(0, 10);
	}

	const parsedDate = new Date(dateValue);
	if (Number.isNaN(parsedDate.getTime())) {
		return "";
	}

	return parsedDate.toISOString().slice(0, 10);
}

function normalizeShift(item) {
	return {
		id: item.id_turno,
		title: item.titulo || "",
		date: toInputDate(item.fecha),
		startTime: normalizeTimeValue(item.hora_inicio),
		endTime: normalizeTimeValue(item.hora_fin),
		status: Boolean(item.estado),
		capacity: Number(item.cantidad_maxima ?? 0),
		availableSeats: Number(item.cupos_disponibles ?? 0),
	};
}

function extractItems(response) {
	const data = response?.data?.data;
	if (!Array.isArray(data)) {
		return [];
	}

	return data.map(normalizeShift);
}

function buildError(error, fallback) {
	const message = error?.response?.data?.message || error?.message || fallback;
	return new Error(message);
}

function buildPayload(payload = {}) {
	return {
		...payload,
		fecha: toBackendDate(payload.fecha),
		hora_inicio: normalizeTimeValue(payload.hora_inicio),
		hora_fin: normalizeTimeValue(payload.hora_fin),
		cantidad_maxima: Number(payload.cantidad_maxima),
		estado: Boolean(payload.estado),
	};
}

export async function getShifts() {
	try {
		const response = await api.get(SHIFT_BASE_PATH);
		return extractItems(response);
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}

		throw buildError(error, "No fue posible obtener los turnos");
	}
}

export async function createShift(payload) {
	try {
		const response = await api.post(`${SHIFT_BASE_PATH}/create`, buildPayload(payload));
		return normalizeShift(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible crear el turno");
	}
}

export async function updateShift(id, payload) {
	try {
		const response = await api.patch(`${SHIFT_BASE_PATH}/detail`, buildPayload(payload), {
			params: { id },
		});
		return normalizeShift(response?.data?.data || {});
	} catch (error) {
		throw buildError(error, "No fue posible actualizar el turno");
	}
}

export async function deleteShift(id) {
	try {
		const response = await api.delete(`${SHIFT_BASE_PATH}/detail`, { params: { id } });
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible eliminar el turno");
	}
}

export async function registerShift(shiftId, userId) {
	try {
		const response = await api.post(
			`${SHIFT_BASE_PATH}/${shiftId}/register/${userId}`,
		);
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible registrar el turno");
	}
}

export async function cancelShiftRegistration(shiftId, userId) {
	try {
		const response = await api.delete(
			`${SHIFT_BASE_PATH}/${shiftId}/register/${userId}`,
		);
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible cancelar el registro");
	}
}

export async function getUserShiftRegistrations(userId) {
	try {
		const response = await api.get(
			`${SHIFT_BASE_PATH}/registrations/user/${userId}`,
		);
		const data = response?.data?.data;
		if (!Array.isArray(data)) return [];
		return data;
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}
		throw buildError(error, "No fue posible obtener los registros del usuario");
	}
}

export async function getUserUpcomingShiftRegistrations(userId, params = {}) {
	try {
		const response = await api.get(
			`${SHIFT_BASE_PATH}/registrations/user/${userId}/upcoming`,
			{ params },
		);
		const data = response?.data?.data;
		if (!Array.isArray(data)) return [];
		return data;
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}
		throw buildError(error, "No fue posible obtener los turnos futuros");
	}
}

export async function getUserHistoryShiftRegistrations(userId, params = {}) {
	try {
		const response = await api.get(
			`${SHIFT_BASE_PATH}/registrations/user/${userId}/history`,
			{ params },
		);
		const data = response?.data?.data;
		if (!Array.isArray(data)) return [];
		return data;
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}
		throw buildError(error, "No fue posible obtener el historial de turnos");
	}
}

export async function getShiftRegistrations(shiftId) {
	try {
		const response = await api.get(`${SHIFT_BASE_PATH}/${shiftId}/registrations`);
		const data = response?.data?.data;
		if (!Array.isArray(data)) return [];
		return data;
	} catch (error) {
		if (error?.response?.status === 404 || error?.response?.status === 204) {
			return [];
		}
		throw buildError(error, "No fue posible obtener los inscritos del turno");
	}
}

export async function updateShiftRegistrationStatus(registrationId, estado) {
	try {
		const response = await api.patch(
			`${SHIFT_BASE_PATH}/registrations/${registrationId}`,
			{ estado },
		);
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible actualizar el registro");
	}
}

export async function saveShiftBitacora(registrationId, bitacora) {
	try {
		const response = await api.patch(
			`${SHIFT_BASE_PATH}/registrations/${registrationId}/bitacora`,
			{ bitacora },
		);
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible guardar la bitacora");
	}
}

export async function markShiftAttendance(registrationId, estado) {
	try {
		const response = await api.patch(
			`${SHIFT_BASE_PATH}/registrations/${registrationId}/attendance`,
			{ estado },
		);
		return response?.data?.data || null;
	} catch (error) {
		throw buildError(error, "No fue posible registrar la asistencia");
	}
}
