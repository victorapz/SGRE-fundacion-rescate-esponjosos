"use strict";

import {
  deleteFileValidation,
  fileAssetIdParamValidation,
  listFilesValidation,
  markAsMainValidation,
  uploadFileValidation,
} from "../validations/file_asset.validation.js";
import {
  createFileAssetService,
  deleteFileAssetService,
  getFileAssetDownloadService,
  getFileAssetPreviewService,
  getFileAssetsService,
  markFileAssetAsMainService,
} from "../services/file_asset.service.js";
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
  res.setHeader("Content-Disposition", payload.contentDisposition);

  payload.stream.on("error", (error) => {
    console.error("Error transmitiendo archivo:", error);
    if (!res.headersSent) {
      handleErrorServer(res, 500, "No fue posible transmitir el archivo solicitado.");
    } else {
      res.end();
    }
  });

  payload.stream.pipe(res);
}

export async function uploadFileAsset(req, res) {
  try {
    if (!req.file) {
      return handleErrorClient(res, 400, "Error de validacion", "Debes adjuntar un archivo.");
    }

    const { error, value } = uploadFileValidation.validate(req.body);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [fileAsset, serviceError] = await createFileAssetService(
      value,
      req.file,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 201, "Archivo cargado correctamente", fileAsset);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getFileAssets(req, res) {
  try {
    const { error, value } = listFilesValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [files, serviceError] = await getFileAssetsService(value, buildAuthContext(req));

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Archivos encontrados", files ?? []);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function previewFileAsset(req, res) {
  try {
    const { error } = fileAssetIdParamValidation.validate(req.params);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await getFileAssetPreviewService(
      req.params.id,
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

export async function downloadFileAsset(req, res) {
  try {
    const { error } = fileAssetIdParamValidation.validate(req.params);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await getFileAssetDownloadService(
      req.params.id,
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

export async function markFileAssetAsMain(req, res) {
  try {
    const { error } = markAsMainValidation.validate(req.params);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [fileAsset, serviceError] = await markFileAssetAsMainService(
      req.params.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Archivo principal actualizado correctamente", fileAsset);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteFileAsset(req, res) {
  try {
    const { error } = deleteFileValidation.validate(req.params);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [fileAsset, serviceError] = await deleteFileAssetService(
      req.params.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Archivo eliminado correctamente", fileAsset);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
