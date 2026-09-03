"use strict";

import { EntitySchema } from "typeorm";

const PurchaseScheme = new EntitySchema({
  name: "Purchase",
  tableName: "Purchases",
  columns: {
    compra_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    fecha_compra: {
      type: "date",
      nullable: false,
    },
    fecha_recepcion: {
      type: "date",
      nullable: true,
    },
    estado: {
      type: "enum",
      enum: ["BORRADOR", "CONFIRMADA", "CANCELADA"],
      default: "BORRADOR",
      nullable: false,
    },
    monto_total: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    moneda: {
      type: "varchar",
      length: 3,
      default: "CLP",
      nullable: false,
    },
    estado_pago: {
      type: "enum",
      enum: ["PENDIENTE", "PAGADA", "PAGADA_PARCIAL"],
      default: "PENDIENTE",
      nullable: false,
    },
    fecha_vencimiento_pago: {
      type: "date",
      nullable: true,
    },
    observacion_financiera: {
      type: "text",
      nullable: true,
    },
    descripcion: {
      type: "text",
      nullable: true,
    },
    observaciones: {
      type: "text",
      nullable: true,
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
    supplier: {
      target: "Supplier",
      type: "many-to-one",
      joinColumn: {
        name: "proveedor_id",
        referencedColumnName: "proveedor_id",
      },
      nullable: false,
    },
    transaction: {
      target: "Transaction",
      type: "many-to-one",
      joinColumn: {
        name: "transaccion_id",
        referencedColumnName: "transaccion_id",
      },
      nullable: true,
    },
    registered_by: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "registered_by",
        referencedColumnName: "id_usuario",
      },
      nullable: false,
    },
    purchase_details: {
      target: "PurchaseDetail",
      type: "one-to-many",
      inverseSide: "purchase",
    },
  },
});

export default PurchaseScheme;
