import api from "../api/axios";
import { normalizeFinancialFields } from "../utils/financial";
import { buildRequestError } from "../utils/requestError";

const VET_CHECKUP_BASE_PATH = "/vet_checkup";

function normalizeVetCheckup(item = {}) {
  return {
    id: item.id_control_veterinario,
    numeroControl: item.numero_control || "",
    fecha: item.fecha || "",
    motivo: item.motivo || "",
    peso: item.peso ?? "",
    temperatura: item.temperatura ?? "",
    diagnostico: item.diagnostico || "",
    observaciones: item.observaciones || "",
    indicacionesCasa: item.indicaciones_casa || "",
    indicacionesExamenes: item.indicaciones_examenes || "",
    indicacionesProcedimiento: item.indicaciones_procedimiento || "",
    ...normalizeFinancialFields(item),
    payableAccount: item.payable_account || null,
    fechaProximoControl: item.fecha_proximo_control || "",
    animalId: item.animal?.id_animal || item.animal_id || "",
    veterinarianNombre: [item.veterinarian?.nombre, item.veterinarian?.apellido].filter(Boolean).join(" ").trim(),
    veterinarianId: item.veterinarian?.id_veterinario || item.veterinarian_id || "",
    clinicNombre: item.clinic?.nombre || "",
    clinicId: item.clinic?.id_clinica || item.clinic_id || "",
    userNombre: [item.user?.nombre, item.user?.apellido].filter(Boolean).join(" ").trim(),
    userId: item.user?.id_usuario || item.user_id || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeVetCheckup);
}

export async function getVetCheckups() {
  try {
    const response = await api.get(VET_CHECKUP_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRequestError(error, "No fue posible obtener los controles");
  }
}

export async function getVetCheckup(id) {
  try {
    const response = await api.get(`${VET_CHECKUP_BASE_PATH}/detail`, { params: { id } });
    return normalizeVetCheckup(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible obtener el control");
  }
}

export async function createVetCheckup(payload) {
  try {
    const response = await api.post(`${VET_CHECKUP_BASE_PATH}/create`, payload);
    return normalizeVetCheckup(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible crear el control");
  }
}

export async function updateVetCheckup(id, payload) {
  try {
    const response = await api.patch(`${VET_CHECKUP_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeVetCheckup(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible actualizar el control");
  }
}

export async function deleteVetCheckup(id) {
  try {
    const response = await api.delete(`${VET_CHECKUP_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildRequestError(error, "No fue posible eliminar el control");
  }
}
