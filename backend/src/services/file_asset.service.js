"use strict";

import crypto from "crypto";
import { basename, extname } from "path";
import { In } from "typeorm";
import { fileTypeFromBuffer } from "file-type";
import { AppDataSource } from "../config/configDb.js";
import { MINIO_BUCKETS } from "../config/minio.config.js";
import FileAsset, {
  FILE_ASSET_CONTEXT_RULES,
  FILE_ASSET_CONTEXTS,
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_MAIN_CONTEXTS,
  FILE_ASSET_STATUS,
  FILE_ASSET_VISIBILITY,
} from "../entities/file_asset.entity.js";
import {
  getObjectStream,
  removeObject,
  uploadBuffer,
} from "./minio.service.js";

const GENERAL_PERMISSION_MAP = {
  read: ["files:file:read"],
  upload: ["files:file:upload"],
  download: ["files:file:download"],
  delete: ["files:file:delete"],
  update: ["files:file:update"],
  manage_visibility: ["files:file:manage_visibility"],
};

const CONTEXT_PERMISSION_MAP = {
  animal: {
    read: ["files:animal:read"],
    upload: ["files:animal:upload"],
    delete: ["files:animal:delete"],
    update: ["files:animal:upload"],
  },
  notice: {
    read: ["home:notice:read"],
    upload: ["home:notice:create", "home:notice:update"],
    delete: ["home:notice:update"],
    update: ["home:notice:update"],
  },
  animal_clinical: {
    read: ["files:animal_clinical:read"],
    upload: ["files:animal_clinical:upload"],
    delete: ["files:animal_clinical:delete"],
    update: ["files:animal_clinical:upload"],
  },
  user_document: {
    read: ["files:user_document:read"],
    upload: ["files:user_document:upload"],
    delete: ["files:user_document:delete"],
  },
  accounting: {
    read: ["files:accounting:read"],
    upload: ["files:accounting:upload"],
    delete: ["files:accounting:delete"],
  },
};

const MIME_EXTENSION_RULES = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

const IMAGE_AND_PDF_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PDF_ONLY_MIME_TYPES = new Set(["application/pdf"]);

const CONTEXT_ALLOWED_MIME_TYPES = {
  [FILE_ASSET_CONTEXTS.NOTICE_COVER]: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  [FILE_ASSET_CONTEXTS.NOTICE_CONTENT_IMAGE]: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  [FILE_ASSET_CONTEXTS.INTAKE_RECORD_ATTACHMENT]: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  [FILE_ASSET_CONTEXTS.EXAM_ATTACHMENT]: IMAGE_AND_PDF_MIME_TYPES,
  [FILE_ASSET_CONTEXTS.HOSPITALIZATION_ATTACHMENT]: IMAGE_AND_PDF_MIME_TYPES,
  [FILE_ASSET_CONTEXTS.PROCEDURE_ATTACHMENT]: IMAGE_AND_PDF_MIME_TYPES,
  [FILE_ASSET_CONTEXTS.VET_CHECKUP_ATTACHMENT]: IMAGE_AND_PDF_MIME_TYPES,
  [FILE_ASSET_CONTEXTS.USER_CONTRACT_VOLUNTEER]: PDF_ONLY_MIME_TYPES,
  [FILE_ASSET_CONTEXTS.USER_CONTRACT_FOSTER_HOME]: PDF_ONLY_MIME_TYPES,
  [FILE_ASSET_CONTEXTS.USER_CONTRACT_ADOPTION]: PDF_ONLY_MIME_TYPES,
};

function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

function normalizeBoolean(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false" || normalized === "") return false;
  }

  if (value === undefined || value === null) return false;
  return false;
}

function hasAnyPermission(permissions = [], expectedPermissions = []) {
  return expectedPermissions.some((permission) => permissions.includes(permission));
}

function normalizeExtension(rawExtension = "") {
  return String(rawExtension || "").replace(/^\./, "").trim().toLowerCase();
}

