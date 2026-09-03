import { useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import IconButton from "../components/common/IconButton";
import PageBreadcrumb from "../components/PageBreadcrumb";
import AuthenticatedNoticeImage from "../components/home/notices/AuthenticatedNoticeImage";
import NoticeHtmlContent from "../components/home/notices/NoticeHtmlContent";
import { deleteNotice, getNotice, updateNotice } from "../services/notice.service";
import { PERMISSIONS } from "../config/permissions";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import {
  formatNoticeDate,
  getNoticePrimaryDate,
  getNoticeVisibilityKey,
  NOTICE_STATUS,
  NOTICE_STATUS_CLASS,
  NOTICE_STATUS_LABELS,
  NOTICE_VISIBILITY_LABELS,
} from "../utils/notice-ui";
import "../styles/notice.page.css";

const NOTICE_MODULE_ROUTE = "/inicio?tab=notices";

export default function NoticeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [coverPreviewState, setCoverPreviewState] = useState("empty");

  const canUpdate = hasPermission(PERMISSIONS.HOME.NOTICE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.HOME.NOTICE_DELETE);

  const isOwner = useMemo(() => {
    if (!notice?.user?.id || !user?.id) {
      return false;
    }

    return String(notice.user.id) === String(user.id);
  }, [notice, user]);

  const canEdit = canUpdate && isOwner;
  const canArchive = canUpdate && isOwner && notice?.status === NOTICE_STATUS.PUBLISHED;
  const canPublish = canUpdate
    && isOwner
    && (notice?.status === NOTICE_STATUS.DRAFT || notice?.status === NOTICE_STATUS.ARCHIVED);
  const canDeleteNotice = canDelete && isOwner;

  useEffect(() => {
    let isMounted = true;

    async function loadNotice() {
      setIsLoading(true);
      setError("");

      try {
        const noticeData = await getNotice(id);

        if (isMounted) {
          setNotice(noticeData);
        }
      } catch (requestError) {
        if (isMounted) {
          const message =
            requestError instanceof Error ? requestError.message : "No se pudo cargar el aviso";
          setError(message);
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
  }, [id]);

  const handleDelete = async () => {
    if (!notice?.id || !canDeleteNotice || isSubmitting) {
      return;
    }

    const confirmed = window.confirm("Seguro que quieres eliminar este aviso?");
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteNotice(notice.id);
      navigate("/inicio");
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "No se pudo eliminar el aviso";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    if (!notice?.id || isSubmitting) {
      return;
    }

    const confirmed =
      status === NOTICE_STATUS.ARCHIVED
        ? window.confirm("Seguro que quieres archivar este aviso?")
        : true;

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const updatedNotice = await updateNotice(notice.id, { estado: status });
      navigate(`/aviso/${updatedNotice.id}/editar`, { replace: true });
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "No se pudo actualizar el aviso";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="main-content notice-page">
        <p className="list-message">Cargando aviso...</p>
      </section>
    );
  }

  if (error && !notice) {
    return (
      <section className="main-content notice-page">
        <div className="home-empty-view">
          <PageBreadcrumb moduleLabel="Avisos" moduleTo={NOTICE_MODULE_ROUTE} currentLabel="Detalle" />
          <h2>No fue posible abrir el aviso</h2>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  const statusClass = NOTICE_STATUS_CLASS[notice?.status] || NOTICE_STATUS_CLASS[NOTICE_STATUS.DRAFT];
  const visibilityKey = getNoticeVisibilityKey(notice);
  const displayDate = formatNoticeDate(getNoticePrimaryDate(notice));

  return (
    <section className="main-content notice-page">
      <PageBreadcrumb moduleLabel="Avisos" moduleTo={NOTICE_MODULE_ROUTE} currentLabel="Detalle" />
      <div className="notice-page-actions">
        <div className="notice-page-actions-right">
          <div></div>
          {canEdit ? (
            <IconButton
              icon={Pencil}
              label="Editar aviso"
              variant="secondary"
              onClick={() => navigate(`/aviso/${notice.id}/editar`)}
            />
          ) : null}
          {canPublish ? (
            <button
              type="button"
              className="btn btn-create-home"
              disabled={isSubmitting}
              onClick={() => handleStatusUpdate(NOTICE_STATUS.PUBLISHED)}
            >
              Publicar
            </button>
          ) : null}
          {canArchive ? (
            <IconButton
              icon={Archive}
              label="Archivar aviso"
              variant="warning"
              disabled={isSubmitting}
              onClick={() => handleStatusUpdate(NOTICE_STATUS.ARCHIVED)}
            />
          ) : null}
          {canDeleteNotice ? (
            <IconButton
              icon={Trash2}
              label="Eliminar aviso"
              variant="danger"
              disabled={isSubmitting}
              onClick={handleDelete}
            />
          ) : null}
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <article className="notice-detail-shell">
        <div className="notice-detail-head">
          <div className="notice-detail-badges">
            <span className={`notice-status-badge notice-status-${statusClass}`.trim()}>
              {NOTICE_STATUS_LABELS[notice.status] || notice.status}
            </span>
            <span className={`notice-visibility-badge notice-visibility-${visibilityKey}`.trim()}>
              {NOTICE_VISIBILITY_LABELS[visibilityKey]}
            </span>
          </div>
          <h1>{notice.title}</h1>
          <div className="notice-detail-meta">
            <span>{notice.user?.fullName || notice.user?.name || "Sistema"}</span>
            <span>{displayDate}</span>
          </div>
          {notice.summary ? <p className="notice-detail-summary">{notice.summary}</p> : null}
        </div>

  

        <NoticeHtmlContent
          html={notice.description}
          className="notice-detail-body"
          mode="admin"
        />
      </article>
    </section>
  );
}
