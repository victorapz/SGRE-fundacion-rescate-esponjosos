"use strict";

import { AppDataSource } from "../../config/configDb.js";
import StockCountDetail from "../../entities/inventoryConcept/stock_count_detail.entity.js";
import { getItemOrThrow, mapStockCount, resolveReadScope, toNumericNumber } from "./inventory.shared.js";

async function ensureStockCountEditable(manager, stockCountId) {
  const linkedAdjustment = await manager.getRepository("InventoryAdjustment").findOne({
    where: {
      stock_count: { conteo_fisico_id: Number(stockCountId) },
    },
  });

  if (linkedAdjustment) {
    throw new Error(
      "No se puede modificar un detalle de conteo asociado a un ajuste de inventario.",
    );
  }
}

function mapStockCountDetail(detail) {
  if (!detail) return null;

  return {
    conteo_detalle_id: detail.conteo_detalle_id,
    cantidad_contada: toNumericNumber(detail.cantidad_contada),
    observaciones: detail.observaciones || null,
    stock_count_id: detail.stock_count?.conteo_fisico_id || null,
    item: detail.item
      ? {
          item_id: detail.item.item_id,
          nombre: detail.item.nombre || "",
        }
      : null,
    existencia_id: detail.existence?.existencia_id || null,
  };
}

export async function createStockCountDetailService(body) {
  try {
    const detail = await AppDataSource.transaction(async (manager) => {
      await ensureStockCountEditable(manager, body.stock_count_id);
      await getItemOrThrow(manager, body.item_id, { requireActive: true });

      const repository = manager.getRepository(StockCountDetail);
      const createdDetail = await repository.save(
        repository.create({
          cantidad_contada: body.cantidad_contada,
          observaciones: body.observaciones || null,
          stock_count: { conteo_fisico_id: Number(body.stock_count_id) },
          item: { item_id: Number(body.item_id) },
          existence: body.existencia_id
            ? { existencia_id: Number(body.existencia_id) }
            : null,
        }),
      );

      return repository.findOne({
        where: { conteo_detalle_id: Number(createdDetail.conteo_detalle_id) },
        relations: {
          stock_count: true,
          item: true,
          existence: true,
        },
      });
    });

    return [mapStockCountDetail(detail), null];
  } catch (error) {
    console.error("Error al crear detalle de conteo:", error);
    return [null, error.message || "Error interno al crear detalle de conteo"];
  }
}

export async function getStockCountDetailService(query) {
  try {
    const repository = AppDataSource.getRepository(StockCountDetail);
    const detail = await repository.findOne({
      where: { conteo_detalle_id: Number(query.conteo_detalle_id) },
      relations: {
        stock_count: true,
        item: true,
        existence: true,
      },
    });

    if (!detail) return [null, "Detalle de conteo no encontrado"];

    return [mapStockCountDetail(detail), null];
  } catch (error) {
    console.error("Error al obtener detalle de conteo:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getStockCountDetailsService() {
  try {
    const repository = AppDataSource.getRepository(StockCountDetail);
    const details = await repository.find({
      relations: {
        stock_count: true,
        item: true,
        existence: true,
      },
      order: {
        conteo_detalle_id: "DESC",
      },
    });

    if (!details || details.length === 0) return [null, "No hay detalles de conteo"];

    return [details.map(mapStockCountDetail), null];
  } catch (error) {
    console.error("Error al obtener detalles de conteo:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateStockCountDetailService(query, body) {
  try {
    const detail = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(StockCountDetail);
      const found = await repository.findOne({
        where: { conteo_detalle_id: Number(query.conteo_detalle_id) },
        relations: {
          stock_count: true,
        },
      });

      if (!found) {
        throw new Error("Detalle de conteo no encontrado");
      }

      await ensureStockCountEditable(manager, found.stock_count?.conteo_fisico_id);

      if (body.item_id !== undefined) {
        await getItemOrThrow(manager, body.item_id, { requireActive: true });
        found.item = { item_id: Number(body.item_id) };
      }
      if (body.cantidad_contada !== undefined) found.cantidad_contada = body.cantidad_contada;
      if (body.observaciones !== undefined) found.observaciones = body.observaciones || null;
      if (body.stock_count_id !== undefined) {
        found.stock_count = { conteo_fisico_id: Number(body.stock_count_id) };
      }
      if (body.existencia_id !== undefined) {
        found.existence = body.existencia_id
          ? { existencia_id: Number(body.existencia_id) }
          : null;
      }

      await repository.save(found);
      return repository.findOne({
        where: { conteo_detalle_id: Number(found.conteo_detalle_id) },
        relations: {
          stock_count: true,
          item: true,
          existence: true,
        },
      });
    });

    return [mapStockCountDetail(detail), null];
  } catch (error) {
    console.error("Error al actualizar detalle de conteo:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteStockCountDetailService(query) {
  try {
    const detail = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(StockCountDetail);
      const found = await repository.findOne({
        where: { conteo_detalle_id: Number(query.conteo_detalle_id) },
        relations: {
          stock_count: true,
        },
      });

      if (!found) {
        throw new Error("Detalle de conteo no encontrado");
      }

      await ensureStockCountEditable(manager, found.stock_count?.conteo_fisico_id);
      return repository.remove(found);
    });

    return [detail, null];
  } catch (error) {
    console.error("Error al eliminar detalle de conteo:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
