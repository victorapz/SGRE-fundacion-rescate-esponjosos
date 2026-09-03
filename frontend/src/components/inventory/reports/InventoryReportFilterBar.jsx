import { useState } from "react";

export default function InventoryReportFilterBar({
  idPrefix = "inventory-report",
  onApply,
  onClear,
  actionSlot = null,
  applyDisabled = false,
  clearDisabled = false,
  validationError = "",
  children,
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(true);
  const filtersRegionId = `${idPrefix}-filters-region`;

  return (
    <section
      className="inventory-report-filter-section"
      aria-label="Filtros del informe"
    >
      <div className="inventory-report-filter-toggle-row">
        <button
          type="button"
          className="btn btn-secondary btn-small inventory-report-mobile-toggle"
          onClick={() => setIsMobileOpen((current) => !current)}
          aria-expanded={isMobileOpen}
          aria-controls={filtersRegionId}
        >
          {isMobileOpen ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
      </div>

      <form
        id={filtersRegionId}
        className={`inventory-report-filter-form ${
          isMobileOpen ? "" : "inventory-report-filter-form-collapsed"
        }`}
        onSubmit={(event) => {
          event.preventDefault();

          if (!applyDisabled) {
            onApply?.();
          }
        }}
      >
        <div className="settings-filter-grid inventory-filter-grid inventory-report-filter-grid">
          {children}
        </div>

        {validationError ? (
          <p className="error-text" role="alert">
            {validationError}
          </p>
        ) : null}

        <div className="inventory-report-filter-footer">
          {actionSlot ? (
            <div className="inventory-report-filter-export">
              {actionSlot}
            </div>
          ) : null}

          <div className="inventory-report-filter-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={applyDisabled}
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              className="btn-clear"
              onClick={onClear}
              disabled={clearDisabled}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
