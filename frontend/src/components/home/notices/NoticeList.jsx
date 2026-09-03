const NOTICE_STATUS_LABELS = {
  BORRADOR: "Borrador",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};

export default function NoticeList({ notices = [], selectedNoticeId, onSelectNotice }) {
  if (notices.length === 0) {
    return <p className="list-message">No hay avisos para mostrar.</p>;
  }

  return (
    <div className="notice-list">
      {notices.map((notice) => {
        const isActive = String(selectedNoticeId) === String(notice.id);

        return (
          <button
            key={notice.id}
            type="button"
            className={`notice-list-item ${isActive ? "notice-list-item-active" : ""}`.trim()}
            onClick={() => onSelectNotice(notice.id)}
          >
            <span className="notice-list-item-title">{notice.title}</span>
            <span className="notice-list-item-meta">
              {NOTICE_STATUS_LABELS[notice.status] || notice.status}
            </span>
          </button>
        );
      })}
    </div>
  );
}