"use strict";

import { EntitySchema } from "typeorm";

const inventoryAdjustmentScheme = new EntitySchema({
    name: "InventoryAdjustment",
    tableName: "InventoryAdjustments",
    columns:{
        ajuste_inventario_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        fecha_ajuste:{
            type:"date",
            nullable:false,
        },
        motivo:{
            type:"text",
            nullable:false,
        },
        estado:{
            type:"enum",
            enum:["PENDIENTE","APLICADO","CANCELADO"],
            nullable:false,
            default:"PENDIENTE",
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
        stock_count:{
            type:"many-to-one",
            target:"StockCount",
            joinColumn:{
                name:"conteo_fisico_id",
                referencedColumnName:"conteo_fisico_id",
            },
            nullable:true,
        },
        inventory_adjustment_detail:{
            type:"one-to-many",
            target:"InventoryAdjustmentDetail",
            inverseSide:"inventory_adjustment",
        }
    }
});

export default inventoryAdjustmentScheme;
