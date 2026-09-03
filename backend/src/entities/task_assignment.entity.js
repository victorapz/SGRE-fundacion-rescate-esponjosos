"use strict";

import { EntitySchema } from "typeorm";

const TaskAssignmentSchema = new EntitySchema({
    name: "TaskAssignment",
    tableName: "TaskAssignments",
    columns: {
        id_asignacion: {
            type: "int",
            primary: true,
            generated: true,
        },
        estado: {
            type: "enum",
            enum: ["pendiente", "en_progreso", "completada"],
            default: "pendiente",
            nullable: false,
        },
        fecha_asignacion: {
            type: "timestamp with time zone",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        },
        completed_at: {
            type: "timestamp with time zone",
            nullable: true,
        },
        nota_final: {
            type: "text",
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
        },
    },
    uniques: [
        {
            name: "UQ_task_assignment_task_user",
            columns: ["task", "user"],
        },
    ],
    relations: {
        task: {
            target: "Task",
            type: "many-to-one",
            joinColumn: {
                name: "task_id",
                referencedColumnName: "id_tarea",
            },
            nullable: false,
            onDelete: "CASCADE",
        },
        user: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "user_id",
                referencedColumnName: "id_usuario",
            },
            nullable: false,
            onDelete: "CASCADE",
        },
        asignado_por: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "assigned_by",
                referencedColumnName: "id_usuario",
            },
            nullable: false,
        },
        comments: {
            target: "TaskComment",
            type: "one-to-many",
            inverseSide: "assignment",
        },
        history: {
            target: "TaskHistory",
            type: "one-to-many",
            inverseSide: "assignment",
        },
    },
});

export default TaskAssignmentSchema;
