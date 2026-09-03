import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNoticeAdminAssetPath,
  extractNoticeAssetUuids,
  normalizeNoticeDisplayWidth,
  toCanonicalNoticeHtml,
  toEditorNoticeHtml,
  toPublicNoticeHtml,
} from "./notice-assets.js";

const ASSET_UUID = "123e4567-e89b-42d3-a456-426614174000";

test("extractNoticeAssetUuids obtiene UUIDs unicos desde el HTML", () => {
  const html = [
    `<img data-notice-asset-id="${ASSET_UUID}" src="blob:http://localhost/uno" alt="uno" />`,
    `<img data-notice-asset-id="${ASSET_UUID}" src="blob:http://localhost/dos" alt="dos" />`,
  ].join("");

  assert.deepEqual(extractNoticeAssetUuids(html), [ASSET_UUID]);
});

test("toCanonicalNoticeHtml reemplaza blob URLs por la ruta admin relativa", () => {
  const html = `<p>Hola</p><img data-notice-asset-id="${ASSET_UUID}" data-notice-width="75" src="blob:http://localhost/demo" alt="Foto" />`;
  const canonical = toCanonicalNoticeHtml(html);

  assert.match(canonical, new RegExp(buildNoticeAdminAssetPath(ASSET_UUID)));
  assert.match(canonical, /data-notice-width="75"/);
  assert.doesNotMatch(canonical, /blob:/i);
});

test("toEditorNoticeHtml usa previews temporales sin perder el UUID estable", () => {
  const html = `<img data-notice-asset-id="${ASSET_UUID}" data-notice-width="50" src="${buildNoticeAdminAssetPath(ASSET_UUID)}" alt="Foto" />`;
  const previewHtml = toEditorNoticeHtml(html, {
    [ASSET_UUID]: "blob:http://localhost/preview-asset",
  });

  assert.match(previewHtml, /blob:http:\/\/localhost\/preview-asset/);
  assert.match(previewHtml, /data-notice-width="50"/);
  assert.match(previewHtml, /data-notice-asset-id="123e4567-e89b-42d3-a456-426614174000"/);
});

test("toPublicNoticeHtml reescribe a la ruta publica del asset", () => {
  const html = `<img data-notice-asset-id="${ASSET_UUID}" src="${buildNoticeAdminAssetPath(ASSET_UUID)}" alt="Foto" />`;
  const publicHtml = toPublicNoticeHtml(html, "aviso-demo");

  assert.match(
    publicHtml,
    new RegExp(`/api/public/notices/aviso-demo/assets/${ASSET_UUID}`),
  );
  assert.doesNotMatch(publicHtml, /blob:/i);
});

test("normalizeNoticeDisplayWidth normaliza valores fuera de rango", () => {
  assert.equal(normalizeNoticeDisplayWidth(undefined), 100);
  assert.equal(normalizeNoticeDisplayWidth("25"), 25);
  assert.equal(normalizeNoticeDisplayWidth("73"), 75);
  assert.equal(normalizeNoticeDisplayWidth("10"), 20);
  assert.equal(normalizeNoticeDisplayWidth("125"), 100);
  assert.equal(normalizeNoticeDisplayWidth("abc"), 100);
});
