"use strict";

import {
  AppDataSource,
  InventoryAdjustment,
  InventoryAdjustmentDetail,
  createMovementRecord,
  createOrIncreaseExistence,
  findAvailableExistences,
  getItemOrThrow,
  getLocationOrThrow,
  getScopedExistenceOrThrow,
  getUserOrThrow,
  mapInventoryAdjustment,
  mapInventoryExistence,
  mapInventoryMovement,
  resolveReadScope,
  resolveAdjustmentApplyScope,
  resolveAdjustmentCreateScope,
  sumSystemQuantityForItemAtLocation,
  toNumericNumber,
  assertLocationWithinScope,
} from "./inventory.shared.js";

async function getAdjustmentWithRelations(repository, adjustmentId) {
  return repository.findOne({
    where: { ajuste_inventario_id: Number(adjustmentId) },
    relations: {
      location: {
        region: true,
        comuna: {
          region: true,
        },
      },
      performed_by: true,
      stock_count: {
        location: true,
        performed_by: true,
      },
      inventory_adjustment_detail: {
        item: {
          categoria: true,
          unidad_medida: true,
        },
        existence: {
          item: {
            categoria: true,
            unidad_medida: true,
          },
          location: {
            region: true,
            comuna: {
              region: true,
            },
          },
        },
      },
    },
  });
}

function buildDetailPayload(detail) {
  const cantidadAntes = toNumericNumber(detail.cantidad_antes);
  const cantidadContada = toNumericNumber(detail.cantidad_contada);
  const diferencia = cantidadContada - cantidadAntes;

  if (diferencia === 0) {
    return null;
  }

  return {
    item_id: Number(detail.item_id),
    existencia_id: detail.existencia_id ? Number(detail.existencia_id) : null,
    cantidad_antes: cantidadAntes,
    cantidad_contada: cantidadContada,
    diferencia,
    tipo_ajuste: diferencia > 0 ? "POSITIVO" : "NEGATIVO",
  };
}

async function decreaseAcrossLocation(manager, adjustment, detail) {
  const amountToDecrease = Math.abs(toNumericNumber(detail.diferencia));

  if (detail.existence?.existencia_id) {
    const scopedExistence = await manager.getRepository("InventoryExistence").findOne({
      where: { existencia_id: Number(detail.existence.existencia_id) },
      relations: {
        item: true,
        location: true,
      },
    });

    if (!scopedExistence) {
      throw new Error("La existencia configurada en el ajuste ya no existe.");
    }

    const currentAmount = toNumericNumber(scopedExistence.cantidad_actual);
    if (currentAmount < amountToDecrease) {
      throw new Error("No hay stock suficiente en la existencia ajustada.");
    }

    scopedExistence.cantidad_actual = currentAmount - amountToDecrease;
    scopedExistence.estado = scopedExistence.cantidad_actual > 0 ? "DISPONIBLE" : "AGOTADO";
    await manager.getRepository("InventoryExistence").save(scopedExistence);
    return [scopedExistence];
  }

  let remaining = amountToDecrease;
  const affected = [];
  const existences = await findAvailableExistences(manager, {
    itemId: detail.item.item_id,
    locationId: adjustment.location.ubicacion_id,
  });

  for (const existence of existences) {
    if (remaining <= 0) break;
    const available = toNumericNumber(existence.cantidad_actual);
    const toDecrease = Math.min(available, remaining);

    if (toDecrease <= 0) continue;

    existence.cantidad_actual = available - toDecrease;
    existence.estado = existence.cantidad_actual > 0 ? "DISPONIBLE" : "AGOTADO";
    await manager.getRepository("InventoryExistence").save(existence);
    affected.push(existence);
    remaining -= toDecrease;
  }

  if (remaining > 0) {
    throw new Error("No hay stock suficiente para aplicar el ajuste negativo.");
  }

  return affected;
}

