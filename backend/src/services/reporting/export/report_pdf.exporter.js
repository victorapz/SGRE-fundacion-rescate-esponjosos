"use strict";

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { REPORT_TYPES } from "../report.constants.js";
import {
  buildFilterEntries,
  buildGeneratedMetadata,
  buildWarningMessages,
  formatExportDate,
  formatExportDateTime,
} from "./report_export.shared.js";
import {
  formatAccountingExportLabel,
  formatAccountingExportMoney,
} from "./report_accounting.presentation.js";
import {
  buildInventoryExistenceObservationRows,
  buildInventoryFilterEntries,
  formatInventoryExportLabel,
  formatInventoryQuantity,
  formatInventoryWarningMessage,
} from "./report_inventory.presentation.js";

const require = createRequire(import.meta.url);
const PdfPrinter = require("pdfmake/js/Printer").default;

const fonts = {
  Roboto: {
    normal: fileURLToPath(
      new URL("../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf", import.meta.url),
    ),
    bold: fileURLToPath(
      new URL("../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf", import.meta.url),
    ),
    italics: fileURLToPath(
      new URL("../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf", import.meta.url),
    ),
    bolditalics: fileURLToPath(
      new URL("../../../../node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf", import.meta.url),
    ),
  },
};

const noopUrlResolver = {
  resolve() {},
  async resolved() {},
};

function buildTable(title, columns, rows, options = {}) {
  const {
  fontSize = 8,
    pageBreak,
  } = options;

  return {
    pageBreak,
    stack: [
      { text: title, style: "sectionTitle", margin: [0, 12, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: columns.map((column) => column.width || "*"),
          body: [
            columns.map((column) => ({ text: column.header, style: "tableHeader" })),
            ...rows.map((row) =>
              columns.map((column) => ({
                text: row[column.key] === null || row[column.key] === undefined
                  ? ""
                  : String(row[column.key]),
                alignment: column.align || "left",
                noWrap: column.noWrap === true,
                fontSize: column.fontSize || fontSize,
                margin: [0, 2, 0, 2],
              }))),
          ],
        },
        dontBreakRows: true,
        layout: "lightHorizontalLines",
      },
    ],
  };
}

function buildTransactionsSummaryCurrencyRows(summaryMonedas = {}) {
  return Object.values(summaryMonedas || {}).map((bucket) => ({
    moneda: formatAccountingExportLabel(bucket.moneda),
    ingresos_brutos: formatAccountingExportMoney(bucket.ingresos_brutos ?? 0, bucket.moneda),
    egresos_brutos: formatAccountingExportMoney(bucket.egresos_brutos ?? 0, bucket.moneda),
    fees: formatAccountingExportMoney(bucket.fees ?? 0, bucket.moneda),
    resultado_neto: formatAccountingExportMoney(bucket.resultado_neto ?? 0, bucket.moneda),
    operaciones: bucket.operaciones ?? 0,
  }));
}

function buildPayablesSummaryCurrencyRows(summaryMonedas = {}) {
  return Object.values(summaryMonedas || {}).map((bucket) => ({
    moneda: formatAccountingExportLabel(bucket.moneda),
    obligaciones_total: formatAccountingExportMoney(bucket.obligaciones_total ?? 0, bucket.moneda),
    pagado_total: formatAccountingExportMoney(bucket.pagado_total ?? 0, bucket.moneda),
    saldo_pendiente: formatAccountingExportMoney(bucket.saldo_pendiente ?? 0, bucket.moneda),
    saldo_vencido: formatAccountingExportMoney(bucket.saldo_vencido ?? 0, bucket.moneda),
    cuentas: bucket.cuentas ?? 0,
  }));
}

