import {
  formatAccountingReportDateTime,
  formatAccountingReportMoney,
  formatCompactSummaryMetric,
} from "./accountingReports.shared";

export default function ReportSummary({
  idPrefix = "accounting-report",
  title = "Resumen",
  generatedAt = "",
  generatedBy = "",
  sections = [],
  chips = [],
  emptyMessage = "La vista previa aun no entrega resumen.",
  extraContent = null,
}) {
  const headingId = `${idPrefix}-summary-title`;

  return (
    <section className="accounting-report-summary" aria-labelledby={headingId}>
      <h4 id={headingId}>{title}</h4>
      {sections.length > 0 ? (
        <div className="accounting-report-summary-lines">
          {sections.map((section) => (
            <p key={section.currency} className="accounting-report-summary-line">
              <strong>{section.currency}</strong>
              {section.metrics.map((metric) => (
                <span key={`${section.currency}-${metric.label}`}>
                  {formatCompactSummaryMetric(metric, section.currency, formatAccountingReportMoney)}
                </span>
              ))}
            </p>
          ))}
        </div>
      ) : (
        <div className="accounting-empty-state accounting-report-inline-empty">
          <p>{emptyMessage}</p>
        </div>
      )}

      <div className="accounting-report-summary-meta">
        {generatedAt ? (
          <span>
            Actualizado {formatAccountingReportDateTime(generatedAt)}
            {generatedBy ? ` por ${generatedBy}` : ""}
          </span>
        ) : null}

        {chips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>

      {extraContent}
    </section>
  );
}
