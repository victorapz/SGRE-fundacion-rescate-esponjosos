"use strict";

import {
  AppDataSource,
  DonationItem,
  getItemOrThrow,
  mapDonationItem,
  toNumericNumber,
} from "./inventory.shared.js";
import {
  getDonationItemWithReceiptRelations,
  registerBulkInventoryReceipts,
  registerInventoryReceipt,
} from "./inventory_receipt.service.js";

async function getDonationItemWithRelations(repository, donationItemId) {
  return getDonationItemWithReceiptRelations(repository, donationItemId);
}

export function assertDonationItemMutable(donationItem, {
  action = "modificar",
} = {}) {
  if (!donationItem) {
    throw new Error("Item de donacion no encontrado");
  }

  if (donationItem.donation?.estado === "CANCELADO") {
    throw new Error("No se puede modificar un item de una donacion cancelada.");
  }

  if (donationItem.donation?.estado === "RECEPCIONADO") {
    throw new Error("No se puede modificar este item porque la donacion ya fue recepcionada.");
  }

  if (toNumericNumber(donationItem.cantidad_recepcionada) > 0) {
    throw new Error(
      `No se puede ${action} un item de donacion que ya tiene recepciones registradas.`,
    );
  }

  if ((donationItem.inventory_receipts || []).length > 0) {
    throw new Error(
      `No se puede ${action} un item de donacion que ya tiene recepciones registradas.`,
    );
  }

  if ((donationItem.inventory_movement || []).length > 0) {
    throw new Error(
      "No se puede modificar este item porque ya genero movimientos de inventario.",
    );
  }
}

export async function createDonationItemService(body) {
  try {
    const donationItem = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DonationItem);
      const donation = await manager.getRepository("Donation").findOne({
        where: { donacion_id: Number(body.donation_id) },
      });

      if (!donation) {
        throw new Error("Donacion no encontrada.");
      }

      await getItemOrThrow(manager, body.item_id, { requireActive: true });

      const newDonationItem = repository.create({
        cantidad: body.cantidad,
        cantidad_recepcionada: 0,
        fecha_vencimiento: body.fecha_vencimiento || null,
        fecha_apertura: body.fecha_apertura || null,
        condiciones_almacenamiento: body.condiciones_almacenamiento,
        condicion: body.condicion,
        estado: "PENDIENTE",
        observaciones: body.observaciones || null,
        recepcion_parcial_definitiva: false,
        donation: { donacion_id: Number(body.donation_id) },
        item: { item_id: Number(body.item_id) },
      });

      const savedDonationItem = await repository.save(newDonationItem);
      return getDonationItemWithRelations(repository, savedDonationItem.donacion_individual_id);
    });

    return [mapDonationItem(donationItem), null];
  } catch (error) {
    console.error("Error al crear item de donacion:", error);
    return [null, error.message || "Error interno al crear item de donacion"];
  }
}

