export default function InventoryReportExportMenu({
  canExport = false,
  disabled = false,
  exportState = "",
  onExport,
}) {
  const isPdfLoading = exportState === "exporting_pdf";
  const isXlsxLoading = exportState === "exporting_xlsx";
  const isBusy = disabled || isPdfLoading || isXlsxLoading;

  if (!canExport) {
    return null;
  }

  return (
    <div className="inventory-report-export">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onExport?.("pdf")}
        disabled={isBusy}
      >
        {isPdfLoading ? "Generando PDF..." : "Descargar PDF"}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onExport?.("xlsx")}
        disabled={isBusy}
      >
        {isXlsxLoading ? "Generando Excel..." : "Descargar Excel"}
      </button>
    </div>
  );
}
