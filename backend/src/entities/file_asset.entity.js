"use strict";

import { EntitySchema } from "typeorm";

export const FILE_ASSET_ENTITY_TYPES = {
  ANIMAL: "ANIMAL",
  USER: "USER",
  NOTICE: "NOTICE",
  ACCOUNTING_TRANSACTION: "ACCOUNTING_TRANSACTION",
  ACCOUNTING_PAYMENT_ORDER: "ACCOUNTING_PAYMENT_ORDER",
  ACCOUNTING_PAYABLE: "ACCOUNTING_PAYABLE",
  INTAKE_RECORD: "INTAKE_RECORD",
  EXAM: "EXAM",
  HOSPITALIZATION: "HOSPITALIZATION",
  PROCEDURE: "PROCEDURE",
  VET_CHECKUP: "VET_CHECKUP",
};

export const FILE_ASSET_CONTEXTS = {
  ANIMAL_MAIN: "ANIMAL_MAIN",
  ANIMAL_GALLERY: "ANIMAL_GALLERY",
  NOTICE_COVER: "NOTICE_COVER",
  NOTICE_CONTENT_IMAGE: "NOTICE_CONTENT_IMAGE",
  USER_DOCUMENT: "USER_DOCUMENT",
  USER_CONTRACT_VOLUNTEER: "USER_CONTRACT_VOLUNTEER",
  USER_CONTRACT_FOSTER_HOME: "USER_CONTRACT_FOSTER_HOME",
  USER_CONTRACT_ADOPTION: "USER_CONTRACT_ADOPTION",
  ACCOUNTING_TRANSACTION: "ACCOUNTING_TRANSACTION",
  ACCOUNTING_PAYMENT_ORDER: "ACCOUNTING_PAYMENT_ORDER",
  ACCOUNTING_PURCHASE_PROOF: "ACCOUNTING_PURCHASE_PROOF",
  ACCOUNTING_PAYABLE_PROOF: "ACCOUNTING_PAYABLE_PROOF",
  INTAKE_RECORD_ATTACHMENT: "INTAKE_RECORD_ATTACHMENT",
  EXAM_ATTACHMENT: "EXAM_ATTACHMENT",
  HOSPITALIZATION_ATTACHMENT: "HOSPITALIZATION_ATTACHMENT",
  PROCEDURE_ATTACHMENT: "PROCEDURE_ATTACHMENT",
  VET_CHECKUP_ATTACHMENT: "VET_CHECKUP_ATTACHMENT",
};

export const FILE_ASSET_VISIBILITY = {
  PUBLICO: "PUBLICO",
  PRIVADO: "PRIVADO",
};

export const FILE_ASSET_STATUS = {
  ACTIVO: "ACTIVO",
  ELIMINADO: "ELIMINADO",
};

