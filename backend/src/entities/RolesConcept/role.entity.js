"use strict";

import { EntitySchema } from "typeorm";

const RoleScheme = new EntitySchema({
    name: "Role",
    tableName: "Roles",
    columns:{
        id_rol:{
            type:"int",
            primary:true,
            generated:true,
        },
        nombre:{
            type:"varchar",
            length:255,
            nullable:false,
            unique:true,
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
        RolePermission:{
            target:"RolePermission",
            type:"one-to-many",
            inverseSide:"role"
        },
        UserRole:{
            target:"UserRole",
            type:"one-to-many",
            inverseSide:"role"
        },
    }
});

export default RoleScheme;