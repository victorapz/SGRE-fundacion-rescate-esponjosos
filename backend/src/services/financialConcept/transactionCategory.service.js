"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  TransactionCategory,
  buildPagedResult,
  buildPagination,
  mapTransactionCategory,
  normalizeCode,
  normalizeNullableString,
} from "./accounting.shared.js";

async function getCategoryWithRelations(repository, categoryId) {
  return repository.findOne({
    where: { categoria_transaccion_id: Number(categoryId) },
    relations: {
      categoria_padre: true,
      subcategorias: true,
    },
  });
}

export async function createTransactionCategoryService(body) {
  try {
    const category = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TransactionCategory);
      const clave = normalizeCode(body.clave);

      const existingCategory = await repository.findOne({
        where: { clave },
      });

      if (existingCategory) {
        throw new Error("Ya existe una categoria de transaccion con esa clave.");
      }

      let parent = null;
      if (body.categoria_padre_id) {
        parent = await repository.findOne({
          where: { categoria_transaccion_id: Number(body.categoria_padre_id) },
        });

        if (!parent) {
          throw new Error("La categoria padre indicada no existe.");
        }
      }

      const newCategory = repository.create({
        clave,
        nombre: body.nombre.trim(),
        tipo: body.tipo,
        descripcion: normalizeNullableString(body.descripcion),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        es_sistema: body.es_sistema !== undefined ? Boolean(body.es_sistema) : false,
        categoria_padre: parent
          ? { categoria_transaccion_id: Number(parent.categoria_transaccion_id) }
          : null,
      });

      const savedCategory = await repository.save(newCategory);
      return getCategoryWithRelations(repository, savedCategory.categoria_transaccion_id);
    });

    return [mapTransactionCategory(category), null];
  } catch (error) {
    console.error("Error al crear categoria de transaccion:", error);
    return [null, error.message || "Error interno al crear categoria de transaccion"];
  }
}

export async function getTransactionCategoryService(query) {
  try {
    const repository = AppDataSource.getRepository(TransactionCategory);
    const category = await getCategoryWithRelations(repository, query.categoria_transaccion_id);

    if (!category) return [null, "Categoria de transaccion no encontrada"];

    return [mapTransactionCategory(category), null];
  } catch (error) {
    console.error("Error al obtener categoria de transaccion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getTransactionCategoriesService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(TransactionCategory);
    const { page, limit, skip } = buildPagination(query);
    const qb = repository
      .createQueryBuilder("category")
      .leftJoinAndSelect("category.categoria_padre", "parent")
      .orderBy("category.nombre", "ASC")
      .addOrderBy("category.categoria_transaccion_id", "ASC")
      .skip(skip)
      .take(limit);

    if (query.tipo) {
      qb.andWhere("category.tipo = :tipo", { tipo: query.tipo });
    }

    if (query.activo !== undefined) {
      qb.andWhere("category.activo = :activo", {
        activo: query.activo === true || query.activo === "true",
      });
    }

    if (query.es_sistema !== undefined) {
      qb.andWhere("category.es_sistema = :es_sistema", {
        es_sistema: query.es_sistema === true || query.es_sistema === "true",
      });
    }

    if (query.categoria_padre_id) {
      qb.andWhere("parent.categoria_transaccion_id = :categoria_padre_id", {
        categoria_padre_id: Number(query.categoria_padre_id),
      });
    }

    if (query.search) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where("category.clave ILIKE :search", { search })
            .orWhere("category.nombre ILIKE :search", { search })
            .orWhere("category.descripcion ILIKE :search", { search });
        }),
      );
    }

    const [categories, total] = await qb.getManyAndCount();

    return [
      buildPagedResult(categories.map(mapTransactionCategory), total, page, limit),
      null,
    ];
  } catch (error) {
    console.error("Error al obtenercategoríasde transaccion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateTransactionCategoryService(query, body) {
  try {
    const category = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TransactionCategory);
      const categoryFound = await getCategoryWithRelations(
        repository,
        query.categoria_transaccion_id,
      );

      if (!categoryFound) {
        throw new Error("Categoria de transaccion no encontrada");
      }

      if (body.clave !== undefined) {
        const clave = normalizeCode(body.clave);
        const existingCategory = await repository.findOne({ where: { clave } });

        if (
          existingCategory
          && Number(existingCategory.categoria_transaccion_id)
            !== Number(categoryFound.categoria_transaccion_id)
        ) {
          throw new Error("Ya existe una categoria de transaccion con esa clave.");
        }

        categoryFound.clave = clave;
      }

      if (body.nombre !== undefined) categoryFound.nombre = body.nombre.trim();
      if (body.tipo !== undefined) categoryFound.tipo = body.tipo;
      if (body.descripcion !== undefined) {
        categoryFound.descripcion = normalizeNullableString(body.descripcion);
      }
      if (body.activo !== undefined) categoryFound.activo = Boolean(body.activo);
      if (body.es_sistema !== undefined) categoryFound.es_sistema = Boolean(body.es_sistema);

      if (body.categoria_padre_id !== undefined) {
        if (body.categoria_padre_id === null) {
          categoryFound.categoria_padre = null;
        } else {
          if (
            Number(body.categoria_padre_id)
            === Number(categoryFound.categoria_transaccion_id)
          ) {
            throw new Error("Una categoria no puede ser padre de si misma.");
          }

          const parentCategory = await repository.findOne({
            where: { categoria_transaccion_id: Number(body.categoria_padre_id) },
          });

          if (!parentCategory) {
            throw new Error("La categoria padre indicada no existe.");
          }

          categoryFound.categoria_padre = {
            categoria_transaccion_id: Number(parentCategory.categoria_transaccion_id),
          };
        }
      }

      await repository.save(categoryFound);
      return getCategoryWithRelations(repository, categoryFound.categoria_transaccion_id);
    });

    return [mapTransactionCategory(category), null];
  } catch (error) {
    console.error("Error al actualizar categoria de transaccion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteTransactionCategoryService(query) {
  try {
    const category = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TransactionCategory);
      const categoryFound = await getCategoryWithRelations(
        repository,
        query.categoria_transaccion_id,
      );

      if (!categoryFound) {
        throw new Error("Categoria de transaccion no encontrada");
      }

      if (categoryFound.es_sistema) {
        throw new Error("No se puede desactivar una categoria de sistema.");
      }

      categoryFound.activo = false;
      await repository.save(categoryFound);

      return getCategoryWithRelations(repository, categoryFound.categoria_transaccion_id);
    });

    return [mapTransactionCategory(category), null];
  } catch (error) {
    console.error("Error al desactivar categoria de transaccion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
