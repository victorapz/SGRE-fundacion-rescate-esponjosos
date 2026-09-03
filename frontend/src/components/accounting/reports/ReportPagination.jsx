export default function ReportPagination({
  pagination,
  onPageChange,
  onLimitChange,
  disabled = false,
}) {
  if (!pagination || Number(pagination.total || 0) <= 0) {
    return null;
  }

  const page = Number(pagination.page || 1);
  const limit = Number(pagination.limit || 20);
  const total = Number(pagination.total || 0);
  const totalPages = Number(pagination.totalPages || 1);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <div className="accounting-report-pagination" aria-label="Paginacion del informe">
      <div className="accounting-report-pagination-summary">
        Mostrando {startItem}-{endItem} de {total}
      </div>

      <div className="accounting-report-pagination-controls">
        <label className="accounting-report-pagination-size">
          <span>Por página</span>
          <select
            value={limit}
            onChange={(event) => onLimitChange?.(Number(event.target.value))}
            disabled={disabled}
          >
            {[10, 20, 50].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="accounting-report-pagination-buttons">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => onPageChange?.(page - 1)}
            disabled={disabled || page <= 1}
          >
            Anterior
          </button>
          <span>
            Pagina {page} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => onPageChange?.(page + 1)}
            disabled={disabled || page >= totalPages}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
