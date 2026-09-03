import { useEffect, useMemo, useState } from "react";
import { Archive, Download, Eye, FilePenLine } from "lucide-react";
import IconButton from "../../common/IconButton";
import {
  ACCOUNTING_REPORT_MONTH_NAMES,
  buildLatestClosedMonthlyAccountingPeriod,
  formatAccountingPublicReportState,
  formatAccountingReportDateTime,
  formatAccountingReportPeriod,
  getAccountingPublicReportStateTone,
  isClosedMonthlyAccountingPeriod,
} from "./accountingReports.shared";
import PublicAccountingReportDetail from "./PublicAccountingReportDetail";
import ReportPagination from "./ReportPagination";
import {
  archivePublicReport,
  downloadAdminPublicReport,
  generatePublicReport,
  getAdminPublicReport,
  listAdminPublicReports,
  publishPublicReport,
} from "../../../services/public-accounting-report.service";

function AccountingBadge({ children, tone = "neutral" }) {
  return <span className={`accounting-badge accounting-badge-${tone}`}>{children}</span>;
}

function buildDefaultDraft() {
  const latestClosed = buildLatestClosedMonthlyAccountingPeriod();
  return {
    year: String(latestClosed.year),
    month: String(latestClosed.month),
  };
}

function buildYearOptions(now = new Date()) {
  const currentYear = now.getFullYear();
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}

function getSafeMessage(error, fallbackMessage) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (!message || /axios|request failed|network error|html/i.test(message)) {
    return fallbackMessage;
  }
  return message;
}

function buildActionLabel(action, report) {
  if (!report) {
    return "";
  }

  if (action === "publish") {
    return `¿Deseas publicar el informe de ${formatAccountingReportPeriod(report.year, report.month)}?`;
  }

  return `¿Deseas archivar el informe de ${formatAccountingReportPeriod(report.year, report.month)}?`;
}

