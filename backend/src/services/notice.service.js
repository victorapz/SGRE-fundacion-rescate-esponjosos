"use strict";

import { In } from "typeorm";
import { AppDataSource } from "../config/configDb.js";
import Notice from "../entities/notice.entity.js";
import FileAsset, {
  FILE_ASSET_CONTEXTS,
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
} from "../entities/file_asset.entity.js";
import {
  buildPagedResult,
  buildPagination,
} from "./financialConcept/accounting.shared.js";
import {
  NOTICE_STATUS,
  buildNoticePublicDetailItem,
  buildNoticePublicListItem,
  buildSlugCandidate,
  isNoticeHtmlEmpty,
  isNoticePubliclyVisible,
  normalizeNoticeSummary,
  parseNoticePublicationDate,
  resolveNoticePublicationDateByTransition,
  sanitizeNoticeHtmlForStorage,
  slugifyNoticeTitle,
} from "./notice.shared.js";
import {
  getNoticeAssetsMap,
  loadNoticeWithAssetsById,
  serializeNoticeAsset,
  validateNoticeContentImageAssets,
  validateNoticeCoverAsset,
} from "./noticeAsset.service.js";

function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

const NOTICE_PUBLICATION_MAX_SLUG_ATTEMPTS = 5;

function getNoticeId(query) {
  const noticeId = query?.id ?? query?.id_aviso;
  return Number(noticeId);
}

function isSlugConflictError(error) {
  return Boolean(
    error?.code === "23505"
      && (
        /slug/i.test(String(error?.detail || ""))
        || /slug/i.test(String(error?.constraint || ""))
        || /slug/i.test(String(error?.message || ""))
      ),
  );
}

function serializeNoticeAdmin(notice, assets = {}) {
  const firstName = notice.user?.nombre || "";
  const lastName = notice.user?.apellido || "";
  const authorName = `${firstName} ${lastName}`.trim() || firstName || "Sistema";

  return {
    id_aviso: notice.id_aviso,
    titulo: notice.titulo,
    slug: notice.slug || null,
    resumen: notice.resumen || null,
    descripcion: notice.descripcion,
    estado: notice.estado,
    fecha_publicacion: notice.fecha_publicacion,
    publico: notice.publico,
    cover_asset: assets.cover ? serializeNoticeAsset(assets.cover) : null,
    content_images: Array.isArray(assets.contentImages)
      ? assets.contentImages.map(serializeNoticeAsset)
      : [],
    createdAt: notice.createdAt || null,
    updatedAt: notice.updatedAt || null,
    user: notice.user
      ? {
        id_usuario: notice.user.id_usuario,
        nombre: notice.user.nombre,
        apellido: notice.user.apellido || "",
        full_name: authorName,
      }
      : null,
  };
}

function sortPublicNotices(left, right) {
  const leftDate = parseNoticePublicationDate(left.fecha_publicacion);
  const rightDate = parseNoticePublicationDate(right.fecha_publicacion);
  const leftTime = leftDate ? leftDate.getTime() : -Infinity;
  const rightTime = rightDate ? rightDate.getTime() : -Infinity;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return Number(right.id_aviso) - Number(left.id_aviso);
}

async function loadCoverAssetsByNoticeIds(manager, noticeIds = []) {
  if (!Array.isArray(noticeIds) || noticeIds.length === 0) {
    return new Map();
  }

  const repository = manager.getRepository(FileAsset);
  const assets = await repository.find({
    where: {
      entity_type: FILE_ASSET_ENTITY_TYPES.NOTICE,
      entity_id: In(noticeIds.map((item) => Number(item))),
      context: FILE_ASSET_CONTEXTS.NOTICE_COVER,
      status: FILE_ASSET_STATUS.ACTIVO,
    },
    order: {
      uploaded_at: "DESC",
      file_asset_id: "DESC",
    },
  });

  const coverMap = new Map();
  for (const asset of assets) {
    if (!coverMap.has(Number(asset.entity_id))) {
      coverMap.set(Number(asset.entity_id), asset);
    }
  }

  return coverMap;
}

