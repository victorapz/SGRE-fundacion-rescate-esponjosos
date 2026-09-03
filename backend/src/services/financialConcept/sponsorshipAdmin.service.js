"use strict";

import {
  Animal,
  AppDataSource,
  Sponsor,
  Sponsorship,
  SponsorshipPlan,
  Subscription,
  SubscriptionPayment,
  buildSearchMatcher,
  createPublicReference,
  getPaymentProviderByKeyOrThrow,
  isPublicAnimalEligible,
  loadPublicAnimalMediaMap,
  mapAdminAnimalSponsorshipToggle,
  mapAdminSponsorship,
  mapAdminSubscription,
  mapAdminSubscriptionPayment,
  normalizeStrictBoolean,
  paginateArray,
} from "./sponsorship.shared.js";

const ACTIVE_SPONSORSHIP_STATES = new Set([
  "PENDIENTE_APROBACION",
  "ACTIVO",
  "SUSPENDIDO",
]);

const MANUAL_PROVIDER_KEY = "MANUAL";

async function loadActiveSponsorshipCountsByAnimal(manager, animalIds = []) {
  const ids = [...new Set(
    (Array.isArray(animalIds) ? animalIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  if (ids.length === 0) {
    return new Map();
  }

  const sponsorshipRepository = manager.getRepository(Sponsorship);
  const matches = await sponsorshipRepository.find({
    where: ids.map((animalId) => ({
      animal: { id_animal: animalId },
    })),
    relations: {
      animal: true,
    },
  });

  return matches.reduce((counts, item) => {
    if (!ACTIVE_SPONSORSHIP_STATES.has(item?.estado)) {
      return counts;
    }

    const animalId = Number(item?.animal?.id_animal);
    if (!Number.isInteger(animalId) || animalId <= 0) {
      return counts;
    }

    counts.set(animalId, Number(counts.get(animalId) || 0) + 1);
    return counts;
  }, new Map());
}

async function listAnimalsForAdmin(query = {}) {
  const repository = AppDataSource.getRepository(Animal);
  const searchMatcher = buildSearchMatcher(query.search);
  const animals = await repository.find({
    where: searchMatcher
      ? [
          { nombre: searchMatcher },
          { especie: searchMatcher },
          { sexo: searchMatcher },
        ]
      : {},
    order: {
      nombre: "ASC",
      id_animal: "ASC",
    },
  });

  const filtered = query.apadrinable === undefined
    ? animals
    : animals.filter((animal) => Boolean(animal.apadrinable) === (query.apadrinable === true || query.apadrinable === "true"));

  const animalIds = filtered.map((item) => Number(item.id_animal));
  const [mediaMap, activeCounts] = await Promise.all([
    loadPublicAnimalMediaMap(AppDataSource.manager, animalIds),
    loadActiveSponsorshipCountsByAnimal(AppDataSource.manager, animalIds),
  ]);

  return paginateArray(
    filtered.map((animal) =>
      mapAdminAnimalSponsorshipToggle(
        {
          ...animal,
          apadrinamientos_activos: Number(activeCounts.get(Number(animal.id_animal)) || 0),
        },
        mediaMap.get(Number(animal.id_animal))?.main || null,
      )),
    query,
  );
}

export async function getSponsorshipAnimalsService(query = {}) {
  try {
    return [await listAnimalsForAdmin(query), null];
  } catch (error) {
    console.error("Error al listar animales apadrinables:", error);
    return [null, "Error interno al obtener animales apadrinables."];
  }
}

export async function updateSponsorshipAnimalService(params, body) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Animal);
      const animal = await repository.findOne({
        where: { id_animal: Number(params.id) },
      });

      if (!animal) {
        throw new Error("Animal no encontrado.");
      }

      await repository.update(
        { id_animal: Number(animal.id_animal) },
        { apadrinable: normalizeStrictBoolean(body.apadrinable) },
      );

      return repository.findOne({
        where: { id_animal: Number(animal.id_animal) },
      });
    });

    const [mediaMap, activeCounts] = await Promise.all([
      loadPublicAnimalMediaMap(AppDataSource.manager, [Number(result.id_animal)]),
      loadActiveSponsorshipCountsByAnimal(AppDataSource.manager, [Number(result.id_animal)]),
    ]);
    return [mapAdminAnimalSponsorshipToggle(
      {
        ...result,
        apadrinamientos_activos: Number(activeCounts.get(Number(result.id_animal)) || 0),
      },
      mediaMap.get(Number(result.id_animal))?.main || null,
    ), null];
  } catch (error) {
    console.error("Error al actualizar apadrinable del animal:", error);
    return [null, error.message || "Error interno al actualizar el animal apadrinable."];
  }
}

