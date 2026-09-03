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
  new URL("./inventory_report.routes.js?inventory-rbac-test", import.meta.url)
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

function getExistencesPreviewHandlers() {
  const authenticateLayer = inventoryReportRoutes.stack.find((layer) => !layer.route);
  const previewRouteLayer = inventoryReportRoutes.stack.find(
    (layer) => layer.route?.path === "/existences",
  );

  if (!authenticateLayer || !previewRouteLayer) {
    throw new Error("No fue posible localizar la ruta del preview de existencias.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorize: previewRouteLayer.route.stack[0].handle,
    controller: previewRouteLayer.route.stack[1].handle,
  };
}

function getExistencesExportHandlers() {
  const authenticateLayer = inventoryReportRoutes.stack.find((layer) => !layer.route);
  const exportRouteLayer = inventoryReportRoutes.stack.find(
    (layer) => layer.route?.path === "/existences/export",
  );

  if (!authenticateLayer || !exportRouteLayer) {
    throw new Error("No fue posible localizar la ruta de exportacion de existencias.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorizeAny: exportRouteLayer.route.stack[0].handle,
    authorizeRead: exportRouteLayer.route.stack[1].handle,
    authorizeExport: exportRouteLayer.route.stack[2].handle,
    controller: exportRouteLayer.route.stack[3].handle,
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

test("preview de existencias responde 401 sin usuario autenticado", async () => {
  const { authenticate, authorize, controller } = getExistencesPreviewHandlers();
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

test("preview de existencias responde 403 sin permiso", async () => {
  const { authenticate, authorize, controller } = getExistencesPreviewHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(buildUserWithPermissions(["inventory:item:read"]), async () => {
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

test("preview de existencias supera auth y RBAC con permiso valido antes del controller", async () => {
  const { authenticate, authorize, controller } = getExistencesPreviewHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: { ubicacion_id: "-1" },
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["inventory:inventory_existence:read"]),
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

test("export de existencias responde 403 si falta permiso inventory:report:export", async () => {
  const { authenticate, authorizeAny, authorizeRead, authorizeExport } = getExistencesExportHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: { format: "pdf" },
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["inventory:inventory_existence:read"]),
    async () => {
      await authenticate(req, res, async () => {
        await authorizeAny(req, res, async () => {
          await authorizeRead(req, res, async () => {
            await authorizeExport(req, res, () => {
              controllerReached = true;
            });
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

test("export de existencias supera auth y permisos antes del controller", async () => {
  const { authenticate, authorizeAny, authorizeRead, authorizeExport, controller } = getExistencesExportHandlers();
  const req = {
    authenticatedUser: { id_usuario: 88 },
    query: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["inventory:inventory_existence:read", "inventory:report:export"]),
    async () => {
      await authenticate(req, res, async () => {
        await authorizeAny(req, res, async () => {
          await authorizeRead(req, res, async () => {
            await authorizeExport(req, res, () => {
              controllerReached = true;
            });
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
