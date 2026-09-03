"use strict";

export const REPORT_EXPORT_PDF_MAX_RECORDS = 5000;
export const REPORT_EXPORT_XLSX_MAX_RECORDS = 20000;

export const REPORT_EXPORT_MIME_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const REPORT_EXPORT_FILENAME_BASES = {
  ACCOUNTING_TRANSACTIONS: "informe-contable",
  ACCOUNTING_PAYABLES: "cuentas-por-pagar",
  INVENTORY_EXISTENCES: "existencias",
  INVENTORY_COUNTS_ADJUSTMENTS: "conteos-ajustes",
};

export const REPORT_EXPORT_PUBLIC_LIMIT_MESSAGE =
  "El informe contiene demasiados registros. Acote los filtros e intente nuevamente.";
