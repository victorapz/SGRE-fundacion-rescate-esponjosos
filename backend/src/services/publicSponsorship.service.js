"use strict";

import {
  Animal,
  AnimalProfile,
  AppDataSource,
  inferPlanModalidad,
  SponsorshipPlan,
  isPublicAnimalEligible,
  loadPublicAnimalMediaMap,
  mapPublicSponsorshipAnimalDetail,
  mapPublicSponsorshipAnimalListItem,
  mapPublicSponsorshipPlan,
  paginateArray,
} from "./financialConcept/sponsorship.shared.js";

async function listActivePlans(repository) {
  return repository.find({
    where: {
      activo: true,
    },
    order: {
      orden: "ASC",
      monto: "ASC",
      sponsorship_plan_id: "ASC",
    },
  }).then((plans = []) =>
    plans.filter((plan) =>
      inferPlanModalidad(plan) === "PAYPAL"
      && Boolean(plan.paypal_plan_id)
      && Boolean(plan.paypal_product_id)));
}

export async function getPublicSponsorshipPlansService() {
  try {
    const repository = AppDataSource.getRepository(SponsorshipPlan);
    const plans = await listActivePlans(repository);
    return [plans.map(mapPublicSponsorshipPlan), null];
  } catch (error) {
    console.error("Error al obtener planes publicos de apadrinamiento:", error);
    return [null, "Error interno al obtener los planes publicos de apadrinamiento."];
  }
}

export async function getPublicSponsorshipAnimalsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(Animal);
    const animals = await repository.find({
      order: {
        nombre: "ASC",
        id_animal: "ASC",
      },
    });

    const search = String(query.search || "").trim().toLowerCase();
    const filtered = animals.filter((animal) => {
      if (!isPublicAnimalEligible(animal)) return false;
      if (!search) return true;

      return [animal.nombre, animal.especie, animal.sexo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    const mediaMap = await loadPublicAnimalMediaMap(
      AppDataSource.manager,
      filtered.map((item) => Number(item.id_animal)),
    );

    return [
      paginateArray(
        filtered.map((animal) =>
          mapPublicSponsorshipAnimalListItem(
            animal,
            mediaMap.get(Number(animal.id_animal))?.main || null,
          )),
        query,
      ),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener animales publicos apadrinables:", error);
    return [null, "Error interno al obtener animales apadrinables."];
  }
}

export async function getPublicSponsorshipAnimalDetailService(params) {
  try {
    const payload = await AppDataSource.transaction(async (manager) => {
      const animalRepository = manager.getRepository(Animal);
      const profileRepository = manager.getRepository(AnimalProfile);
      const planRepository = manager.getRepository(SponsorshipPlan);

      const animal = await animalRepository.findOne({
        where: { id_animal: Number(params.id) },
      });

      if (!animal || !isPublicAnimalEligible(animal)) {
        throw new Error("Animal apadrinable no encontrado.");
      }

      const [mediaMap, profile, plans] = await Promise.all([
        loadPublicAnimalMediaMap(manager, [Number(animal.id_animal)]),
        profileRepository.findOne({
          where: {
            animal: {
              id_animal: Number(animal.id_animal),
            },
          },
        }),
        listActivePlans(planRepository),
      ]);

      const media = mediaMap.get(Number(animal.id_animal)) || { main: null, gallery: [] };

      return mapPublicSponsorshipAnimalDetail(animal, {
        profile,
        mainImage: media.main,
        gallery: media.gallery,
        plans,
      });
    });

    return [payload, null];
  } catch (error) {
    console.error("Error al obtener detalle publico de animal apadrinable:", error);
    return [null, error.message || "Error interno al obtener el animal apadrinable."];
  }
}
