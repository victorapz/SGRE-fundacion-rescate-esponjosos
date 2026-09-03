import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("AppRouter mantiene mi-perfil como ruta oficial y redirige /profile", async () => {
  const source = await readFile(
    path.resolve(__dirname, "../src/routes/AppRouter.jsx"),
    "utf8",
  );

  assert.match(source, /path="\/mi-perfil"/);
  assert.match(source, /path="\/profile"/);
  assert.match(source, /Navigate to=\{APP_ROUTES\.myProfile\} replace/);
});
