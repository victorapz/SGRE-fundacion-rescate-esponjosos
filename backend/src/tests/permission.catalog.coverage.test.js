"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PERMISSIONS } from "../../../frontend/src/config/permissions.js";
import {
  PERMISSION_CATALOG,
  getPermissionMetadata,
} from "../../../frontend/src/constants/permissionCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const FILE_PERMISSION_KEYS = [
  "files:accounting:delete",
  "files:accounting:read",
  "files:accounting:upload",
  "files:animal:delete",
  "files:animal:read",
  "files:animal:upload",
  "files:animal_clinical:delete",
  "files:animal_clinical:read",
  "files:animal_clinical:upload",
  "files:file:delete",
  "files:file:download",
  "files:file:manage_visibility",
  "files:file:read",
  "files:file:update",
  "files:file:upload",
  "files:user_document:delete",
  "files:user_document:read",
  "files:user_document:upload",
];

function extractQuotedPermissions(source = "") {
  return Array.from(source.matchAll(/"([a-z]+:[^"\n]+?)"/g))
    .map((match) => match[1])
    .filter((value) => value.includes(":"));
}

async function collectRoutePermissions(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const permissions = new Set();

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectRoutePermissions(fullPath);
      nested.forEach((permission) => permissions.add(permission));
      continue;
    }

    if (!entry.name.endsWith(".js")) {
      continue;
    }

    const source = await readFile(fullPath, "utf8");
    for (const match of source.matchAll(/checkRbac\(([\s\S]*?)\)/g)) {
      extractQuotedPermissions(match[1]).forEach((permission) => permissions.add(permission));
    }
  }

  return permissions;
}

test("catalogo frontend cubre permisos reales de seeds, rutas y constantes", async () => {
  const initialSetupSource = await readFile(
    path.join(REPO_ROOT, "backend/src/config/initialSetup.js"),
    "utf8",
  );
  const initialSetupDemoSource = await readFile(
    path.join(REPO_ROOT, "backend/src/config/initialSetup.demo.js"),
    "utf8",
  );
  const routePermissions = await collectRoutePermissions(
    path.join(REPO_ROOT, "backend/src/routes"),
  );
  const frontendPermissionKeys = Array.from(
    new Set(
      JSON.stringify(PERMISSIONS)
        .match(/"[a-z]+:[^"]+"/g)
        ?.map((item) => item.slice(1, -1)) || [],
    ),
  );

  const sourceKeys = new Set([
    ...extractQuotedPermissions(initialSetupSource),
    ...extractQuotedPermissions(initialSetupDemoSource),
    ...routePermissions,
    ...frontendPermissionKeys,
  ]);

  const fallbackUsers = Array.from(sourceKeys).filter((permissionKey) => {
    const metadata = getPermissionMetadata(permissionKey);
    return metadata.label === "Permiso sin nombre configurado";
  });

  assert.deepEqual(fallbackUsers.sort(), []);
});

test("catalogo incluye las 18 claves reales del modulo de archivos y el nuevo permiso de reset", () => {
  const catalogKeys = new Set(PERMISSION_CATALOG.map((entry) => entry.key));

  FILE_PERMISSION_KEYS.forEach((permissionKey) => {
    assert.equal(catalogKeys.has(permissionKey), true, `Falta ${permissionKey}`);
    const metadata = getPermissionMetadata(permissionKey);
    assert.equal(metadata.module, "Archivos");
    assert.notEqual(metadata.label, "Permiso sin nombre configurado");
  });

  const passwordResetPermission = getPermissionMetadata("users:user_password:reset");
  assert.equal(passwordResetPermission.module, "Usuarios");
  assert.equal(passwordResetPermission.group, "Administracion");
  assert.equal(passwordResetPermission.label, "Restablecer contrasenas de usuarios");

  const regionReadPermission = getPermissionMetadata(PERMISSIONS.CONFIGURATION.REGION_READ);
  const communeDeactivatePermission = getPermissionMetadata(
    PERMISSIONS.CONFIGURATION.COMMUNE_DEACTIVATE,
  );
  assert.equal(regionReadPermission.module, "Configuracion");
  assert.equal(regionReadPermission.label, "Ver regiones");
  assert.equal(communeDeactivatePermission.group, "Estados");
  assert.equal(communeDeactivatePermission.label, "Activar o desactivar comunas");
});
