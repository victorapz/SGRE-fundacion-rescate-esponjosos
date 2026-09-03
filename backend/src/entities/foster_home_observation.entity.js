"use strict";

import { EntitySchema } from "typeorm";

const FosterHomeObservationSchema = new EntitySchema({
  name: "FosterHomeObservation",
  tableName: "FosterHomeObservations",
  columns: {
    id_foster_home_observation: {
      type: "int",
      primary: true,
      generated: true,
    },
    texto: {
      type: "text",
      nullable: false,
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
    foster_home: {
      target: "FosterHome",
      type: "many-to-one",
      joinColumn: {
        name: "foster_home_id",
        referencedColumnName: "id_hogar_temporal",
      },
      nullable: false,
      onDelete: "CASCADE",
    },
  },
});

export default FosterHomeObservationSchema;
