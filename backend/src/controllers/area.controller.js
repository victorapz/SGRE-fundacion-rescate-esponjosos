"use strict";

import {
  areaCreateValidation,
  areaQueryValidation,
  areaUpdateValidation,
} from "../validations/area.validation.js";
import {
  createAreaService,
  getAreaService,
  getAreasService,
  getAreaUsageService,
  toggleAreaActiveService,
  updateAreaService,
} from "../services/area.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export async function createArea(req, res) {
  try {
    const { error } = areaCreateValidation.validate(req.body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [area, areaError] = await createAreaService(req.body);

    if (areaError) {
      return handleErrorClient(res, 400, areaError);
    }

    return handleSuccess(res, 201, "Área creada correctamente.", area);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getArea(req, res) {
  try {
    const payload = { id_area: req.params.id || req.query.id_area };
    const { error } = areaQueryValidation.validate(payload);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [area, areaError] = await getAreaService(payload);

    if (areaError) {
      return handleErrorClient(res, 404, areaError);
    }

    return handleSuccess(res, 200, "Área encontrada.", area);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getAreas(req, res) {
  try {
    const [areas, areasError] = await getAreasService(req.query);

    if (areasError) {
      return handleErrorClient(res, 400, areasError);
    }

    return handleSuccess(res, 200, "Áreas encontradas.", areas ?? []);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateArea(req, res) {
  try {
    const queryPayload = { id_area: req.params.id || req.query.id_area };
    const { error: queryError } = areaQueryValidation.validate(queryPayload);

    if (queryError) {
      return handleErrorClient(res, 400, "Error de validación", queryError.message);
    }

    const { error: bodyError } = areaUpdateValidation.validate(req.body);

    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validación", bodyError.message);
    }

    const [area, areaError] = await updateAreaService(queryPayload, req.body);

    if (areaError) {
      return handleErrorClient(res, 400, areaError);
    }

    return handleSuccess(res, 200, "Área modificada correctamente.", area);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function toggleAreaActive(req, res) {
  try {
    const payload = { id_area: req.params.id || req.query.id_area };
    const { error } = areaQueryValidation.validate(payload);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [area, areaError] = await toggleAreaActiveService(payload);

    if (areaError) {
      return handleErrorClient(res, 400, areaError);
    }

    return handleSuccess(
      res,
      200,
      area?.activo
        ? "El área fue activada correctamente."
        : "El área fue desactivada correctamente.",
      area,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getAreaUsage(req, res) {
  try {
    const payload = { id_area: req.params.id || req.query.id_area };
    const { error } = areaQueryValidation.validate(payload);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [usage, usageError] = await getAreaUsageService(payload);

    if (usageError) {
      return handleErrorClient(res, 404, usageError);
    }

    return handleSuccess(res, 200, "Uso del área encontrado.", usage);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
