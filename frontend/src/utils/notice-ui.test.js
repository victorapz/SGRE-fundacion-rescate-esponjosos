import test from "node:test";
import assert from "node:assert/strict";
import { buildNoticePayload, formatNoticeDate } from "./notice-ui.js";

test("buildNoticePayload no envia fecha_publicacion manual", () => {
  const payload = buildNoticePayload({
    title: "Aviso demo",
    summary: "Resumen",
    description: "<p>Contenido</p>",
    publishedAt: "2026-06-22",
    status: "BORRADOR",
    isPublic: true,
  });

  assert.equal(payload.titulo, "Aviso demo");
  assert.equal(payload.resumen, "Resumen");
  assert.equal(payload.descripcion, "<p>Contenido</p>");
  assert.equal(payload.estado, "BORRADOR");
  assert.equal(payload.publico, true);
  assert.equal(Object.hasOwn(payload, "fecha_publicacion"), false);
});

test("formatNoticeDate muestra YYYY-MM-DD como DD-MM-YYYY", () => {
  assert.equal(formatNoticeDate("2026-06-22"), "22-06-2026");
});
