"use strict";

import { EntitySchema } from "typeorm";

const HospitalizationScheme = new EntitySchema({
    name: "Hospitalization",
    tableName: "Hospitalizations",
    columns:{  
        id_hospitalizacion:{
            type:"int",
            primary:true,
            generated:true,
        },
        fecha_ingreso: {
            type: "varchar",
            length: 20,
            nullable: false,
        },
        fecha_alta:{
            type: "varchar",
            length: 20,
            nullable: true,
        },
        motivo:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        diagnostico:{
            type:"text",
            nullable:true
        },
        pronostico:{
            type:"text",
            nullable:true
        },
        peso_ingreso:{
            type:"numeric",
            nullable:true
        },
        temperatura_ingreso:{
            type:"numeric",
            nullable:true
        },
        farmacos_recetados:{
            type:"text",
            nullable:true
        },
        examenes_realizados:{
            type:"text",
            nullable:true
        },
        indicaciones_hospital:{
            type:"text",
            nullable:true
        },
        indicaciones_casa:{
            type:"text",
            nullable:true
        },
        precio:{
            type:"varchar",
            length:20,
            nullable:true
        },
        monto_total: {
            type: "numeric",
            precision: 14,
            scale: 2,
            nullable: true
        },
        moneda: {
            type: "varchar",
            length: 3,
            default: "CLP",
            nullable: false
        },
        genera_cuenta_por_pagar: {
            type: "boolean",
            default: false,
            nullable: false
        },
        fecha_vencimiento_pago: {
            type: "date",
            nullable: true
        },
        observacion_financiera: {
            type: "text",
            nullable: true
        },
        fecha_control_post_alta:{
            type: "varchar",
            length: 20,
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
        veterinarian: {
            target: "Veterinarian",
            type: "many-to-one",
            joinColumn: {
                name: "id_veterinario",
                referencedColumnName: "id_veterinario"
            },
            nullable: true,
        },
        clinic: {
            target: "VetClinic",
            type: "many-to-one",
            joinColumn: {
                name: "id_clinica",
                referencedColumnName: "id_clinica"
            },
            nullable: false,
        },
        user:{
            target:"User",
            type:"many-to-one",
            joinColumn:{
                name: "id_usuario",
                referencedColumnName: "id_usuario"
            },
            nullable: false,
        },
        animal:{
            target:"Animal",
            type:"many-to-one",
            joinColumn:{
                name: "id_animal",
                referencedColumnName: "id_animal"
            },
            nullable: false,
        }
    }
});

export default HospitalizationScheme;
