"use strict";

import { In } from "typeorm";
import { AppDataSource } from "../config/configDb.js";
import FileAsset, {
  FILE_ASSET_CONTEXTS,
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
  FILE_ASSET_VISIBILITY,
} from "../entities/file_asset.entity.js";
import Notice from "../entities/notice.entity.js";
import {
  buildInlineContentDisposition,
  createFileAssetService,
  getFileAssetPreviewByPublicIdService,
} from "./file_asset.service.js";
import { getObjectStream } from "./minio.service.js";
import {
  NOTICE_ALLOWED_IMAGE_MIME_TYPES,
  NOTICE_STATUS,
  ensureNoticeAssetPublicId,
  isNoticePubliclyVisible,
} from "./notice.shared.js";

function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

export function serializeNoticeAsset(fileAsset) {
  if (!fileAsset) return null;

  return {
    file_asset_id: fileAsset.file_asset_id,
    public_id: fileAsset.public_id,
    entity_type: fileAsset.entity_type,
    entity_id: Number(fileAsset.entity_id),
    context: fileAsset.context,
    visibility: fileAsset.visibility,
    original_name: fileAsset.original_name,
    stored_name: fileAsset.stored_name,
    mime_type: fileAsset.mime_type,
    extension: fileAsset.extension,
    size_bytes: Number(fileAsset.size_bytes || 0),
    title: fileAsset.title || null,
    description: fileAsset.description || null,
    uploaded_at: fileAsset.uploaded_at,
    status: fileAsset.status,
  };
}

async function ensureNoticeExists(manager, noticeId) {
  const repository = manager.getRepository(Notice);
  const notice = await repository.findOne({
    where: { id_aviso: Number(noticeId) },
    relations: {
      user: true,
    },
  });

  if (!notice) {
    throw buildServiceError("Aviso no encontrado.", 404);
  }

  return notice;
}

async function ensureNoticeBelongsToUser(manager, noticeId, userId) {
  const notice = await ensureNoticeExists(manager, noticeId);

  if (Number(notice.user?.id_usuario) !== Number(userId)) {
    throw buildServiceError("No autorizado para modificar este aviso.", 403);
  }

  return notice;
}

async function ensureNoticeAssetPublicIds(manager, assets = []) {
  const repository = manager.getRepository(FileAsset);
  let updated = false;

  for (const asset of assets) {
    if (!asset.public_id) {
      ensureNoticeAssetPublicId(asset);
      updated = true;
      await repository.save(asset);
    }
  }

  return updated;
}

async function listRawNoticeAssets(manager, noticeId, contexts = null) {
  const repository = manager.getRepository(FileAsset);
  const where = {
    entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
    entity_id: Number(noticeId),
    status: FILE_ASSET_STATUS.ACTIVO,
  };

  if (contexts) {
    where.context = Array.isArray(contexts) ? In(contexts) : contexts;
  }

  const assets = await repository.find({
    where,
    order: {
      uploaded_at: "DESC",
      file_asset_id: "DESC",
    },
  });

  await ensureNoticeAssetPublicIds(manager, assets);
  return assets;
}

export async function getNoticeAssetsMap(manager, noticeId) {
  const assets = await listRawNoticeAssets(
    manager,
    noticeId,
    [FILE_ASSET_CONTEXTS.NOTICE_COVER, FILE_ASSET_CONTEXTS.NOTICE_CONTENT_IMAGE],
  );

  const cover = assets.find((asset) => asset.context === FILE_ASSET_CONTEXTS.NOTICE_COVER) || null;
  const contentImages = assets.filter(
    (asset) => asset.context === FILE_ASSET_CONTEXTS.NOTICE_CONTENT_IMAGE,
  );

  return {
    cover,
    contentImages,
  };
}

