"use strict";

import { EntitySchema } from "typeorm";

const UserScheme = new EntitySchema({
  name: "User",
  tableName: "Users",
  columns: {
    id_usuario: {
      type: "int",
      primary: true,
      generated: true,
    },
    rut: {
      type: "varchar",
      length: 12,
      nullable: false,
      unique: true,
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
      length: 20,
      nullable: false,
      unique: true,
    },
    ["contrase\u00f1a"]: {
      type: "varchar",
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
    createdTasks: {
      target: "Task",
      type: "one-to-many",
      inverseSide: "creado_por",
    },
    taskAssignments: {
      target: "TaskAssignment",
      type: "one-to-many",
      inverseSide: "user",
    },
    assignedTaskRecords: {
      target: "TaskAssignment",
      type: "one-to-many",
      inverseSide: "asignado_por",
    },
    taskComments: {
      target: "TaskComment",
      type: "one-to-many",
      inverseSide: "author",
    },
    taskHistory: {
      target: "TaskHistory",
      type: "one-to-many",
      inverseSide: "actor",
    },
    registrations: {
      type: "one-to-many",
      target: "RegistrationShift",
      inverseSide: "user",
    },
    hospitalization: {
      target: "Hospitalization",
      type: "one-to-many",
      inverseSide: "user",
    },
    vetCheckups: {
      target: "VetCheckup",
      type: "one-to-many",
      inverseSide: "user",
    },
    procedures: {
      target: "Procedure",
      type: "one-to-many",
      inverseSide: "user",
    },
    Notice: {
      target: "Notice",
      type: "one-to-many",
      inverseSide: "user",
    },
    exam: {
      target: "Exam",
      type: "one-to-many",
      inverseSide: "user",
    },
    intakeRecordsReceived: {
      target: "IntakeRecord",
      type: "one-to-many",
      inverseSide: "quien_recibe",
    },
    area: {
      target: "Area",
      type: "many-to-one",
      joinColumn: {
        name: "area_id",
        referencedColumnName: "id_area",
      },
      nullable: false,
    },
    location: {
      target: "Location",
      type: "many-to-one",
      joinColumn: {
        name: "location_id",
        referencedColumnName: "ubicacion_id",
      },
      nullable: false,
    },
    UserRole: {
      target: "UserRole",
      type: "one-to-many",
      inverseSide: "user",
      nullable: false,
    },
    UserArea: {
      target: "UserArea",
      type: "one-to-many",
      inverseSide: "user",
    },
    fosterHomeMemberships: {
      target: "FosterHomeMember",
      type: "one-to-many",
      inverseSide: "user",
    },
    responsibleFosterHomes: {
      target: "FosterHome",
      type: "one-to-many",
      inverseSide: "responsable_usuario",
    },
  },
});

export default UserScheme;
