"use strict";

import { EntitySchema } from "typeorm";

const RegionSchema = new EntitySchema({
    name: "Region",
    tableName: "Regions",

    columns: {
        id_region: {
            type: "int",
            primary: true,
            generated: true,
        },
        clave: {
            type: "varchar",
            length: 50,
            unique: true,
        },
        nombre: {
            type: "varchar",
            length: 255,
        },
        activo: {
            type: "boolean",
            nullable: false,
            default: true,
        },
        orden: {
            type: "int",
            nullable: false,
            default: 0,
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
        }
    },

    relations: {
        animals: {
            target: "Animal",
            type: "one-to-many",
            inverseSide: "region",
        },
        comunas: {
            target: "Comuna",
            type: "one-to-many",
            inverseSide: "region",
        },
        locations: {
            target: "Location",
            type: "one-to-many",
            inverseSide: "region",
        },
    },
});

export default RegionSchema;
