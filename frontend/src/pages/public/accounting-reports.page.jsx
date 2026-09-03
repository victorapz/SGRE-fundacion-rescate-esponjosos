import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicPageState from "../../components/public/PublicPageState";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import {
  formatAccountingReportDate,
  formatAccountingReportPeriod,
} from "../../components/accounting/reports/accountingReports.shared";
import {
  downloadPublishedAccountingReport,
  listPublishedAccountingReports,
} from "../../services/public-accounting-report.service";

const PAGE_SIZE = 9;

export default function PublicAccountingReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const currentPage = Math.max(Number(searchParams.get("page")) || 1, 1);

  usePublicPageMeta({
    title: "Informes financieros",
    description: "Consulta como se utilizaron los recursos economicos de la fundacion.",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      setIsLoading(true);
      setError("");

      try {
        const payload = await listPublishedAccountingReports({
          page: currentPage,
          limit: PAGE_SIZE,
        });

        if (!isMounted) {
          return;
        }

        setItems(payload.items);
        setPagination(payload.pagination);
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No fue posible cargar los informes.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      isMounted = false;
    };
  }, [currentPage, reloadKey]);

  const handlePageChange = (page) => {
    setSearchParams(page > 1 ? { page: String(page) } : {});
  };

  const handleDownload = async (reportId) => {
    setDownloadingId(reportId);
    setError("");

    try {
      await downloadPublishedAccountingReport(reportId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible descargar el PDF.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <PublicPageState
        variant="loading"
        surface="immersive"
        eyebrow="Informes"
        title="Cargando informes financieros"
        description="Estamos preparando los reportes publicados mas recientes."
      />
    );
  }

  if (error && !items.length) {
    return (
      <PublicPageState
        variant="error"
        surface="immersive"
        eyebrow="Informes"
        title="No fue posible cargar los informes"
        description={error}
        actions={(
          <button
            type="button"
            className="public-button public-button--primary"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Reintentar
          </button>
        )}
      />
    );
  }

  return (
    <div className="public-accounting-reports-page">
      <section className="public-notices-hero">
        <p className="public-section-kicker">Informes</p>
        <h1>Informes financieros</h1>
        <p>Consulta como se utilizaron los recursos economicos de la fundacion.</p>
      </section>

      {error ? (
        <div className="public-inline-alert" role="alert">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <PublicPageState
          variant="empty"
          surface="immersive"
          eyebrow="Informes"
          title="No existen informes publicos mensuales"
          description="Cuando publiquemos nuevos cierres mensuales, apareceran aqui."
        />
      ) : (
        <>
          <section className="public-accounting-reports-grid" aria-label="Listado de informes financieros">
            {items.map((report) => (
              <article key={report.id} className="public-notice-card public-accounting-report-card">
                <div className="public-notice-card__body">
                  <span className="public-notice-card__date">
                    Publicado el {formatAccountingReportDate(report.publishedAt)}
                  </span>
                  <h2>Informe financiero - {formatAccountingReportPeriod(report.year, report.month)}</h2>
                  <p>
                    Consulta el resumen monetario mensual y descarga el PDF publicado para este periodo.
                  </p>
                  <div className="public-accounting-report-card__actions">
                    <Link
                      to={`${publicSiteConfig.routes.accountingReports}/${report.id}`}
                      className="public-notice-card__link"
                    >
                      Ver informe
                    </Link>
                    <button
                      type="button"
                      className="public-button public-button--primary"
                      onClick={() => void handleDownload(report.id)}
                      disabled={downloadingId === report.id}
                    >
                      {downloadingId === report.id ? "Descargando..." : "Descargar PDF"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <nav className="public-pagination" aria-label="Paginacion de informes">
            <button
              type="button"
              className="public-button public-button--secondary"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              Anterior
            </button>
            <span className="public-pagination__summary">
              Pagina {pagination.page} de {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              className="public-button public-button--secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
