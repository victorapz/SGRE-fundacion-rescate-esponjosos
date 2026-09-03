"use strict";

import crypto from "crypto";
import sanitizeHtml from "sanitize-html";
import { FILE_ASSET_CONTEXTS } from "../entities/file_asset.entity.js";

export const NOTICE_STATUS = {
  DRAFT: "BORRADOR",
  PUBLISHED: "PUBLICADO",
  ARCHIVED: "ARCHIVADO",
};

export const NOTICE_ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const NOTICE_MIN_DISPLAY_WIDTH = 20;
export const NOTICE_MAX_DISPLAY_WIDTH = 100;
export const NOTICE_DEFAULT_DISPLAY_WIDTH = 100;

export const NOTICE_ASSET_UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

const NOTICE_ADMIN_ASSET_SRC_REGEX = new RegExp(
  `^/api/notice/assets/(${NOTICE_ASSET_UUID_PATTERN})/preview$`,
  "i",
);
const NOTICE_PUBLIC_ASSET_SRC_REGEX = new RegExp(
  `^/api/public/notices/[^/]+/assets/(${NOTICE_ASSET_UUID_PATTERN})$`,
  "i",
);
const IMG_TAG_REGEX = /<img\b[^>]*>/gi;
const ATTR_REGEX = /([a-zA-Z0-9:-]+)\s*=\s*"([^"]*)"/g;

function normalizeUuid(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return new RegExp(`^${NOTICE_ASSET_UUID_PATTERN}$`, "i").test(normalized)
    ? normalized
    : null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function stripHtmlToText(value) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\s+/g, " ").trim();
}

function parseLegacyDateParts(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const normalized = value.trim();
  let year;
  let month;
  let day;

  if (/^\d{2}-\d{2}-\d{4}$/.test(normalized)) {
    [day, month, year] = normalized.split("-").map((item) => Number(item));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    [year, month, day] = normalized.split("-").map((item) => Number(item));
  } else {
    return null;
  }

  const parsedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    Number.isNaN(parsedDate.getTime())
    || parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day, date: parsedDate };
}

function extractAttributesFromTag(tag) {
  const attributes = {};
  let match = ATTR_REGEX.exec(tag);

  while (match) {
    attributes[match[1]] = match[2];
    match = ATTR_REGEX.exec(tag);
  }

  ATTR_REGEX.lastIndex = 0;
  return attributes;
}

function resolveNoticeAssetUuid(attributes = {}) {
  const explicitUuid = normalizeUuid(attributes["data-notice-asset-id"]);
  if (explicitUuid) return explicitUuid;

  const src = String(attributes.src || "").trim();
  if (!src) return null;

  const adminMatch = src.match(NOTICE_ADMIN_ASSET_SRC_REGEX);
  if (adminMatch?.[1]) return normalizeUuid(adminMatch[1]);

  const publicMatch = src.match(NOTICE_PUBLIC_ASSET_SRC_REGEX);
  if (publicMatch?.[1]) return normalizeUuid(publicMatch[1]);

  return null;
}

export function normalizeNoticeImageWidth(rawValue, fallbackValue = NOTICE_DEFAULT_DISPLAY_WIDTH) {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return fallbackValue;
  }

  const normalized = String(rawValue).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("El ancho visual de la imagen del aviso no es valido.");
  }

  const parsedWidth = Number.parseInt(normalized, 10);
  if (
    !Number.isInteger(parsedWidth)
    || parsedWidth < NOTICE_MIN_DISPLAY_WIDTH
    || parsedWidth > NOTICE_MAX_DISPLAY_WIDTH
  ) {
    throw new Error("El ancho visual de la imagen del aviso debe estar entre 20 y 100.");
  }

  return Math.round(parsedWidth / 5) * 5;
}

