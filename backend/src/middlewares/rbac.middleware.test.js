"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import { AppDataSource } from "../config/configDb.js";
import { checkRbac } from "./rbac.middleware.js";

function buildMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function buildUserWithPermissions(permissions = []) {
  return {
    id_usuario: 101,
    UserRole: [
      {
        role: {
          RolePermission: permissions.map((permission) => ({
            permission: { nombre: permission },
          })),
        },
      },
    ],
  };
}

async function withFakeUserRepository(user, callback) {
  const originalGetRepository = AppDataSource.getRepository;

  AppDataSource.getRepository = () => ({
    async findOne() {
      return user;
    },
  });

  try {
    return await callback();
  } finally {
    AppDataSource.getRepository = originalGetRepository;
  }
}

test("checkRbac responde 403 con mensaje generico y sin metadata interna cuando falta permiso", async () => {
  const middleware = checkRbac("inventory:report:export");
  const req = {
    user: { id_usuario: 101 },
  };
  const res = buildMockResponse();
  let nextCalled = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["inventory:inventory_existence:read"]),
    async () => {
      await middleware(req, res, () => {
        nextCalled = true;
      });
    },
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    success: false,
    message: "No tienes permisos para realizar esta acción.",
  });
  assert.equal("userPermissions" in res.payload, false);
  assert.equal("roles" in res.payload, false);
  assert.equal("token" in res.payload, false);
  assert.equal("error" in res.payload, false);
});

test("checkRbac conserva el flujo actual cuando el usuario si tiene permiso", async () => {
  const middleware = checkRbac("inventory:report:export");
  const req = {
    user: { id_usuario: 101 },
  };
  const res = buildMockResponse();
  let nextCalled = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["inventory:report:export"]),
    async () => {
      await middleware(req, res, () => {
        nextCalled = true;
      });
    },
  );

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
  assert.deepEqual(req.permissions, ["inventory:report:export"]);
});
