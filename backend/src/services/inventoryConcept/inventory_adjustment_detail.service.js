"use strict";

import { AppDataSource } from "../../config/configDb.js";
import InventoryAdjustmentDetail from "../../entities/inventoryConcept/inventory_adjustment_detail.entity.js";
import { getItemOrThrow, toNumericNumber } from "./inventory.shared.js";

function mapAdjustmentDetail(detail) {
  if (!detail) return null;

  return {
    ajuste_detalle_id: detail.ajuste_detalle_id,
    cantidad_antes: toNumericNumber(detail.cantidad_antes),
    cantidad_contada: toNumericNumber(detail.cantidad_contada),
    diferencia: toNumericNumber(detail.diferencia),
    tipo_ajuste: detail.tipo_ajuste || "",
    item: detail.item
      ? {
          item_id: detail.item.item_id,
          nombre: detail.item.nombre || "",
        }
      : null,
    existencia_id: detail.existence?.existencia_id || null,
    inventory_adjustment_id: detail.inventory_adjustment?.ajuste_inventario_id || null,
  };
}

async function ensureAdjustmentEditable(manager, adjustmentId) {
  const adjustment = await manager.getRepository("InventoryAdjustment").findOne({
    where: { ajuste_inventario_id: Number(adjustmentId) },
  });

  if (!adjustment) {
    throw new Error("Ajuste de inventario no encontrado.");
  }

  if (adjustment.estado !== "PENDIENTE") {
    throw new Error("Solo se pueden modificar detalles de ajustes pendientes.");
  }
}

export async function createInventoryAdjustmentDetailService(body) {
  try {
    const detail = await AppDataSource.transaction(async (manager) => {
      await ensureAdjustmentEditable(manager, body.inventory_adjustment_id);
      await getItemOrThrow(manager, body.item_id, { requireActive: true });

      const repository = manager.getRepository(InventoryAdjustmentDetail);
      const createdDetail = await repository.save(
        repository.create({
          cantidad_antes: body.cantidad_antes,
          cantidad_contada: body.cantidad_contada,
          diferencia: body.diferencia,
          tipo_ajuste: body.tipo_ajuste,
          item: { item_id: Number(body.item_id) },
          existence: body.existencia_id
            ? { existencia_id: Number(body.existencia_id) }
            : null,
          inventory_adjustment: {
            ajuste_inventario_id: Number(body.inventory_adjustment_id),
          },
        }),
      );

      return repository.findOne({
        where: { ajuste_detalle_id: Number(createdDetail.ajuste_detalle_id) },
        relations: {
          item: true,
          existence: true,
          inventory_adjustment: true,
        },
      });
    });

    return [mapAdjustmentDetail(detail), null];
  } catch (error) {
    console.error("Error al crear detalle de ajuste:", error);
    return [null, error.message || "Error interno al crear detalle de ajuste"];
  }
}

export async function getInventoryAdjustmentDetailService(query) {
  try {
    const repository = AppDataSource.getRepository(InventoryAdjustmentDetail);
    const detail = await repository.findOne({
      where: { ajuste_detalle_id: Number(query.ajuste_detalle_id) },
      relations: {
        item: true,
        existence: true,
        inventory_adjustment: true,
      },
    });

    if (!detail) return [null, "Detalle de ajuste no encontrado"];

    return [mapAdjustmentDetail(detail), null];
  } catch (error) {
    console.error("Error al obtener detalle de ajuste:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getInventoryAdjustmentDetailsService() {
  try {
    const repository = AppDataSource.getRepository(InventoryAdjustmentDetail);
    const details = await repository.find({
      relations: {
        item: true,
        existence: true,
        inventory_adjustment: true,
      },
      order: {
        ajuste_detalle_id: "DESC",
      },
    });

    if (!details || details.length === 0) return [null, "No hay detalles de ajustes"];

    return [details.map(mapAdjustmentDetail), null];
  } catch (error) {
    console.error("Error al obtener detalles de ajustes:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateInventoryAdjustmentDetailService(query, body) {
  try {
    const detail = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(InventoryAdjustmentDetail);
      const found = await repository.findOne({
        where: { ajuste_detalle_id: Number(query.ajuste_detalle_id) },
        relations: {
          inventory_adjustment: true,
        },
      });

      if (!found) {
        throw new Error("Detalle de ajuste no encontrado");
      }

      await ensureAdjustmentEditable(
        manager,
        found.inventory_adjustment?.ajuste_inventario_id,
      );

      if (body.item_id !== undefined) {
        await getItemOrThrow(manager, body.item_id, { requireActive: true });
        found.item = { item_id: Number(body.item_id) };
      }
      if (body.cantidad_antes !== undefined) found.cantidad_antes = body.cantidad_antes;
      if (body.cantidad_contada !== undefined) found.cantidad_contada = body.cantidad_contada;
      if (body.diferencia !== undefined) found.diferencia = body.diferencia;
      if (body.tipo_ajuste !== undefined) found.tipo_ajuste = body.tipo_ajuste;
      if (body.existencia_id !== undefined) {
        found.existence = body.existencia_id
          ? { existencia_id: Number(body.existencia_id) }
          : null;
      }
      if (body.inventory_adjustment_id !== undefined) {
        await ensureAdjustmentEditable(manager, body.inventory_adjustment_id);
        found.inventory_adjustment = {
          ajuste_inventario_id: Number(body.inventory_adjustment_id),
        };
      }

      await repository.save(found);
      return repository.findOne({
        where: { ajuste_detalle_id: Number(found.ajuste_detalle_id) },
        relations: {
          item: true,
          existence: true,
          inventory_adjustment: true,
        },
      });
    });

    return [mapAdjustmentDetail(detail), null];
  } catch (error) {
    console.error("Error al actualizar detalle de ajuste:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteInventoryAdjustmentDetailService(query) {
  try {
    const detail = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(InventoryAdjustmentDetail);
      const found = await repository.findOne({
        where: { ajuste_detalle_id: Number(query.ajuste_detalle_id) },
        relations: {
          inventory_adjustment: true,
        },
      });

      if (!found) {
        throw new Error("Detalle de ajuste no encontrado");
      }

      await ensureAdjustmentEditable(
        manager,
        found.inventory_adjustment?.ajuste_inventario_id,
      );
      return repository.remove(found);
    });

    return [detail, null];
  } catch (error) {
    console.error("Error al eliminar detalle de ajuste:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
