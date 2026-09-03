import { useState } from "react";

export default function ReportWarnings({ warnings = [], idPrefix = "accounting-report" }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = `${idPrefix}-warnings-title`;

  if (!warnings.length) {
    return null;
  }

  const visibleWarnings = expanded ? warnings : warnings.slice(0, 4);

  return (
    <section className="accounting-report-warning-strip" aria-labelledby={headingId}>
      <div className="accounting-report-warning-strip-header">
        <p id={headingId}>
          Advertencias del informe: {warnings.length} observacion{warnings.length === 1 ? "" : "es"}.
        </p>

        {warnings.length > 4 ? (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Ver menos" : "Ver todas"}
          </button>
        ) : null}
      </div>

      <ul className="accounting-report-warning-list">
        {visibleWarnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
