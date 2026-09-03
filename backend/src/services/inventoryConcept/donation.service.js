"use strict";

import { AppDataSource } from "../../config/configDb.js";
import Donor from "../../entities/donor.entity.js";
import Donation from "../../entities/inventoryConcept/donation.entity.js";
import {
  mapDonationItem,
  toNumericNumber,
  deriveInventoryReceiptHeaderState,
} from "./inventory.shared.js";

async function getDonorOrThrow(manager, donorId) {
  const donor = await manager.getRepository(Donor).findOne({
    where: { donante_id: Number(donorId) },
  });

  if (!donor) {
    throw new Error("Donante no encontrado.");
  }

  return donor;
}

function mapDonation(donation) {
  if (!donation) return null;

  return {
    donacion_id: donation.donacion_id,
    motivo_donacion: donation.motivo_donacion || "",
    punto_encuentro: donation.punto_encuentro || null,
    fecha_registro: donation.fecha_registro || null,
    fecha_recepcion: donation.fecha_recepcion || null,
    estado: donation.estado || "",
    estado_recepcion: deriveInventoryReceiptHeaderState(donation.donation_item || []),
    observaciones: donation.observaciones || null,
    donor: donation.donor
      ? {
          donante_id: donation.donor.donante_id,
          nombre: donation.donor.nombre || "",
          apellido: donation.donor.apellido || null,
          email: donation.donor.email || null,
          telefono: donation.donor.telefono || null,
          usuario_instagram: donation.donor.usuario_instagram || null,
          direccion: donation.donor.direccion || null,
          observaciones: donation.donor.observaciones || null,
          activo: Boolean(donation.donor.activo),
        }
      : null,
    region: donation.region
      ? {
          id_region: donation.region.id_region,
          nombre: donation.region.nombre || "",
          clave: donation.region.clave || "",
        }
      : null,
    receiving_user: donation.receiving_user
      ? {
          id_usuario: donation.receiving_user.id_usuario,
          nombre: donation.receiving_user.nombre || "",
          apellido: donation.receiving_user.apellido || "",
          email: donation.receiving_user.email || "",
        }
      : null,
    donation_item: Array.isArray(donation.donation_item)
      ? donation.donation_item.map(mapDonationItem)
      : [],
  };
}

async function getDonationWithRelations(repository, donationId) {
  return repository.findOne({
    where: { donacion_id: Number(donationId) },
    relations: {
      donor: true,
      region: true,
      receiving_user: true,
      donation_item: {
        item: {
          categoria: true,
          unidad_medida: true,
        },
        inventory_movement: true,
        inventory_receipts: {
          destination_location: {
            region: true,
            comuna: {
              region: true,
            },
          },
          performed_by: true,
          movement: {
            item: true,
            source_location: {
              region: true,
              comuna: {
                region: true,
              },
            },
            destination_location: {
              region: true,
              comuna: {
                region: true,
              },
            },
            performed_by: true,
          },
        },
      },
    },
  });
}

export function hasDonationReceivedItems(donation) {
  return (donation?.donation_item || []).some(
    (item) =>
      toNumericNumber(item.cantidad_recepcionada) > 0
      || (item.inventory_receipts || []).length > 0
      || (item.inventory_movement || []).length > 0,
  );
}

export function assertDonationHeaderEditable(donation) {
  if (!donation) {
    throw new Error("Donacion no encontrada");
  }

  if (donation.estado === "CANCELADO") {
    throw new Error("No se puede modificar una donacion cancelada.");
  }
}

export async function createDonationService(body) {
  try {
    const donation = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Donation);
      if (body.donor_id !== undefined && body.donor_id !== null) {
        await getDonorOrThrow(manager, body.donor_id);
      }
      const newDonation = repository.create({
        motivo_donacion: body.motivo_donacion,
        punto_encuentro: body.punto_encuentro || null,
        fecha_registro: body.fecha_registro,
        fecha_recepcion: body.fecha_recepcion || null,
        estado: body.estado || "PENDIENTE",
        observaciones: body.observaciones || null,
        donor: body.donor_id ? { donante_id: Number(body.donor_id) } : null,
        region: { id_region: Number(body.region_id) },
        receiving_user: { id_usuario: Number(body.receiving_user_id) },
      });

      const savedDonation = await repository.save(newDonation);
      return getDonationWithRelations(repository, savedDonation.donacion_id);
    });

    return [mapDonation(donation), null];
  } catch (error) {
    console.error("Error al crear donacion:", error);
    return [null, error.message || "Error interno al crear donacion"];
  }
}

