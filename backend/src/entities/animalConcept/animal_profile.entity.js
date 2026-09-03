"use strict";

import { EntitySchema } from "typeorm";

const AnimalProfileScheme = new EntitySchema({
    name: "AnimalProfile",
    tableName: "AnimalProfiles",
    columns:{
        id_perfil_animal:{
            type:"int",
            primary:true,
            generated:true,
        },
        personalidad:{
            type:"varchar",
            length:255,
            nullable:false, 
        },
        gustos:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        disgustos:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        historia:{
            type:"text",
            nullable:false,
        },
        cuidados_especiales:{
            type:"text",
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
        animal: {
            target: "Animal",
            type: "one-to-one",
                joinColumn: {
                    name: "animal_id",
                    referencedColumnName: "id_animal"
                },
            nullable: false,
        }
    }
})

export default AnimalProfileScheme;