"use strict";

import {
  AppDataSource,
  createMovementRecord,
  createOrIncreaseExistence,
  decreaseExistence,
  findAvailableExistences,
  getDonationItemsForItem,
  getExistencesByItem,
  getItemOrThrow,
  getLocationOrThrow,
  getPurchaseDetailsForItem,
  getRecentMovementsForItem,
  getScopedExistenceOrThrow,
  mapDonationItem,
  mapInventoryExistence,
  mapInventoryItem,
  mapInventoryMovement,
  mapLocationSummary,
  mapPurchaseDetail,
  resolveInitialLoadScope,
  resolveMovementScope,
  resolveReadScope,
  toNumericNumber,
  assertLocationWithinScope,
} from "./inventory.shared.js";

function buildStockState(total, stockMinimo) {
  if (total <= 0) return "SIN_STOCK";
  if (stockMinimo !== null && stockMinimo !== undefined && total < stockMinimo) {
    return "BAJO_MINIMO";
  }
  return "OK";
}

async function distributeNegativeAdjustmentLikeDecrease(manager, itemId, locationId, quantity) {
  let remaining = toNumericNumber(quantity);
  const affected = [];
  const existences = await findAvailableExistences(manager, { itemId, locationId });

  for (const existence of existences) {
    if (remaining <= 0) break;

    const available = toNumericNumber(existence.cantidad_actual);
    const amountToDecrease = Math.min(available, remaining);

    if (amountToDecrease <= 0) continue;

    const updatedExistence = await decreaseExistence(manager, existence, amountToDecrease);
    affected.push(updatedExistence);
    remaining -= amountToDecrease;
  }

  if (remaining > 0) {
    throw new Error("No existe stock suficiente para completar la operacion.");
  }

  return affected;
}

