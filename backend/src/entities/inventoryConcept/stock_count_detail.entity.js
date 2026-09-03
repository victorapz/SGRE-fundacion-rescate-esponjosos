"use strict";

import { EntitySchema } from "typeorm";

const StockCountDetailScheme = new EntitySchema({
    name: "StockCountDetail",
    tableName: "StockCountDetails",
    columns:{
        conteo_detalle_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        cantidad_contada:{
            type:"numeric",
            nullable:false,
        },
        observaciones:{
            type:"text",
            nullable:true,
        }
    },
    relations:{
        stock_count:{
            type:"many-to-one",
            target:"StockCount",
            joinColumn:{
                name:"conteo_fisico_id",
                referencedColumnName:"conteo_fisico_id",
            },
            nullable:false,
        },
        item:{
            type:"many-to-one",
            target:"InventoryItem",
            joinColumn:{
                name:"item_id",
                referencedColumnName:"item_id",
            },
            nullable:false,
        },
        existence:{
            type:"many-to-one",
            target:"InventoryExistence",
            joinColumn:{
                name:"existencia_id",
                referencedColumnName:"existencia_id",
            },
            nullable:true,
        }
    }
});

export default StockCountDetailScheme;
