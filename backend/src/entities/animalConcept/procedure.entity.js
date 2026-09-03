"use strict";

import { EntitySchema } from "typeorm";
const ProcedureScheme = new EntitySchema({
    name: "Procedure",
    tableName: "Procedures",
    columns:{
        id_procedimiento:{
            type:"int",
            primary:true,
            generated:true,
        },
        fecha_procedimiento:{
            type:"varchar",
            length:255,
            nullable:false, 
        },
        tipo:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        motivo:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        observaciones:{
            type:"text",
        },
        farmacos_recetados:{
            type:"text",
        },
        precio:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        monto_total: {
            type: "numeric",
            precision: 14,
            scale: 2,
            nullable: true,
        },
        moneda: {
            type: "varchar",
            length: 3,
            default: "CLP",
            nullable: false,
        },
        genera_cuenta_por_pagar: {
            type: "boolean",
            default: false,
            nullable: false,
        },
        fecha_vencimiento_pago: {
            type: "date",
            nullable: true,
        },
        observacion_financiera: {
            type: "text",
            nullable: true,
        },
        indicaciones:{
            type:"text",
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
        },
        }


});

export default ProcedureScheme;
