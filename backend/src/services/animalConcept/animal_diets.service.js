"use strict";

import AnimalDiets from "../../entities/animalConcept/animal_diets.entity.js";
import { AppDataSource } from "../../config/configDb.js";

export async function createAnimalDietsService(body) {
	try {
		const { marca_alimento, horario_alimentacion, notas, animal_id } = body;

		const animalDietsRepository = AppDataSource.getRepository(AnimalDiets);

		const nuevaDieta = animalDietsRepository.create({
			marca_alimento,
			horario_alimentacion,
			notas,
			animal: { id_animal: Number(animal_id) },
		});

		const dietaGuardada = await animalDietsRepository.save(nuevaDieta);

		return [dietaGuardada, null];
	} catch (error) {
		console.error("Error al crear dieta:", error);
		return [null, "Error interno al crear dieta"];
	}
}

export async function getAnimalDietService(query) {
	try {
		const { id } = query;
		const animalDietsRepository = AppDataSource.getRepository(AnimalDiets);

		const dietFound = await animalDietsRepository.findOne({
			where: { id_animal_dieta: id },
			relations: { animal: true },
		});

		if (!dietFound) return [null, "Dieta no encontrada"];

		return [dietFound, null];
	} catch (error) {
		console.error("Error al obtener la dieta:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function getAnimalDietsService() {
	try {
		const animalDietsRepository = AppDataSource.getRepository(AnimalDiets);
		const diets = await animalDietsRepository.find({
			relations: { animal: true },
		});

		if (!diets || diets.length === 0) return [null, "No hay dietas"];

		return [diets, null];
	} catch (error) {
		console.error("Error al obtener dietas:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function updateAnimalDietsService(query, body) {
	try {
		const { id } = query;

		const animalDietsRepository = AppDataSource.getRepository(AnimalDiets);

		const dietFound = await animalDietsRepository.findOne({
			where: { id_animal_dieta: id },
			relations: { animal: true },
		});

		if (!dietFound) return [null, "Dieta no encontrada"];

		if (body.marca_alimento) dietFound.marca_alimento = body.marca_alimento;
		if (body.horario_alimentacion)
			dietFound.horario_alimentacion = body.horario_alimentacion;
		if (body.notas !== undefined) dietFound.notas = body.notas;

		if (body.animal_id) {
			dietFound.animal = { id_animal: Number(body.animal_id) };
		}

		await animalDietsRepository.save(dietFound);

		const updatedDiet = await animalDietsRepository.findOne({
			where: { id_animal_dieta: dietFound.id_animal_dieta },
			relations: { animal: true },
		});

		return [updatedDiet, null];
	} catch (error) {
		console.error("Error al modificar la dieta:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function deleteAnimalDietsService(query) {
	try {
		const { id } = query;

		const animalDietsRepository = AppDataSource.getRepository(AnimalDiets);

		const dietFound = await animalDietsRepository.findOne({
			where: { id_animal_dieta: id },
		});

		if (!dietFound) return [null, "Dieta no encontrada"];

		const dietDeleted = await animalDietsRepository.remove(dietFound);

		return [dietDeleted, null];
	} catch (error) {
		console.error("Error al eliminar la dieta:", error);
		return [null, "Error interno del servidor"];
	}
}
