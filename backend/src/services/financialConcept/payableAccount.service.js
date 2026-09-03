"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  PayableAccount,
  buildPagedResult,
  buildPagination,
  calculatePayableAmounts,
  derivePayableState,
  getTransactionCategoryOrThrow,
  getUserOrThrow,
  mapPayableAccount,
  normalizeCurrency,
  normalizeNullableString,
  toDateEnd,
  toDateStart,
  toNumericNumber,
} from "./accounting.shared.js";

function assertPayableCategoryCompatibility(category) {
  if (!category) return;

  if (!["EGRESO", "AMBOS"].includes(category.tipo)) {
    throw new Error("La categoria de una cuenta por pagar debe ser de tipo EGRESO o AMBOS.");
  }
}

function hasRegisteredPayablePayments(payable) {
  return toNumericNumber(payable?.monto_pagado, 0) > 0
    || (Array.isArray(payable?.payments) && payable.payments.length > 0);
}

async function getPayableAccountWithRelations(repository, payableId) {
  return repository.findOne({
    where: { cuenta_por_pagar_id: Number(payableId) },
    relations: {
      category: {
        categoria_padre: true,
      },
      created_by: true,
      payments: {
        transaction: {
          category: true,
          payment_provider: true,
          donor: true,
          payable_account: true,
          created_by: true,
        },
        created_by: true,
      },
    },
  });
}

export async function createPayableAccountService(body, authContext = {}) {
  try {
    const payable = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PayableAccount);
      const category = await getTransactionCategoryOrThrow(
        manager,
        body.categoria_transaccion_id,
        { optional: true },
      );
      assertPayableCategoryCompatibility(category);

      const createdBy = authContext.userId
        ? await getUserOrThrow(manager, authContext.userId)
        : null;
      const amounts = calculatePayableAmounts(body.monto_total, 0);
      const estado = derivePayableState({
        montoTotal: amounts.monto_total,
        montoPagado: amounts.monto_pagado,
        fechaVencimiento: body.fecha_vencimiento || null,
      });

      const newPayable = repository.create({
        origen_tipo: normalizeNullableString(body.origen_tipo),
        origen_id: body.origen_id || null,
        proveedor_tipo: normalizeNullableString(body.proveedor_tipo),
        proveedor_id: body.proveedor_id || null,
        category: category
          ? { categoria_transaccion_id: Number(category.categoria_transaccion_id) }
          : null,
        descripcion: normalizeNullableString(body.descripcion),
        moneda: normalizeCurrency(body.moneda),
        monto_total: amounts.monto_total,
        monto_pagado: amounts.monto_pagado,
        saldo_pendiente: amounts.saldo_pendiente,
        fecha_emision: body.fecha_emision,
        fecha_vencimiento: body.fecha_vencimiento || null,
        estado,
        created_by: createdBy ? { id_usuario: Number(createdBy.id_usuario) } : null,
        metadata: body.metadata || null,
      });

      const savedPayable = await repository.save(newPayable);
      return getPayableAccountWithRelations(repository, savedPayable.cuenta_por_pagar_id);
    });

    return [mapPayableAccount(payable), null];
  } catch (error) {
    console.error("Error al crear cuenta por pagar:", error);
    return [null, error.message || "Error interno al crear cuenta por pagar"];
  }
}

