import assert from "node:assert/strict";
import test from "node:test";
import {
  requireUserCreateAssignmentPermissions,
  requireUserUpdateAssignmentPermissions,
} from "./user-authorization.middleware.js";

function buildResponse() {
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

test("requireUserUpdateAssignmentPermissions permite edicion basica sin campos relacionales", () => {
  const req = {
    user: { id_usuario: 10 },
    permissions: ["users:user:update"],
    body: { nombre: "Jose" },
  };
  const res = buildResponse();
  let nextCalled = false;

  requireUserUpdateAssignmentPermissions(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
});

test("requireUserUpdateAssignmentPermissions bloquea role_ids sin permiso de asignacion", () => {
  const req = {
    user: { id_usuario: 10 },
    permissions: ["users:user:update"],
    body: { role_ids: [1] },
  };
  const res = buildResponse();
  let nextCalled = false;

  requireUserUpdateAssignmentPermissions(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /No tienes permisos/i);
});

test("requireUserUpdateAssignmentPermissions bloquea area_ids sin permiso de asignacion", () => {
  const req = {
    user: { id_usuario: 10 },
    permissions: ["users:user:update"],
    body: { area_ids: [1] },
  };
  const res = buildResponse();
  let nextCalled = false;

  requireUserUpdateAssignmentPermissions(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /No tienes permisos/i);
});

test("requireUserUpdateAssignmentPermissions permite asignaciones con permisos completos", () => {
  const req = {
    user: { id_usuario: 10 },
    permissions: [
      "users:user:update",
      "users:user_role:assign",
      "users:user_area:assign",
    ],
    body: { role_ids: [1], area_ids: [2] },
  };
  const res = buildResponse();
  let nextCalled = false;

  requireUserUpdateAssignmentPermissions(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
});

test("requireUserCreateAssignmentPermissions bloquea creacion sin permisos de asignacion", () => {
  const req = {
    user: { id_usuario: 10 },
    permissions: ["users:user:create"],
    body: {},
  };
  const res = buildResponse();
  let nextCalled = false;

  requireUserCreateAssignmentPermissions(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /No tienes permisos/i);
});

test("requireUserCreateAssignmentPermissions permite creacion con permisos completos", () => {
  const req = {
    user: { id_usuario: 10 },
    permissions: [
      "users:user:create",
      "users:user_role:assign",
      "users:user_area:assign",
    ],
    body: {},
  };
  const res = buildResponse();
  let nextCalled = false;

  requireUserCreateAssignmentPermissions(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
});
