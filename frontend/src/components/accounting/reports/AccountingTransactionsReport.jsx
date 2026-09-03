import { useCallback, useEffect, useRef, useState } from "react";
import {
  exportAccountingTransactionsReport,
  getAccountingTransactionsReport,
} from "../../../services/accounting-report.service";
import {
  ACCOUNTING_REPORT_CURRENCIES,
  ACCOUNTING_REPORT_TRANSACTION_ORIGINS,
  ACCOUNTING_REPORT_TRANSACTION_STATES,
  ACCOUNTING_REPORT_TRANSACTION_TYPES,
  buildDefaultTransactionsReportFilters,
  formatAccountingReportDateTime,
  formatAccountingReportLabel,
  formatAccountingReportMoney,
  getAccountingReportStateTone,
  getAccountingReportTransactionTone,
  validateTransactionsReportFilters,
} from "./accountingReports.shared";
import ReportExportMenu from "./ReportExportMenu";
import ReportFilterBar from "./ReportFilterBar";
import ReportPagination from "./ReportPagination";

function AccountingBadge({ children, tone = "neutral" }) {
  return <span className={`accounting-badge accounting-badge-${tone}`}>{children}</span>;
}

function buildDefaultFiltersSnapshot() {
  return buildDefaultTransactionsReportFilters();
}

