"use strict";

import { EntitySchema } from "typeorm";

const PayablePaymentScheme = new EntitySchema({
  name: "PayablePayment",
  tableName: "PayablePayments",
  columns: {
    pago_cuenta_por_pagar_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    monto_aplicado: {
      type: "numeric",
      precision: 14,
      scale: 2,
      nullable: false,
    },
    fecha_pago: {
      type: "date",
      nullable: false,
    },
    createdAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },
  },
  relations: {
    payableAccount: {
      target: "PayableAccount",
      type: "many-to-one",
      joinColumn: {
        name: "cuenta_por_pagar_id",
        referencedColumnName: "cuenta_por_pagar_id",
      },
      nullable: false,
    },
    transaction: {
      target: "Transaction",
      type: "many-to-one",
      joinColumn: {
        name: "transaccion_id",
        referencedColumnName: "transaccion_id",
      },
      nullable: false,
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
  },
});

export default PayablePaymentScheme;
