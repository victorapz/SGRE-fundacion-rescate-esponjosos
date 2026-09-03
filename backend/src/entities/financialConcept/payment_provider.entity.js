"use strict";

import { EntitySchema } from "typeorm";

const PaymentProviderScheme = new EntitySchema({
  name: "PaymentProvider",
  tableName: "PaymentProviders",
  columns: {
    proveedor_pago_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    clave: {
      type: "varchar",
      length: 120,
      unique: true,
      nullable: false,
    },
    nombre: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    tipo: {
      type: "enum",
      enum: ["PAYPAL", "MANUAL", "TRANSFERENCIA", "EFECTIVO", "OTRO"],
      nullable: false,
    },
    activo: {
      type: "boolean",
      default: true,
      nullable: false,
    },
    metadata_publica: {
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
    transactions: {
      target: "Transaction",
      type: "one-to-many",
      inverseSide: "payment_provider",
    },
    payment_orders: {
      target: "PaymentOrder",
      type: "one-to-many",
      inverseSide: "payment_provider",
    },
    webhook_logs: {
      target: "WebhookLog",
      type: "one-to-many",
      inverseSide: "payment_provider",
    },
    subscriptions: {
      target: "Subscription",
      type: "one-to-many",
      inverseSide: "payment_provider",
    },
  },
});

export default PaymentProviderScheme;
