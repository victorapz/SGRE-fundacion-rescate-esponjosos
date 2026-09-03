"use strict"

import { EntitySchema } from "typeorm"

const ShiftSchema = new EntitySchema({
    name:"Shift",
    tableName:"Shifts",
    columns:{
        id_turno: {
            type:"int",
            primary:true,
            generated:true,
        },
        fecha:{
            type:"date",
            nullable: false,
        },
        titulo:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        hora_inicio:{
            type:"time",
            nullable:false
        },
        hora_fin:{
            type:"time",
            nullable:false
        },
        estado:{
            type:"boolean",
            default:true
        },
        cantidad_maxima:{
            type:"int",
            nullable:false,
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
        registrations: {
            type: "one-to-many",
            target: "RegistrationShift",
            inverseSide: "shift"
        }
    }
})

export default ShiftSchema;