async function ensureUniqueSlug(manager, title, noticeId = null, currentSlug = null) {
  if (currentSlug) {
    return currentSlug;
  }

  const repository = manager.getRepository(Notice);
  const baseSlug = slugifyNoticeTitle(title);
  let attempt = 0;

  while (attempt < 25) {
    const candidate = buildSlugCandidate(baseSlug, attempt);
    const existing = await repository.findOne({
      where: { slug: candidate },
    });

    if (!existing || Number(existing.id_aviso) === Number(noticeId)) {
      return candidate;
    }

    attempt += 1;
  }

  throw buildServiceError("No fue posible generar un slug unico para el aviso.", 500);
}

async function savePublishedNotice(manager, repository, notice, titleForSlug) {
  if (!notice.slug) {
    notice.slug = await ensureUniqueSlug(
      manager,
      titleForSlug || notice.titulo,
      notice.id_aviso,
      notice.slug,
    );
  }

  return repository.save(notice);
}

export async function runNoticePublicationWithSlugRetry(
  executor,
  {
    maxAttempts = NOTICE_PUBLICATION_MAX_SLUG_ATTEMPTS,
    exhaustedMessage = "No fue posible publicar el aviso sin colision de slug tras varios intentos.",
  } = {},
) {
  let lastSlugError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await executor(attempt);
    } catch (error) {
      if (!isSlugConflictError(error)) {
        throw error;
      }

      lastSlugError = error;
    }
  }

  if (lastSlugError) {
    throw buildServiceError(exhaustedMessage, 409);
  }

  throw buildServiceError(exhaustedMessage, 409);
}

async function applyNoticeContentRules(manager, notice, body = {}) {
  const previousStatus = notice.estado;
  const nextTitle = body.titulo !== undefined ? String(body.titulo).trim() : notice.titulo;
  const nextSummary = body.resumen !== undefined ? normalizeNoticeSummary(body.resumen) : notice.resumen;
  const rawHtml = body.descripcion !== undefined ? body.descripcion : notice.descripcion;
  const nextPublico = body.publico !== undefined ? Boolean(body.publico) : Boolean(notice.publico);
  const requestedStatus = body.estado !== undefined ? body.estado : notice.estado;

  if (!nextTitle) {
    throw buildServiceError("El titulo es obligatorio.", 400);
  }

  const sanitizedContent = sanitizeNoticeHtmlForStorage(rawHtml);
  if (sanitizedContent.imageAssetUuids.length > 0) {
    await validateNoticeContentImageAssets(manager, notice.id_aviso, sanitizedContent.imageAssetUuids);
  }

  if (
    requestedStatus === NOTICE_STATUS.PUBLISHED
    || (notice.estado === NOTICE_STATUS.PUBLISHED && requestedStatus !== NOTICE_STATUS.ARCHIVED)
  ) {
    if (!nextSummary) {
      throw buildServiceError("El resumen es obligatorio para publicar el aviso.", 400);
    }
    if (isNoticeHtmlEmpty(sanitizedContent.html)) {
      throw buildServiceError("El contenido del aviso no puede quedar vacio al publicarlo.", 400);
    }
    await validateNoticeCoverAsset(manager, notice.id_aviso);
  }

  notice.titulo = nextTitle;
  notice.resumen = nextSummary;
  notice.descripcion = sanitizedContent.html;
  notice.publico = nextPublico;

  if (requestedStatus === NOTICE_STATUS.ARCHIVED) {
    notice.estado = NOTICE_STATUS.ARCHIVED;
    return notice;
  }

  if (requestedStatus === NOTICE_STATUS.DRAFT) {
    if (notice.estado === NOTICE_STATUS.PUBLISHED) {
      throw buildServiceError("No se puede devolver un aviso publicado a borrador.", 400);
    }
    notice.estado = NOTICE_STATUS.DRAFT;
    return notice;
  }

  if (requestedStatus === NOTICE_STATUS.PUBLISHED) {
    notice.estado = NOTICE_STATUS.PUBLISHED;
    notice.fecha_publicacion = resolveNoticePublicationDateByTransition(
      previousStatus,
      requestedStatus,
      notice.fecha_publicacion,
      new Date(),
    );

    if (!parseNoticePublicationDate(notice.fecha_publicacion)) {
      throw buildServiceError("La fecha de publicacion del aviso no es valida.", 400);
    }
  }

  return notice;
}

