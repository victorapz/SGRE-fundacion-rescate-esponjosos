"use strict";

import { EntitySchema } from "typeorm";
import {
    ANIMAL_HEALTH_STATUS,
    ANIMAL_SPECIES,
} from "../../constants/animal.constants.js";

export const EstadoSalud = ANIMAL_HEALTH_STATUS;
export const Especies = ANIMAL_SPECIES;
export const EstadoAdopcion = {
  DISPONIBLE: "DISPONIBLE",
  EN_PROCESO: "EN_PROCESO",
  ADOPTADO: "ADOPTADO",
  NO_APTO: "NO_APTO"
};
export const TipoFechaNacimiento = {
  REAL: "REAL",
  ESTIMADA: "ESTIMADA",
  DESCONOCIDA: "DESCONOCIDA",
};

const AnimalScheme = new EntitySchema({
    name: "Animal",
    tableName: "Animals",
    columns:{
        id_animal:{
            type:"int",
            primary:true,
            generated:true,
            unique:true,
        },
        nombre:{
            type:"varchar",
            length:255,
            nullable:false,
            unique:true
        },
        sexo:{
            type:"varchar",
            length:10,
            nullable:false,
        },
        especie:{
            type:"enum",
            enum: Especies,
            nullable:false,
        },
        fecha_nacimiento: {
            type: "date",
            nullable: true,
        },
        tipo_fecha_nacimiento: {
            type: "enum",
            enum: TipoFechaNacimiento,
            nullable: false,
            default: TipoFechaNacimiento.DESCONOCIDA,
        },
        estado_salud_actual:{
            type:"enum",
            enum: EstadoSalud,
            nullable:false,
        },
        estado_adopcion:{
            type:"enum",
            enum: EstadoAdopcion,
            nullable:true,
        },
        fallecido:{
            type:"boolean",
            nullable:false,
            default: false,
        },
        apadrinable: {
            type: "boolean",
            nullable: false,
            default: false,
        },
        fecha_fallecimiento: {
            type: "date",
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
        }
    },
    relations:{
        region: {
        target: "Region",
        type: "many-to-one",
        joinColumn: {
            name: "region_id",           
            referencedColumnName: "id_region"
        },
        nullable: false
    },
    hospitalizations: {
        target: "Hospitalization",
        type: "one-to-many",
        inverseSide: "animal"
    },
    intakeRecords: {
        target: "IntakeRecord",
        type: "one-to-many",
        inverseSide: "animal"
    },
    vetCheckups: {
        target: "VetCheckup",
        type: "one-to-many",
        inverseSide: "animal"
    },
    exams: {
        target: "Exam",
        type: "one-to-many",
        inverseSide: "animal"
    },
    procedures: {
        target: "Procedure",
        type: "one-to-many",
        inverseSide: "animal"
    },
    sponsorships: {
        target: "Sponsorship",
        type: "one-to-many",
        inverseSide: "animal"
    },
    foster_assignments: {
        target: "FosterAssignment",
        type: "one-to-many",
        inverseSide: "animal"
    }
}
});

export default AnimalScheme;
