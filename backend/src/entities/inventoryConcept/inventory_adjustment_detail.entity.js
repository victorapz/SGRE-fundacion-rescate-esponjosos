"use strict";

import { EntitySchema } from "typeorm";

const inventoryAdjustmentDetailScheme = new EntitySchema({
    name: "InventoryAdjustmentDetail",
    tableName: "InventoryAdjustmentDetails",
    columns:{
        ajuste_detalle_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        cantidad_antes:{
            type:"numeric",
            nullable:false,
        },
        cantidad_contada:{
            type:"numeric",
            nullable:false,
        },
        diferencia:{
            type:"numeric",
            nullable:false,
        },
        tipo_ajuste:{
            type:"enum",
            enum: ["POSITIVO", "NEGATIVO"],
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
        item:{
            type:"many-to-one",
            target:"InventoryItem",
            joinColumn:{
                name:"item_id",
                referencedColumnName:"item_id",
            }
        },
        existence:{
            type:"many-to-one",
            target:"InventoryExistence",
            joinColumn:{
                name:"existencia_id",
                referencedColumnName:"existencia_id",
            },
            nullable:true,
        },
        inventory_adjustment:{
            type:"many-to-one",
            target:"InventoryAdjustment",
            joinColumn:{
                name:"ajuste_inventario_id",
                referencedColumnName:"ajuste_inventario_id",
            },
            nullable:false,
        }
    }
})

export default inventoryAdjustmentDetailScheme;
