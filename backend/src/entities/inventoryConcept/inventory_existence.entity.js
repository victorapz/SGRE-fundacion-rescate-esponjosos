"use strict";

import { EntitySchema } from "typeorm";

const InventoryExistenceScheme = new EntitySchema({
  name: "InventoryExistence",
  tableName: "InventoryExistences",
  columns: {
    existencia_id: {
      type: "int",
      primary: true,
      generated: true,
      nullable: false,
    },
    cantidad_actual: {
      type: "numeric",
      nullable: false,
    },
    fecha_vencimiento: {
      type: "date",
      nullable: true,
    },
    fecha_apertura: {
      type: "date",
      nullable: true,
    },
    condicion: {
      type: "enum",
      enum: ["NUEVO", "USADO_BUENO", "USADO_MALO", "DEFECTUOSO"],
      nullable: true,
    },
    estado: {
      type: "enum",
      enum: ["DISPONIBLE", "AGOTADO", "DESCARTADO"],
      default: "DISPONIBLE",
      nullable: false,
    },
    origen_tipo: {
      type: "enum",
      enum: ["DONACION", "COMPRA", "AJUSTE", "MANUAL", "CARGA_INICIAL"],
      nullable: false,
    },
    origen_id: {
      type: "int",
      nullable: true,
    },
    observaciones: {
      type: "text",
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
    item: {
      target: "InventoryItem",
      type: "many-to-one",
      joinColumn: {
        name: "item_id",
        referencedColumnName: "item_id",
      },
      nullable: false,
    },
    location: {
      target: "Location",
      type: "many-to-one",
      joinColumn: {
        name: "ubicacion_id",
        referencedColumnName: "ubicacion_id",
      },
      nullable: false,
    },
  },
});

export default InventoryExistenceScheme;
