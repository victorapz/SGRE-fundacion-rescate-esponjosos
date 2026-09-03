"use strict";

import { EntitySchema } from "typeorm";

const TransactionScheme = new EntitySchema({
  name: "Transaction",
  tableName: "Transactions",
  columns: {
    transaccion_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },

    tipo: {
      type: "enum",
      enum: ["INGRESO", "EGRESO", "REEMBOLSO", "AJUSTE"],
      nullable: false,
    },

    descripcion: {
      type: "text",
      nullable: true,
    },

    moneda: {
      type: "varchar",
      length: 3,
      nullable: false,
      default: "CLP",
    },

    monto_bruto: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },

    monto_fee: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
      default: 0,
    },

    monto_neto: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },

    fecha_transaccion: {
      type: "timestamp with time zone",
      nullable: false,
    },

    estado: {
      type: "enum",
      // Mantiene estados legacy para no romper compatibilidad con seeds y datos previos.
      enum: [
        "CONFIRMADA",
        "ANULADA",
        "REEMBOLSADA",
        "PARCIALMENTE_REEMBOLSADA",
        "COMPLETADA",
        "CANCELADA",
        "FALLIDA",
        "PENDIENTE",
      ],
      default: "CONFIRMADA",
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

    referencia_externa: {
      type: "varchar",
      length: 255,
      nullable: true,
    },

    idempotencia_key: {
      type: "varchar",
      length: 255,
      nullable: true,
      unique: true,
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

    payment_provider: {
      target: "PaymentProvider",
      type: "many-to-one",
      joinColumn: {
        name: "proveedor_pago_id",
        referencedColumnName: "proveedor_pago_id",
      },
      nullable: true,
    },

    payment_order: {
      target: "PaymentOrder",
      type: "many-to-one",
      joinColumn: {
        name: "orden_pago_id",
        referencedColumnName: "orden_pago_id",
      },
      nullable: true,
    },

    donor: {
      target: "Donor",
      type: "many-to-one",
      joinColumn: {
        name: "donante_id",
        referencedColumnName: "donante_id",
      },
      nullable: true,
    },
    payable_account: {
      target: "PayableAccount",
      type: "many-to-one",
      joinColumn: {
        name: "cuenta_por_pagar_id",
        referencedColumnName: "cuenta_por_pagar_id",
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

    purchase: {
      target: "Purchase",
      type: "one-to-many",
      inverseSide: "transaction",
    },
    payable_payments: {
      target: "PayablePayment",
      type: "one-to-many",
      inverseSide: "transaction",
    },
    subscription_payments: {
      target: "SubscriptionPayment",
      type: "one-to-many",
      inverseSide: "transaction",
    },
  },
});

export default TransactionScheme;
