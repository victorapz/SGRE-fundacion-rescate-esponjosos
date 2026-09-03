"use strict";

import { EntitySchema } from "typeorm";

const AnimalDietsScheme = new EntitySchema({
    name: "AnimalDiets",
    tableName: "AnimalDiets",
    columns:{
        id_animal_dieta:{
            type:"int",
            primary:true,
            generated:true,
        },
        marca_alimento:{
            type:"varchar",
            length:255,
            nullable:false,
        },
        horario_alimentacion:{
            type:"varchar",
            length:255,
            nullable:true,
        },
        notas:{
            type:"text",
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
            type: "many-to-one",
            joinColumn: {
                name: "id_animal",
                referencedColumnName: "id_animal"
            },
            nullable: false
            },
        },
    

})

export default AnimalDietsScheme;   