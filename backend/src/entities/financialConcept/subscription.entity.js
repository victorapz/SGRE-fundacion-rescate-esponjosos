"use strict";

import { EntitySchema } from "typeorm";

export const SUBSCRIPTION_STATUSES = [
  "CREADA",
  "APROBACION_PENDIENTE",
  "ACTIVA",
  "SUSPENDIDA",
  "CANCELADA",
  "EXPIRADA",
  "FALLIDA",
];

const SubscriptionSchema = new EntitySchema({
  name: "Subscription",
  tableName: "Subscriptions",
  columns: {
    subscription_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    provider_subscription_id: {
      type: "varchar",
      length: 255,
      nullable: true,
      unique: true,
    },
    provider_plan_id: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    estado: {
      type: "enum",
      enum: SUBSCRIPTION_STATUSES,
      nullable: false,
      default: "CREADA",
    },
    approval_url: {
      type: "text",
      nullable: true,
    },
    payer_id: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    payer_email: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    next_billing_time: {
      type: "timestamp with time zone",
      nullable: true,
    },
    last_synced_at: {
      type: "timestamp with time zone",
      nullable: true,
    },
    provider_status_updated_at: {
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
    sponsorship: {
      target: "Sponsorship",
      type: "one-to-one",
      joinColumn: {
        name: "sponsorship_id",
        referencedColumnName: "sponsorship_id",
      },
      nullable: false,
    },
    payment_provider: {
      target: "PaymentProvider",
      type: "many-to-one",
      joinColumn: {
        name: "payment_provider_id",
        referencedColumnName: "proveedor_pago_id",
      },
      nullable: true,
    },
    payments: {
      target: "SubscriptionPayment",
      type: "one-to-many",
      inverseSide: "subscription",
    },
  },
});

export default SubscriptionSchema;
