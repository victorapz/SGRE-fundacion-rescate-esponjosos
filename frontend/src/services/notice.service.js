import api from "../api/axios.js";

const NOTICE_BASE_PATH = "/notice";

function normalizeAsset(item = null) {
  if (!item) return null;

  return {
    id: item.file_asset_id || "",
    fileAssetId: item.file_asset_id || "",
    publicId: item.public_id || "",
    entityType: item.entity_type || "",
    entityId: item.entity_id || "",
    context: item.context || "",
    visibility: item.visibility || "",
    originalName: item.original_name || "",
    storedName: item.stored_name || "",
    mimeType: item.mime_type || "",
    extension: item.extension || "",
    sizeBytes: Number(item.size_bytes || 0),
    title: item.title || null,
    description: item.description || null,
    uploadedAt: item.uploaded_at || null,
    status: item.status || "",
  };
}

export function mapNoticeFromApi(item = {}) {
  const firstName = item.user?.nombre || "";
  const lastName = item.user?.apellido || "";
  const authorName = item.user?.full_name || `${firstName} ${lastName}`.trim() || firstName || "Sistema";

  return {
    id: item.id_aviso,
    title: item.titulo,
    slug: item.slug || null,
    summary: item.resumen || "",
    description: item.descripcion,
    status: item.estado,
    publishedAt: item.fecha_publicacion || null,
    isPublic: Boolean(item.publico),
    coverAsset: normalizeAsset(item.cover_asset),
    contentImages: Array.isArray(item.content_images)
      ? item.content_images.map(normalizeAsset)
      : [],
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    user: item.user
      ? {
        id: item.user.id_usuario,
        name: item.user.nombre,
        lastName: item.user.apellido || "",
        fullName: authorName,
      }
      : null,
  };
}

function buildError(error, fallback) {
  const message = error?.response?.data?.details || error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

function buildUploadFormData(file) {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

function normalizeContentImageUpload(item = {}) {
  return {
    asset: normalizeAsset(item.asset),
    html: item.html || "",
  };
}

export async function getNotices() {
  try {
    const response = await api.get(NOTICE_BASE_PATH);
    const data = response?.data?.data;
    return Array.isArray(data) ? data.map(mapNoticeFromApi) : [];
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los avisos");
  }
}

export async function createNotice(payload) {
  try {
    const response = await api.post(`${NOTICE_BASE_PATH}/create`, payload);
    return mapNoticeFromApi(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el aviso");
  }
}

export async function getNotice(id) {
  try {
    const response = await api.get(`${NOTICE_BASE_PATH}/detail`, {
      params: { id },
    });
    return mapNoticeFromApi(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener el aviso");
  }
}

export async function updateNotice(id, payload) {
  try {
    const response = await api.patch(`${NOTICE_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return mapNoticeFromApi(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar el aviso");
  }
}

export async function deleteNotice(id) {
  try {
    const response = await api.delete(`${NOTICE_BASE_PATH}/detail`, {
      params: { id },
    });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar el aviso");
  }
}

export async function getNoticeAssets(id) {
  try {
    const response = await api.get(`${NOTICE_BASE_PATH}/detail/assets`, {
      params: { id },
    });

    const data = response?.data?.data || {};
    return {
      cover: normalizeAsset(data.cover),
      contentImages: Array.isArray(data.content_images)
        ? data.content_images.map(normalizeAsset)
        : [],
    };
  } catch (error) {
    throw buildError(error, "No fue posible obtener los assets del aviso");
  }
}

export async function uploadNoticeCover(id, file) {
  try {
    const response = await api.post(`${NOTICE_BASE_PATH}/detail/cover`, buildUploadFormData(file), {
      params: { id },
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return normalizeAsset(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible cargar la portada del aviso");
  }
}

export async function deleteNoticeCover(id) {
  try {
    const response = await api.delete(`${NOTICE_BASE_PATH}/detail/cover`, {
      params: { id },
    });

    return normalizeAsset(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible eliminar la portada del aviso");
  }
}

export async function uploadNoticeContentImage(id, file) {
  try {
    const response = await api.post(
      `${NOTICE_BASE_PATH}/detail/content-images`,
      buildUploadFormData(file),
      {
        params: { id },
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return normalizeContentImageUpload(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible cargar la imagen del aviso");
  }
}

export async function getNoticeAssetPreviewBlob(assetUuid) {
  try {
    const response = await api.get(`${NOTICE_BASE_PATH}/assets/${assetUuid}/preview`, {
      responseType: "blob",
    });

    return response?.data;
  } catch (error) {
    throw buildError(error, "No fue posible obtener la previsualizacion del asset");
  }
}
