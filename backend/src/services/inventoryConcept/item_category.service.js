"use strict";

import ItemCategory from "../../entities/inventoryConcept/item_category.entity.js";
import Item from "../../entities/inventoryConcept/item.entity.js";
import { AppDataSource } from "../../config/configDb.js";

export async function createItemCategoryService(body) {
  try {
    const { nombre_categoria } = body;

    const itemCategoryRepository = AppDataSource.getRepository(ItemCategory);

    const newItemCategory = itemCategoryRepository.create({
      nombre_categoria,
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
    });

    const savedItemCategory = await itemCategoryRepository.save(newItemCategory);

    return [savedItemCategory, null];
  } catch (error) {
    console.error("Error al crear categoria:", error);
    return [null, "Error interno al crear categoria"];
  }
}

export async function getItemCategoryService(query) {
  try {
    const { categoria_item_id } = query;

    const itemCategoryRepository = AppDataSource.getRepository(ItemCategory);

    const itemCategoryFound = await itemCategoryRepository.findOne({
      where: { categoria_item_id: Number(categoria_item_id) },
    });

    if (!itemCategoryFound) return [null, "Categoria no encontrada"];

    return [itemCategoryFound, null];
  } catch (error) {
    console.error("Error al obtener categoria:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getItemCategoriesService() {
  try {
    const itemCategoryRepository = AppDataSource.getRepository(ItemCategory);

    const itemCategories = await itemCategoryRepository.find({
      order: {
        nombre_categoria: "ASC",
      },
    });

    if (!itemCategories || itemCategories.length === 0)
      return [null, "No hay categorias"];

    return [itemCategories, null];
  } catch (error) {
    console.error("Error al obtener categorias:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateItemCategoryService(query, body) {
  try {
    const { categoria_item_id } = query;

    const itemCategoryRepository = AppDataSource.getRepository(ItemCategory);

    const itemCategoryFound = await itemCategoryRepository.findOne({
      where: { categoria_item_id: Number(categoria_item_id) },
    });

    if (!itemCategoryFound) return [null, "Categoria no encontrada"];

    if (body.nombre_categoria !== undefined)
      itemCategoryFound.nombre_categoria = body.nombre_categoria;
    if (body.activo !== undefined) itemCategoryFound.activo = Boolean(body.activo);

    await itemCategoryRepository.save(itemCategoryFound);

    const updatedItemCategory = await itemCategoryRepository.findOne({
      where: { categoria_item_id: itemCategoryFound.categoria_item_id },
    });

    return [updatedItemCategory, null];
  } catch (error) {
    console.error("Error al modificar categoria:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteItemCategoryService(query) {
  try {
    const { categoria_item_id } = query;

    const itemCategoryRepository = AppDataSource.getRepository(ItemCategory);

    const itemCategoryFound = await itemCategoryRepository.findOne({
      where: { categoria_item_id: Number(categoria_item_id) },
    });

    if (!itemCategoryFound) return [null, "Categoria no encontrada"];

    const itemRepository = AppDataSource.getRepository(Item);
    const hasItems = await itemRepository.count({
      where: {
        categoria: { categoria_item_id: Number(categoria_item_id) },
      },
    });

    if (hasItems > 0) {
      itemCategoryFound.activo = false;
      const itemCategoryDeleted = await itemCategoryRepository.save(itemCategoryFound);
      return [itemCategoryDeleted, null];
    }

    const itemCategoryDeleted = await itemCategoryRepository.remove(itemCategoryFound);

    return [itemCategoryDeleted, null];
  } catch (error) {
    console.error("Error al eliminar categoria:", error);
    return [null, "Error interno del servidor"];
  }
}
