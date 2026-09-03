"use strict";

import { AppDataSource } from "../../config/configDb.js";
import Supplier from "../../entities/inventoryConcept/supplier.entity.js";
import {
  createManagedLocation,
  locationRelations,
  mapLocationSummary,
  normalizeNullableString,
  updateManagedLocation,
} from "../location.shared.js";

function mapSupplier(supplier) {
  if (!supplier) return null;

  return {
    proveedor_id: supplier.proveedor_id,
    nombre: supplier.nombre || "",
    telefono: supplier.telefono || null,
    email: supplier.email || null,
    observaciones: supplier.observaciones || null,
    activo: Boolean(supplier.activo),
    location: mapLocationSummary(supplier.location),
    createdAt: supplier.createdAt || null,
    updatedAt: supplier.updatedAt || null,
  };
}

async function getSupplierWithRelations(repository, supplierId) {
  return repository.findOne({
    where: { proveedor_id: Number(supplierId) },
    relations: {
      location: locationRelations,
    },
  });
}

export async function createSupplierService(body) {
  try {
    const supplier = await AppDataSource.transaction(async (manager) => {
      const supplierRepository = manager.getRepository(Supplier);
      const location = body.location
        ? await createManagedLocation(manager, {
            ...body.location,
            tipo: "PROVEEDOR",
            nombre_ubicacion: body.nombre.trim(),
          })
        : null;

      const newSupplier = supplierRepository.create({
        nombre: body.nombre.trim(),
        telefono: normalizeNullableString(body.telefono),
        email: normalizeNullableString(body.email),
        observaciones: normalizeNullableString(body.observaciones),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        location: location ? { ubicacion_id: Number(location.ubicacion_id) } : null,
      });

      const savedSupplier = await supplierRepository.save(newSupplier);
      return getSupplierWithRelations(supplierRepository, savedSupplier.proveedor_id);
    });

    return [mapSupplier(supplier), null];
  } catch (error) {
    console.error("Error al crear proveedor:", error);
    return [null, error.message || "Error interno al crear proveedor"];
  }
}

export async function getSupplierService(query) {
  try {
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier = await getSupplierWithRelations(
      supplierRepository,
      query.proveedor_id,
    );

    if (!supplier) return [null, "Proveedor no encontrado"];

    return [mapSupplier(supplier), null];
  } catch (error) {
    console.error("Error al obtener proveedor:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getSuppliersService() {
  try {
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const suppliers = await supplierRepository.find({
      relations: {
        location: locationRelations,
      },
      order: {
        nombre: "ASC",
      },
    });

    if (!suppliers || suppliers.length === 0) return [null, "No hay proveedores"];

    return [suppliers.map(mapSupplier), null];
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateSupplierService(query, body) {
  try {
    const supplier = await AppDataSource.transaction(async (manager) => {
      const supplierRepository = manager.getRepository(Supplier);
      const supplierFound = await supplierRepository.findOne({
        where: { proveedor_id: Number(query.proveedor_id) },
        relations: {
          location: locationRelations,
        },
      });

      if (!supplierFound) {
        throw new Error("Proveedor no encontrado");
      }

      if (body.nombre !== undefined) supplierFound.nombre = body.nombre.trim();
      if (body.telefono !== undefined) {
        supplierFound.telefono = normalizeNullableString(body.telefono);
      }
      if (body.email !== undefined) {
        supplierFound.email = normalizeNullableString(body.email);
      }
      if (body.observaciones !== undefined) {
        supplierFound.observaciones = normalizeNullableString(body.observaciones);
      }
      if (body.activo !== undefined) supplierFound.activo = Boolean(body.activo);

      await supplierRepository.save(supplierFound);

      if (body.location === null) {
        if (supplierFound.location?.ubicacion_id) {
          await updateManagedLocation(manager, supplierFound.location?.ubicacion_id, {
            tipo: "PROVEEDOR",
            nombre_ubicacion: supplierFound.nombre,
            activo: false,
          });
          supplierFound.location = null;
          await supplierRepository.save(supplierFound);
        }
      } else if (body.location) {
        if (supplierFound.location?.ubicacion_id) {
          await updateManagedLocation(manager, supplierFound.location?.ubicacion_id, {
            ...body.location,
            tipo: "PROVEEDOR",
            nombre_ubicacion: supplierFound.nombre,
            activo: supplierFound.activo,
          });
        } else {
          const createdLocation = await createManagedLocation(manager, {
            ...body.location,
            tipo: "PROVEEDOR",
            nombre_ubicacion: supplierFound.nombre,
            activo: supplierFound.activo,
          });
          supplierFound.location = { ubicacion_id: Number(createdLocation.ubicacion_id) };
          await supplierRepository.save(supplierFound);
        }
      }

      return getSupplierWithRelations(supplierRepository, supplierFound.proveedor_id);
    });

    return [mapSupplier(supplier), null];
  } catch (error) {
    console.error("Error al actualizar proveedor:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteSupplierService(query) {
  try {
    const supplier = await AppDataSource.transaction(async (manager) => {
      const supplierRepository = manager.getRepository(Supplier);
      const supplierFound = await supplierRepository.findOne({
        where: { proveedor_id: Number(query.proveedor_id) },
        relations: {
          location: locationRelations,
        },
      });

      if (!supplierFound) {
        throw new Error("Proveedor no encontrado");
      }

      supplierFound.activo = false;
      await supplierRepository.save(supplierFound);

      if (supplierFound.location?.ubicacion_id) {
        await updateManagedLocation(manager, supplierFound.location?.ubicacion_id, {
          tipo: "PROVEEDOR",
          nombre_ubicacion: supplierFound.nombre,
          activo: false,
        });
      }

      return getSupplierWithRelations(supplierRepository, supplierFound.proveedor_id);
    });

    return [mapSupplier(supplier), null];
  } catch (error) {
    console.error("Error al desactivar proveedor:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
