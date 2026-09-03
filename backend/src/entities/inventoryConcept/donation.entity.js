"use strict";

import { EntitySchema } from "typeorm";

const DonationScheme = new EntitySchema({
    name: "Donation",
    tableName: "Donations",
    columns:{
        donacion_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        motivo_donacion:{
            type:"text",
            nullable:false,
        },
        punto_encuentro:{
            type:"varchar",
            nullable:true,
            length: 255,
        },
        fecha_registro:{
            type:"date",
            nullable:false,
        },
        fecha_recepcion:{
            type:"date",
            nullable:true,
        },
        estado:{
            type:"enum",
            enum: ["PENDIENTE", "RECEPCIONADO", "CANCELADO"],
            default: "PENDIENTE",
            nullable:false,
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
        donor:{
            target:"Donor",
            type:"many-to-one",
            joinColumn: {
                name: "donante_id",
                referencedColumnName: "donante_id"
            },
            nullable: true
        },
        region:{
            target:"Region",
            type:"many-to-one",
            joinColumn: {
                name: "id_region",
                referencedColumnName: "id_region"
            },
            nullable: false
        },
        receiving_user:{
            target:"User",
            type:"many-to-one",
            joinColumn: {
                name: "id_usuario",
                referencedColumnName: "id_usuario"
            },
            nullable: false
        },
        donation_item:{
            target:"DonationItem",
            type:"one-to-many",
            inverseSide: "donation",
            nullable: false
        }

    }
})

export default DonationScheme;