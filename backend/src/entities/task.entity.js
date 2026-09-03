"use strict";

import { EntitySchema } from "typeorm";

const TaskSchema = new EntitySchema({
    name: "Task",
    tableName: "Tasks",
    columns: {
        id_tarea: {
            type: "int",
            primary: true,
            generated: true,
        },
        descripcion: {
            type: "text",
            nullable: false,
        },
        titulo: {
            type: "varchar",
            length: 255,
            nullable: false,
        },
        estado: {
            type: "enum",
            enum: ["pendiente", "en_progreso", "completada", "archivada"],
            default: "pendiente",
        },
        prioridad: {
            type: "enum",
            enum: ["baja", "media", "alta"],
            nullable: false,
        },
        fecha_limite: {
            type: "timestamp with time zone",
            nullable: false,
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
        },
    },
    relations: {
        creado_por: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "created_by",
                referencedColumnName: "id_usuario",
            },
            nullable: false,
        },
        area: {
            target: "Area",
            type: "many-to-one",
            joinColumn: {
                name: "area_id",
                referencedColumnName: "id_area",
            },
            nullable: false,
        },
        assignments: {
            target: "TaskAssignment",
            type: "one-to-many",
            inverseSide: "task",
            cascade: false,
        },
        comments: {
            target: "TaskComment",
            type: "one-to-many",
            inverseSide: "task",
            cascade: false,
        },
        history: {
            target: "TaskHistory",
            type: "one-to-many",
            inverseSide: "task",
            cascade: false,
        },
    },
});

export default TaskSchema;