export async function validateNoticeContentImageAssets(manager, noticeId, imageAssetUuids = []) {
  if (!Array.isArray(imageAssetUuids) || imageAssetUuids.length === 0) {
    return [];
  }

  const normalizedUuids = [...new Set(imageAssetUuids.map((item) => String(item).trim().toLowerCase()))];
  const repository = manager.getRepository(FileAsset);
  const assets = await repository.find({
    where: {
      public_id: In(normalizedUuids),
      entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
      entity_id: Number(noticeId),
      context: FILE_ASSET_CONTEXTS.NOTICE_CONTENT_IMAGE,
      status: FILE_ASSET_STATUS.ACTIVO,
    },
  });

  await ensureNoticeAssetPublicIds(manager, assets);
  const assetMap = new Map(assets.map((asset) => [String(asset.public_id).toLowerCase(), asset]));

  for (const publicId of normalizedUuids) {
    const asset = assetMap.get(publicId);

    if (!asset) {
      throw buildServiceError("El contenido del aviso referencia una imagen no valida.", 400);
    }

    if (!NOTICE_ALLOWED_IMAGE_MIME_TYPES.has(asset.mime_type)) {
      throw buildServiceError("El contenido del aviso referencia un archivo no permitido.", 400);
    }
  }

  return assets;
}

export async function validateNoticeCoverAsset(manager, noticeId) {
  const assets = await listRawNoticeAssets(manager, noticeId, FILE_ASSET_CONTEXTS.NOTICE_COVER);
  if (assets.length === 0) return null;

  const cover = assets[0];
  if (!NOTICE_ALLOWED_IMAGE_MIME_TYPES.has(cover.mime_type)) {
    throw buildServiceError("La portada del aviso no tiene un tipo de archivo permitido.", 400);
  }

  return cover;
}

export async function getNoticeAssetsService(noticeId, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      await ensureNoticeBelongsToUser(manager, noticeId, authContext.userId);
      const assets = await getNoticeAssetsMap(manager, noticeId);

      return {
        cover: serializeNoticeAsset(assets.cover),
        content_images: assets.contentImages.map(serializeNoticeAsset),
      };
    });

    return [result, null];
  } catch (error) {
    console.error("Error al obtener assets del aviso:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al obtener los assets del aviso.", 500)];
  }
}

async function clearPreviousNoticeCovers(
  manager,
  noticeId,
  currentAuthContext = {},
  keepFileAssetId = null,
) {
  const repository = manager.getRepository(FileAsset);
  const previousCovers = await repository.find({
    where: {
      entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
      entity_id: Number(noticeId),
      context: FILE_ASSET_CONTEXTS.NOTICE_COVER,
      status: FILE_ASSET_STATUS.ACTIVO,
    },
  });

  for (const cover of previousCovers) {
    if (keepFileAssetId && Number(cover.file_asset_id) === Number(keepFileAssetId)) {
      continue;
    }

    cover.status = FILE_ASSET_STATUS.ELIMINADO;
    cover.deleted_at = new Date();
    cover.deleted_by_user = currentAuthContext?.userId
      ? { id_usuario: Number(currentAuthContext.userId) }
      : null;
    await repository.save(cover);
  }
}

export async function uploadNoticeCoverService(noticeId, file, currentAuthContext = {}) {
  try {
    await AppDataSource.transaction(async (manager) => {
      await ensureNoticeBelongsToUser(manager, noticeId, currentAuthContext.userId);
    });

    const [createdAsset, serviceError] = await createFileAssetService(
      {
        entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
        entity_id: Number(noticeId),
        context: FILE_ASSET_CONTEXTS.NOTICE_COVER,
        visibility: FILE_ASSET_VISIBILITY.PRIVADO,
      },
      file,
      currentAuthContext,
    );

    if (serviceError) {
      return [null, serviceError];
    }

    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(FileAsset);
      const persistedAsset = await repository.findOne({
        where: { file_asset_id: Number(createdAsset.file_asset_id) },
      });

      await ensureNoticeBelongsToUser(manager, noticeId, currentAuthContext.userId);
      await clearPreviousNoticeCovers(
        manager,
        noticeId,
        currentAuthContext,
        createdAsset.file_asset_id,
      );
      await ensureNoticeAssetPublicIds(manager, [persistedAsset]);

      return serializeNoticeAsset(persistedAsset);
    });

    return [result, null];
  } catch (error) {
    console.error("Error al subir portada del aviso:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al subir la portada.", 500)];
  }
}

