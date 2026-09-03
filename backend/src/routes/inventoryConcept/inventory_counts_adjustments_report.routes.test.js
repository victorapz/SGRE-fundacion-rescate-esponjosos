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

const { default: inventoryReportRoutes } = await import(
  new URL("./inventory_report.routes.js?inventory-counts-adjustments-rbac-test", import.meta.url)
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
    id_usuario: 88,
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

function getCountsAdjustmentsHandlers() {
  const authenticateLayer = inventoryReportRoutes.stack.find((layer) => !layer.route);
  const routeLayer = inventoryReportRoutes.stack.find(
    (layer) => layer.route?.path === "/counts-adjustments",
  );

  if (!authenticateLayer || !routeLayer) {
    throw new Error("No fue posible localizar la ruta del preview de conteos y ajustes.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorizeAny: routeLayer.route.stack[0].handle,
    authorizeAll: routeLayer.route.stack[1].handle,
    controller: routeLayer.route.stack[2].handle,
  };
}

function getCountsAdjustmentsExportHandlers() {
  const authenticateLayer = inventoryReportRoutes.stack.find((layer) => !layer.route);
  const routeLayer = inventoryReportRoutes.stack.find(
    (layer) => layer.route?.path === "/counts-adjustments/export",
  );

  if (!authenticateLayer || !routeLayer) {
    throw new Error("No fue posible localizar la ruta de exportacion de conteos y ajustes.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorizeAny: routeLayer.route.stack[0].handle,
    authorizeAll: routeLayer.route.stack[1].handle,
    controller: routeLayer.route.stack[2].handle,
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

test("preview de conteos y ajustes responde 401 sin usuario autenticado", async () => {
  const { authenticate, authorizeAny, authorizeAll, controller } = getCountsAdjustmentsHandlers();
  const req = { query: {} };
  const res = buildMockResponse();
  let authorizeAnyReached = false;
  let authorizeAllReached = false;
  let controllerReached = false;

  await authenticate(req, res, () => {
    authorizeAnyReached = true;
  });

  if (authorizeAnyReached) {
    await authorizeAny(req, res, () => {
      authorizeAllReached = true;
    });
  }

  if (authorizeAllReached) {
    await authorizeAll(req, res, () => {
      controllerReached = true;
    });
  }

  if (controllerReached) {
    await controller(req, res);
  }

  assert.equal(res.statusCode, 401);
  assert.equal(authorizeAnyReached, false);
  assert.equal(authorizeAllReached, false);
  assert.equal(controllerReached, false);
});

test("preview de conteos y ajustes responde 403 si falta uno de los permisos requeridos", async () => {
  const { authenticate, authorizeAny, authorizeAll, controller } = getCountsAdjustmentsHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions([
      "inventory:stock_count:read",
      "inventory:read:location",
    ]),
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

test("preview de conteos y ajustes supera auth y permisos antes del controller", async () => {
  const { authenticate, authorizeAny, authorizeAll, controller } = getCountsAdjustmentsHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: { ubicacion_id: "-1" },
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions([
      "inventory:stock_count:read",
      "inventory:inventory_adjustment:read",
      "inventory:read:location",
    ]),
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

test("export de conteos y ajustes responde 403 si falta inventory:report:export", async () => {
  const { authenticate, authorizeAny, authorizeAll } = getCountsAdjustmentsExportHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: { format: "xlsx" },
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions([
      "inventory:stock_count:read",
      "inventory:inventory_adjustment:read",
    ]),
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

test("export de conteos y ajustes supera auth y permisos antes del controller", async () => {
  const { authenticate, authorizeAny, authorizeAll, controller } = getCountsAdjustmentsExportHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions([
      "inventory:stock_count:read",
      "inventory:inventory_adjustment:read",
      "inventory:report:export",
    ]),
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
