"use strict";

import ExcelJS from "exceljs";
import { REPORT_TYPES } from "../report.constants.js";
import { sanitizeSpreadsheetText } from "../report.shared.js";
import {
  buildFilterEntries,
  buildGeneratedMetadata,
  buildWarningMessages,
  formatExportDate,
} from "./report_export.shared.js";
import {
  formatAccountingExportLabel,
  resolveAccountingXlsxMoneyFormat,
} from "./report_accounting.presentation.js";
import {
  buildInventoryExistenceObservationRows,
  buildInventoryFilterEntries,
  formatInventoryExportLabel,
  formatInventoryWarningMessage,
} from "./report_inventory.presentation.js";

function addSheetWithColumns(workbook, name, columns, rows) {
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = columns;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: "A1",
    to: String.fromCharCode(64 + columns.length) + "1",
  };
  worksheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    worksheet.addRow(row);
  }

  columns.forEach((column, index) => {
    const targetColumn = worksheet.getColumn(index + 1);

    if (column.numFmt) {
      targetColumn.numFmt = column.numFmt;
    }

    if (column.alignment) {
      targetColumn.alignment = column.alignment;
    }
  });

  return worksheet;
}

function filtersSheetRows(report) {
  const metadata = buildGeneratedMetadata(report);
  const filterEntries = report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES
    || report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS
    ? buildInventoryFilterEntries(report.filters, report)
    : buildFilterEntries(report.filters);

  return [
    { clave: "Generado en", valor: metadata.generated_label },
    { clave: "Generado por", valor: metadata.generated_by },
    ...filterEntries.map((entry) => ({
      clave: sanitizeSpreadsheetText(entry.label),
      valor: sanitizeSpreadsheetText(entry.value),
    })),
  ];
}

function warningsSheetRows(report) {
  return buildWarningMessages(report).map((warning) => ({
    advertencia: sanitizeSpreadsheetText(
      report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES
      || report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS
        ? formatInventoryWarningMessage(warning)
        : warning,
    ),
  }));
}

function payablesSummaryRowsFromCurrencies(summaryMonedas = {}) {
  return Object.values(summaryMonedas || {}).map((bucket) => ({
    moneda: bucket.moneda,
    obligaciones_total: bucket.obligaciones_total ?? null,
    pagado_total: bucket.pagado_total ?? null,
    saldo_pendiente: bucket.saldo_pendiente ?? null,
    saldo_vencido: bucket.saldo_vencido ?? null,
    operaciones: bucket.operaciones ?? bucket.cuentas ?? null,
  }));
}

function transactionsSummaryRowsFromCurrencies(summaryMonedas = {}) {
  return Object.values(summaryMonedas || {}).map((bucket) => ({
    moneda: bucket.moneda,
    ingresos_brutos: bucket.ingresos_brutos ?? null,
    egresos_brutos: bucket.egresos_brutos ?? null,
    fees: bucket.fees ?? null,
    refunds: bucket.refunds ?? null,
    reversals: bucket.reversals ?? null,
    resultado_neto: bucket.resultado_neto ?? null,
    operaciones: bucket.operaciones ?? null,
  }));
}

