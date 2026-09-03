"use strict";

import Comuna from "../entities/comuna.entity.js";
import Location, { LOCATION_TYPES } from "../entities/inventoryConcept/location.entity.js";
import Region from "../entities/region.entity.js";

export const locationRelations = {
  region: true,
  comuna: {
    region: true,
  },
};

export function normalizeNullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

export function buildUserLocationName({ nombre, apellido }) {
  const fullName = `${nombre || ""} ${apellido || ""}`.trim();
  return `Casa de ${fullName}`.trim();
}

async function findActiveRegion(manager, regionId) {
  const regionRepository = manager.getRepository(Region);
  return regionRepository.findOne({
    where: { id_region: Number(regionId) },
  });
}

async function findActiveComuna(manager, comunaId) {
  const comunaRepository = manager.getRepository(Comuna);
  return comunaRepository.findOne({
    where: { id_comuna: Number(comunaId), activo: true },
    relations: {
      region: true,
    },
  });
}

export async function ensureRegionAndComunaMatch(manager, regionId, comunaId) {
  const [region, comuna] = await Promise.all([
    findActiveRegion(manager, regionId),
    findActiveComuna(manager, comunaId),
  ]);

  if (!region) {
    throw new Error("La region indicada no existe.");
  }

  if (!comuna) {
    throw new Error("La comuna indicada no existe o esta inactiva.");
  }

  if (Number(comuna.region?.id_region) !== Number(region.id_region)) {
    throw new Error("La comuna seleccionada no pertenece a la region indicada.");
  }

  return { region, comuna };
}

export async function getLocationOrThrow(manager, locationId) {
  const locationRepository = manager.getRepository(Location);
  const location = await locationRepository.findOne({
    where: { ubicacion_id: Number(locationId) },
    relations: locationRelations,
  });

  if (!location) {
    throw new Error("Ubicacion no encontrada.");
  }

  return location;
}

export async function createManagedLocation(manager, payload) {
  const { region_id, comuna_id } = payload;
  const { region, comuna } = await ensureRegionAndComunaMatch(
    manager,
    region_id,
    comuna_id,
  );

  const locationRepository = manager.getRepository(Location);
  const location = locationRepository.create({
    tipo: payload.tipo,
    nombre_ubicacion: payload.nombre_ubicacion?.trim(),
    direccion: payload.direccion?.trim(),
    activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
    observaciones: normalizeNullableString(payload.observaciones),
    region: { id_region: Number(region.id_region) },
    comuna: { id_comuna: Number(comuna.id_comuna) },
  });

  return locationRepository.save(location);
}

export async function updateManagedLocation(manager, locationId, payload) {
  const locationRepository = manager.getRepository(Location);
  const location = await getLocationOrThrow(manager, locationId);

  const nextRegionId =
    payload.region_id !== undefined
      ? Number(payload.region_id)
      : Number(location.region?.id_region);
  const nextComunaId =
    payload.comuna_id !== undefined
      ? Number(payload.comuna_id)
      : Number(location.comuna?.id_comuna);

  await ensureRegionAndComunaMatch(manager, nextRegionId, nextComunaId);

  if (payload.tipo !== undefined) {
    location.tipo = payload.tipo;
  }

  if (payload.nombre_ubicacion !== undefined) {
    location.nombre_ubicacion = payload.nombre_ubicacion.trim();
  }

  if (payload.direccion !== undefined) {
    location.direccion = payload.direccion.trim();
  }

  if (payload.activo !== undefined) {
    location.activo = Boolean(payload.activo);
  }

  if (payload.observaciones !== undefined) {
    location.observaciones = normalizeNullableString(payload.observaciones);
  }

  if (
    payload.region_id !== undefined
    || Number(location.region?.id_region) !== nextRegionId
  ) {
    location.region = { id_region: nextRegionId };
  }

  if (
    payload.comuna_id !== undefined
    || Number(location.comuna?.id_comuna) !== nextComunaId
  ) {
    location.comuna = { id_comuna: nextComunaId };
  }

  await locationRepository.save(location);

  return getLocationOrThrow(manager, location.ubicacion_id);
}

export function mapLocationSummary(location) {
  if (!location) return null;

  return {
    ubicacion_id: location.ubicacion_id,
    tipo: location.tipo || "",
    nombre_ubicacion: location.nombre_ubicacion || "",
    direccion: location.direccion || "",
    activo: Boolean(location.activo),
    observaciones: location.observaciones || null,
    region: location.region
      ? {
          id_region: location.region.id_region,
          clave: location.region.clave || "",
          nombre: location.region.nombre || "",
        }
      : null,
    comuna: location.comuna
      ? {
          id_comuna: location.comuna.id_comuna,
          nombre: location.comuna.nombre || "",
          activo: Boolean(location.comuna.activo),
        }
      : null,
  };
}

export { LOCATION_TYPES };
