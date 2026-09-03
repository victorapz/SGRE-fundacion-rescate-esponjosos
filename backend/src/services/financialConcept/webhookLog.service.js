"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  WebhookLog,
  buildPagedResult,
  buildPagination,
  getPaymentProviderOrThrow,
  mapWebhookLog,
  normalizeNullableString,
  toDateEnd,
  toDateStart,
} from "./accounting.shared.js";

async function getWebhookLogWithRelations(repository, webhookLogId) {
  return repository.findOne({
    where: { webhook_log_id: Number(webhookLogId) },
    relations: {
      payment_provider: true,
    },
  });
}

export async function createWebhookLogService(body) {
  try {
    const log = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WebhookLog);
      const provider = await getPaymentProviderOrThrow(manager, body.proveedor_pago_id, {
        optional: true,
      });

      const newLog = repository.create({
        payment_provider: provider
          ? { proveedor_pago_id: Number(provider.proveedor_pago_id) }
          : null,
        evento_tipo: body.evento_tipo,
        proveedor_evento_id: body.proveedor_evento_id,
        // Se conserva el contenido original en DB para trazabilidad y futuro procesamiento;
        // la API administrativa siempre expone payload/headers sanitizados desde el mapper.
        payload: body.payload || null,
        headers: body.headers || null,
        firma_verificada: body.firma_verificada === true,
        estado: body.estado || "RECIBIDO",
        recibido_en: body.recibido_en || new Date(),
        procesado_en: body.procesado_en || null,
        intentos: Number(body.intentos || 0),
        error_mensaje: normalizeNullableString(body.error_mensaje),
        referencia_tipo: normalizeNullableString(body.referencia_tipo),
        referencia_id: body.referencia_id || null,
      });

      const savedLog = await repository.save(newLog);
      return getWebhookLogWithRelations(repository, savedLog.webhook_log_id);
    });

    return [mapWebhookLog(log), null];
  } catch (error) {
    console.error("Error al crear webhook log:", error);
    return [null, error.message || "Error interno al crear webhook log"];
  }
}

export async function updateWebhookLogService(query, body) {
  try {
    const log = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WebhookLog);
      const logFound = await getWebhookLogWithRelations(repository, query.webhook_log_id);

      if (!logFound) throw new Error("Webhook log no encontrado");

      if (body.proveedor_pago_id !== undefined) {
        const provider = await getPaymentProviderOrThrow(manager, body.proveedor_pago_id, {
          optional: true,
        });
        logFound.payment_provider = provider
          ? { proveedor_pago_id: Number(provider.proveedor_pago_id) }
          : null;
      }

      if (body.evento_tipo !== undefined) logFound.evento_tipo = body.evento_tipo;
      if (body.proveedor_evento_id !== undefined) {
        logFound.proveedor_evento_id = body.proveedor_evento_id;
      }
      // Se conserva el contenido original en DB para trazabilidad y futuro procesamiento;
      // la API administrativa siempre expone payload/headers sanitizados desde el mapper.
      if (body.payload !== undefined) logFound.payload = body.payload || null;
      if (body.headers !== undefined) logFound.headers = body.headers || null;
      if (body.firma_verificada !== undefined) {
        logFound.firma_verificada = Boolean(body.firma_verificada);
      }
      if (body.estado !== undefined) logFound.estado = body.estado;
      if (body.procesado_en !== undefined) logFound.procesado_en = body.procesado_en || null;
      if (body.intentos !== undefined) logFound.intentos = Number(body.intentos || 0);
      if (body.error_mensaje !== undefined) {
        logFound.error_mensaje = normalizeNullableString(body.error_mensaje);
      }
      if (body.referencia_tipo !== undefined) {
        logFound.referencia_tipo = normalizeNullableString(body.referencia_tipo);
      }
      if (body.referencia_id !== undefined) logFound.referencia_id = body.referencia_id || null;

      await repository.save(logFound);
      return getWebhookLogWithRelations(repository, logFound.webhook_log_id);
    });

    return [mapWebhookLog(log), null];
  } catch (error) {
    console.error("Error al actualizar webhook log:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function getWebhookLogService(query) {
  try {
    const repository = AppDataSource.getRepository(WebhookLog);
    const log = await getWebhookLogWithRelations(repository, query.webhook_log_id);

    if (!log) return [null, "Webhook log no encontrado"];

    return [mapWebhookLog(log), null];
  } catch (error) {
    console.error("Error al obtener webhook log:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getWebhookLogsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(WebhookLog);
    const { page, limit, skip } = buildPagination(query);
    const qb = repository
      .createQueryBuilder("webhookLog")
      .leftJoinAndSelect("webhookLog.payment_provider", "paymentProvider")
      .orderBy("webhookLog.recibido_en", "DESC")
      .addOrderBy("webhookLog.webhook_log_id", "DESC")
      .skip(skip)
      .take(limit);

    if (query.proveedor_pago_id) {
      qb.andWhere("paymentProvider.proveedor_pago_id = :proveedor_pago_id", {
        proveedor_pago_id: Number(query.proveedor_pago_id),
      });
    }

    if (query.evento_tipo) {
      qb.andWhere("webhookLog.evento_tipo ILIKE :evento_tipo", {
        evento_tipo: `%${String(query.evento_tipo).trim()}%`,
      });
    }

    if (query.estado) {
      qb.andWhere("webhookLog.estado = :estado", { estado: query.estado });
    }

    const fechaDesde = toDateStart(query.fecha_desde);
    const fechaHasta = toDateEnd(query.fecha_hasta);
    if (fechaDesde) qb.andWhere("webhookLog.recibido_en >= :fechaDesde", { fechaDesde });
    if (fechaHasta) qb.andWhere("webhookLog.recibido_en <= :fechaHasta", { fechaHasta });

    if (query.search) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where("webhookLog.proveedor_evento_id ILIKE :search", { search })
            .orWhere("webhookLog.evento_tipo ILIKE :search", { search })
            .orWhere("paymentProvider.nombre ILIKE :search", { search })
            .orWhere("webhookLog.error_mensaje ILIKE :search", { search });
        }),
      );
    }

    const [logs, total] = await qb.getManyAndCount();

    return [
      buildPagedResult(logs.map(mapWebhookLog), total, page, limit),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener webhook logs:", error);
    return [null, "Error interno del servidor"];
  }
}
