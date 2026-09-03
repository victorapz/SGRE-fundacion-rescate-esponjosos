"use strict";

import { buildInlineContentDisposition } from "./file_asset.service.js";
import { getObjectStream } from "./minio.service.js";
import {
  AppDataSource,
  FileAsset,
  PUBLIC_SPONSORSHIP_FILE_CONTEXTS,
} from "./financialConcept/sponsorship.shared.js";
import {
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
  FILE_ASSET_VISIBILITY,
} from "../entities/file_asset.entity.js";

function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

export async function getPublicAnimalFilePreviewService(publicId) {
  try {
    const fileAsset = await AppDataSource.getRepository(FileAsset).findOne({
      where: {
        public_id: String(publicId || "").trim().toLowerCase(),
        entity_type: FILE_ASSET_ENTITY_TYPES.ANIMAL,
        visibility: FILE_ASSET_VISIBILITY.PUBLICO,
        status: FILE_ASSET_STATUS.ACTIVO,
      },
    });

    if (!fileAsset || !PUBLIC_SPONSORSHIP_FILE_CONTEXTS.includes(fileAsset.context)) {
      return [null, buildServiceError("Archivo publico no encontrado.", 404)];
    }

    const stream = await getObjectStream({
      bucketName: fileAsset.bucket,
      objectKey: fileAsset.object_key,
    });

    return [{
      stream,
      contentType: fileAsset.mime_type,
      contentDisposition: buildInlineContentDisposition(fileAsset.original_name),
    }, null];
  } catch (error) {
    console.error("Error al obtener preview publico del archivo:", error);
    return [null, buildServiceError("Error interno al obtener el archivo publico.", 500)];
  }
}
