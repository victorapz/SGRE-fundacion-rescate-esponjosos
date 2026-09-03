import {
  formatAccountingPublicReportState,
  formatAccountingReportDateTime,
  formatAccountingReportMoney,
  formatAccountingReportPeriod,
} from "./accountingReports.shared";

function renderDate(value, fallback = "No publicada") {
  return value ? formatAccountingReportDateTime(value) : fallback;
}

function CurrencyCategoryTable({ title, rows = [], currency }) {
  return (
    <div className="accounting-public-report-category-block">
      <h5>{title}</h5>
      {rows.length ? (
        <div className="accounting-table-wrapper accounting-report-table-wrapper">
          <table className="accounting-table accounting-public-report-table accounting-public-report-table-compact">
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col" className="accounting-table-number">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${row.category}-${index}`}>
                  <td>{row.category}</td>
                  <td className="accounting-table-number">
                    {formatAccountingReportMoney(row.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="accounting-subtle">Sin movimientos en este grupo.</p>
      )}
    </div>
  );
}

export default function PublicAccountingReportDetail({
  report,
  mode = "admin",
}) {
  if (!report) {
    return null;
  }

  const currencies = Array.isArray(report.snapshot?.currencies) ? report.snapshot.currencies : [];

  return (
    <div className={`accounting-public-report-detail accounting-public-report-detail--${mode}`}>
      <div className="accounting-public-report-meta">
        <div>
          <span>Periodo</span>
          <strong>{formatAccountingReportPeriod(report.year, report.month)}</strong>
        </div>
        {mode === "admin" ? (
          <>
            <div>
              <span>Version</span>
              <strong>v{report.version || 1}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{formatAccountingPublicReportState(report.status)}</strong>
            </div>
            <div>
              <span>Fecha de generación</span>
              <strong>{renderDate(report.generatedAt)}</strong>
            </div>
          </>
        ) : null}
        <div>
          <span>Fecha de publicación</span>
          <strong>{renderDate(report.publishedAt, "No disponible")}</strong>
        </div>
      </div>

      {currencies.map((currencyReport) => (
        <section key={currencyReport.currency} className="accounting-public-report-currency">
          <div className="accounting-public-report-currency-header">
            <h4>{currencyReport.currency}</h4>
          </div>

          <div className="accounting-table-wrapper accounting-report-table-wrapper">
            <table className="accounting-table accounting-public-report-table">
              <thead>
                <tr>
                  <th scope="col">Resumen</th>
                  <th scope="col" className="accounting-table-number">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ingresos totales</td>
                  <td className="accounting-table-number">
                    {formatAccountingReportMoney(currencyReport.incomeTotal, currencyReport.currency)}
                  </td>
                </tr>
                <tr>
                  <td>Egresos totales</td>
                  <td className="accounting-table-number">
                    {formatAccountingReportMoney(currencyReport.expenseTotal, currencyReport.currency)}
                  </td>
                </tr>
                <tr>
                  <td>Resultado del periodo</td>
                  <td className="accounting-table-number">
                    {formatAccountingReportMoney(currencyReport.periodResult, currencyReport.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="accounting-public-report-category-grid">
            <CurrencyCategoryTable
              title="Ingresos por categoria"
              rows={currencyReport.incomeCategories}
              currency={currencyReport.currency}
            />
            <CurrencyCategoryTable
              title="Egresos por categoria"
              rows={currencyReport.expenseCategories}
              currency={currencyReport.currency}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