function normalizeOriginalName(originalName = "") {
  const baseName = basename(String(originalName || ""));
  return baseName
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .replace(/[\\/:"*?<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeHeaderFileName(originalName = "") {
  const normalized = normalizeOriginalName(originalName) || "archivo";
  const safeAscii = normalized
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim();

  return safeAscii || "archivo";
}

function buildContentDisposition(dispositionType, originalName) {
  const safeAscii = sanitizeHeaderFileName(originalName);
  const encodedUtf8Name = encodeURIComponent(normalizeOriginalName(originalName) || safeAscii);
  return `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8Name}`;
}

export function buildInlineContentDisposition(originalName) {
  return buildContentDisposition("inline", originalName);
}

function serializeUserReference(user) {
  if (!user) return null;

  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
  };
}

function serializeFileAsset(fileAsset) {
  if (!fileAsset) return null;

  return {
    file_asset_id: fileAsset.file_asset_id,
    public_id: fileAsset.public_id || null,
    entity_type: fileAsset.entity_type,
    entity_id: Number(fileAsset.entity_id),
    context: fileAsset.context,
    visibility: fileAsset.visibility,
    original_name: fileAsset.original_name,
    stored_name: fileAsset.stored_name,
    mime_type: fileAsset.mime_type,
    extension: fileAsset.extension,
    size_bytes: Number(fileAsset.size_bytes),
    checksum: fileAsset.checksum || null,
    title: fileAsset.title || null,
    description: fileAsset.description || null,
    sort_order: Number(fileAsset.sort_order || 0),
    is_main: Boolean(fileAsset.is_main),
    status: fileAsset.status,
    uploaded_at: fileAsset.uploaded_at,
    deleted_at: fileAsset.deleted_at || null,
    metadata: fileAsset.metadata || null,
    uploaded_by: serializeUserReference(fileAsset.uploaded_by_user),
    deleted_by: serializeUserReference(fileAsset.deleted_by_user),
    preview_url: `/api/files/${fileAsset.file_asset_id}/preview`,
    download_url: `/api/files/${fileAsset.file_asset_id}/download`,
    createdAt: fileAsset.createdAt,
    updatedAt: fileAsset.updatedAt,
  };
}

function validateContextPayload(body = {}) {
  const contextRule = FILE_ASSET_CONTEXT_RULES[body.context];

  if (!contextRule) {
    throw buildServiceError("El contexto indicado no es valido.", 400);
  }

  if (!contextRule.entityTypes.includes(body.entity_type)) {
    throw buildServiceError("El entity_type no es compatible con el contexto indicado.", 400);
  }

  if (
    body.visibility === FILE_ASSET_VISIBILITY.PUBLICO
    && contextRule.allowPublic === false
  ) {
    throw buildServiceError("El contexto indicado solo admite archivos privados.", 400);
  }
}

export function validateFileAssetPayloadRules(body = {}) {
  validateContextPayload(body);
  return true;
}

function resolveBucketByVisibility(visibility) {
  return visibility === FILE_ASSET_VISIBILITY.PUBLICO
    ? MINIO_BUCKETS.public
    : MINIO_BUCKETS.private;
}

function assertMimeAllowedForContext(context, mimeType) {
  const allowedMimeTypes = CONTEXT_ALLOWED_MIME_TYPES[context];

  if (!allowedMimeTypes) {
    return true;
  }

  if (!allowedMimeTypes.has(mimeType)) {
    throw buildServiceError(
      `El contexto ${context} solo admite archivos de tipo: ${[...allowedMimeTypes].join(", ")}.`,
      400,
    );
  }

  return true;
}

function isUserContractContext(context) {
  return [
    FILE_ASSET_CONTEXTS.USER_CONTRACT_VOLUNTEER,
    FILE_ASSET_CONTEXTS.USER_CONTRACT_FOSTER_HOME,
    FILE_ASSET_CONTEXTS.USER_CONTRACT_ADOPTION,
  ].includes(context);
}

function extensionsMatch(originalExtension, detectedExtension) {
  if (!originalExtension || !detectedExtension) return false;

  const original = normalizeExtension(originalExtension);
  const detected = normalizeExtension(detectedExtension);

  if (original === detected) return true;

  const compatibleGroups = [
    ["jpg", "jpeg"],
    ["tif", "tiff"],
  ];

  return compatibleGroups.some(
    (group) => group.includes(original) && group.includes(detected),
  );
}

function inferValidExtensionFromMime(mimeType, currentExtension) {
  const allowedExtensions = MIME_EXTENSION_RULES[mimeType] || [];
  if (allowedExtensions.length === 0) {
    return currentExtension;
  }

  return allowedExtensions.includes(currentExtension) ? currentExtension : null;
}

async function inspectUploadedFile(file) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw buildServiceError("Debes adjuntar un archivo valido.", 400);
  }

  const originalName = normalizeOriginalName(file.originalname);
  const originalExtension = normalizeExtension(extname(originalName));

  if (!originalName || !originalExtension) {
    throw buildServiceError("El archivo debe incluir una extension valida.", 400);
  }

  const detectedType = await fileTypeFromBuffer(file.buffer);
  const detectedMimeType = detectedType?.mime || null;
  const detectedExtension = normalizeExtension(detectedType?.ext || "");
  const declaredMimeType = String(file.mimetype || "").trim().toLowerCase();

  if (detectedMimeType && declaredMimeType && detectedMimeType !== declaredMimeType) {
    throw buildServiceError(
      "El tipo real del archivo no coincide con el MIME declarado.",
      400,
    );
  }

  let resolvedExtension = originalExtension;
  if (detectedExtension) {
    if (!extensionsMatch(originalExtension, detectedExtension)) {
      throw buildServiceError(
        "La extension del archivo no coincide con el tipo real detectado.",
        400,
      );
    }
    resolvedExtension = detectedExtension;
  } else {
    resolvedExtension = inferValidExtensionFromMime(declaredMimeType, originalExtension);
    if (!resolvedExtension) {
      throw buildServiceError("La extension del archivo no es valida para el MIME enviado.", 400);
    }
  }

  const effectiveMimeType = detectedMimeType || declaredMimeType || "application/octet-stream";
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  return {
    originalName,
    extension: resolvedExtension,
    mimeType: effectiveMimeType,
    sizeBytes: Number(file.size || file.buffer.length),
    checksum,
  };
}