function buildTransactionsWorkbook(workbook, report) {
  addSheetWithColumns(
    workbook,
    "Resumen",
    [
      { header: "Moneda", key: "moneda", width: 12 },
      { header: "Ingresos", key: "ingresos_brutos", width: 14, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Egresos", key: "egresos_brutos", width: 14, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Fees", key: "fees", width: 12, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Refunds", key: "refunds", width: 14, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Reversals", key: "reversals", width: 14, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Resultado Neto", key: "resultado_neto", width: 18, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Operaciones", key: "operaciones", width: 14 },
    ],
    transactionsSummaryRowsFromCurrencies(report.summary?.monedas),
  );
  const transactionSummarySheet = workbook.getWorksheet("Resumen");
  for (let rowIndex = 2; rowIndex <= transactionSummarySheet.rowCount; rowIndex += 1) {
    const currency = String(transactionSummarySheet.getCell(`A${rowIndex}`).value || "CLP");
    const numFmt = resolveAccountingXlsxMoneyFormat(currency);
    ["B", "C", "D", "E", "F", "G"].forEach((column) => {
      transactionSummarySheet.getCell(`${column}${rowIndex}`).numFmt = numFmt;
    });
  }
  addSheetWithColumns(
    workbook,
    "Transacciones",
    [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Estado", key: "estado", width: 16 },
      { header: "Categoria", key: "categoria", width: 24 },
      { header: "Descripcion", key: "descripcion", width: 28 },
      { header: "Bruto", key: "monto_bruto", width: 14, alignment: { horizontal: "right" } },
      { header: "Fee", key: "monto_fee", width: 12, alignment: { horizontal: "right" } },
      { header: "Neto", key: "monto_neto", width: 14, alignment: { horizontal: "right" } },
      { header: "Moneda", key: "moneda", width: 10 },
      { header: "Proveedor", key: "proveedor_pago", width: 24 },
      { header: "Referencia", key: "referencia_externa", width: 24 },
      { header: "Origen", key: "origen", width: 20 },
      { header: "Clasificacion", key: "clasificacion", width: 18 },
    ],
    (report.rows || []).map((row) => ({
      fecha: formatExportDate(row.fecha),
      tipo: sanitizeSpreadsheetText(formatAccountingExportLabel(row.tipo)),
      estado: sanitizeSpreadsheetText(formatAccountingExportLabel(row.estado)),
      categoria: sanitizeSpreadsheetText(row.categoria?.nombre || ""),
      descripcion: sanitizeSpreadsheetText(row.descripcion || ""),
      monto_bruto: row.monto_bruto,
      monto_fee: row.monto_fee,
      monto_neto: row.monto_neto,
      moneda: sanitizeSpreadsheetText(row.moneda),
      proveedor_pago: sanitizeSpreadsheetText(row.proveedor_pago?.nombre || ""),
      referencia_externa: sanitizeSpreadsheetText(row.referencia_externa || ""),
      origen: sanitizeSpreadsheetText(formatAccountingExportLabel(row.origen)),
      clasificacion: sanitizeSpreadsheetText(formatAccountingExportLabel(row.clasificacion)),
    })),
  );

  const transactionsSheet = workbook.getWorksheet("Transacciones");
  for (let rowIndex = 2; rowIndex <= transactionsSheet.rowCount; rowIndex += 1) {
    const currency = String(transactionsSheet.getCell(`I${rowIndex}`).value || "CLP");
    const numFmt = resolveAccountingXlsxMoneyFormat(currency);
    transactionsSheet.getCell(`F${rowIndex}`).numFmt = numFmt;
    transactionsSheet.getCell(`G${rowIndex}`).numFmt = numFmt;
    transactionsSheet.getCell(`H${rowIndex}`).numFmt = numFmt;
  }
}

