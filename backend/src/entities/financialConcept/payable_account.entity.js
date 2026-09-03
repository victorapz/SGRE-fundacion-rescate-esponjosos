"use strict";

import { EntitySchema } from "typeorm";

const PayableAccountScheme = new EntitySchema({
  name: "PayableAccount",
  tableName: "PayableAccounts",
  columns: {
    cuenta_por_pagar_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    origen_tipo: {
      type: "varchar",
      length: 120,
      nullable: true,
    },
    origen_id: {
      type: "int",
      nullable: true,
    },
    proveedor_tipo: {
      type: "varchar",
      length: 120,
      nullable: true,
    },
    proveedor_id: {
      type: "int",
      nullable: true,
    },
    descripcion: {
      type: "text",
      nullable: true,
    },
    moneda: {
      type: "varchar",
      length: 3,
      default: "CLP",
      nullable: false,
    },
    monto_total: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    monto_pagado: {
      type: "numeric",
      precision: 14,
      scale: 2,
      default: 0,
      nullable: false,
    },
    saldo_pendiente: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    fecha_emision: {
      type: "date",
      nullable: false,
    },
    fecha_vencimiento: {
      type: "date",
      nullable: true,
    },
    estado: {
      type: "enum",
      enum: ["PENDIENTE", "PAGADA_PARCIAL", "PAGADA", "VENCIDA", "ANULADA", "CONDONADA"],
      default: "PENDIENTE",
      nullable: false,
    },
    metadata: {
      type: "jsonb",
      nullable: true,
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
    category: {
      target: "TransactionCategory",
      type: "many-to-one",
      joinColumn: {
        name: "categoria_transaccion_id",
        referencedColumnName: "categoria_transaccion_id",
      },
      nullable: true,
    },
    created_by: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "created_by",
        referencedColumnName: "id_usuario",
      },
      nullable: true,
    },
    transactions: {
      target: "Transaction",
      type: "one-to-many",
      inverseSide: "payable_account",
    },
    payments: {
      target: "PayablePayment",
      type: "one-to-many",
      inverseSide: "payableAccount",
    },
  },
});

export default PayableAccountScheme;
