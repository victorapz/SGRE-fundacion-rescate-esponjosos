export default function FilterSummaryBar({
  stats = [],
  onClear,
  showClearButton = true,
  clearDisabled = false,
  clearLabel = "Limpiar filtros",
}) {
  const visibleStats = stats.filter(Boolean);

  if (visibleStats.length === 0 && !showClearButton) {
    return null;
  }

  return (
    <div className="filter-summary-row">
      <div className="foster-summary foster-summary-inline">
        {visibleStats.map((stat) => (
          <span key={stat} className="foster-summary-pill">
            {stat}
          </span>
        ))}
      </div>

      {showClearButton ? (
        <div className="filter-summary-actions">
          <button
            type="button"
            className="btn-clear"
            onClick={onClear}
            disabled={clearDisabled}
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
