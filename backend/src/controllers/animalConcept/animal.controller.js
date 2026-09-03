"use strict";

import {
	animalCreateValidation,
	animalQueryValidation,
	animalUpdateBodyValidation,
} from "../../validations/animal.validation.js";

import {
	createAnimalService,
	deleteAnimalService,
	getAnimalsService,
	getAnimalService,
	updateAnimalService,
} from "../../services/animalConcept/animal.service.js";

import {
	handleErrorClient,
	handleErrorServer,
	handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createAnimal(req, res) {
	try {
		const { body } = req;
		const { error } = animalCreateValidation.validate(body);

		if (error)
			return handleErrorClient(res, 400, "Error de validacion", error.message);

		const [animal, errorAnimal] = await createAnimalService(body);

		if (errorAnimal) return handleErrorClient(res, 400, errorAnimal);

		handleSuccess(res, 201, "Animal creado correctamente", animal);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function getAnimal(req, res) {
	try {
		const { id } = req.query;

		const { error } = animalQueryValidation.validate({ id });

		if (error)
			return handleErrorClient(res, 400, "Error de validacion", error.message);

		const [animal, errorAnimal] = await getAnimalService({ id });

		if (errorAnimal) return handleErrorClient(res, 404, errorAnimal);

		handleSuccess(res, 200, "Animal encontrado", animal);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function getAnimals(req, res) {
	try {
		const [animals, errorAnimals] = await getAnimalsService();

		if (errorAnimals) return handleErrorClient(res, 404, errorAnimals);

		animals.length === 0
			? handleSuccess(res, 204)
			: handleSuccess(res, 200, "Animales encontrados", animals);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function updateAnimal(req, res) {
	try {
		const { id } = req.query;
		const { body } = req;

		const { error: queryError } = animalQueryValidation.validate({ id });

		if (queryError) {
			return handleErrorClient(
				res,
				400,
				"Error de validacion en la consulta",
				queryError.message,
			);
		}

		const { error: bodyError } = animalUpdateBodyValidation.validate(body);

		if (bodyError)
			return handleErrorClient(
				res,
				400,
				"Error de validacion en los datos enviados",
				bodyError.message,
			);

		const [animal, animalError] = await updateAnimalService({ id }, body);

		if (animalError)
			return handleErrorClient(
				res,
				400,
				"Error modificando el animal",
				animalError,
			);

		handleSuccess(res, 200, "Animal modificado correctamente", animal);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function deleteAnimal(req, res) {
	try {
		const { id } = req.query;

		const { error: queryError } = animalQueryValidation.validate({ id });

		if (queryError) {
			return handleErrorClient(
				res,
				400,
				"Error de validacion en la consulta",
				queryError.message,
			);
		}

		const [animalDelete, errorAnimalDelete] = await deleteAnimalService({ id });

		if (errorAnimalDelete) {
			const statusCode = errorAnimalDelete === "Animal no encontrado"
				? 404
				: errorAnimalDelete.includes("No se puede eliminar el animal")
					? 409
					: 400;

			return handleErrorClient(
				res,
				statusCode,
				"Error eliminando el animal",
				errorAnimalDelete,
			);
		}

		handleSuccess(res, 200, "Animal eliminado correctamente", animalDelete);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}