export async function getDonationItemService(query) {
  try {
    const repository = AppDataSource.getRepository(DonationItem);
    const donationItem = await getDonationItemWithRelations(
      repository,
      query.donacion_individual_id,
    );

    if (!donationItem) return [null, "Item de donacion no encontrado"];

    return [mapDonationItem(donationItem), null];
  } catch (error) {
    console.error("Error al obtener item de donacion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getDonationItemsService() {
  try {
    const repository = AppDataSource.getRepository(DonationItem);
    const donationItems = await repository.find({
      relations: {
        donation: true,
        item: {
          categoria: true,
          unidad_medida: true,
        },
        inventory_movement: true,
        inventory_receipts: true,
      },
      order: {
        createdAt: "DESC",
      },
    });

    if (!donationItems || donationItems.length === 0) {
      return [null, "No hay items de donacion"];
    }

    return [donationItems.map(mapDonationItem), null];
  } catch (error) {
    console.error("Error al obtener items de donacion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateDonationItemService(query, body) {
  try {
    const donationItem = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DonationItem);
      const donationItemFound = await repository.findOne({
        where: { donacion_individual_id: Number(query.donacion_individual_id) },
        relations: {
          donation: true,
          inventory_movement: true,
          inventory_receipts: true,
        },
      });

      assertDonationItemMutable(donationItemFound, { action: "modificar" });

      if (body.donation_id !== undefined) {
        const donation = await manager.getRepository("Donation").findOne({
          where: { donacion_id: Number(body.donation_id) },
        });
        if (!donation) {
          throw new Error("Donacion no encontrada.");
        }
        donationItemFound.donation = { donacion_id: Number(body.donation_id) };
      }

      if (body.item_id !== undefined) {
        await getItemOrThrow(manager, body.item_id, { requireActive: true });
        donationItemFound.item = { item_id: Number(body.item_id) };
      }

      if (body.cantidad !== undefined) donationItemFound.cantidad = body.cantidad;
      if (body.fecha_vencimiento !== undefined) {
        donationItemFound.fecha_vencimiento = body.fecha_vencimiento || null;
      }
      if (body.fecha_apertura !== undefined) {
        donationItemFound.fecha_apertura = body.fecha_apertura || null;
      }
      if (body.condiciones_almacenamiento !== undefined) {
        donationItemFound.condiciones_almacenamiento = body.condiciones_almacenamiento;
      }
      if (body.condicion !== undefined) donationItemFound.condicion = body.condicion;
      if (body.observaciones !== undefined) {
        donationItemFound.observaciones = body.observaciones || null;
      }

      await repository.save(donationItemFound);
      return getDonationItemWithRelations(
        repository,
        donationItemFound.donacion_individual_id,
      );
    });

    return [mapDonationItem(donationItem), null];
  } catch (error) {
    console.error("Error al actualizar item de donacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteDonationItemService(query) {
  try {
    const donationItem = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DonationItem);
      const donationItemFound = await repository.findOne({
        where: { donacion_individual_id: Number(query.donacion_individual_id) },
        relations: {
          donation: true,
          inventory_movement: true,
          inventory_receipts: true,
        },
      });

      assertDonationItemMutable(donationItemFound, { action: "eliminar" });

      return repository.remove(donationItemFound);
    });

    return [donationItem, null];
  } catch (error) {
    console.error("Error al eliminar item de donacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function receiveDonationItemService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DonationItem);
      const currentItem = await getDonationItemWithRelations(
        repository,
        body.donation_item_id,
      );

      return registerInventoryReceipt(manager, {
        sourceType: "DONATION",
        detailId: Number(body.donation_item_id),
        amount: body.cantidad_a_recepcionar,
        receiptDate: body.fecha_recepcion,
        destinationLocationId: Number(body.destination_location_id),
        observaciones: body.observaciones || null,
        closeDetail: Boolean(body.cierra_detalle),
        idempotencyKey: body.idempotency_key,
        authContext,
        movementPayload: {
          fecha_vencimiento: body.fecha_vencimiento ?? currentItem?.fecha_vencimiento ?? null,
          fecha_apertura: body.fecha_apertura ?? currentItem?.fecha_apertura ?? null,
          condicion: body.condicion ?? currentItem?.condicion ?? null,
        },
      });
    });

    return [result, null];
  } catch (error) {
    console.error("Error al recepcionar item de donacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function receiveDonationItemsBulkService(body, authContext = {}) {
  try {
    const result = await AppDataSource.transaction(async (manager) =>
      registerBulkInventoryReceipts(manager, {
        sourceType: "DONATION",
        parentId: Number(body.donation_id),
        detailIds: body.donation_item_ids,
        receiptDate: body.fecha_recepcion,
        destinationLocationId: Number(body.destination_location_id),
        observaciones: body.observaciones || null,
        batchIdempotencyKey: body.idempotency_key,
        authContext,
      }));

    return [result, null];
  } catch (error) {
    console.error("Error al recepcionar items de donacion en lote:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
