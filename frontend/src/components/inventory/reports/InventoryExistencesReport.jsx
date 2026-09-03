import { useCallback, useEffect, useRef, useState } from "react";
import {
  exportInventoryExistencesReport,
  getInventoryExistencesReport,
} from "../../../services/inventory-report.service";
import InventoryReportExportMenu from "./InventoryReportExportMenu";
import InventoryReportFilterBar from "./InventoryReportFilterBar";
import InventoryReportPagination from "./InventoryReportPagination";
import {
  INVENTORY_REPORT_STOCK_STATES,
  buildDefaultExistencesReportFilters,
  formatInventoryReportLabel,
  formatInventoryReportQuantity,
  getInventoryStockTone,
  normalizeExistencesReportFilters,
  validateExistencesReportFilters,
} from "./inventoryReports.shared";

function InventoryBadge({ children, tone = "neutral" }) {
  return <span className={`inventory-badge inventory-badge-${tone}`}>{children}</span>;
}

function buildDefaultFiltersSnapshot() {
  return buildDefaultExistencesReportFilters();
}

function buildAppliedFiltersSnapshot(filters, page, limit) {
  return {
    ...filters,
    page,
    limit,
  };
}

function renderAggregationNote(row) {
  if (!row?.aggregation?.persistenceRows || row.aggregation.persistenceRows <= 1) {
    return null;
  }

  if (row.aggregation.heterogeneous) {
    return "Información heterogenea";
  }

  return "Datos agrupados";
}

