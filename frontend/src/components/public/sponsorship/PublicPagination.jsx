export default function PublicPagination({
  page,
  totalPages,
  onPrevious,
  onNext,
  summaryLabel = "Página",
}) {
  return (
    <nav className="public-pagination" aria-label="Paginacion">
      <button
        type="button"
        className="public-button public-button--secondary"
        disabled={page <= 1}
        onClick={onPrevious}
      >
        Anterior
      </button>
      <span className="public-pagination__summary">
        {summaryLabel} {page} de {totalPages || 1}
      </span>
      <button
        type="button"
        className="public-button public-button--secondary"
        disabled={page >= totalPages}
        onClick={onNext}
      >
        Siguiente
      </button>
    </nav>
  );
}