function canonicalizeNoticeImageTag(tag) {
  const attributes = extractAttributesFromTag(tag);
  const sourceValue = String(attributes.src || "").trim();

  if (/^(?:https?:)?\/\//i.test(sourceValue)) {
    throw new Error("Las imagenes del aviso no pueden usar hosts o URLs absolutas.");
  }
  if (/^(?:data|blob):/i.test(sourceValue)) {
    throw new Error("Las imagenes del aviso no pueden usar data URLs ni blob URLs.");
  }

  const assetUuid = resolveNoticeAssetUuid(attributes);
  if (!assetUuid) {
    throw new Error("Cada imagen del aviso debe estar asociada a un asset valido.");
  }

  const alt = normalizeText(attributes.alt) || "Imagen del aviso";
  const title = normalizeText(attributes.title);
  const displayWidth = normalizeNoticeImageWidth(attributes["data-notice-width"]);
  const canonicalAttributes = [
    `data-notice-asset-id="${assetUuid}"`,
    `data-notice-width="${displayWidth}"`,
    `src="${buildNoticeAdminAssetPreviewPath(assetUuid)}"`,
    `alt="${escapeHtmlAttribute(alt)}"`,
  ];

  if (title) {
    canonicalAttributes.push(`title="${escapeHtmlAttribute(title)}"`);
  }

  return {
    assetUuid,
    html: `<img ${canonicalAttributes.join(" ")} />`,
  };
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatDateToBackend(dateValue = new Date()) {
  const date = new Date(dateValue);
  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = String(date.getFullYear());
  return `${year}-${month}-${day}`;
}

export function getCurrentChileDate(currentDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(currentDate));
}

export function parseNoticePublicationDate(value) {
  return parseLegacyDateParts(value)?.date || null;
}

export function isNoticePublicationDateVisible(value, currentDate = new Date()) {
  const parsedDate = parseLegacyDateParts(value);
  if (!parsedDate) return false;

  const today = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    0,
    0,
    0,
    0,
  );

  return parsedDate.date.getTime() <= today.getTime();
}

export function normalizeNoticeSummary(value) {
  return normalizeText(stripHtmlToText(value || ""));
}

export function slugifyNoticeTitle(title) {
  const normalized = String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "aviso";
}

export function buildNoticeAdminAssetPreviewPath(assetUuid) {
  return `/api/notice/assets/${assetUuid}/preview`;
}

export function buildNoticePublicAssetPath(slug, assetUuid) {
  return `/api/public/notices/${encodeURIComponent(slug)}/assets/${assetUuid}`;
}

export function extractNoticeImageReferences(html = "") {
  const references = [];
  const seen = new Set();
  const tags = String(html || "").match(IMG_TAG_REGEX) || [];

  for (const tag of tags) {
    const { assetUuid } = canonicalizeNoticeImageTag(tag);
    if (seen.has(assetUuid)) {
      continue;
    }

    seen.add(assetUuid);
    references.push(assetUuid);
  }

  return references;
}

export function sanitizeNoticeHtmlForStorage(rawHtml = "") {
  const rawImageTags = String(rawHtml || "").match(IMG_TAG_REGEX) || [];
  for (const tag of rawImageTags) {
    canonicalizeNoticeImageTag(tag);
  }

  const baseHtml = sanitizeHtml(String(rawHtml || ""), {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "data-notice-asset-id", "data-notice-width"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attributes) => {
        const href = String(attributes.href || "").trim();
        if (!href) {
          return {
            tagName: "a",
            attribs: {},
          };
        }

        if (!/^(https?:|mailto:|tel:)/i.test(href)) {
          return {
            tagName: "a",
            attribs: {},
          };
        }

        return {
          tagName,
          attribs: {
            href,
            title: normalizeText(attributes.title) || undefined,
            rel: "noopener noreferrer",
          },
        };
      },
    },
  });

  let sanitizedHtml = baseHtml;
  const imageReferences = [];
  const tags = baseHtml.match(IMG_TAG_REGEX) || [];

  for (const tag of tags) {
    const canonicalTag = canonicalizeNoticeImageTag(tag);
    sanitizedHtml = sanitizedHtml.replace(tag, canonicalTag.html);
    imageReferences.push(canonicalTag.assetUuid);
  }

  return {
    html: sanitizedHtml,
    imageAssetUuids: [...new Set(imageReferences)],
  };
}

