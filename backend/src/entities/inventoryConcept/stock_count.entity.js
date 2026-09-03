"use strict";   

import { EntitySchema } from "typeorm";

const StockCountScheme = new EntitySchema({ 
    name: "StockCount",
    tableName: "StockCounts",
    columns:{
        conteo_fisico_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        fecha_conteo:{
            type:"date",
            nullable:false,
        },
        observaciones:{
            type:"text",
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
        location:{
            type:"many-to-one",
            target:"Location",
            joinColumn:{
                name:"ubicacion_id",
                referencedColumnName:"ubicacion_id",
            },
            nullable:false,
        },
        performed_by:{
            type:"many-to-one",
            target:"User",
            joinColumn:{
                name:"performed_by",
                referencedColumnName:"id_usuario",
            },
            nullable:false,
        },
        details:{
            type:"one-to-many",
            target:"StockCountDetail",
            inverseSide:"stock_count",
        }
    }
});

export default StockCountScheme;
