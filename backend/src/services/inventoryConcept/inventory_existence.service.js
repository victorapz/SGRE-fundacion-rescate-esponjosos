"use strict";

import {
  AppDataSource,
  InventoryExistence,
  findExistenceById,
  getExistencesByItem,
  getExistencesByLocation,
  mapInventoryExistence,
  resolveReadScope,
  assertLocationWithinScope,
} from "./inventory.shared.js";

export async function getInventoryExistenceService(query, authContext = {}) {
  try {
    const existence = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);
      const found = await findExistenceById(manager, query.existencia_id);

      if (!found) {
        throw new Error("Existencia no encontrada.");
      }

      assertLocationWithinScope(scope, found.location?.ubicacion_id);
      return found;
    });

    return [mapInventoryExistence(existence), null];
  } catch (error) {
    console.error("Error al obtener existencia de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function getInventoryExistencesService(query = {}, authContext = {}) {
  try {
    const existences = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);

      if (query.location_id && query.item_id) {
        assertLocationWithinScope(scope, query.location_id);
        return getExistencesByItem(manager, query.item_id, {
          locationId: query.location_id,
        });
      }

      if (query.location_id) {
        assertLocationWithinScope(scope, query.location_id);
        return getExistencesByLocation(manager, query.location_id);
      }

      if (query.item_id) {
        const scopedLocationId = scope.mode === "location" ? scope.userLocationId : null;
        return getExistencesByItem(manager, query.item_id, {
          locationId: query.location_id || scopedLocationId,
        });
      }

      const repository = manager.getRepository(InventoryExistence);
      const where = {};

      if (scope.mode === "location") {
        where.location = { ubicacion_id: Number(scope.userLocationId) };
      }

      if (query.estado) {
        where.estado = query.estado;
      }

      if (query.condicion) {
        where.condicion = query.condicion;
      }

      return repository.find({
        where,
        relations: {
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
        order: {
          createdAt: "DESC",
        },
      });
    });

    if (!existences || existences.length === 0) {
      return [null, "No hay existencias de inventario"];
    }

    return [existences.map(mapInventoryExistence), null];
  } catch (error) {
    console.error("Error al obtener existencias de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
