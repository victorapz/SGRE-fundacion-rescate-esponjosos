"use strict";

import { AppDataSource } from "../config/configDb.js";
import { handleErrorServer, handleSuccess } from "../handlers/responseHandlers.js";

export async function getHealth(req, res) {
  try {
    const database = {
      configured: Boolean(AppDataSource.options?.host),
      initialized: Boolean(AppDataSource.isInitialized),
      reachable: false,
    };

    if (AppDataSource.isInitialized) {
      await AppDataSource.query("SELECT 1");
      database.reachable = true;
    }

    return handleSuccess(res, 200, "Backend operativo", {
      status: "ok",
      database,
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    return handleErrorServer(res, 503, "Backend disponible, pero la base de datos no responde.");
  }
}
