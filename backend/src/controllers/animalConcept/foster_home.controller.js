"use strict";

import {
  fosterHomeCreateValidation,
  fosterHomeQueryValidation,
  fosterHomeUpdateBodyValidation,
} from "../../validations/foster_home.validation.js";

import {
  createFosterHomeService,
  deleteFosterHomeService,
  getEligibleAnimalsForFosterHomeService,
  getFosterHomesService,
  getFosterHomeService,
  getMyFosterHomeService,
  updateFosterHomeService,
} from "../../services/animalConcept/foster_home.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createFosterHome(req, res) {
  try {
    const { body } = req;
    const authContext = {
      user: req.user,
      permissions: req.permissions || [],
    };

    const { error } = fosterHomeCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [home, errorHome] = await createFosterHomeService(body, authContext);

    if (errorHome) return handleErrorClient(res, 400, errorHome);

    handleSuccess(res, 201, "Hogar temporal creado correctamente", home);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getFosterHome(req, res) {
  try {
    const { id } = req.query;
    const authContext = {
      user: req.user,
      permissions: req.permissions || [],
    };

    const { error } = fosterHomeQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [home, errorHome, errorStatus] = await getFosterHomeService({ id }, authContext);

    if (errorHome) return handleErrorClient(res, errorStatus || 404, errorHome);

    handleSuccess(res, 200, "Hogar temporal encontrado", home);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getFosterHomes(req, res) {
  try {
    const authContext = {
      user: req.user,
      permissions: req.permissions || [],
    };
    const [homes, errorHomes] = await getFosterHomesService(authContext);

    if (errorHomes) return handleErrorClient(res, 404, errorHomes);

    homes.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Hogares temporales encontrados", homes);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getEligibleAnimalsForFosterHome(req, res) {
  try {
    const { id } = req.query;
    const authContext = {
      user: req.user,
      permissions: req.permissions || [],
    };

    const { error } = fosterHomeQueryValidation.validate({ id });

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [animals, animalsError, errorStatus] = await getEligibleAnimalsForFosterHomeService(
      { id },
      authContext,
    );

    if (animalsError) {
      return handleErrorClient(res, errorStatus || 404, animalsError);
    }

    return animals.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Animales elegibles encontrados", animals);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateFosterHome(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;
    const authContext = {
      user: req.user,
      permissions: req.permissions || [],
    };

    const { error: queryError } = fosterHomeQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = fosterHomeUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [home, homeError] = await updateFosterHomeService({ id }, body, authContext);

    if (homeError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el hogar temporal",
        homeError,
      );

    handleSuccess(res, 200, "Hogar temporal modificado correctamente", home);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteFosterHome(req, res) {
  try {
    const { id } = req.query;
    const authContext = {
      user: req.user,
      permissions: req.permissions || [],
    };

    const { error: queryError } = fosterHomeQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [homeDelete, errorHomeDelete] = await deleteFosterHomeService({ id }, authContext);

    if (errorHomeDelete)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el hogar temporal",
        errorHomeDelete,
      );

    handleSuccess(res, 200, "Hogar temporal eliminado correctamente", homeDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getMyFosterHome(req, res) {
  try {
    const authContext = {
      user: req.user,
      permissions: req.permissions || [],
    };

    const [home, errorHome, errorStatus] = await getMyFosterHomeService(authContext);

    if (errorHome) {
      return handleErrorClient(res, errorStatus || 404, errorHome);
    }

    return handleSuccess(res, 200, "Hogar temporal asociado encontrado", home);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
