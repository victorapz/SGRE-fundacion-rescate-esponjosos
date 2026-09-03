"use strict";

import { EntitySchema } from "typeorm";

const DonationItemScheme = new EntitySchema({
    name: "DonationItem",
    tableName: "DonationItems",
    columns:{
        donacion_individual_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        cantidad:{
            type:"numeric",
            nullable:false,
        },
        cantidad_recepcionada:{
            type:"numeric",
            nullable:false,
            default:0
        },
        fecha_vencimiento:{
            type:"date",
            nullable:true,
        },
        fecha_apertura:{
            type:"date",
            nullable:true,
        },
        condiciones_almacenamiento:{
            type:"text",
            nullable:false,
        },
        condicion:{
            type:"enum",
            enum: ["NUEVO", "USADO_BUENO", "USADO_MALO", "DEFECTUOSO"],
            nullable:false,
        },
        estado:{
            type:"enum",
            enum: ["PENDIENTE", "PARCIAL", "COMPLETO", "CERRADO_INCOMPLETO", "CANCELADO"],
            default: "PENDIENTE",
            nullable:false,
        },
        observaciones:{
            type:"text",
            nullable:true,
        },
        recepcion_parcial_definitiva:{
            type:"boolean",
            nullable:false,
            default:false,
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
        donation:{
            target:"Donation",
            type:"many-to-one",
            joinColumn: {
                name: "donacion_id",
                referencedColumnName: "donacion_id"
            },
            nullable: false
        },
        item:{
            target:"InventoryItem",
            type:"many-to-one",
            joinColumn: {
                name: "item_id",   
                referencedColumnName: "item_id"
            },
            nullable: false
        },
        inventory_movement:{
            target:"InventoryMovement",
            type:"one-to-many",
            inverseSide: "donation_item",
            nullable: false
        },
        inventory_receipts: {
            target: "InventoryReceipt",
            type: "one-to-many",
            inverseSide: "donation_item",
        },
    }
})

export default DonationItemScheme;
