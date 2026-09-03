"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  PaymentOrder,
  buildPagedResult,
  buildPagination,
  calculateNetAmount,
  getDonorOrThrow,
  getPaymentProviderOrThrow,
  mapPaymentOrder,
  normalizeCurrency,
  normalizeNullableString,
  toDateEnd,
  toDateStart,
  toNumericNumber,
} from "./accounting.shared.js";

async function getPaymentOrderWithRelations(repository, orderId) {
  return repository.findOne({
    where: { orden_pago_id: Number(orderId) },
    relations: {
      payment_provider: true,
      donor: true,
      transactions: true,
    },
  });
}

export async function createPaymentOrderService(body) {
  try {
    const order = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentOrder);
      const provider = await getPaymentProviderOrThrow(manager, body.proveedor_pago_id);
      const donor = await getDonorOrThrow(manager, body.donante_id, { optional: true });
      const amount = toNumericNumber(body.monto_bruto, NaN);

      calculateNetAmount(amount, 0);

      const newOrder = repository.create({
        payment_provider: { proveedor_pago_id: Number(provider.proveedor_pago_id) },
        proveedor_orden_id: normalizeNullableString(body.proveedor_orden_id),
        donor: donor ? { donante_id: Number(donor.donante_id) } : null,
        proposito: body.proposito,
        moneda: normalizeCurrency(body.moneda),
        monto_bruto: amount,
        estado: body.estado || "CREADA",
        approval_url: normalizeNullableString(body.approval_url),
        fecha_expiracion: body.fecha_expiracion || null,
        capturada_en: body.capturada_en || (body.estado === "CAPTURADA" ? new Date() : null),
        metadata: body.metadata || null,
      });

      const savedOrder = await repository.save(newOrder);
      return getPaymentOrderWithRelations(repository, savedOrder.orden_pago_id);
    });

    return [mapPaymentOrder(order), null];
  } catch (error) {
    console.error("Error al crear orden de pago:", error);
    return [null, error.message || "Error interno al crear orden de pago"];
  }
}

