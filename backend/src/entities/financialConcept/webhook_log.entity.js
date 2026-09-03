"use strict";

import { EntitySchema } from "typeorm";

const WebhookLogScheme = new EntitySchema({
  name: "WebhookLog",
  tableName: "WebhookLogs",
  uniques: [
    {
      name: "UQ_WebhookLogs_Provider_Event",
      columns: ["payment_provider", "proveedor_evento_id"],
    },
  ],
  columns: {
    webhook_log_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    evento_tipo: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    proveedor_evento_id: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    payload: {
      type: "jsonb",
      nullable: true,
    },
    headers: {
      type: "jsonb",
      nullable: true,
    },
    firma_verificada: {
      type: "boolean",
      default: false,
      nullable: false,
    },
    estado: {
      type: "enum",
      enum: ["RECIBIDO", "VERIFICADO", "PROCESADO", "IGNORADO", "ERROR"],
      default: "RECIBIDO",
      nullable: false,
    },
    recibido_en: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },
    procesado_en: {
      type: "timestamp with time zone",
      nullable: true,
    },
    intentos: {
      type: "int",
      default: 0,
      nullable: false,
    },
    error_mensaje: {
      type: "text",
      nullable: true,
    },
    referencia_tipo: {
      type: "varchar",
      length: 120,
      nullable: true,
    },
    referencia_id: {
      type: "int",
      nullable: true,
    },
    createdAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },
  },
  relations: {
    payment_provider: {
      target: "PaymentProvider",
      type: "many-to-one",
      joinColumn: {
        name: "proveedor_pago_id",
        referencedColumnName: "proveedor_pago_id",
      },
      nullable: true,
    },
  },
});

export default WebhookLogScheme;
