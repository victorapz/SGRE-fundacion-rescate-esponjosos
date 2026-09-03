"use strict";

import {
  fosterHomeAllowedAnimalCreateValidation,
  fosterHomeAllowedAnimalListQueryValidation,
  fosterHomeAllowedAnimalQueryValidation,
  fosterHomeAllowedAnimalUpdateBodyValidation,
} from "../../validations/foster_home_allowed_animal.validation.js";
import {
  createFosterHomeAllowedAnimalService,
  deleteFosterHomeAllowedAnimalService,
  getFosterHomeAllowedAnimalService,
  getFosterHomeAllowedAnimalsService,
  updateFosterHomeAllowedAnimalService,
} from "../../services/animalConcept/foster_home_allowed_animal.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createFosterHomeAllowedAnimal(req, res) {
  try {
    const { error } = fosterHomeAllowedAnimalCreateValidation.validate(req.body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [allowedAnimal, allowedAnimalError] =
      await createFosterHomeAllowedAnimalService(req.body);

    if (allowedAnimalError) {
      return handleErrorClient(res, 400, allowedAnimalError);
    }

    return handleSuccess(
      res,
      201,
      "Regla de animal permitido creada correctamente",
      allowedAnimal,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getFosterHomeAllowedAnimal(req, res) {
  try {
    const { error } = fosterHomeAllowedAnimalQueryValidation.validate(req.query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [allowedAnimal, allowedAnimalError] =
      await getFosterHomeAllowedAnimalService(req.query);

    if (allowedAnimalError) {
      return handleErrorClient(res, 404, allowedAnimalError);
    }

    return handleSuccess(
      res,
      200,
      "Regla de animal permitido encontrada",
      allowedAnimal,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getFosterHomeAllowedAnimals(req, res) {
  try {
    const { error } = fosterHomeAllowedAnimalListQueryValidation.validate(req.query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [allowedAnimals, allowedAnimalsError] =
      await getFosterHomeAllowedAnimalsService(req.query);

    if (allowedAnimalsError) {
      return handleErrorClient(res, 404, allowedAnimalsError);
    }

    return allowedAnimals.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(
          res,
          200,
          "Reglas de animales permitidos encontradas",
          allowedAnimals,
        );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateFosterHomeAllowedAnimal(req, res) {
  try {
    const { error: queryError } = fosterHomeAllowedAnimalQueryValidation.validate(req.query);

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } =
      fosterHomeAllowedAnimalUpdateBodyValidation.validate(req.body);

    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [allowedAnimal, allowedAnimalError] =
      await updateFosterHomeAllowedAnimalService(req.query, req.body);

    if (allowedAnimalError) {
      return handleErrorClient(res, 400, "Error modificando la regla", allowedAnimalError);
    }

    return handleSuccess(
      res,
      200,
      "Regla de animal permitido modificada correctamente",
      allowedAnimal,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteFosterHomeAllowedAnimal(req, res) {
  try {
    const { error } = fosterHomeAllowedAnimalQueryValidation.validate(req.query);

    if (error) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        error.message,
      );
    }

    const [allowedAnimal, allowedAnimalError] =
      await deleteFosterHomeAllowedAnimalService(req.query);

    if (allowedAnimalError) {
      return handleErrorClient(res, 404, "Error eliminando la regla", allowedAnimalError);
    }

    return handleSuccess(
      res,
      200,
      "Regla de animal permitido eliminada correctamente",
      allowedAnimal,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
