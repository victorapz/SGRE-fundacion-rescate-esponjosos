"use strict";

import {
  AppDataSource,
  Sponsor,
  countActiveSponsorships,
  hasSponsorHistory,
  loadPublicAnimalMediaMap,
  mapSponsorAdmin,
  normalizeStrictBoolean,
  normalizeNullableString,
  normalizeSponsorEmail,
  paginateArray,
} from "./sponsorship.shared.js";

async function loadSponsor(repository, sponsorId, withRelations = false) {
  return repository.findOne({
    where: { sponsor_id: Number(sponsorId) },
    relations: withRelations
      ? {
          sponsorships: true,
        }
      : {},
  });
}

function normalizeSponsorPayload(body = {}, current = null) {
  return {
    nombre: body.nombre !== undefined ? body.nombre.trim() : current?.nombre,
    apellido: body.apellido !== undefined ? body.apellido.trim() : current?.apellido,
    email:
      body.email !== undefined
        ? normalizeSponsorEmail(body.email)
        : normalizeSponsorEmail(current?.email),
    telefono:
      body.telefono !== undefined
        ? normalizeNullableString(body.telefono)
        : normalizeNullableString(current?.telefono),
    activo:
      body.activo !== undefined
        ? normalizeStrictBoolean(body.activo)
        : Boolean(current?.activo ?? true),
  };
}

async function ensureUniqueSponsorEmail(repository, email, excludeSponsorId = null) {
  if (!email) {
    throw new Error("El email del padrino es obligatorio.");
  }

  const existing = await repository.findOne({ where: { email } });
  if (existing && Number(existing.sponsor_id) !== Number(excludeSponsorId)) {
    throw new Error("Ya existe un padrino registrado con ese email.");
  }
}

export async function createSponsorService(body) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Sponsor);
      const payload = normalizeSponsorPayload(body);

      if (body.consentimiento_datos !== true) {
        throw new Error("Debes aceptar expresamente el consentimiento de datos.");
      }

      await ensureUniqueSponsorEmail(repository, payload.email);

      const created = repository.create({
        ...payload,
        consentimiento_datos_at: new Date(),
      });

      const saved = await repository.save(created);
      return loadSponsor(repository, saved.sponsor_id, true);
    });

    return [mapSponsorAdmin(result, {
      sponsorshipsCount: result?.sponsorships?.length || 0,
      activeSponsorshipsCount: countActiveSponsorships(result?.sponsorships),
    }), null];
  } catch (error) {
    console.error("Error al crear padrino:", error);
    return [null, error.message || "Error interno al crear el padrino."];
  }
}

async function buildSponsorDetailDto(sponsor) {
  const activeSponsorshipsCount = countActiveSponsorships(sponsor?.sponsorships);
  const sponsorships = Array.isArray(sponsor?.sponsorships) ? sponsor.sponsorships : [];
  const animalIds = sponsorships
    .map((item) => Number(item?.animal?.id_animal))
    .filter((value) => Number.isInteger(value) && value > 0);
  const mediaMap = await loadPublicAnimalMediaMap(AppDataSource.manager, animalIds);
  const completedPayments = sponsorships.flatMap((item) =>
    Array.isArray(item.subscription?.payments)
      ? item.subscription.payments.filter((payment) => payment.estado === "COMPLETADO")
      : []);

  const totalNet = completedPayments.reduce(
    (sum, payment) => sum + Number(payment.monto_neto || 0),
    0,
  );

  return {
    ...mapSponsorAdmin(sponsor, {
      sponsorshipsCount: sponsorships.length,
      activeSponsorshipsCount,
    }),
    consentimiento_otorgado: Boolean(sponsor?.consentimiento_datos_at),
    apadrinamientos: sponsorships.map((item) => ({
      sponsorship_id: Number(item.sponsorship_id),
      estado: item.estado || "",
      solicitado_en: item.solicitado_en || null,
      animal: item.animal
        ? {
            id_animal: Number(item.animal.id_animal),
            nombre: item.animal.nombre || "",
            especie: item.animal.especie || "",
            imagen_principal:
              mediaMap.get(Number(item.animal.id_animal))?.main?.public_id
                ? `/api/public/files/${mediaMap.get(Number(item.animal.id_animal)).main.public_id}/preview`
                : null,
          }
        : null,
      plan: item.plan
        ? {
            sponsorship_plan_id: Number(item.plan.sponsorship_plan_id),
            nombre: item.plan.nombre || "",
            monto: Number(item.plan.monto || 0),
            moneda: item.plan.moneda || "USD",
          }
        : null,
    })),
    pagos_resumen: {
      cantidad: completedPayments.length,
      total_neto: Number(totalNet.toFixed(2)),
      recientes: completedPayments
        .sort((left, right) => new Date(right.occurred_at || right.createdAt || 0) - new Date(left.occurred_at || left.createdAt || 0))
        .slice(0, 3)
        .map((payment) => ({
          subscription_payment_id: Number(payment.subscription_payment_id),
          fecha: payment.occurred_at || payment.createdAt || null,
          monto_neto: Number(payment.monto_neto || 0),
          moneda: payment.moneda || "USD",
          estado: payment.estado || "",
        })),
    },
  };
}