async function loadNoticeForUpdate(
  manager,
  noticeId,
  userId,
  withLock = false,
) {
  const repository = manager.getRepository(Notice);
  const normalizedNoticeId = Number(noticeId);

  if (withLock) {
    const lockedNotice = await repository
      .createQueryBuilder("notice")
      .where("notice.id_aviso = :noticeId", {
        noticeId: normalizedNoticeId,
      })
      .setLock("pessimistic_write")
      .getOne();

    if (!lockedNotice) {
      throw buildServiceError("Aviso no encontrado.", 404);
    }
  }

  /*
   * El lock anterior sigue vigente hasta que termine la transacción.
   * Ahora podemos cargar User sin aplicar FOR UPDATE al LEFT JOIN.
   */
  const notice = await repository
    .createQueryBuilder("notice")
    .leftJoinAndSelect("notice.user", "user")
    .where("notice.id_aviso = :noticeId", {
      noticeId: normalizedNoticeId,
    })
    .getOne();

  if (!notice) {
    throw buildServiceError("Aviso no encontrado.", 404);
  }

  if (Number(notice.user?.id_usuario) !== Number(userId)) {
    throw buildServiceError("No autorizado para modificar este aviso.", 403);
  }

  return notice;
}

async function createDraftNoticeTransaction(body) {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(Notice);
    const title = String(body.titulo || "").trim();
    const rawHtml = body.descripcion || "<p></p>";
    const sanitizedContent = sanitizeNoticeHtmlForStorage(rawHtml);

    if (sanitizedContent.imageAssetUuids.length > 0) {
      throw buildServiceError(
        "Debes guardar el aviso como borrador antes de adjuntar imagenes en el contenido.",
        400,
      );
    }

    const notice = repository.create({
      titulo: title,
      resumen: normalizeNoticeSummary(body.resumen),
      descripcion: sanitizedContent.html,
      estado: NOTICE_STATUS.DRAFT,
      fecha_publicacion: null,
      publico: Boolean(body.publico),
      slug: null,
      user: { id_usuario: Number(body.id_user) },
    });

    const persisted = await repository.save(notice);
    const hydrated = await loadNoticeWithAssetsById(manager, persisted.id_aviso);
    return serializeNoticeAdmin(hydrated.notice, {
      cover: hydrated.cover,
      contentImages: hydrated.contentImages,
    });
  });
}

async function createPublishedNoticeAttempt(body) {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(Notice);
    const title = String(body.titulo || "").trim();
    const rawHtml = body.descripcion || "<p></p>";
    const sanitizedContent = sanitizeNoticeHtmlForStorage(rawHtml);

    if (sanitizedContent.imageAssetUuids.length > 0) {
      throw buildServiceError(
        "Debes guardar el aviso como borrador antes de adjuntar imagenes en el contenido.",
        400,
      );
    }

    const notice = repository.create({
      titulo: title,
      resumen: normalizeNoticeSummary(body.resumen),
      descripcion: sanitizedContent.html,
      estado: NOTICE_STATUS.DRAFT,
      fecha_publicacion: null,
      publico: Boolean(body.publico),
      slug: null,
      user: { id_usuario: Number(body.id_user) },
    });

    const savedNotice = await repository.save(notice);
    const lockedNotice = await loadNoticeForUpdate(
      manager,
      savedNotice.id_aviso,
      body.id_user,
      true,
    );

    await applyNoticeContentRules(manager, lockedNotice, {
      ...body,
      titulo: title,
      descripcion: sanitizedContent.html,
      estado: NOTICE_STATUS.PUBLISHED,
    });

    const persisted = await savePublishedNotice(
      manager,
      repository,
      lockedNotice,
      title,
    );
    const hydrated = await loadNoticeWithAssetsById(manager, persisted.id_aviso);
    return serializeNoticeAdmin(hydrated.notice, {
      cover: hydrated.cover,
      contentImages: hydrated.contentImages,
    });
  });
}

