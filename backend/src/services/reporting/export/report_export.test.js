"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildDocDefinition, generateReportPdfBuffer } from "./report_pdf.exporter.js";
import { generateReportXlsxBuffer } from "./report_xlsx.exporter.js";

test("generateReportPdfBuffer devuelve un PDF valido no vacio", async () => {
  const buffer = await generateReportPdfBuffer({
    report_type: "ACCOUNTING_TRANSACTIONS",
    generated_by: { name: "Ana Perez" },
    filters: {
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
    summary: {
      monedas: {
        CLP: {
          moneda: "CLP",
          ingresos_brutos: 1000,
          egresos_brutos: 0,
          fees: 0,
          resultado_neto: 1000,
          operaciones: 1,
        },
      },
    },
    warnings: ["Advertencia de prueba"],
    rows: [
      {
        fecha: "2026-06-23T12:00:00.000Z",
        tipo: "INGRESO",
        estado: "CONFIRMADA",
        categoria: { nombre: "Donacion" },
        descripcion: "Ingreso de prueba",
        monto_bruto: 1000,
        monto_fee: 0,
        monto_neto: 1000,
        moneda: "CLP",
        proveedor_pago: { nombre: "Caja" },
        referencia_externa: "REF-1",
        origen: "MANUAL",
        clasificacion: "NORMAL",
      },
    ],
  });

  assert.ok(buffer.length > 0);
  assert.equal(buffer.toString("utf8", 0, 5), "%PDF-");
});

test("buildDocDefinition usa landscape y widths definidos para informes contables y de cuentas por pagar", () => {
  const transactionsDoc = buildDocDefinition({
    report_type: "ACCOUNTING_TRANSACTIONS",
    generated_by: { name: "Ana Perez" },
    filters: {
      display_filters: [
        { label: "Fecha desde", value: "01-06-2026" },
        { label: "Origen", value: "Donacion de PayPal" },
      ],
    },
    summary: { monedas: {} },
    warnings: [],
    rows: [
      {
        fecha: "2026-06-23T12:00:00.000Z",
        tipo: "INGRESO",
        estado: "CONFIRMADA",
        categoria: { nombre: "Donacion" },
        descripcion: "Ingreso de prueba",
        monto_bruto: 1000,
        monto_fee: 0,
        monto_neto: 1000,
        moneda: "CLP",
        proveedor_pago: { nombre: "Caja" },
        referencia_externa: "REF-1",
        origen: "MANUAL",
        clasificacion: "NORMAL",
      },
    ],
  });
  const payablesDoc = buildDocDefinition({
    report_type: "ACCOUNTING_PAYABLES",
    generated_by: { name: "Ana Perez" },
    filters: {},
    summary: { monedas: {} },
    warnings: [],
    rows: [
      {
        id: 10,
        fecha: "2026-06-20",
        fecha_vencimiento: "2026-06-30",
        concepto: "Compra insumos",
        estado: "PENDIENTE",
        monto_original: 20000,
        monto_pagado: 0,
        saldo_pendiente: 20000,
        moneda: "CLP",
        contraparte: { nombre: "Proveedor Uno", tipo: "SUPPLIER" },
        origen: { descripcion: "Compra #10", tipo: "PURCHASE" },
        pagos: { cantidad: 0, ultima_fecha_pago: null },
      },
    ],
    payments: [],
  });

  const transactionsTable = transactionsDoc.content.find(
    (entry) => entry?.stack?.[0]?.text === "Transacciones",
  );
  const transactionsSummaryTable = transactionsDoc.content.find(
    (entry) => entry?.stack?.[0]?.text === "Resumen por moneda",
  );
  const payablesTable = payablesDoc.content.find(
    (entry) => entry?.stack?.[0]?.text === "Cuentas por pagar",
  );

  assert.equal(transactionsDoc.pageOrientation, "landscape");
  assert.equal(payablesDoc.pageOrientation, "landscape");
  assert.deepEqual(transactionsDoc.pageSize, "A4");
  assert.deepEqual(payablesDoc.pageSize, "A4");
  assert.equal(transactionsTable.stack[1].table.headerRows, 1);
  assert.equal(payablesTable.stack[1].table.headerRows, 1);
  assert.ok(
    transactionsTable.stack[1].table.widths.some((width) => typeof width === "number"),
  );
  assert.ok(
    payablesTable.stack[1].table.widths.some((width) => typeof width === "number"),
  );
  assert.equal(transactionsSummaryTable.stack[1].table.body[0][1].text, "Ingresos");
});

test("buildDocDefinition formatea montos del resumen contable sin dejar ceros vacios", () => {
  const doc = buildDocDefinition({
    report_type: "ACCOUNTING_TRANSACTIONS",
    generated_by: { name: "Ana Perez" },
    filters: {},
    summary: {
      monedas: {
        CLP: {
          moneda: "CLP",
          ingresos_brutos: 9000,
          egresos_brutos: 0,
          fees: 0,
          resultado_neto: 9000,
          operaciones: 7,
        },
        USD: {
          moneda: "USD",
          ingresos_brutos: 10000.99,
          egresos_brutos: 2000,
          fees: 100.5,
          resultado_neto: 7900.49,
          operaciones: 50,
        },
      },
    },
    warnings: [],
    rows: [],
  });

  const summaryTable = doc.content.find(
    (entry) => entry?.stack?.[0]?.text === "Resumen por moneda",
  );
  const clpRow = summaryTable.stack[1].table.body[1];
  const usdRow = summaryTable.stack[1].table.body[2];

  assert.equal(clpRow[1].text, "CLP $9.000");
  assert.equal(clpRow[2].text, "CLP $0");
  assert.equal(usdRow[1].text, "USD $10,000.99");
  assert.equal(usdRow[3].text, "USD $100.50");
});

test("generateReportXlsxBuffer crea workbook valido y neutraliza texto con formula", async () => {
  const buffer = await generateReportXlsxBuffer({
    report_type: "ACCOUNTING_TRANSACTIONS",
    generated_by: { name: "Ana Perez" },
    filters: { fecha_desde: "2026-06-01", fecha_hasta: "2026-06-30" },
    summary: {
      monedas: {
        CLP: {
          moneda: "CLP",
          ingresos_brutos: 1000,
          egresos_brutos: 0,
          fees: 0,
          refunds: 0,
          reversals: 0,
          resultado_neto: 1000,
          operaciones: 1,
        },
      },
    },
    rows: [
      {
        fecha: "2026-06-23T12:00:00.000Z",
        tipo: "INGRESO",
        estado: "CONFIRMADA",
        categoria: { nombre: "=Donacion" },
        descripcion: "=payload",
        monto_bruto: 1000,
        monto_fee: 0,
        monto_neto: 1000,
        moneda: "CLP",
        proveedor_pago: { nombre: "@Caja" },
        referencia_externa: "+REF-1",
        origen: "-MANUAL",
        clasificacion: "NORMAL",
      },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    "Resumen",
    "Transacciones",
    "Filtros",
  ]);
  assert.equal(workbook.getWorksheet("Transacciones").getCell("D2").value, "'=Donacion");
  assert.equal(workbook.getWorksheet("Transacciones").getCell("E2").value, "'=payload");
  assert.equal(workbook.getWorksheet("Transacciones").getCell("J2").value, "'@Caja");
  assert.equal(workbook.getWorksheet("Transacciones").getCell("F2").numFmt, "#,##0");
  assert.equal(workbook.getWorksheet("Resumen").getCell("B2").numFmt, "#,##0");
  assert.equal(workbook.getWorksheet("Filtros").getCell("A1").value, "Filtro");
});

test("buildDocDefinition para existencias usa landscape y oculta columnas tecnicas en la tabla principal", () => {
  const doc = buildDocDefinition({
    report_type: "INVENTORY_EXISTENCES",
    generated_by: { name: "Ana Perez" },
    filters: {
      categoria_id: 3,
      solo_sin_stock: true,
      solo_bajo_minimo: false,
      activo: false,
    },
    summary: {},
    warnings: [],
    rows: [
      {
        item: { id: 8, nombre: "Pellets para conejo" },
        categoria: { id: 3, nombre: "Alimentos" },
        unidad: { id: 4, nombre: "kg" },
        ubicacion: { id: 2, nombre: "Bodega principal" },
        cantidad_actual: 2.5,
        stock_minimo: 5,
        diferencia_minimo: -2.5,
        estado_stock: "BAJO_MINIMO",
        aggregation: {
          persistence_rows: 3,
          heterogeneous: true,
          mixed_fields: ["estado", "fecha_vencimiento"],
        },
      },
    ],
  });

  const filtersSection = doc.content.find((entry) => entry?.ul);
  const table = doc.content.find((entry) => entry?.stack?.[0]?.text === "Existencias");
  const observations = doc.content.find(
    (entry) => entry?.stack?.[0]?.text === "Observaciones de calidad de datos",
  );
  const headers = table.stack[1].table.body[0].map((cell) => cell.text);

  assert.equal(doc.pageOrientation, "landscape");
  assert.deepEqual(doc.pageMargins, [20, 32, 20, 28]);
  assert.equal(table.stack[1].table.headerRows, 1);
  assert.deepEqual(headers, [
    "Item",
    "Categoria",
    "Unidad",
    "Ubicacion",
    "Cantidad actual",
    "Stock minimo",
    "Diferencia",
    "Estado",
  ]);
  assert.ok(filtersSection.ul.includes("Categoria: Alimentos"));
  assert.ok(filtersSection.ul.includes("Solo sin stock: Aplicado"));
  assert.ok(filtersSection.ul.includes("Estado del item: Inactivos"));
  assert.ok(!filtersSection.ul.some((entry) => /solo_bajo_minimo|false/i.test(entry)));
  assert.ok(observations.stack[1].ul.some((entry) => /agrupa 3 registros/i.test(entry)));
});

test("generateReportXlsxBuffer para inventario traduce filtros y conserva cantidades numericas", async () => {
  const buffer = await generateReportXlsxBuffer({
    report_type: "INVENTORY_COUNTS_ADJUSTMENTS",
    generated_by: { name: "Ana Perez" },
    filters: {
      ubicacion_id: 2,
      con_diferencias: true,
      con_ajuste: false,
      clasificacion_diferencia: "FALTANTE",
    },
    summary: {
      conteos: {
        total: 1,
        calidad_datos: {
          historicos_confirmados: 0,
          derivados_actuales: 1,
          no_resolubles: 0,
        },
      },
      ajustes: {
        total: 1,
      },
    },
    warning_details: [
      {
        message:
          "Existen agregaciones item + ubicacion con heterogeneidad real en: estado, fecha_vencimiento.",
      },
    ],
    counts: [
      {
        count_id: 10,
        fecha: "2026-06-25",
        ubicacion: { id: 2, nombre: "Bodega principal" },
        responsable: { id: 5, nombre: "Ana", apellido: "Perez" },
        items_contados: 2,
        items_con_diferencia: 1,
        sobrantes: 0,
        faltantes: 1,
        adjustments_total: 1,
        detalles: [
          {
            item: { id: 8, nombre: "Pellets para conejo" },
            unidad: { id: 4, nombre: "kg" },
            cantidad_teorica: 5,
            cantidad_contada: 2.5,
            diferencia: -2.5,
            clasificacion: "FALTANTE",
            data_quality: "DERIVADO_DESDE_EXISTENCIA_ACTUAL",
          },
        ],
      },
    ],
    adjustments: [
      {
        adjustment_id: 20,
        fecha: "2026-06-25",
        estado: "APLICADO",
        ubicacion: { id: 2, nombre: "Bodega principal" },
        responsable: { id: 5, nombre: "Ana", apellido: "Perez" },
        conteo_origen: { id: 10 },
        items_ajustados: 1,
        incrementos: 0,
        disminuciones: 1,
        detalles: [
          {
            item: { id: 8, nombre: "Pellets para conejo" },
            unidad: { id: 4, nombre: "kg" },
            cantidad_anterior: 5,
            cantidad_ajustada: 2.5,
            cantidad_posterior: 2.5,
            impacto: "DISMINUCION",
          },
        ],
      },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    "Resumen",
    "Conteos fisicos",
    "Detalles de conteos",
    "Ajustes de inventario",
    "Detalles de ajustes",
    "Advertencias",
    "Filtros",
  ]);
  assert.equal(workbook.getWorksheet("Filtros").getCell("A4").value, "Ubicacion");
  assert.equal(workbook.getWorksheet("Filtros").getCell("B4").value, "Bodega principal");
  assert.equal(workbook.getWorksheet("Filtros").getCell("A5").value, "Solo con diferencias");
  assert.equal(workbook.getWorksheet("Filtros").getCell("B5").value, "Aplicado");
  assert.equal(workbook.getWorksheet("Filtros").getCell("A6").value, "Clasificacion de la diferencia");
  assert.equal(workbook.getWorksheet("Filtros").getCell("B6").value, "Faltante");
  assert.equal(workbook.getWorksheet("Detalles de conteos").getCell("C2").value, "kg");
  assert.equal(typeof workbook.getWorksheet("Detalles de conteos").getCell("D2").value, "number");
  assert.equal(workbook.getWorksheet("Detalles de conteos").getCell("G2").value, "Faltante");
  assert.equal(
    workbook.getWorksheet("Detalles de conteos").getCell("H2").value,
    "Derivado desde existencia actual",
  );
  assert.match(
    String(workbook.getWorksheet("Advertencias").getCell("A2").value),
    /fecha de vencimiento/i,
  );
});