function buildPayablesWorkbook(workbook, report) {
  addSheetWithColumns(
    workbook,
    "Resumen",
    [
      { header: "Moneda", key: "moneda", width: 12 },
      { header: "Obligaciones", key: "obligaciones_total", width: 16, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Pagado", key: "pagado_total", width: 14, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Saldo", key: "saldo_pendiente", width: 14, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Saldo vencido", key: "saldo_vencido", width: 16, numFmt: "#,##0.00", alignment: { horizontal: "right" } },
      { header: "Cuentas", key: "operaciones", width: 12 },
    ],
    payablesSummaryRowsFromCurrencies(report.summary?.monedas),
  );
  const payablesSummarySheet = workbook.getWorksheet("Resumen");
  for (let rowIndex = 2; rowIndex <= payablesSummarySheet.rowCount; rowIndex += 1) {
    const currency = String(payablesSummarySheet.getCell(`A${rowIndex}`).value || "CLP");
    const numFmt = resolveAccountingXlsxMoneyFormat(currency);
    ["B", "C", "D", "E"].forEach((column) => {
      payablesSummarySheet.getCell(`${column}${rowIndex}`).numFmt = numFmt;
    });
  }
  addSheetWithColumns(
    workbook,
    "Cuentas",
    [
      { header: "ID", key: "id", width: 10 },
      { header: "Emision", key: "fecha", width: 14 },
      { header: "Vencimiento", key: "fecha_vencimiento", width: 14 },
      { header: "Concepto", key: "concepto", width: 24 },
      { header: "Estado", key: "estado", width: 16 },
      { header: "Moneda", key: "moneda", width: 10 },
      { header: "Monto total", key: "monto_original", width: 14, alignment: { horizontal: "right" } },
      { header: "Monto pagado", key: "monto_pagado", width: 14, alignment: { horizontal: "right" } },
      { header: "Saldo", key: "saldo_pendiente", width: 14, alignment: { horizontal: "right" } },
      { header: "Categoria", key: "categoria", width: 24 },
      { header: "Contraparte", key: "contraparte", width: 24 },
      { header: "Origen", key: "origen", width: 24 },
      { header: "Cantidad pagos", key: "cantidad_pagos", width: 14 },
      { header: "Ultimo pago", key: "ultima_fecha_pago", width: 14 },
    ],
    (report.rows || []).map((row) => ({
      id: row.id,
      fecha: formatExportDate(row.fecha),
      fecha_vencimiento: formatExportDate(row.fecha_vencimiento),
      concepto: sanitizeSpreadsheetText(row.concepto || ""),
      estado: sanitizeSpreadsheetText(formatAccountingExportLabel(row.estado)),
      moneda: sanitizeSpreadsheetText(row.moneda || ""),
      monto_original: row.monto_original,
      monto_pagado: row.monto_pagado,
      saldo_pendiente: row.saldo_pendiente,
      categoria: sanitizeSpreadsheetText(row.categoria?.nombre || ""),
      contraparte: sanitizeSpreadsheetText(row.contraparte?.nombre || formatAccountingExportLabel(row.contraparte?.tipo) || ""),
      origen: sanitizeSpreadsheetText(row.origen?.descripcion || formatAccountingExportLabel(row.origen?.tipo) || ""),
      cantidad_pagos: row.pagos?.cantidad || 0,
      ultima_fecha_pago: formatExportDate(row.pagos?.ultima_fecha_pago),
    })),
  );
  addSheetWithColumns(
    workbook,
    "Pagos",
    [
      { header: "Cuenta", key: "payable_id", width: 10 },
      { header: "Fecha", key: "fecha_pago", width: 14 },
      { header: "Monto aplicado", key: "monto_aplicado", width: 16, alignment: { horizontal: "right" } },
      { header: "Moneda", key: "moneda", width: 10 },
      { header: "Proveedor", key: "proveedor_pago", width: 24 },
      { header: "Referencia", key: "referencia_segura", width: 24 },
    ],
    (report.payments || []).map((row) => ({
      payable_id: row.payable_id,
      fecha_pago: formatExportDate(row.fecha_pago),
      monto_aplicado: row.monto_aplicado,
      moneda: sanitizeSpreadsheetText(row.moneda || "CLP"),
      proveedor_pago: sanitizeSpreadsheetText(row.proveedor_pago?.nombre || ""),
      referencia_segura: sanitizeSpreadsheetText(row.referencia_segura || ""),
    })),
  );

  const payablesSheet = workbook.getWorksheet("Cuentas");
  for (let rowIndex = 2; rowIndex <= payablesSheet.rowCount; rowIndex += 1) {
    const currency = String(payablesSheet.getCell(`F${rowIndex}`).value || "CLP");
    const numFmt = resolveAccountingXlsxMoneyFormat(currency);
    payablesSheet.getCell(`G${rowIndex}`).numFmt = numFmt;
    payablesSheet.getCell(`H${rowIndex}`).numFmt = numFmt;
    payablesSheet.getCell(`I${rowIndex}`).numFmt = numFmt;
  }

  const paymentsSheet = workbook.getWorksheet("Pagos");
  for (let rowIndex = 2; rowIndex <= paymentsSheet.rowCount; rowIndex += 1) {
    const currency = String(paymentsSheet.getCell(`D${rowIndex}`).value || "CLP");
    paymentsSheet.getCell(`C${rowIndex}`).numFmt = resolveAccountingXlsxMoneyFormat(currency);
  }
}

function buildExistencesWorkbook(workbook, report) {
  addSheetWithColumns(
    workbook,
    "Resumen",
    [
      { header: "Indicador", key: "clave", width: 26 },
      { header: "Valor", key: "valor", width: 20 },
    ],
    [
      { clave: "Existencias totales", valor: report.summary?.existencias_totales || 0 },
      { clave: "Items distintos", valor: report.summary?.items_distintos || 0 },
      { clave: "Ubicaciones distintas", valor: report.summary?.ubicaciones_distintas || 0 },
      { clave: "Sin stock", valor: report.summary?.sin_stock || 0 },
      { clave: "Bajo minimo", valor: report.summary?.bajo_minimo || 0 },
      { clave: "Disponibles", valor: report.summary?.disponibles || 0 },
    ],
  );
  addSheetWithColumns(
    workbook,
    "Existencias",
    [
      { header: "Item", key: "item", width: 24 },
      { header: "Categoria", key: "categoria", width: 20 },
      { header: "Unidad", key: "unidad", width: 14 },
      { header: "Ubicacion", key: "ubicacion", width: 22 },
      { header: "Cantidad", key: "cantidad_actual", width: 14 },
      { header: "Stock minimo", key: "stock_minimo", width: 14 },
      { header: "Diferencia", key: "diferencia_minimo", width: 14 },
      { header: "Estado stock", key: "estado_stock", width: 16 },
    ],
    (report.rows || []).map((row) => ({
      item: sanitizeSpreadsheetText(row.item?.nombre || ""),
      categoria: sanitizeSpreadsheetText(row.categoria?.nombre || ""),
      unidad: sanitizeSpreadsheetText(row.unidad?.nombre || ""),
      ubicacion: sanitizeSpreadsheetText(row.ubicacion?.nombre || ""),
      cantidad_actual: row.cantidad_actual,
      stock_minimo: row.stock_minimo,
      diferencia_minimo: row.diferencia_minimo,
      estado_stock: sanitizeSpreadsheetText(formatInventoryExportLabel(row.estado_stock || "")),
    })),
  );

  const observationRows = buildInventoryExistenceObservationRows(report.rows || []);
  if (observationRows.length > 0) {
    addSheetWithColumns(
      workbook,
      "Observaciones",
      [{ header: "Observacion", key: "observacion", width: 120 }],
      observationRows.map((observation) => ({
        observacion: sanitizeSpreadsheetText(observation),
      })),
    );
  }
}

function buildCountsAdjustmentsWorkbook(workbook, report) {
  addSheetWithColumns(
    workbook,
    "Resumen",
    [
      { header: "Indicador", key: "clave", width: 28 },
      { header: "Valor", key: "valor", width: 16 },
    ],
    [
      { clave: "Conteos totales", valor: report.summary?.conteos?.total || 0 },
      { clave: "Ajustes totales", valor: report.summary?.ajustes?.total || 0 },
      { clave: "Historicos confirmados", valor: report.summary?.conteos?.calidad_datos?.historicos_confirmados || 0 },
      { clave: "Derivados desde existencia actual", valor: report.summary?.conteos?.calidad_datos?.derivados_actuales || 0 },
      { clave: "No resolubles", valor: report.summary?.conteos?.calidad_datos?.no_resolubles || 0 },
    ],
  );
  addSheetWithColumns(
    workbook,
    "Conteos fisicos",
    [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Ubicacion", key: "ubicacion", width: 22 },
      { header: "Responsable", key: "responsable", width: 22 },
      { header: "Items contados", key: "items_contados", width: 14 },
      { header: "Con diferencia", key: "items_con_diferencia", width: 14 },
      { header: "Sobrantes", key: "sobrantes", width: 12 },
      { header: "Faltantes", key: "faltantes", width: 12 },
      { header: "Ajuste generado", key: "adjustment_generated", width: 16 },
    ],
    (report.counts || []).map((row) => ({
      fecha: formatExportDate(row.fecha),
      ubicacion: sanitizeSpreadsheetText(row.ubicacion?.nombre || ""),
      responsable: sanitizeSpreadsheetText(
        [row.responsable?.nombre, row.responsable?.apellido].filter(Boolean).join(" "),
      ),
      items_contados: row.items_contados,
      items_con_diferencia: row.items_con_diferencia,
      sobrantes: row.sobrantes,
      faltantes: row.faltantes,
      adjustment_generated: sanitizeSpreadsheetText(row.adjustments_total > 0 ? "Si" : "No"),
    })),
  );
  addSheetWithColumns(
    workbook,
    "Detalles de conteos",
    [
      { header: "Conteo", key: "count_id", width: 10 },
      { header: "Item", key: "item", width: 24 },
      { header: "Unidad", key: "unidad", width: 14 },
      { header: "Teorica", key: "cantidad_teorica", width: 12 },
      { header: "Contada", key: "cantidad_contada", width: 12 },
      { header: "Diferencia", key: "diferencia", width: 12 },
      { header: "Clasificacion", key: "clasificacion", width: 16 },
      { header: "Calidad del dato", key: "data_quality", width: 22 },
    ],
    (report.counts || []).flatMap((count) =>
      (count.detalles || []).map((detail) => ({
        count_id: count.count_id,
        item: sanitizeSpreadsheetText(detail.item?.nombre || ""),
        unidad: sanitizeSpreadsheetText(detail.unidad?.nombre || ""),
        cantidad_teorica: detail.cantidad_teorica,
        cantidad_contada: detail.cantidad_contada,
        diferencia: detail.diferencia,
        clasificacion: sanitizeSpreadsheetText(formatInventoryExportLabel(detail.clasificacion || "")),
        data_quality: sanitizeSpreadsheetText(formatInventoryExportLabel(detail.data_quality || "")),
      }))),
  );
  addSheetWithColumns(
    workbook,
    "Ajustes de inventario",
    [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Estado", key: "estado", width: 16 },
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Ubicacion", key: "ubicacion", width: 22 },
      { header: "Responsable", key: "responsable", width: 22 },
      { header: "Conteo origen", key: "conteo_origen", width: 14 },
      { header: "Items ajustados", key: "items_ajustados", width: 12 },
      { header: "Impacto", key: "impacto", width: 18 },
    ],
    (report.adjustments || []).map((row) => ({
      fecha: formatExportDate(row.fecha),
      estado: sanitizeSpreadsheetText(formatInventoryExportLabel(row.estado || "")),
      tipo: sanitizeSpreadsheetText(
        row.incrementos > 0 && row.disminuciones > 0
          ? "Mixto"
          : formatInventoryExportLabel(row.incrementos > 0 ? "POSITIVO" : "NEGATIVO"),
      ),
      ubicacion: sanitizeSpreadsheetText(row.ubicacion?.nombre || ""),
      responsable: sanitizeSpreadsheetText(
        [row.responsable?.nombre, row.responsable?.apellido].filter(Boolean).join(" "),
      ),
      conteo_origen: row.conteo_origen?.id || null,
      items_ajustados: row.items_ajustados,
      impacto: sanitizeSpreadsheetText(
        row.incrementos > 0 && row.disminuciones > 0
          ? "Incrementos y disminuciones"
          : row.incrementos > 0
            ? "Incrementos"
            : row.disminuciones > 0
              ? "Disminuciones"
              : "Sin cambios",
      ),
    })),
  );
  addSheetWithColumns(
    workbook,
    "Detalles de ajustes",
    [
      { header: "Ajuste", key: "adjustment_id", width: 10 },
      { header: "Item", key: "item", width: 24 },
      { header: "Unidad", key: "unidad", width: 14 },
      { header: "Anterior", key: "cantidad_anterior", width: 12 },
      { header: "Aplicada", key: "cantidad_ajustada", width: 12 },
      { header: "Posterior", key: "cantidad_posterior", width: 12 },
      { header: "Impacto", key: "impacto", width: 14 },
    ],
    (report.adjustments || []).flatMap((adjustment) =>
      (adjustment.detalles || []).map((detail) => ({
        adjustment_id: adjustment.adjustment_id,
        item: sanitizeSpreadsheetText(detail.item?.nombre || ""),
        unidad: sanitizeSpreadsheetText(detail.unidad?.nombre || ""),
        cantidad_anterior: detail.cantidad_anterior,
        cantidad_ajustada: detail.cantidad_ajustada,
        cantidad_posterior: detail.cantidad_posterior,
        impacto: sanitizeSpreadsheetText(formatInventoryExportLabel(detail.impacto || "")),
      }))),
  );
}

export async function generateReportXlsxBuffer(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  if (report.report_type === REPORT_TYPES.ACCOUNTING_TRANSACTIONS) {
    buildTransactionsWorkbook(workbook, report);
  } else if (report.report_type === REPORT_TYPES.ACCOUNTING_PAYABLES) {
    buildPayablesWorkbook(workbook, report);
  } else if (report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES) {
    buildExistencesWorkbook(workbook, report);
  } else if (report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS) {
    buildCountsAdjustmentsWorkbook(workbook, report);
  }

  if (report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES
    || report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS) {
    addSheetWithColumns(
      workbook,
      "Advertencias",
      [{ header: "Advertencia", key: "advertencia", width: 120 }],
      warningsSheetRows(report),
    );
  }

  addSheetWithColumns(
    workbook,
    "Filtros",
    [
      { header: "Filtro", key: "clave", width: 28 },
      { header: "Valor", key: "valor", width: 40 },
    ],
    filtersSheetRows(report),
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
