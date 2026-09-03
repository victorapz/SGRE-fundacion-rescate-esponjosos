"use strict";

import { EntitySchema } from "typeorm";

const RolePermissionScheme = new EntitySchema({
  name: "RolePermission",
  tableName: "RolePermissions",
  columns: {
    id_role_permission: {
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
    permission: {
      type: "many-to-one",
      target: "Permission",
      joinColumn: {
        name: "id_permission",
        referencedColumnName: "id_permiso"
      },
      nullable: false,
      onDelete: "CASCADE"
    }
  },
  uniques: [
  {
    name: "UQ_role_permission",
    columns: ["role", "permission"]
  }
]
});
export default RolePermissionScheme;