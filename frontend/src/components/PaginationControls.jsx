export default function PaginationControls({
  page = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
}) {
  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const safeTotal = Number(totalItems) >= 0 ? Number(totalItems) : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const startItem = safeTotal === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const endItem = safeTotal === 0 ? 0 : Math.min(currentPage * safePageSize, safeTotal);

  return (
    <div className="pagination-controls" aria-label="Paginación">
      <div className="pagination-controls-summary">
        Mostrando {startItem}-{endItem} de {safeTotal}
      </div>

      <div className="pagination-controls-actions">
        <label className="pagination-controls-size">
          <span>Por página</span>
          <select
            value={safePageSize}
            onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="pagination-controls-buttons">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Anterior
          </button>
          <span className="pagination-controls-page">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
