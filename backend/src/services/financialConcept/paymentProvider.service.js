"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  PaymentProvider,
  buildPagedResult,
  buildPagination,
  mapPaymentProvider,
  normalizeCode,
} from "./accounting.shared.js";

const FORBIDDEN_PROVIDER_METADATA_KEYS = new Set([
  "client_secret",
  "access_token",
  "password",
  "signature",
]);

function assertSafeProviderMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return;

  const stack = [metadata];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    for (const [key, value] of Object.entries(current)) {
      if (FORBIDDEN_PROVIDER_METADATA_KEYS.has(String(key).trim().toLowerCase())) {
        throw new Error(
          "metadata_publica no puede incluir client_secret, access_token, password ni signature.",
        );
      }

      if (Array.isArray(value)) {
        stack.push(...value);
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
}

async function getPaymentProviderWithRelations(repository, providerId) {
  return repository.findOne({
    where: { proveedor_pago_id: Number(providerId) },
  });
}

export async function createPaymentProviderService(body) {
  try {
    const provider = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentProvider);
      const clave = normalizeCode(body.clave);

      const existingProvider = await repository.findOne({
        where: { clave },
      });

      if (existingProvider) {
        throw new Error("Ya existe un proveedor de pago con esa clave.");
      }

      assertSafeProviderMetadata(body.metadata_publica);

      const newProvider = repository.create({
        clave,
        nombre: body.nombre.trim(),
        tipo: body.tipo,
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        metadata_publica: body.metadata_publica || null,
      });

      const savedProvider = await repository.save(newProvider);
      return getPaymentProviderWithRelations(repository, savedProvider.proveedor_pago_id);
    });

    return [mapPaymentProvider(provider), null];
  } catch (error) {
    console.error("Error al crear proveedor de pago:", error);
    return [null, error.message || "Error interno al crear proveedor de pago"];
  }
}

export async function getPaymentProviderService(query) {
  try {
    const repository = AppDataSource.getRepository(PaymentProvider);
    const provider = await getPaymentProviderWithRelations(repository, query.proveedor_pago_id);

    if (!provider) return [null, "Proveedor de pago no encontrado"];

    return [mapPaymentProvider(provider), null];
  } catch (error) {
    console.error("Error al obtener proveedor de pago:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getPaymentProvidersService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(PaymentProvider);
    const { page, limit, skip } = buildPagination(query);
    const qb = repository
      .createQueryBuilder("provider")
      .orderBy("provider.nombre", "ASC")
      .addOrderBy("provider.proveedor_pago_id", "ASC")
      .skip(skip)
      .take(limit);

    if (query.tipo) {
      qb.andWhere("provider.tipo = :tipo", { tipo: query.tipo });
    }

    if (query.activo !== undefined) {
      qb.andWhere("provider.activo = :activo", {
        activo: query.activo === true || query.activo === "true",
      });
    }

    if (query.search) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where("provider.clave ILIKE :search", { search })
            .orWhere("provider.nombre ILIKE :search", { search })
            .orWhere("provider.tipo ILIKE :search", { search });
        }),
      );
    }

    const [providers, total] = await qb.getManyAndCount();

    return [
      buildPagedResult(providers.map(mapPaymentProvider), total, page, limit),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener proveedores de pago:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updatePaymentProviderService(query, body) {
  try {
    const provider = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentProvider);
      const providerFound = await getPaymentProviderWithRelations(
        repository,
        query.proveedor_pago_id,
      );

      if (!providerFound) {
        throw new Error("Proveedor de pago no encontrado");
      }

      if (body.clave !== undefined) {
        const clave = normalizeCode(body.clave);
        const existingProvider = await repository.findOne({ where: { clave } });

        if (
          existingProvider
          && Number(existingProvider.proveedor_pago_id) !== Number(providerFound.proveedor_pago_id)
        ) {
          throw new Error("Ya existe un proveedor de pago con esa clave.");
        }

        providerFound.clave = clave;
      }

      if (body.nombre !== undefined) providerFound.nombre = body.nombre.trim();
      if (body.tipo !== undefined) providerFound.tipo = body.tipo;
      if (body.activo !== undefined) providerFound.activo = Boolean(body.activo);
      if (body.metadata_publica !== undefined) {
        assertSafeProviderMetadata(body.metadata_publica);
        providerFound.metadata_publica = body.metadata_publica || null;
      }

      await repository.save(providerFound);
      return getPaymentProviderWithRelations(repository, providerFound.proveedor_pago_id);
    });

    return [mapPaymentProvider(provider), null];
  } catch (error) {
    console.error("Error al actualizar proveedor de pago:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deletePaymentProviderService(query) {
  try {
    const provider = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentProvider);
      const providerFound = await getPaymentProviderWithRelations(
        repository,
        query.proveedor_pago_id,
      );

      if (!providerFound) {
        throw new Error("Proveedor de pago no encontrado");
      }

      providerFound.activo = false;
      await repository.save(providerFound);

      return getPaymentProviderWithRelations(repository, providerFound.proveedor_pago_id);
    });

    return [mapPaymentProvider(provider), null];
  } catch (error) {
    console.error("Error al desactivar proveedor de pago:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
