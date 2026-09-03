import { buildAbsoluteApiAssetUrl } from "./publicApiAssets.js";

const NOTICE_IMAGE_TAG_REGEX = /<img\b[^>]*>/gi;
const NOTICE_IMAGE_ATTR_REGEX = /([a-zA-Z0-9:-]+)\s*=\s*"([^"]*)"/g;
const NOTICE_DEFAULT_IMAGE_WIDTH = 100;
const NOTICE_MIN_IMAGE_WIDTH = 20;
const NOTICE_MAX_IMAGE_WIDTH = 100;

function parseAttributes(tag) {
  const attributes = {};
  let match = NOTICE_IMAGE_ATTR_REGEX.exec(tag);

  while (match) {
    attributes[match[1]] = match[2];
    match = NOTICE_IMAGE_ATTR_REGEX.exec(tag);
  }

  NOTICE_IMAGE_ATTR_REGEX.lastIndex = 0;
  return attributes;
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildNoticeAdminAssetPath(assetUuid) {
  return `/api/notice/assets/${assetUuid}/preview`;
}

export function buildNoticePublicAssetPath(slug, assetUuid) {
  return `/api/public/notices/${encodeURIComponent(slug)}/assets/${assetUuid}`;
}

export function buildAbsoluteNoticeApiUrl(pathname) {
  return buildAbsoluteApiAssetUrl(pathname);
}

export function extractNoticeAssetUuids(html = "") {
  const matches = [];
  const seen = new Set();
  const tags = String(html || "").match(NOTICE_IMAGE_TAG_REGEX) || [];

  for (const tag of tags) {
    const attributes = parseAttributes(tag);
    const assetUuid = String(attributes["data-notice-asset-id"] || "").trim().toLowerCase();

    if (!assetUuid || seen.has(assetUuid)) {
      continue;
    }

    seen.add(assetUuid);
    matches.push(assetUuid);
  }

  return matches;
}

export function normalizeNoticeDisplayWidth(rawValue, fallbackValue = NOTICE_DEFAULT_IMAGE_WIDTH) {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return fallbackValue;
  }

  const normalized = String(rawValue).trim();
  if (!/^\d+$/.test(normalized)) {
    return fallbackValue;
  }

  const parsedWidth = Number.parseInt(normalized, 10);
  const roundedWidth = Math.round(parsedWidth / 5) * 5;
  if (roundedWidth < NOTICE_MIN_IMAGE_WIDTH) return NOTICE_MIN_IMAGE_WIDTH;
  if (roundedWidth > NOTICE_MAX_IMAGE_WIDTH) return NOTICE_MAX_IMAGE_WIDTH;
  return roundedWidth;
}

export function buildNoticeImageHtml({
  assetUuid,
  src,
  alt = "Imagen del aviso",
  title = "",
  displayWidth = NOTICE_DEFAULT_IMAGE_WIDTH,
}) {
  const normalizedWidth = normalizeNoticeDisplayWidth(displayWidth);
  const attributes = [
    `data-notice-asset-id="${escapeAttribute(assetUuid)}"`,
    `data-notice-width="${escapeAttribute(normalizedWidth)}"`,
    `src="${escapeAttribute(src)}"`,
    `alt="${escapeAttribute(alt || "Imagen del aviso")}"`,
  ];

  if (title) {
    attributes.push(`title="${escapeAttribute(title)}"`);
  }

  return `<img ${attributes.join(" ")} />`;
}

export function replaceNoticeImageSources(html = "", resolver) {
  return String(html || "").replace(NOTICE_IMAGE_TAG_REGEX, (tag) => {
    const attributes = parseAttributes(tag);
    const assetUuid = String(attributes["data-notice-asset-id"] || "").trim().toLowerCase();

    if (!assetUuid) {
      return tag;
    }

    const nextSource = resolver(assetUuid, attributes);
    if (!nextSource) {
      return tag;
    }

    return buildNoticeImageHtml({
      assetUuid,
      src: nextSource,
      alt: attributes.alt || "Imagen del aviso",
      title: attributes.title || "",
      displayWidth: attributes["data-notice-width"] || NOTICE_DEFAULT_IMAGE_WIDTH,
    });
  });
}

export function toCanonicalNoticeHtml(html = "") {
  return replaceNoticeImageSources(html, (assetUuid) => buildNoticeAdminAssetPath(assetUuid));
}

export function toEditorNoticeHtml(html = "", previewUrlMap = {}) {
  return replaceNoticeImageSources(html, (assetUuid, attributes) =>
    previewUrlMap?.[assetUuid] || attributes.src || buildNoticeAdminAssetPath(assetUuid));
}

export function toPublicNoticeHtml(html = "", slug = "") {
  return replaceNoticeImageSources(html, (assetUuid) =>
    buildAbsoluteNoticeApiUrl(buildNoticePublicAssetPath(slug, assetUuid)));
}
