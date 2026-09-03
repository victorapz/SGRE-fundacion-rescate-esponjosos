"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { AppDataSource } from "../../config/configDb.js";
import {
  PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS,
} from "../../entities/financialConcept/public_monthly_accounting_report.entity.js";
import { buildAccountingTransactionsReportDataset } from "./accounting_report.service.js";
import {
  archivePublicMonthlyAccountingReportService,
  buildPublicMonthlyAccountingPdfFilename,
  buildPublicMonthlyAccountingSnapshot,
  downloadPublishedPublicMonthlyAccountingReportService,
  generatePublicMonthlyAccountingReportService,
  getPublishedPublicMonthlyAccountingReportByIdService,
  listPublishedPublicMonthlyAccountingReportsService,
  publishPublicMonthlyAccountingReportService,
} from "./public_monthly_accounting_report.service.js";
import { generatePublicMonthlyAccountingReportPdfBuffer } from "./publicMonthlyAccountingReport.pdf.js";

function createFakeReportRepository(initialItems = []) {
  const store = initialItems.map((item) => ({ ...item }));
  let nextId = store.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;

  function matchesWhere(item, where = {}) {
    return Object.entries(where).every(([key, value]) => item[key] === value);
  }

  function sortItems(items, order = {}) {
    const entries = Object.entries(order);
    if (!entries.length) {
      return [...items];
    }

    return [...items].sort((left, right) => {
      for (const [key, direction] of entries) {
        const leftValue = left[key];
        const rightValue = right[key];
        if (leftValue === rightValue) {
          continue;
        }

        if (direction === "DESC") {
          return leftValue > rightValue ? -1 : 1;
        }

        return leftValue > rightValue ? 1 : -1;
      }

      return 0;
    });
  }

  return {
    store,
    create(payload) {
      return { ...payload };
    },
    async save(entity) {
      const normalized = { ...entity };
      if (!normalized.id) {
        normalized.id = nextId;
        nextId += 1;
        normalized.createdAt = normalized.createdAt || new Date().toISOString();
      }

      normalized.updatedAt = new Date().toISOString();
      const currentIndex = store.findIndex((item) => Number(item.id) === Number(normalized.id));
      if (currentIndex >= 0) {
        store[currentIndex] = { ...store[currentIndex], ...normalized };
      } else {
        store.push(normalized);
      }

      return { ...normalized };
    },
    async findOne(options = {}) {
      const items = sortItems(
        store.filter((item) => matchesWhere(item, options.where || {})),
        options.order || {},
      );
      return items[0] ? { ...items[0] } : null;
    },
    async find(options = {}) {
      let items = sortItems(
        store.filter((item) => matchesWhere(item, options.where || {})),
        options.order || {},
      );
      if (Number.isInteger(options.skip) && options.skip > 0) {
        items = items.slice(options.skip);
      }
      if (Number.isInteger(options.take)) {
        items = items.slice(0, options.take);
      }
      return items.map((item) => ({ ...item }));
    },
    async findAndCount(options = {}) {
      const all = sortItems(
        store.filter((item) => matchesWhere(item, options.where || {})),
        options.order || {},
      );
      let items = [...all];
      if (Number.isInteger(options.skip) && options.skip > 0) {
        items = items.slice(options.skip);
      }
      if (Number.isInteger(options.take)) {
        items = items.slice(0, options.take);
      }
      return [items.map((item) => ({ ...item })), all.length];
    },
  };
}

function buildMonthlyDataset(summaryOverrides = {}) {
  return {
    summary: {
      monedas: {
        CLP: { moneda: "CLP" },
        USD: { moneda: "USD" },
      },
      categorias: [
        {
          categoria_id: 10,
          categoria_nombre: "Donaciones puntuales",
          moneda: "CLP",
          tipo: "INGRESO",
          total: 150000,
        },
        {
          categoria_id: 20,
          categoria_nombre: "Gastos operativos",
          moneda: "CLP",
          tipo: "EGRESO",
          total: -40000,
        },
        {
          categoria_id: null,
          categoria_nombre: "Sin categoria",
          moneda: "USD",
          tipo: "INGRESO",
          total: 75.5,
        },
      ],
      ...summaryOverrides,
    },
  };
}

const categoryRepository = {
  async find() {
    return [
      {
        categoria_transaccion_id: 10,
        nombre: "Donaciones puntuales",
        categoria_padre: { nombre: "Donaciones" },
      },
      {
        categoria_transaccion_id: 20,
        nombre: "Gastos operativos",
        categoria_padre: { nombre: "Operación" },
      },
    ];
  },
};

