import { useCallback, useEffect, useRef, useState } from "react";
import {
  exportPayablesReport,
  getPayablesReport,
} from "../../../services/accounting-report.service";
import {
  ACCOUNTING_REPORT_CURRENCIES,
  ACCOUNTING_REPORT_PAYABLE_ORIGINS,
  ACCOUNTING_REPORT_PAYABLE_STATES,
  buildDefaultPayablesReportFilters,
  formatAccountingReportDate,
  formatAccountingReportLabel,
  formatAccountingReportMoney,
  getAccountingReportStateTone,
  validatePayablesReportFilters,
} from "./accountingReports.shared";
import ReportExportMenu from "./ReportExportMenu";
import ReportFilterBar from "./ReportFilterBar";
import ReportPagination from "./ReportPagination";

function AccountingBadge({ children, tone = "neutral" }) {
  return <span className={`accounting-badge accounting-badge-${tone}`}>{children}</span>;
}

function buildDefaultFiltersSnapshot() {
  return buildDefaultPayablesReportFilters();
}

export default function PayablesReport({
  canExport,
  categories = [],
  suppliers = [],
  clinics = [],
  catalogsLoading = false,
  catalogsError = "",
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
      const report = await getPayablesReport(
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
  const hasSupplierCatalog = suppliers.length > 0;
  const hasClinicCatalog = clinics.length > 0;
  const canExportCurrentView = canExport && Boolean(preview);

  async function handleExport(format) {
    if (!preview || exportState) {
      return;
    }

    const nextState = format === "pdf" ? "exporting_pdf" : "exporting_xlsx";
    setExportState(nextState);

    try {
      await exportPayablesReport(appliedFilters, format);
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
    const nextValidationError = validatePayablesReportFilters(draftFilters);
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
      id="accounting-report-panel-payables"
      aria-labelledby="accounting-report-tab-payables"
      className="home-tab-panel accounting-panel accounting-report-panel"
    >
      <section className="crud-card accounting-card">
        <div className="crud-header accounting-card-header">
          <div>
            <h3>Cuentas por pagar</h3>
            <p>
              Vista previa paginada con resumen por moneda, advertencias y exportación exacta de filtros.
            </p>
          </div>
        </div>

      <ReportFilterBar
        idPrefix="accounting-payables-report"
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
            placeholder="Concepto, descripción, categoría, proveedor o clínica"
          />
        </label>
        <label>
          <span>Emision desde</span>
          <input
            type="date"
            value={draftFilters.fecha_emision_desde}
            onChange={(event) => handleDraftChange("fecha_emision_desde", event.target.value)}
          />
        </label>

        <label>
          <span>Emision hasta</span>
          <input
            type="date"
            value={draftFilters.fecha_emision_hasta}
            onChange={(event) => handleDraftChange("fecha_emision_hasta", event.target.value)}
          />
        </label>

        <label>
          <span>Vencimiento desde</span>
          <input
            type="date"
            value={draftFilters.vencimiento_desde}
            onChange={(event) => handleDraftChange("vencimiento_desde", event.target.value)}
          />
        </label>

        <label>
          <span>Vencimiento hasta</span>
          <input
            type="date"
            value={draftFilters.vencimiento_hasta}
            onChange={(event) => handleDraftChange("vencimiento_hasta", event.target.value)}
          />
        </label>

        <label>
          <span>Estado de la cuenta</span>
          <select
            value={draftFilters.estado}
            onChange={(event) => handleDraftChange("estado", event.target.value)}
          >
            <option value="">Todos</option>
            {ACCOUNTING_REPORT_PAYABLE_STATES.map((item) => (
              <option key={item} value={item}>
                {formatAccountingReportLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Proveedor</span>
          <select
            value={draftFilters.proveedor_id}
            onChange={(event) => handleDraftChange("proveedor_id", event.target.value)}
            disabled={catalogsLoading || (!hasSupplierCatalog && !draftFilters.proveedor_id)}
          >
            <option value="">
              {catalogsLoading
                ? "Cargando proveedores..."
                : catalogsError
                  ? "No fue posible cargar proveedores"
                  : hasSupplierCatalog
                    ? "Todos los proveedores"
                    : "Sin proveedores disponibles"}
            </option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Clínica veterinaria</span>
          <select
            value={draftFilters.clinica_id}
            onChange={(event) => handleDraftChange("clinica_id", event.target.value)}
            disabled={catalogsLoading || (!hasClinicCatalog && !draftFilters.clinica_id)}
          >
            <option value="">
              {catalogsLoading
                ? "Cargando clínicas..."
                : catalogsError
                  ? "No fue posible cargar clínicas"
                  : hasClinicCatalog
                    ? "Todas las clínicas"
                    : "Sin clínicas disponibles"}
            </option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.nombre}
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

        <label>
          <span>Tipo de origen</span>
          <select
            value={draftFilters.origen_tipo}
            onChange={(event) => handleDraftChange("origen_tipo", event.target.value)}
          >
            <option value="">Todos</option>
            {ACCOUNTING_REPORT_PAYABLE_ORIGINS.map((item) => (
              <option key={item} value={item}>
                {formatAccountingReportLabel(item)}
              </option>
            ))}
          </select>
        </label>

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

        <label className="accounting-report-checkbox-field">
          <input
            type="checkbox"
            checked={draftFilters.solo_vencidas === true}
            onChange={(event) => handleDraftChange("solo_vencidas", event.target.checked ? true : null)}
          />
          <span>Solo vencidas</span>
        </label>

        <label className="accounting-report-checkbox-field">
          <input
            type="checkbox"
            checked={draftFilters.con_saldo === true}
            onChange={(event) => handleDraftChange("con_saldo", event.target.checked ? true : null)}
          />
          <span>Solo con saldo pendiente</span>
        </label>
      </ReportFilterBar>

      <section
  className="accounting-report-table-section"
  aria-labelledby="accounting-report-payables-table-title"
>


        {catalogsError ? (
          <div className="accounting-feedback accounting-feedback-error" role="status">
            <span>{catalogsError}</span>
          </div>
        ) : null}

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
                    <th scope="col">Emision</th>
                    <th scope="col">Vencimiento</th>
                    <th scope="col">Concepto</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="accounting-report-col-optional">Contraparte</th>
                    <th scope="col" className="accounting-report-col-optional">Origen</th>
                    <th scope="col" className="accounting-table-number">Monto total</th>
                    <th scope="col" className="accounting-table-number">Pagado</th>
                    <th scope="col" className="accounting-table-number">Saldo</th>
                    <th scope="col">Moneda</th>
                    <th scope="col" className="accounting-report-col-optional">N° pagos</th>
                    <th scope="col" className="accounting-report-col-optional">Ultimo pago</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatAccountingReportDate(row.fecha)}</td>
                      <td>{formatAccountingReportDate(row.fechaVencimiento)}</td>
                      <td>
                        <div className="accounting-cell-stack">
                          <strong>{row.concepto || row.descripcion || `Cuenta #${row.id}`}</strong>
                          <span>ID #{row.id}</span>
                        </div>
                      </td>
                      <td>
                        <AccountingBadge tone={getAccountingReportStateTone(row.estado)}>
                          {formatAccountingReportLabel(row.estado)}
                        </AccountingBadge>
                      </td>
                      <td className="accounting-report-col-optional">
                        {row.contraparte?.nombre || formatAccountingReportLabel(row.contraparte?.tipo)}
                      </td>
                      <td className="accounting-report-col-optional">
                        {row.origen?.descripcion || "Sin origen"}
                      </td>
                      <td className="accounting-table-number">{formatAccountingReportMoney(row.montoOriginal, row.moneda)}</td>
                      <td className="accounting-table-number">{formatAccountingReportMoney(row.montoPagado, row.moneda)}</td>
                      <td className="accounting-table-number">{formatAccountingReportMoney(row.saldoPendiente, row.moneda)}</td>
                      <td>{row.moneda}</td>
                      <td className="accounting-report-col-optional">{row.pagos.cantidad}</td>
                      <td className="accounting-report-col-optional">
                        {row.pagos.ultimaFechaPago
                          ? formatAccountingReportDate(row.pagos.ultimaFechaPago)
                          : "Sin pagos"}
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
