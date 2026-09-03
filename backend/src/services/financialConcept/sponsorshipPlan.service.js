"use strict";

import {
  AppDataSource,
  SponsorshipPlan,
  ensurePositiveAmount,
  ensureSponsorshipPlanDefaults,
  hasPlanHistory,
  mapAdminSponsorshipPlan,
  normalizeStrictBoolean,
  paginateArray,
} from "./sponsorship.shared.js";

async function loadPlan(repository, planId, withRelations = false) {
  return repository.findOne({
    where: { sponsorship_plan_id: Number(planId) },
    relations: withRelations
      ? {
          sponsorships: true,
        }
      : {},
  });
}

function normalizePlanPayload(body = {}) {
  const defaults = ensureSponsorshipPlanDefaults(body);

  return {
    nombre: body.nombre?.trim(),
    descripcion: body.descripcion?.trim() || null,
    modalidad: defaults.modalidad,
    monto: ensurePositiveAmount(body.monto, "El monto"),
    moneda: defaults.moneda,
    intervalo_unidad: defaults.intervalo_unidad,
    intervalo_cantidad: defaults.intervalo_cantidad,
    paypal_product_id: null,
    paypal_plan_id: null,
    activo: body.activo !== undefined ? normalizeStrictBoolean(body.activo) : true,
    orden: body.orden !== undefined ? Number(body.orden) : 0,
  };
}

export async function createSponsorshipPlanService(body) {
  try {
    const payload = normalizePlanPayload(body);

    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SponsorshipPlan);
      const created = repository.create(payload);
      const saved = await repository.save(created);
      return loadPlan(repository, saved.sponsorship_plan_id, true);
    });

    return [mapAdminSponsorshipPlan(result), null];
  } catch (error) {
    console.error("Error al crear plan de apadrinamiento:", error);
    return [null, error.message || "Error interno al crear el plan de apadrinamiento."];
  }
}

export async function getSponsorshipPlansService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(SponsorshipPlan);
    const plans = await repository.find({
      relations: {
        sponsorships: true,
      },
      order: {
        orden: "ASC",
        monto: "ASC",
        sponsorship_plan_id: "ASC",
      },
    });
    const search = String(query.search || "").trim().toLowerCase();
    const filtered = plans.filter((plan) => {
      if (
        query.activo !== undefined
        && Boolean(plan.activo) !== (query.activo === true || query.activo === "true")
      ) {
        return false;
      }

      if (!search) return true;
      return [plan.nombre, plan.descripcion]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return [
      paginateArray(
        filtered.map((plan) => mapAdminSponsorshipPlan(plan, { hasHistory: hasPlanHistory(plan) })),
        query,
      ),
      null,
    ];
  } catch (error) {
    console.error("Error al listar planes de apadrinamiento:", error);
    return [null, "Error interno al obtener los planes de apadrinamiento."];
  }
}

export async function getSponsorshipPlanService(params) {
  try {
    const repository = AppDataSource.getRepository(SponsorshipPlan);
    const plan = await loadPlan(repository, params.id, true);

    if (!plan) {
      return [null, "Plan de apadrinamiento no encontrado."];
    }

    return [mapAdminSponsorshipPlan(plan, { hasHistory: hasPlanHistory(plan) }), null];
  } catch (error) {
    console.error("Error al obtener plan de apadrinamiento:", error);
    return [null, "Error interno al obtener el plan de apadrinamiento."];
  }
}

export async function updateSponsorshipPlanService(params, body) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SponsorshipPlan);
      const plan = await loadPlan(repository, params.id, true);

      if (!plan) {
        throw new Error("Plan de apadrinamiento no encontrado.");
      }

      const planHasLockedFinancialHistory = hasPlanHistory(plan) || Boolean(plan.paypal_plan_id);
      if (
        planHasLockedFinancialHistory
        && (
          body.modalidad !== undefined
          || body.monto !== undefined
          || body.moneda !== undefined
          || body.intervalo_unidad !== undefined
          || body.intervalo_cantidad !== undefined
        )
      ) {
        throw new Error(
          "El monto y la frecuencia de un plan con historial no pueden modificarse. Crea un nuevo plan.",
        );
      }

      const payload = {
        nombre: body.nombre !== undefined ? body.nombre.trim() : plan.nombre,
        descripcion:
          body.descripcion !== undefined ? body.descripcion?.trim() || null : plan.descripcion,
        monto:
          body.monto !== undefined
            ? ensurePositiveAmount(body.monto, "El monto")
            : Number(plan.monto),
        activo:
          body.activo !== undefined
            ? normalizeStrictBoolean(body.activo)
            : Boolean(plan.activo),
        orden: body.orden !== undefined ? Number(body.orden) : Number(plan.orden || 0),
      };

      const defaults = ensureSponsorshipPlanDefaults({
        modalidad: body.modalidad !== undefined ? body.modalidad : plan.modalidad,
        moneda: body.moneda !== undefined ? body.moneda : plan.moneda,
        intervalo_unidad:
          body.intervalo_unidad !== undefined ? body.intervalo_unidad : plan.intervalo_unidad,
        intervalo_cantidad:
          body.intervalo_cantidad !== undefined
            ? body.intervalo_cantidad
            : plan.intervalo_cantidad,
      });

      await repository.update(
        { sponsorship_plan_id: Number(plan.sponsorship_plan_id) },
        {
          ...payload,
          modalidad: defaults.modalidad,
          moneda: defaults.moneda,
          intervalo_unidad: defaults.intervalo_unidad,
          intervalo_cantidad: defaults.intervalo_cantidad,
          paypal_product_id: defaults.modalidad === "MANUAL" ? null : plan.paypal_product_id,
          paypal_plan_id: defaults.modalidad === "MANUAL" ? null : plan.paypal_plan_id,
        },
      );

      return loadPlan(repository, plan.sponsorship_plan_id, true);
    });

    return [mapAdminSponsorshipPlan(result, { hasHistory: hasPlanHistory(result) }), null];
  } catch (error) {
    console.error("Error al actualizar plan de apadrinamiento:", error);
    return [null, error.message || "Error interno al actualizar el plan de apadrinamiento."];
  }
}

export async function deleteSponsorshipPlanService(params) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SponsorshipPlan);
      const plan = await loadPlan(repository, params.id, true);

      if (!plan) {
        throw new Error("Plan de apadrinamiento no encontrado.");
      }

      if (hasPlanHistory(plan)) {
        await repository.update(
          { sponsorship_plan_id: Number(plan.sponsorship_plan_id) },
          { activo: false },
        );
        return loadPlan(repository, plan.sponsorship_plan_id, true);
      }

      await repository.remove(plan);
      return null;
    });

    return [result ? mapAdminSponsorshipPlan(result, { hasHistory: true }) : null, null];
  } catch (error) {
    console.error("Error al eliminar plan de apadrinamiento:", error);
    return [null, error.message || "Error interno al eliminar el plan de apadrinamiento."];
  }
}
