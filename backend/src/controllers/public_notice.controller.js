"use strict";

import {
  noticeAssetPreviewValidation,
  publicNoticeListValidation,
  publicNoticeSlugValidation,
} from "../validations/notice.validation.js";
import {
  getPublicNoticeBySlugService,
  getPublicNoticesService,
} from "../services/notice.service.js";
import { getNoticePublicAssetStreamService } from "../services/noticeAsset.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

function buildClientError(error, fallbackStatus = 400) {
  if (!error) {
    return { statusCode: fallbackStatus, message: "Error de validacion." };
  }

  if (typeof error === "string") {
    return { statusCode: fallbackStatus, message: error };
  }

  return {
    statusCode: error.statusCode || fallbackStatus,
    message: error.message || "Error de validacion.",
  };
}

function pipePublicFileStream(res, payload) {
  res.setHeader("Content-Type", payload.contentType);
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (payload.contentDisposition) {
    res.setHeader("Content-Disposition", payload.contentDisposition);
  }

  payload.stream.on("error", (error) => {
    console.error("Error transmitiendo asset publico del aviso:", error);
    if (!res.headersSent) {
      handleErrorServer(res, 500, "No fue posible transmitir el asset solicitado.");
    } else {
      res.end();
    }
  });

  payload.stream.pipe(res);
}

export async function getPublicNotices(req, res) {
  try {
    const { error, value } = publicNoticeListValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await getPublicNoticesService(value);

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Avisos publicos encontrados", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPublicNoticeBySlug(req, res) {
  try {
    const { error } = publicNoticeSlugValidation.validate({ slug: req.params.slug });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await getPublicNoticeBySlugService(req.params.slug);

    if (serviceError) {
      const clientError = buildClientError(serviceError, 404);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Aviso publico encontrado", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPublicNoticeAsset(req, res) {
  try {
    const { error: slugError } = publicNoticeSlugValidation.validate({ slug: req.params.slug });
    if (slugError) {
      return handleErrorClient(res, 400, "Error de validacion", slugError.message);
    }

    const { error: assetError } = noticeAssetPreviewValidation.validate({
      assetUuid: req.params.assetUuid,
    });
    if (assetError) {
      return handleErrorClient(res, 400, "Error de validacion", assetError.message);
    }

    const [payload, serviceError] = await getNoticePublicAssetStreamService(
      req.params.slug,
      req.params.assetUuid,
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 404);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return pipePublicFileStream(res, payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
