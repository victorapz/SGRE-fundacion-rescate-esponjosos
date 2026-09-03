import test from "node:test";
import assert from "node:assert/strict";
import { runNoticePublicationWithSlugRetry } from "./notice.service.js";

function createSlugConflictError(message = 'duplicate key value violates unique constraint "UQ_notice_slug"') {
  const error = new Error(message);
  error.code = "23505";
  error.constraint = "UQ_notice_slug";
  error.detail = 'Key (slug)=(aviso-demo) already exists.';
  return error;
}

test("runNoticePublicationWithSlugRetry resuelve en el primer intento cuando no hay colision", async () => {
  const attempts = [];

  const payload = await runNoticePublicationWithSlugRetry(async (attempt) => {
    attempts.push(attempt);
    return { slug: "aviso-demo" };
  });

  assert.deepEqual(attempts, [1]);
  assert.equal(payload.slug, "aviso-demo");
});

test("runNoticePublicationWithSlugRetry reintenta la publicacion completa tras una colision de slug", async () => {
  const attempts = [];

  const payload = await runNoticePublicationWithSlugRetry(async (attempt) => {
    attempts.push(attempt);

    if (attempt === 1) {
      throw createSlugConflictError();
    }

    return { slug: "aviso-demo-2" };
  });

  assert.deepEqual(attempts, [1, 2]);
  assert.equal(payload.slug, "aviso-demo-2");
});

test("runNoticePublicationWithSlugRetry no reintenta un 23505 de otra restriccion", async () => {
  const attempts = [];
  const foreignUniqueError = new Error('duplicate key value violates unique constraint "UQ_other_field"');
  foreignUniqueError.code = "23505";
  foreignUniqueError.constraint = "UQ_other_field";
  foreignUniqueError.detail = "Key (titulo)=(Duplicado) already exists.";

  await assert.rejects(
    () => runNoticePublicationWithSlugRetry(async (attempt) => {
      attempts.push(attempt);
      throw foreignUniqueError;
    }),
    /duplicate key value/i,
  );

  assert.deepEqual(attempts, [1]);
});

test("runNoticePublicationWithSlugRetry corta al agotar el maximo de intentos", async () => {
  const attempts = [];

  await assert.rejects(
    () => runNoticePublicationWithSlugRetry(async (attempt) => {
      attempts.push(attempt);
      throw createSlugConflictError();
    }, {
      maxAttempts: 3,
      exhaustedMessage: "No fue posible publicar el aviso por una colision repetida de slug.",
    }),
    (error) =>
      error?.statusCode === 409
      && /colision repetida de slug/i.test(String(error?.message || "")),
  );

  assert.deepEqual(attempts, [1, 2, 3]);
});
