import api from "../api/axios";

const PERMISSION_BASE_PATH = "/permission";

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getPermissions() {
  try {
    const response = await api.get(PERMISSION_BASE_PATH);
    return response?.data?.data || { items: [], grouped: [] };
  } catch (error) {
    throw buildError(error, "No fue posible obtener los permisos");
  }
}