test("buildPublicMonthlyAccountingSnapshot separa monedas y omite datos privados o filas individuales", () => {
  const snapshot = buildPublicMonthlyAccountingSnapshot(
    buildMonthlyDataset().summary,
    new Map([
      [10, { nombre: "Donaciones puntuales", categoria_padre: { nombre: "Donaciones" } }],
      [20, { nombre: "Gastos operativos", categoria_padre: { nombre: "Operación" } }],
    ]),
    {
      year: 2026,
      month: 6,
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
  );

  assert.equal(snapshot.periodo.anio, 2026);
  assert.equal(snapshot.monedas.length, 2);
  assert.deepEqual(snapshot.monedas[0].ingresos_por_categoria, [
    { categoria: "Donaciones", monto: 150000 },
  ]);
  assert.deepEqual(snapshot.monedas[0].egresos_por_categoria, [
    { categoria: "Operación", monto: 40000 },
  ]);
  assert.equal("rows" in snapshot, false);
  assert.equal("warnings" in snapshot, false);
  assert.equal(JSON.stringify(snapshot).includes("referencia_externa"), false);
});

test("generatePublicMonthlyAccountingReportService crea borrador mensual con version incremental", async () => {
  const repository = createFakeReportRepository([
    {
      id: 4,
      year: 2026,
      month: 6,
      version: 1,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.ARCHIVED,
      snapshot: { periodo: {}, monedas: [] },
    },
  ]);

  const [report, error] = await generatePublicMonthlyAccountingReportService(
    { year: 2026, month: 6 },
    { userId: 7, user: { id_usuario: 7, nombre: "Ana", apellido: "Admin" } },
    {
      repository,
      categoryRepository,
      reportDatasetBuilder: async () => buildMonthlyDataset(),
      now: new Date("2026-06-25T12:00:00.000Z"),
    },
  );

  assert.equal(error, null);
  assert.equal(report.version, 2);
  assert.equal(report.status, PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT);
  assert.deepEqual(report.snapshot.periodo, {
    anio: 2026,
    mes: 6,
    fecha_desde: "2026-06-01",
    fecha_hasta: "2026-06-30",
  });
});

test("generatePublicMonthlyAccountingReportService rechaza periodos futuros", async () => {
  const repository = createFakeReportRepository();

  const [report, error] = await generatePublicMonthlyAccountingReportService(
    { year: 2026, month: 7 },
    { userId: 7 },
    {
      repository,
      categoryRepository,
      reportDatasetBuilder: async () => buildMonthlyDataset(),
      now: new Date("2026-06-25T12:00:00.000Z"),
    },
  );

  assert.equal(report, null);
  assert.match(error, /periodo futuro/i);
});

test("publishPublicMonthlyAccountingReportService publica, genera PDF y archiva version previa", async () => {
  const repository = createFakeReportRepository([
    {
      id: 1,
      year: 2026,
      month: 6,
      version: 1,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED,
      snapshot: buildPublicMonthlyAccountingSnapshot(
        buildMonthlyDataset().summary,
        new Map(),
        { year: 2026, month: 6, fecha_desde: "2026-06-01", fecha_hasta: "2026-06-30" },
      ),
      pdf_object_key: "old-key.pdf",
      published_at: "2026-06-10T00:00:00.000Z",
    },
    {
      id: 2,
      year: 2026,
      month: 6,
      version: 2,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT,
      snapshot: buildPublicMonthlyAccountingSnapshot(
        buildMonthlyDataset().summary,
        new Map(),
        { year: 2026, month: 6, fecha_desde: "2026-06-01", fecha_hasta: "2026-06-30" },
      ),
      pdf_object_key: null,
    },
  ]);
  const uploaded = [];
  const originalTransaction = AppDataSource.transaction;
  AppDataSource.transaction = async (callback) => callback({
    getRepository() {
      return repository;
    },
  });

  try {
    const [result, error] = await publishPublicMonthlyAccountingReportService(
      2,
      { userId: 9 },
      {
        repository,
        pdfGenerator: async () => Buffer.from("%PDF-1.4\nfake"),
        uploadBufferService: async (payload) => {
          uploaded.push(payload);
          return true;
        },
      },
    );

    assert.equal(error, null);
    assert.equal(result.status, PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED);
    assert.equal(uploaded.length, 1);
    assert.match(uploaded[0].objectKey, /2026\/06\/v2/);
    assert.equal(repository.store.find((item) => item.id === 1).status, PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.ARCHIVED);
    assert.equal(repository.store.find((item) => item.id === 2).status, PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED);
    assert.equal(repository.store.find((item) => item.id === 2).published_by.id_usuario, 9);
  } finally {
    AppDataSource.transaction = originalTransaction;
  }
});

test("listado y detalle publico exponen solo informes publicados", async () => {
  const repository = createFakeReportRepository([
    {
      id: 1,
      year: 2026,
      month: 6,
      version: 2,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED,
      snapshot: { periodo: {}, monedas: [{ moneda: "CLP" }] },
      published_at: "2026-06-26T00:00:00.000Z",
      pdf_object_key: "public.pdf",
    },
    {
      id: 2,
      year: 2026,
      month: 6,
      version: 1,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.ARCHIVED,
      snapshot: { periodo: {}, monedas: [{ moneda: "USD" }] },
      published_at: "2026-06-20T00:00:00.000Z",
      pdf_object_key: "archived.pdf",
    },
  ]);

  const [listPayload, listError] = await listPublishedPublicMonthlyAccountingReportsService({}, { repository });
  assert.equal(listError, null);
  assert.equal(listPayload.items.length, 1);
  assert.deepEqual(listPayload.items[0].currencies, ["CLP"]);
  assert.equal("version" in listPayload.items[0], false);

  const [detailPayload, detailError] = await getPublishedPublicMonthlyAccountingReportByIdService(1, { repository });
  assert.equal(detailError, null);
  assert.equal(detailPayload.id, 1);
  assert.equal("pdf_object_key" in detailPayload, false);
  assert.equal("version" in detailPayload, false);

  const [missingPayload, missingError] = await getPublishedPublicMonthlyAccountingReportByIdService(2, { repository });
  assert.equal(missingPayload, null);
  assert.match(missingError, /no encontrado/i);
});

test("los DTO administrativos conservan version durante generacion y publicacion", async () => {
  const repository = createFakeReportRepository([
    {
      id: 10,
      year: 2026,
      month: 5,
      version: 1,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT,
      snapshot: buildPublicMonthlyAccountingSnapshot(
        buildMonthlyDataset().summary,
        new Map(),
        { year: 2026, month: 5, fecha_desde: "2026-05-01", fecha_hasta: "2026-05-31" },
      ),
      pdf_object_key: null,
    },
  ]);
  const originalTransaction = AppDataSource.transaction;
  AppDataSource.transaction = async (callback) => callback({
    getRepository() {
      return repository;
    },
  });

  try {
    const [generatedReport] = await generatePublicMonthlyAccountingReportService(
      { year: 2026, month: 6 },
      { userId: 4, user: { id_usuario: 4 } },
      {
        repository,
        categoryRepository,
        reportDatasetBuilder: async () => buildMonthlyDataset(),
        now: new Date("2026-06-25T12:00:00.000Z"),
      },
    );

    assert.equal(generatedReport.version, 1);

    const [publishedReport] = await publishPublicMonthlyAccountingReportService(
      10,
      { userId: 4 },
      {
        repository,
        pdfGenerator: async () => Buffer.from("%PDF-1.4\nfake"),
        uploadBufferService: async () => true,
      },
    );

    assert.equal(publishedReport.version, 1);
  } finally {
    AppDataSource.transaction = originalTransaction;
  }
});

test("downloadPublishedPublicMonthlyAccountingReportService transmite PDF desde MinIO privado sin exponer object key", async () => {
  const repository = createFakeReportRepository([
    {
      id: 3,
      year: 2026,
      month: 6,
      version: 1,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED,
      snapshot: { periodo: {}, monedas: [{ moneda: "CLP" }] },
      pdf_object_key: "accounting/public-monthly/2026/06/v1/report.pdf",
    },
  ]);

  const [payload, error] = await downloadPublishedPublicMonthlyAccountingReportService(
    3,
    {
      repository,
      getObjectStreamService: async () => Readable.from(Buffer.from("pdf")),
    },
  );

  assert.equal(error, null);
  assert.equal(payload.contentType, "application/pdf");
  assert.match(payload.contentDisposition, /informe-financiero-2026-06-v1\.pdf/);
  assert.equal(typeof payload.stream.pipe, "function");
});

test("archivePublicMonthlyAccountingReportService mueve el informe a ARCHIVADO sin tocar snapshot", async () => {
  const repository = createFakeReportRepository([
    {
      id: 5,
      year: 2026,
      month: 5,
      version: 1,
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT,
      snapshot: { periodo: { anio: 2026, mes: 5 }, monedas: [] },
    },
  ]);

  const [payload, error] = await archivePublicMonthlyAccountingReportService(5, {}, { repository });

  assert.equal(error, null);
  assert.equal(payload.status, PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.ARCHIVED);
  assert.deepEqual(payload.snapshot, { periodo: { anio: 2026, mes: 5 }, monedas: [] });
});

test("generatePublicMonthlyAccountingReportPdfBuffer crea un PDF valido desde snapshot publicado", async () => {
  const buffer = await generatePublicMonthlyAccountingReportPdfBuffer({
    report: {
      year: 2026,
      month: 6,
      version: 1,
      snapshot: buildPublicMonthlyAccountingSnapshot(
        buildMonthlyDataset().summary,
        new Map(),
        { year: 2026, month: 6, fecha_desde: "2026-06-01", fecha_hasta: "2026-06-30" },
      ),
    },
    publishedAt: "2026-06-26T15:00:00.000Z",
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 100);
  assert.equal(String(buffer.slice(0, 4)), "%PDF");
});

test("el nombre de archivo del PDF publico es seguro y estable", () => {
  assert.equal(
    buildPublicMonthlyAccountingPdfFilename({
      year: 2026,
      month: 6,
      version: 3,
    }),
    "informe-financiero-2026-06-v3.pdf",
  );
});

test("se mantiene disponible el servicio contable reutilizado", () => {
  assert.equal(typeof buildAccountingTransactionsReportDataset, "function");
});
