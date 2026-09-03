"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("area routes mantienen autenticacion y permisos de configuracion", () => {
  const source = readFileSync(new URL("./area.routes.js", import.meta.url), "utf8");

  assert.match(source, /router\.use\(authenticateJwt\)/);
  assert.match(source, /configuration:area:read/);
  assert.match(source, /checkRbac\("configuration:area:create"\),\s*createArea/);
  assert.match(source, /checkRbac\("configuration:area:update"\),\s*updateArea/);
  assert.match(source, /checkRbac\("configuration:area:deactivate"\),\s*toggleAreaActive/);
});

test("initialSetup registra permisos de areas en el seed base", () => {
  const source = readFileSync(new URL("../config/initialSetup.js", import.meta.url), "utf8");

  assert.match(source, /"configuration:area:read"/);
  assert.match(source, /"configuration:area:create"/);
  assert.match(source, /"configuration:area:update"/);
  assert.match(source, /"configuration:area:deactivate"/);
});
