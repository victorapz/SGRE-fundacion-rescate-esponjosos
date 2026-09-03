"use strict";

import cors from "cors";
import express, { json } from "express";
import morgan from "morgan";
import passport from "passport";
import indexRoutes from "./routes/index.routes.js";
import {
  APP_HOST,
  CORS_ALLOW_CREDENTIALS,
  TRUST_PROXY,
  getAllowedCorsOrigins,
} from "./config/configEnv.js";
import { passportJwtSetup } from "./auth/passport.auth.js";

const PAYPAL_WEBHOOK_ROUTE_REGEX = /^\/api\/webhooks\/paypal\/?$/;

function shouldPreservePayPalWebhookRawBody(req) {
  const requestPath = String(req.originalUrl || req.url || "").split("?")[0];
  return req.method === "POST" && PAYPAL_WEBHOOK_ROUTE_REGEX.test(requestPath);
}

export function buildCorsOptions() {
  const allowedOrigins = new Set(getAllowedCorsOrigins());

  return {
    credentials: CORS_ALLOW_CREDENTIALS,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido por CORS"));
    },
  };
}

export function createApp() {
  const app = express();
  app.set("trust proxy", TRUST_PROXY || APP_HOST || "loopback");
  app.use(cors(buildCorsOptions()));
  app.use(morgan("dev"));
  app.use(json({
    verify(req, _res, buf) {
      if (shouldPreservePayPalWebhookRawBody(req)) {
        req.rawBody = Buffer.from(buf);
      }
    },
  }));

  passportJwtSetup();
  app.use(passport.initialize());
  app.use("/api", indexRoutes);

  return app;
}
