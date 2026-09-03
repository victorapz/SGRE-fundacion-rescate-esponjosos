"use strict";

import { EntitySchema } from "typeorm";

const InventoryReceiptSchema = new EntitySchema({
  name: "InventoryReceipt",
  tableName: "InventoryReceipts",
  columns: {
    recepcion_inventario_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    cantidad: {
      type: "numeric",
      nullable: false,
    },
    fecha_recepcion: {
      type: "date",
      nullable: false,
    },
    observaciones: {
      type: "text",
      nullable: true,
    },
    cierra_detalle: {
      type: "boolean",
      nullable: false,
      default: false,
    },
    idempotency_key: {
      type: "varchar",
      length: 255,
      nullable: false,
      unique: true,
    },
    createdAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },
    updatedAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      onUpdate: "CURRENT_TIMESTAMP",
      nullable: false,
    },
  },
  relations: {
    purchase_detail: {
      target: "PurchaseDetail",
      type: "many-to-one",
      joinColumn: {
        name: "detalle_compra_id",
        referencedColumnName: "detalle_compra_id",
      },
      nullable: true,
    },
    donation_item: {
      target: "DonationItem",
      type: "many-to-one",
      joinColumn: {
        name: "donacion_individual_id",
        referencedColumnName: "donacion_individual_id",
      },
      nullable: true,
    },
    destination_location: {
      target: "Location",
      type: "many-to-one",
      joinColumn: {
        name: "destination_location_id",
        referencedColumnName: "ubicacion_id",
      },
      nullable: false,
    },
    performed_by: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "performed_by_id",
        referencedColumnName: "id_usuario",
      },
      nullable: false,
    },
    movement: {
      target: "InventoryMovement",
      type: "one-to-one",
      joinColumn: {
        name: "movement_id",
        referencedColumnName: "movimiento_id",
      },
      nullable: true,
    },
  },
  indices: [
    {
      name: "UQ_inventory_receipt_movement_id",
      columns: ["movement"],
      unique: true,
    },
  ],
  checks: [
    {
      expression: `(
        ("detalle_compra_id" IS NOT NULL AND "donacion_individual_id" IS NULL)
        OR
        ("detalle_compra_id" IS NULL AND "donacion_individual_id" IS NOT NULL)
      )`,
    },
  ],
});

export default InventoryReceiptSchema;
