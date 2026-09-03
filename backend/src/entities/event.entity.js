"use strict"

import { EntitySchema } from "typeorm"

export const EventCategory = {
    RECAUDACION_FONDOS: "RECAUDACION_FONDOS",
    EDUCATIVO: "EDUCATIVO",
    COMUNITARIO: "COMUNITARIO",
    INSTITUCIONAL: "INSTITUCIONAL",
    CULTURAL: "CULTURAL",
}

const EventSchema = new EntitySchema({
    name:"Event",
    tableName:"Events",
    columns:{
        id_evento: {
            type:"int",
            primary:true,
            generated:true,
        },
        titulo:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        fecha_inicio: {
            type: "timestamp with time zone",
            nullable: false,
        },
        fecha_fin: {
            type: "timestamp with time zone",
            nullable: false,
        },
        todo_el_dia: {
            type: "boolean",
            nullable: false,
            default: false,
        },
        activo: {
            type: "boolean",
            nullable: false,
            default: true,
        },
        categoria: {
            type: "enum",
            enum: EventCategory,
            nullable: false,
            default: EventCategory.COMUNITARIO,
        },
        lugar:{
            type:"varchar",
            nullable:false,
        },
        descripcion:{
            type:"text",
            nullable:false
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
    }
})

export default EventSchema;
