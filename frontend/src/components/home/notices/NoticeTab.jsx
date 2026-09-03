import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import NoticeCardGrid from "./NoticeCardGrid";
import NoticeFilters from "./NoticeFilters";
import {
  compareNoticesByDate,
  getNoticePreview,
  getNoticeVisibilityKey,
} from "../../../utils/notice-ui";

function filterNotices(notices, { search, status, visibility }) {
  const normalizedSearch = search.trim().toLowerCase();

  return notices.filter((notice) => {
    const preview = notice.summary || getNoticePreview(notice.description);
    const author = notice.user?.fullName || notice.user?.name || "";
    const matchesSearch = !normalizedSearch
      || [notice.title, preview, author].join(" ").toLowerCase().includes(normalizedSearch);
    const matchesStatus = status === "all" || notice.status === status;
    const matchesVisibility = visibility === "all"
      || getNoticeVisibilityKey(notice) === visibility;

    return matchesSearch && matchesStatus && matchesVisibility;
  });
}

export default function NoticeTab({
  notices = [],
  isLoading,
  error,
  filters,
  onFiltersChange,
  onDeleteNotice,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const visibleNotices = useMemo(() => {
    const filtered = filterNotices(notices, filters);
    return [...filtered].sort((left, right) => compareNoticesByDate(left, right, filters.order));
  }, [filters, notices]);

  const canEditNotice = (notice) => {
    if (!canUpdate || !notice?.user?.id || !user?.id) {
      return false;
    }

    return String(notice.user.id) === String(user.id) && notice.status !== "PUBLICADO";
  };

  const canDeleteNotice = (notice) => {
    if (!canDelete || !notice?.user?.id || !user?.id) {
      return false;
    }

    return String(notice.user.id) === String(user.id);
  };

  const handleDeleteNotice = async (notice) => {
    if (!notice?.id || !canDeleteNotice(notice)) {
      return;
    }

    const confirmed = window.confirm("Seguro que quieres eliminar este aviso?");
    if (!confirmed) {
      return;
    }

    await onDeleteNotice(notice.id);
  };

  return (
    <section className="notice-module">
      <div className="notice-toolbar-row">
        <NoticeFilters
          search={filters.search}
          status={filters.status}
          visibility={filters.visibility}
          order={filters.order}
          onSearchChange={(value) => onFiltersChange({ search: value })}
          onStatusChange={(value) => onFiltersChange({ status: value })}
          onVisibilityChange={(value) => onFiltersChange({ visibility: value })}
          onOrderChange={(value) => onFiltersChange({ order: value })}
        />
        {canCreate ? (
          <button
            type="button"
            className="btn btn-create-home notice-create-button"
            onClick={() => navigate("/aviso/crear")}
          >
            Crear aviso
          </button>
        ) : null}
      </div>
      {isLoading ? <p className="list-message">Cargando avisos...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {!isLoading && !error && visibleNotices.length === 0 ? (
        <div className="home-empty-view notice-empty-view">
          <h3>No hay avisos que coincidan con los filtros.</h3>
          <p>Ajusta la busqueda o crea un aviso nuevo si tienes permisos.</p>
        </div>
      ) : null}

      {!isLoading && !error && visibleNotices.length > 0 ? (
        <NoticeCardGrid
          notices={visibleNotices}
          canEditNotice={canEditNotice}
          canDeleteNotice={canDeleteNotice}
          onOpenNotice={(notice) => navigate(`/aviso/${notice.id}`)}
          onEditNotice={(notice) => navigate(`/aviso/${notice.id}/editar`)}
          onDeleteNotice={handleDeleteNotice}
        />
      ) : null}
    </section>
  );
}
