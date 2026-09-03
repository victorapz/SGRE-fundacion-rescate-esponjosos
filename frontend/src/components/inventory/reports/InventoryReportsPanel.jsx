import { useState } from "react";
import {
  INVENTORY_REPORT_VIEW_IDS,
  buildAllowedInventoryReportViews,
  resolveActiveInventoryReportView,
} from "./inventoryReports.shared";
import InventoryCountsAdjustmentsReport from "./InventoryCountsAdjustmentsReport";
import InventoryExistencesReport from "./InventoryExistencesReport";

export default function InventoryReportsPanel({
  refreshKey = 0,
  canReadExistences,
  canReadCountsAdjustments,
  canExportReports,
  categories = [],
  items = [],
  locations = [],
  units = [],
}) {
  const allowedViews = buildAllowedInventoryReportViews({
    canReadExistences,
    canReadCountsAdjustments,
  });
  const [activeView, setActiveView] = useState(allowedViews[0]?.id || "");
  const resolvedActiveView = resolveActiveInventoryReportView(activeView, allowedViews);

  if (!allowedViews.length) {
    return (
      <div className="inventory-empty-state">
        <p>No tienes permisos para visualizar informes de inventario.</p>
      </div>
    );
  }

  return (
    <div className="inventory-report-shell">
      <div className="inventory-report-subtabs" role="tablist" aria-label="Tipos de informe de inventario">
        {allowedViews.map((view) => (
          <button
            key={view.id}
            id={`inventory-report-tab-${view.id}`}
            type="button"
            role="tab"
            aria-selected={resolvedActiveView === view.id}
            aria-controls={`inventory-report-panel-${view.id}`}
            tabIndex={resolvedActiveView === view.id ? 0 : -1}
            className={`home-tab-button ${resolvedActiveView === view.id ? "home-tab-button-active" : ""}`}
            onClick={() => setActiveView(view.id)}
            onKeyDown={(event) => {
              if (allowedViews.length <= 1) {
                return;
              }

              const currentIndex = allowedViews.findIndex((item) => item.id === view.id);
              if (currentIndex < 0) {
                return;
              }

              if (event.key === "ArrowRight") {
                event.preventDefault();
                setActiveView(allowedViews[(currentIndex + 1) % allowedViews.length].id);
              }

              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setActiveView(
                  allowedViews[(currentIndex - 1 + allowedViews.length) % allowedViews.length].id,
                );
              }
            }}
          >
            {view.label}
          </button>
        ))}
      </div>

      {canReadExistences && resolvedActiveView === INVENTORY_REPORT_VIEW_IDS.EXISTENCES ? (
        <InventoryExistencesReport
          refreshKey={refreshKey}
          canExport={canExportReports}
          categories={categories}
          items={items}
          locations={locations}
          units={units}
        />
      ) : null}

      {canReadCountsAdjustments && resolvedActiveView === INVENTORY_REPORT_VIEW_IDS.COUNTS_ADJUSTMENTS ? (
        <InventoryCountsAdjustmentsReport
          refreshKey={refreshKey}
          canExport={canExportReports}
          categories={categories}
          items={items}
          locations={locations}
        />
      ) : null}
    </div>
  );
}
