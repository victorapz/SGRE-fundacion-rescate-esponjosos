"use strict";

import { EntitySchema } from "typeorm";

const unitOfMeasureScheme = new EntitySchema({
    name: "UnitOfMeasure",
    tableName: "UnitsOfMeasure",
    columns:{
        unidad_medida_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        nombre:{
            type:"varchar",
            length:100,
            nullable:false,
        },
        descripcion:{
            type:"text",
            nullable:true,
        },
        activo:{
            type:"boolean",
            nullable:false,
            default:true,
        }
    }
});

export default unitOfMeasureScheme;
