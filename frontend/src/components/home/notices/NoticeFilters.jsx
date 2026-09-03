import {
  NOTICE_STATUS,
  NOTICE_STATUS_LABELS,
  NOTICE_VISIBILITY,
  NOTICE_VISIBILITY_LABELS,
} from "../../../utils/notice-ui";

export default function NoticeFilters({
  search,
  status,
  visibility,
  order,
  onSearchChange,
  onStatusChange,
  onVisibilityChange,
  onOrderChange,
}) {
  return (
    <div className="event-filters notice-toolbar">
      <label className="filter-item notice-toolbar-search">
        <span>Buscar</span>
        <input
          type="search"
          placeholder="Buscar por título, contenido o autor"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="search-input"
        />
      </label>

      <label className="filter-item">
        <span>Estado</span>
        <select
          className="filter-select"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="all">Todos</option>
          <option value={NOTICE_STATUS.DRAFT}>{NOTICE_STATUS_LABELS[NOTICE_STATUS.DRAFT]}</option>
          <option value={NOTICE_STATUS.PUBLISHED}>
            {NOTICE_STATUS_LABELS[NOTICE_STATUS.PUBLISHED]}
          </option>
          <option value={NOTICE_STATUS.ARCHIVED}>
            {NOTICE_STATUS_LABELS[NOTICE_STATUS.ARCHIVED]}
          </option>
        </select>
      </label>

      <label className="filter-item">
        <span>Visibilidad</span>
        <select
          className="filter-select"
          value={visibility}
          onChange={(event) => onVisibilityChange(event.target.value)}
        >
          <option value="all">Todas</option>
          <option value={NOTICE_VISIBILITY.PUBLIC}>
            {NOTICE_VISIBILITY_LABELS[NOTICE_VISIBILITY.PUBLIC]}
          </option>
          <option value={NOTICE_VISIBILITY.INTERNAL}>
            {NOTICE_VISIBILITY_LABELS[NOTICE_VISIBILITY.INTERNAL]}
          </option>
        </select>
      </label>

      <label className="filter-item">
        <span>Orden</span>
        <select
          className="filter-select"
          value={order}
          onChange={(event) => onOrderChange(event.target.value)}
        >
          <option value="desc">Mas reciente primero</option>
          <option value="asc">Mas antiguo primero</option>
        </select>
      </label>
    </div>
  );
}
