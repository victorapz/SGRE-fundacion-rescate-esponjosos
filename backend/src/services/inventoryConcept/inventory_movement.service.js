"use strict";

import { AppDataSource } from "../../config/configDb.js";
import InventoryMovement from "../../entities/inventoryConcept/inventory_movement.entity.js";
import { mapInventoryMovement, resolveReadScope, assertLocationWithinScope } from "./inventory.shared.js";

export async function createInventoryMovementService() {
  return [
    null,
    "Los movimientos historicos no pueden crearse mediante CRUD directo. Usa los servicios transaccionales de inventario.",
  ];
}

export async function getInventoryMovementService(query, authContext = {}) {
  try {
    const movement = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);
      const repository = manager.getRepository(InventoryMovement);
      const found = await repository.findOne({
        where: { movimiento_id: Number(query.movimiento_id) },
        relations: {
          item: {
            categoria: true,
            unidad_medida: true,
          },
          source_location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          destination_location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          performed_by: true,
          donation_item: true,
          purchase_detail: true,
        },
      });

      if (!found) {
        throw new Error("Movimiento de inventario no encontrado");
      }

      if (scope.mode === "location") {
        const sourceId = found.source_location?.ubicacion_id || null;
        const destinationId = found.destination_location?.ubicacion_id || null;
        const allowedLocationId = Number(scope.userLocationId);
        if (Number(sourceId) !== allowedLocationId && Number(destinationId) !== allowedLocationId) {
          throw new Error("No tienes permisos para ver movimientos de otras ubicaciones.");
        }
      }

      return found;
    });

    return [mapInventoryMovement(movement), null];
  } catch (error) {
    console.error("Error al obtener movimiento de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function getInventoryMovementsService(query = {}, authContext = {}) {
  try {
    const movements = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);
      const repository = manager.getRepository(InventoryMovement);
      const queryBuilder = repository
        .createQueryBuilder("movement")
        .leftJoinAndSelect("movement.item", "item")
        .leftJoinAndSelect("item.categoria", "categoria")
        .leftJoinAndSelect("item.unidad_medida", "unidad")
        .leftJoinAndSelect("movement.source_location", "source_location")
        .leftJoinAndSelect("source_location.region", "source_region")
        .leftJoinAndSelect("source_location.comuna", "source_comuna")
        .leftJoinAndSelect("movement.destination_location", "destination_location")
        .leftJoinAndSelect("destination_location.region", "destination_region")
        .leftJoinAndSelect("destination_location.comuna", "destination_comuna")
        .leftJoinAndSelect("movement.performed_by", "performed_by")
        .leftJoinAndSelect("movement.donation_item", "donation_item")
        .leftJoinAndSelect("movement.purchase_detail", "purchase_detail")
        .orderBy("movement.fecha_movimiento", "DESC")
        .addOrderBy("movement.movimiento_id", "DESC");

      if (query.item_id) {
        queryBuilder.andWhere("item.item_id = :itemId", { itemId: Number(query.item_id) });
      }

      if (scope.mode === "location") {
        queryBuilder.andWhere(
          "(source_location.ubicacion_id = :locationId OR destination_location.ubicacion_id = :locationId)",
          { locationId: Number(scope.userLocationId) },
        );
      } else if (query.location_id) {
        queryBuilder.andWhere(
          "(source_location.ubicacion_id = :locationId OR destination_location.ubicacion_id = :locationId)",
          { locationId: Number(query.location_id) },
        );
      }

      return queryBuilder.getMany();
    });

    if (!movements || movements.length === 0) {
      return [null, "No hay movimientos de inventario"];
    }

    return [movements.map(mapInventoryMovement), null];
  } catch (error) {
    console.error("Error al obtener movimientos de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function updateInventoryMovementService() {
  return [
    null,
    "Los movimientos historicos no pueden editarse mediante CRUD directo.",
  ];
}

export async function deleteInventoryMovementService() {
  return [
    null,
    "Los movimientos historicos no pueden eliminarse mediante CRUD directo.",
  ];
}
