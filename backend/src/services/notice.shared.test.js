import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_DEFAULT_DISPLAY_WIDTH,
  NOTICE_STATUS,
  buildNoticePublicDetailItem,
  buildNoticePublicListItem,
  ensureNoticePublicationDate,
  getCurrentChileDate,
  isNoticePubliclyVisible,
  normalizeNoticeImageWidth,
  resolveNoticePublicationDateByTransition,
  rewriteNoticeHtmlForPublic,
  sanitizeNoticeHtmlForStorage,
} from "./notice.shared.js";

const ASSET_UUID = "123e4567-e89b-42d3-a456-426614174000";

test("sanitizeNoticeHtmlForStorage canonicaliza imagenes con UUID y ruta admin relativa", () => {
  const payload = sanitizeNoticeHtmlForStorage(
    `<p>Hola</p><img src="/api/public/notices/aviso/assets/${ASSET_UUID}" alt="Portada" data-notice-asset-id="${ASSET_UUID}" data-notice-width="75" />`,
  );

  assert.equal(payload.imageAssetUuids.length, 1);
  assert.equal(payload.imageAssetUuids[0], ASSET_UUID);
  assert.match(
    payload.html,
    new RegExp(`src="/api/notice/assets/${ASSET_UUID}/preview"`),
  );
  assert.match(payload.html, /data-notice-width="75"/);
  assert.match(payload.html, /data-notice-asset-id="123e4567-e89b-42d3-a456-426614174000"/);
});

test("normalizeNoticeImageWidth valida el rango permitido", () => {
  assert.equal(normalizeNoticeImageWidth(undefined), NOTICE_DEFAULT_DISPLAY_WIDTH);
  assert.equal(normalizeNoticeImageWidth("25"), 25);
  assert.equal(normalizeNoticeImageWidth("73"), 75);
  assert.throws(() => normalizeNoticeImageWidth("19"), /entre 20 y 100/i);
  assert.throws(() => normalizeNoticeImageWidth("101"), /entre 20 y 100/i);
  assert.throws(() => normalizeNoticeImageWidth("75%"), /no es valido/i);
});

test("sanitizeNoticeHtmlForStorage rechaza hosts absolutos y blob/data URLs", () => {
  assert.throws(
    () => sanitizeNoticeHtmlForStorage(`<img src="http://localhost:3000/api/notice/assets/${ASSET_UUID}/preview" />`),
    /hosts o URLs absolutas/i,
  );
  assert.throws(
    () => sanitizeNoticeHtmlForStorage(`<img src="blob:http://localhost/demo" data-notice-asset-id="${ASSET_UUID}" />`),
    /blob urls/i,
  );
  assert.throws(
    () => sanitizeNoticeHtmlForStorage(`<img src="data:image/png;base64,abc" data-notice-asset-id="${ASSET_UUID}" />`),
    /data urls/i,
  );
});

test("buildNoticePublicDetailItem reescribe el HTML a rutas publicas por slug", () => {
  const notice = {
    slug: "jornada-de-invierno",
    titulo: "Jornada de invierno",
    resumen: "Resumen",
    descripcion: `<p>Texto</p><img data-notice-asset-id="${ASSET_UUID}" data-notice-width="50" src="/api/notice/assets/${ASSET_UUID}/preview" alt="Foto" />`,
    fecha_publicacion: "2026-06-22",
  };
  const coverAsset = { public_id: ASSET_UUID };
  const payload = buildNoticePublicDetailItem(notice, coverAsset);

  assert.equal(payload.slug, "jornada-de-invierno");
  assert.equal(
    payload.imagen_portada_url,
    `/api/public/notices/jornada-de-invierno/assets/${ASSET_UUID}`,
  );
  assert.match(
    payload.contenido_sanitizado,
    new RegExp(`/api/public/notices/jornada-de-invierno/assets/${ASSET_UUID}`),
  );
  assert.match(payload.contenido_sanitizado, /data-notice-width="50"/);
});

test("buildNoticePublicListItem conserva fecha_publicacion como fecha canonica", () => {
  const payload = buildNoticePublicListItem(
    {
      slug: "operativo",
      titulo: "Operativo",
      resumen: "Resumen",
      fecha_publicacion: "2026-06-21",
    },
    { public_id: ASSET_UUID },
  );

  assert.equal(payload.fecha_publicacion, "2026-06-21");
  assert.ok(!Object.hasOwn(payload, "publicado_en"));
});

test("isNoticePubliclyVisible usa solo fecha_publicacion valida y visible", () => {
  const baseNotice = {
    estado: NOTICE_STATUS.PUBLISHED,
    publico: true,
  };

  assert.equal(
    isNoticePubliclyVisible(
      { ...baseNotice, fecha_publicacion: "2026-06-22" },
      new Date("2026-06-22T12:00:00Z"),
    ),
    true,
  );
  assert.equal(
    isNoticePubliclyVisible(
      { ...baseNotice, fecha_publicacion: "2026-06-25" },
      new Date("2026-06-22T12:00:00Z"),
    ),
    false,
  );
  assert.equal(
    isNoticePubliclyVisible(
      { ...baseNotice, fecha_publicacion: null, createdAt: "2026-06-01", updatedAt: "2026-06-22" },
      new Date("2026-06-22T12:00:00Z"),
    ),
    false,
  );
});

test("ensureNoticePublicationDate conserva la fecha existente y asigna fallback cuando falta", () => {
  assert.equal(
    ensureNoticePublicationDate("20-06-2026", new Date("2026-06-22T12:00:00Z")),
    "2026-06-20",
  );
  assert.equal(
    ensureNoticePublicationDate(null, new Date("2026-06-22T12:00:00Z")),
    "2026-06-22",
  );
});

test("rewriteNoticeHtmlForPublic elimina imagenes sin UUID valido", () => {
  const html = rewriteNoticeHtmlForPublic('<p>Texto</p><img src="/api/notice/assets/sin-uuid/preview" alt="x" />', "slug-demo");
  assert.equal(html, "<p>Texto</p>");
});

test("getCurrentChileDate entrega YYYY-MM-DD en zona America/Santiago", () => {
  assert.equal(
    getCurrentChileDate(new Date("2026-06-23T02:30:00.000Z")),
    "2026-06-22",
  );
});

test("resolveNoticePublicationDateByTransition aplica las transiciones esperadas", () => {
  assert.equal(
    resolveNoticePublicationDateByTransition("BORRADOR", "PUBLICADO", null, new Date("2026-06-22T12:00:00Z")),
    "2026-06-22",
  );
  assert.equal(
    resolveNoticePublicationDateByTransition("PUBLICADO", "PUBLICADO", "2026-06-10", new Date("2026-06-22T12:00:00Z")),
    "2026-06-10",
  );
  assert.equal(
    resolveNoticePublicationDateByTransition("ARCHIVADO", "PUBLICADO", "2026-06-10", new Date("2026-06-22T12:00:00Z")),
    "2026-06-22",
  );
  assert.equal(
    resolveNoticePublicationDateByTransition("PUBLICADO", "ARCHIVADO", "2026-06-10", new Date("2026-06-22T12:00:00Z")),
    "2026-06-10",
  );
});