function buildObjectKey({ entityType, entityId, context, extension }) {
  const objectId = crypto.randomUUID();
  return `${entityType}/${entityId}/${context}/${objectId}.${extension}`;
}

function getStoredNameFromObjectKey(objectKey) {
  return String(objectKey || "").split("/").pop() || objectKey;
}

function getContextScope(context) {
  return FILE_ASSET_CONTEXT_RULES[context]?.permissionScope || null;
}

function getScopedAction(action) {
  if (action === "download") return "read";
  if (action === "update") return "update";
  return action;
}

function assertActionAllowed({ permissions = [], context, action, visibility }) {
  const effectiveAction = getScopedAction(action);

  if (hasAnyPermission(permissions, GENERAL_PERMISSION_MAP[action] || [])) {
    return true;
  }

  const scope = getContextScope(context);
  const scopePermissions = CONTEXT_PERMISSION_MAP[scope]?.[effectiveAction] || [];

  if (!hasAnyPermission(permissions, scopePermissions)) {
    throw buildServiceError("No tienes permisos para realizar esta accion sobre el archivo.", 403);
  }

  if (
    action === "upload"
    && visibility === FILE_ASSET_VISIBILITY.PUBLICO
    && !hasAnyPermission(permissions, GENERAL_PERMISSION_MAP.manage_visibility)
  ) {
    throw buildServiceError(
      "No tienes permisos para cargar archivos con visibilidad publica.",
      403,
    );
  }

  return true;
}

