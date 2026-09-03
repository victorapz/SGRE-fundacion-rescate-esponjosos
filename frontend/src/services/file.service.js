import api from "../api/axios";

const FILES_BASE_PATH = "/files";

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

function normalizeFileAsset(item = {}) {
  return {
    id: item.file_asset_id || "",
    file_asset_id: item.file_asset_id || "",
    entity_type: item.entity_type || "",
    entity_id: item.entity_id || "",
    context: item.context || "",
    visibility: item.visibility || "",
    original_name: item.original_name || "",
    stored_name: item.stored_name || "",
    mime_type: item.mime_type || "",
    extension: item.extension || "",
    size_bytes: Number(item.size_bytes || 0),
    checksum: item.checksum || null,
    title: item.title || null,
    description: item.description || null,
    sort_order: Number(item.sort_order || 0),
    is_main: Boolean(item.is_main),
    status: item.status || "",
    uploaded_at: item.uploaded_at || "",
    deleted_at: item.deleted_at || null,
    metadata: item.metadata || null,
    uploaded_by: item.uploaded_by || null,
    deleted_by: item.deleted_by || null,
    preview_url: item.preview_url || "",
    download_url: item.download_url || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeFileAsset);
}

function buildQueryParams(params = {}) {
  const query = {};

  if (params.entityType) query.entity_type = params.entityType;
  if (params.entityId !== undefined && params.entityId !== null && params.entityId !== "") {
    query.entity_id = params.entityId;
  }
  if (params.context) query.context = params.context;
  if (params.visibility) query.visibility = params.visibility;
  if (params.status) query.status = params.status;

  return query;
}

function buildUploadFormData(payload = {}) {
  const formData = new FormData();

  formData.append("file", payload.file);
  formData.append("entity_type", payload.entityType);
  formData.append("entity_id", String(payload.entityId));
  formData.append("context", payload.context);
  formData.append("visibility", payload.visibility || "PRIVADO");

  if (payload.title) {
    formData.append("title", payload.title);
  }

  if (payload.description) {
    formData.append("description", payload.description);
  }

  if (payload.isMain === true) {
    formData.append("is_main", String(Boolean(payload.isMain)));
  }

  if (payload.sortOrder !== undefined && payload.sortOrder !== null && payload.sortOrder !== "") {
    formData.append("sort_order", String(payload.sortOrder));
  }

  return formData;
}

function sanitizeDownloadName(originalName = "") {
  const safeName = String(originalName || "archivo")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return safeName || "archivo";
}

export async function uploadFile(payload) {
  try {
    const response = await api.post(FILES_BASE_PATH, buildUploadFormData(payload), {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return normalizeFileAsset(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible subir el archivo");
  }
}

export async function uploadMultipleFiles(files, basePayload = {}) {
  const fileList = Array.from(files || []);
  const results = [];

  for (const file of fileList) {
    try {
      const uploaded = await uploadFile({
        ...basePayload,
        file,
      });

      results.push({
        file,
        success: true,
        data: uploaded,
        error: null,
      });
    } catch (error) {
      results.push({
        file,
        success: false,
        data: null,
        error,
      });
    }
  }

  return {
    results,
    uploaded: results.filter((item) => item.success).map((item) => item.data),
    failed: results.filter((item) => !item.success),
  };
}

export async function listFiles(params = {}) {
  try {
    const response = await api.get(FILES_BASE_PATH, {
      params: buildQueryParams(params),
    });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los archivos");
  }
}

export async function getPreviewBlob(fileAssetId) {
  try {
    const response = await api.get(`${FILES_BASE_PATH}/${fileAssetId}/preview`, {
      responseType: "blob",
    });

    return response?.data;
  } catch (error) {
    throw buildError(error, "No fue posible obtener la previsualizacion del archivo");
  }
}

export async function downloadFile(fileAsset) {
  const fileAssetId = fileAsset?.file_asset_id || fileAsset?.id;

  try {
    const response = await api.get(`${FILES_BASE_PATH}/${fileAssetId}/download`, {
      responseType: "blob",
    });

    const blob = response?.data;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = sanitizeDownloadName(fileAsset?.original_name);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);

    return true;
  } catch (error) {
    throw buildError(error, "No fue posible descargar el archivo");
  }
}

export async function markFileAsMain(fileAssetId) {
  try {
    const response = await api.patch(`${FILES_BASE_PATH}/${fileAssetId}/main`);
    return normalizeFileAsset(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible marcar el archivo como principal");
  }
}

export async function deleteFile(fileAssetId) {
  try {
    const response = await api.delete(`${FILES_BASE_PATH}/${fileAssetId}`);
    return normalizeFileAsset(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible eliminar el archivo");
  }
}
