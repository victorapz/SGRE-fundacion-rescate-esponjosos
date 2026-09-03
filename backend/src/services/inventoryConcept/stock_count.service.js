"use strict";

import {
  AppDataSource,
  StockCount,
  StockCountDetail,
  getItemOrThrow,
  getLocationOrThrow,
  getUserOrThrow,
  mapStockCount,
  resolveInventoryScope,
  assertLocationWithinScope,
} from "./inventory.shared.js";

const STOCK_COUNT_GLOBAL_PERMISSIONS = [
  "inventory:stock_count:create",
  "inventory:stock_count:read",
  "inventory:stock_count:update",
  "inventory:stock_count:delete",
  "inventory:read:any",
];

const STOCK_COUNT_LOCATION_PERMISSIONS = [
  "inventory:stock_count:create:location",
  "inventory:read:location",
];

async function resolveStockCountScope(manager, authContext = {}) {
  return resolveInventoryScope(manager, authContext, {
    globalPermissions: STOCK_COUNT_GLOBAL_PERMISSIONS,
    locationPermissions: STOCK_COUNT_LOCATION_PERMISSIONS,
  });
}

async function getStockCountWithRelations(repository, stockCountId) {
  return repository.findOne({
    where: { conteo_fisico_id: Number(stockCountId) },
    relations: {
      location: {
        region: true,
        comuna: {
          region: true,
        },
      },
      performed_by: true,
      details: {
        item: {
          categoria: true,
          unidad_medida: true,
        },
        existence: {
          item: {
            categoria: true,
            unidad_medida: true,
          },
          location: {
            region: true,
            comuna: {
              region: true,
            },
          },
        },
      },
    },
  });
}

export async function createStockCountService(body, authContext = {}) {
  try {
    const stockCount = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveStockCountScope(manager, authContext);
      const location = await getLocationOrThrow(manager, body.location_id, { requireActive: true });
      assertLocationWithinScope(scope, location.ubicacion_id);

      const performedById = body.performed_by_id || authContext.userId;
      await getUserOrThrow(manager, performedById);

      const stockCountRepository = manager.getRepository(StockCount);
      const stockCountDetailRepository = manager.getRepository(StockCountDetail);

      const createdStockCount = await stockCountRepository.save(
        stockCountRepository.create({
          fecha_conteo: body.fecha_conteo,
          observaciones: body.observaciones || null,
          location: { ubicacion_id: Number(location.ubicacion_id) },
          performed_by: { id_usuario: Number(performedById) },
        }),
      );

      const detailsToSave = [];
      for (const detail of body.detalles) {
        await getItemOrThrow(manager, detail.item_id, { requireActive: true });

        if (detail.existencia_id) {
          const existence = await manager.getRepository("InventoryExistence").findOne({
            where: { existencia_id: Number(detail.existencia_id) },
            relations: {
              location: true,
              item: true,
            },
          });

          if (!existence) {
            throw new Error("La existencia indicada para el conteo no existe.");
          }

          if (Number(existence.location?.ubicacion_id) !== Number(location.ubicacion_id)) {
            throw new Error(
              "La existencia indicada no pertenece a la ubicacion del conteo.",
            );
          }

          if (Number(existence.item?.item_id) !== Number(detail.item_id)) {
            throw new Error("La existencia indicada no corresponde al item del detalle.");
          }
        }

        detailsToSave.push(
          stockCountDetailRepository.create({
            cantidad_contada: detail.cantidad_contada,
            observaciones: detail.observaciones || null,
            stock_count: { conteo_fisico_id: Number(createdStockCount.conteo_fisico_id) },
            item: { item_id: Number(detail.item_id) },
            existence: detail.existencia_id
              ? { existencia_id: Number(detail.existencia_id) }
              : null,
          }),
        );
      }

      await stockCountDetailRepository.save(detailsToSave);
      return getStockCountWithRelations(
        stockCountRepository,
        createdStockCount.conteo_fisico_id,
      );
    });

    return [mapStockCount(stockCount), null];
  } catch (error) {
    console.error("Error al crear conteo de stock:", error);
    return [null, error.message || "Error interno al crear conteo de stock"];
  }
}

