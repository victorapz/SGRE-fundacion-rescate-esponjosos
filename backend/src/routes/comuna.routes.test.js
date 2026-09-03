"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("comuna routes mantienen autenticacion y permisos de mutacion territorial", () => {
  const source = readFileSync(new URL("./comuna.routes.js", import.meta.url), "utf8");

  assert.match(source, /router\.use\(authenticateJwt\)/);
  assert.match(source, /router\.get\("\/",\s*getComunas\)/);
  assert.match(source, /router\.get\("\/detail\/",\s*getComuna\)/);
  assert.match(source, /router\.get\("\/:id",\s*getComuna\)/);
  assert.match(source, /checkRbac\("configuration:commune:create"\),\s*createComuna/);
  assert.match(source, /checkRbac\("configuration:commune:update"\),\s*updateComuna/);
  assert.match(source, /checkRbac\("configuration:commune:deactivate"\),\s*toggleComunaActive/);
});

test("initialSetup registra permisos de comunas en el seed base", () => {
  const source = readFileSync(new URL("../config/initialSetup.js", import.meta.url), "utf8");

  assert.match(source, /"configuration:commune:read"/);
  assert.match(source, /"configuration:commune:create"/);
  assert.match(source, /"configuration:commune:update"/);
  assert.match(source, /"configuration:commune:deactivate"/);
});

