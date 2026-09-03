"use strict";

import {
  FILE_ALLOWED_DOCUMENT_MIME_LIST,
  FILE_ALLOWED_IMAGE_MIME_LIST,
  FILE_MAX_SIZE_MB,
  FILE_PUBLIC_DELIVERY_MODE,
  MINIO_ACCESS_KEY,
  MINIO_BUCKET_PRIVATE,
  MINIO_BUCKET_PUBLIC,
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_PRESIGNED_EXPIRATION,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
} from "./configEnv.js";

const REQUIRED_MINIO_CONFIG = [
  ["MINIO_ENDPOINT", MINIO_ENDPOINT],
  ["MINIO_ACCESS_KEY", MINIO_ACCESS_KEY],
  ["MINIO_SECRET_KEY", MINIO_SECRET_KEY],
];

export const minioClientConfig = {
  endPoint: MINIO_ENDPOINT,
  port: Number(MINIO_PORT),
  useSSL: Boolean(MINIO_USE_SSL),
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
};

export const MINIO_BUCKETS = {
  private: MINIO_BUCKET_PRIVATE,
  public: MINIO_BUCKET_PUBLIC,
};

export const MINIO_ALLOWED_MIME = {
  image: FILE_ALLOWED_IMAGE_MIME_LIST,
  document: FILE_ALLOWED_DOCUMENT_MIME_LIST,
};

export const MINIO_FILE_RULES = {
  maxFileSizeBytes: Number(FILE_MAX_SIZE_MB) * 1024 * 1024,
  publicDeliveryMode: FILE_PUBLIC_DELIVERY_MODE,
  presignedExpirationSeconds: Number(MINIO_PRESIGNED_EXPIRATION),
};

export function getMissingMinioConfig() {
  return REQUIRED_MINIO_CONFIG
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);
}

export function assertMinioConfig() {
  const missingConfig = getMissingMinioConfig();

  if (missingConfig.length > 0) {
    throw new Error(
      `Configuracion incompleta de MinIO. Faltan: ${missingConfig.join(", ")}`,
    );
  }

  if (!MINIO_BUCKETS.private || !MINIO_BUCKETS.public) {
    throw new Error(
      "Configuracion incompleta de buckets MinIO. Define MINIO_BUCKET o ambos buckets legacy.",
    );
  }

  if (!Number.isFinite(MINIO_FILE_RULES.presignedExpirationSeconds) || MINIO_FILE_RULES.presignedExpirationSeconds <= 0) {
    throw new Error("MINIO_PRESIGNED_EXPIRATION debe ser un numero mayor a 0.");
  }

  if (!Number.isFinite(MINIO_FILE_RULES.maxFileSizeBytes) || MINIO_FILE_RULES.maxFileSizeBytes <= 0) {
    throw new Error("FILE_MAX_SIZE_MB debe ser un numero mayor a 0.");
  }
}