function resolveReadableContexts(permissions = []) {
  if (hasAnyPermission(permissions, GENERAL_PERMISSION_MAP.read)) {
    return Object.values(FILE_ASSET_CONTEXTS);
  }

  return Object.values(FILE_ASSET_CONTEXTS).filter((context) => {
    const scope = getContextScope(context);
    const scopePermissions = CONTEXT_PERMISSION_MAP[scope]?.read || [];
    return hasAnyPermission(permissions, scopePermissions);
  });
}

async function loadFileAssetById(manager, fileAssetId, includeDeleted = false) {
  const repository = manager.getRepository(FileAsset);
  const where = {
    file_asset_id: Number(fileAssetId),
  };

  if (!includeDeleted) {
    where.status = FILE_ASSET_STATUS.ACTIVO;
  }

  return repository.findOne({
    where,
    relations: {
      uploaded_by_user: true,
      deleted_by_user: true,
    },
  });
}

async function loadFileAssetByPublicId(manager, publicId, includeDeleted = false) {
  const repository = manager.getRepository(FileAsset);
  const where = {
    public_id: String(publicId || "").trim(),
  };

  if (!includeDeleted) {
    where.status = FILE_ASSET_STATUS.ACTIVO;
  }

  return repository.findOne({
    where,
    relations: {
      uploaded_by_user: true,
      deleted_by_user: true,
    },
  });
}

async function clearAnimalMainFlags(manager, entityId, excludeId = null) {
  const repository = manager.getRepository(FileAsset);
  const where = {
    entity_type: FILE_ASSET_ENTITY_TYPES.ANIMAL,
    entity_id: Number(entityId),
    status: FILE_ASSET_STATUS.ACTIVO,
    context: In(FILE_ASSET_MAIN_CONTEXTS),
  };

  const filesToUpdate = await repository.find({
    where,
  });

  for (const fileAsset of filesToUpdate) {
    if (excludeId && Number(fileAsset.file_asset_id) === Number(excludeId)) {
      continue;
    }

    if (fileAsset.is_main) {
      fileAsset.is_main = false;
      await repository.save(fileAsset);
    }
  }
}

function shouldForceMain(context, isMain) {
  if (context === FILE_ASSET_CONTEXTS.ANIMAL_MAIN) {
    return true;
  }

  return normalizeBoolean(isMain);
}

function assertMainEligible(entityType, context, mimeType) {
  if (entityType !== FILE_ASSET_ENTITY_TYPES.ANIMAL) {
    throw buildServiceError("Solo los archivos de animales pueden marcarse como principales.", 400);
  }

  if (!FILE_ASSET_MAIN_CONTEXTS.includes(context)) {
    throw buildServiceError("Solo ANIMAL_MAIN o ANIMAL_GALLERY pueden marcarse como principales.", 400);
  }

  if (!String(mimeType || "").toLowerCase().startsWith("image/")) {
    throw buildServiceError("Solo las imagenes pueden marcarse como principales.", 400);
  }
}

export function validateFileAssetMainEligibility(entityType, context, mimeType) {
  assertMainEligible(entityType, context, mimeType);
  return true;
}

