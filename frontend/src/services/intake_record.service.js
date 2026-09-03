import api from "../api/axios";

const INTAKE_BASE_PATH = "/intake_record";

function normalizeIntake(item = {}) {
  return {
    id: item.id_intake_record,
    fechaEntrega: item.fecha_entrega || "",
    estadoReproduccionInicial: item.estado_reproduccion_inicial || "",
    edadEstimada: item.edad_estimada || "",
    lugarEntrega: item.lugar_entrega || "",
    causaEntrega: item.causa_entrega || "",
    condicionesIniciales: item.condiciones_iniciales || "",
    nombreQuienEntrega: item.nombre_quien_entrega || "",
    animalId: item.animal?.id_animal || item.animal_id || "",
    quienRecibeId: item.quien_recibe?.id_usuario || item.quien_recibe_id || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeIntake);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getIntakeRecords() {
  try {
    const response = await api.get(INTAKE_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los registros");
  }
}

export async function getIntakeRecord(id) {
  try {
    const response = await api.get(`${INTAKE_BASE_PATH}/detail`, { params: { id } });
    return normalizeIntake(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener el registro");
  }
}

export async function createIntakeRecord(payload) {
  try {
    const response = await api.post(`${INTAKE_BASE_PATH}/create`, payload);
    return normalizeIntake(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el registro");
  }
}

export async function updateIntakeRecord(id, payload) {
  try {
    const response = await api.patch(`${INTAKE_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeIntake(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar el registro");
  }
}

export async function deleteIntakeRecord(id) {
  try {
    const response = await api.delete(`${INTAKE_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar el registro");
  }
}
