"use strict";

import { EntitySchema } from "typeorm";

const donorScheme = new EntitySchema({
    name: "Donor",
    tableName: "Donors",
    columns:{
        donante_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false
        },
        nombre:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        apellido:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        telefono:{
            type:"varchar",
            length:20,
            nullable:true,
        },
        email:{
            type:"varchar",
            length:255,
            nullable:true,
            unique:true,
        },
        usuario_instagram:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        direccion: {
            type: "text",
            nullable: true,
        },
        observaciones: {
            type: "text",
            nullable: true,
        },
        activo: {
            type: "boolean",
            nullable: false,
            default: true,
        }
    },
    relations:{
        donation:{
            type:"one-to-many",
            target:"Donation",
            inverseSide: "donor",
            nullable: true
        },
        transactions: {
            type: "one-to-many",
            target: "Transaction",
            inverseSide: "donor",
            nullable: true
        },
        payment_orders: {
            type: "one-to-many",
            target: "PaymentOrder",
            inverseSide: "donor",
            nullable: true
        }
    }
});

export default donorScheme;