export default function InventoryExistencesReport({
  refreshKey = 0,
  canExport,
  categories = [],
  items = [],
  locations = [],
  units = [],
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
  const handledRefreshKeyRef = useRef(0);
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
      const report = await getInventoryExistencesReport(
        buildAppliedFiltersSnapshot(nextFilters, nextPage, nextLimit),
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
        if (requestId === requestIdRef.current) {
          setStatus((current) => (current === "loading" ? "idle" : current));
        }
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

  useEffect(() => {
    if (refreshKey <= 0 || handledRefreshKeyRef.current === refreshKey) {
      return;
    }

    handledRefreshKeyRef.current = refreshKey;
    void loadPreview(appliedFilters, pagination.page, pagination.limit);
  }, [appliedFilters, loadPreview, pagination.limit, pagination.page, refreshKey]);

  const canExportCurrentView = canExport && Boolean(preview);

  async function handleExport(format) {
    if (!preview || exportState) {
      return;
    }

    const nextState = format === "pdf" ? "exporting_pdf" : "exporting_xlsx";
    setExportState(nextState);

    try {
      await exportInventoryExistencesReport(appliedFilters, format);
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
    const nextValidationError = validateExistencesReportFilters(draftFilters);
    setValidationError(nextValidationError);

    if (nextValidationError) {
      return;
    }

    const nextAppliedFilters = normalizeExistencesReportFilters(draftFilters);
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
      id="inventory-report-panel-existences"
      aria-labelledby="inventory-report-tab-existences"
      className="home-tab-panel inventory-panel inventory-report-panel"
    >
      <section className="crud-card inventory-card">
        <div className="crud-header inventory-card-header">
          <div>
            <h3>Existencias actuales</h3>
            <p>
              Consulta el stock disponible por item y ubicación y descarga exactamente los filtros aplicados.
            </p>
          </div>
        </div>

        <InventoryReportFilterBar
          idPrefix="inventory-existences-report"
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          applyDisabled={status === "loading"}
          clearDisabled={status === "loading"}
          validationError={validationError}
          actionSlot={(
            <InventoryReportExportMenu
              canExport={canExportCurrentView}
              disabled={status === "loading"}
              exportState={exportState}
              onExport={handleExport}
            />
          )}
        >
          <label className="settings-filter-field inventory-report-filter-span-2">
            <span>Buscar</span>
            <input
              type="search"
              value={draftFilters.search}
              onChange={(event) => handleDraftChange("search", event.target.value)}
              placeholder="Item, categoria o ubicación"
            />
          </label>

          <label className="settings-filter-field">
            <span>Categoria</span>
            <select
              value={draftFilters.categoria_id}
              onChange={(event) => handleDraftChange("categoria_id", event.target.value)}
              disabled={!categories.length && !draftFilters.categoria_id}
            >
              <option value="">{categories.length ? "Todas" : "Sincategoríasdisponibles"}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Ubicación</span>
            <select
              value={draftFilters.ubicacion_id}
              onChange={(event) => handleDraftChange("ubicacion_id", event.target.value)}
              disabled={!locations.length && !draftFilters.ubicacion_id}
            >
              <option value="">{locations.length ? "Todas" : "Sin ubicaciónes disponibles"}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label || location.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Item</span>
            <select
              value={draftFilters.item_id}
              onChange={(event) => handleDraftChange("item_id", event.target.value)}
              disabled={!items.length && !draftFilters.item_id}
            >
              <option value="">{items.length ? "Todos" : "Sin items disponibles"}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Unidad de medida</span>
            <select
              value={draftFilters.unidad_id}
              onChange={(event) => handleDraftChange("unidad_id", event.target.value)}
              disabled={!units.length && !draftFilters.unidad_id}
            >
              <option value="">{units.length ? "Todas" : "Sin unidades disponibles"}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Estado del stock</span>
            <select
              value={draftFilters.estado_stock}
              onChange={(event) => handleDraftChange("estado_stock", event.target.value)}
            >
              <option value="">Todos</option>
              {INVENTORY_REPORT_STOCK_STATES.map((state) => (
                <option key={state} value={state}>
                  {formatInventoryReportLabel(state)}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Estado del item</span>
            <select
              value={draftFilters.activo}
              onChange={(event) => handleDraftChange("activo", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </label>

          <label className="inventory-report-checkbox-field">
            <input
              type="checkbox"
              checked={Boolean(draftFilters.solo_sin_stock)}
              onChange={(event) => handleDraftChange("solo_sin_stock", event.target.checked)}
            />
            <span>Solo sin stock</span>
          </label>

          <label className="inventory-report-checkbox-field">
            <input
              type="checkbox"
              checked={Boolean(draftFilters.solo_bajo_minimo)}
              onChange={(event) => handleDraftChange("solo_bajo_minimo", event.target.checked)}
            />
            <span>Solo bajo minimo</span>
          </label>
        </InventoryReportFilterBar>

        <div className="inventory-report-live-region" aria-live="polite">
          {status === "loading" ? "Cargando informe..." : ""}
        </div>

        {error ? <p className="error-text" role="alert">{error}</p> : null}

        {status === "loading" ? (
          <p className="inventory-subtle">Cargando informe...</p>
        ) : null}

        {status === "empty" ? (
          <div className="settings-empty-state inventory-empty-state">
            No se encontraron existencias para los filtros seleccionados.
          </div>
        ) : null}

        {preview && status === "ready" ? (
          <>
            <div className="table-scroll inventory-report-table-wrapper">
              <table className="crud-table inventory-table inventory-report-table inventory-existence-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Categoria</th>
                    <th scope="col">Unidad</th>
                    <th scope="col">Ubicación</th>
                    <th scope="col">Cantidad actual</th>
                    <th scope="col">Stock minimo</th>
                    <th scope="col">Diferencia</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.existenceId}>
                      <td>
                        <div className="settings-meta-stack">
                          <strong>{row.item?.nombre || "Sin item"}</strong>
                          {renderAggregationNote(row) ? (
                            <small>{renderAggregationNote(row)}</small>
                          ) : null}
                        </div>
                      </td>
                      <td>{row.categoria?.nombre || "Sin categoria"}</td>
                      <td>{row.unidad?.nombre || "Sin unidad"}</td>
                      <td>{row.ubicacion?.nombre || "Sin ubicación"}</td>
                      <td>{formatInventoryReportQuantity(row.cantidadActual, row.unidad?.nombre || "")}</td>
                      <td>
                        {row.stockMinimo === null
                          ? "Sin minimo"
                          : formatInventoryReportQuantity(row.stockMinimo, row.unidad?.nombre || "")}
                      </td>
                      <td>
                        {row.diferenciaMinimo === null
                          ? "Sin dato"
                          : formatInventoryReportQuantity(row.diferenciaMinimo, row.unidad?.nombre || "")}
                      </td>
                      <td>
                        <InventoryBadge tone={getInventoryStockTone(row.estadoStock)}>
                          {formatInventoryReportLabel(row.estadoStock)}
                        </InventoryBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <InventoryReportPagination
              pagination={pagination}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              disabled={status === "loading"}
            />
          </>
        ) : null}
      </section>
    </section>
  );
}