async function assertNoDuplicatedActiveSponsorship(manager, sponsorId, animalId) {
  const repository = manager.getRepository(Sponsorship);
  const matches = await repository.find({
    where: {
      sponsor: { sponsor_id: Number(sponsorId) },
      animal: { id_animal: Number(animalId) },
    },
  });

  const conflicting = matches.find((item) => ACTIVE_SPONSORSHIP_STATES.has(item?.estado));
  if (conflicting) {
    throw new Error("Ya existe un apadrinamiento activo o pendiente para este padrino y animal.");
  }
}

async function buildSponsorshipDetailDto(item) {
  if (!item) {
    return null;
  }

  const animalId = Number(item.animal?.id_animal);
  const mediaMap = Number.isInteger(animalId) && animalId > 0
    ? await loadPublicAnimalMediaMap(AppDataSource.manager, [animalId])
    : new Map();
  const latestPayment = Array.isArray(item.subscription?.payments)
    ? [...item.subscription.payments]
      .sort((left, right) =>
        new Date(right.occurred_at || right.createdAt || 0).getTime()
        - new Date(left.occurred_at || left.createdAt || 0).getTime())
      [0] || null
    : null;

  const base = mapAdminSponsorship({
    ...item,
    animal: item.animal
      ? {
          ...item.animal,
          imagen_principal: mediaMap.get(animalId)?.main
            ? `/api/public/files/${mediaMap.get(animalId).main.public_id}/preview`
            : null,
        }
      : item.animal,
  });

  return {
    ...base,
    modalidad: item.plan?.modalidad || (item.subscription?.payment_provider?.clave === MANUAL_PROVIDER_KEY ? "MANUAL" : "PAYPAL"),
    ultimo_pago: latestPayment ? mapAdminSubscriptionPayment(latestPayment) : null,
    fechas_importantes: {
      solicitud: base?.solicitado_en || null,
      activacion: base?.activado_en || null,
      proximo_cobro: base?.subscription?.next_billing_time || null,
      ultima_sincronizacion: base?.subscription?.last_synced_at || null,
      cancelacion: base?.cancelado_en || null,
    },
  };
}

export async function createManualSponsorshipService(body) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const sponsorRepository = manager.getRepository(Sponsor);
      const animalRepository = manager.getRepository(Animal);
      const planRepository = manager.getRepository(SponsorshipPlan);
      const sponsorshipRepository = manager.getRepository(Sponsorship);
      const subscriptionRepository = manager.getRepository(Subscription);

      const sponsor = await sponsorRepository.findOne({
        where: { sponsor_id: Number(body.sponsor_id) },
      });
      if (!sponsor) {
        throw new Error("Padrino no encontrado.");
      }
      if (!sponsor.activo) {
        throw new Error("No se puede crear un apadrinamiento para un padrino inactivo.");
      }

      const animal = await animalRepository.findOne({
        where: { id_animal: Number(body.animal_id) },
      });
      if (!animal || !isPublicAnimalEligible(animal)) {
        throw new Error("El animal seleccionado no esta disponible para apadrinamiento.");
      }

      const plan = await planRepository.findOne({
        where: { sponsorship_plan_id: Number(body.plan_id) },
      });
      if (!plan || !plan.activo) {
        throw new Error("El plan seleccionado no esta disponible.");
      }
      if (plan.modalidad !== "MANUAL") {
        throw new Error("Solo se pueden crear apadrinamientos manuales con planes manuales activos.");
      }

      await assertNoDuplicatedActiveSponsorship(manager, sponsor.sponsor_id, animal.id_animal);

      const manualProvider = await getPaymentProviderByKeyOrThrow(manager, MANUAL_PROVIDER_KEY, {
        onlyActive: true,
      });

      const sponsorship = sponsorshipRepository.create({
        sponsor: { sponsor_id: Number(sponsor.sponsor_id) },
        animal: { id_animal: Number(animal.id_animal) },
        plan: { sponsorship_plan_id: Number(plan.sponsorship_plan_id) },
        estado: "ACTIVO",
        public_reference: createPublicReference(),
        solicitado_en: new Date(),
        activado_en: new Date(body.fecha_inicio),
      });
      const savedSponsorship = await sponsorshipRepository.save(sponsorship);

      const subscription = subscriptionRepository.create({
        sponsorship: { sponsorship_id: Number(savedSponsorship.sponsorship_id) },
        payment_provider: { proveedor_pago_id: Number(manualProvider.proveedor_pago_id) },
        provider_subscription_id: null,
        provider_plan_id: null,
        estado: "ACTIVA",
        next_billing_time: new Date(body.proximo_cobro),
        last_synced_at: null,
        provider_status_updated_at: new Date(),
        metadata: {
          modalidad: "MANUAL",
          metodo_esperado: String(body.metodo_esperado || "").trim().toUpperCase(),
          observacion: body.observacion?.trim() || null,
        },
      });
      await subscriptionRepository.save(subscription);

      return sponsorshipRepository.findOne({
        where: { sponsorship_id: Number(savedSponsorship.sponsorship_id) },
        relations: {
          sponsor: true,
          animal: true,
          plan: true,
          subscription: {
            payment_provider: true,
            payments: {
              transaction: true,
            },
          },
        },
      });
    });

    return [await buildSponsorshipDetailDto(result), null];
  } catch (error) {
    console.error("Error al crear apadrinamiento manual:", error);
    return [null, error.message || "Error interno al crear el apadrinamiento manual."];
  }
}