export async function deleteNoticeCoverService(noticeId, currentAuthContext = {}) {
  try {
    const deletedCover = await AppDataSource.transaction(async (manager) => {
      await ensureNoticeBelongsToUser(manager, noticeId, currentAuthContext.userId);
      const repository = manager.getRepository(FileAsset);
      const cover = await repository.findOne({
        where: {
          entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
          entity_id: Number(noticeId),
          context: FILE_ASSET_CONTEXTS.NOTICE_COVER,
          status: FILE_ASSET_STATUS.ACTIVO,
        },
        order: {
          uploaded_at: "DESC",
          file_asset_id: "DESC",
        },
      });

      if (!cover) {
        return null;
      }

      cover.status = FILE_ASSET_STATUS.ELIMINADO;
      cover.deleted_at = new Date();
      cover.deleted_by_user = currentAuthContext.userId
        ? { id_usuario: Number(currentAuthContext.userId) }
        : null;
      await repository.save(cover);

      return serializeNoticeAsset(cover);
    });

    return [deletedCover, null];
  } catch (error) {
    console.error("Error al eliminar portada del aviso:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al eliminar la portada.", 500)];
  }
}

export async function uploadNoticeContentImageService(noticeId, file, currentAuthContext = {}) {
  try {
    await AppDataSource.transaction(async (manager) => {
      await ensureNoticeBelongsToUser(manager, noticeId, currentAuthContext.userId);
    });

    const [createdAsset, serviceError] = await createFileAssetService(
      {
        entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
        entity_id: Number(noticeId),
        context: FILE_ASSET_CONTEXTS.NOTICE_CONTENT_IMAGE,
        visibility: FILE_ASSET_VISIBILITY.PRIVADO,
      },
      file,
      currentAuthContext,
    );

    if (serviceError) {
      return [null, serviceError];
    }

    const payload = {
      asset: createdAsset,
      html: `<img data-notice-asset-id="${createdAsset.public_id}" src="/api/notice/assets/${createdAsset.public_id}/preview" alt="${String(createdAsset.original_name || "Imagen del aviso").replace(/"/g, "&quot;")}" />`,
    };

    return [payload, null];
  } catch (error) {
    console.error("Error al subir imagen del contenido del aviso:", error);
    return [null, error?.message ? error : buildServiceError("Error interno al subir la imagen del aviso.", 500)];
  }
}

export async function getNoticeAssetAdminPreviewService(assetUuid, currentAuthContext = {}) {
  return getFileAssetPreviewByPublicIdService(assetUuid, currentAuthContext);
}

export async function getNoticePublicAssetStreamService(slug, assetUuid) {
  try {
    const payload = await AppDataSource.transaction(async (manager) => {
      const noticeRepository = manager.getRepository(Notice);
      const fileAssetRepository = manager.getRepository(FileAsset);

      const notice = await noticeRepository.findOne({
        where: { slug: String(slug || "").trim() },
      });

      if (!notice || !isNoticePubliclyVisible(notice)) {
        throw buildServiceError("El aviso solicitado no esta disponible.", 404);
      }

      const asset = await fileAssetRepository.findOne({
        where: {
          public_id: String(assetUuid || "").trim().toLowerCase(),
          entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
          entity_id: Number(notice.id_aviso),
          context: In([FILE_ASSET_CONTEXTS.NOTICE_COVER, FILE_ASSET_CONTEXTS.NOTICE_CONTENT_IMAGE]),
          status: FILE_ASSET_STATUS.ACTIVO,
        },
      });

      if (!asset || !NOTICE_ALLOWED_IMAGE_MIME_TYPES.has(asset.mime_type)) {
        throw buildServiceError("El aviso solicitado no esta disponible.", 404);
      }

      const stream = await getObjectStream({
        bucketName: asset.bucket,
        objectKey: asset.object_key,
      });

      return {
        stream,
        contentType: asset.mime_type,
        contentDisposition: buildInlineContentDisposition(asset.original_name),
        originalName: asset.original_name,
      };
    });

    return [payload, null];
  } catch (error) {
    console.error("Error al obtener asset publico del aviso:", error);
    return [null, error?.message ? error : buildServiceError("No fue posible obtener el asset publico del aviso.", 500)];
  }
}

export async function loadNoticeWithAssetsById(manager, noticeId) {
  const notice = await ensureNoticeExists(manager, noticeId);
  const assets = await getNoticeAssetsMap(manager, noticeId);
  return {
    notice,
    cover: assets.cover,
    contentImages: assets.contentImages,
  };
}