export async function createInventoryAdjustmentService(body, authContext = {}) {
  try {
    const adjustment = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveAdjustmentCreateScope(manager, authContext);
      const location = await getLocationOrThrow(manager, body.location_id, { requireActive: true });
      assertLocationWithinScope(scope, location.ubicacion_id);

      if (body.estado && body.estado !== "PENDIENTE") {
        throw new Error("Los ajustes nuevos deben crearse en estado PENDIENTE.");
      }

      const performedById = body.performed_by_id || authContext.userId;
      await getUserOrThrow(manager, performedById);

      if (body.stock_count_id) {
        const stockCount = await manager.getRepository("StockCount").findOne({
          where: { conteo_fisico_id: Number(body.stock_count_id) },
        });
        if (!stockCount) {
          throw new Error("Conteo fisico no encontrado.");
        }
      }

      const repository = manager.getRepository(InventoryAdjustment);
      const createdAdjustment = await repository.save(
        repository.create({
          fecha_ajuste: body.fecha_ajuste,
          motivo: body.motivo,
          estado: body.estado || "PENDIENTE",
          observaciones: body.observaciones || null,
          location: { ubicacion_id: Number(location.ubicacion_id) },
          performed_by: { id_usuario: Number(performedById) },
          stock_count: body.stock_count_id
            ? { conteo_fisico_id: Number(body.stock_count_id) }
            : null,
        }),
      );

      return getAdjustmentWithRelations(repository, createdAdjustment.ajuste_inventario_id);
    });

    return [mapInventoryAdjustment(adjustment), null];
  } catch (error) {
    console.error("Error al crear ajuste de inventario:", error);
    return [null, error.message || "Error interno al crear ajuste de inventario"];
  }
}

