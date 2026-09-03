"use strict";

import { EntitySchema } from "typeorm";

const IntakeRecordScheme = new EntitySchema({
    name: "IntakeRecord",
    tableName: "IntakeRecords",
    columns:{
        id_intake_record:{
            type:"int",
            primary:true,
            generated:true,
        },
        fecha_entrega: {
            type: "date",
            nullable: true,
        },
        estado_reproduccion_inicial:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        edad_estimada:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        lugar_entrega:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        causa_entrega:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        condiciones_iniciales:{
            type:"text",
            nullable:true,
        },
        nombre_quien_entrega:{
            type:"varchar",
            length:255,
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
        animal:{
            target:"Animal",
            type:"one-to-one",
            joinColumn:{
                name: "id_animal",
                referencedColumnName: "id_animal"
            },
            nullable: false,
        },
        quien_recibe:{
            target:"User",
            type:"many-to-one",
            joinColumn:{
                name: "id_quien_recibe",
                referencedColumnName: "id_usuario"
            },
            nullable: true,
        }

    }
});

export default IntakeRecordScheme;
