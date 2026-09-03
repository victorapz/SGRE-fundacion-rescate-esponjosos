"use strict";

import { getPermissionsService } from "../services/permission.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export async function getPermissions(req, res) {
  try {
    const [permissions, errorPermissions] = await getPermissionsService();

    if (errorPermissions) {
      return handleErrorClient(res, 404, errorPermissions);
    }

    return handleSuccess(res, 200, "Permisos encontrados", permissions ?? []);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