function mapTransactionsTables(report) {
  return [
    buildTable(
      "Resumen por moneda",
      [
        { key: "moneda", header: "Moneda" },
        { key: "ingresos_brutos", header: "Ingresos", align: "right", width: 66 },
        { key: "egresos_brutos", header: "Egresos", align: "right", width: 66 },
        { key: "fees", header: "Fees", align: "right", width: 54 },
        { key: "resultado_neto", header: "Resultado neto", align: "right", width: 72 },
        { key: "operaciones", header: "Operaciones", align: "right", width: 62 },
      ],
      buildTransactionsSummaryCurrencyRows(report.summary?.monedas),
    ),
    buildTable(
      "Transacciones",
      [
        { key: "fecha", header: "Fecha", width: 62, fontSize: 7 },
        { key: "tipo", header: "Tipo", width: 46, fontSize: 7 },
        { key: "estado", header: "Estado", width: 54, fontSize: 7 },
        { key: "categoria", header: "Categoria / origen", width: 92, fontSize: 7 },
        { key: "descripcion", header: "Descripcion", width: "*", fontSize: 7 },
        { key: "monto_bruto", header: "Bruto", align: "right", width: 58, fontSize: 7, noWrap: true },
        { key: "monto_fee", header: "Fee", align: "right", width: 46, fontSize: 7, noWrap: true },
        { key: "monto_neto", header: "Neto", align: "right", width: 58, fontSize: 7, noWrap: true },
        { key: "moneda", header: "Mon.", width: 36, fontSize: 7, noWrap: true },
        { key: "proveedor_pago", header: "Proveedor / ref.", width: 96, fontSize: 7 },
        { key: "clasificacion", header: "Clase", width: 48, fontSize: 7 },
      ],
      (report.rows || []).map((row) => ({
        fecha: formatExportDateTime(row.fecha),
        tipo: formatAccountingExportLabel(row.tipo),
        estado: formatAccountingExportLabel(row.estado),
        categoria: [row.categoria?.nombre, formatAccountingExportLabel(row.origen)].filter(Boolean).join("\n"),
        descripcion: row.descripcion || "",
        monto_bruto: formatAccountingExportMoney(row.monto_bruto ?? 0, row.moneda),
        monto_fee: formatAccountingExportMoney(row.monto_fee ?? 0, row.moneda),
        monto_neto: formatAccountingExportMoney(row.monto_neto ?? 0, row.moneda),
        moneda: formatAccountingExportLabel(row.moneda),
        proveedor_pago: [row.proveedor_pago?.nombre, row.referencia_externa].filter(Boolean).join("\n"),
        clasificacion: formatAccountingExportLabel(row.clasificacion),
      })),
      { fontSize: 7 },
    ),
  ];
}

function mapPayablesTables(report) {
  return [
    buildTable(
      "Resumen por moneda",
      [
        { key: "moneda", header: "Moneda" },
        { key: "obligaciones_total", header: "Obligaciones", align: "right", width: 72 },
        { key: "pagado_total", header: "Pagado", align: "right", width: 66 },
        { key: "saldo_pendiente", header: "Saldo", align: "right", width: 66 },
        { key: "saldo_vencido", header: "Saldo vencido", align: "right", width: 76 },
        { key: "cuentas", header: "Cuentas", align: "right", width: 58 },
      ],
      buildPayablesSummaryCurrencyRows(report.summary?.monedas),
    ),
    buildTable(
      "Cuentas por pagar",
      [
        { key: "id", header: "ID", align: "right", width: 34, fontSize: 7, noWrap: true },
        { key: "fecha", header: "Emision", width: 52, fontSize: 7 },
        { key: "fecha_vencimiento", header: "Vence", width: 52, fontSize: 7 },
        { key: "concepto", header: "Concepto", width: 90, fontSize: 7 },
        { key: "estado", header: "Estado", width: 54, fontSize: 7 },
        { key: "contraparte", header: "Contraparte / origen", width: "*", fontSize: 7 },
        { key: "monto_original", header: "Total", align: "right", width: 58, fontSize: 7, noWrap: true },
        { key: "monto_pagado", header: "Pagado", align: "right", width: 58, fontSize: 7, noWrap: true },
        { key: "saldo_pendiente", header: "Saldo", align: "right", width: 58, fontSize: 7, noWrap: true },
        { key: "moneda", header: "Mon.", width: 34, fontSize: 7, noWrap: true },
        { key: "cantidad_pagos", header: "Pagos", align: "right", width: 40, fontSize: 7, noWrap: true },
        { key: "ultima_fecha_pago", header: "Ult. pago", width: 54, fontSize: 7 },
      ],
      (report.rows || []).map((row) => ({
        id: row.id ?? "",
        fecha: formatExportDate(row.fecha),
        fecha_vencimiento: formatExportDate(row.fecha_vencimiento),
        concepto: row.concepto || row.categoria?.nombre || "",
        estado: formatAccountingExportLabel(row.estado),
        contraparte: [
          row.contraparte?.nombre || formatAccountingExportLabel(row.contraparte?.tipo) || "",
          row.origen?.descripcion || formatAccountingExportLabel(row.origen?.tipo) || "",
        ].filter(Boolean).join("\n"),
        monto_original: formatAccountingExportMoney(row.monto_original ?? 0, row.moneda),
        monto_pagado: formatAccountingExportMoney(row.monto_pagado ?? 0, row.moneda),
        saldo_pendiente: formatAccountingExportMoney(row.saldo_pendiente ?? 0, row.moneda),
        moneda: formatAccountingExportLabel(row.moneda),
        cantidad_pagos: row.pagos?.cantidad || 0,
        ultima_fecha_pago: formatExportDate(row.pagos?.ultima_fecha_pago),
      })),
      { fontSize: 7 },
    ),
    buildTable(
      "Pagos asociados",
      [
        { key: "payable_id", header: "Cuenta", align: "right", width: 44, noWrap: true },
        { key: "fecha_pago", header: "Fecha", width: 60 },
        { key: "monto_aplicado", header: "Monto aplicado", align: "right", width: 70, noWrap: true },
        { key: "moneda", header: "Mon.", width: 36, noWrap: true },
        { key: "proveedor_pago", header: "Proveedor", width: "*" },
        { key: "referencia_segura", header: "Referencia", width: 100 },
      ],
      (report.payments || []).map((row) => ({
        ...row,
        fecha_pago: formatExportDate(row.fecha_pago),
        moneda: formatAccountingExportLabel(row.moneda),
        proveedor_pago: row.proveedor_pago?.nombre || "",
        monto_aplicado: formatAccountingExportMoney(row.monto_aplicado ?? 0, row.moneda || report.rows?.find((item) => item.id === row.payable_id)?.moneda || "CLP"),
      })),
      { fontSize: 7 },
    ),
  ];
}

