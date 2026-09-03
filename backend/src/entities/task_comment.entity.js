"use strict";

import { EntitySchema } from "typeorm";

const TaskCommentSchema = new EntitySchema({
    name: "TaskComment",
    tableName: "TaskComments",
    columns: {
        id_comentario: {
            type: "int",
            primary: true,
            generated: true,
        },
        tipo: {
            type: "enum",
            enum: ["general", "assignment"],
            nullable: false,
            default: "general",
        },
        comentario: {
            type: "text",
            nullable: false,
        },
        createdAt: {
            type: "timestamp with time zone",
            default: () => "CURRENT_TIMESTAMP",
            nullable: false,
        },
    },
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
        assignment: {
            target: "TaskAssignment",
            type: "many-to-one",
            joinColumn: {
                name: "assignment_id",
                referencedColumnName: "id_asignacion",
            },
            nullable: true,
            onDelete: "CASCADE",
        },
        author: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "author_id",
                referencedColumnName: "id_usuario",
            },
            nullable: false,
        },
    },
});

export default TaskCommentSchema;
