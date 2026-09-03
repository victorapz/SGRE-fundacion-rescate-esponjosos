import api from "../api/axios";
import { EVENT_CATEGORY, normalizeEventCategory } from "../constants/eventCategories";

const EVENT_BASE_PATH = "/event";

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

function isValidDateValue(value) {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);
  return !Number.isNaN(parsedDate.getTime());
}

function toDateFromLegacy(dateValue, timeValue = "") {
  if (typeof dateValue !== "string" || !dateValue) {
    return null;
  }

  const match = dateValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const normalizedTime = timeValue ? `${timeValue}:00` : "00:00:00";
  return new Date(`${year}-${month}-${day}T${normalizedTime}`);
}

function normalizeEvent(item) {
  const legacyStart = toDateFromLegacy(item?.fecha, item?.hora_inicio);
  const legacyEnd = toDateFromLegacy(item?.fecha, item?.hora_fin);
  const startAt = isValidDateValue(item?.fecha_inicio)
    ? new Date(item.fecha_inicio).toISOString()
    : legacyStart?.toISOString?.() ?? "";
  const endAt = isValidDateValue(item?.fecha_fin)
    ? new Date(item.fecha_fin).toISOString()
    : legacyEnd?.toISOString?.() ?? "";
  const allDay = typeof item?.todo_el_dia === "boolean"
    ? item.todo_el_dia
    : !(item?.hora_inicio || item?.hora_fin);

  return {
    id: item?.id_evento ?? item?.id ?? null,
    title: item?.titulo ?? item?.title ?? "",
    description: item?.descripcion ?? item?.description ?? "",
    location: item?.lugar ?? item?.location ?? "",
    category: normalizeEventCategory(item?.categoria ?? item?.category ?? EVENT_CATEGORY.COMUNITARIO),
    startAt,
    endAt,
    allDay,
    active: item?.activo ?? item?.active ?? true,
    createdAt: item?.createdAt ?? "",
    updatedAt: item?.updatedAt ?? "",
    isValidRange: isValidDateValue(startAt) && isValidDateValue(endAt) && new Date(endAt) > new Date(startAt),
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeEvent);
}

export async function getEvents() {
  try {
    const response = await api.get(EVENT_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los eventos");
  }
}

export async function createEvent(payload) {
  try {
    const response = await api.post(`${EVENT_BASE_PATH}/create`, payload);
    return normalizeEvent(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el evento");
  }
}

export async function updateEvent(id, payload) {
  try {
    const response = await api.patch(`${EVENT_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeEvent(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar el evento");
  }
}

export async function deleteEvent(id) {
  try {
    const response = await api.delete(`${EVENT_BASE_PATH}/detail`, { params: { id } });
    return normalizeEvent(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible eliminar el evento");
  }
}
