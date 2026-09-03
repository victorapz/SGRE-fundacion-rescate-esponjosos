"use strict";

import multer from "multer";
import {
  FILE_ALLOWED_DOCUMENT_MIME_LIST,
  FILE_ALLOWED_IMAGE_MIME_LIST,
  FILE_MAX_SIZE_MB,
} from "../config/configEnv.js";

const memoryStorage = multer.memoryStorage();
const maxFileSizeBytes = Number(FILE_MAX_SIZE_MB) * 1024 * 1024;

function buildAllowedMimeSet(category) {
  if (category === "image") {
    return new Set(FILE_ALLOWED_IMAGE_MIME_LIST);
  }

  return new Set(FILE_ALLOWED_DOCUMENT_MIME_LIST);
}

function createFileFilter(category) {
  const allowedMimeTypes = buildAllowedMimeSet(category);

  return (req, file, callback) => {
    if (!file) {
      callback(new Error("No se recibio ningun archivo."));
      return;
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new Error(
          `Tipo de archivo no permitido para ${category}. Permitidos: ${[...allowedMimeTypes].join(", ")}`,
        ),
      );
      return;
    }

    callback(null, true);
  };
}

function createUploader(category) {
  return multer({
    storage: memoryStorage,
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
    },
    fileFilter: createFileFilter(category),
  });
}

export function uploadSingleFile(fieldName = "file", category = "document") {
  return createUploader(category).single(fieldName);
}

export function uploadSingleImage(fieldName = "file") {
  return createUploader("image").single(fieldName);
}

export function uploadSingleDocument(fieldName = "file") {
  return createUploader("document").single(fieldName);
}