export function rewriteNoticeHtmlForPublic(html = "", slug = "") {
  return String(html || "").replace(IMG_TAG_REGEX, (tag) => {
    const attributes = extractAttributesFromTag(tag);
    const assetUuid = resolveNoticeAssetUuid(attributes);

    if (!assetUuid) {
      return "";
    }

    const alt = normalizeText(attributes.alt) || "Imagen del aviso";
    const title = normalizeText(attributes.title);
    const displayWidth = normalizeNoticeImageWidth(attributes["data-notice-width"]);
    const pieces = [
      `data-notice-asset-id="${assetUuid}"`,
      `data-notice-width="${displayWidth}"`,
      `src="${buildNoticePublicAssetPath(slug, assetUuid)}"`,
      `alt="${escapeHtmlAttribute(alt)}"`,
    ];

    if (title) {
      pieces.push(`title="${escapeHtmlAttribute(title)}"`);
    }

    return `<img ${pieces.join(" ")} />`;
  });
}

export function isNoticeHtmlEmpty(html = "") {
  const textContent = stripHtmlToText(
    sanitizeHtml(String(html || ""), {
      allowedTags: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "h2",
        "h3",
        "h4",
        "ul",
        "ol",
        "li",
        "blockquote",
        "a",
        "img",
        "hr",
      ],
      allowedAttributes: {
        a: ["href"],
        img: ["data-notice-asset-id"],
      },
    }),
  );

  return textContent.length === 0;
}

export function ensureNoticePublicationDate(value, fallbackDate = new Date()) {
  const parsedDate = parseLegacyDateParts(value);
  if (parsedDate) {
    return `${parsedDate.year}-${padDatePart(parsedDate.month)}-${padDatePart(parsedDate.day)}`;
  }

  return getCurrentChileDate(fallbackDate);
}

export function resolveNoticePublicationDateByTransition(
  previousStatus,
  requestedStatus,
  currentValue = null,
  fallbackDate = new Date(),
) {
  if (requestedStatus !== NOTICE_STATUS.PUBLISHED) {
    return currentValue;
  }

  if (previousStatus !== NOTICE_STATUS.PUBLISHED) {
    return getCurrentChileDate(fallbackDate);
  }

  return currentValue;
}

export function isNoticePubliclyVisible(notice, currentDate = new Date()) {
  return Boolean(
    notice?.publico
      && notice?.estado === NOTICE_STATUS.PUBLISHED
      && isNoticePublicationDateVisible(notice?.fecha_publicacion, currentDate),
  );
}

export function buildSlugCandidate(baseSlug, attempt) {
  return attempt <= 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
}

export function buildNoticePublicListItem(notice, coverAsset = null) {
  return {
    slug: notice.slug,
    titulo: notice.titulo,
    resumen: notice.resumen,
    imagen_portada_url: coverAsset
      ? buildNoticePublicAssetPath(notice.slug, coverAsset.public_id)
      : null,
    fecha_publicacion: notice.fecha_publicacion,
  };
}

export function buildNoticePublicDetailItem(notice, coverAsset = null) {
  return {
    slug: notice.slug,
    titulo: notice.titulo,
    resumen: notice.resumen,
    contenido_sanitizado: rewriteNoticeHtmlForPublic(notice.descripcion, notice.slug),
    imagen_portada_url: coverAsset
      ? buildNoticePublicAssetPath(notice.slug, coverAsset.public_id)
      : null,
    fecha_publicacion: notice.fecha_publicacion,
  };
}

export function ensureNoticeAssetPublicId(asset) {
  if (asset?.public_id) return asset.public_id;

  const generatedId = crypto.randomUUID();
  asset.public_id = generatedId;
  return generatedId;
}

export function getNoticeAssetContextDescription(context) {
  return context === FILE_ASSET_CONTEXTS.NOTICE_COVER ? "portada" : "imagen";
}
