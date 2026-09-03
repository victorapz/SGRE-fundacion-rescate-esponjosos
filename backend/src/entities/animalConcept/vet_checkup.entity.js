"use strict";

import { EntitySchema } from "typeorm";
const VetCheckupScheme = new EntitySchema({
    name: "VetCheckup",
    tableName: "VetCheckups",  
    columns:{
        id_control_veterinario:{
            type:"int",
            primary:true,
            generated:true,
        },
        numero_control:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        fecha:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        motivo:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        peso:{
            type:"numeric", 
            nullable:true,
        },
        temperatura:{
            type:"numeric",
            nullable:true
        },
        diagnostico:{
            type:"text",
            nullable:true
        },
        observaciones:{
            type:"text",
            nullable:true
        },
        indicaciones_casa:{
            type:"text",
            nullable:true
        },
        indicaciones_examenes:{
            type:"text",
            nullable:true
        },
        indicaciones_procedimiento:{
            type:"text",
            nullable:true
        },
        precio:{
            type:"varchar",
            length:40,
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
        fecha_proximo_control:{
            type:"varchar",
            length:255,
            nullable:true
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
    animal: {
        target: "Animal",
        type: "many-to-one",
        joinColumn: {
            name: "id_animal",
            referencedColumnName: "id_animal"
        },
        nullable: false
    },
    veterinarian:{
        target: "Veterinarian",
        type: "many-to-one",
        joinColumn: {
            name: "id_veterinario",
            referencedColumnName: "id_veterinario"
        },
        nullable: true
    },
    clinic:{
        target: "VetClinic",
        type: "many-to-one",
        joinColumn: {
            name: "id_clinica",
            referencedColumnName: "id_clinica"
        },
        nullable: false
    },
    user:{
        target:"User",
        type:"many-to-one",
        joinColumn:{
            name: "id_usuario",
            referencedColumnName: "id_usuario"
        },
        nullable: false,    
    }
}
});
export default VetCheckupScheme;