export default function AccountingTransactionsReport({
  canExport,
  categories = [],
  paymentProviders = [],
}) {
  const [draftFilters, setDraftFilters] = useState(() => buildDefaultFiltersSnapshot());
  const [appliedFilters, setAppliedFilters] = useState(() => buildDefaultFiltersSnapshot());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [exportState, setExportState] = useState("");
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const initialRequestRef = useRef({
    filters: buildDefaultFiltersSnapshot(),
    page: 1,
    limit: 20,
  });

  const loadPreview = useCallback(async (nextFilters, nextPage, nextLimit) => {
    abortControllerRef.current?.abort();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("loading");
    setError("");

    try {
      const report = await getAccountingTransactionsReport(
        {
          ...nextFilters,
          page: nextPage,
          limit: nextLimit,
        },
        { signal: controller.signal },
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      setPreview(report);
      setPagination(report.pagination);
      setStatus(report.rows.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      if (loadError?.code === "ERR_CANCELED") {
        return;
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setStatus("error");
      setError(loadError.message || "No fue posible cargar el informe.");
    }
  }, []);

  useEffect(() => {
    const initialRequest = initialRequestRef.current;
    void loadPreview(initialRequest.filters, initialRequest.page, initialRequest.limit);
    return undefined;
  }, [loadPreview]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const hasCategoryCatalog = categories.length > 0;
  const hasProviderCatalog = paymentProviders.length > 0;
  const canExportCurrentView = canExport && Boolean(preview);

  async function handleExport(format) {
    if (!preview || exportState) {
      return;
    }

    const nextState = format === "pdf" ? "exporting_pdf" : "exporting_xlsx";
    setExportState(nextState);

    try {
      await exportAccountingTransactionsReport(appliedFilters, format);
    } catch (exportError) {
      setError(exportError.message || "No fue posible generar el informe.");
      setStatus("error");
    } finally {
      setExportState("");
    }
  }

  function handleDraftChange(key, value) {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setValidationError("");
  }

  function handleApplyFilters() {
    const nextValidationError = validateTransactionsReportFilters(draftFilters);
    setValidationError(nextValidationError);

    if (nextValidationError) {
      return;
    }

    const nextAppliedFilters = { ...draftFilters };
    const nextPage = 1;
    const nextLimit = pagination.limit || 20;

    setAppliedFilters(nextAppliedFilters);
    setPagination((current) => ({
      ...current,
      page: nextPage,
      limit: nextLimit,
    }));

    void loadPreview(nextAppliedFilters, nextPage, nextLimit);
  }

  function handleClearFilters() {
    const nextFilters = buildDefaultFiltersSnapshot();
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setValidationError("");
    setError("");
    setPagination((current) => ({
      ...current,
      page: 1,
      limit: 20,
    }));
    void loadPreview(nextFilters, 1, 20);
  }

  function handlePageChange(nextPage) {
    if (!preview || nextPage < 1 || nextPage > pagination.totalPages) {
      return;
    }

    setPagination((current) => ({
      ...current,
      page: nextPage,
    }));
    void loadPreview(appliedFilters, nextPage, pagination.limit);
  }

  function handleLimitChange(nextLimit) {
    setPagination((current) => ({
      ...current,
      page: 1,
      limit: nextLimit,
    }));
    void loadPreview(appliedFilters, 1, nextLimit);
  }
return (
    <section
      role="tabpanel"
      id="accounting-report-panel-transactions"
      aria-labelledby="accounting-report-tab-transactions"
      className="home-tab-panel accounting-panel accounting-report-panel"
    >
      <section className="crud-card accounting-card">
        <div className="crud-header accounting-card-header">
          <div>
            <h3>Movimientos contables</h3>
            <p>
              Consulta la vista previa y descarga exactamente los mismos filtros aplicados.
            </p>
          </div>
        </div>

     <ReportFilterBar
  idPrefix="accounting-transactions-report"
  onApply={handleApplyFilters}
  onClear={handleClearFilters}
  applyDisabled={status === "loading"}
  clearDisabled={status === "loading"}
  validationError={validationError}
  actionSlot={(
    <ReportExportMenu
      canExport={canExportCurrentView}
      disabled={status === "loading"}
      exportState={exportState}
      onExport={handleExport}
    />
  )}
>
   <label className="accounting-report-filter-span-2">
          <span>Buscar</span>
          <input
            type="search"
            value={draftFilters.search}
            onChange={(event) => handleDraftChange("search", event.target.value)}
            placeholder="Descripción, referencia, categoría o proveedor"
          />
        </label>
        <label>
          <span>Fecha desde</span>
          <input
            type="date"
            value={draftFilters.fecha_desde}
            onChange={(event) => handleDraftChange("fecha_desde", event.target.value)}
          />
        </label>

        <label>
          <span>Fecha hasta</span>
          <input
            type="date"
            value={draftFilters.fecha_hasta}
            onChange={(event) => handleDraftChange("fecha_hasta", event.target.value)}
          />
        </label>

        <label>
          <span>Tipo</span>
          <select
            value={draftFilters.tipo}
            onChange={(event) => handleDraftChange("tipo", event.target.value)}
          >
            <option value="">Todos los tipos</option>
            {ACCOUNTING_REPORT_TRANSACTION_TYPES.map((item) => (
              <option key={item} value={item}>
                {formatAccountingReportLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Estado</span>
          <select
            value={draftFilters.estado}
            onChange={(event) => handleDraftChange("estado", event.target.value)}
          >
            <option value="">Estados predeterminados</option>
            {ACCOUNTING_REPORT_TRANSACTION_STATES.map((item) => (
              <option key={item} value={item}>
                {formatAccountingReportLabel(item)}
              </option>
            ))}
          </select>
        </label>

        {hasCategoryCatalog ? (
          <label>
            <span>Categoria</span>
            <select
              value={draftFilters.categoria_id}
              onChange={(event) => handleDraftChange("categoria_id", event.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nombre || category.clave}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Categoria</span>
            <select
              value={draftFilters.categoria_id}
              onChange={(event) => handleDraftChange("categoria_id", event.target.value)}
              disabled
            >
              <option value="">Sincategoríasdisponibles</option>
            </select>
          </label>
        )}

        {hasProviderCatalog ? (
          <label>
            <span>Proveedor de pago</span>
            <select
              value={draftFilters.proveedor_pago_id}
              onChange={(event) => handleDraftChange("proveedor_pago_id", event.target.value)}
            >
              <option value="">Todos</option>
              {paymentProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.nombre || provider.clave}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Proveedor de pago</span>
            <select
              value={draftFilters.proveedor_pago_id}
              onChange={(event) => handleDraftChange("proveedor_pago_id", event.target.value)}
              disabled
            >
              <option value="">Sin proveedores disponibles</option>
            </select>
          </label>
        )}

        <label>
          <span>Moneda</span>
          <select
            value={draftFilters.moneda}
            onChange={(event) => handleDraftChange("moneda", event.target.value)}
          >
            <option value="">Todas</option>
            {ACCOUNTING_REPORT_CURRENCIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Origen</span>
          <select
            value={draftFilters.origin}
            onChange={(event) => handleDraftChange("origin", event.target.value)}
          >
            <option value="">Todos los origenes</option>
            {ACCOUNTING_REPORT_TRANSACTION_ORIGINS.map((item) => (
              <option key={item} value={item}>
                {formatAccountingReportLabel(item)}
              </option>
            ))}
          </select>
        </label>

      </ReportFilterBar>

      <section
  className="accounting-report-table-section"
  aria-labelledby="accounting-report-transactions-table-title"
>

        {error ? (
          <div className="accounting-feedback accounting-feedback-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => void loadPreview(appliedFilters, pagination.page, pagination.limit)}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {status === "loading" && !preview ? (
          <div className="accounting-empty-state">
            <p>Cargando informe...</p>
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="accounting-empty-state">
            <p>No se encontraron registros para los filtros seleccionados.</p>
          </div>
        ) : null}

        {preview?.rows?.length ? (
          <>
            <div className="accounting-table-wrapper accounting-report-table-wrapper">
              <table className="accounting-table accounting-report-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="accounting-report-col-optional">Categoria</th>
                    <th scope="col" className="accounting-report-col-optional">Clasificacion</th>
                    <th scope="col" className="accounting-table-number">Bruto</th>
                    <th scope="col" className="accounting-table-number accounting-report-col-optional">Fee</th>
                    <th scope="col" className="accounting-table-number">Neto</th>
                    <th scope="col">Moneda</th>
                    <th scope="col" className="accounting-report-col-optional">Proveedor</th>
                    <th scope="col" className="accounting-report-col-optional">Referencia</th>
                    <th scope="col" className="accounting-report-col-optional">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatAccountingReportDateTime(row.fecha)}</td>
                      <td>
                        <div className="accounting-cell-stack">
                          <strong>{row.descripcion || `Transaccion #${row.id}`}</strong>
                          <span>ID #{row.id}</span>
                        </div>
                      </td>
                      <td>
                        <AccountingBadge tone={getAccountingReportTransactionTone(row.tipo)}>
                          {formatAccountingReportLabel(row.tipo)}
                        </AccountingBadge>
                      </td>
                      <td>
                        <AccountingBadge tone={getAccountingReportStateTone(row.estado)}>
                          {formatAccountingReportLabel(row.estado)}
                        </AccountingBadge>
                      </td>
                      <td className="accounting-report-col-optional">
                        {row.categoria?.nombre || "Sin categoria"}
                      </td>
                      <td className="accounting-report-col-optional">
                        {formatAccountingReportLabel(row.clasificacion)}
                      </td>
                      <td className="accounting-table-number">{formatAccountingReportMoney(row.montoBruto, row.moneda)}</td>
                      <td className="accounting-table-number accounting-report-col-optional">
                        {formatAccountingReportMoney(row.montoFee, row.moneda)}
                      </td>
                      <td className="accounting-table-number">{formatAccountingReportMoney(row.montoNeto, row.moneda)}</td>
                      <td>{row.moneda}</td>
                      <td className="accounting-report-col-optional">
                        {row.proveedorPago?.nombre || "Sin proveedor"}
                      </td>
                      <td className="accounting-report-col-optional">
                        {row.referenciaExterna || "Sin referencia"}
                      </td>
                      <td className="accounting-report-col-optional">
                        {formatAccountingReportLabel(row.origen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ReportPagination
              pagination={pagination}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              disabled={status === "loading"}
            />
          </>
        ) : null}
        </section>
      </section>
    </section>
  );
}
