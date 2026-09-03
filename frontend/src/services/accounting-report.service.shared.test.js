import test from "node:test";
import assert from "node:assert/strict";
import {
  assertReportExportFormat,
  buildSafeReportFilename,
  extractReportExportErrorMessage,
  parseContentDispositionFilename,
  resolveReportFilename,
  sanitizeReportFilters,
} from "./accounting-report.service.shared.js";

test("sanitizeReportFilters omite vacios y conserva booleanos", () => {
  const result = sanitizeReportFilters({
    fecha_desde: "2026-06-01",
    fecha_hasta: "   ",
    page: 2,
    limit: 20,
    search: " donacion ",
    solo_vencidas: true,
    con_saldo: null,
  });

  assert.deepEqual(result, {
    fecha_desde: "2026-06-01",
    page: 2,
    limit: 20,
    search: "donacion",
    solo_vencidas: true,
  });
});

test("sanitizeReportFilters export omite page y limit", () => {
  const result = sanitizeReportFilters(
    {
      page: 3,
      limit: 50,
      moneda: "CLP",
    },
    { omitPagination: true },
  );

  assert.deepEqual(result, {
    moneda: "CLP",
  });
});

test("assertReportExportFormat valida pdf y xlsx", () => {
  assert.equal(assertReportExportFormat("pdf"), "pdf");
  assert.equal(assertReportExportFormat("XLSX"), "xlsx");
  assert.throws(() => assertReportExportFormat("csv"));
});

test("parseContentDispositionFilename soporta UTF-8 y filename clasico", () => {
  assert.equal(
    parseContentDispositionFilename("attachment; filename*=UTF-8''informe%20junio.pdf"),
    "informe junio.pdf",
  );
  assert.equal(
    parseContentDispositionFilename('attachment; filename="reporte.xlsx"'),
    "reporte.xlsx",
  );
});

test("resolveReportFilename usa header o fallback seguro", () => {
  assert.equal(
    resolveReportFilename(
      { "content-disposition": 'attachment; filename="movimientos.pdf"' },
      "informe",
      "pdf",
    ),
    "movimientos.pdf",
  );

  assert.equal(
    resolveReportFilename({}, "Informe Contable", "xlsx"),
    buildSafeReportFilename("Informe Contable", "xlsx"),
  );
});

test("extractReportExportErrorMessage traduce 403 y 422 con blob json", async () => {
  const forbidden = await extractReportExportErrorMessage({
    status: 403,
    data: new Blob([JSON.stringify({ message: "Detalle interno" })], {
      type: "application/json",
    }),
  });
  const unprocessable = await extractReportExportErrorMessage({
    status: 422,
    data: new Blob([JSON.stringify({ message: "El informe contiene demasiados registros. Acota los filtros e intenta nuevamente." })], {
      type: "application/json",
    }),
  });

  assert.equal(forbidden, "No tienes permisos para generar este informe.");
  assert.equal(
    unprocessable,
    "El informe contiene demasiados registros. Acota los filtros e intenta nuevamente.",
  );
});
