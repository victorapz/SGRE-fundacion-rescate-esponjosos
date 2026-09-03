"use strict";

import { EntitySchema } from "typeorm";

const UserAreaSchema = new EntitySchema({
  name: "UserArea",
  tableName: "UserAreas",
  columns: {
    id_user_area: {
      type: "int",
      primary: true,
      generated: true,
    },
    createdAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: {
        name: "id_user",
        referencedColumnName: "id_usuario",
      },
      nullable: false,
      onDelete: "CASCADE",
    },
    area: {
      type: "many-to-one",
      target: "Area",
      joinColumn: {
        name: "id_area",
        referencedColumnName: "id_area",
      },
      nullable: false,
      onDelete: "CASCADE",
    },
  },
  uniques: [
    {
      name: "UQ_user_area",
      columns: ["user", "area"],
    },
  ],
});

export default UserAreaSchema;