async function updateNoticeDraftOrArchivedAttempt(id_aviso, body, userId, shouldLock = false) {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(Notice);
    const notice = await loadNoticeForUpdate(manager, id_aviso, userId, shouldLock);

    await applyNoticeContentRules(manager, notice, body);
    await repository.save(notice);

    const hydrated = await loadNoticeWithAssetsById(manager, notice.id_aviso);
    return serializeNoticeAdmin(hydrated.notice, {
      cover: hydrated.cover,
      contentImages: hydrated.contentImages,
    });
  });
}

async function updatePublishedNoticeAttempt(id_aviso, body, userId) {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(Notice);
    const notice = await loadNoticeForUpdate(manager, id_aviso, userId, true);

    await applyNoticeContentRules(manager, notice, body);

    const persisted = notice.estado === NOTICE_STATUS.PUBLISHED
      ? await savePublishedNotice(
        manager,
        repository,
        notice,
        notice.titulo,
      )
      : await repository.save(notice);
    const hydrated = await loadNoticeWithAssetsById(manager, persisted.id_aviso);
    return serializeNoticeAdmin(hydrated.notice, {
      cover: hydrated.cover,
      contentImages: hydrated.contentImages,
    });
  });
}

export async function createNoticeService(body) {
  try {
    const requestedStatus = body.estado === NOTICE_STATUS.PUBLISHED
      ? NOTICE_STATUS.PUBLISHED
      : NOTICE_STATUS.DRAFT;
    const result = requestedStatus === NOTICE_STATUS.PUBLISHED
      ? await runNoticePublicationWithSlugRetry(
        () => createPublishedNoticeAttempt(body),
        {
          exhaustedMessage: "No fue posible publicar el aviso por una colision repetida de slug.",
        },
      )
      : await createDraftNoticeTransaction(body);

    return [result, null];
  } catch (error) {
    console.error("Error al crear notice:", error);
    return [null, error?.message || "Error interno al crear notice"];
  }
}

export async function getNoticeService(query, userId) {
  try {
    const id_aviso = getNoticeId(query);

    if (!Number.isInteger(id_aviso) || id_aviso <= 0) {
      return [null, "Id de aviso invalido"];
    }

    const result = await AppDataSource.transaction(async (manager) => {
      const { notice, cover, contentImages } = await loadNoticeWithAssetsById(manager, id_aviso);
      const isOwner = Number(notice.user?.id_usuario) === Number(userId);

      if (!isOwner && notice.estado !== NOTICE_STATUS.PUBLISHED) {
        throw buildServiceError("Aviso no encontrado", 404);
      }

      return serializeNoticeAdmin(notice, { cover, contentImages });
    });

    return [result, null];
  } catch (error) {
    console.error("Error obtener el aviso:", error);
    return [null, error?.message || "Error interno del servidor"];
  }
}

