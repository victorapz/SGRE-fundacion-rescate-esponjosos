"use strict";

import {
  comunaCreateValidation,
  comunaQueryValidation,
  comunaUpdateBodyValidation,
} from "../validations/comuna.validation.js";
import {
  createComunaService,
  getComunaService,
  getComunasService,
  toggleComunaActiveService,
  updateComunaService,
} from "../services/comuna.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export async function createComuna(req, res) {
  try {
    const { error } = comunaCreateValidation.validate(req.body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [comuna, comunaError] = await createComunaService(req.body);

    if (comunaError) {
      return handleErrorClient(res, 400, comunaError);
    }

    return handleSuccess(res, 201, "Comuna creada correctamente.", comuna);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getComuna(req, res) {
  try {
    const payload = { id_comuna: req.params.id || req.query.id_comuna };
    const { error } = comunaQueryValidation.validate(payload);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [comuna, comunaError] = await getComunaService(payload);

    if (comunaError) {
      return handleErrorClient(res, 404, comunaError);
    }

    return handleSuccess(res, 200, "Comuna encontrada.", comuna);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getComunas(req, res) {
  try {
    const [comunas, comunasError] = await getComunasService(req.query);

    if (comunasError) {
      return handleErrorClient(res, 400, comunasError);
    }

    return handleSuccess(res, 200, "Comunas encontradas.", comunas);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateComuna(req, res) {
  try {
    const queryPayload = { id_comuna: req.params.id || req.query.id_comuna };
    const { error: queryError } = comunaQueryValidation.validate(queryPayload);

    if (queryError) {
      return handleErrorClient(res, 400, "Error de validación", queryError.message);
    }

    const { error: bodyError } = comunaUpdateBodyValidation.validate(req.body);

    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validación", bodyError.message);
    }

    const [comuna, comunaError] = await updateComunaService(queryPayload, req.body);

    if (comunaError) {
      return handleErrorClient(res, 400, comunaError);
    }

    return handleSuccess(res, 200, "Comuna modificada correctamente.", comuna);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function toggleComunaActive(req, res) {
  try {
    const payload = { id_comuna: req.params.id || req.query.id_comuna };
    const { error } = comunaQueryValidation.validate(payload);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [comuna, comunaError] = await toggleComunaActiveService(payload);

    if (comunaError) {
      return handleErrorClient(res, 400, comunaError);
    }

    return handleSuccess(
      res,
      200,
      comuna?.activo
        ? "La comuna fue activada correctamente."
        : "La comuna fue desactivada correctamente.",
      comuna,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
