"use strict";

import { EntitySchema } from "typeorm";

const AreaSchema = new EntitySchema({
  name: "Area",
  tableName: "Areas",

  columns: {
    id_area: {
      type: "int",
      primary: true,
      generated: true,
    },
    nombre: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    clave: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    descripcion: {
      type: "varchar",
      length: 255,
      nullable: false,
      default: "",
    },
    activo: {
      type: "boolean",
      default: true,
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
    users: {
      target: "User",
      type: "one-to-many",
      inverseSide: "area",
    },
    userAreas: {
      target: "UserArea",
      type: "one-to-many",
      inverseSide: "area",
    },
    tasks: {
      target: "Task",
      type: "one-to-many",
      inverseSide: "area",
    },
  },
});

export default AreaSchema;
