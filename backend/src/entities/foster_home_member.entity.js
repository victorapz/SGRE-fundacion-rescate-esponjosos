"use strict";

import { EntitySchema } from "typeorm";

export const FosterHomeMemberRole = {
  RESPONSABLE: "RESPONSABLE",
  MIEMBRO: "MIEMBRO",
};

const FosterHomeMemberSchema = new EntitySchema({
  name: "FosterHomeMember",
  tableName: "FosterHomeMembers",
  columns: {
    id_foster_home_member: {
      type: "int",
      primary: true,
      generated: true,
    },
    rol: {
      type: "enum",
      enum: FosterHomeMemberRole,
      nullable: false,
      default: FosterHomeMemberRole.MIEMBRO,
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
    user: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "user_id",
        referencedColumnName: "id_usuario",
      },
      nullable: false,
      onDelete: "CASCADE",
    },
  },
  uniques: [
    {
      name: "UQ_foster_home_member_user",
      columns: ["foster_home", "user"],
    },
  ],
});

export default FosterHomeMemberSchema;