export async function getSponsorsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(Sponsor);
    const sponsors = await repository.find({
      relations: {
        sponsorships: true,
      },
      order: {
        createdAt: "DESC",
        sponsor_id: "DESC",
      },
    });
    const search = String(query.search || "").trim().toLowerCase();
    const filtered = sponsors.filter((sponsor) => {
      if (
        query.activo !== undefined
        && Boolean(sponsor.activo) !== (query.activo === true || query.activo === "true")
      ) {
        return false;
      }

      const hasActiveSponsorship = query.has_active_sponsorship;
      if (hasActiveSponsorship !== undefined) {
        const currentActiveCount = countActiveSponsorships(sponsor.sponsorships);
        const expected = hasActiveSponsorship === true || hasActiveSponsorship === "true";
        if ((currentActiveCount > 0) !== expected) {
          return false;
        }
      }

      if (!search) return true;
      return [sponsor.nombre, sponsor.apellido, sponsor.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return [
      paginateArray(
        filtered.map((sponsor) =>
          mapSponsorAdmin(sponsor, {
            sponsorshipsCount: sponsor.sponsorships?.length || 0,
            activeSponsorshipsCount: countActiveSponsorships(sponsor.sponsorships),
            hasHistory: hasSponsorHistory(sponsor),
          })),
        query,
      ),
      null,
    ];
  } catch (error) {
    console.error("Error al listar padrinos:", error);
    return [null, "Error interno al obtener padrinos."];
  }
}

export async function getSponsorService(params) {
  try {
    const repository = AppDataSource.getRepository(Sponsor);
    const sponsor = await loadSponsor(repository, params.id, true);

    if (!sponsor) {
      return [null, "Padrino no encontrado."];
    }

    const detailedSponsor = await repository.findOne({
      where: { sponsor_id: Number(params.id) },
      relations: {
        sponsorships: {
          animal: true,
          plan: true,
          subscription: {
            payments: true,
          },
        },
      },
    });

    return [await buildSponsorDetailDto({ ...sponsor, ...detailedSponsor }), null];
  } catch (error) {
    console.error("Error al obtener padrino:", error);
    return [null, "Error interno al obtener padrino."];
  }
}

export async function updateSponsorService(params, body) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Sponsor);
      const sponsor = await loadSponsor(repository, params.id, true);

      if (!sponsor) {
        throw new Error("Padrino no encontrado.");
      }

      const payload = normalizeSponsorPayload(body, sponsor);
      await ensureUniqueSponsorEmail(repository, payload.email, sponsor.sponsor_id);

      await repository.update(
        { sponsor_id: Number(sponsor.sponsor_id) },
        payload,
      );

      return loadSponsor(repository, sponsor.sponsor_id, true);
    });

    return [mapSponsorAdmin(result, {
      sponsorshipsCount: result?.sponsorships?.length || 0,
      activeSponsorshipsCount: countActiveSponsorships(result?.sponsorships),
    }), null];
  } catch (error) {
    console.error("Error al actualizar padrino:", error);
    return [null, error.message || "Error interno al actualizar padrino."];
  }
}
