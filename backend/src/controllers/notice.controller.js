"use strict";

import {
  noticeAssetPreviewValidation,
  noticeCreateValidation,
  noticeQueryValidation,
  noticeUpdateBodyValidation,
} from "../validations/notice.validation.js";
import {
  createNoticeService,
  deleteNoticeService,
  getNoticeService,
  getNoticesService,
  updateNoticeService,
} from "../services/notice.service.js";
import {
  deleteNoticeCoverService,
  getNoticeAssetAdminPreviewService,
  getNoticeAssetsService,
  uploadNoticeContentImageService,
  uploadNoticeCoverService,
} from "../services/noticeAsset.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

function buildAuthContext(req) {
  return {
    userId: req.user?.id_usuario,
    permissions: req.permissions || [],
  };
}

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

function pipeFileStream(res, payload) {
  res.setHeader("Content-Type", payload.contentType);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (payload.contentDisposition) {
    res.setHeader("Content-Disposition", payload.contentDisposition);
  }

  payload.stream.on("error", (error) => {
    console.error("Error transmitiendo asset del aviso:", error);
    if (!res.headersSent) {
      handleErrorServer(res, 500, "No fue posible transmitir el asset solicitado.");
    } else {
      res.end();
    }
  });

  payload.stream.pipe(res);
}

export const createNotice = async (req, res) => {
  try {
    const bodyWithUser = { ...req.body, id_user: req.user.id_usuario };
    const { error } = noticeCreateValidation.validate(bodyWithUser);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [notice, errorNotice] = await createNoticeService(bodyWithUser);

    if (errorNotice) {
      const clientError = buildClientError(errorNotice, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 201, "Aviso creado correctamente", notice);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
};

export async function getNotice(req, res) {
  try {
    const { error } = noticeQueryValidation.validate({ id: req.query.id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [notice, errorNotice] = await getNoticeService(
      { id: req.query.id },
      req.user?.id_usuario,
    );

    if (errorNotice) {
      const clientError = buildClientError(errorNotice, 404);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Aviso encontrado", notice);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getNotices(req, res) {
  try {
    const [notices, errorNotices] = await getNoticesService(req.user?.id_usuario);

    if (errorNotices) {
      const clientError = buildClientError(errorNotices, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Avisos encontrados", notices ?? []);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateNotice(req, res) {
  try {
    const { error: queryError } = noticeQueryValidation.validate({ id: req.query.id });
    if (queryError) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", queryError.message);
    }

    const { error: bodyError } = noticeUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion en los datos enviados", bodyError.message);
    }

    const [notice, errorNotice] = await updateNoticeService(
      { id: req.query.id },
      req.body,
      req.user?.id_usuario,
    );

    if (errorNotice) {
      const clientError = buildClientError(errorNotice, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Aviso modificado correctamente", notice);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteNotice(req, res) {
  try {
    const { error: queryError } = noticeQueryValidation.validate({ id: req.query.id });
    if (queryError) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", queryError.message);
    }

    const [noticeDeleted, errorNoticeDelete] = await deleteNoticeService(
      req.query.id,
      req.user?.id_usuario,
    );

    if (errorNoticeDelete) {
      const clientError = buildClientError(errorNoticeDelete, 404);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Aviso eliminado correctamente", noticeDeleted);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getNoticeAssets(req, res) {
  try {
    const { error } = noticeQueryValidation.validate({ id: req.query.id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [assets, serviceError] = await getNoticeAssetsService(
      req.query.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Assets del aviso encontrados", assets);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function uploadNoticeCover(req, res) {
  try {
    if (!req.file) {
      return handleErrorClient(res, 400, "Error de validacion", "Debes adjuntar una portada.");
    }

    const { error } = noticeQueryValidation.validate({ id: req.query.id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [coverAsset, serviceError] = await uploadNoticeCoverService(
      req.query.id,
      req.file,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 201, "Portada del aviso cargada correctamente", coverAsset);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteNoticeCover(req, res) {
  try {
    const { error } = noticeQueryValidation.validate({ id: req.query.id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [deletedCover, serviceError] = await deleteNoticeCoverService(
      req.query.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Portada del aviso eliminada correctamente", deletedCover);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function uploadNoticeContentImage(req, res) {
  try {
    if (!req.file) {
      return handleErrorClient(res, 400, "Error de validacion", "Debes adjuntar una imagen.");
    }

    const { error } = noticeQueryValidation.validate({ id: req.query.id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await uploadNoticeContentImageService(
      req.query.id,
      req.file,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 201, "Imagen del aviso cargada correctamente", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function previewNoticeAsset(req, res) {
  try {
    const { error } = noticeAssetPreviewValidation.validate({ assetUuid: req.params.assetUuid });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await getNoticeAssetAdminPreviewService(
      req.params.assetUuid,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return pipeFileStream(res, payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