export async function getNoticesService(userId) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Notice);
      const notices = await repository.find({
        where: [
          { user: { id_usuario: Number(userId) } },
          { estado: NOTICE_STATUS.PUBLISHED },
        ],
        relations: {
          user: true,
        },
        order: {
          updatedAt: "DESC",
          id_aviso: "DESC",
        },
      });

      const coverMap = await loadCoverAssetsByNoticeIds(
        manager,
        notices.map((notice) => notice.id_aviso),
      );

      return notices.map((notice) => serializeNoticeAdmin(notice, {
        cover: coverMap.get(Number(notice.id_aviso)) || null,
        contentImages: [],
      }));
    });

    return [result, null];
  } catch (error) {
    console.error("Error al obtener los avisos:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteNoticeService(id, userId) {
  try {
    const id_aviso = getNoticeId({ id });
    const repository = AppDataSource.getRepository(Notice);

    if (!Number.isInteger(id_aviso) || id_aviso <= 0) {
      return [null, "Id de aviso invalido"];
    }

    const noticeFound = await repository.findOne({
      where: { id_aviso },
      relations: { user: true },
    });

    if (!noticeFound) return [null, "No se encontro el aviso"];

    if (Number(noticeFound.user?.id_usuario) !== Number(userId)) {
      return [null, "No autorizado para eliminar este aviso"];
    }

    const noticeDeleted = await repository.remove(noticeFound);
    return [noticeDeleted, null];
  } catch (error) {
    console.error("Error al eliminar aviso:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateNoticeService(query, body, userId) {
  try {
    const id_aviso = getNoticeId(query);

    if (!Number.isInteger(id_aviso) || id_aviso <= 0) {
      return [null, "Id de aviso invalido"];
    }

    const currentNotice = await AppDataSource.transaction(async (manager) =>
      loadNoticeForUpdate(manager, id_aviso, userId, false));
    const requestedStatus = body.estado !== undefined ? body.estado : currentNotice.estado;
    const isPublishedFlow = currentNotice.estado === NOTICE_STATUS.PUBLISHED
      || requestedStatus === NOTICE_STATUS.PUBLISHED;
    const result = isPublishedFlow
      ? await runNoticePublicationWithSlugRetry(
        () => updatePublishedNoticeAttempt(id_aviso, body, userId),
        {
          exhaustedMessage: "No fue posible guardar el aviso publicado por una colision repetida de slug.",
        },
      )
      : await updateNoticeDraftOrArchivedAttempt(
        id_aviso,
        body,
        userId,
        body.publico === true,
      );

    return [result, null];
  } catch (error) {
    console.error("Error al modificar un aviso:", error);
    return [null, error?.message || "Error interno del servidor"];
  }
}

export async function getPublicNoticesService(query = {}) {
  try {
    const { page, limit, skip } = buildPagination(query);
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Notice);
      const notices = await repository.find({
        where: {
          estado: NOTICE_STATUS.PUBLISHED,
          publico: true,
        },
      });

      const visibleNotices = notices
        .filter((notice) => isNoticePubliclyVisible(notice))
        .sort(sortPublicNotices);

      const pagedNotices = visibleNotices.slice(skip, skip + limit);
      const coverMap = await loadCoverAssetsByNoticeIds(
        manager,
        pagedNotices.map((notice) => notice.id_aviso),
      );
      const items = pagedNotices.map((notice) =>
        buildNoticePublicListItem(notice, coverMap.get(Number(notice.id_aviso)) || null));

      return buildPagedResult(items, visibleNotices.length, page, limit);
    });

    return [result, null];
  } catch (error) {
    console.error("Error al obtener avisos publicos:", error);
    return [null, "No pudimos cargar los avisos."];
  }
}

export async function getPublicNoticeBySlugService(slug) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Notice);
      const notice = await repository.findOne({
        where: { slug: String(slug || "").trim() },
      });

      if (!notice || !isNoticePubliclyVisible(notice)) {
        throw buildServiceError("El aviso solicitado no esta disponible.", 404);
      }

      const cover = await validateNoticeCoverAsset(manager, notice.id_aviso);
      return buildNoticePublicDetailItem(notice, cover);
    });

    return [result, null];
  } catch (error) {
    console.error("Error al obtener aviso publico por slug:", error);
    return [null, error?.message || "El aviso solicitado no esta disponible."];
  }
}