export async function createFileAssetService(body, file, authContext = {}) {
  let uploadedObject = null;

  try {
    const normalizedBody = {
      ...body,
      entity_id: Number(body.entity_id),
      sort_order:
        body.sort_order !== undefined && body.sort_order !== null && body.sort_order !== ""
          ? Number(body.sort_order)
          : 0,
      is_main: normalizeBoolean(body.is_main),
    };

    validateContextPayload(normalizedBody);
    assertActionAllowed({
      permissions: authContext.permissions || [],
      context: normalizedBody.context,
      action: "upload",
      visibility: normalizedBody.visibility,
    });

    const inspectedFile = await inspectUploadedFile(file);
    assertMimeAllowedForContext(normalizedBody.context, inspectedFile.mimeType);
    const effectiveIsMain = shouldForceMain(normalizedBody.context, normalizedBody.is_main);

    if (effectiveIsMain) {
      assertMainEligible(normalizedBody.entity_type, normalizedBody.context, inspectedFile.mimeType);
    }

    const objectKey = buildObjectKey({
      entityType: normalizedBody.entity_type,
      entityId: Number(normalizedBody.entity_id),
      context: normalizedBody.context,
      extension: inspectedFile.extension,
    });
    const bucket = resolveBucketByVisibility(normalizedBody.visibility);

    uploadedObject = await uploadBuffer({
      bucketName: bucket,
      objectKey,
      buffer: file.buffer,
      size: inspectedFile.sizeBytes,
      mimeType: inspectedFile.mimeType,
      metadata: {
        entity_type: normalizedBody.entity_type,
        entity_id: Number(normalizedBody.entity_id),
        context: normalizedBody.context,
        visibility: normalizedBody.visibility,
      },
    });

    const savedFileAsset = await AppDataSource.transaction(async (manager) => {
      if (effectiveIsMain && normalizedBody.entity_type === FILE_ASSET_ENTITY_TYPES.ANIMAL) {
        await clearAnimalMainFlags(manager, normalizedBody.entity_id);
      }

      const repository = manager.getRepository(FileAsset);
      if (isUserContractContext(normalizedBody.context)) {
        const existingActiveContract = await repository.findOne({
          where: {
            entity_type: normalizedBody.entity_type,
            entity_id: Number(normalizedBody.entity_id),
            context: normalizedBody.context,
            status: FILE_ASSET_STATUS.ACTIVO,
          },
        });

        if (existingActiveContract) {
          throw buildServiceError(
            "El usuario ya tiene un contrato activo de este tipo. Elimina el contrato actual antes de subir uno nuevo.",
            400,
          );
        }
      }

      const fileAsset = repository.create({
        public_id: crypto.randomUUID(),
        entity_type: normalizedBody.entity_type,
        entity_id: Number(normalizedBody.entity_id),
        context: normalizedBody.context,
        visibility: normalizedBody.visibility,
        bucket,
        object_key: objectKey,
        original_name: inspectedFile.originalName,
        stored_name: getStoredNameFromObjectKey(objectKey),
        mime_type: inspectedFile.mimeType,
        extension: inspectedFile.extension,
        size_bytes: inspectedFile.sizeBytes,
        checksum: inspectedFile.checksum,
        title: normalizedBody.title || null,
        description: normalizedBody.description || null,
        sort_order: Number(normalizedBody.sort_order || 0),
        is_main: effectiveIsMain,
        status: FILE_ASSET_STATUS.ACTIVO,
        uploaded_at: new Date(),
        metadata: null,
        uploaded_by_user: authContext.userId
          ? { id_usuario: Number(authContext.userId) }
          : null,
      });

      const saved = await repository.save(fileAsset);
      return loadFileAssetById(manager, saved.file_asset_id, true);
    });

    return [serializeFileAsset(savedFileAsset), null];
  } catch (error) {
    if (uploadedObject?.bucketName && uploadedObject?.objectKey) {
      try {
        await removeObject({
          bucketName: uploadedObject.bucketName,
          objectKey: uploadedObject.objectKey,
        });
      } catch (cleanupError) {
        console.error("No fue posible compensar la subida fallida en MinIO:", cleanupError);
      }
    }

    console.error("Error al crear archivo:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al crear el archivo", 500)];
  }
}

