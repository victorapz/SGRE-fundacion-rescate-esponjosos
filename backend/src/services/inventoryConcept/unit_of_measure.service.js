"use strict";

import UnitOfMeasure from "../../entities/inventoryConcept/unit_of_measure.entity.js";
import Item from "../../entities/inventoryConcept/item.entity.js";
import { AppDataSource } from "../../config/configDb.js";

export async function createUnitOfMeasureService(body) {
  try {
    const { nombre, descripcion } = body;

    const unitOfMeasureRepository = AppDataSource.getRepository(UnitOfMeasure);

    const newUnitOfMeasure = unitOfMeasureRepository.create({
      nombre,
      descripcion,
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
    });

    const savedUnitOfMeasure = await unitOfMeasureRepository.save(newUnitOfMeasure);

    return [savedUnitOfMeasure, null];
  } catch (error) {
    console.error("Error al crear unidad de medida:", error);
    return [null, "Error interno al crear unidad de medida"];
  }
}

export async function getUnitOfMeasureService(query) {
  try {
    const { unidad_medida_id } = query;

    const unitOfMeasureRepository = AppDataSource.getRepository(UnitOfMeasure);

    const unitOfMeasureFound = await unitOfMeasureRepository.findOne({
      where: { unidad_medida_id: Number(unidad_medida_id) },
    });

    if (!unitOfMeasureFound) return [null, "Unidad de medida no encontrada"];

    return [unitOfMeasureFound, null];
  } catch (error) {
    console.error("Error al obtener unidad de medida:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getUnitsOfMeasureService() {
  try {
    const unitOfMeasureRepository = AppDataSource.getRepository(UnitOfMeasure);

    const unitsOfMeasure = await unitOfMeasureRepository.find({
      order: {
        nombre: "ASC",
      },
    });

    if (!unitsOfMeasure || unitsOfMeasure.length === 0)
      return [null, "No hay unidades de medida"];

    return [unitsOfMeasure, null];
  } catch (error) {
    console.error("Error al obtener unidades de medida:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateUnitOfMeasureService(query, body) {
  try {
    const { unidad_medida_id } = query;

    const unitOfMeasureRepository = AppDataSource.getRepository(UnitOfMeasure);

    const unitOfMeasureFound = await unitOfMeasureRepository.findOne({
      where: { unidad_medida_id: Number(unidad_medida_id) },
    });

    if (!unitOfMeasureFound) return [null, "Unidad de medida no encontrada"];

    if (body.nombre !== undefined) unitOfMeasureFound.nombre = body.nombre;

    if (body.descripcion !== undefined)
      unitOfMeasureFound.descripcion = body.descripcion;
    if (body.activo !== undefined) unitOfMeasureFound.activo = Boolean(body.activo);

    await unitOfMeasureRepository.save(unitOfMeasureFound);

    const updatedUnitOfMeasure = await unitOfMeasureRepository.findOne({
      where: { unidad_medida_id: unitOfMeasureFound.unidad_medida_id },
    });

    return [updatedUnitOfMeasure, null];
  } catch (error) {
    console.error("Error al modificar unidad de medida:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteUnitOfMeasureService(query) {
  try {
    const { unidad_medida_id } = query;

    const unitOfMeasureRepository = AppDataSource.getRepository(UnitOfMeasure);

    const unitOfMeasureFound = await unitOfMeasureRepository.findOne({
      where: { unidad_medida_id: Number(unidad_medida_id) },
    });

    if (!unitOfMeasureFound) return [null, "Unidad de medida no encontrada"];

    const itemRepository = AppDataSource.getRepository(Item);
    const hasItems = await itemRepository.count({
      where: {
        unidad_medida: { unidad_medida_id: Number(unidad_medida_id) },
      },
    });

    if (hasItems > 0) {
      unitOfMeasureFound.activo = false;
      const unitOfMeasureDeleted = await unitOfMeasureRepository.save(
        unitOfMeasureFound,
      );
      return [unitOfMeasureDeleted, null];
    }

    const unitOfMeasureDeleted = await unitOfMeasureRepository.remove(unitOfMeasureFound);

    return [unitOfMeasureDeleted, null];
  } catch (error) {
    console.error("Error al eliminar unidad de medida:", error);
    return [null, "Error interno del servidor"];
  }
}