export async function getInventoryAdjustmentService(query, authContext = {}) {
  try {
    const adjustment = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);
      const repository = manager.getRepository(InventoryAdjustment);
      const found = await getAdjustmentWithRelations(
        repository,
        query.ajuste_inventario_id,
      );

      if (!found) {
        throw new Error("Ajuste de inventario no encontrado");
      }

      assertLocationWithinScope(scope, found.location?.ubicacion_id);
      return found;
    });

    return [mapInventoryAdjustment(adjustment), null];
  } catch (error) {
    console.error("Error al obtener ajuste de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function getInventoryAdjustmentsService(authContext = {}) {
  try {
    const adjustments = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);
      const repository = manager.getRepository(InventoryAdjustment);
      const where = scope.mode === "location"
        ? { location: { ubicacion_id: Number(scope.userLocationId) } }
        : {};

      return repository.find({
        where,
        relations: {
          location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          performed_by: true,
          stock_count: true,
          inventory_adjustment_detail: true,
        },
        order: {
          fecha_ajuste: "DESC",
          ajuste_inventario_id: "DESC",
        },
      });
    });

    if (!adjustments || adjustments.length === 0) {
      return [null, "No hay ajustes de inventario"];
    }

    return [adjustments.map(mapInventoryAdjustment), null];
  } catch (error) {
    console.error("Error al obtener ajustes de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function updateInventoryAdjustmentService(query, body, authContext = {}) {
  try {
    const adjustment = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveAdjustmentCreateScope(manager, authContext);
      const repository = manager.getRepository(InventoryAdjustment);
      const found = await repository.findOne({
        where: { ajuste_inventario_id: Number(query.ajuste_inventario_id) },
        relations: {
          location: true,
        },
      });

      if (!found) {
        throw new Error("Ajuste de inventario no encontrado");
      }

      if (found.estado !== "PENDIENTE") {
        throw new Error("Solo se pueden editar ajustes pendientes.");
      }

      if (body.estado === "APLICADO") {
        throw new Error("Usa el endpoint de aplicar ajuste para cambiar el estado a APLICADO.");
      }

      assertLocationWithinScope(scope, found.location?.ubicacion_id);

      if (body.location_id !== undefined) {
        const location = await getLocationOrThrow(manager, body.location_id, { requireActive: true });
        assertLocationWithinScope(scope, location.ubicacion_id);
        found.location = { ubicacion_id: Number(body.location_id) };
      }

      const performedById = body.performed_by_id || authContext.userId;
      if (body.performed_by_id !== undefined && performedById) {
        await getUserOrThrow(manager, performedById);
        found.performed_by = { id_usuario: Number(performedById) };
      }

      if (body.fecha_ajuste !== undefined) found.fecha_ajuste = body.fecha_ajuste;
      if (body.motivo !== undefined) found.motivo = body.motivo;
      if (body.estado !== undefined) found.estado = body.estado;
      if (body.observaciones !== undefined) found.observaciones = body.observaciones || null;
      if (body.stock_count_id !== undefined) {
        found.stock_count = body.stock_count_id
          ? { conteo_fisico_id: Number(body.stock_count_id) }
          : null;
      }

      await repository.save(found);
      return getAdjustmentWithRelations(repository, found.ajuste_inventario_id);
    });

    return [mapInventoryAdjustment(adjustment), null];
  } catch (error) {
    console.error("Error al actualizar ajuste de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteInventoryAdjustmentService(query, authContext = {}) {
  try {
    const adjustment = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveAdjustmentCreateScope(manager, authContext);
      const repository = manager.getRepository(InventoryAdjustment);
      const found = await repository.findOne({
        where: { ajuste_inventario_id: Number(query.ajuste_inventario_id) },
        relations: {
          location: true,
        },
      });

      if (!found) {
        throw new Error("Ajuste de inventario no encontrado");
      }

      if (found.estado === "APLICADO") {
        throw new Error("No se puede cancelar un ajuste ya aplicado.");
      }

      assertLocationWithinScope(scope, found.location?.ubicacion_id);
      found.estado = "CANCELADO";
      await repository.save(found);
      return getAdjustmentWithRelations(repository, found.ajuste_inventario_id);
    });

    return [mapInventoryAdjustment(adjustment), null];
  } catch (error) {
    console.error("Error al cancelar ajuste de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function createAdjustmentFromStockCountService(body, authContext = {}) {
  try {
    const adjustment = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveAdjustmentCreateScope(manager, authContext);
      const stockCount = await manager.getRepository("StockCount").findOne({
        where: { conteo_fisico_id: Number(body.stock_count_id) },
        relations: {
          location: true,
          performed_by: true,
          details: {
            item: true,
            existence: {
              item: true,
              location: true,
            },
          },
        },
      });

      if (!stockCount) {
        throw new Error("Conteo fisico no encontrado.");
      }

      assertLocationWithinScope(scope, stockCount.location?.ubicacion_id);

      const existingAdjustment = await manager.getRepository(InventoryAdjustment).findOne({
        where: {
          stock_count: { conteo_fisico_id: Number(stockCount.conteo_fisico_id) },
          estado: "PENDIENTE",
        },
      });

      if (existingAdjustment) {
        throw new Error("Ya existe un ajuste pendiente para este conteo fisico.");
      }

      const performedById = body.performed_by_id || authContext.userId || stockCount.performed_by?.id_usuario;
      await getUserOrThrow(manager, performedById);

      const adjustmentRepository = manager.getRepository(InventoryAdjustment);
      const detailRepository = manager.getRepository(InventoryAdjustmentDetail);

      const adjustment = await adjustmentRepository.save(
        adjustmentRepository.create({
          fecha_ajuste: body.fecha_ajuste || new Date().toISOString().slice(0, 10),
          motivo: body.motivo,
          estado: "PENDIENTE",
          observaciones: body.observaciones || null,
          location: { ubicacion_id: Number(stockCount.location.ubicacion_id) },
          performed_by: { id_usuario: Number(performedById) },
          stock_count: { conteo_fisico_id: Number(stockCount.conteo_fisico_id) },
        }),
      );

      const detailsToSave = [];
      for (const detail of stockCount.details || []) {
        const cantidadAntes = detail.existence?.existencia_id
          ? toNumericNumber(detail.existence.cantidad_actual)
          : await sumSystemQuantityForItemAtLocation(
              manager,
              detail.item.item_id,
              stockCount.location.ubicacion_id,
            );

        const payload = buildDetailPayload({
          item_id: detail.item.item_id,
          existencia_id: detail.existence?.existencia_id || null,
          cantidad_antes: cantidadAntes,
          cantidad_contada: detail.cantidad_contada,
        });

        if (!payload) continue;

        detailsToSave.push(
          detailRepository.create({
            ...payload,
            item: { item_id: Number(payload.item_id) },
            existence: payload.existencia_id
              ? { existencia_id: Number(payload.existencia_id) }
              : null,
            inventory_adjustment: {
              ajuste_inventario_id: Number(adjustment.ajuste_inventario_id),
            },
          }),
        );
      }

      if (detailsToSave.length === 0) {
        throw new Error("El conteo fisico no presenta diferencias para generar un ajuste.");
      }

      await detailRepository.save(detailsToSave);
      return getAdjustmentWithRelations(adjustmentRepository, adjustment.ajuste_inventario_id);
    });

    return [mapInventoryAdjustment(adjustment), null];
  } catch (error) {
    console.error("Error al crear ajuste desde conteo fisico:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function createManualInventoryAdjustmentService(body, authContext = {}) {
  try {
    const adjustment = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveAdjustmentCreateScope(manager, authContext);
      const location = await getLocationOrThrow(manager, body.location_id, { requireActive: true });
      assertLocationWithinScope(scope, location.ubicacion_id);

      const performedById = body.performed_by_id || authContext.userId;
      await getUserOrThrow(manager, performedById);

      const adjustmentRepository = manager.getRepository(InventoryAdjustment);
      const detailRepository = manager.getRepository(InventoryAdjustmentDetail);

      const createdAdjustment = await adjustmentRepository.save(
        adjustmentRepository.create({
          fecha_ajuste: body.fecha_ajuste || new Date().toISOString().slice(0, 10),
          motivo: body.motivo,
          estado: "PENDIENTE",
          observaciones: body.observaciones || null,
          location: { ubicacion_id: Number(location.ubicacion_id) },
          performed_by: { id_usuario: Number(performedById) },
          stock_count: null,
        }),
      );

      const detailsToSave = [];
      for (const detail of body.detalles || []) {
        await getItemOrThrow(manager, detail.item_id, { requireActive: true });

        if (detail.existencia_id) {
          const existence = await getScopedExistenceOrThrow(manager, scope, detail.existencia_id);
          if (Number(existence.location?.ubicacion_id) !== Number(location.ubicacion_id)) {
            throw new Error(
              "La existencia indicada no pertenece a la ubicacion del ajuste.",
            );
          }
          if (Number(existence.item?.item_id) !== Number(detail.item_id)) {
            throw new Error("La existencia indicada no corresponde al item ajustado.");
          }
        }

        const payload = buildDetailPayload(detail);
        if (!payload) continue;

        detailsToSave.push(
          detailRepository.create({
            ...payload,
            item: { item_id: Number(payload.item_id) },
            existence: payload.existencia_id
              ? { existencia_id: Number(payload.existencia_id) }
              : null,
            inventory_adjustment: {
              ajuste_inventario_id: Number(createdAdjustment.ajuste_inventario_id),
            },
          }),
        );
      }

      if (detailsToSave.length === 0) {
        throw new Error("El ajuste manual no contiene diferencias para registrar.");
      }

      await detailRepository.save(detailsToSave);
      return getAdjustmentWithRelations(
        adjustmentRepository,
        createdAdjustment.ajuste_inventario_id,
      );
    });

    return [mapInventoryAdjustment(adjustment), null];
  } catch (error) {
    console.error("Error al crear ajuste manual de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function applyInventoryAdjustmentService(query, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveAdjustmentApplyScope(manager, authContext);
      const repository = manager.getRepository(InventoryAdjustment);
      const adjustment = await getAdjustmentWithRelations(
        repository,
        query.ajuste_inventario_id,
      );

      if (!adjustment) {
        throw new Error("Ajuste de inventario no encontrado.");
      }

      if (adjustment.estado !== "PENDIENTE") {
        throw new Error("Solo se pueden aplicar ajustes pendientes.");
      }

      assertLocationWithinScope(scope, adjustment.location?.ubicacion_id);

      if (!adjustment.inventory_adjustment_detail?.length) {
        throw new Error("El ajuste no tiene detalles para aplicar.");
      }

      const movements = [];
      const existences = [];

      for (const detail of adjustment.inventory_adjustment_detail) {
        const difference = toNumericNumber(detail.diferencia);

        if (difference > 0) {
          let existence;

          if (detail.existence?.existencia_id) {
            const existingRecord = await manager.getRepository("InventoryExistence").findOne({
              where: { existencia_id: Number(detail.existence.existencia_id) },
              relations: {
                item: true,
                location: true,
              },
            });

            if (!existingRecord) {
              throw new Error("La existencia configurada en el ajuste ya no existe.");
            }

            existingRecord.cantidad_actual =
              toNumericNumber(existingRecord.cantidad_actual) + difference;
            existingRecord.estado = "DISPONIBLE";
            await manager.getRepository("InventoryExistence").save(existingRecord);
            existence = await manager.getRepository("InventoryExistence").findOne({
              where: { existencia_id: Number(existingRecord.existencia_id) },
              relations: {
                item: {
                  categoria: true,
                  unidad_medida: true,
                },
                location: {
                  region: true,
                  comuna: {
                    region: true,
                  },
                },
              },
            });
          } else {
            existence = await createOrIncreaseExistence(manager, {
              item_id: detail.item.item_id,
              location_id: adjustment.location.ubicacion_id,
              cantidad_actual: difference,
              fecha_vencimiento: null,
              fecha_apertura: null,
              condicion: null,
              origen_tipo: "AJUSTE",
              origen_id: adjustment.ajuste_inventario_id,
              observaciones: adjustment.observaciones,
            });
          }

          const movement = await createMovementRecord(manager, {
            tipo_movimiento: "AJUSTE",
            cantidad: difference,
            fecha_movimiento: new Date().toISOString().slice(0, 10),
            referencia_tipo: "AJUSTE",
            referencia_id: adjustment.ajuste_inventario_id,
            observaciones: adjustment.observaciones,
            item_id: detail.item.item_id,
            source_location_id: null,
            destination_location_id: adjustment.location.ubicacion_id,
            performed_by_id: adjustment.performed_by.id_usuario,
          });

          existences.push(mapInventoryExistence(existence));
          movements.push(mapInventoryMovement(movement));
          continue;
        }

        const affectedExistences = await decreaseAcrossLocation(manager, adjustment, detail);
        const movement = await createMovementRecord(manager, {
          tipo_movimiento: "AJUSTE",
          cantidad: Math.abs(difference),
          fecha_movimiento: new Date().toISOString().slice(0, 10),
          referencia_tipo: "AJUSTE",
          referencia_id: adjustment.ajuste_inventario_id,
          observaciones: adjustment.observaciones,
          item_id: detail.item.item_id,
          source_location_id: adjustment.location.ubicacion_id,
          destination_location_id: null,
          performed_by_id: adjustment.performed_by.id_usuario,
        });

        existences.push(...affectedExistences.map(mapInventoryExistence));
        movements.push(mapInventoryMovement(movement));
      }

      adjustment.estado = "APLICADO";
      await repository.save(adjustment);

      const refreshedAdjustment = await getAdjustmentWithRelations(
        repository,
        adjustment.ajuste_inventario_id,
      );

      return {
        adjustment: mapInventoryAdjustment(refreshedAdjustment),
        movements,
        affected_existences: existences,
      };
    });

    return [result, null];
  } catch (error) {
    console.error("Error al aplicar ajuste de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
