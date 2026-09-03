"use strict";

import { EntitySchema } from "typeorm";

const ItemCategoryScheme = new EntitySchema({
    name: "ItemCategory",
    tableName: "ItemCategories",
    columns:{
        categoria_item_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false
        },
        nombre_categoria:{
            type:"varchar",
            nullable:false,
            length: 255,
        },
        activo:{
            type:"boolean",
            nullable:false,
            default:true,
        }
    },
    relations:{}
});

export default ItemCategoryScheme;