export async function getPaymentOrderService(query) {
  try {
    const repository = AppDataSource.getRepository(PaymentOrder);
    const order = await getPaymentOrderWithRelations(repository, query.orden_pago_id);

    if (!order) return [null, "Orden de pago no encontrada"];

    return [mapPaymentOrder(order), null];
  } catch (error) {
    console.error("Error al obtener orden de pago:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getPaymentOrdersService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(PaymentOrder);
    const { page, limit, skip } = buildPagination(query);
    const qb = repository
      .createQueryBuilder("paymentOrder")
      .leftJoinAndSelect("paymentOrder.payment_provider", "paymentProvider")
      .leftJoinAndSelect("paymentOrder.donor", "donor")
      .orderBy("paymentOrder.createdAt", "DESC")
      .addOrderBy("paymentOrder.orden_pago_id", "DESC")
      .skip(skip)
      .take(limit);

    if (query.proveedor_pago_id) {
      qb.andWhere("paymentProvider.proveedor_pago_id = :proveedor_pago_id", {
        proveedor_pago_id: Number(query.proveedor_pago_id),
      });
    }

    if (query.donante_id) {
      qb.andWhere("donor.donante_id = :donante_id", {
        donante_id: Number(query.donante_id),
      });
    }

    if (query.proposito) {
      qb.andWhere("paymentOrder.proposito = :proposito", {
        proposito: query.proposito,
      });
    }

    if (query.estado) {
      qb.andWhere("paymentOrder.estado = :estado", { estado: query.estado });
    }

    if (query.moneda) {
      qb.andWhere("paymentOrder.moneda = :moneda", { moneda: normalizeCurrency(query.moneda) });
    }

    const fechaDesde = toDateStart(query.fecha_desde);
    const fechaHasta = toDateEnd(query.fecha_hasta);
    if (fechaDesde) qb.andWhere("paymentOrder.createdAt >= :fechaDesde", { fechaDesde });
    if (fechaHasta) qb.andWhere("paymentOrder.createdAt <= :fechaHasta", { fechaHasta });

    if (query.search) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where("paymentOrder.proveedor_orden_id ILIKE :search", { search })
            .orWhere("paymentOrder.approval_url ILIKE :search", { search })
            .orWhere("paymentProvider.nombre ILIKE :search", { search })
            .orWhere("donor.nombre ILIKE :search", { search });
        }),
      );
    }

    const [orders, total] = await qb.getManyAndCount();

    return [
      buildPagedResult(orders.map(mapPaymentOrder), total, page, limit),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener ordenes de pago:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updatePaymentOrderService(query, body) {
  try {
    const order = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentOrder);
      const orderFound = await getPaymentOrderWithRelations(repository, query.orden_pago_id);

      if (!orderFound) {
        throw new Error("Orden de pago no encontrada");
      }

      if (body.proveedor_pago_id !== undefined) {
        if (!body.proveedor_pago_id) {
          throw new Error("La orden de pago debe mantener un proveedor de pago.");
        }
        const provider = await getPaymentProviderOrThrow(manager, body.proveedor_pago_id);
        orderFound.payment_provider = {
          proveedor_pago_id: Number(provider.proveedor_pago_id),
        };
      }

      if (body.donante_id !== undefined) {
        const donor = await getDonorOrThrow(manager, body.donante_id, { optional: true });
        orderFound.donor = donor ? { donante_id: Number(donor.donante_id) } : null;
      }

      if (body.proveedor_orden_id !== undefined) {
        orderFound.proveedor_orden_id = normalizeNullableString(body.proveedor_orden_id);
      }
      if (body.proposito !== undefined) orderFound.proposito = body.proposito;
      if (body.moneda !== undefined) orderFound.moneda = normalizeCurrency(body.moneda);
      if (body.monto_bruto !== undefined) {
        const amount = toNumericNumber(body.monto_bruto, NaN);
        calculateNetAmount(amount, 0);
        orderFound.monto_bruto = amount;
      }
      if (body.estado !== undefined) orderFound.estado = body.estado;
      if (body.approval_url !== undefined) {
        orderFound.approval_url = normalizeNullableString(body.approval_url);
      }
      if (body.fecha_expiracion !== undefined) {
        orderFound.fecha_expiracion = body.fecha_expiracion || null;
      }
      if (body.capturada_en !== undefined) {
        orderFound.capturada_en = body.capturada_en || null;
      } else if (body.estado === "CAPTURADA" && !orderFound.capturada_en) {
        orderFound.capturada_en = new Date();
      }
      if (body.metadata !== undefined) orderFound.metadata = body.metadata || null;

      await repository.save(orderFound);
      return getPaymentOrderWithRelations(repository, orderFound.orden_pago_id);
    });

    return [mapPaymentOrder(order), null];
  } catch (error) {
    console.error("Error al actualizar orden de pago:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function cancelPaymentOrderService(query, body = {}) {
  try {
    const order = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentOrder);
      const orderFound = await getPaymentOrderWithRelations(repository, query.orden_pago_id);

      if (!orderFound) {
        throw new Error("Orden de pago no encontrada");
      }

      if (["CAPTURADA", "REEMBOLSADA"].includes(orderFound.estado)) {
        throw new Error("No se puede cancelar una orden de pago capturada o reembolsada.");
      }

      orderFound.estado = "CANCELADA";
      orderFound.metadata = {
        ...(orderFound.metadata || {}),
        cancelacion: {
          motivo: normalizeNullableString(body.motivo),
          fecha: new Date().toISOString(),
        },
        ...(body.metadata || {}),
      };

      await repository.save(orderFound);
      return getPaymentOrderWithRelations(repository, orderFound.orden_pago_id);
    });

    return [mapPaymentOrder(order), null];
  } catch (error) {
    console.error("Error al cancelar orden de pago:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
