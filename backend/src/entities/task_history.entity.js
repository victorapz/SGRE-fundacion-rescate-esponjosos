"use strict";

import { EntitySchema } from "typeorm";

const TaskHistorySchema = new EntitySchema({
    name: "TaskHistory",
    tableName: "TaskHistory",
    columns: {
        id_historial: {
            type: "int",
            primary: true,
            generated: true,
        },
        entity_type: {
            type: "enum",
            enum: ["task", "assignment"],
            nullable: false,
        },
        action: {
            type: "enum",
            enum: [
                "created",
                "updated",
                "assignment_added",
                "assignment_removed",
                "status_changed",
                "archived",
            ],
            nullable: false,
        },
        from_status: {
            type: "enum",
            enum: ["pendiente", "en_progreso", "completada", "archivada"],
            nullable: true,
        },
        to_status: {
            type: "enum",
            enum: ["pendiente", "en_progreso", "completada", "archivada"],
            nullable: true,
        },
        comentario: {
            type: "text",
            nullable: true,
        },
        metadata: {
            type: "jsonb",
            nullable: true,
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
        actor: {
            target: "User",
            type: "many-to-one",
            joinColumn: {
                name: "actor_id",
                referencedColumnName: "id_usuario",
            },
            nullable: false,
        },
    },
});

export default TaskHistorySchema;
