import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicAccountingReportDetail from "../../components/accounting/reports/PublicAccountingReportDetail";
import {
  formatAccountingReportDate,
  formatAccountingReportPeriod,
} from "../../components/accounting/reports/accountingReports.shared";
import PublicPageState from "../../components/public/PublicPageState";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import {
  downloadPublishedAccountingReport,
  getPublishedAccountingReport,
} from "../../services/public-accounting-report.service";

export default function PublicAccountingReportDetailPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  usePublicPageMeta({
    title: report ? `Informe financiero ${formatAccountingReportPeriod(report.year, report.month)}` : "Informe financiero mensual",
    description: "Resumen financiero mensual publicado por la fundacion.",
    ogType: "article",
    articlePublishedTime: report?.publishedAt || null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getPublishedAccountingReport(id);
        if (isMounted) {
          setReport(payload);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No fue posible cargar el informe.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError("");

    try {
      await downloadPublishedAccountingReport(id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible descargar el PDF.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <PublicPageState
        variant="loading"
        surface="immersive"
        eyebrow="Informes"
        title="Cargando informe financiero"
        description="Estamos preparando el resumen monetario solicitado."
      />
    );
  }

  if (error || !report) {
    return (
      <PublicPageState
        variant="empty"
        surface="immersive"
        eyebrow="Informes"
        title="El informe solicitado no esta disponible"
        description={error || "No encontramos el informe que intentaste abrir."}
        actions={(
          <>
            <Link to={publicSiteConfig.routes.accountingReports} className="public-button public-button--primary">
              Ver informes
            </Link>
            <Link to={publicSiteConfig.routes.home} className="public-button public-button--secondary">
              Volver al inicio
            </Link>
          </>
        )}
      />
    );
  }

  return (
    <article className="public-accounting-report-detail-page">
      <div className="public-notice-detail__back">
        <Link
          to={publicSiteConfig.routes.accountingReports}
          className="public-button public-button--secondary"
        >
          Volver a informes
        </Link>
      </div>
      {error ? (
        <div className="public-inline-alert" role="alert">
          {error}
        </div>
      ) : null}

      <section className="public-accounting-report-detail-card">
        <PublicAccountingReportDetail report={report} mode="public" />
      </section>

    

        <button
          type="button"
          className="public-button public-button--primary"
          onClick={() => void handleDownload()}
          disabled={isDownloading}
        >
          {isDownloading ? "Descargando..." : "Descargar PDF"}
        </button>
    
    </article>
  );
}