export async function getSponsorshipsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(Sponsorship);
    const items = await repository.find({
      relations: {
        sponsor: true,
        animal: true,
        plan: true,
        subscription: {
          payment_provider: true,
        },
      },
      order: {
        createdAt: "DESC",
        sponsorship_id: "DESC",
      },
    });
    const animalIds = items
      .map((item) => Number(item.animal?.id_animal))
      .filter((value) => Number.isInteger(value) && value > 0);
    const mediaMap = await loadPublicAnimalMediaMap(AppDataSource.manager, animalIds);

    const search = query.search?.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (query.estado && item.estado !== query.estado) return false;
      if (query.sponsor_id && Number(item.sponsor?.sponsor_id) !== Number(query.sponsor_id)) return false;
      if (query.animal_id && Number(item.animal?.id_animal) !== Number(query.animal_id)) return false;
      if (query.plan_id && Number(item.plan?.sponsorship_plan_id) !== Number(query.plan_id)) return false;
      if (!search) return true;

      return [
        item.public_reference,
        item.sponsor?.nombre,
        item.sponsor?.apellido,
        item.sponsor?.email,
        item.animal?.nombre,
        item.plan?.nombre,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return [paginateArray(filtered.map((item) => mapAdminSponsorship({
      ...item,
      animal: item.animal
        ? {
            ...item.animal,
            imagen_principal: mediaMap.get(Number(item.animal.id_animal))?.main
              ? `/api/public/files/${mediaMap.get(Number(item.animal.id_animal)).main.public_id}/preview`
              : null,
          }
        : item.animal,
    })), query), null];
  } catch (error) {
    console.error("Error al listar apadrinamientos:", error);
    return [null, "Error interno al obtener apadrinamientos."];
  }
}

export async function getSponsorshipService(params) {
  try {
    const repository = AppDataSource.getRepository(Sponsorship);
    const item = await repository.findOne({
      where: { sponsorship_id: Number(params.id) },
      relations: {
        sponsor: true,
        animal: true,
        plan: true,
        subscription: {
          payment_provider: true,
          payments: {
            transaction: true,
          },
        },
      },
    });

    if (!item) {
      return [null, "Apadrinamiento no encontrado."];
    }

    return [await buildSponsorshipDetailDto(item), null];
  } catch (error) {
    console.error("Error al obtener apadrinamiento:", error);
    return [null, "Error interno al obtener apadrinamiento."];
  }
}

export async function getSubscriptionsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(Subscription);
    const items = await repository.find({
      relations: {
        sponsorship: {
          sponsor: true,
          animal: true,
          plan: true,
        },
        payment_provider: true,
        payments: true,
      },
      order: {
        createdAt: "DESC",
        subscription_id: "DESC",
      },
    });

    const search = query.search?.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (query.estado && item.estado !== query.estado) return false;
      if (
        query.sponsorship_id
        && Number(item.sponsorship?.sponsorship_id) !== Number(query.sponsorship_id)
      ) {
        return false;
      }
      if (
        query.proveedor_pago_id
        && Number(item.payment_provider?.proveedor_pago_id) !== Number(query.proveedor_pago_id)
      ) {
        return false;
      }
      if (!search) return true;

      return [
        item.provider_subscription_id,
        item.provider_plan_id,
        item.payer_email,
        item.sponsorship?.public_reference,
        item.sponsorship?.sponsor?.email,
        item.sponsorship?.animal?.nombre,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return [paginateArray(filtered.map(mapAdminSubscription), query), null];
  } catch (error) {
    console.error("Error al listar suscripciones:", error);
    return [null, "Error interno al obtener suscripciones."];
  }
}

