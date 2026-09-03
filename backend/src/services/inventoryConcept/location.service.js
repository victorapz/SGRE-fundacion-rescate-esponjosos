"use strict";

import { AppDataSource } from "../../config/configDb.js";
import InventoryAdjustment from "../../entities/inventoryConcept/inventory_adjustment.entity.js";
import InventoryExistence from "../../entities/inventoryConcept/inventory_existence.entity.js";
import Location from "../../entities/inventoryConcept/location.entity.js";
import StockCount from "../../entities/inventoryConcept/stock_count.entity.js";
import Supplier from "../../entities/inventoryConcept/supplier.entity.js";
import User from "../../entities/user.entity.js";
import VetClinic from "../../entities/animalConcept/vet_clinic.entity.js";
import {
  createManagedLocation,
  getLocationOrThrow,
  locationRelations,
  mapLocationSummary,
  updateManagedLocation,
} from "../location.shared.js";

function parseBooleanFilter(value) {
  if (value === undefined) return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

async function ensureLocationCanBeDisabled(manager, locationId) {
  const [
    stockCounts,
    adjustments,
    activeUsers,
    activeSuppliers,
    activeClinics,
    activeFosterHomes,
  ] = await Promise.all([
    manager.getRepository(StockCount).count({
      where: {
        location: { ubicacion_id: Number(locationId) },
      },
    }),
    manager.getRepository(InventoryAdjustment).count({
      where: {
        location: { ubicacion_id: Number(locationId) },
      },
    }),
    manager.getRepository(User).count({
      where: {
        activo: true,
        location: { ubicacion_id: Number(locationId) },
      },
    }),
    manager.getRepository(Supplier).count({
      where: {
        activo: true,
        location: { ubicacion_id: Number(locationId) },
      },
    }),
    manager.getRepository(VetClinic).count({
      where: {
        activo: true,
        location: { ubicacion_id: Number(locationId) },
      },
    }),
    manager
      .getRepository("FosterHomeMember")
      .createQueryBuilder("member")
      .innerJoin("member.foster_home", "home")
      .innerJoin("member.user", "user")
      .innerJoin("user.location", "location")
      .where("member.activo = true")
      .andWhere("home.activo = true")
      .andWhere("location.ubicacion_id = :locationId", { locationId: Number(locationId) })
      .getCount(),
  ]);

  const positiveExistenceCount = await manager
    .getRepository(InventoryExistence)
    .createQueryBuilder("existence")
    .innerJoin("existence.location", "location")
    .where("location.ubicacion_id = :locationId", { locationId: Number(locationId) })
    .andWhere("CAST(existence.cantidad_actual AS numeric) > 0")
    .getCount();

  if (
    positiveExistenceCount > 0
    || stockCounts > 0
    || adjustments > 0
    || activeUsers > 0
    || activeSuppliers > 0
    || activeClinics > 0
    || activeFosterHomes > 0
  ) {
    throw new Error(
      "No se puede desactivar la ubicacion porque esta siendo utilizada por registros activos del sistema.",
    );
  }
}

export async function createLocationService(body) {
  try {
    const location = await AppDataSource.transaction(async (manager) => {
      const createdLocation = await createManagedLocation(manager, body);
      return getLocationOrThrow(manager, createdLocation.ubicacion_id);
    });

    return [mapLocationSummary(location), null];
  } catch (error) {
    console.error("Error al crear ubicacion:", error);
    return [null, error.message || "Error interno al crear ubicacion"];
  }
}

export async function getLocationService(query) {
  try {
    const locationRepository = AppDataSource.getRepository(Location);
    const locationFound = await locationRepository.findOne({
      where: { ubicacion_id: Number(query.ubicacion_id) },
      relations: locationRelations,
    });

    if (!locationFound) return [null, "Ubicacion no encontrada"];

    return [mapLocationSummary(locationFound), null];
  } catch (error) {
    console.error("Error al obtener ubicacion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getLocationsService(query = {}) {
  try {
    const locationRepository = AppDataSource.getRepository(Location);
    const where = {};

    if (query.tipo) {
      where.tipo = query.tipo;
    }

    if (query.region_id) {
      where.region = { id_region: Number(query.region_id) };
    }

    if (query.comuna_id) {
      where.comuna = { id_comuna: Number(query.comuna_id) };
    }

    const active = parseBooleanFilter(query.activo);
    if (active !== undefined) {
      where.activo = active;
    }

    const locations = await locationRepository.find({
      where,
      relations: locationRelations,
      order: {
        nombre_ubicacion: "ASC",
      },
    });

    if (!locations || locations.length === 0) return [null, "No hay ubicaciones"];

    return [locations.map(mapLocationSummary), null];
  } catch (error) {
    console.error("Error al obtener ubicaciones:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateLocationService(query, body) {
  try {
    const location = await AppDataSource.transaction(async (manager) => {
      if (body.activo === false) {
        await ensureLocationCanBeDisabled(manager, query.ubicacion_id);
      }

      return updateManagedLocation(manager, query.ubicacion_id, body);
    });

    return [mapLocationSummary(location), null];
  } catch (error) {
    console.error("Error al modificar ubicacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteLocationService(query) {
  try {
    const location = await AppDataSource.transaction(async (manager) => {
      await ensureLocationCanBeDisabled(manager, query.ubicacion_id);
      return updateManagedLocation(manager, query.ubicacion_id, {
        activo: false,
      });
    });

    return [mapLocationSummary(location), null];
  } catch (error) {
    console.error("Error al desactivar ubicacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
