import { useCallback, useEffect, useRef, useState } from "react";
import { getUsers } from "../../../services/user.service";
import {
  exportInventoryCountsAdjustmentsReport,
  getInventoryCountsAdjustmentsReport,
} from "../../../services/inventory-report.service";
import InventoryReportExportMenu from "./InventoryReportExportMenu";
import InventoryReportFilterBar from "./InventoryReportFilterBar";
import InventoryReportPagination from "./InventoryReportPagination";
import {
  INVENTORY_REPORT_ADJUSTMENT_STATES,
  INVENTORY_REPORT_ADJUSTMENT_TYPES,
  INVENTORY_REPORT_DIFFERENCE_CLASSIFICATIONS,
  buildDefaultCountsAdjustmentsReportFilters,
  formatInventoryReportDate,
  formatInventoryReportLabel,
  formatInventoryReportPerson,
  formatInventoryReportQuantity,
  getInventoryAdjustmentStateTone,
  normalizeCountsAdjustmentsReportFilters,
  validateCountsAdjustmentsReportFilters,
} from "./inventoryReports.shared";

function InventoryBadge({ children, tone = "neutral" }) {
  return <span className={`inventory-badge inventory-badge-${tone}`}>{children}</span>;
}

function buildDefaultFiltersSnapshot() {
  return buildDefaultCountsAdjustmentsReportFilters();
}

function buildAppliedFiltersSnapshot(filters, page, limit) {
  return {
    ...filters,
    page,
    limit,
  };
}

function renderCountDetails(row) {
  const visibleDetails = Array.isArray(row.detalles) ? row.detalles.slice(0, 2) : [];

  if (!visibleDetails.length) {
    return "Sin detalle";
  }

  return (
    <ul className="inventory-report-detail-list">
      {visibleDetails.map((detail) => (
        <li key={detail.detailId}>
          <strong>{detail.item?.nombre || "Sin item"}</strong>
          <span>
            {detail.clasificacion ? formatInventoryReportLabel(detail.clasificacion) : "Sin clasificacion"}
          </span>
          {detail.dataQuality ? (
            <small>{formatInventoryReportLabel(detail.dataQuality)}</small>
          ) : null}
        </li>
      ))}
      {row.detailsTotal > visibleDetails.length ? (
        <li className="inventory-report-detail-more">
          +{row.detailsTotal - visibleDetails.length} item(s) adicional(es)
        </li>
      ) : null}
    </ul>
  );
}

function renderAdjustmentDetails(row) {
  const visibleDetails = Array.isArray(row.detalles) ? row.detalles.slice(0, 2) : [];

  if (!visibleDetails.length) {
    return "Sin detalle";
  }

  return (
    <ul className="inventory-report-detail-list">
      {visibleDetails.map((detail) => (
        <li key={detail.detailId}>
          <strong>{detail.item?.nombre || "Sin item"}</strong>
          <span>
            {detail.impacto ? formatInventoryReportLabel(detail.impacto) : "Sin impacto"}
          </span>
          <small>{formatInventoryReportQuantity(detail.cantidadAjustada, detail.unidad?.nombre || "")}</small>
        </li>
      ))}
      {row.detailsTotal > visibleDetails.length ? (
        <li className="inventory-report-detail-more">
          +{row.detailsTotal - visibleDetails.length} item(s) adicional(es)
        </li>
      ) : null}
    </ul>
  );
}

