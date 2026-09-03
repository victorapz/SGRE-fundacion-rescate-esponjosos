import api from "../api/axios";
import { normalizeFinancialFields } from "../utils/financial";
import { buildRequestError } from "../utils/requestError";

const HOSPITALIZATION_BASE_PATH = "/hospitalization";

function normalizeHospitalization(item = {}) {
  return {
    id: item.id_hospitalizacion,
    fechaIngreso: item.fecha_ingreso || "",
    fechaAlta: item.fecha_alta || "",
    motivo: item.motivo || "",
    diagnostico: item.diagnostico || "",
    pronostico: item.pronostico || "",
    pesoIngreso: item.peso_ingreso ?? "",
    temperaturaIngreso: item.temperatura_ingreso ?? "",
    farmacosRecetados: item.farmacos_recetados || "",
    examenesRealizados: item.examenes_realizados || "",
    indicacionesHospital: item.indicaciones_hospital || "",
    indicacionesCasa: item.indicaciones_casa || "",
    ...normalizeFinancialFields(item),
    payableAccount: item.payable_account || null,
    fechaControlPostAlta: item.fecha_control_post_alta || "",
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

  return data.map(normalizeHospitalization);
}

export async function getHospitalizations() {
  try {
    const response = await api.get(HOSPITALIZATION_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRequestError(error, "No fue posible obtener las hospitalizaciones");
  }
}

export async function getHospitalization(id) {
  try {
    const response = await api.get(`${HOSPITALIZATION_BASE_PATH}/detail`, { params: { id } });
    return normalizeHospitalization(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible obtener la hospitalizacion");
  }
}

export async function createHospitalization(payload) {
  try {
    const response = await api.post(`${HOSPITALIZATION_BASE_PATH}/create`, payload);
    return normalizeHospitalization(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible crear la hospitalizacion");
  }
}

export async function updateHospitalization(id, payload) {
  try {
    const response = await api.patch(`${HOSPITALIZATION_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeHospitalization(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible actualizar la hospitalizacion");
  }
}

export async function deleteHospitalization(id) {
  try {
    const response = await api.delete(`${HOSPITALIZATION_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildRequestError(error, "No fue posible eliminar la hospitalizacion");
  }
}
