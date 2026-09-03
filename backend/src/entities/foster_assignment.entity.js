"use strict";

import { EntitySchema } from "typeorm";


export const Estado = {
  ACTIVO: "ACTIVO",
  FINALIZADO: "FINALIZADO",
  TRASLADADO: "TRASLADADO",
};

const FosterAssignmentScheme = new EntitySchema({
    name: "FosterAssignment",
    tableName: "FosterAssignments",
    columns:{
        id_foster_assignment:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        fecha_inicio:{
            type:"date",
            nullable:false,
        },
        fecha_fin:{
            type:"date",
            nullable:true,
        },
        estado:{
            type:"enum",
            enum: Estado,
            default: Estado.ACTIVO,
            nullable:false,
        },
        motivo_termino:{
            type:"text",
            nullable:true,
        },
        observaciones:{
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
        foster_home: {
            target: "FosterHome",
            type: "many-to-one",
            joinColumn: {
                name: "hogar_temporal_id",
                referencedColumnName: "id_hogar_temporal"
            },
            nullable: false
        },
        animal:{
            target: "Animal",
            type: "many-to-one",
            joinColumn: {
                name: "animal_id",
                referencedColumnName: "id_animal"
            },
            nullable: false   
        }
    }

});

export default FosterAssignmentScheme;