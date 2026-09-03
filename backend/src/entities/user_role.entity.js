"use strict";

import { EntitySchema } from "typeorm";

const UserRoleScheme = new EntitySchema({
  name: "UserRole",
  tableName: "UserRoles",
  columns: {
    id_user_role: {
      type: "int",
      primary: true,
      generated: true,
    },
    createdAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    }
  },
  relations: {
    role: {
      type: "many-to-one",
      target: "Role",
      joinColumn: {
        name: "id_role",
        referencedColumnName: "id_rol"
      },
      nullable: false,
      onDelete: "CASCADE"
    },
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: {
        name: "id_user",
        referencedColumnName: "id_usuario"
      },
      nullable: false,
      onDelete: "CASCADE"
    }
  },
  uniques: [
  {
    name: "UQ_user_role",
    columns: ["user", "role"]
  }
]
});
export default UserRoleScheme;