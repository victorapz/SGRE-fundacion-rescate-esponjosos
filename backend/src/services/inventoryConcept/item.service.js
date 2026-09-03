"use strict";

import Item from "../../entities/inventoryConcept/item.entity.js";
import { AppDataSource } from "../../config/configDb.js";

export async function createItemService(body) {
  try {
    const {
      nombre,
      descripcion,
      stock_minimo,
      activo,
      categoria_item_id,
      unidad_medida_id,
    } = body;

    const itemRepository = AppDataSource.getRepository(Item);

    const newItem = itemRepository.create({
      nombre,
      descripcion: descripcion || null,
      stock_minimo: stock_minimo ?? null,
      activo: activo !== undefined ? Boolean(activo) : true,
      categoria: { categoria_item_id: Number(categoria_item_id) },
      unidad_medida: { unidad_medida_id: Number(unidad_medida_id) },
    });

    const savedItem = await itemRepository.save(newItem);

    return [savedItem, null];
  } catch (error) {
    console.error("Error al crear ítem:", error);
    return [null, "Error interno al crear ítem"];
  }
}

export async function getItemService(query) {
  try {
    const { item_id } = query;

    const itemRepository = AppDataSource.getRepository(Item);

    const itemFound = await itemRepository.findOne({
      where: { item_id: Number(item_id) },
      relations: {
        categoria: true,
        unidad_medida: true,
      },
    });

    if (!itemFound) return [null, "Ítem no encontrado"];

    return [itemFound, null];
  } catch (error) {
    console.error("Error al obtener ítem:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getItemsService() {
  try {
    const itemRepository = AppDataSource.getRepository(Item);

    const items = await itemRepository.find({
      relations: {
        categoria: true,
        unidad_medida: true,
      },
    });

    if (!items || items.length === 0) return [null, "No hay ítems"];

    return [items, null];
  } catch (error) {
    console.error("Error al obtener ítems:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateItemService(query, body) {
  try {
    const { item_id } = query;

    const itemRepository = AppDataSource.getRepository(Item);

    const itemFound = await itemRepository.findOne({
      where: { item_id: Number(item_id) },
    });

    if (!itemFound) return [null, "Ítem no encontrado"];

    if (body.nombre !== undefined) itemFound.nombre = body.nombre;

    if (body.descripcion !== undefined) itemFound.descripcion = body.descripcion;

    if (body.stock_minimo !== undefined) itemFound.stock_minimo = body.stock_minimo;

    if (body.activo !== undefined) itemFound.activo = body.activo;

    if (body.categoria_item_id !== undefined) {
      itemFound.categoria = { categoria_item_id: Number(body.categoria_item_id) };
    }

    if (body.unidad_medida_id !== undefined) {
      itemFound.unidad_medida = { unidad_medida_id: Number(body.unidad_medida_id) };
    }

    await itemRepository.save(itemFound);

    const updatedItem = await itemRepository.findOne({
      where: { item_id: itemFound.item_id },
      relations: {
        categoria: true,
        unidad_medida: true,
      },
    });

    return [updatedItem, null];
  } catch (error) {
    console.error("Error al modificar ítem:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteItemService(query) {
  try {
    const { item_id } = query;

    const itemRepository = AppDataSource.getRepository(Item);

    const itemFound = await itemRepository.findOne({
      where: { item_id: Number(item_id) },
    });

    if (!itemFound) return [null, "Ítem no encontrado"];

    itemFound.activo = false;
    const itemDeleted = await itemRepository.save(itemFound);

    return [itemDeleted, null];
  } catch (error) {
    console.error("Error al eliminar ítem:", error);
    return [null, "Error interno del servidor"];
  }
}
