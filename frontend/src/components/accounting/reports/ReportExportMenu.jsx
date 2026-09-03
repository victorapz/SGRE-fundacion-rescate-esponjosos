import { Download } from "lucide-react";
import IconButton from "../../common/IconButton";

export default function ReportExportMenu({
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
    <div className="accounting-report-export">
      <IconButton
        icon={Download}
        label="Descargar PDF"
        variant="secondary"
        disabled={isBusy}
        loading={isPdfLoading}
        onClick={() => onExport?.("pdf")}
      />
      <IconButton
        icon={Download}
        label="Descargar Excel"
        variant="secondary"
        disabled={isBusy}
        loading={isXlsxLoading}
        onClick={() => onExport?.("xlsx")}
      />
    </div>
  );
}
