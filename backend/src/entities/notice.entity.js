"use strict"

import { EntitySchema } from "typeorm"

const NoticeSchema = new EntitySchema({
    name:"Notice",
    tableName:"Notices",
    columns:{
        id_aviso: {
            type:"int",
            primary:true,
            generated:true,
        },
        estado:{
            type:"enum",
            enum: ["BORRADOR", "PUBLICADO", "ARCHIVADO"],
            nullable: false,
            default: "BORRADOR"
        },
        titulo:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        slug: {
            type: "varchar",
            length: 255,
            nullable: true,
            unique: true,
        },
        resumen: {
            type: "text",
            nullable: true,
        },
        descripcion:{
            type:"text",
            nullable:false
        },
        fecha_publicacion: {
            type: "varchar",
            length: 255,
            nullable: true
        },
        publico:{
            type:"boolean",
            nullable:false,
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
        user:{
            target:"User",
            type:"many-to-one",
            joinColumn: {
                name: "id_user",
                referencedColumnName: "id_usuario"
            },
            nullable: false
        }
    }
});

export default NoticeSchema;
