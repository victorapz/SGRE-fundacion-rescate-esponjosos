"use strict";

import AnimalProfile from "../../entities/animalConcept/animal_profile.entity.js";
import { AppDataSource } from "../../config/configDb.js";

export async function createAnimalProfileService(body) {
	try {
		const {
			personalidad,
			gustos,
			disgustos,
			historia,
			cuidados_especiales,
			animal_id,
		} = body;

		const animalProfileRepository = AppDataSource.getRepository(AnimalProfile);

		const nuevoPerfil = animalProfileRepository.create({
			personalidad,
			gustos,
			disgustos,
			historia,
			cuidados_especiales,
			animal: { id_animal: Number(animal_id) },
		});

		const perfilGuardado = await animalProfileRepository.save(nuevoPerfil);

		return [perfilGuardado, null];
	} catch (error) {
		console.error("Error al crear perfil:", error);
		return [null, "Error interno al crear perfil"];
	}
}

export async function getAnimalProfileService(query) {
	try {
		const { id } = query;
		const animalProfileRepository = AppDataSource.getRepository(AnimalProfile);

		const profileFound = await animalProfileRepository.findOne({
			where: { id_perfil_animal: id },
			relations: { animal: true },
		});

		if (!profileFound) return [null, "Perfil no encontrado"];

		return [profileFound, null];
	} catch (error) {
		console.error("Error al obtener el perfil:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function getAnimalProfilesService() {
	try {
		const animalProfileRepository = AppDataSource.getRepository(AnimalProfile);
		const profiles = await animalProfileRepository.find({
			relations: { animal: true },
		});

		if (!profiles || profiles.length === 0) return [null, "No hay perfiles"];

		return [profiles, null];
	} catch (error) {
		console.error("Error al obtener perfiles:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function updateAnimalProfileService(query, body) {
	try {
		const { id } = query;

		const animalProfileRepository = AppDataSource.getRepository(AnimalProfile);

		const profileFound = await animalProfileRepository.findOne({
			where: { id_perfil_animal: id },
			relations: { animal: true },
		});

		if (!profileFound) return [null, "Perfil no encontrado"];

		if (body.personalidad) profileFound.personalidad = body.personalidad;
		if (body.gustos) profileFound.gustos = body.gustos;
		if (body.disgustos) profileFound.disgustos = body.disgustos;
		if (body.historia) profileFound.historia = body.historia;
		if (body.cuidados_especiales)
			profileFound.cuidados_especiales = body.cuidados_especiales;

		if (body.animal_id) {
			profileFound.animal = { id_animal: Number(body.animal_id) };
		}

		await animalProfileRepository.save(profileFound);

		const updatedProfile = await animalProfileRepository.findOne({
			where: { id_perfil_animal: profileFound.id_perfil_animal },
			relations: { animal: true },
		});

		return [updatedProfile, null];
	} catch (error) {
		console.error("Error al modificar el perfil:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function deleteAnimalProfileService(query) {
	try {
		const { id } = query;

		const animalProfileRepository = AppDataSource.getRepository(AnimalProfile);

		const profileFound = await animalProfileRepository.findOne({
			where: { id_perfil_animal: id },
		});

		if (!profileFound) return [null, "Perfil no encontrado"];

		const profileDeleted = await animalProfileRepository.remove(profileFound);

		return [profileDeleted, null];
	} catch (error) {
		console.error("Error al eliminar el perfil:", error);
		return [null, "Error interno del servidor"];
	}
}
