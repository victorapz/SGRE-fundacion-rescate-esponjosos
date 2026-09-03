"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("region routes mantienen autenticacion y permisos de mutacion territorial", () => {
  const source = readFileSync(new URL("./region.routes.js", import.meta.url), "utf8");

  assert.match(source, /router\.use\(authenticateJwt\)/);
  assert.match(source, /router\.get\("\/",\s*getRegions\)/);
  assert.match(source, /router\.get\("\/:id",\s*getRegion\)/);
  assert.match(source, /checkRbac\("configuration:region:create"\),\s*createRegion/);
  assert.match(source, /checkRbac\("configuration:region:update"\),\s*updateRegion/);
  assert.match(source, /checkRbac\("configuration:region:deactivate"\),\s*toggleRegionActive/);
});

test("initialSetup registra permisos de regiones en el seed base", () => {
  const source = readFileSync(new URL("../config/initialSetup.js", import.meta.url), "utf8");

  assert.match(source, /"configuration:region:read"/);
  assert.match(source, /"configuration:region:create"/);
  assert.match(source, /"configuration:region:update"/);
  assert.match(source, /"configuration:region:deactivate"/);
});

