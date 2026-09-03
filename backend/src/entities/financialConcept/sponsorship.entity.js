"use strict";

import { EntitySchema } from "typeorm";

export const SPONSORSHIP_STATUSES = [
  "PENDIENTE_APROBACION",
  "ACTIVO",
  "SUSPENDIDO",
  "CANCELADO",
  "FALLIDO",
];

const SponsorshipSchema = new EntitySchema({
  name: "Sponsorship",
  tableName: "Sponsorships",
  columns: {
    sponsorship_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    public_reference: {
      type: "uuid",
      nullable: false,
      unique: true,
    },
    creation_idempotency_key: {
      type: "varchar",
      length: 255,
      nullable: true,
      unique: true,
    },
    estado: {
      type: "enum",
      enum: SPONSORSHIP_STATUSES,
      nullable: false,
      default: "PENDIENTE_APROBACION",
    },
    solicitado_en: {
      type: "timestamp with time zone",
      nullable: false,
      default: () => "CURRENT_TIMESTAMP",
    },
    activado_en: {
      type: "timestamp with time zone",
      nullable: true,
    },
    cancelado_en: {
      type: "timestamp with time zone",
      nullable: true,
    },
    motivo_cancelacion: {
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
    sponsor: {
      target: "Sponsor",
      type: "many-to-one",
      joinColumn: {
        name: "sponsor_id",
        referencedColumnName: "sponsor_id",
      },
      nullable: false,
    },
    animal: {
      target: "Animal",
      type: "many-to-one",
      joinColumn: {
        name: "animal_id",
        referencedColumnName: "id_animal",
      },
      nullable: false,
    },
    plan: {
      target: "SponsorshipPlan",
      type: "many-to-one",
      joinColumn: {
        name: "sponsorship_plan_id",
        referencedColumnName: "sponsorship_plan_id",
      },
      nullable: false,
    },
    subscription: {
      target: "Subscription",
      type: "one-to-one",
      inverseSide: "sponsorship",
      nullable: true,
    },
  },
});

export default SponsorshipSchema;
