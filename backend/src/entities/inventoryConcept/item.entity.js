"use strict";

import { EntitySchema } from "typeorm";

const itemScheme = new EntitySchema({
    name: "InventoryItem",
    tableName: "InventoryItems",
    columns:{
        item_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        nombre:{
            type:"varchar",
            nullable:false,
            length: 255,
        },
        descripcion:{
            type:"text",
            nullable:true,
        },
        stock_minimo:{
            type:"numeric",
            nullable:true,
        },
        activo:{
            type:"boolean",
            default:true,
            nullable:false,
        }
    },
    relations:{
        categoria:{
            type:"many-to-one",
            target:"ItemCategory",
            joinColumn:{
                name:"categoria_item_id",
                referencedColumnName:"categoria_item_id",
            }
            ,
            nullable:false,
        },
        unidad_medida:{
            type:"many-to-one",
            target:"UnitOfMeasure",
            joinColumn:{
                name:"unidad_medida_id",
                referencedColumnName:"unidad_medida_id",
            }
            ,
            nullable:false,
        }
    }
});

export default itemScheme;
