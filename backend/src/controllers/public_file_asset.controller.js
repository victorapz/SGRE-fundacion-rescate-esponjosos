"use strict";

import { publicFileAssetIdValidation } from "../validations/sponsorship.validation.js";
import { getPublicAnimalFilePreviewService } from "../services/publicFileAsset.service.js";
import {
  handleErrorClient,
  handleErrorServer,
} from "../handlers/responseHandlers.js";

function pipePublicFileStream(res, payload) {
  res.setHeader("Content-Type", payload.contentType);
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (payload.contentDisposition) {
    res.setHeader("Content-Disposition", payload.contentDisposition);
  }

  payload.stream.on("error", (error) => {
    console.error("Error transmitiendo archivo publico:", error);
    if (!res.headersSent) {
      handleErrorServer(res, 500, "No fue posible transmitir el archivo solicitado.");
    } else {
      res.end();
    }
  });

  payload.stream.pipe(res);
}

export async function getPublicAnimalFilePreview(req, res) {
  try {
    const { error } = publicFileAssetIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [payload, serviceError] = await getPublicAnimalFilePreviewService(req.params.publicId);
    if (serviceError) {
      return handleErrorClient(
        res,
        serviceError.statusCode || 404,
        serviceError.message || "Archivo publico no encontrado.",
      );
    }

    return pipePublicFileStream(res, payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
