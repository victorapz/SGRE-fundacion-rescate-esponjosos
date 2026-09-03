"use strict";

import { EntitySchema } from "typeorm";

const RefreshTokenSchema = new EntitySchema({
	name: "RefreshToken",
	tableName: "RefreshTokens",
	columns: {
		id_refresh_token: {
			type: "int",
			primary: true,
			generated: true,
		},
		tokenHash: {
			type: "varchar",
			length: 255,
			nullable: false,
			unique: true,
		},
		tokenId: {
			type: "varchar",
			length: 64,
			nullable: false,
			unique: true,
		},
		familyId: {
			type: "varchar",
			length: 64,
			nullable: false,
		},
		revoked: {
			type: "boolean",
			nullable: false,
			default: false,
		},
		compromised: {
			type: "boolean",
			nullable: false,
			default: false,
		},
		replacedByTokenHash: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		expiresAt: {
			type: "timestamp with time zone",
			nullable: false,
		},
		revokedAt: {
			type: "timestamp with time zone",
			nullable: true,
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
		},
	},
	relations: {
		user: {
			type: "many-to-one",
			target: "User",
			joinColumn: {
				name: "id_user",
				referencedColumnName: "id_usuario",
			},
			nullable: false,
			onDelete: "CASCADE",
		},
	},
	indices: [
		{
			name: "IDX_refresh_tokens_family",
			columns: ["familyId"],
		},
		{
			name: "IDX_refresh_tokens_user",
			columns: ["user"],
		},
	],
});

export default RefreshTokenSchema;
