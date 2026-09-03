"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PERMISSIONS } from "../../../frontend/src/config/permissions.js";
import {
  PERMISSION_CATALOG,
  PERMISSION_CATALOG_INTEGRITY,
  getPermissionMetadata,
} from "../../../frontend/src/constants/permissionCatalog.js";

const ACCOUNTING_REPORT_EXPORT = "accounting:report:export";
const INVENTORY_REPORT_EXPORT = "inventory:report:export";

test("frontend permissions expone los permisos de exportacion de reportes", () => {
  assert.equal(PERMISSIONS.ACCOUNTING.REPORT_EXPORT, ACCOUNTING_REPORT_EXPORT);
  assert.equal(PERMISSIONS.INVENTORY.REPORT_EXPORT, INVENTORY_REPORT_EXPORT);
  assert.equal(PERMISSIONS.USERS.PASSWORD_RESET, "users:user_password:reset");
});

test("permission catalog incluye permisos de reportes, asignaciones y reset con integridad", () => {
  const accountingPermission = getPermissionMetadata(ACCOUNTING_REPORT_EXPORT);
  const inventoryPermission = getPermissionMetadata(INVENTORY_REPORT_EXPORT);
  const userRoleAssignPermission = getPermissionMetadata(PERMISSIONS.USERS.ROLE_ASSIGN);
  const userAreaAssignPermission = getPermissionMetadata(PERMISSIONS.USERS.AREA_ASSIGN);
  const passwordResetPermission = getPermissionMetadata(PERMISSIONS.USERS.PASSWORD_RESET);

  assert.equal(accountingPermission.module, "Contabilidad");
  assert.equal(accountingPermission.group, "Reportes");
  assert.notEqual(accountingPermission.label, ACCOUNTING_REPORT_EXPORT);
  assert.notEqual(accountingPermission.description, ACCOUNTING_REPORT_EXPORT);

  assert.equal(inventoryPermission.module, "Inventario");
  assert.equal(inventoryPermission.group, "Reportes");
  assert.notEqual(inventoryPermission.label, INVENTORY_REPORT_EXPORT);
  assert.notEqual(inventoryPermission.description, INVENTORY_REPORT_EXPORT);

  assert.equal(userRoleAssignPermission.label, "Asignar roles a usuarios");
  assert.equal(userAreaAssignPermission.label, "Asignar áreas a usuarios");
  assert.equal(passwordResetPermission.label, "Restablecer contrasenas de usuarios");
  assert.equal(passwordResetPermission.group, "Administracion");

  assert.deepEqual(PERMISSION_CATALOG_INTEGRITY.duplicateKeys, []);
  assert.deepEqual(PERMISSION_CATALOG_INTEGRITY.missingKeys, []);
  assert.deepEqual(PERMISSION_CATALOG_INTEGRITY.extraKeys, []);

  assert.ok(PERMISSION_CATALOG.some((entry) => entry.key === ACCOUNTING_REPORT_EXPORT));
  assert.ok(PERMISSION_CATALOG.some((entry) => entry.key === INVENTORY_REPORT_EXPORT));
  assert.ok(PERMISSION_CATALOG.some((entry) => entry.key === PERMISSIONS.USERS.ROLE_ASSIGN));
  assert.ok(PERMISSION_CATALOG.some((entry) => entry.key === PERMISSIONS.USERS.AREA_ASSIGN));
  assert.ok(PERMISSION_CATALOG.some((entry) => entry.key === PERMISSIONS.USERS.PASSWORD_RESET));
});

test("initialSetup registra permisos de reportes y reset para nuevas bases", async () => {
  const source = await readFile(
    new URL("../config/initialSetup.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /"accounting:report:export"/);
  assert.match(source, /"inventory:report:export"/);
  assert.match(source, /"users:user_role:assign"/);
  assert.match(source, /"users:user_area:assign"/);
  assert.match(source, /"users:user_password:reset"/);
  assert.match(source, /\[DEFAULT_ROLES\.ADMIN\]: null/);
});
