"use strict";

import { EntitySchema } from "typeorm";

const InventoryMovementScheme = new EntitySchema({
    name: "InventoryMovement",
    tableName: "InventoryMovements",    
    columns:{
        movimiento_id:{
            type:"int",
            primary:true,
            generated:true,
            nullable:false,
        },
        tipo_movimiento:{
            type:"enum",
            enum: ["ENTRADA", "SALIDA", "AJUSTE","CONSUMO","TRASLADO"],
            nullable:false,
        },
        cantidad:{
            type:"numeric",
            nullable:false,
        },
        fecha_movimiento:{
            type:"date",
            nullable:false, 
        },
        referencia_tipo:{
            type:"varchar",
            nullable:true,
            length: 255,
        },
        referencia_id:{
            type:"int",
            nullable:true,
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
        item:{
            type:"many-to-one",
            target:"InventoryItem",
            joinColumn:{
                name:"item_id",
                referencedColumnName:"item_id" 
            },
            nullable:false,
            },
        source_location:{
            type:"many-to-one",
            target:"Location",
            joinColumn:{
                name:"source_location_id",
                referencedColumnName:"ubicacion_id"
            },
            nullable:true
        },
        destination_location:{
            type:"many-to-one",
            target:"Location",
            joinColumn:{
                name:"destination_location_id",
                referencedColumnName:"ubicacion_id"
            },
            nullable:true
        },
        performed_by:{
            type:"many-to-one",
            target:"User",
            joinColumn:{
                name:"performed_by",
                referencedColumnName:"id_usuario"
            },
            nullable:false
        },
        donation_item:{
            type:"many-to-one",
            target:"DonationItem",
            joinColumn:{
                name:"donacion_individual_id",
                referencedColumnName:"donacion_individual_id"
            },
        },
        purchase_detail:{
            type:"many-to-one",
            target:"PurchaseDetail",
            joinColumn:{
                name:"detalle_compra_id",
                referencedColumnName:"detalle_compra_id"
            },
        }
    }
});

export default InventoryMovementScheme;
