import test from "node:test";
import assert from "node:assert/strict";
import {
  noticeCreateValidation,
  noticeQueryValidation,
  noticeUpdateBodyValidation,
} from "../validations/notice.validation.js";

test("noticeCreateValidation acepta un payload valido de creacion", () => {
  const payload = {
    titulo: "Aviso Importante",
    descripcion: "<p>Contenido del aviso</p>",
    resumen: "Resumen breve",
    estado: "BORRADOR",
    publico: true,
    id_user: 1,
  };

  const { error, value } = noticeCreateValidation.validate(payload);

  assert.equal(error, undefined);
  assert.equal(value.titulo, payload.titulo);
  assert.equal(value.publico, true);
});

test("noticeCreateValidation rechaza titulo ausente", () => {
  const { error } = noticeCreateValidation.validate({
    descripcion: "<p>Contenido</p>",
    estado: "BORRADOR",
    publico: true,
    id_user: 1,
  });

  assert.ok(error);
  assert.match(error.message, /titulo/i);
});

test("noticeCreateValidation rechaza descripcion ausente", () => {
  const { error } = noticeCreateValidation.validate({
    titulo: "Aviso",
    estado: "BORRADOR",
    publico: true,
    id_user: 1,
  });

  assert.ok(error);
  assert.match(error.message, /descripcion/i);
});

test("noticeCreateValidation rechaza estado invalido", () => {
  const { error } = noticeCreateValidation.validate({
    titulo: "Aviso",
    descripcion: "<p>Contenido</p>",
    estado: "ARCHIVADO",
    publico: true,
    id_user: 1,
  });

  assert.ok(error);
  assert.match(error.message, /BORRADOR o PUBLICADO/i);
});

test("noticeCreateValidation rechaza fecha_publicacion manual por unknown(false)", () => {
  const { error } = noticeCreateValidation.validate({
    titulo: "Aviso",
    descripcion: "<p>Contenido</p>",
    estado: "BORRADOR",
    publico: true,
    id_user: 1,
    fecha_publicacion: "2026-06-23",
  });

  assert.ok(error);
  assert.match(error.message, /fecha_publicacion/i);
});

test("noticeCreateValidation exige publico booleano real sin coercion estricta del contrato actual", () => {
  const validPayload = noticeCreateValidation.validate({
    titulo: "Aviso",
    descripcion: "<p>Contenido</p>",
    estado: "BORRADOR",
    publico: true,
    id_user: 1,
  });

  assert.equal(validPayload.error, undefined);

  const invalidPayload = noticeCreateValidation.validate({
    titulo: "Aviso",
    descripcion: "<p>Contenido</p>",
    estado: "BORRADOR",
    publico: 1,
    id_user: 1,
  }, { convert: false });

  assert.ok(invalidPayload.error);
  assert.match(invalidPayload.error.message, /booleano/i);
});

test("noticeQueryValidation acepta query valida", () => {
  const { error, value } = noticeQueryValidation.validate({ id: 3 });

  assert.equal(error, undefined);
  assert.equal(value.id, 3);
});

test("noticeQueryValidation rechaza id no positivo", () => {
  const { error } = noticeQueryValidation.validate({ id: -1 });

  assert.ok(error);
  assert.match(error.message, /positivo/i);
});

test("noticeUpdateBodyValidation permite update parcial", () => {
  const { error, value } = noticeUpdateBodyValidation.validate({
    titulo: "Nuevo titulo",
  });

  assert.equal(error, undefined);
  assert.equal(value.titulo, "Nuevo titulo");
});

test("noticeUpdateBodyValidation rechaza body vacio", () => {
  const { error } = noticeUpdateBodyValidation.validate({});

  assert.ok(error);
  assert.match(error.message, /al menos un campo/i);
});

test("noticeUpdateBodyValidation rechaza tipos incorrectos", () => {
  const { error } = noticeUpdateBodyValidation.validate(
    { publico: "true" },
    { convert: false },
  );

  assert.ok(error);
  assert.match(error.message, /booleano/i);
});

test("noticeUpdateBodyValidation rechaza campos no permitidos", () => {
  const { error } = noticeUpdateBodyValidation.validate({
    titulo: "Aviso",
    fecha_publicacion: "2026-06-23",
  });

  assert.ok(error);
  assert.match(error.message, /fecha_publicacion/i);
});