export async function getFileAssetsService(query, authContext = {}) {
  try {
    const allowedContexts = resolveReadableContexts(authContext.permissions || []);

    if (allowedContexts.length === 0) {
      return [null, buildServiceError("No tienes permisos para consultar archivos.", 403)];
    }

    if (query.context && !allowedContexts.includes(query.context)) {
      return [null, buildServiceError("No tienes permisos para consultar ese contexto.", 403)];
    }

    const repository = AppDataSource.getRepository(FileAsset);
    const where = {
      status: query.status || FILE_ASSET_STATUS.ACTIVO,
    };

    if (query.entity_type) {
      where.entity_type = query.entity_type;
    }

    if (query.entity_id) {
      where.entity_id = Number(query.entity_id);
    }

    if (query.context) {
      where.context = query.context;
    } else {
      where.context = In(allowedContexts);
    }

    if (query.visibility) {
      where.visibility = query.visibility;
    }

    const files = await repository.find({
      where,
      relations: {
        uploaded_by_user: true,
        deleted_by_user: true,
      },
      order: {
        is_main: "DESC",
        sort_order: "ASC",
        uploaded_at: "DESC",
      },
    });

    return [files.map((fileAsset) => serializeFileAsset(fileAsset)), null];
  } catch (error) {
    console.error("Error al listar archivos:", error);
    return [null, buildServiceError("Error interno al listar archivos.", 500)];
  }
}

async function loadActiveFileAssetForAction(fileAssetId) {
  const manager = AppDataSource.manager;
  const fileAsset = await loadFileAssetById(manager, fileAssetId, false);

  if (!fileAsset || fileAsset.status !== FILE_ASSET_STATUS.ACTIVO) {
    throw buildServiceError("Archivo no encontrado.", 404);
  }

  return fileAsset;
}

async function loadActiveFileAssetForActionByPublicId(publicId) {
  const manager = AppDataSource.manager;
  const fileAsset = await loadFileAssetByPublicId(manager, publicId, false);

  if (!fileAsset || fileAsset.status !== FILE_ASSET_STATUS.ACTIVO) {
    throw buildServiceError("Archivo no encontrado.", 404);
  }

  return fileAsset;
}

export async function getFileAssetPreviewService(fileAssetId, authContext = {}) {
  try {
    const fileAsset = await loadActiveFileAssetForAction(fileAssetId);

    assertActionAllowed({
      permissions: authContext.permissions || [],
      context: fileAsset.context,
      action: "read",
      visibility: fileAsset.visibility,
    });

    const stream = await getObjectStream({
      bucketName: fileAsset.bucket,
      objectKey: fileAsset.object_key,
    });

    return [{
      fileAsset,
      stream,
      contentType: fileAsset.mime_type,
      contentDisposition: buildContentDisposition("inline", fileAsset.original_name),
    }, null];
  } catch (error) {
    console.error("Error al previsualizar archivo:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al obtener el archivo.", 500)];
  }
}

export async function getFileAssetPreviewByPublicIdService(publicId, authContext = {}) {
  try {
    const fileAsset = await loadActiveFileAssetForActionByPublicId(publicId);

    assertActionAllowed({
      permissions: authContext.permissions || [],
      context: fileAsset.context,
      action: "read",
      visibility: fileAsset.visibility,
    });

    const stream = await getObjectStream({
      bucketName: fileAsset.bucket,
      objectKey: fileAsset.object_key,
    });

    return [{
      fileAsset,
      stream,
      contentType: fileAsset.mime_type,
      contentDisposition: buildContentDisposition("inline", fileAsset.original_name),
    }, null];
  } catch (error) {
    console.error("Error al previsualizar archivo por public_id:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al obtener el archivo.", 500)];
  }
}

export async function getFileAssetDownloadService(fileAssetId, authContext = {}) {
  try {
    const fileAsset = await loadActiveFileAssetForAction(fileAssetId);

    assertActionAllowed({
      permissions: authContext.permissions || [],
      context: fileAsset.context,
      action: "download",
      visibility: fileAsset.visibility,
    });

    const stream = await getObjectStream({
      bucketName: fileAsset.bucket,
      objectKey: fileAsset.object_key,
    });

    return [{
      fileAsset,
      stream,
      contentType: fileAsset.mime_type,
      contentDisposition: buildContentDisposition("attachment", fileAsset.original_name),
    }, null];
  } catch (error) {
    console.error("Error al descargar archivo:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al descargar el archivo.", 500)];
  }
}