export async function getInventorySummaryService(query = {}, authContext = {}) {
  try {
    const summary = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);
      const scopedLocationId = scope.mode === "location" ? Number(scope.userLocationId) : null;

      if (query.location_id) {
        assertLocationWithinScope(scope, query.location_id);
      }

      const itemRepository = manager.getRepository("InventoryItem");
      const items = await itemRepository.find({
        relations: {
          categoria: true,
          unidad_medida: true,
        },
        order: {
          nombre: "ASC",
        },
      });

      const rows = [];
      for (const item of items) {
        if (query.categoria_item_id && Number(item.categoria?.categoria_item_id) !== Number(query.categoria_item_id)) {
          continue;
        }

        if (query.activo !== undefined && Boolean(item.activo) !== Boolean(query.activo)) {
          continue;
        }

        const existences = await getExistencesByItem(manager, item.item_id, {
          locationId: query.location_id || scopedLocationId,
        });

        const quantityTotal = existences.reduce(
          (accumulator, existence) => accumulator + toNumericNumber(existence.cantidad_actual),
          0,
        );
        const distinctLocations = new Set(
          existences
            .filter((existence) => toNumericNumber(existence.cantidad_actual) > 0)
            .map((existence) => existence.location?.ubicacion_id),
        );

        rows.push({
          item: mapInventoryItem(item),
          cantidad_total: quantityTotal,
          numero_ubicaciones: distinctLocations.size,
          stock_minimo:
            item.stock_minimo === null || item.stock_minimo === undefined
              ? null
              : toNumericNumber(item.stock_minimo),
          estado_stock: buildStockState(
            quantityTotal,
            item.stock_minimo === null || item.stock_minimo === undefined
              ? null
              : toNumericNumber(item.stock_minimo),
          ),
          activo: Boolean(item.activo),
        });
      }

      return rows;
    });

    if (!summary || summary.length === 0) {
      return [null, "No hay datos de inventario"];
    }

    return [summary, null];
  } catch (error) {
    console.error("Error al obtener resumen de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function getItemDetailService(query, authContext = {}) {
  try {
    const detail = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveReadScope(manager, authContext);
      if (query.location_id) {
        assertLocationWithinScope(scope, query.location_id);
      }

      const item = await getItemOrThrow(manager, query.item_id);
      const locationId = query.location_id || (scope.mode === "location" ? scope.userLocationId : null);
      const existences = await getExistencesByItem(manager, item.item_id, { locationId });
      const movements = await getRecentMovementsForItem(manager, item.item_id, scope);
      const allDonationItems = await getDonationItemsForItem(manager, item.item_id);
      const allPurchaseDetails = await getPurchaseDetailsForItem(manager, item.item_id);
      const locationScopeId = scope.mode === "location" ? Number(scope.userLocationId) : null;
      const donationItems = locationScopeId
        ? allDonationItems.filter((donationItem) =>
            (donationItem.inventory_movement || []).some(
              (movement) =>
                Number(movement.source_location?.ubicacion_id) === locationScopeId
                || Number(movement.destination_location?.ubicacion_id) === locationScopeId,
            ),
          )
        : allDonationItems;
      const purchaseDetails = locationScopeId
        ? allPurchaseDetails.filter((purchaseDetail) =>
            (purchaseDetail.inventory_movements || []).some(
              (movement) =>
                Number(movement.source_location?.ubicacion_id) === locationScopeId
                || Number(movement.destination_location?.ubicacion_id) === locationScopeId,
            ),
          )
        : allPurchaseDetails;

      const distributionByLocation = new Map();
      for (const existence of existences) {
        const location = existence.location;
        if (!location) continue;
        const key = Number(location.ubicacion_id);
        const current = distributionByLocation.get(key) || {
          location: location,
          cantidad_total: 0,
          existencias: 0,
        };
        current.cantidad_total += toNumericNumber(existence.cantidad_actual);
        current.existencias += 1;
        distributionByLocation.set(key, current);
      }

      const quantityTotal = existences.reduce(
        (accumulator, existence) => accumulator + toNumericNumber(existence.cantidad_actual),
        0,
      );
      const stockMinimo =
        item.stock_minimo === null || item.stock_minimo === undefined
          ? null
          : toNumericNumber(item.stock_minimo);

      const alerts = [];
      if (quantityTotal <= 0) alerts.push("Sin stock disponible.");
      if (stockMinimo !== null && quantityTotal < stockMinimo) {
        alerts.push("Stock por debajo del minimo configurado.");
      }
      if (existences.some((existence) => existence.fecha_vencimiento && new Date(existence.fecha_vencimiento) < new Date())) {
        alerts.push("Existen lotes vencidos.");
      }

      return {
        item: mapInventoryItem(item),
        cantidad_total: quantityTotal,
        stock_minimo: stockMinimo,
        estado_stock: buildStockState(quantityTotal, stockMinimo),
        existencias: existences.map(mapInventoryExistence),
        distribucion_por_ubicacion: Array.from(distributionByLocation.values()).map((entry) => ({
          location: entry.location ? mapLocationSummary(entry.location) : null,
          cantidad_total: entry.cantidad_total,
          existencias: entry.existencias,
        })),
        movimientos_recientes: movements.map(mapInventoryMovement),
        donaciones_asociadas: donationItems.map(mapDonationItem),
        compras_asociadas: purchaseDetails.map(mapPurchaseDetail),
        alertas: alerts,
      };
    });

    return [detail, null];
  } catch (error) {
    console.error("Error al obtener detalle de inventario por item:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function consumeInventoryService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveMovementScope(manager, authContext);
      const performedById = body.performed_by_id || authContext.userId;
      const existence = await getScopedExistenceOrThrow(manager, scope, body.existencia_id);

      if (existence.estado !== "DISPONIBLE") {
        throw new Error("La existencia indicada no esta disponible para consumo.");
      }

      await getLocationOrThrow(manager, existence.location?.ubicacion_id, { requireActive: true });
      const updatedExistence = await decreaseExistence(manager, existence, body.cantidad);
      const movement = await createMovementRecord(manager, {
        tipo_movimiento: "CONSUMO",
        cantidad: body.cantidad,
        fecha_movimiento: new Date().toISOString().slice(0, 10),
        referencia_tipo: "CONSUMO",
        referencia_id: existence.existencia_id,
        observaciones: body.observaciones,
        item_id: existence.item.item_id,
        source_location_id: existence.location.ubicacion_id,
        destination_location_id: null,
        performed_by_id: performedById,
      });

      return {
        existence: mapInventoryExistence(updatedExistence),
        movement: mapInventoryMovement(movement),
      };
    });

    return [result, null];
  } catch (error) {
    console.error("Error al registrar consumo de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function exitInventoryService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveMovementScope(manager, authContext);
      const performedById = body.performed_by_id || authContext.userId;
      const existence = await getScopedExistenceOrThrow(manager, scope, body.existencia_id);

      if (existence.estado !== "DISPONIBLE") {
        throw new Error("La existencia indicada no esta disponible para salida.");
      }

      await getLocationOrThrow(manager, existence.location?.ubicacion_id, { requireActive: true });
      const updatedExistence = await decreaseExistence(manager, existence, body.cantidad);
      const movement = await createMovementRecord(manager, {
        tipo_movimiento: "SALIDA",
        cantidad: body.cantidad,
        fecha_movimiento: new Date().toISOString().slice(0, 10),
        referencia_tipo: "SALIDA",
        referencia_id: existence.existencia_id,
        observaciones: [body.motivo, body.observaciones].filter(Boolean).join(" | "),
        item_id: existence.item.item_id,
        source_location_id: existence.location.ubicacion_id,
        destination_location_id: null,
        performed_by_id: performedById,
      });

      return {
        existence: mapInventoryExistence(updatedExistence),
        movement: mapInventoryMovement(movement),
      };
    });

    return [result, null];
  } catch (error) {
    console.error("Error al registrar salida de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function transferInventoryService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveMovementScope(manager, authContext);
      const performedById = body.performed_by_id || authContext.userId;
      const sourceExistence = await getScopedExistenceOrThrow(manager, scope, body.existencia_id);
      const sourceLocationId = Number(sourceExistence.location?.ubicacion_id);
      const destinationLocation = await getLocationOrThrow(manager, body.destination_location_id, {
        requireActive: true,
      });

      assertLocationWithinScope(scope, destinationLocation.ubicacion_id);

      if (sourceExistence.estado !== "DISPONIBLE") {
        throw new Error("La existencia indicada no esta disponible para traslado.");
      }

      if (sourceLocationId === Number(destinationLocation.ubicacion_id)) {
        throw new Error("La ubicacion de origen y destino deben ser distintas.");
      }

      await getLocationOrThrow(manager, sourceLocationId, { requireActive: true });
      const updatedSourceExistence = await decreaseExistence(
        manager,
        sourceExistence,
        body.cantidad,
      );

      const destinationExistence = await createOrIncreaseExistence(manager, {
        item_id: sourceExistence.item.item_id,
        location_id: destinationLocation.ubicacion_id,
        cantidad_actual: body.cantidad,
        fecha_vencimiento: sourceExistence.fecha_vencimiento,
        fecha_apertura: sourceExistence.fecha_apertura,
        condicion: sourceExistence.condicion,
        origen_tipo: sourceExistence.origen_tipo,
        origen_id: sourceExistence.origen_id,
        observaciones: body.observaciones ?? sourceExistence.observaciones,
      });

      const movement = await createMovementRecord(manager, {
        tipo_movimiento: "TRASLADO",
        cantidad: body.cantidad,
        fecha_movimiento: new Date().toISOString().slice(0, 10),
        referencia_tipo: "TRASLADO",
        referencia_id: sourceExistence.existencia_id,
        observaciones: body.observaciones,
        item_id: sourceExistence.item.item_id,
        source_location_id: sourceLocationId,
        destination_location_id: destinationLocation.ubicacion_id,
        performed_by_id: performedById,
      });

      return {
        source_existence: mapInventoryExistence(updatedSourceExistence),
        destination_existence: mapInventoryExistence(destinationExistence),
        movement: mapInventoryMovement(movement),
      };
    });

    return [result, null];
  } catch (error) {
    console.error("Error al trasladar inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function createInitialInventoryLoadService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const scope = await resolveInitialLoadScope(manager, authContext);
      const performedById = body.performed_by_id || authContext.userId;
      const item = await getItemOrThrow(manager, body.item_id, { requireActive: true });
      const location = await getLocationOrThrow(manager, body.ubicacion_id, { requireActive: true });
      assertLocationWithinScope(scope, location.ubicacion_id);

      const existence = await createOrIncreaseExistence(manager, {
        item_id: item.item_id,
        location_id: location.ubicacion_id,
        cantidad_actual: body.cantidad,
        fecha_vencimiento: body.fecha_vencimiento || null,
        fecha_apertura: body.fecha_apertura || null,
        condicion: body.condicion || null,
        origen_tipo: "CARGA_INICIAL",
        origen_id: null,
        observaciones: body.observaciones || null,
      });

      const movement = await createMovementRecord(manager, {
        tipo_movimiento: "ENTRADA",
        cantidad: body.cantidad,
        fecha_movimiento: new Date().toISOString().slice(0, 10),
        referencia_tipo: "CARGA_INICIAL",
        referencia_id: existence.existencia_id,
        observaciones: body.observaciones,
        item_id: item.item_id,
        source_location_id: null,
        destination_location_id: location.ubicacion_id,
        performed_by_id: performedById,
      });

      return {
        existence: mapInventoryExistence(existence),
        movement: mapInventoryMovement(movement),
      };
    });

    return [result, null];
  } catch (error) {
    console.error("Error al crear carga inicial de inventario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export { distributeNegativeAdjustmentLikeDecrease };
