"use strict";

import { EntitySchema } from "typeorm";

const ComunaSchema = new EntitySchema({
  name: "Comuna",
  tableName: "Comunas",
  columns: {
    id_comuna: {
      type: "int",
      primary: true,
      generated: true,
    },
    nombre: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    codigo: {
      type: "varchar",
      length: 50,
      nullable: true,
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
    region: {
      target: "Region",
      type: "many-to-one",
      joinColumn: {
        name: "region_id",
        referencedColumnName: "id_region",
      },
      nullable: false,
    },
    locations: {
      target: "Location",
      type: "one-to-many",
      inverseSide: "comuna",
    },
  },
  uniques: [
    {
      name: "UQ_comuna_region_nombre",
      columns: ["nombre", "region"],
    },
  ],
});

export default ComunaSchema;