export default function PublicAccountingReports({
  canCreate = false,
  canPublish = false,
  canArchive = false,
}) {
  const [draft, setDraft] = useState(() => buildDefaultDraft());
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [detail, setDetail] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [detailStatus, setDetailStatus] = useState("idle");
  const [detailError, setDetailError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const yearOptions = useMemo(() => buildYearOptions(), []);

  const pagination = useMemo(() => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    return {
      page: safePage,
      limit,
      total,
      totalPages,
    };
  }, [items.length, limit, page]);

  const paginatedItems = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    return items.slice(startIndex, startIndex + pagination.limit);
  }, [items, pagination.limit, pagination.page]);

  async function loadReports() {
    setStatus("loading");
    setError("");

    try {
      const payload = await listAdminPublicReports();
      setItems(payload.items);
      setStatus(payload.items.length ? "ready" : "empty");
    } catch (requestError) {
      setError(getSafeMessage(requestError, "No fue posible cargar los informes."));
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  useEffect(() => {
    if (page !== pagination.page) {
      setPage(pagination.page);
    }
  }, [page, pagination.page]);

  async function handleLoadDetail(reportId) {
    setDetailId(reportId);
    setDetailStatus("loading");
    setDetailError("");

    try {
      const payload = await getAdminPublicReport(reportId);
      setDetail(payload);
      setDetailStatus("ready");
    } catch (requestError) {
      setDetail(null);
      setDetailError(getSafeMessage(requestError, "No fue posible cargar el detalle del informe."));
      setDetailStatus("error");
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();

    const year = Number(draft.year);
    const month = Number(draft.month);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      setError("Selecciona un periodo válido.");
      return;
    }

    if (!isClosedMonthlyAccountingPeriod(year, month)) {
      setError("El periodo seleccionado todavia no ha finalizado.");
      return;
    }

    setBusyAction("generate");
    setError("");
    setLiveMessage("Generando borrador...");

    try {
      const createdReport = await generatePublicReport({ year, month });
      setPage(1);
      await loadReports();
      setLiveMessage("Borrador generado correctamente.");
      await handleLoadDetail(createdReport.id);
    } catch (requestError) {
      setError(getSafeMessage(requestError, "No fue posible generar el borrador."));
      setLiveMessage("");
    } finally {
      setBusyAction("");
    }
  }

  async function handleTransition(report, action) {
    if (!report) {
      return;
    }

    const confirmed = window.confirm(buildActionLabel(action, report));
    if (!confirmed) {
      return;
    }

    setBusyAction(`${action}-${report.id}`);
    setError("");
    setLiveMessage(action === "publish" ? "Publicando informe..." : "Archivando informe...");

    try {
      const updatedReport = action === "publish"
        ? await publishPublicReport(report.id)
        : await archivePublicReport(report.id);
      await loadReports();
      setDetail(updatedReport);
      setDetailId(updatedReport.id);
      setDetailStatus("ready");
      setLiveMessage(
        action === "publish"
          ? "Informe publicado correctamente."
          : "Informe archivado correctamente.",
      );
    } catch (requestError) {
      setError(
        getSafeMessage(
          requestError,
          action === "publish"
            ? "No fue posible publicar el informe."
            : "No fue posible archivar el informe.",
        ),
      );
      setLiveMessage("");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDownload(reportId) {
    setBusyAction(`download-${reportId}`);
    setError("");

    try {
      await downloadAdminPublicReport(reportId);
    } catch (requestError) {
      setError(getSafeMessage(requestError, "No fue posible descargar el PDF."));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section
      role="tabpanel"
      id="accounting-report-panel-public-reports"
      aria-labelledby="accounting-report-tab-public-reports"
      className="home-tab-panel accounting-panel accounting-report-panel"
    >
      <section className="crud-card accounting-card">
        <div className="crud-header accounting-card-header">
          <div>
            <h3>Informes publicos mensuales</h3>
            <p>
              Genera, revisa y pública resumenes contables mensuales para consulta pública.
            </p>
          </div>
        </div>

        {canCreate ? (
          <form className="accounting-public-report-controls" onSubmit={handleGenerate}>
            <label className="settings-form-field">
              <span>Año</span>
              <select
                value={draft.year}
                onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))}
                disabled={busyAction === "generate"}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <label className="settings-form-field">
              <span>Mes</span>
              <select
                value={draft.month}
                onChange={(event) => setDraft((current) => ({ ...current, month: event.target.value }))}
                disabled={busyAction === "generate"}
              >
                {ACCOUNTING_REPORT_MONTH_NAMES.map((monthName, index) => (
                  <option key={monthName} value={index + 1}>{monthName}</option>
                ))}
              </select>
            </label>

            <div className="accounting-public-report-controls__actions">
              <IconButton
                icon={FilePenLine}
                label="Generar borrador"
                variant="primary"
                type="submit"
                disabled={busyAction === "generate"}
                loading={busyAction === "generate"}
              />
            </div>
          </form>
        ) : null}

        <p className="accounting-report-live-region" aria-live="polite">
          {liveMessage}
        </p>

        {error ? (
          <div className="accounting-feedback accounting-feedback-error" role="alert">
            <span>{error}</span>
            {status === "error" ? (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => void loadReports()}>
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="accounting-empty-state">
            <p>Cargando informes publicos mensuales...</p>
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="accounting-empty-state">
            <p>No existen informes publicos mensuales.</p>
          </div>
        ) : null}

        {status === "ready" ? (
          <section className="accounting-report-table-section">
            <div className="accounting-table-wrapper accounting-report-table-wrapper">
              <table className="accounting-table accounting-report-table accounting-public-report-admin-table">
                <thead>
                  <tr>
                    <th scope="col">Periodo</th>
                    <th scope="col">Version</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Fecha de generación</th>
                    <th scope="col">Fecha de publicación</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((report) => (
                    <tr key={report.id}>
                      <td>{formatAccountingReportPeriod(report.year, report.month)}</td>
                      <td>v{report.version || 1}</td>
                      <td>
                        <AccountingBadge tone={getAccountingPublicReportStateTone(report.status)}>
                          {formatAccountingPublicReportState(report.status)}
                        </AccountingBadge>
                      </td>
                      <td>{formatAccountingReportDateTime(report.generatedAt)}</td>
                      <td>{report.publishedAt ? formatAccountingReportDateTime(report.publishedAt) : "No publicada"}</td>
                      <td>
                        <div className="accounting-public-report-actions">
                          <IconButton
                            icon={Eye}
                            label={`Ver detalle del informe ${formatAccountingReportPeriod(report.year, report.month)}`}
                            variant="secondary"
                            disabled={detailStatus === "loading" && detailId === report.id}
                            loading={detailStatus === "loading" && detailId === report.id}
                            onClick={() => void handleLoadDetail(report.id)}
                          />
                          {report.status === "BORRADOR" && canPublish ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              onClick={() => void handleTransition(report, "publish")}
                              disabled={busyAction === `publish-${report.id}`}
                            >
                              {busyAction === `publish-${report.id}` ? "Publicando..." : "Publicar"}
                            </button>
                          ) : null}
                          {report.status !== "BORRADOR" ? (
                            <IconButton
                              icon={Download}
                              label={`Descargar PDF del informe ${formatAccountingReportPeriod(report.year, report.month)}`}
                              variant="secondary"
                              disabled={busyAction === `download-${report.id}`}
                              loading={busyAction === `download-${report.id}`}
                              onClick={() => void handleDownload(report.id)}
                            />
                          ) : null}
                          {report.status === "PUBLICADO" && canArchive ? (
                            <IconButton
                              icon={Archive}
                              label={`Archivar informe ${formatAccountingReportPeriod(report.year, report.month)}`}
                              variant="warning"
                              disabled={busyAction === `archive-${report.id}`}
                              loading={busyAction === `archive-${report.id}`}
                              onClick={() => void handleTransition(report, "archive")}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ReportPagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
              disabled={status === "loading" || Boolean(busyAction)}
            />
          </section>
        ) : null}

        {detailStatus === "error" ? (
          <div className="accounting-feedback accounting-feedback-error" role="alert">
            <span>{detailError}</span>
          </div>
        ) : null}

        {detailStatus === "loading" ? (
          <div className="accounting-empty-state">
            <p>Cargando detalle del informe...</p>
          </div>
        ) : null}

        {detailStatus === "ready" && detail ? (
          <section className="accounting-public-report-inline-detail">
            <div className="accounting-report-section-header">
              <div>
                <h4>Detalle del informe</h4>
                <p>{formatAccountingReportPeriod(detail.year, detail.month)}</p>
              </div>
            </div>
            <PublicAccountingReportDetail report={detail} mode="admin" />
          </section>
        ) : null}
      </section>
    </section>
  );
}
