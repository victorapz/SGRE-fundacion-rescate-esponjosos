import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import ActionMenuItem from "../../common/ActionMenuItem";
import AuthenticatedNoticeImage from "./AuthenticatedNoticeImage";
import {
  formatNoticeDate,
  getNoticePreview,
  getNoticePrimaryDate,
  getNoticeVisibilityKey,
  NOTICE_STATUS,
  NOTICE_STATUS_CLASS,
  NOTICE_STATUS_LABELS,
  NOTICE_VISIBILITY_LABELS,
} from "../../../utils/notice-ui";

function NoticeCardMenu({
  canEdit,
  canDelete,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
}) {
  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className="notice-card-menu-shell card-menu-shell">
      <button
        type="button"
        className="notice-card-menu-trigger card-menu-trigger"
        aria-label="Acciones del aviso"
        title="Acciones del aviso"
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        ⋮
      </button>
      {isOpen ? (
        <div
          className="notice-card-menu"
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          {canEdit ? (
            <ActionMenuItem icon={Pencil} label="Editar" role="menuitem" onClick={onEdit} />
          ) : null}
          {canDelete ? (
            <ActionMenuItem icon={Trash2} label="Eliminar" variant="danger" role="menuitem" className="is-danger" onClick={onDelete} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function NoticeCardGrid({
  notices = [],
  canEditNotice,
  canDeleteNotice,
  onOpenNotice,
  onEditNotice,
  onDeleteNotice,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) {
      return undefined;
    }

    const handleDocumentClick = (event) => {
      if (!gridRef.current?.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [openMenuId]);

  if (notices.length === 0) {
    return <p className="list-message">No hay avisos para mostrar.</p>;
  }

  return (
    <div className="notice-card-grid" ref={gridRef}>
      {notices.map((notice) => {
        const statusClass = NOTICE_STATUS_CLASS[notice.status] || NOTICE_STATUS_CLASS[NOTICE_STATUS.DRAFT];
        const visibilityKey = getNoticeVisibilityKey(notice);
        const preview = notice.summary || getNoticePreview(notice.description);
        const canEdit = canEditNotice(notice);
        const canDelete = canDeleteNotice(notice);
        const createdLabel = formatNoticeDate(getNoticePrimaryDate(notice));

        return (
          <article
            key={notice.id}
            className="notice-card"
            onClick={() => onOpenNotice(notice)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenNotice(notice);
              }
            }}
          >
            {notice.coverAsset?.publicId ? (
              <div className="notice-card-media">
                <AuthenticatedNoticeImage
                  assetUuid={notice.coverAsset.publicId}
                  alt={notice.coverAsset.originalName || notice.title}
                  className="notice-card-media-image"
                  fallback={(
                    <div className="notice-card-media-fallback">
                      <span>Sin portada</span>
                    </div>
                  )}
                />
              </div>
            ) : (
              <div className="notice-card-media notice-card-media--placeholder">
                <span>Sin portada</span>
              </div>
            )}

            <div className="notice-card-top">
              <div className="notice-card-badges">
                <span className={`notice-status-badge notice-status-${statusClass}`.trim()}>
                  {NOTICE_STATUS_LABELS[notice.status] || notice.status}
                </span>
                <span className={`notice-visibility-badge notice-visibility-${visibilityKey}`.trim()}>
                  {NOTICE_VISIBILITY_LABELS[visibilityKey]}
                </span>
              </div>
              <NoticeCardMenu
                canEdit={canEdit}
                canDelete={canDelete}
                isOpen={String(openMenuId) === String(notice.id)}
                onToggle={() =>
                  setOpenMenuId((currentValue) =>
                    String(currentValue) === String(notice.id) ? null : notice.id,
                  )
                }
                onEdit={() => {
                  setOpenMenuId(null);
                  onEditNotice(notice);
                }}
                onDelete={() => {
                  setOpenMenuId(null);
                  onDeleteNotice(notice);
                }}
              />
            </div>

            <h3 className="notice-card-title">{notice.title}</h3>
            <p className="notice-card-preview">{preview || "Sin descripción."}</p>

            <div className="notice-card-footer">
              <span className="notice-card-author">
                {notice.user?.fullName || notice.user?.name || "Sistema"}
              </span>
              <span className="notice-card-date">{createdLabel}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
