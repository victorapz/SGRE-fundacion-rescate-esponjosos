"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import passport from "passport";
import { AppDataSource } from "../../config/configDb.js";

const originalAuthenticate = passport.authenticate;
passport.authenticate = () => (req, res, next) => {
  if (!req.authenticatedUser) {
    return res.status(401).json({
      success: false,
      message: "No autorizado",
      error: "Usuario no autenticado",
    });
  }

  req.user = req.authenticatedUser;
  return next();
};

const { default: accountingReportRoutes } = await import(
  new URL("./accounting_report.routes.js?rbac-test", import.meta.url)
);

passport.authenticate = originalAuthenticate;

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
    id_usuario: 55,
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

function getTransactionsPreviewHandlers() {
  const authenticateLayer = accountingReportRoutes.stack.find((layer) => !layer.route);
  const previewRouteLayer = accountingReportRoutes.stack.find(
    (layer) => layer.route?.path === "/transactions",
  );

  if (!authenticateLayer || !previewRouteLayer) {
    throw new Error("No fue posible localizar la ruta del preview contable.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorize: previewRouteLayer.route.stack[0].handle,
    controller: previewRouteLayer.route.stack[1].handle,
  };
}

function getTransactionsExportHandlers() {
  const authenticateLayer = accountingReportRoutes.stack.find((layer) => !layer.route);
  const exportRouteLayer = accountingReportRoutes.stack.find(
    (layer) => layer.route?.path === "/transactions/export",
  );

  if (!authenticateLayer || !exportRouteLayer) {
    throw new Error("No fue posible localizar la ruta de exportacion contable.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorizeAny: exportRouteLayer.route.stack[0].handle,
    authorizeAll: exportRouteLayer.route.stack[1].handle,
    controller: exportRouteLayer.route.stack[2].handle,
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

test("preview contable responde 401 sin usuario autenticado", async () => {
  const { authenticate, authorize, controller } = getTransactionsPreviewHandlers();
  const req = { query: {} };
  const res = buildMockResponse();
  let authorizeReached = false;
  let controllerReached = false;

  await authenticate(req, res, () => {
    authorizeReached = true;
  });

  if (authorizeReached) {
    await authorize(req, res, () => {
      controllerReached = true;
    });
  }

  if (controllerReached) {
    await controller(req, res);
  }

  assert.equal(res.statusCode, 401);
  assert.equal(authorizeReached, false);
  assert.equal(controllerReached, false);
});

test("preview contable responde 403 sin permiso", async () => {
  const { authenticate, authorize, controller } = getTransactionsPreviewHandlers();
  const req = {
    authenticatedUser: { id_usuario: 55 },
    query: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(buildUserWithPermissions(["accounting:payable:read"]), async () => {
    await authenticate(req, res, async () => {
      await authorize(req, res, () => {
        controllerReached = true;
      });
    });
  });

  if (controllerReached) {
    await controller(req, res);
  }

  assert.equal(res.statusCode, 403);
  assert.equal(controllerReached, false);
  assert.equal(res.payload?.message, "No tienes permisos para realizar esta acción.");
  assert.equal("userPermissions" in (res.payload || {}), false);
  assert.equal("roles" in (res.payload || {}), false);
  assert.equal("error" in (res.payload || {}), false);
});

test("preview contable supera auth y RBAC con permiso valido antes del controller", async () => {
  const { authenticate, authorize, controller } = getTransactionsPreviewHandlers();
  const req = {
    authenticatedUser: { id_usuario: 55 },
    query: { categoria_id: "-1" },
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["accounting:transaction:read"]),
    async () => {
      await authenticate(req, res, async () => {
        await authorize(req, res, () => {
          controllerReached = true;
        });
      });
    },
  );

  assert.equal(controllerReached, true);

  await controller(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload?.status, "Client error");
});

test("export contable responde 403 si falta permiso de exportacion", async () => {
  const { authenticate, authorizeAny, authorizeAll } = getTransactionsExportHandlers();
  const req = {
    authenticatedUser: { id_usuario: 55 },
    query: { format: "pdf" },
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["accounting:transaction:read"]),
    async () => {
      await authenticate(req, res, async () => {
        await authorizeAny(req, res, async () => {
          await authorizeAll(req, res, () => {
            controllerReached = true;
          });
        });
      });
    },
  );

  assert.equal(res.statusCode, 403);
  assert.equal(controllerReached, false);
  assert.equal(res.payload?.message, "No tienes permisos para realizar esta acción.");
  assert.equal("userPermissions" in (res.payload || {}), false);
  assert.equal("roles" in (res.payload || {}), false);
  assert.equal("error" in (res.payload || {}), false);
});

test("export contable supera auth y permisos antes del controller", async () => {
  const { authenticate, authorizeAny, authorizeAll, controller } = getTransactionsExportHandlers();
  const req = {
    authenticatedUser: { id_usuario: 55 },
    query: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["accounting:transaction:read", "accounting:report:export"]),
    async () => {
      await authenticate(req, res, async () => {
        await authorizeAny(req, res, async () => {
          await authorizeAll(req, res, () => {
            controllerReached = true;
          });
        });
      });
    },
  );

  assert.equal(controllerReached, true);
  await controller(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload?.status, "Client error");
});
