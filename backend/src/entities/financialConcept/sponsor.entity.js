"use strict";

import { EntitySchema } from "typeorm";

const SponsorSchema = new EntitySchema({
  name: "Sponsor",
  tableName: "Sponsors",
  columns: {
    sponsor_id: {
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
    apellido: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    email: {
      type: "varchar",
      length: 255,
      nullable: false,
      unique: true,
    },
    telefono: {
      type: "varchar",
      length: 50,
      nullable: true,
    },
    consentimiento_datos_at: {
      type: "timestamp with time zone",
      nullable: false,
    },
    activo: {
      type: "boolean",
      nullable: false,
      default: true,
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
      inverseSide: "sponsor",
    },
  },
});

export default SponsorSchema;
