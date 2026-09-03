import api from "../api/axios";
import { normalizeFinancialFields } from "../utils/financial";
import { buildRequestError } from "../utils/requestError";

const EXAM_BASE_PATH = "/exam";

function normalizeExam(item = {}) {
  return {
    id: item.id_examen,
    fechaSolicitud: item.fecha_solicitud || "",
    nombreExamen: item.nombre_examen || "",
    motivo: item.motivo || "",
    peso: item.peso ?? "",
    temperatura: item.temperatura ?? "",
    fechaEntregaResultado: item.fecha_entrega_resultado || "",
    diagnostico: item.diagnostico || "",
    indicaciones: item.indicaciones || "",
    ...normalizeFinancialFields(item),
    payableAccount: item.payable_account || null,
    veterinarianNombre: [item.veterinarian?.nombre, item.veterinarian?.apellido].filter(Boolean).join(" ").trim(),
    veterinarianId: item.veterinarian?.id_veterinario || item.veterinarian_id || "",
    clinicNombre: item.clinic?.nombre || "",
    clinicId: item.clinic?.id_clinica || item.clinic_id || "",
    userNombre: [item.user?.nombre, item.user?.apellido].filter(Boolean).join(" ").trim(),
    userId: item.user?.id_usuario || item.user_id || "",
    animalId: item.animal?.id_animal || item.animal_id || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeExam);
}

export async function getExams() {
  try {
    const response = await api.get(EXAM_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRequestError(error, "No fue posible obtener los examenes");
  }
}

export async function getExam(id) {
  try {
    const response = await api.get(`${EXAM_BASE_PATH}/detail`, { params: { id } });
    return normalizeExam(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible obtener el examen");
  }
}

export async function createExam(payload) {
  try {
    const response = await api.post(`${EXAM_BASE_PATH}/create`, payload);
    return normalizeExam(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible crear el examen");
  }
}

export async function updateExam(id, payload) {
  try {
    const response = await api.patch(`${EXAM_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeExam(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible actualizar el examen");
  }
}

export async function deleteExam(id) {
  try {
    const response = await api.delete(`${EXAM_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildRequestError(error, "No fue posible eliminar el examen");
  }
}
