import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "../config/permissions.js";
import {
  PERMISSION_CATALOG,
  PERMISSION_CATALOG_INTEGRITY,
  getPermissionDescription,
  getPermissionLabel,
  getPermissionMetadata,
} from "./permissionCatalog.js";

const FILE_PERMISSION_KEYS = [
  PERMISSIONS.FILES.READ,
  PERMISSIONS.FILES.UPLOAD,
  PERMISSIONS.FILES.DOWNLOAD,
  PERMISSIONS.FILES.DELETE,
  PERMISSIONS.FILES.UPDATE,
  PERMISSIONS.FILES.MANAGE_VISIBILITY,
  PERMISSIONS.FILES.ANIMAL_READ,
  PERMISSIONS.FILES.ANIMAL_UPLOAD,
  PERMISSIONS.FILES.ANIMAL_DELETE,
  PERMISSIONS.FILES.ANIMAL_CLINICAL_READ,
  PERMISSIONS.FILES.ANIMAL_CLINICAL_UPLOAD,
  PERMISSIONS.FILES.ANIMAL_CLINICAL_DELETE,
  PERMISSIONS.FILES.ACCOUNTING_READ,
  PERMISSIONS.FILES.ACCOUNTING_UPLOAD,
  PERMISSIONS.FILES.ACCOUNTING_DELETE,
  PERMISSIONS.FILES.USER_DOCUMENT_READ,
  PERMISSIONS.FILES.USER_DOCUMENT_UPLOAD,
  PERMISSIONS.FILES.USER_DOCUMENT_DELETE,
];

test("permission catalog mantiene integridad y cubre reset de contraseña", () => {
  assert.deepEqual(PERMISSION_CATALOG_INTEGRITY.duplicateKeys, []);
  assert.deepEqual(PERMISSION_CATALOG_INTEGRITY.missingKeys, []);
  assert.deepEqual(PERMISSION_CATALOG_INTEGRITY.extraKeys, []);

  const accountingPermission = getPermissionMetadata(PERMISSIONS.ACCOUNTING.REPORT_EXPORT);
  const inventoryPermission = getPermissionMetadata(PERMISSIONS.INVENTORY.REPORT_EXPORT);
  const userRoleAssignPermission = getPermissionMetadata(PERMISSIONS.USERS.ROLE_ASSIGN);
  const userAreaAssignPermission = getPermissionMetadata(PERMISSIONS.USERS.AREA_ASSIGN);
  const passwordResetPermission = getPermissionMetadata(PERMISSIONS.USERS.PASSWORD_RESET);
  const regionReadPermission = getPermissionMetadata(PERMISSIONS.CONFIGURATION.REGION_READ);
  const communeDeactivatePermission = getPermissionMetadata(
    PERMISSIONS.CONFIGURATION.COMMUNE_DEACTIVATE,
  );

  assert.equal(accountingPermission.group, "Reportes");
  assert.equal(inventoryPermission.group, "Reportes");
  assert.equal(userRoleAssignPermission.label, "Asignar roles a usuarios");
  assert.equal(userRoleAssignPermission.group, "Asignaciones");
  assert.equal(userAreaAssignPermission.label, "Asignar áreas a usuarios");
  assert.equal(userAreaAssignPermission.group, "Asignaciones");
  assert.equal(passwordResetPermission.label, "Restablecer contraseñas de usuarios");
  assert.equal(passwordResetPermission.group, "Administracion");
  assert.equal(regionReadPermission.label, "Ver regiones");
  assert.equal(regionReadPermission.module, "Configuracion");
  assert.equal(communeDeactivatePermission.label, "Activar o desactivar comunas");
  assert.equal(communeDeactivatePermission.group, "Estados");
});

test("permission catalog cubre las 18 claves reales del módulo de archivos", () => {
  FILE_PERMISSION_KEYS.forEach((permissionKey) => {
    const metadata = getPermissionMetadata(permissionKey);
    assert.equal(metadata.module, "Archivos");
    assert.ok(metadata.label);
    assert.ok(metadata.description);
    assert.notEqual(metadata.label, "Permiso sin nombre configurado");
    assert.notEqual(metadata.description, "Este permiso requiere revisión del catálogo.");
  });
});

test("permission catalog no usa claves tecnicas como label o descripción visible", () => {
  for (const permission of PERMISSION_CATALOG) {
    assert.ok(permission.label);
    assert.ok(permission.description);
    assert.notEqual(permission.label, permission.key);
    assert.notEqual(permission.description, permission.key);
    assert.equal(getPermissionLabel(permission.key), permission.label);
    assert.equal(getPermissionDescription(permission.key), permission.description);
  }

  const fallbackLabel = getPermissionLabel("permiso:inexistente");
  const fallbackDescription = getPermissionDescription("permiso:inexistente");

  assert.equal(fallbackLabel, "Permiso sin nombre configurado");
  assert.equal(fallbackDescription, "Este permiso requiere revisión del catálogo.");
});
