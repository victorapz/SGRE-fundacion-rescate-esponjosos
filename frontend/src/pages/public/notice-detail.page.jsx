import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import NoticeHtmlContent from "../../components/home/notices/NoticeHtmlContent";
import PublicPageState from "../../components/public/PublicPageState";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import { getPublicNoticeBySlug } from "../../services/publicNotice.service";
import { formatNoticeDate } from "../../utils/notice-ui";
import { buildPublicAbsoluteUrl } from "../../utils/publicSite";

export default function PublicNoticeDetailPage() {
  const { slug } = useParams();
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  usePublicPageMeta({
    title: notice?.title || "Aviso",
    description: notice?.summary || "Aviso publico de la fundacion.",
    ogType: "article",
    ogImage: notice?.coverPath ? buildPublicAbsoluteUrl(notice.coverPath) : null,
    articlePublishedTime: notice?.publishedAt || null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadNotice() {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getPublicNoticeBySlug(slug);
        if (isMounted) {
          setNotice(payload);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "El aviso solicitado no esta disponible.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadNotice();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <PublicPageState
        variant="loading"
        surface="immersive"
        eyebrow="Aviso"
        title="Cargando aviso"
        description="Estamos preparando el contenido solicitado."
      />
    );
  }

  if (error || !notice) {
    return (
      <PublicPageState
        variant="empty"
        surface="immersive"
        eyebrow="Aviso"
        title="El aviso solicitado no esta disponible"
        description={error || "No encontramos el aviso que intentaste abrir."}
        actions={(
          <>
            <Link to={publicSiteConfig.routes.notices} className="public-button public-button--primary">
              Ver avisos
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
    <article className="public-notice-detail">
      <div className="public-notice-detail__back">
        <Link to={publicSiteConfig.routes.notices} className="public-button public-button--secondary">
          Volver a avisos
        </Link>
      </div>

      <section className="public-notice-detail-card">
        <header className="public-notice-detail__header">
          <p className="public-section-kicker">Aviso</p>
          <h1>{notice.title}</h1>
          <span className="public-notice-detail__date">{formatNoticeDate(notice.publishedAt)}</span>
          {notice.summary ? <p className="public-notice-detail__summary">{notice.summary}</p> : null}
        </header>

        <NoticeHtmlContent
          html={notice.contentHtml}
          className="public-notice-detail__content notice-detail-body"
          mode="public"
          publicSlug={notice.slug}
        />
      </section>

      <footer className="public-notice-detail__cta">
        <p>Tu apoyo nos ayuda a seguir coordinando rescates, cuidados y actividades abiertas.</p>
        <Link to={publicSiteConfig.routes.donate} className="public-button public-button--primary">
          Donar con PayPal
        </Link>
      </footer>
    </article>
  );
}
