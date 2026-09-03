import api from "../api/axios";
import { buildPublicRequestConfig, getPublicHttpErrorMessage } from "../utils/publicSite";
import { buildAbsoluteNoticeApiUrl, toPublicNoticeHtml } from "../utils/notice-assets";

const PUBLIC_NOTICE_BASE_PATH = "/public/notices";

function buildPublicNoticeError(error, fallbackMessage) {
  return new Error(getPublicHttpErrorMessage(error, fallbackMessage));
}

function normalizePublicNoticeItem(item = {}) {
  return {
    slug: item.slug || "",
    title: item.titulo || "",
    summary: item.resumen || "",
    coverPath: item.imagen_portada_url || "",
    coverUrl: buildAbsoluteNoticeApiUrl(item.imagen_portada_url || ""),
    publishedAt: item.fecha_publicacion || "",
  };
}

function normalizePublicNoticeDetail(item = {}) {
  return {
    slug: item.slug || "",
    title: item.titulo || "",
    summary: item.resumen || "",
    coverPath: item.imagen_portada_url || "",
    coverUrl: buildAbsoluteNoticeApiUrl(item.imagen_portada_url || ""),
    publishedAt: item.fecha_publicacion || "",
    contentHtml: toPublicNoticeHtml(item.contenido_sanitizado || "", item.slug || ""),
  };
}

export async function getPublicNotices({ page = 1, limit = 9 } = {}) {
  try {
    const response = await api.get(
      PUBLIC_NOTICE_BASE_PATH,
      buildPublicRequestConfig({
        params: { page, limit },
      }),
    );

    const payload = response?.data?.data || {};
    return {
      items: Array.isArray(payload.items) ? payload.items.map(normalizePublicNoticeItem) : [],
      pagination: payload.pagination || {
        page: 1,
        limit,
        total: 0,
        totalPages: 1,
      },
    };
  } catch (error) {
    throw buildPublicNoticeError(error, "No pudimos cargar los avisos.");
  }
}

export async function getPublicNoticeBySlug(slug) {
  try {
    const response = await api.get(
      `${PUBLIC_NOTICE_BASE_PATH}/${encodeURIComponent(slug)}`,
      buildPublicRequestConfig(),
    );

    return normalizePublicNoticeDetail(response?.data?.data || {});
  } catch (error) {
    throw buildPublicNoticeError(error, "El aviso solicitado no esta disponible.");
  }
}

export async function getPublicNoticeAssetPreviewBlob(slug, assetUuid) {
  try {
    const response = await api.get(
      `${PUBLIC_NOTICE_BASE_PATH}/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetUuid)}`,
      buildPublicRequestConfig({
        responseType: "blob",
        skipAuthRefresh: true,
      }),
    );

    return response?.data;
  } catch (error) {
    throw buildPublicNoticeError(error, "No pudimos cargar una imagen del aviso.");
  }
}
