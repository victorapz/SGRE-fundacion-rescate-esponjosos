"use strict";

import {
  regionCreateValidation,
  regionQueryValidation,
  regionUpdateValidation,
} from "../validations/region.validation.js";
import {
  createRegionService,
  getRegionService,
  getRegionsService,
  toggleRegionActiveService,
  updateRegionService,
} from "../services/region.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export async function createRegion(req, res) {
  try {
    const { error } = regionCreateValidation.validate(req.body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [region, regionError] = await createRegionService(req.body);

    if (regionError) {
      return handleErrorClient(res, 400, regionError);
    }

    return handleSuccess(res, 201, "Región creada correctamente.", region);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getRegion(req, res) {
  try {
    const payload = { id_region: req.params.id || req.query.id_region };
    const { error } = regionQueryValidation.validate(payload);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [region, regionError] = await getRegionService(payload);

    if (regionError) {
      return handleErrorClient(res, 404, regionError);
    }

    return handleSuccess(res, 200, "Región encontrada.", region);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getRegions(req, res) {
  try {
    const [regions, regionsError] = await getRegionsService(req.query);

    if (regionsError) {
      return handleErrorClient(res, 400, regionsError);
    }

    return handleSuccess(res, 200, "Regiones encontradas.", regions);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateRegion(req, res) {
  try {
    const queryPayload = { id_region: req.params.id || req.query.id_region };
    const { error: queryError } = regionQueryValidation.validate(queryPayload);

    if (queryError) {
      return handleErrorClient(res, 400, "Error de validación", queryError.message);
    }

    const { error: bodyError } = regionUpdateValidation.validate(req.body);

    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validación", bodyError.message);
    }

    const [region, regionError] = await updateRegionService(queryPayload, req.body);

    if (regionError) {
      return handleErrorClient(res, 400, regionError);
    }

    return handleSuccess(res, 200, "Región modificada correctamente.", region);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function toggleRegionActive(req, res) {
  try {
    const payload = { id_region: req.params.id || req.query.id_region };
    const { error } = regionQueryValidation.validate(payload);

    if (error) {
      return handleErrorClient(res, 400, "Error de validación", error.message);
    }

    const [region, regionError] = await toggleRegionActiveService(payload);

    if (regionError) {
      return handleErrorClient(res, 400, regionError);
    }

    return handleSuccess(
      res,
      200,
      region?.activo
        ? "La región fue activada correctamente."
        : "La región fue desactivada correctamente.",
      region,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
