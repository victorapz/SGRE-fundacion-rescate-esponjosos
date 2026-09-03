"use strict";

import {
	animalProfileCreateValidation,
	animalProfileQueryValidation,
	animalProfileUpdateBodyValidation,
} from "../../validations/animal_profile.validation.js";

import {
	createAnimalProfileService,
	deleteAnimalProfileService,
	getAnimalProfilesService,
	getAnimalProfileService,
	updateAnimalProfileService,
} from "../../services/animalConcept/animal_profile.service.js";

import {
	handleErrorClient,
	handleErrorServer,
	handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createAnimalProfile(req, res) {
	try {
		const { body } = req;

		const { error } = animalProfileCreateValidation.validate(body);

		if (error)
			return handleErrorClient(res, 400, "Error de validacion", error.message);

		const [profile, errorProfile] = await createAnimalProfileService(body);

		if (errorProfile) return handleErrorClient(res, 400, errorProfile);

		handleSuccess(res, 201, "Perfil creado correctamente", profile);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function getAnimalProfile(req, res) {
	try {
		const { id } = req.query;

		const { error } = animalProfileQueryValidation.validate({ id });

		if (error)
			return handleErrorClient(res, 400, "Error de validacion", error.message);

		const [profile, errorProfile] = await getAnimalProfileService({ id });

		if (errorProfile) return handleErrorClient(res, 404, errorProfile);

		handleSuccess(res, 200, "Perfil encontrado", profile);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function getAnimalProfiles(req, res) {
	try {
		const [profiles, errorProfiles] = await getAnimalProfilesService();

		if (errorProfiles) return handleErrorClient(res, 404, errorProfiles);

		profiles.length === 0
			? handleSuccess(res, 204)
			: handleSuccess(res, 200, "Perfiles encontrados", profiles);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function updateAnimalProfile(req, res) {
	try {
		const { id } = req.query;
		const { body } = req;

		const { error: queryError } = animalProfileQueryValidation.validate({ id });

		if (queryError) {
			return handleErrorClient(
				res,
				400,
				"Error de validacion en la consulta",
				queryError.message,
			);
		}

		const { error: bodyError } = animalProfileUpdateBodyValidation.validate(body);

		if (bodyError)
			return handleErrorClient(
				res,
				400,
				"Error de validacion en los datos enviados",
				bodyError.message,
			);

		const [profile, profileError] = await updateAnimalProfileService({ id }, body);

		if (profileError)
			return handleErrorClient(
				res,
				400,
				"Error modificando el perfil",
				profileError,
			);

		handleSuccess(res, 200, "Perfil modificado correctamente", profile);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}

export async function deleteAnimalProfile(req, res) {
	try {
		const { id } = req.query;

		const { error: queryError } = animalProfileQueryValidation.validate({ id });

		if (queryError) {
			return handleErrorClient(
				res,
				400,
				"Error de validacion en la consulta",
				queryError.message,
			);
		}

		const [profileDelete, errorProfileDelete] =
			await deleteAnimalProfileService({ id });

		if (errorProfileDelete)
			return handleErrorClient(
				res,
				404,
				"Error eliminando el perfil",
				errorProfileDelete,
			);

		handleSuccess(res, 200, "Perfil eliminado correctamente", profileDelete);
	} catch (error) {
		handleErrorServer(res, 500, error.message);
	}
}
