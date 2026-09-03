"use strict";

import { EntitySchema } from "typeorm";

const PaymentOrderScheme = new EntitySchema({
  name: "PaymentOrder",
  tableName: "PaymentOrders",
  columns: {
    orden_pago_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    proveedor_orden_id: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    proposito: {
      type: "enum",
      enum: ["DONACION_UNICA", "APADRINAMIENTO", "SUSCRIPCION", "OTRO"],
      nullable: false,
    },
    moneda: {
      type: "varchar",
      length: 3,
      default: "CLP",
      nullable: false,
    },
    monto_bruto: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    estado: {
      type: "enum",
      enum: ["CREADA", "APROBADA", "CAPTURADA", "CANCELADA", "EXPIRADA", "FALLIDA", "REEMBOLSADA"],
      default: "CREADA",
      nullable: false,
    },
    approval_url: {
      type: "text",
      nullable: true,
    },
    fecha_expiracion: {
      type: "timestamp with time zone",
      nullable: true,
    },
    capturada_en: {
      type: "timestamp with time zone",
      nullable: true,
    },
    metadata: {
      type: "jsonb",
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
    payment_provider: {
      target: "PaymentProvider",
      type: "many-to-one",
      joinColumn: {
        name: "proveedor_pago_id",
        referencedColumnName: "proveedor_pago_id",
      },
      nullable: false,
    },
    donor: {
      target: "Donor",
      type: "many-to-one",
      joinColumn: {
        name: "donante_id",
        referencedColumnName: "donante_id",
      },
      nullable: true,
    },
    transactions: {
      target: "Transaction",
      type: "one-to-many",
      inverseSide: "payment_order",
    },
  },
});

export default PaymentOrderScheme;
