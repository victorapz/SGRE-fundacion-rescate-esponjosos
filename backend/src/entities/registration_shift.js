"use strict";

import { EntitySchema } from "typeorm";

const registrationShiftScheme = new EntitySchema({
    name: "RegistrationShift",
    tableName: "RegistrationShifts",
    uniques: [
        {
            columns: ["user", "shift"],
        },
    ],
    columns:{
        turno_registro_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false
        },
        estado:{
            type:"enum",
            enum: ["INSCRITO", "PRESENTE", "AUSENTE", "CANCELADO"],
            default: "INSCRITO",
        },
        bitacora:{
            type:"text",
            nullable:true
        },
        createdAt:{
            type: "timestamp with time zone",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        },
        updatedAt:{
            type: "timestamp with time zone",
            default: () => "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            nullable: false,
        }
    },
    relations:{
        shift:{
            type:"many-to-one",
            target:"Shift",
            joinColumn:{
                name:"turno_id",
                referencedColumnName:"id_turno"
            },
            nullable:false
        },
        user:{
            type:"many-to-one",
            target:"User",
            joinColumn:{
                name:"id_usuario",
                referencedColumnName:"id_usuario"
            },
            nullable:false
        }
    }
});

export default registrationShiftScheme;