function mapExistencesTables(report) {
  const tables = [
    buildTable(
      "Existencias",
      [
        { key: "item", header: "Item", width: 110 },
        { key: "categoria", header: "Categoria", width: 82 },
        { key: "unidad", header: "Unidad", width: 55 },
        { key: "ubicacion", header: "Ubicacion", width: 90 },
        { key: "cantidad_actual", header: "Cantidad actual", align: "right", width: 62 },
        { key: "stock_minimo", header: "Stock minimo", align: "right", width: 58 },
        { key: "diferencia_minimo", header: "Diferencia", align: "right", width: 58 },
        { key: "estado_stock", header: "Estado", width: 72 },
      ],
      (report.rows || []).map((row) => ({
        item: row.item?.nombre || "",
        categoria: row.categoria?.nombre || "",
        unidad: row.unidad?.nombre || "",
        ubicacion: row.ubicacion?.nombre || "",
        cantidad_actual: formatInventoryQuantity(row.cantidad_actual, row.unidad?.nombre || ""),
        stock_minimo: formatInventoryQuantity(row.stock_minimo, row.unidad?.nombre || ""),
        diferencia_minimo: formatInventoryQuantity(row.diferencia_minimo, row.unidad?.nombre || ""),
        estado_stock: formatInventoryExportLabel(row.estado_stock),
      })),
      { fontSize: 7 },
    ),
  ];

  const observationRows = buildInventoryExistenceObservationRows(report.rows || []);
  if (observationRows.length > 0) {
    tables.push({
      stack: [
        { text: "Observaciones de calidad de datos", style: "sectionTitle", margin: [0, 12, 0, 6] },
        { ul: observationRows },
      ],
    });
  }

  return tables;
}

function flattenCountDetails(report) {
  return (report.counts || []).flatMap((count) =>
    (count.detalles || []).map((detail) => ({
      count_id: count.count_id,
      fecha: formatExportDate(count.fecha),
      ubicacion: count.ubicacion?.nombre || "",
      responsable: [count.responsable?.nombre, count.responsable?.apellido].filter(Boolean).join(" "),
      item: detail.item?.nombre || "",
      unidad: detail.unidad?.nombre || "",
      cantidad_teorica: formatInventoryQuantity(detail.cantidad_teorica, detail.unidad?.nombre || ""),
      cantidad_contada: formatInventoryQuantity(detail.cantidad_contada, detail.unidad?.nombre || ""),
      diferencia: formatInventoryQuantity(detail.diferencia, detail.unidad?.nombre || ""),
      clasificacion: formatInventoryExportLabel(detail.clasificacion),
      data_quality: formatInventoryExportLabel(detail.data_quality),
      ajuste_vinculado: detail.ajuste_vinculado?.adjustment_id || "",
    })));
}