export default function InventoryCountsAdjustmentsReport({
  refreshKey = 0,
  canExport,
  categories = [],
  items = [],
  locations = [],
}) {
  const [draftFilters, setDraftFilters] = useState(() => buildDefaultFiltersSnapshot());
  const [appliedFilters, setAppliedFilters] = useState(() => buildDefaultFiltersSnapshot());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
  });
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [exportState, setExportState] = useState("");
  const [responsibles, setResponsibles] = useState([]);
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
      const report = await getInventoryCountsAdjustmentsReport(
        buildAppliedFiltersSnapshot(nextFilters, nextPage, nextLimit),
        { signal: controller.signal },
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      setPreview(report);
      setPagination({
        page: Number(report.counts?.pagination?.page || nextPage),
        limit: Number(report.counts?.pagination?.limit || nextLimit),
      });
      setStatus(
        report.counts.rows.length > 0 || report.adjustments.rows.length > 0
          ? "ready"
          : "empty",
      );
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

  useEffect(() => {
    let isMounted = true;

    void getUsers()
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setResponsibles(Array.isArray(response) ? response : []);
      })
      .catch(() => {
        if (isMounted) {
          setResponsibles([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const canExportCurrentView = canExport && Boolean(preview);

  async function handleExport(format) {
    if (!preview || exportState) {
      return;
    }

    const nextState = format === "pdf" ? "exporting_pdf" : "exporting_xlsx";
    setExportState(nextState);

    try {
      await exportInventoryCountsAdjustmentsReport(appliedFilters, format);
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
    const nextValidationError = validateCountsAdjustmentsReportFilters(draftFilters);
    setValidationError(nextValidationError);

    if (nextValidationError) {
      return;
    }

    const nextAppliedFilters = normalizeCountsAdjustmentsReportFilters(draftFilters);
    const nextPage = 1;
    const nextLimit = pagination.limit || 20;

    setAppliedFilters(nextAppliedFilters);
    setPagination({
      page: nextPage,
      limit: nextLimit,
    });

    void loadPreview(nextAppliedFilters, nextPage, nextLimit);
  }

  function handleClearFilters() {
    const nextFilters = buildDefaultFiltersSnapshot();
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setValidationError("");
    setError("");
    setPagination({
      page: 1,
      limit: 20,
    });
    void loadPreview(nextFilters, 1, 20);
  }

  function handlePageChange(nextPage) {
    if (!preview || nextPage < 1) {
      return;
    }

    setPagination((current) => ({
      ...current,
      page: nextPage,
    }));
    void loadPreview(appliedFilters, nextPage, pagination.limit);
  }

  function handleLimitChange(nextLimit) {
    setPagination({
      page: 1,
      limit: nextLimit,
    });
    void loadPreview(appliedFilters, 1, nextLimit);
  }

  const countsPagination = preview?.counts?.pagination || null;
  const adjustmentsPagination = preview?.adjustments?.pagination || null;

  return (
    <section
      role="tabpanel"
      id="inventory-report-panel-counts-adjustments"
      aria-labelledby="inventory-report-tab-counts-adjustments"
      className="home-tab-panel inventory-panel inventory-report-panel"
    >
      <section className="crud-card inventory-card">
        <div className="crud-header inventory-card-header">
          <div>
            <h3>Conteos y ajustes</h3>
            <p>
              Consulta conteos fisicos, diferencias y ajustes registrados en inventario.
            </p>
          </div>
        </div>

        <InventoryReportFilterBar
          idPrefix="inventory-counts-adjustments-report"
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
              placeholder="Ubicación, item, categoria, responsable u observaciones"
            />
          </label>

          <label className="settings-filter-field">
            <span>Fecha desde</span>
            <input
              type="date"
              value={draftFilters.fecha_desde}
              onChange={(event) => handleDraftChange("fecha_desde", event.target.value)}
            />
          </label>

          <label className="settings-filter-field">
            <span>Fecha hasta</span>
            <input
              type="date"
              value={draftFilters.fecha_hasta}
              onChange={(event) => handleDraftChange("fecha_hasta", event.target.value)}
            />
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
            <span>Responsable</span>
            <select
              value={draftFilters.responsable_id}
              onChange={(event) => handleDraftChange("responsable_id", event.target.value)}
              disabled={!responsibles.length && !draftFilters.responsable_id}
            >
              <option value="">{responsibles.length ? "Todos" : "Sin responsables disponibles"}</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {formatInventoryReportPerson(responsible)}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Estado del ajuste</span>
            <select
              value={draftFilters.estado_ajuste}
              onChange={(event) => handleDraftChange("estado_ajuste", event.target.value)}
            >
              <option value="">Todos</option>
              {INVENTORY_REPORT_ADJUSTMENT_STATES.map((state) => (
                <option key={state} value={state}>
                  {formatInventoryReportLabel(state)}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Clasificacion de diferencia</span>
            <select
              value={draftFilters.clasificacion_diferencia}
              onChange={(event) => handleDraftChange("clasificacion_diferencia", event.target.value)}
            >
              <option value="">Todas</option>
              {INVENTORY_REPORT_DIFFERENCE_CLASSIFICATIONS.map((classification) => (
                <option key={classification} value={classification}>
                  {formatInventoryReportLabel(classification)}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-filter-field">
            <span>Tipo de ajuste</span>
            <select
              value={draftFilters.ajuste_tipo}
              onChange={(event) => handleDraftChange("ajuste_tipo", event.target.value)}
            >
              <option value="">Todos</option>
              {INVENTORY_REPORT_ADJUSTMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatInventoryReportLabel(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="inventory-report-checkbox-field">
            <input
              type="checkbox"
              checked={draftFilters.con_diferencias === true}
              onChange={(event) =>
                handleDraftChange("con_diferencias", event.target.checked ? true : "")
              }
            />
            <span>Solo con diferencias</span>
          </label>

          <label className="inventory-report-checkbox-field">
            <input
              type="checkbox"
              checked={draftFilters.con_ajuste === true}
              onChange={(event) =>
                handleDraftChange("con_ajuste", event.target.checked ? true : "")
              }
            />
            <span>Solo con ajuste</span>
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
            No se encontraron registros para los filtros seleccionados.
          </div>
        ) : null}

        {preview && status === "ready" ? (
          <div className="inventory-report-results">
            <section className="inventory-report-table-section">
              <div className="inventory-report-section-header">
                <div>
                  <h4>Conteos fisicos</h4>
                  <p>Vista paginada de conteos con sus diferencias registradas.</p>
                </div>
              </div>

              {preview.counts.rows.length === 0 ? (
                <p className="inventory-subtle">No se encontraron conteos fisicos en esta página.</p>
              ) : (
                <div className="table-scroll inventory-report-table-wrapper">
                  <table className="crud-table inventory-table inventory-report-table">
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Ubicación</th>
                        <th scope="col">Responsable</th>
                        <th scope="col">Items contados</th>
                        <th scope="col">Con diferencia</th>
                        <th scope="col">Sobrantes</th>
                        <th scope="col">Faltantes</th>
                        <th scope="col">Ajuste generado</th>
                        <th scope="col">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.counts.rows.map((row) => (
                        <tr key={row.countId}>
                          <td>{formatInventoryReportDate(row.fecha)}</td>
                          <td>{row.ubicacion?.nombre || "Sin ubicación"}</td>
                          <td>{formatInventoryReportPerson(row.responsable)}</td>
                          <td>{row.itemsContados}</td>
                          <td>{row.itemsConDiferencia}</td>
                          <td>{row.sobrantes}</td>
                          <td>{row.faltantes}</td>
                          <td>{row.adjustmentsTotal > 0 ? `Si (${row.adjustmentsTotal})` : "No"}</td>
                          <td>{renderCountDetails(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <InventoryReportPagination
                pagination={countsPagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                disabled={status === "loading"}
              />
            </section>

            <section className="inventory-report-table-section">
              <div className="inventory-report-section-header">
                <div>
                  <h4>Ajustes de inventario</h4>
                  <p>Vista paginada de ajustes vinculados o independientes.</p>
                </div>
              </div>

              {preview.adjustments.rows.length === 0 ? (
                <p className="inventory-subtle">No se encontraron ajustes de inventario en esta página.</p>
              ) : (
                <div className="table-scroll inventory-report-table-wrapper">
                  <table className="crud-table inventory-table inventory-report-table">
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Motivo</th>
                        <th scope="col">Ubicación</th>
                        <th scope="col">Responsable</th>
                        <th scope="col">Conteo de origen</th>
                        <th scope="col">Items ajustados</th>
                        <th scope="col">Incrementos</th>
                        <th scope="col">Disminuciones</th>
                        <th scope="col">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.adjustments.rows.map((row) => (
                        <tr key={row.adjustmentId}>
                          <td>{formatInventoryReportDate(row.fecha)}</td>
                          <td>
                            <InventoryBadge tone={getInventoryAdjustmentStateTone(row.estado)}>
                              {formatInventoryReportLabel(row.estado)}
                            </InventoryBadge>
                          </td>
                          <td>
                            {row.incrementos > 0 && row.disminuciones === 0
                              ? formatInventoryReportLabel("POSITIVO")
                              : row.disminuciones > 0 && row.incrementos === 0
                                ? formatInventoryReportLabel("NEGATIVO")
                                : "Mixto"}
                          </td>
                          <td>{row.motivo || "Sin motivo"}</td>
                          <td>{row.ubicacion?.nombre || "Sin ubicación"}</td>
                          <td>{formatInventoryReportPerson(row.responsable)}</td>
                          <td>{row.conteoOrigen ? `#${row.conteoOrigen.id}` : "Sin conteo"}</td>
                          <td>{row.itemsAjustados}</td>
                          <td>{row.incrementos}</td>
                          <td>{row.disminuciones}</td>
                          <td>{renderAdjustmentDetails(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <InventoryReportPagination
                pagination={adjustmentsPagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                disabled={status === "loading"}
              />
            </section>
          </div>
        ) : null}
      </section>
    </section>
  );
}
