"use strict";

import { EntitySchema } from "typeorm";

const PurchaseDetailScheme = new EntitySchema({
  name: "PurchaseDetail",
  tableName: "PurchaseDetails",
  columns: {
    detalle_compra_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    cantidad: {
      type: "numeric",
      nullable: false,
    },
    cantidad_recepcionada:{
        type:"numeric",
        nullable:false,
        default:0
    },
    precio_unitario: {
      type: "numeric",
      nullable: false,
    },
    subtotal: {
      type: "numeric",
      nullable: false,
    },
    fecha_vencimiento: {
      type: "date",
      nullable: true,
    },
    fecha_apertura: {
      type: "date",
      nullable: true,
    },
    condiciones_almacenamiento: {
      type: "text",
      nullable: true,
    },
    condicion: {
      type: "enum",
      enum: ["NUEVO", "USADO_BUENO", "USADO_MALO", "DEFECTUOSO"],
      default: "NUEVO",
      nullable: false,
    },
    estado: {
      type: "enum",
      enum: ["PENDIENTE", "PARCIAL", "COMPLETO", "CERRADO_INCOMPLETO", "CANCELADO"],
      default: "PENDIENTE",
      nullable: false,
    },
    observaciones: {
      type: "text",
      nullable: true,
    },
    recepcion_parcial_definitiva: {
      type: "boolean",
      nullable: false,
      default: false,
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
    purchase: {
      target: "Purchase",
      type: "many-to-one",
      joinColumn: {
        name: "compra_id",
        referencedColumnName: "compra_id",
      },
      nullable: false,
    },
    item: {
      target: "InventoryItem",
      type: "many-to-one",
      joinColumn: {
        name: "item_id",
        referencedColumnName: "item_id",
      },
      nullable: false,
    },
    inventory_movements: {
      target: "InventoryMovement",
      type: "one-to-many",
      inverseSide: "purchase_detail",
    },
    inventory_receipts: {
      target: "InventoryReceipt",
      type: "one-to-many",
      inverseSide: "purchase_detail",
    },
  },
});

export default PurchaseDetailScheme;
