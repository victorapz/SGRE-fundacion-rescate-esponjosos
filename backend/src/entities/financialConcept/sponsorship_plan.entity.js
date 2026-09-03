"use strict";

import { EntitySchema } from "typeorm";

export const SPONSORSHIP_PLAN_CURRENCIES = ["USD", "CLP"];
export const SPONSORSHIP_PLAN_INTERVAL_UNITS = ["MONTH"];
export const SPONSORSHIP_PLAN_MODALITIES = ["PAYPAL", "MANUAL"];

const SponsorshipPlanSchema = new EntitySchema({
  name: "SponsorshipPlan",
  tableName: "SponsorshipPlans",
  columns: {
    sponsorship_plan_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    nombre: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    descripcion: {
      type: "text",
      nullable: true,
    },
    monto: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    modalidad: {
      type: "enum",
      enum: SPONSORSHIP_PLAN_MODALITIES,
      nullable: false,
      default: "PAYPAL",
    },
    moneda: {
      type: "enum",
      enum: SPONSORSHIP_PLAN_CURRENCIES,
      nullable: false,
      default: "USD",
    },
    intervalo_unidad: {
      type: "enum",
      enum: SPONSORSHIP_PLAN_INTERVAL_UNITS,
      nullable: false,
      default: "MONTH",
    },
    intervalo_cantidad: {
      type: "int",
      nullable: false,
      default: 1,
    },
    paypal_product_id: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    paypal_plan_id: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    activo: {
      type: "boolean",
      nullable: false,
      default: true,
    },
    orden: {
      type: "int",
      nullable: false,
      default: 0,
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
    sponsorships: {
      target: "Sponsorship",
      type: "one-to-many",
      inverseSide: "plan",
    },
  },
});

export default SponsorshipPlanSchema;
