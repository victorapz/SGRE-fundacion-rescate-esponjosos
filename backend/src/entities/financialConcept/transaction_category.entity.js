"use strict";

import { EntitySchema } from "typeorm";

const TransactionCategoryScheme = new EntitySchema({
  name: "TransactionCategory",
  tableName: "TransactionCategories",
  columns: {
    categoria_transaccion_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    clave: {
      type: "varchar",
      length: 120,
      unique: true,
      nullable: false,
    },
    nombre: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    tipo: {
      type: "enum",
      enum: ["INGRESO", "EGRESO", "AMBOS"],
      nullable: false,
    },
    descripcion: {
      type: "text",
      nullable: true,
    },
    activo: {
      type: "boolean",
      default: true,
      nullable: false,
    },
    es_sistema: {
      type: "boolean",
      default: false,
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
    categoria_padre: {
      target: "TransactionCategory",
      type: "many-to-one",
      joinColumn: {
        name: "categoria_padre_id",
        referencedColumnName: "categoria_transaccion_id",
      },
      nullable: true,
    },
    subcategorias: {
      target: "TransactionCategory",
      type: "one-to-many",
      inverseSide: "categoria_padre",
    },
    transactions: {
      target: "Transaction",
      type: "one-to-many",
      inverseSide: "category",
    },
    payable_accounts: {
      target: "PayableAccount",
      type: "one-to-many",
      inverseSide: "category",
    },
  },
});

export default TransactionCategoryScheme;