export const FILE_ASSET_CONTEXT_RULES = {
  [FILE_ASSET_CONTEXTS.ANIMAL_MAIN]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.ANIMAL],
    allowPublic: true,
    permissionScope: "animal",
  },
  [FILE_ASSET_CONTEXTS.ANIMAL_GALLERY]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.ANIMAL],
    allowPublic: true,
    permissionScope: "animal",
  },
  [FILE_ASSET_CONTEXTS.NOTICE_COVER]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.NOTICE],
    allowPublic: false,
    permissionScope: "notice",
  },
  [FILE_ASSET_CONTEXTS.NOTICE_CONTENT_IMAGE]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.NOTICE],
    allowPublic: false,
    permissionScope: "notice",
  },
  [FILE_ASSET_CONTEXTS.INTAKE_RECORD_ATTACHMENT]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.INTAKE_RECORD],
    allowPublic: false,
    permissionScope: "animal_clinical",
  },
  [FILE_ASSET_CONTEXTS.EXAM_ATTACHMENT]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.EXAM],
    allowPublic: false,
    permissionScope: "animal_clinical",
  },
  [FILE_ASSET_CONTEXTS.HOSPITALIZATION_ATTACHMENT]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.HOSPITALIZATION],
    allowPublic: false,
    permissionScope: "animal_clinical",
  },
  [FILE_ASSET_CONTEXTS.PROCEDURE_ATTACHMENT]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.PROCEDURE],
    allowPublic: false,
    permissionScope: "animal_clinical",
  },
  [FILE_ASSET_CONTEXTS.VET_CHECKUP_ATTACHMENT]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.VET_CHECKUP],
    allowPublic: false,
    permissionScope: "animal_clinical",
  },
  [FILE_ASSET_CONTEXTS.USER_DOCUMENT]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.USER],
    allowPublic: false,
    permissionScope: "user_document",
  },
  [FILE_ASSET_CONTEXTS.USER_CONTRACT_VOLUNTEER]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.USER],
    allowPublic: false,
    permissionScope: "user_document",
  },
  [FILE_ASSET_CONTEXTS.USER_CONTRACT_FOSTER_HOME]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.USER],
    allowPublic: false,
    permissionScope: "user_document",
  },
  [FILE_ASSET_CONTEXTS.USER_CONTRACT_ADOPTION]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.USER],
    allowPublic: false,
    permissionScope: "user_document",
  },
  [FILE_ASSET_CONTEXTS.ACCOUNTING_TRANSACTION]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.ACCOUNTING_TRANSACTION],
    allowPublic: false,
    permissionScope: "accounting",
  },
  [FILE_ASSET_CONTEXTS.ACCOUNTING_PAYMENT_ORDER]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.ACCOUNTING_PAYMENT_ORDER],
    allowPublic: false,
    permissionScope: "accounting",
  },
  [FILE_ASSET_CONTEXTS.ACCOUNTING_PURCHASE_PROOF]: {
    // Mientras no exista el modulo contable completo, aceptamos este comprobante
    // sobre transacciones y ordenes de pago como los dos casos operativos mas cercanos.
    entityTypes: [
      FILE_ASSET_ENTITY_TYPES.ACCOUNTING_TRANSACTION,
      FILE_ASSET_ENTITY_TYPES.ACCOUNTING_PAYMENT_ORDER,
    ],
    allowPublic: false,
    permissionScope: "accounting",
  },
  [FILE_ASSET_CONTEXTS.ACCOUNTING_PAYABLE_PROOF]: {
    entityTypes: [FILE_ASSET_ENTITY_TYPES.ACCOUNTING_PAYABLE],
    allowPublic: false,
    permissionScope: "accounting",
  },
};

export const FILE_ASSET_MAIN_CONTEXTS = [
  FILE_ASSET_CONTEXTS.ANIMAL_MAIN,
  FILE_ASSET_CONTEXTS.ANIMAL_GALLERY,
];

const FileAssetSchema = new EntitySchema({
  name: "FileAsset",
  tableName: "FileAssets",
  columns: {
    file_asset_id: {
      type: "int",
      primary: true,
      generated: true,
    },
    public_id: {
      type: "varchar",
      length: 36,
      nullable: true,
      unique: true,
    },
    entity_type: {
      type: "enum",
      enum: Object.values(FILE_ASSET_ENTITY_TYPES),
      nullable: false,
    },
    entity_id: {
      type: "int",
      nullable: false,
    },
    context: {
      type: "enum",
      enum: Object.values(FILE_ASSET_CONTEXTS),
      nullable: false,
    },
    visibility: {
      type: "enum",
      enum: Object.values(FILE_ASSET_VISIBILITY),
      nullable: false,
      default: FILE_ASSET_VISIBILITY.PRIVADO,
    },
    bucket: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    object_key: {
      type: "varchar",
      length: 500,
      nullable: false,
      unique: true,
    },
    original_name: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    stored_name: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    mime_type: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    extension: {
      type: "varchar",
      length: 50,
      nullable: false,
    },
    size_bytes: {
      type: "int",
      nullable: false,
    },
    checksum: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    title: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    description: {
      type: "text",
      nullable: true,
    },
    sort_order: {
      type: "int",
      nullable: false,
      default: 0,
    },
    is_main: {
      type: "boolean",
      nullable: false,
      default: false,
    },
    status: {
      type: "enum",
      enum: Object.values(FILE_ASSET_STATUS),
      nullable: false,
      default: FILE_ASSET_STATUS.ACTIVO,
    },
    uploaded_at: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },
    deleted_at: {
      type: "timestamp with time zone",
      nullable: true,
    },
    metadata: {
      type: "jsonb",
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
    uploaded_by_user: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "uploaded_by",
        referencedColumnName: "id_usuario",
      },
      nullable: true,
    },
    deleted_by_user: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "deleted_by",
        referencedColumnName: "id_usuario",
      },
      nullable: true,
    },
  },
  indices: [
    {
      name: "IDX_file_asset_lookup",
      columns: ["entity_type", "entity_id", "context", "status"],
    },
    {
      name: "IDX_file_asset_status",
      columns: ["status", "is_main", "sort_order", "uploaded_at"],
    },
  ],
});

export default FileAssetSchema;
