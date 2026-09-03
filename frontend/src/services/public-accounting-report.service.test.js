import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import api from "../api/axios.js";
import {
  downloadAdminPublicReport,
  listPublishedAccountingReports,
  mapAdminPublicAccountingReport,
  mapPublishedAccountingReport,
  normalizePublicAccountingReportSnapshot,
} from "./public-accounting-report.service.js";

const originalApiGet = api.get;
const originalWindow = global.window;
const originalDocument = global.document;
const originalUrl = global.URL;

afterEach(() => {
  api.get = originalApiGet;
  global.window = originalWindow;
  global.document = originalDocument;
  global.URL = originalUrl;
});

test("normalizePublicAccountingReportSnapshot mapea monedas ycategoríasdel snapshot", () => {
  const result = normalizePublicAccountingReportSnapshot({
    periodo: {
      anio: 2026,
      mes: 6,
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
    monedas: [
      {
        moneda: "CLP",
        ingresos_total: 10000,
        egresos_total: 4500,
        resultado_periodo: 5500,
        ingresos_por_categoria: [{ categoria: "Donaciones", monto: 10000 }],
        egresos_por_categoria: [{ categoria: "Veterinaria", monto: 4500 }],
      },
    ],
  });

  assert.equal(result.period.year, 2026);
  assert.equal(result.period.month, 6);
  assert.equal(result.currencies[0].currency, "CLP");
  assert.equal(result.currencies[0].incomeCategories[0].category, "Donaciones");
  assert.equal(result.currencies[0].expenseCategories[0].amount, 4500);
});

test("listPublishedAccountingReports usa solo el endpoint publico correcto", async () => {
  let requestPath = "";
  let requestConfig = null;

  api.get = async (path, config) => {
    requestPath = path;
    requestConfig = config;
    return {
      data: {
        data: {
          items: [],
          pagination: {
            page: 1,
            limit: 9,
            total: 0,
            totalPages: 1,
          },
        },
      },
    };
  };

  const payload = await listPublishedAccountingReports();

  assert.equal(requestPath, "/public/accounting-reports");
  assert.equal(requestConfig.skipAuth, true);
  assert.deepEqual(payload.items, []);
});

test("mapPublishedAccountingReport omite version y el mapper administrativo la conserva", () => {
  const publicReport = mapPublishedAccountingReport({
    id: 8,
    year: 2026,
    month: 6,
    version: 3,
    published_at: "2026-06-25T12:00:00.000Z",
    currencies: ["CLP"],
    snapshot: { periodo: { anio: 2026, mes: 6 }, monedas: [] },
  });
  const adminReport = mapAdminPublicAccountingReport({
    id: 8,
    year: 2026,
    month: 6,
    version: 3,
    status: "PUBLICADO",
    published_at: "2026-06-25T12:00:00.000Z",
    currencies: ["CLP"],
    snapshot: { periodo: { anio: 2026, mes: 6 }, monedas: [] },
  });

  assert.equal("version" in publicReport, false);
  assert.equal(adminReport.version, 3);
});

test("downloadAdminPublicReport descarga blob y revoca el Object URL", async () => {
  let clicked = false;
  let revokedUrl = "";
  let appendedNode = null;

  global.window = {};
  global.URL = {
    createObjectURL: () => "blob:report",
    revokeObjectURL: (value) => {
      revokedUrl = value;
    },
  };
  global.document = {
    body: {
      appendChild: (node) => {
        appendedNode = node;
      },
    },
    createElement: () => ({
      click: () => {
        clicked = true;
      },
      remove: () => {},
    }),
  };

  api.get = async (path, config) => {
    assert.equal(path, "/accounting/public-reports/17/download");
    assert.equal(config.responseType, "blob");

    return {
      status: 200,
      headers: {
        "content-disposition": 'attachment; filename="informe-financiero.pdf"',
      },
      data: new Blob(["pdf"], { type: "application/pdf" }),
    };
  };

  await downloadAdminPublicReport(17);

  assert.ok(appendedNode);
  assert.equal(clicked, true);
  assert.equal(revokedUrl, "blob:report");
});
