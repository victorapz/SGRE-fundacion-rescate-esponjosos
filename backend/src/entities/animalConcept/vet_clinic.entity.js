"use strict";

import { EntitySchema } from "typeorm";

const VetClinicScheme = new EntitySchema({
    name: "VetClinic",
    tableName: "VetClinics",
    columns:{
        id_clinica:{
            type:"int",
            primary:true,
            generated:true,
        },
        nombre:{
            type:"varchar",
            length:255,
            nullable:false,
            unique:true,
        },
        activo: {
            type: "boolean",
            nullable: false,
            default: true,
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
        Veterinarian:{
            target:"Veterinarian",
            type:"one-to-many",
            inverseSide:"clinic"
        },
        veterinarianClinics: {
            target: "VeterinarianClinic",
            type: "one-to-many",
            inverseSide: "clinic",
        },
        exam:{
            target:"Exam",
            type:"one-to-many",
            inverseSide:"clinic"
        },
        hospitalization:{
            target:"Hospitalization",
            type:"one-to-many",
            inverseSide:"clinic"
        },
        vetCheckups: {
        target: "VetCheckup",
        type: "one-to-many",
        inverseSide: "clinic"
    },
        procedures: {
        target: "Procedure",
        type: "one-to-many",
        inverseSide: "clinic"
    },
        location: {
            target: "Location",
            type: "many-to-one",
            joinColumn: {
                name: "location_id",
                referencedColumnName: "ubicacion_id"
            },
            nullable: false
        }
        
    }
});

export default VetClinicScheme;
