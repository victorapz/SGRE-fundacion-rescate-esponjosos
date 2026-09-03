"use strict";

import {
	animalDietsCreateValidation,
	animalDietsQueryValidation,
	animalDietsUpdateBodyValidation,
} from "../../validations/animal_diets.validation.js";

import {
	createAnimalDietsService,
	deleteAnimalDietsService,
	getAnimalDietsService,
	getAnimalDietService,
	updateAnimalDietsService,
} from "../../services/animalConcept/animal_diets.service.js";

import {
	handleErrorClient,
	handleErrorServer,
	handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createAnimalDiet(req, res) {
	try {
		const { body } = req;

		const { error } = animalDietsCreateValidation.validate(body);

		if (error)
			return handleErrorClient(res, 400, "Error de validacion", error.message);

		const [diet, errorDiet] = await createAnimalDietsService(body);

		if (errorDiet) return handleErrorClient(res, 400, errorDiet);

		handleSuccess(res, 201, "Dieta creada correctamente", diet);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function getAnimalDiet(req, res) {
	try {
		const { id } = req.query;

		const { error } = animalDietsQueryValidation.validate({ id });

		if (error)
			return handleErrorClient(res, 400, "Error de validacion", error.message);

		const [diet, errorDiet] = await getAnimalDietService({ id });

		if (errorDiet) return handleErrorClient(res, 404, errorDiet);

		handleSuccess(res, 200, "Dieta encontrada", diet);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function getAnimalDiets(req, res) {
	try {
		const [diets, errorDiets] = await getAnimalDietsService();

		if (errorDiets) return handleErrorClient(res, 404, errorDiets);

		diets.length === 0
			? handleSuccess(res, 204)
			: handleSuccess(res, 200, "Dietas encontradas", diets);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function updateAnimalDiet(req, res) {
	try {
		const { id } = req.query;
		const { body } = req;

		const { error: queryError } = animalDietsQueryValidation.validate({ id });

		if (queryError) {
			return handleErrorClient(
				res,
				400,
				"Error de validacion en la consulta",
				queryError.message,
			);
		}

		const { error: bodyError } = animalDietsUpdateBodyValidation.validate(body);

		if (bodyError)
			return handleErrorClient(
				res,
				400,
				"Error de validacion en los datos enviados",
				bodyError.message,
			);

		const [diet, dietError] = await updateAnimalDietsService({ id }, body);

		if (dietError)
			return handleErrorClient(
				res,
				400,
				"Error modificando la dieta",
				dietError,
			);

		handleSuccess(res, 200, "Dieta modificada correctamente", diet);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function deleteAnimalDiet(req, res) {
	try {
		const { id } = req.query;

		const { error: queryError } = animalDietsQueryValidation.validate({ id });

		if (queryError) {
			return handleErrorClient(
				res,
				400,
				"Error de validacion en la consulta",
				queryError.message,
			);
		}

		const [dietDelete, errorDietDelete] = await deleteAnimalDietsService({ id });

		if (errorDietDelete)
			return handleErrorClient(
				res,
				404,
				"Error eliminando la dieta",
				errorDietDelete,
			);

		handleSuccess(res, 200, "Dieta eliminada correctamente", dietDelete);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}
