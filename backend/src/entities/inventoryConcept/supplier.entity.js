"use strict";

import { EntitySchema } from "typeorm";

const SupplierScheme = new EntitySchema({
  name: "Supplier",
  tableName: "Suppliers",
  columns: {
    proveedor_id: {
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
    telefono: {
      type: "varchar",
      length: 50,
      nullable: true,
    },
    email: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    observaciones: {
      type: "text",
      nullable: true,
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
    purchases: {
      target: "Purchase",
      type: "one-to-many",
      inverseSide: "supplier",
    },
    location:{
            type:"many-to-one",
            target:"Location",
            joinColumn:{
                name:"ubicacion_id",
                referencedColumnName:"ubicacion_id",
            },
            nullable:true,
        },
  },
});

export default SupplierScheme;
