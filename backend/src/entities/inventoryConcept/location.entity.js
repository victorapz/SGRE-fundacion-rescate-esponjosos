"use strict";

import { EntitySchema } from "typeorm";

export const LOCATION_TYPES = {
    BODEGA: "BODEGA",
    HOGAR_TEMPORAL: "HOGAR_TEMPORAL",
    PERSONA: "PERSONA",
    CLINICA: "CLINICA",
    PROVEEDOR: "PROVEEDOR",
    OTRA: "OTRA",
};

const locationScheme = new EntitySchema({
    name: "Location",
    tableName: "Locations",
    columns:{
        ubicacion_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        tipo:{
            type:"enum",
            enum: Object.values(LOCATION_TYPES),
            nullable:false,
        },
        nombre_ubicacion:{
            type:"varchar",
            nullable:false,
            length: 255,
        },
        direccion:{
            type:"varchar",
            nullable:false,
            length: 255,
        },
        activo: {
            type:"boolean",
            nullable:false,
            default:true,
        },
        observaciones: {
            type:"text",
            nullable:true,
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
    relations:{
        region: {
            target: "Region",
            type: "many-to-one",
            joinColumn: {
                name: "region_id",
                referencedColumnName: "id_region",
            },
            nullable: false,
        },
        comuna: {
            target: "Comuna",
            type: "many-to-one",
            joinColumn: {
                name: "comuna_id",
                referencedColumnName: "id_comuna",
            },
            nullable: false,
        },
    }
});

export default locationScheme;  
