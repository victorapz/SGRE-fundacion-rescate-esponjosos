"use strict";

import assert from "node:assert/strict";
import test from "node:test";

process.env.CORS_ALLOWED_ORIGINS ||= "http://localhost:5173";
process.env.CORS_ALLOW_CREDENTIALS ||= "true";
process.env.PUBLIC_FRONTEND_URL ||= "http://localhost:5173";
process.env.ACCESS_TOKEN_SECRET ||= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";

const { buildCorsOptions } = await import(
  new URL("./app.js?app-cors-test", import.meta.url),
);

test("cors permite origen autorizado y credenciales", async () => {
  const corsOptions = buildCorsOptions();

  const allowedOrigin = await new Promise((resolve, reject) => {
    corsOptions.origin("http://localhost:5173", (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });

  assert.equal(corsOptions.credentials, true);
  assert.equal(allowedOrigin, true);
});

test("cors rechaza origen no permitido", async () => {
  const corsOptions = buildCorsOptions();

  await assert.rejects(async () => {
    await new Promise((resolve, reject) => {
      corsOptions.origin("http://malicious.test", (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      });
    });
  });
});