export async function getPayableAccountService(query) {
  try {
    const repository = AppDataSource.getRepository(PayableAccount);
    const payable = await getPayableAccountWithRelations(repository, query.cuenta_por_pagar_id);

    if (!payable) return [null, "Cuenta por pagar no encontrada"];

    return [mapPayableAccount(payable), null];
  } catch (error) {
    console.error("Error al obtener cuenta por pagar:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getPayableAccountsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(PayableAccount);
    const { page, limit, skip } = buildPagination(query);
    const qb = repository
      .createQueryBuilder("payable")
      .leftJoinAndSelect("payable.category", "category")
      .leftJoinAndSelect("category.categoria_padre", "categoryParent")
      .leftJoinAndSelect("payable.created_by", "createdBy")
      .orderBy("payable.fecha_vencimiento", "ASC", "NULLS LAST")
      .addOrderBy("payable.cuenta_por_pagar_id", "DESC")
      .skip(skip)
      .take(limit);

    if (query.estado === "VENCIDA") {
      qb.andWhere("payable.saldo_pendiente > 0");
      qb.andWhere("payable.estado NOT IN (:...excludedStates)", {
        excludedStates: ["ANULADA", "CONDONADA", "PAGADA"],
      });
      qb.andWhere("payable.fecha_vencimiento IS NOT NULL");
      qb.andWhere("payable.fecha_vencimiento < :today", {
        today: new Date().toISOString().slice(0, 10),
      });
    } else if (query.estado === "PAGADA") {
      qb.andWhere("payable.saldo_pendiente = 0");
      qb.andWhere("payable.estado NOT IN (:...excludedStates)", {
        excludedStates: ["ANULADA", "CONDONADA"],
      });
    } else if (query.estado === "PAGADA_PARCIAL") {
      qb.andWhere("payable.monto_pagado > 0");
      qb.andWhere("payable.saldo_pendiente > 0");
      qb.andWhere("payable.estado NOT IN (:...excludedStates)", {
        excludedStates: ["ANULADA", "CONDONADA"],
      });
    } else if (query.estado === "PENDIENTE") {
      qb.andWhere("payable.monto_pagado = 0");
      qb.andWhere("payable.saldo_pendiente > 0");
      qb.andWhere("payable.estado NOT IN (:...excludedStates)", {
        excludedStates: ["ANULADA", "CONDONADA"],
      });
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where("payable.fecha_vencimiento IS NULL")
            .orWhere("payable.fecha_vencimiento >= :todayPending", {
              todayPending: new Date().toISOString().slice(0, 10),
            });
        }),
      );
    } else if (query.estado) {
      qb.andWhere("payable.estado = :estado", { estado: query.estado });
    }
    if (query.origen_tipo) {
      qb.andWhere("payable.origen_tipo ILIKE :origen_tipo", {
        origen_tipo: `%${String(query.origen_tipo).trim()}%`,
      });
    }
    if (query.proveedor_tipo) {
      qb.andWhere("payable.proveedor_tipo ILIKE :proveedor_tipo", {
        proveedor_tipo: `%${String(query.proveedor_tipo).trim()}%`,
      });
    }
    if (query.categoria_transaccion_id) {
      qb.andWhere("category.categoria_transaccion_id = :categoria_transaccion_id", {
        categoria_transaccion_id: Number(query.categoria_transaccion_id),
      });
    }
    if (query.moneda) {
      qb.andWhere("payable.moneda = :moneda", { moneda: normalizeCurrency(query.moneda) });
    }

    const fechaDesde = toDateStart(query.fecha_desde);
    const fechaHasta = toDateEnd(query.fecha_hasta);
    if (fechaDesde) qb.andWhere("payable.fecha_emision >= :fechaDesde", { fechaDesde });
    if (fechaHasta) qb.andWhere("payable.fecha_emision <= :fechaHasta", { fechaHasta });

    if (query.vencidas === true || query.vencidas === "true") {
      qb.andWhere("payable.saldo_pendiente > 0");
      qb.andWhere("payable.estado NOT IN (:...excludedStates)", {
        excludedStates: ["ANULADA", "CONDONADA", "PAGADA"],
      });
      qb.andWhere("payable.fecha_vencimiento IS NOT NULL");
      qb.andWhere("payable.fecha_vencimiento < :today", {
        today: new Date().toISOString().slice(0, 10),
      });
    }

    if (query.search) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where("payable.descripcion ILIKE :search", { search })
            .orWhere("payable.origen_tipo ILIKE :search", { search })
            .orWhere("payable.proveedor_tipo ILIKE :search", { search })
            .orWhere("CAST(payable.proveedor_id AS TEXT) ILIKE :search", { search })
            .orWhere("category.nombre ILIKE :search", { search });
        }),
      );
    }

    const [payables, total] = await qb.getManyAndCount();

    return [
      buildPagedResult(payables.map(mapPayableAccount), total, page, limit),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener cuentas por pagar:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updatePayableAccountService(query, body) {
  try {
    const payable = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PayableAccount);
      const payableFound = await getPayableAccountWithRelations(
        repository,
        query.cuenta_por_pagar_id,
      );

      if (!payableFound) {
        throw new Error("Cuenta por pagar no encontrada");
      }

      if (["ANULADA", "CONDONADA"].includes(payableFound.estado)) {
        throw new Error("No se puede editar una cuenta por pagar anulada o condonada.");
      }

      const hasRegisteredPayments = hasRegisteredPayablePayments(payableFound);

      if (
        body.moneda !== undefined
        && hasRegisteredPayments
        && normalizeCurrency(body.moneda) !== String(payableFound.moneda || "CLP")
      ) {
        throw new Error(
          "No se puede cambiar la moneda de una cuenta por pagar con pagos registrados.",
        );
      }

      const category = body.categoria_transaccion_id !== undefined
        ? await getTransactionCategoryOrThrow(manager, body.categoria_transaccion_id, {
            optional: true,
          })
        : payableFound.category;
      assertPayableCategoryCompatibility(category);

      const nextTotal = body.monto_total !== undefined
        ? toNumericNumber(body.monto_total, NaN)
        : toNumericNumber(payableFound.monto_total, NaN);

      if (
        body.monto_total !== undefined
        && nextTotal < toNumericNumber(payableFound.monto_pagado, 0)
      ) {
        throw new Error("El monto total no puede ser menor que el monto pagado registrado.");
      }

      const amounts = calculatePayableAmounts(nextTotal, payableFound.monto_pagado);
      const estado = derivePayableState({
        estadoActual: payableFound.estado,
        montoTotal: amounts.monto_total,
        montoPagado: amounts.monto_pagado,
        fechaVencimiento:
          body.fecha_vencimiento !== undefined
            ? body.fecha_vencimiento || null
            : payableFound.fecha_vencimiento,
      });

      const updatePayload = {
        origen_tipo:
          body.origen_tipo !== undefined
            ? normalizeNullableString(body.origen_tipo)
            : payableFound.origen_tipo,
        origen_id:
          body.origen_id !== undefined
            ? body.origen_id || null
            : payableFound.origen_id ?? null,
        proveedor_tipo:
          body.proveedor_tipo !== undefined
            ? normalizeNullableString(body.proveedor_tipo)
            : payableFound.proveedor_tipo,
        proveedor_id:
          body.proveedor_id !== undefined
            ? body.proveedor_id || null
            : payableFound.proveedor_id ?? null,
        descripcion:
          body.descripcion !== undefined
            ? normalizeNullableString(body.descripcion)
            : payableFound.descripcion,
        moneda:
          body.moneda !== undefined
            ? normalizeCurrency(body.moneda)
            : normalizeCurrency(payableFound.moneda),
        monto_total: body.monto_total !== undefined
          ? amounts.monto_total
          : toNumericNumber(payableFound.monto_total, 0),
        monto_pagado: amounts.monto_pagado,
        saldo_pendiente: amounts.saldo_pendiente,
        fecha_emision:
          body.fecha_emision !== undefined
            ? body.fecha_emision
            : payableFound.fecha_emision,
        fecha_vencimiento:
          body.fecha_vencimiento !== undefined
            ? body.fecha_vencimiento || null
            : payableFound.fecha_vencimiento,
        estado,
        metadata:
          body.metadata !== undefined
            ? body.metadata || null
            : payableFound.metadata || null,
      };

      await repository.update(
        { cuenta_por_pagar_id: Number(payableFound.cuenta_por_pagar_id) },
        updatePayload,
      );

      if (body.categoria_transaccion_id !== undefined) {
        await repository.save({
          cuenta_por_pagar_id: Number(payableFound.cuenta_por_pagar_id),
          category: category
            ? {
                categoria_transaccion_id: Number(category.categoria_transaccion_id),
              }
            : null,
        });
      }

      return getPayableAccountWithRelations(repository, payableFound.cuenta_por_pagar_id);
    });

    return [mapPayableAccount(payable), null];
  } catch (error) {
    console.error("Error al actualizar cuenta por pagar:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function cancelPayableAccountService(query, body = {}) {
  try {
    const payable = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PayableAccount);
      const payableFound = await getPayableAccountWithRelations(
        repository,
        query.cuenta_por_pagar_id,
      );

      if (!payableFound) {
        throw new Error("Cuenta por pagar no encontrada");
      }

      if (toNumericNumber(payableFound.monto_pagado, 0) > 0) {
        throw new Error("No se puede anular o condonar una cuenta por pagar que ya registra pagos.");
      }

      const nextMetadata = {
        ...(payableFound.metadata || {}),
        cierre: {
          estado: body.estado,
          observacion: normalizeNullableString(body.observacion),
          fecha: new Date().toISOString(),
        },
        ...(body.metadata || {}),
      };

      await repository.update(
        { cuenta_por_pagar_id: Number(payableFound.cuenta_por_pagar_id) },
        {
          estado: body.estado,
          metadata: nextMetadata,
        },
      );
      return getPayableAccountWithRelations(repository, payableFound.cuenta_por_pagar_id);
    });

    return [mapPayableAccount(payable), null];
  } catch (error) {
    console.error("Error al cerrar cuenta por pagar:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
