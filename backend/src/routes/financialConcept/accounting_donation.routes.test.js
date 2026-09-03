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

const { default: accountingDonationRoutes } = await import(
  new URL("./accounting_donation.routes.js?rbac-test", import.meta.url)
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
    id_usuario: 99,
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

function getRefundRouteHandlers() {
  const authenticateLayer = accountingDonationRoutes.stack.find((layer) => !layer.route);
  const refundRouteLayer = accountingDonationRoutes.stack.find(
    (layer) => layer.route?.path === "/:paymentOrderId/refunds",
  );

  if (!authenticateLayer || !refundRouteLayer) {
    throw new Error("No fue posible localizar la ruta administrativa de refunds.");
  }

  return {
    authenticate: authenticateLayer.handle,
    authorize: refundRouteLayer.route.stack[0].handle,
    controller: refundRouteLayer.route.stack[1].handle,
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

test("la ruta administrativa de refunds responde 401 sin usuario autenticado y no alcanza RBAC ni controller", async () => {
  const { authenticate, authorize, controller } = getRefundRouteHandlers();
  const req = {
    params: { paymentOrderId: "20" },
    body: { monto: 2, motivo: "Solicitud valida" },
  };
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

test("la ruta administrativa de refunds responde 403 sin permiso y no alcanza el controller", async () => {
  const { authenticate, authorize, controller } = getRefundRouteHandlers();
  const req = {
    authenticatedUser: { id_usuario: 99 },
    params: { paymentOrderId: "20" },
    body: { monto: 2, motivo: "Solicitud valida" },
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(buildUserWithPermissions(["accounting:payment_order:read"]), async () => {
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
});

test("la ruta administrativa de refunds supera auth y RBAC con permiso valido antes del controller", async () => {
  const { authenticate, authorize, controller } = getRefundRouteHandlers();
  const req = {
    authenticatedUser: { id_usuario: 99 },
    params: { paymentOrderId: "20" },
    body: {},
  };
  const res = buildMockResponse();
  let controllerReached = false;

  await withFakeUserRepository(
    buildUserWithPermissions(["accounting:donation_refund:create"]),
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
