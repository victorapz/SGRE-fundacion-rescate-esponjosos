import { useState } from "react";
import {
  ACCOUNTING_REPORT_VIEW_IDS,
  buildAllowedAccountingReportViews,
  resolveActiveAccountingReportView,
} from "./accountingReports.shared";
import AccountingTransactionsReport from "./AccountingTransactionsReport";
import PayablesReport from "./PayablesReport";
import PublicAccountingReports from "./PublicAccountingReports";

export default function AccountingReportsPanel({
  canReadTransactions,
  canReadPayables,
  canReadPublicReports,
  canCreatePublicReports,
  canPublishPublicReports,
  canArchivePublicReports,
  canExportReports,
  categories = [],
  paymentProviders = [],
  suppliers = [],
  clinics = [],
  reportCatalogsLoading = false,
  reportCatalogsError = "",
}) {
  const allowedViews = buildAllowedAccountingReportViews({
    canReadTransactions,
    canReadPayables,
    canReadPublicReports,
  });

  const [activeView, setActiveView] = useState(allowedViews[0]?.id || "");
  const resolvedActiveView = resolveActiveAccountingReportView(activeView, allowedViews);

  if (!allowedViews.length) {
    return (
      <div className="accounting-empty-state">
        <p>No tienes permisos para visualizar informes contables.</p>
      </div>
    );
  }

  return (
    <div className="accounting-report-shell">

      <div className="accounting-subtabs accounting-report-subtabs" role="tablist" aria-label="Tipos de informe">
        {allowedViews.map((view) => (
          <button
            key={view.id}
            id={`accounting-report-tab-${view.id}`}
            type="button"
            role="tab"
            aria-selected={resolvedActiveView === view.id}
            aria-controls={`accounting-report-panel-${view.id}`}
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

      {canReadTransactions && resolvedActiveView === ACCOUNTING_REPORT_VIEW_IDS.TRANSACTIONS ? (
        <AccountingTransactionsReport
          canExport={canExportReports}
          categories={categories}
          paymentProviders={paymentProviders}
        />
      ) : null}

      {canReadPayables && resolvedActiveView === ACCOUNTING_REPORT_VIEW_IDS.PAYABLES ? (
        <PayablesReport
          canExport={canExportReports}
          categories={categories}
          suppliers={suppliers}
          clinics={clinics}
          catalogsLoading={reportCatalogsLoading}
          catalogsError={reportCatalogsError}
        />
      ) : null}

      {canReadPublicReports && resolvedActiveView === ACCOUNTING_REPORT_VIEW_IDS.PUBLIC_REPORTS ? (
        <PublicAccountingReports
          canCreate={canCreatePublicReports}
          canPublish={canPublishPublicReports}
          canArchive={canArchivePublicReports}
        />
      ) : null}
    </div>
  );
}