export async function markFileAssetAsMainService(fileAssetId, authContext = {}) {
  try {
    const updatedFile = await AppDataSource.transaction(async (manager) => {
      const fileAsset = await loadFileAssetById(manager, fileAssetId, false);

      if (!fileAsset || fileAsset.status !== FILE_ASSET_STATUS.ACTIVO) {
        throw buildServiceError("Archivo no encontrado.", 404);
      }

      assertMainEligible(fileAsset.entity_type, fileAsset.context, fileAsset.mime_type);
      assertActionAllowed({
        permissions: authContext.permissions || [],
        context: fileAsset.context,
        action: "update",
        visibility: fileAsset.visibility,
      });

      await clearAnimalMainFlags(manager, fileAsset.entity_id, fileAsset.file_asset_id);
      fileAsset.is_main = true;
      await manager.getRepository(FileAsset).save(fileAsset);

      return loadFileAssetById(manager, fileAsset.file_asset_id, true);
    });

    return [serializeFileAsset(updatedFile), null];
  } catch (error) {
    console.error("Error al marcar archivo principal:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al marcar el archivo principal.", 500)];
  }
}

export async function deleteFileAssetService(fileAssetId, authContext = {}) {
  try {
    const deletedFile = await AppDataSource.transaction(async (manager) => {
      const fileAsset = await loadFileAssetById(manager, fileAssetId, false);

      if (!fileAsset || fileAsset.status !== FILE_ASSET_STATUS.ACTIVO) {
        throw buildServiceError("Archivo no encontrado.", 404);
      }

      assertActionAllowed({
        permissions: authContext.permissions || [],
        context: fileAsset.context,
        action: "delete",
        visibility: fileAsset.visibility,
      });

      fileAsset.status = FILE_ASSET_STATUS.ELIMINADO;
      fileAsset.deleted_at = new Date();
      fileAsset.deleted_by_user = authContext.userId
        ? { id_usuario: Number(authContext.userId) }
        : null;
      fileAsset.is_main = false;

      await manager.getRepository(FileAsset).save(fileAsset);
      return loadFileAssetById(manager, fileAsset.file_asset_id, true);
    });

    return [serializeFileAsset(deletedFile), null];
  } catch (error) {
    console.error("Error al eliminar archivo:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al eliminar el archivo.", 500)];
  }
}

export async function deleteFileAssetByPublicIdService(publicId, authContext = {}) {
  try {
    const deletedFile = await AppDataSource.transaction(async (manager) => {
      const fileAsset = await loadFileAssetByPublicId(manager, publicId, false);

      if (!fileAsset || fileAsset.status !== FILE_ASSET_STATUS.ACTIVO) {
        throw buildServiceError("Archivo no encontrado.", 404);
      }

      assertActionAllowed({
        permissions: authContext.permissions || [],
        context: fileAsset.context,
        action: "delete",
        visibility: fileAsset.visibility,
      });

      fileAsset.status = FILE_ASSET_STATUS.ELIMINADO;
      fileAsset.deleted_at = new Date();
      fileAsset.deleted_by_user = authContext.userId
        ? { id_usuario: Number(authContext.userId) }
        : null;
      fileAsset.is_main = false;

      await manager.getRepository(FileAsset).save(fileAsset);
      return loadFileAssetById(manager, fileAsset.file_asset_id, true);
    });

    return [serializeFileAsset(deletedFile), null];
  } catch (error) {
    console.error("Error al eliminar archivo por public_id:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al eliminar el archivo.", 500)];
  }
}

export async function getFileAssetByPublicIdService(publicId, includeDeleted = false) {
  try {
    const fileAsset = await loadFileAssetByPublicId(AppDataSource.manager, publicId, includeDeleted);
    return [fileAsset ? serializeFileAsset(fileAsset) : null, null];
  } catch (error) {
    console.error("Error al obtener archivo por public_id:", error);
    return [null, buildServiceError("Error interno al consultar el archivo.", 500)];
  }
}
