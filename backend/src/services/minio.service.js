"use strict";

import { Client as MinioClient } from "minio";
import { extname } from "path";
import { fileTypeFromBuffer } from "file-type";
import {
  assertMinioConfig,
  MINIO_BUCKETS,
  MINIO_FILE_RULES,
  minioClientConfig,
} from "../config/minio.config.js";

let minioClientInstance = null;

function sanitizeMetadata(metadata = {}) {
  return Object.entries(metadata).reduce((accumulator, [key, value]) => {
    if (value === undefined || value === null || value === "") {
      return accumulator;
    }

    accumulator[String(key)] = String(value);
    return accumulator;
  }, {});
}

function buildMinioError(error, fallbackMessage) {
  const errorCode = String(error?.code || "").trim();
  const statusCode = Number(error?.statusCode || 0);

  if (errorCode === "AccessDenied" || statusCode === 403) {
    return new Error("MinIO rechazo las credenciales o los permisos sobre el bucket configurado.");
  }

  if (errorCode === "NoSuchBucket" || statusCode === 404) {
    return new Error("El bucket configurado en MinIO no existe y no pudo recuperarse automaticamente.");
  }

  const message = error?.message || fallbackMessage;
  return new Error(message);
}

async function resolveMimeType(buffer, providedMimeType = "") {
  if (!buffer) {
    return providedMimeType || "application/octet-stream";
  }

  const detectedType = await fileTypeFromBuffer(buffer);
  return detectedType?.mime || providedMimeType || "application/octet-stream";
}

export function getMinioClient() {
  assertMinioConfig();

  if (!minioClientInstance) {
    minioClientInstance = new MinioClient(minioClientConfig);
  }

  return minioClientInstance;
}

export async function ensureBucketExists(bucketName) {
  if (!bucketName) {
    throw new Error("Debes indicar un bucket valido.");
  }

  try {
    const client = getMinioClient();
    const bucketExists = await client.bucketExists(bucketName);

    if (!bucketExists) {
      await client.makeBucket(bucketName);
    }

    return bucketName;
  } catch (error) {
    throw buildMinioError(
      error,
      `No fue posible verificar o crear el bucket ${bucketName}. Revisa MINIO_ENDPOINT, MINIO_PORT y la conectividad entre contenedores.`,
    );
  }
}

export async function ensureConfiguredBuckets() {
  await ensureBucketExists(MINIO_BUCKETS.private);
  await ensureBucketExists(MINIO_BUCKETS.public);

  return MINIO_BUCKETS;
}

export async function uploadBuffer({
  bucketName,
  objectKey,
  buffer,
  size,
  mimeType,
  metadata,
}) {
  if (!bucketName || !objectKey || !buffer) {
    throw new Error("Faltan datos obligatorios para subir el archivo a MinIO.");
  }

  try {
    await ensureBucketExists(bucketName);
    const client = getMinioClient();
    const resolvedMimeType = await resolveMimeType(buffer, mimeType);
    const resolvedSize = Number.isFinite(Number(size)) ? Number(size) : buffer.length;
    const safeMetadata = sanitizeMetadata({
      ...metadata,
      "Content-Type": resolvedMimeType,
    });

    await client.putObject(bucketName, objectKey, buffer, resolvedSize, safeMetadata);

    return {
      bucketName,
      objectKey,
      size: resolvedSize,
      mimeType: resolvedMimeType,
      extension: extname(objectKey),
    };
  } catch (error) {
    throw buildMinioError(
      error,
      "No fue posible subir el archivo a MinIO. Verifica la conectividad con el contenedor MinIO y los permisos del bucket.",
    );
  }
}

export async function getObjectStream({ bucketName, objectKey }) {
  if (!bucketName || !objectKey) {
    throw new Error("Debes indicar bucket y objectKey para leer un archivo.");
  }

  try {
    const client = getMinioClient();
    return await client.getObject(bucketName, objectKey);
  } catch (error) {
    throw buildMinioError(error, "No fue posible obtener el archivo solicitado desde MinIO.");
  }
}

export async function statObject({ bucketName, objectKey }) {
  if (!bucketName || !objectKey) {
    throw new Error("Debes indicar bucket y objectKey para consultar metadata.");
  }

  try {
    const client = getMinioClient();
    return await client.statObject(bucketName, objectKey);
  } catch (error) {
    throw buildMinioError(error, "No fue posible obtener metadata del archivo en MinIO.");
  }
}

export async function removeObject({ bucketName, objectKey }) {
  if (!bucketName || !objectKey) {
    throw new Error("Debes indicar bucket y objectKey para eliminar un archivo.");
  }

  try {
    const client = getMinioClient();
    await client.removeObject(bucketName, objectKey);
    return true;
  } catch (error) {
    throw buildMinioError(error, "No fue posible eliminar el archivo desde MinIO.");
  }
}

export async function presignedGetObject({ bucketName, objectKey, expirySeconds }) {
  if (!bucketName || !objectKey) {
    throw new Error("Debes indicar bucket y objectKey para generar un enlace temporal.");
  }

  try {
    const client = getMinioClient();
    const effectiveExpiry = Number.isFinite(Number(expirySeconds))
      ? Number(expirySeconds)
      : MINIO_FILE_RULES.presignedExpirationSeconds;

    return await client.presignedGetObject(bucketName, objectKey, effectiveExpiry);
  } catch (error) {
    throw buildMinioError(error, "No fue posible generar el enlace temporal del archivo.");
  }
}
