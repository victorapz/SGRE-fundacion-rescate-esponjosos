"use strict";

import { EntitySchema } from "typeorm";

const FosterHomeScheme = new EntitySchema({
    name: "FosterHome",
    tableName: "FosterHomes",
    columns:{
        id_hogar_temporal:{
            type:"int",
            primary:true,
            generated:true,
        },
        observaciones: {
            type: "text",
            nullable: true,
        },
        activo:{
            type:"boolean",
            nullable:false,
            default:true,
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
        responsable_usuario: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "responsable_usuario_id",
                referencedColumnName: "id_usuario"
            },
            nullable: true
        },
        miembros: {
            target: "FosterHomeMember",
            type: "one-to-many",
            inverseSide: "foster_home"
        },
        foster_assignments: {
            target: "FosterAssignment",
            type: "one-to-many",
            inverseSide: "foster_home",
        },
        allowed_animals: {
            target: "FosterHomeAllowedAnimal",
            type: "one-to-many",
            inverseSide: "foster_home",
        },
        observations: {
            target: "FosterHomeObservation",
            type: "one-to-many",
            inverseSide: "foster_home",
        }
    }
});

export default FosterHomeScheme;