export async function getSubscriptionService(params) {
  try {
    const repository = AppDataSource.getRepository(Subscription);
    const item = await repository.findOne({
      where: { subscription_id: Number(params.id) },
      relations: {
        sponsorship: {
          sponsor: true,
          animal: true,
          plan: true,
        },
        payment_provider: true,
        payments: true,
      },
    });

    if (!item) {
      return [null, "Suscripcion no encontrada."];
    }

    return [mapAdminSubscription(item), null];
  } catch (error) {
    console.error("Error al obtener suscripcion:", error);
    return [null, "Error interno al obtener suscripcion."];
  }
}

export async function getSubscriptionPaymentsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(SubscriptionPayment);
    const items = await repository.find({
      relations: {
        subscription: {
          sponsorship: {
            sponsor: true,
            animal: true,
            plan: true,
          },
          payment_provider: true,
        },
        transaction: true,
      },
      order: {
        createdAt: "DESC",
        subscription_payment_id: "DESC",
      },
    });

    const filtered = items.filter((item) => {
      if (query.estado && item.estado !== query.estado) return false;
      if (
        query.subscription_id
        && Number(item.subscription?.subscription_id) !== Number(query.subscription_id)
      ) {
        return false;
      }
      if (
        query.sponsor_id
        && Number(item.subscription?.sponsorship?.sponsor?.sponsor_id) !== Number(query.sponsor_id)
      ) {
        return false;
      }
      if (
        query.animal_id
        && Number(item.subscription?.sponsorship?.animal?.id_animal) !== Number(query.animal_id)
      ) {
        return false;
      }
      if (
        query.plan_id
        && Number(item.subscription?.sponsorship?.plan?.sponsorship_plan_id) !== Number(query.plan_id)
      ) {
        return false;
      }
      if (query.con_transaccion !== undefined) {
        const expected = query.con_transaccion === true || query.con_transaccion === "true";
        if (Boolean(item.transaction) !== expected) {
          return false;
        }
      }
      if (query.fecha_desde) {
        const from = new Date(query.fecha_desde);
        const occurredAt = new Date(item.occurred_at || item.createdAt || 0);
        if (occurredAt.getTime() < from.getTime()) {
          return false;
        }
      }
      if (query.fecha_hasta) {
        const to = new Date(query.fecha_hasta);
        to.setHours(23, 59, 59, 999);
        const occurredAt = new Date(item.occurred_at || item.createdAt || 0);
        if (occurredAt.getTime() > to.getTime()) {
          return false;
        }
      }
      const search = query.search?.trim().toLowerCase();
      if (!search) {
        return true;
      }

      return [
        item.provider_payment_id,
        item.provider_event_id,
        item.subscription?.sponsorship?.sponsor?.nombre,
        item.subscription?.sponsorship?.sponsor?.apellido,
        item.subscription?.sponsorship?.animal?.nombre,
        item.subscription?.sponsorship?.plan?.nombre,
        item.metadata?.referencia,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return [paginateArray(filtered.map(mapAdminSubscriptionPayment), query), null];
  } catch (error) {
    console.error("Error al listar pagos recurrentes:", error);
    return [null, "Error interno al obtener pagos recurrentes."];
  }
}

export async function getSubscriptionPaymentService(params) {
  try {
    const repository = AppDataSource.getRepository(SubscriptionPayment);
    const item = await repository.findOne({
      where: { subscription_payment_id: Number(params.id) },
      relations: {
        subscription: {
          sponsorship: {
            sponsor: true,
            animal: true,
            plan: true,
          },
          payment_provider: true,
        },
        transaction: true,
      },
    });

    if (!item) {
      return [null, "Pago recurrente no encontrado."];
    }

    return [mapAdminSubscriptionPayment(item), null];
  } catch (error) {
    console.error("Error al obtener pago recurrente:", error);
    return [null, "Error interno al obtener pago recurrente."];
  }
}
