"use strict";

import { EntitySchema } from "typeorm";

const VeterinarianScheme = new EntitySchema({
    name: "Veterinarian",
    tableName: "Veterinarians",
    columns:{
        id_veterinario:{
            type:"int",
            primary:true,
            generated:true,
        },
        nombre:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        apellido:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        email:{
            type:"varchar",
            length:255,
            nullable:false,
            unique:true,
        },
        telefono:{
            type:"varchar",
            length:20,
            nullable:false,
            unique:true,
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
    exams: {
        target: "Exam",
        type: "one-to-many",
        inverseSide: "veterinarian"
    },
    clinic: {
        target: "VetClinic",
        type: "many-to-one",
        joinColumn: {
            name: "id_clinica", 
            referencedColumnName: "id_clinica"
        },
        nullable: true
    },
    veterinarianClinics: {
        target: "VeterinarianClinic",
        type: "one-to-many",
        inverseSide: "veterinarian",
    },
    hospitalizations: {
        target: "Hospitalization",
        type: "one-to-many",
        inverseSide: "veterinarian"
    },
    vetCheckups: {
        target: "VetCheckup",
        type: "one-to-many",
        inverseSide: "veterinarian"
    },
    procedures: {
        target: "Procedure",
        type: "one-to-many",
        inverseSide: "veterinarian"
    }
}
});

export default VeterinarianScheme;
