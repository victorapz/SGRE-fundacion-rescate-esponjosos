"use strict";

import { EntitySchema } from "typeorm";

export const PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS = {
  DRAFT: "BORRADOR",
  PUBLISHED: "PUBLICADO",
  ARCHIVED: "ARCHIVADO",
};

const PublicMonthlyAccountingReportSchema = new EntitySchema({
  name: "PublicMonthlyAccountingReport",
  tableName: "PublicMonthlyAccountingReports",
  columns: {
    id: {
      type: "int",
      primary: true,
      generated: true,
    },
    year: {
      type: "int",
      nullable: false,
    },
    month: {
      type: "int",
      nullable: false,
    },
    version: {
      type: "int",
      nullable: false,
      default: 1,
    },
    status: {
      type: "enum",
      enum: Object.values(PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS),
      nullable: false,
      default: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT,
    },
    snapshot: {
      type: "jsonb",
      nullable: false,
    },
    pdf_object_key: {
      type: "varchar",
      length: 512,
      nullable: true,
    },
    generated_at: {
      type: "timestamp with time zone",
      nullable: false,
      default: () => "CURRENT_TIMESTAMP",
    },
    published_at: {
      type: "timestamp with time zone",
      nullable: true,
    },
    archived_at: {
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
  indices: [
    {
      name: "IDX_public_monthly_accounting_reports_period_version",
      columns: ["year", "month", "version"],
      unique: true,
    },
  ],
  relations: {
    generated_by: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "generated_by_id",
        referencedColumnName: "id_usuario",
      },
      nullable: false,
    },
    published_by: {
      target: "User",
      type: "many-to-one",
      joinColumn: {
        name: "published_by_id",
        referencedColumnName: "id_usuario",
      },
      nullable: true,
    },
  },
});

export default PublicMonthlyAccountingReportSchema;
