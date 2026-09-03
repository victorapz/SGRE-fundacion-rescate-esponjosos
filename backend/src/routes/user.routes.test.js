"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import passport from "passport";
import { AppDataSource } from "../config/configDb.js";

process.env.ACCESS_TOKEN_SECRET ||= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.CORS_ALLOWED_ORIGINS ||= "http://localhost:5173";
process.env.CORS_ALLOW_CREDENTIALS ||= "true";

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

const { default: userRoutes } = await import(
  new URL("./user.routes.js?user-routes-test", import.meta.url),
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

function getPasswordResetHandlers() {
  const authenticateLayer = userRoutes.stack.find((layer) => !layer.route);
  const passwordResetRoute = userRoutes.stack.find(
    (layer) => layer.route?.path === "/:id/password" && layer.route?.methods?.patch,
  );

  if (!authenticateLayer || !passwordResetRoute) {
    throw new Error("No fue posible localizar la ruta de reset de contrasena.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorize: passwordResetRoute.route.stack[0].handle,
    controller: passwordResetRoute.route.stack[1].handle,
  };
}

test("user routes expone el endpoint separado para reset administrativo de contrasena", () => {
  const passwordResetRoute = userRoutes.stack.find(
    (layer) => layer.route?.path === "/:id/password" && layer.route?.methods?.patch,
  );
  const updateRoute = userRoutes.stack.find(
    (layer) => layer.route?.path === "/detail/" && layer.route?.methods?.patch,
  );

  assert.ok(passwordResetRoute);
  assert.ok(updateRoute);
});

test("reset administrativo responde 401 sin usuario autenticado", async () => {
  const { authenticate, authorize, controller } = getPasswordResetHandlers();
  const req = { params: { id: "9" }, body: {} };
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

test("reset administrativo responde 403 si el actor no tiene el permiso especifico", async () => {
  const { authenticate, authorize } = getPasswordResetHandlers();
  const req = {
    authenticatedUser: { id_usuario: 55 },
    params: { id: "9" },
    body: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["users:user:update"]),
    async () => {
      await authenticate(req, res, async () => {
        await authorize(req, res, () => {
          controllerReached = true;
        });
      });
    },
  );

  assert.equal(res.statusCode, 403);
  assert.equal(controllerReached, false);
  assert.equal(res.payload?.message, "No tienes permisos para realizar esta acción.");
  assert.equal("userPermissions" in (res.payload || {}), false);
  assert.equal("roles" in (res.payload || {}), false);
});

test("reset administrativo supera auth y RBAC con users:user_password:reset", async () => {
  const { authenticate, authorize } = getPasswordResetHandlers();
  const req = {
    authenticatedUser: { id_usuario: 55 },
    params: { id: "9" },
    body: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["users:user_password:reset"]),
    async () => {
      await authenticate(req, res, async () => {
        await authorize(req, res, () => {
          controllerReached = true;
        });
      });
    },
  );

  assert.equal(controllerReached, true);
});