export async function getStockCountService(query, authContext = {}) {
  try {
    const stockCount = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveStockCountScope(manager, authContext);
      const repository = manager.getRepository(StockCount);
      const found = await getStockCountWithRelations(repository, query.conteo_fisico_id);

      if (!found) {
        throw new Error("Conteo de stock no encontrado");
      }

      assertLocationWithinScope(scope, found.location?.ubicacion_id);
      return found;
    });

    return [mapStockCount(stockCount), null];
  } catch (error) {
    console.error("Error al obtener conteo de stock:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function getStockCountsService(authContext = {}) {
  try {
    const stockCounts = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveStockCountScope(manager, authContext);
      const repository = manager.getRepository(StockCount);
      const where = scope.mode === "location"
        ? { location: { ubicacion_id: Number(scope.userLocationId) } }
        : {};

      return repository.find({
        where,
        relations: {
          location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          performed_by: true,
          details: true,
        },
        order: {
          fecha_conteo: "DESC",
          conteo_fisico_id: "DESC",
        },
      });
    });

    if (!stockCounts || stockCounts.length === 0) return [null, "No hay conteos de stock"];

    return [stockCounts.map(mapStockCount), null];
  } catch (error) {
    console.error("Error al obtener conteos de stock:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function updateStockCountService(query, body, authContext = {}) {
  try {
    const stockCount = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveStockCountScope(manager, authContext);
      const repository = manager.getRepository(StockCount);
      const found = await repository.findOne({
        where: { conteo_fisico_id: Number(query.conteo_fisico_id) },
        relations: {
          location: true,
        },
      });

      if (!found) {
        throw new Error("Conteo de stock no encontrado");
      }

      assertLocationWithinScope(scope, found.location?.ubicacion_id);

      const linkedAdjustment = await manager.getRepository("InventoryAdjustment").findOne({
        where: { stock_count: { conteo_fisico_id: Number(found.conteo_fisico_id) } },
      });

      if (linkedAdjustment) {
        throw new Error(
          "No se puede modificar un conteo fisico que ya esta asociado a un ajuste.",
        );
      }

      if (body.location_id !== undefined) {
        const location = await getLocationOrThrow(manager, body.location_id, { requireActive: true });
        assertLocationWithinScope(scope, location.ubicacion_id);
        found.location = { ubicacion_id: Number(body.location_id) };
      }

      const performedById = body.performed_by_id || authContext.userId;
      if (body.performed_by_id !== undefined && performedById) {
        await getUserOrThrow(manager, performedById);
        found.performed_by = { id_usuario: Number(performedById) };
      }

      if (body.fecha_conteo !== undefined) found.fecha_conteo = body.fecha_conteo;
      if (body.observaciones !== undefined) found.observaciones = body.observaciones || null;

      await repository.save(found);
      return getStockCountWithRelations(repository, found.conteo_fisico_id);
    });

    return [mapStockCount(stockCount), null];
  } catch (error) {
    console.error("Error al actualizar conteo de stock:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteStockCountService(query, authContext = {}) {
  try {
    const stockCount = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveStockCountScope(manager, authContext);
      const repository = manager.getRepository(StockCount);
      const found = await repository.findOne({
        where: { conteo_fisico_id: Number(query.conteo_fisico_id) },
        relations: {
          location: true,
        },
      });

      if (!found) {
        throw new Error("Conteo de stock no encontrado");
      }

      assertLocationWithinScope(scope, found.location?.ubicacion_id);

      const linkedAdjustment = await manager.getRepository("InventoryAdjustment").findOne({
        where: { stock_count: { conteo_fisico_id: Number(found.conteo_fisico_id) } },
      });

      if (linkedAdjustment) {
        throw new Error(
          "No se puede eliminar un conteo fisico que ya esta asociado a un ajuste.",
        );
      }

      return repository.remove(found);
    });

    return [stockCount, null];
  } catch (error) {
    console.error("Error al eliminar conteo de stock:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
