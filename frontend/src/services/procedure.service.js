import api from "../api/axios";
import { normalizeFinancialFields } from "../utils/financial";
import { buildRequestError } from "../utils/requestError";

const PROCEDURE_BASE_PATH = "/procedure";

function normalizeProcedure(item = {}) {
  return {
    id: item.id_procedimiento,
    fechaProcedimiento: item.fecha_procedimiento || "",
    tipo: item.tipo || "",
    motivo: item.motivo || "",
    observaciones: item.observaciones || "",
    farmacosRecetados: item.farmacos_recetados || "",
    ...normalizeFinancialFields(item),
    payableAccount: item.payable_account || null,
    indicaciones: item.indicaciones || "",
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

  return data.map(normalizeProcedure);
}

export async function getProcedures() {
  try {
    const response = await api.get(PROCEDURE_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRequestError(error, "No fue posible obtener los procedimientos");
  }
}

export async function getProcedure(id) {
  try {
    const response = await api.get(`${PROCEDURE_BASE_PATH}/detail`, { params: { id } });
    return normalizeProcedure(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible obtener el procedimiento");
  }
}

export async function createProcedure(payload) {
  try {
    const response = await api.post(`${PROCEDURE_BASE_PATH}/create`, payload);
    return normalizeProcedure(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible crear el procedimiento");
  }
}

export async function updateProcedure(id, payload) {
  try {
    const response = await api.patch(`${PROCEDURE_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeProcedure(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible actualizar el procedimiento");
  }
}

export async function deleteProcedure(id) {
  try {
    const response = await api.delete(`${PROCEDURE_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildRequestError(error, "No fue posible eliminar el procedimiento");
  }
}
