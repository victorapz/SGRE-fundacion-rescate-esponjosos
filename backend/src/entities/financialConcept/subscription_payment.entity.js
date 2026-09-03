"use strict";

import { EntitySchema } from "typeorm";

export const SUBSCRIPTION_PAYMENT_STATUSES = [
  "PENDIENTE",
  "COMPLETADO",
  "FALLIDO",
  "REEMBOLSADO",
  "REVERSADO",
];

const SubscriptionPaymentSchema = new EntitySchema({
  name: "SubscriptionPayment",
  tableName: "SubscriptionPayments",
  columns: {
    subscription_payment_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    provider_payment_id: {
      type: "varchar",
      length: 255,
      nullable: true,
      unique: true,
    },
    provider_event_id: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    estado: {
      type: "enum",
      enum: SUBSCRIPTION_PAYMENT_STATUSES,
      nullable: false,
      default: "PENDIENTE",
    },
    moneda: {
      type: "varchar",
      length: 3,
      nullable: false,
      default: "USD",
    },
    monto_bruto: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    monto_fee: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
      default: 0,
    },
    monto_neto: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    occurred_at: {
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
    subscription: {
      target: "Subscription",
      type: "many-to-one",
      joinColumn: {
        name: "subscription_id",
        referencedColumnName: "subscription_id",
      },
      nullable: false,
    },
    transaction: {
      target: "Transaction",
      type: "one-to-one",
      joinColumn: {
        name: "transaction_id",
        referencedColumnName: "transaccion_id",
      },
      nullable: true,
    },
  },
  indices: [
    {
      name: "UQ_subscription_payment_transaction_id",
      columns: ["transaction"],
      unique: true,
    },
  ],
});

export default SubscriptionPaymentSchema;