function flattenAdjustmentDetails(report) {
  return (report.adjustments || []).flatMap((adjustment) =>
    (adjustment.detalles || []).map((detail) => ({
      adjustment_id: adjustment.adjustment_id,
      fecha: formatExportDate(adjustment.fecha),
      estado: adjustment.estado,
      tipo: adjustment.incrementos > 0 && adjustment.disminuciones === 0
        ? "POSITIVO"
        : adjustment.disminuciones > 0 && adjustment.incrementos === 0
          ? "NEGATIVO"
          : "MIXTO",
      ubicacion: adjustment.ubicacion?.nombre || "",
      responsable: [adjustment.responsable?.nombre, adjustment.responsable?.apellido].filter(Boolean).join(" "),
      conteo_origen: adjustment.conteo_origen?.id || "",
      item: detail.item?.nombre || "",
      unidad: detail.unidad?.nombre || "",
      cantidad_anterior: formatInventoryQuantity(detail.cantidad_anterior, detail.unidad?.nombre || ""),
      cantidad_ajustada: formatInventoryQuantity(detail.cantidad_ajustada, detail.unidad?.nombre || ""),
      cantidad_posterior: formatInventoryQuantity(detail.cantidad_posterior, detail.unidad?.nombre || ""),
      impacto: formatInventoryExportLabel(detail.impacto),
    })));
}

function mapCountsAdjustmentsTables(report) {
  return [
    buildTable(
      "Conteos fisicos",
      [
        { key: "fecha", header: "Fecha", width: 64 },
        { key: "ubicacion", header: "Ubicacion", width: 110 },
        { key: "responsable", header: "Responsable", width: 92 },
        { key: "items_contados", header: "Items contados", align: "right", width: 56, noWrap: true },
        { key: "items_con_diferencia", header: "Con diferencias", align: "right", width: 60, noWrap: true },
        { key: "sobrantes", header: "Sobrantes", align: "right", width: 52, noWrap: true },
        { key: "faltantes", header: "Faltantes", align: "right", width: 52, noWrap: true },
        { key: "ajuste_generado", header: "Ajuste generado", width: 64 },
      ],
      (report.counts || []).map((row) => ({
        fecha: formatExportDate(row.fecha),
        ubicacion: row.ubicacion?.nombre || "",
        responsable: [row.responsable?.nombre, row.responsable?.apellido].filter(Boolean).join(" "),
        items_contados: row.items_contados,
        items_con_diferencia: row.items_con_diferencia,
        sobrantes: row.sobrantes,
        faltantes: row.faltantes,
        ajuste_generado: row.adjustments_total > 0 ? "Si" : "No",
      })),
      { fontSize: 7 },
    ),
    buildTable(
      "Detalles de conteos",
      [
        { key: "fecha", header: "Fecha", width: 58 },
        { key: "count_id", header: "Conteo", align: "right", width: 42, noWrap: true },
        { key: "item", header: "Item", width: 110 },
        { key: "unidad", header: "Unidad", width: 54 },
        { key: "cantidad_teorica", header: "Cantidad teorica", align: "right", width: 64 },
        { key: "cantidad_contada", header: "Cantidad contada", align: "right", width: 64 },
        { key: "diferencia", header: "Diferencia", align: "right", width: 58 },
        { key: "clasificacion", header: "Clasificacion", width: 64 },
        { key: "data_quality", header: "Calidad del dato", width: 88 },
      ],
      flattenCountDetails(report),
      { fontSize: 7, pageBreak: "before" },
    ),
    buildTable(
      "Ajustes de inventario",
      [
        { key: "fecha", header: "Fecha", width: 58 },
        { key: "estado", header: "Estado", width: 58 },
        { key: "tipo", header: "Tipo", width: 62 },
        { key: "ubicacion", header: "Ubicacion", width: 108 },
        { key: "responsable", header: "Responsable", width: 92 },
        { key: "conteo_origen", header: "Conteo de origen", width: 58, noWrap: true },
        { key: "items_ajustados", header: "Items ajustados", align: "right", width: 58, noWrap: true },
        { key: "impacto", header: "Impacto", width: 76 },
      ],
      (report.adjustments || []).map((row) => ({
        fecha: formatExportDate(row.fecha),
        estado: formatInventoryExportLabel(row.estado),
        tipo: row.incrementos > 0 && row.disminuciones === 0
          ? formatInventoryExportLabel("POSITIVO")
          : row.disminuciones > 0 && row.incrementos === 0
            ? formatInventoryExportLabel("NEGATIVO")
            : "Mixto",
        ubicacion: row.ubicacion?.nombre || "",
        responsable: [row.responsable?.nombre, row.responsable?.apellido].filter(Boolean).join(" "),
        conteo_origen: row.conteo_origen?.id || "",
        items_ajustados: row.items_ajustados,
        impacto:
          row.incrementos > 0 && row.disminuciones > 0
            ? "Incrementos y disminuciones"
            : row.incrementos > 0
              ? "Incrementos"
              : row.disminuciones > 0
                ? "Disminuciones"
                : "Sin cambios",
      })),
      { fontSize: 7, pageBreak: "before" },
    ),
    buildTable(
      "Detalles de ajustes",
      [
        { key: "adjustment_id", header: "Ajuste", align: "right", width: 42, noWrap: true },
        { key: "item", header: "Item", width: 110 },
        { key: "unidad", header: "Unidad", width: 54 },
        { key: "cantidad_anterior", header: "Cantidad anterior", align: "right", width: 66 },
        { key: "cantidad_ajustada", header: "Cantidad aplicada", align: "right", width: 66 },
        { key: "cantidad_posterior", header: "Cantidad posterior", align: "right", width: 66 },
        { key: "impacto", header: "Impacto", width: 70 },
      ],
      flattenAdjustmentDetails(report),
      { fontSize: 7, pageBreak: "before" },
    ),
    ...(buildWarningMessages(report).length > 0
      ? [{
          pageBreak: "before",
          stack: [
            { text: "Observaciones de calidad de datos", style: "sectionTitle", margin: [0, 12, 0, 6] },
            { ul: buildWarningMessages(report).map(formatInventoryWarningMessage) },
          ],
        }]
      : []),
  ];
}

