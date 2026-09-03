"use strict";

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { formatAccountingExportMoney } from "../reporting/export/report_accounting.presentation.js";
import { formatExportDateTime } from "../reporting/export/report_export.shared.js";

const require = createRequire(import.meta.url);
const PdfPrinter = require("pdfmake/js/Printer").default;

const fonts = {
  Roboto: {
    normal: fileURLToPath(
      new URL("../../../node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf", import.meta.url),
    ),
    bold: fileURLToPath(
      new URL("../../../node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf", import.meta.url),
    ),
    italics: fileURLToPath(
      new URL("../../../node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf", import.meta.url),
    ),
    bolditalics: fileURLToPath(
      new URL("../../../node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf", import.meta.url),
    ),
  },
};

const noopUrlResolver = {
  resolve() {},
  async resolved() {},
};

function collectPdfBuffer(document) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.end();
  });
}

function buildCategoryTable(title, rows = [], currency) {
  return {
    stack: [
      { text: title, style: "sectionTitle", margin: [0, 10, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: ["*", 130],
          body: [
            [
              { text: "Categoría", style: "tableHeader" },
              { text: "Monto", style: "tableHeader", alignment: "right" },
            ],
            ...rows.map((row) => ([
              { text: row.categoria || "No disponible" },
              {
                text: formatAccountingExportMoney(row.monto ?? 0, currency),
                alignment: "right",
              },
            ])),
          ],
        },
        layout: "lightHorizontalLines",
      },
    ],
  };
}

export function buildPublicMonthlyAccountingReportDocDefinition({
  report,
  publishedAt,
}) {
  const periodLabel = `${String(report.month).padStart(2, "0")}/${report.year}`;
  const body = [
    { text: "Informe financiero mensual", style: "title" },
    { text: `Período: ${periodLabel}`, style: "subtitle" },
    {
      text: `Fecha de publicación: ${formatExportDateTime(publishedAt)}`,
      style: "meta",
      margin: [0, 0, 0, 8],
    },
  ];

  for (const currencyBucket of report.snapshot?.monedas || []) {
    body.push(
      {
        stack: [
          { text: currencyBucket.moneda || "CLP", style: "currencyTitle", margin: [0, 12, 0, 4] },
          {
            table: {
              widths: ["*", 150],
              body: [
                [
                  { text: "Ingresos totales", style: "tableHeader" },
                  {
                    text: formatAccountingExportMoney(
                      currencyBucket.ingresos_total ?? 0,
                      currencyBucket.moneda,
                    ),
                    alignment: "right",
                  },
                ],
                [
                  { text: "Egresos totales", style: "tableHeader" },
                  {
                    text: formatAccountingExportMoney(
                      currencyBucket.egresos_total ?? 0,
                      currencyBucket.moneda,
                    ),
                    alignment: "right",
                  },
                ],
                [
                  { text: "Resultado del período", style: "tableHeader" },
                  {
                    text: formatAccountingExportMoney(
                      currencyBucket.resultado_periodo ?? 0,
                      currencyBucket.moneda,
                    ),
                    alignment: "right",
                  },
                ],
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
      },
      buildCategoryTable(
        "Ingresos por categoría",
        currencyBucket.ingresos_por_categoria || [],
        currencyBucket.moneda,
      ),
      buildCategoryTable(
        "Egresos por categoría",
        currencyBucket.egresos_por_categoria || [],
        currencyBucket.moneda,
      ),
    );
  }

  return {
    pageSize: "A4",
    pageMargins: [36, 40, 36, 40],
    content: body,
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      lineHeight: 1.2,
    },
    styles: {
      title: {
        fontSize: 18,
        bold: true,
      },
      subtitle: {
        fontSize: 11,
        margin: [0, 4, 0, 0],
      },
      meta: {
        color: "#555555",
        fontSize: 9,
      },
      currencyTitle: {
        fontSize: 13,
        bold: true,
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
      },
      tableHeader: {
        bold: true,
      },
    },
  };
}

export async function generatePublicMonthlyAccountingReportPdfBuffer({
  report,
  publishedAt,
}) {
  const printer = new PdfPrinter(fonts, null, noopUrlResolver);
  const document = await printer.createPdfKitDocument(
    buildPublicMonthlyAccountingReportDocDefinition({
      report,
      publishedAt,
    }),
  );

  return collectPdfBuffer(document);
}
