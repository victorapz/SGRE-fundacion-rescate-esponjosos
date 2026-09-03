import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicPageState from "../../components/public/PublicPageState";
import PublicApiImage from "../../components/public/PublicApiImage";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import { getPublicNotices } from "../../services/publicNotice.service";
import { formatNoticeDate } from "../../utils/notice-ui";

const PAGE_SIZE = 9;

export default function PublicNoticesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const currentPage = Math.max(Number(searchParams.get("page")) || 1, 1);

  usePublicPageMeta({
    title: "Avisos",
    description: "Noticias, jornadas y actualizaciones publicas de la fundacion.",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadNotices() {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getPublicNotices({ page: currentPage, limit: PAGE_SIZE });
        if (!isMounted) return;

        setItems(payload.items);
        setPagination(payload.pagination);
      } catch (requestError) {
        if (isMounted) {
          setError(requestError instanceof Error ? requestError.message : "No pudimos cargar los avisos.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadNotices();

    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  const handlePageChange = (page) => {
    setSearchParams(page > 1 ? { page: String(page) } : {});
  };

  if (isLoading) {
    return (
      <PublicPageState
        variant="loading"
        surface="immersive"
        eyebrow="Avisos"
        title="Cargando avisos"
        description="Estamos preparando las ultimas noticias y actividades publicas de la fundacion."
      />
    );
  }

  if (error) {
    return (
      <PublicPageState
        variant="error"
        surface="immersive"
        eyebrow="Avisos"
        title="No pudimos cargar los avisos"
        description={error}
        actions={(
          <button
            type="button"
            className="public-button public-button--primary"
            onClick={() => handlePageChange(currentPage)}
          >
            Reintentar
          </button>
        )}
      />
    );
  }

  return (
    <div className="public-notices-page">
      <section className="public-notices-hero">
        <p className="public-section-kicker">Avisos</p>
        <h1>Noticias y actualizaciones de la fundacion</h1>
        <p>
          Aqui reunimos jornadas, hitos y avisos publicos para que puedas seguir de cerca el trabajo
          del equipo y las actividades abiertas de Rescate Esponjosos.
        </p>
      </section>

      {items.length === 0 ? (
        <PublicPageState
          variant="empty"
          surface="immersive"
          eyebrow="Avisos"
          title="Aun no hay avisos publicados"
          description="Cuando tengamos novedades publicas, apareceran aqui."
        />
      ) : (
        <>
          <section className="public-notices-grid" aria-label="Listado de avisos">
            {items.map((notice) => (
              <article key={notice.slug} className="public-notice-card">
                {notice.coverUrl ? (
                  <div className="public-notice-card__media">
                    <PublicApiImage
                      src={notice.coverUrl}
                      alt={notice.title}
                      loading="lazy"
                      fallback={<span>Cargando portada...</span>}
                    />
                  </div>
                ) : (
                  <div className="public-notice-card__media public-notice-card__media--placeholder">
                    <span>Sin portada</span>
                  </div>
                )}

                <div className="public-notice-card__body">
                  <span className="public-notice-card__date">{formatNoticeDate(notice.publishedAt)}</span>
                  <h2>{notice.title}</h2>
                  <p>{notice.summary}</p>
                  <Link
                    to={`${publicSiteConfig.routes.notices}/${notice.slug}`}
                    className="public-notice-card__link"
                  >
                    Leer aviso
                  </Link>
                </div>
              </article>
            ))}
          </section>

          <nav className="public-pagination" aria-label="Paginacion de avisos">
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