function buildReportTables(report) {
  if (report.report_type === REPORT_TYPES.ACCOUNTING_TRANSACTIONS) {
    return mapTransactionsTables(report);
  }

  if (report.report_type === REPORT_TYPES.ACCOUNTING_PAYABLES) {
    return mapPayablesTables(report);
  }

  if (report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES) {
    return mapExistencesTables(report);
  }

  if (report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS) {
    return mapCountsAdjustmentsTables(report);
  }

  return [];
}

function resolveTitle(reportType) {
  return {
    [REPORT_TYPES.ACCOUNTING_TRANSACTIONS]: "Informe Contable",
    [REPORT_TYPES.ACCOUNTING_PAYABLES]: "Informe de Cuentas por Pagar",
    [REPORT_TYPES.INVENTORY_EXISTENCES]: "Informe de Existencias",
    [REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS]: "Informe de Conteos y Ajustes",
  }[reportType] || "Informe";
}

function buildDocDefinition(report) {
  const metadata = buildGeneratedMetadata(report);
  const warningMessages = report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES
    || report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS
    ? buildWarningMessages(report).map(formatInventoryWarningMessage)
    : buildWarningMessages(report);
  const filterEntries = report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES
    || report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS
    ? buildInventoryFilterEntries(report.filters, report)
    : buildFilterEntries(report.filters);
  const tables = buildReportTables(report);
  const title = resolveTitle(report.report_type);
  const pageOrientation = report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES
    || report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS
    || report.report_type === REPORT_TYPES.ACCOUNTING_TRANSACTIONS
    || report.report_type === REPORT_TYPES.ACCOUNTING_PAYABLES
    ? "landscape"
    : "portrait";

  return {
    pageSize: "A4",
    pageOrientation,
    pageMargins:
      report.report_type === REPORT_TYPES.INVENTORY_EXISTENCES
      || report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS
        ? [20, 32, 20, 28]
        : [24, 40, 24, 32],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
    },
    footer: (currentPage, pageCount) => ({
      margin: [24, 0, 24, 12],
      columns: [
        { text: "Fundacion Rescate Esponjosos", color: "#666666", fontSize: 8 },
        { text: `${currentPage}/${pageCount}`, alignment: "right", color: "#666666", fontSize: 8 },
      ],
    }),
    styles: {
      title: { fontSize: 18, bold: true },
      subtitle: { fontSize: 9, color: "#555555" },
      sectionTitle: { fontSize: 12, bold: true },
      tableHeader: { bold: true, fillColor: "#eeeeee" },
    },
    content: [
      { text: "Fundacion Rescate Esponjosos", style: "title" },
      { text: title, margin: [0, 4, 0, 2] },
      {
        text: `Generado: ${metadata.generated_label} | Usuario: ${metadata.generated_by}`,
        style: "subtitle",
      },
      ...(filterEntries.length > 0
        ? [
            { text: "Filtros", style: "sectionTitle", margin: [0, 12, 0, 6] },
            {
              ul: filterEntries.map((entry) => `${entry.label}: ${entry.value}`),
            },
          ]
        : []),
      ...tables,
      ...(warningMessages.length > 0
        ? [
            { text: "Advertencias", style: "sectionTitle", margin: [0, 12, 0, 6] },
            { ul: warningMessages },
          ]
        : []),
    ],
  };
}

export async function generateReportPdfBuffer(report) {
  const printer = new PdfPrinter(fonts, null, noopUrlResolver);
  const docDefinition = buildDocDefinition(report);
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);
  const chunks = [];

  return new Promise((resolve, reject) => {
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

export {
  buildDocDefinition,
};