export async function getDonationService(query) {
  try {
    const repository = AppDataSource.getRepository(Donation);
    const donation = await getDonationWithRelations(repository, query.donacion_id);

    if (!donation) return [null, "Donacion no encontrada"];

    return [mapDonation(donation), null];
  } catch (error) {
    console.error("Error al obtener donacion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getDonationsService() {
  try {
    const repository = AppDataSource.getRepository(Donation);
    const donations = await repository.find({
      relations: {
        donor: true,
        region: true,
        receiving_user: true,
        donation_item: {
          inventory_movement: true,
          inventory_receipts: true,
        },
      },
      order: {
        fecha_registro: "DESC",
        donacion_id: "DESC",
      },
    });

    if (!donations || donations.length === 0) return [null, "No hay donaciones"];

    return [donations.map(mapDonation), null];
  } catch (error) {
    console.error("Error al obtener donaciones:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateDonationService(query, body) {
  try {
    const donation = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Donation);
      const donationFound = await repository.findOne({
        where: { donacion_id: Number(query.donacion_id) },
        relations: {
          donation_item: {
            inventory_movement: true,
            inventory_receipts: true,
          },
        },
      });

      if (!donationFound) {
        throw new Error("Donacion no encontrada");
      }

      assertDonationHeaderEditable(donationFound);

      const hasReceivedItems = hasDonationReceivedItems(donationFound);

      if (hasReceivedItems && body.estado === "CANCELADO") {
        throw new Error("No se puede cancelar una donacion que ya tiene recepciones registradas.");
      }

      if (body.motivo_donacion !== undefined) donationFound.motivo_donacion = body.motivo_donacion;
      if (body.punto_encuentro !== undefined) donationFound.punto_encuentro = body.punto_encuentro || null;
      if (body.fecha_registro !== undefined) donationFound.fecha_registro = body.fecha_registro;
      if (body.fecha_recepcion !== undefined) donationFound.fecha_recepcion = body.fecha_recepcion || null;
      if (body.estado !== undefined) donationFound.estado = body.estado;
      if (body.observaciones !== undefined) donationFound.observaciones = body.observaciones || null;
      if (body.donor_id !== undefined) {
        donationFound.donor = body.donor_id ? { donante_id: Number(body.donor_id) } : null;
      }
      if (body.region_id !== undefined) {
        donationFound.region = { id_region: Number(body.region_id) };
      }
      if (body.receiving_user_id !== undefined) {
        donationFound.receiving_user = { id_usuario: Number(body.receiving_user_id) };
      }

      await repository.save(donationFound);
      return getDonationWithRelations(repository, donationFound.donacion_id);
    });

    return [mapDonation(donation), null];
  } catch (error) {
    console.error("Error al actualizar donacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteDonationService(query) {
  try {
    const donation = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Donation);
      const donationFound = await repository.findOne({
        where: { donacion_id: Number(query.donacion_id) },
        relations: {
          donation_item: {
            inventory_movement: true,
            inventory_receipts: true,
          },
        },
      });

      if (!donationFound) {
        throw new Error("Donacion no encontrada");
      }

      const hasReceivedItems = hasDonationReceivedItems(donationFound);

      if (hasReceivedItems) {
        throw new Error("No se puede eliminar la donacion porque ya genero movimientos de inventario.");
      }

      if ((donationFound.donation_item || []).length > 0) {
        throw new Error(
          "No se puede eliminar una donacion que aun tiene items asociados. Elimina primero las lineas de donacion.",
        );
      }

      return repository.remove(donationFound);
    });

    return [donation, null];
  } catch (error) {
    console.error("Error al eliminar donacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}
