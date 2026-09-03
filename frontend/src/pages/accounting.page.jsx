import { Fragment, useEffect, useState } from "react";
import { Ban, Eye, HandCoins, Pencil, PowerOff } from "lucide-react";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import PaginationControls from "../components/PaginationControls";
import AccountingReportsPanel from "../components/accounting/reports/AccountingReportsPanel";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import {
  cancelAccountingPayable,
  cancelAccountingTransaction,
  createAccountingCategory,
  createAccountingDonationRefund,
  createAccountingPayable,
  createAccountingPayablePayment,
  createAccountingPaymentProvider,
  createAccountingTransaction,
  deleteAccountingCategory,
  deleteAccountingPaymentProvider,
  getAccountingCategories,
  getAccountingDashboard,
  getAccountingDonations,
  getAccountingPayables,
  getAccountingPaymentOrders,
  getAccountingPaymentProviders,
  getAccountingTransactions,
  getAccountingWebhooks,
  updateAccountingCategory,
  updateAccountingPayable,
  updateAccountingPaymentProvider,
  updateAccountingTransaction,
} from "../services/accounting.service";
import { getSuppliers } from "../services/supplier.service";
import { getVetClinics } from "../services/vet_clinic.service";
import { formatMoney } from "../utils/financial";
import "../styles/home.page.css";
import "../styles/settings.page.css";
import "../styles/accounting.page.css";
import "../styles/accounting-reports.css";

const ACCOUNTING_TABS = {
  SUMMARY: "summary",
  TRANSACTIONS: "transactions",
  PAYABLES: "payables",
  REPORTS: "reports",
  PARAMETERS: "parameters",
  DONATIONS: "donations",
};

const PARAMETER_TABS = {
  CATEGORIES: "categories",
  PROVIDERS: "providers",
  PAYMENT_ORDERS: "payment_orders",
  WEBHOOKS: "webhooks",
};

const TRANSACTION_TYPES = ["INGRESO", "EGRESO", "REEMBOLSO", "AJUSTE"];
const TRANSACTION_STATES = [
  "CONFIRMADA",
  "ANULADA",
  "COMPLETADA",
  "CANCELADA",
  "FALLIDA",
  "PENDIENTE",
];
const PAYABLE_STATES = [
  "PENDIENTE",
  "PAGADA_PARCIAL",
  "PAGADA",
  "VENCIDA",
  "ANULADA",
  "CONDONADA",
];
const CATEGORY_TYPES = ["INGRESO", "EGRESO", "AMBOS"];
const PROVIDER_TYPES = ["PAYPAL", "MANUAL", "TRANSFERENCIA", "EFECTIVO", "OTRO"];
const PAYMENT_ORDER_STATES = [
  "CREADA",
  "APROBADA",
  "CAPTURADA",
  "CANCELADA",
  "EXPIRADA",
  "FALLIDA",
  "REEMBOLSADA",
];
const PAYMENT_ORDER_PURPOSES = ["DONACION_UNICA", "APADRINAMIENTO", "SUSCRIPCION", "OTRO"];
const DONATION_VISIBLE_STATES = [
  "PENDIENTE",
  "CAPTURADA",
  "FALLIDA",
  "CANCELADA",
  "EXPIRADA",
  "REEMBOLSADA_PARCIAL",
  "REEMBOLSADA_TOTAL",
  "REVERTIDA",
];
const DONATION_REFUND_STATUSES = ["NONE", "PARTIAL", "FULL", "REVERSED"];
const DONATION_SORT_OPTIONS = [
  { value: "captured_at", label: "Fecha de captura" },
  { value: "created_at", label: "Fecha de creación" },
  { value: "gross_amount", label: "Monto bruto" },
  { value: "fee_amount", label: "Fee" },
  { value: "net_amount", label: "Monto neto" },
  { value: "refunded_amount", label: "Monto reembolsado" },
  { value: "donor_name", label: "Donante" },
];
const DONATION_SORT_ORDERS = [
  { value: "desc", label: "Descendente" },
  { value: "asc", label: "Ascendente" },
];
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const CURRENCY_OPTIONS = ["CLP", "USD", "EUR"];
const ACCOUNTING_SUMMARY_METRICS = [
  {
    key: "income",
    label: "Ingresos confirmados",
    amountField: "totalIngresosConfirmados",
  },
  {
    key: "expenses",
    label: "Egresos confirmados",
    amountField: "totalEgresosConfirmados",
  },
  {
    key: "netBalance",
    label: "Saldo neto",
    amountField: "saldoNeto",
  },
  {
    key: "pendingPayables",
    label: "Cuentas por pagar pendientes",
    amountField: "totalCuentasPorPagarPendientes",
    countField: "cantidadCuentasPendientes",
  },
  {
    key: "overdue",
    label: "Total vencido",
    amountField: "totalVencido",
  },
];


function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function readInitialAccountingQuery() {
  if (typeof window === "undefined") {
    return { tab: "", search: "" };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    tab: params.get("tab") || "",
    search: params.get("search") || "",
  };
}

function formatDate(value) {
  if (!value) return "No disponible";

  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return "No disponible";

  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function parsePositiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isBeforeDate(left, right) {
  if (!left || !right) return false;
  return String(left) < String(right);
}

function formatCompactJson(value) {
  if (!value) return "Sin datos";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatAccountingLabel(value) {
  if (!value) return "No disponible";

  const normalized = String(value).trim();
  if (!normalized) return "No disponible";

  const specialLabels = {
    CLP: "CLP",
    USD: "USD",
    EUR: "EUR",
    PAYPAL: "PayPal",
    PURCHASE: "Compra",
    EXAM: "Examen",
    HOSPITALIZATION: "Hospitalizacion",
    PROCEDURE: "Procedimiento",
    VET_CHECKUP: "Control veterinario",
    VET_CLINIC: "Clínica veterinaria",
    SUPPLIER: "Proveedor",
    DONACION_UNICA: "Donación única",
    APADRINAMIENTO: "Apadrinamiento",
    PAGADA_PARCIAL: "Pagada parcial",
    REEMBOLSADA_PARCIAL: "Reembolsada parcial",
    REEMBOLSADA_TOTAL: "Reembolsada total",
    REVERTIDA: "Revertida",
    NONE: "Sin reembolso",
    PARTIAL: "Reembolso parcial",
    FULL: "Reembolso total",
    REVERSED: "Revertida",
  };

  if (specialLabels[normalized]) {
    return specialLabels[normalized];
  }

  const cleaned = normalized.replace(/[_-]+/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isTransactionCancelable(state) {
  return !["ANULADA", "CANCELADA", "FALLIDA"].includes(state);
}

function isPayableCategory(category) {
  return category?.activo && ["EGRESO", "AMBOS"].includes(category.tipo);
}

function isNormalPaymentProvider(provider) {
  return provider?.activo && provider.tipo !== "MANUAL";
}

function providerSupportsFees(provider) {
  const metadata = provider?.metadataPublica;
  if (!metadata || typeof metadata !== "object") return false;

  return Boolean(metadata.supportsFees || metadata.requiresFee);
}

function getCategoryDisplayName(category) {
  if (!category) return "Sin categoria";
  return category.nombre || formatAccountingLabel(category.clave);
}

function getProviderDisplayName(provider, options = {}) {
  if (!provider) return options.emptyLabel || "Sin proveedor";

  if (!options.technical && provider.tipo === "MANUAL") {
    return "Registro manual interno";
  }

  return provider.nombre || formatAccountingLabel(provider.clave || provider.tipo);
}

function formatSourceSummary(origenTipo, origenId) {
  if (!origenTipo) return "Manual";
  return `${formatAccountingLabel(origenTipo)}${origenId ? ` #${origenId}` : ""}`;
}

function formatProviderSummary(proveedorTipo, proveedorId) {
  if (!proveedorTipo) return "Sin proveedor";
  return `${formatAccountingLabel(proveedorTipo)}${proveedorId ? ` #${proveedorId}` : ""}`;
}

function formatProviderMetadataSummary(metadata) {
  if (!metadata || typeof metadata !== "object") return "Sin configuracion pública";

  const entries = Object.entries(metadata).slice(0, 3);
  if (!entries.length) return "Sin configuracion pública";

  return entries
    .map(([key, currentValue]) => `${formatAccountingLabel(key)}: ${String(currentValue)}`)
    .join(" | ");
}

function emptyTransactionForm() {
  return {
    id: "",
    tipo: "EGRESO",
    categoriaId: "",
    proveedorPagoId: "",
    montoBruto: "",
    montoFee: "0",
    moneda: "CLP",
    fechaTransaccion: todayValue(),
    descripcion: "",
    referenciaExterna: "",
  };
}

function emptyPayableForm() {
  return {
    id: "",
    origenTipo: "",
    origenId: "",
    proveedorTipo: "",
    proveedorId: "",
    categoriaId: "",
    descripcion: "",
    moneda: "CLP",
    montoTotal: "",
    fechaEmision: todayValue(),
    fechaVencimiento: "",
  };
}

function emptyPayablePaymentForm(payable = null) {
  return {
    payableId: payable?.id || "",
    montoAplicado: "",
    montoFee: "0",
    fechaPago: todayValue(),
    categoriaId: payable?.category?.id ? String(payable.category.id) : "",
    proveedorPagoId: "",
    descripcion: payable?.descripcion ? `Pago ${payable.descripcion}` : "",
  };
}

function emptyCategoryForm() {
  return {
    id: "",
    clave: "",
    nombre: "",
    tipo: "EGRESO",
    descripcion: "",
    categoriaPadreId: "",
    activo: true,
  };
}

function emptyProviderForm() {
  return {
    id: "",
    clave: "",
    nombre: "",
    tipo: "MANUAL",
    activo: true,
    metadataPublica: "",
  };
}

function emptyDonationRefundForm(donation = null) {
  return {
    paymentOrderId: donation?.paymentOrderId || "",
    monto: "",
    motivo: "",
  };
}

function getRemainingHoursLabel(availableUntil) {
  if (!availableUntil) return "Plazo no disponible";

  const remainingMs = new Date(availableUntil).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Plazo de reembolso finalizado";
  }

  const remainingHours = Math.max(remainingMs / (1000 * 60 * 60), 0);
  if (remainingHours >= 24) {
    return `${Math.ceil(remainingHours / 24)} dia(s) restantes`;
  }

  return `${Math.max(Math.ceil(remainingHours), 1)} hora(s) restantes`;
}

function buildTransactionCreatePayload(form) {
  const grossAmount = parsePositiveNumber(form.montoBruto);
  const feeAmount = parseOptionalNumber(form.montoFee) ?? 0;

  return {
    tipo: form.tipo,
    categoria_transaccion_id: form.categoriaId
      ? Number(form.categoriaId)
      : null,
    proveedor_pago_id: form.proveedorPagoId
      ? Number(form.proveedorPagoId)
      : null,
    monto_bruto: grossAmount,
    monto_fee: feeAmount,
    moneda: form.moneda,
    fecha_transaccion: form.fechaTransaccion,
    descripcion: form.descripcion || null,
    referencia_externa: form.referenciaExterna || null,
  };
}

function buildTransactionUpdatePayload(form) {
  return {
    proveedor_pago_id: form.proveedorPagoId
      ? Number(form.proveedorPagoId)
      : null,
    fecha_transaccion: form.fechaTransaccion,
    descripcion: form.descripcion || null,
    referencia_externa: form.referenciaExterna || null,
  };
}

function hasAccountingAccess(hasPermissionPrefix) {
  return hasPermissionPrefix("accounting:");
}

function AccountingBadge({ children, tone = "neutral" }) {
  return <span className={`accounting-badge accounting-badge-${tone}`}>{children}</span>;
}

function AccountingMetricCard({ label, value, hint, children }) {
  return (
    <article className="settings-kpi-card accounting-kpi-card">
      <span>{label}</span>
      {children || <strong>{value}</strong>}
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function formatSummaryCount(value, singular, plural) {
  const count = Number(value || 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function AccountingCurrencyValueList({ summaries, metric }) {
  const visibleSummaries = Array.isArray(summaries) ? summaries : [];

  if (!visibleSummaries.length) {
    return <span className="accounting-summary-empty-text">No disponible</span>;
  }

  return (
    <div className="accounting-summary-currency-list">
      {visibleSummaries.map((summary) => {
        const currency = summary.moneda || "CLP";
        const amount = Number(summary[metric.amountField] || 0);

        return (
          <div
            key={`${metric.key}-${currency}`}
            className="accounting-summary-currency-row"
          >
            <span className="accounting-summary-currency-code">{currency}</span>
            <span className="accounting-summary-currency-amount">
              {formatMoney(amount, currency)}
            </span>
            {metric.countField ? (
              <small className="accounting-summary-currency-hint">
                {formatSummaryCount(
                  summary[metric.countField],
                  "cuenta abierta",
                  "cuentas abiertas",
                )}
              </small>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AccountingSection({ title, subtitle, actions, children }) {
  return (
    <section className="crud-card accounting-card">
      <div className="crud-header accounting-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="accounting-subtle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="accounting-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function AccountingPlaceholder({ title, description }) {
  return (
    <div className="settings-empty-state accounting-placeholder">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function AccountingEmptyState({ children }) {
  return <div className="settings-empty-state accounting-empty-state">{children}</div>;
}

function AccountingFilterActions({ onClear, clearDisabled = false, clearLabel = "Limpiar filtros" }) {
  return (
    <div className="accounting-filter-clear-row">
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
    </div>
  );
}

function AccountingModal({
  isOpen,
  title,
  submitLabel,
  isSaving,
  submitDisabled = false,
  error,
  onClose,
  onSubmit,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="accounting-modal-overlay">
      <div className="accounting-modal">
        <div className="accounting-modal-header">
          <h3>{title}</h3>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form onSubmit={onSubmit} className="accounting-modal-form">
          {error ? <p className="error-text">{error}</p> : null}
          {children}
          <div className="event-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving || submitDisabled}>
              {isSaving ? "Guardando..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JsonPreview({ label, value }) {
  return (
    <div className="accounting-json-block">
      <h4>{label}</h4>
      <pre>{formatCompactJson(value)}</pre>
    </div>
  );
}

function transactionTone(tipo) {
  switch (tipo) {
    case "INGRESO":
      return "success";
    case "EGRESO":
      return "danger";
    case "REEMBOLSO":
      return "warning";
    default:
      return "neutral";
  }
}

function stateTone(state) {
  switch (state) {
    case "CONFIRMADA":
    case "COMPLETADA":
    case "PAGADA":
    case "CAPTURADA":
      return "success";
    case "PAGADA_PARCIAL":
    case "APROBADA":
    case "PENDIENTE":
    case "REEMBOLSADA_PARCIAL":
      return "warning";
    case "VENCIDA":
    case "FALLIDA":
    case "REVERTIDA":
      return "danger";
    case "ANULADA":
    case "CANCELADA":
    case "CONDONADA":
    case "EXPIRADA":
    case "REEMBOLSADA_TOTAL":
      return "muted";
    default:
      return "neutral";
  }
}

function refundTone(state) {
  switch (state) {
    case "FULL":
    case "REVERSED":
      return "muted";
    case "PARTIAL":
      return "warning";
    default:
      return "neutral";
  }
}

function buildDonationStats(filters, pagination) {
  return [
    filters.search ? `Busqueda: ${filters.search}` : null,
    filters.status ? `Estado: ${formatAccountingLabel(filters.status)}` : null,
    typeof filters.anonymous === "boolean"
      ? `Tipo: ${filters.anonymous ? "Anonimas" : "Identificadas"}`
      : null,
    filters.refundStatus ? `Reembolso: ${formatAccountingLabel(filters.refundStatus)}` : null,
    filters.provider ? "Proveedor aplicado" : null,
    filters.currency ? `Moneda: ${filters.currency}` : null,
    filters.dateFrom ? `Desde: ${filters.dateFrom}` : null,
    filters.dateTo ? `Hasta: ${filters.dateTo}` : null,
    pagination?.total ? `${pagination.total} registros` : "Sin registros",
  ];
}

export default function AccountingPage() {
  const {
    hasAnyPermission,
    hasPermission,
    hasPermissionPrefix,
  } = usePermissions();

  const canAccessModule = hasAccountingAccess(hasPermissionPrefix);
  const canReadDashboard = hasPermission(PERMISSIONS.ACCOUNTING.DASHBOARD_READ);
  const canReadTransactions = hasPermission(PERMISSIONS.ACCOUNTING.TRANSACTION_READ);
  const canCreateTransactions = hasPermission(PERMISSIONS.ACCOUNTING.TRANSACTION_CREATE);
  const canUpdateTransactions = hasPermission(PERMISSIONS.ACCOUNTING.TRANSACTION_UPDATE);
  const canCancelTransactions = hasPermission(PERMISSIONS.ACCOUNTING.TRANSACTION_CANCEL);
  const canReadPayables = hasPermission(PERMISSIONS.ACCOUNTING.PAYABLE_READ);
  const canCreatePayables = hasPermission(PERMISSIONS.ACCOUNTING.PAYABLE_CREATE);
  const canUpdatePayables = hasPermission(PERMISSIONS.ACCOUNTING.PAYABLE_UPDATE);
  const canPayPayables = hasPermission(PERMISSIONS.ACCOUNTING.PAYABLE_PAY);
  const canCancelPayables = hasPermission(PERMISSIONS.ACCOUNTING.PAYABLE_CANCEL);
  const canReadCategories = hasPermission(PERMISSIONS.ACCOUNTING.CATEGORY_READ);
  const canCreateCategories = hasPermission(PERMISSIONS.ACCOUNTING.CATEGORY_CREATE);
  const canUpdateCategories = hasPermission(PERMISSIONS.ACCOUNTING.CATEGORY_UPDATE);
  const canDeleteCategories = hasPermission(PERMISSIONS.ACCOUNTING.CATEGORY_DELETE);
  const canReadProviders = hasPermission(PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_READ);
  const canCreateProviders = hasPermission(PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_CREATE);
  const canUpdateProviders = hasPermission(PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_UPDATE);
  const canDeleteProviders = hasPermission(PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_DELETE);
  const canReadPaymentOrders = hasPermission(PERMISSIONS.ACCOUNTING.PAYMENT_ORDER_READ);
  const canExportAccountingReports = hasPermission(PERMISSIONS.ACCOUNTING.REPORT_EXPORT);
  const canReadPublicReports = hasPermission(PERMISSIONS.ACCOUNTING.PUBLIC_REPORT_READ);
  const canCreatePublicReports = hasPermission(PERMISSIONS.ACCOUNTING.PUBLIC_REPORT_CREATE);
  const canPublishPublicReports = hasPermission(PERMISSIONS.ACCOUNTING.PUBLIC_REPORT_PUBLISH);
  const canArchivePublicReports = hasPermission(PERMISSIONS.ACCOUNTING.PUBLIC_REPORT_ARCHIVE);
  const canRefundDonations = hasPermission(PERMISSIONS.ACCOUNTING.DONATION_REFUND_CREATE);
  const canReadWebhooks = hasPermission(PERMISSIONS.ACCOUNTING.WEBHOOK_READ);
  const canReadDonations = hasPermission(PERMISSIONS.ACCOUNTING.PAYMENT_ORDER_READ);
  const canReadSuppliers = hasPermission(PERMISSIONS.INVENTORY.SUPPLIER_READ);
  const canReadVetClinics = hasPermission(PERMISSIONS.ANIMALS.VET_CLINIC_READ);
  const canReadAccountingReports = canReadTransactions || canReadPayables || canReadPublicReports;
  const initialAccountingQuery = readInitialAccountingQuery();

  const tabs = [
    {
      id: ACCOUNTING_TABS.SUMMARY,
      label: "Resumen",
      allowed: canAccessModule,
    },
    {
      id: ACCOUNTING_TABS.TRANSACTIONS,
      label: "Transacciones",
      allowed: hasAnyPermission([
        PERMISSIONS.ACCOUNTING.TRANSACTION_READ,
        PERMISSIONS.ACCOUNTING.TRANSACTION_CREATE,
        PERMISSIONS.ACCOUNTING.TRANSACTION_UPDATE,
        PERMISSIONS.ACCOUNTING.TRANSACTION_CANCEL,
      ]),
    },
    {
      id: ACCOUNTING_TABS.PAYABLES,
      label: "Cuentas por pagar",
      allowed: hasAnyPermission([
        PERMISSIONS.ACCOUNTING.PAYABLE_READ,
        PERMISSIONS.ACCOUNTING.PAYABLE_CREATE,
        PERMISSIONS.ACCOUNTING.PAYABLE_UPDATE,
        PERMISSIONS.ACCOUNTING.PAYABLE_PAY,
        PERMISSIONS.ACCOUNTING.PAYABLE_CANCEL,
      ]),
    },
    {
      id: ACCOUNTING_TABS.REPORTS,
      label: "Informes",
      allowed: canReadAccountingReports,
    },
    {
      id: ACCOUNTING_TABS.PARAMETERS,
      label: "Parámetros",
      allowed: hasAnyPermission([
        PERMISSIONS.ACCOUNTING.CATEGORY_READ,
        PERMISSIONS.ACCOUNTING.CATEGORY_CREATE,
        PERMISSIONS.ACCOUNTING.CATEGORY_UPDATE,
        PERMISSIONS.ACCOUNTING.CATEGORY_DELETE,
        PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_READ,
        PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_CREATE,
        PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_UPDATE,
        PERMISSIONS.ACCOUNTING.PAYMENT_PROVIDER_DELETE,
        PERMISSIONS.ACCOUNTING.PAYMENT_ORDER_READ,
        PERMISSIONS.ACCOUNTING.WEBHOOK_READ,
      ]),
    },
    {
      id: ACCOUNTING_TABS.DONATIONS,
      label: "Donaciones",
      allowed: canReadDonations,
    },
  ].filter((tab) => tab.allowed);

  const requestedInitialTab = Object.values(ACCOUNTING_TABS).includes(initialAccountingQuery.tab)
    ? initialAccountingQuery.tab
    : ACCOUNTING_TABS.SUMMARY;

  const [activeTab, setActiveTab] = useState(requestedInitialTab);
  const [activeParameterTab, setActiveParameterTab] = useState(PARAMETER_TABS.CATEGORIES);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState({
    summary: false,
    references: false,
    transactions: false,
    payables: false,
    parameters: false,
    paymentOrders: false,
    donations: false,
    webhooks: false,
  });
  const [summaryError, setSummaryError] = useState("");
  const [summaryData, setSummaryData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [reportSuppliers, setReportSuppliers] = useState([]);
  const [reportVetClinics, setReportVetClinics] = useState([]);
  const [reportCatalogsLoading, setReportCatalogsLoading] = useState(false);
  const [reportCatalogsError, setReportCatalogsError] = useState("");
  const [parameterError, setParameterError] = useState("");
  const [transactionsData, setTransactionsData] = useState({
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  const [transactionsError, setTransactionsError] = useState("");
  const [payablesData, setPayablesData] = useState({
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  const [payablesError, setPayablesError] = useState("");
  const [paymentOrdersData, setPaymentOrdersData] = useState({
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  const [paymentOrdersError, setPaymentOrdersError] = useState("");
  const [donationsData, setDonationsData] = useState({
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    summary: { byCurrency: [] },
  });
  const [donationsError, setDonationsError] = useState("");
  const [webhooksData, setWebhooksData] = useState({
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  const [webhooksError, setWebhooksError] = useState("");
  const [expandedWebhookId, setExpandedWebhookId] = useState("");

  const [transactionFilters, setTransactionFilters] = useState({
    tipo: "",
    estado: "",
    categoriaId: "",
    proveedorPagoId: "",
    fechaDesde: "",
    fechaHasta: "",
    search: initialAccountingQuery.search || "",
  });
  const [transactionPage, setTransactionPage] = useState({ page: 1, limit: 10 });

  const [payableFilters, setPayableFilters] = useState({
    estado: "",
    origenTipo: "",
    proveedorTipo: "",
    categoriaId: "",
    moneda: "",
    search: "",
    vencidas: false,
    vencimientoDesde: "",
    vencimientoHasta: "",
  });
  const [payablePage, setPayablePage] = useState({ page: 1, limit: 10 });

  const [paymentOrderFilters, setPaymentOrderFilters] = useState({
    estado: "",
    proposito: "",
    proveedorPagoId: "",
    search: "",
  });
  const [paymentOrderPage, setPaymentOrderPage] = useState({ page: 1, limit: 10 });
  const [donationFilters, setDonationFilters] = useState({
    search: "",
    status: "",
    anonymous: "all",
    dateFrom: "",
    dateTo: "",
    provider: "",
    currency: "",
    refundStatus: "",
    sortBy: "captured_at",
    sortOrder: "desc",
  });
  const [donationPage, setDonationPage] = useState({ page: 1, limit: 10 });

  const [webhookFilters, setWebhookFilters] = useState({
    estado: "",
    eventoTipo: "",
    proveedorPagoId: "",
    search: "",
  });
  const [webhookPage, setWebhookPage] = useState({ page: 1, limit: 10 });

  const [transactionModal, setTransactionModal] = useState({
    open: false,
    mode: "create",
    saving: false,
    error: "",
    form: emptyTransactionForm(),
  });
  const [payableModal, setPayableModal] = useState({
    open: false,
    mode: "create",
    saving: false,
    error: "",
    form: emptyPayableForm(),
  });
  const [payablePaymentModal, setPayablePaymentModal] = useState({
    open: false,
    saving: false,
    error: "",
    payable: null,
    form: emptyPayablePaymentForm(),
  });
  const [categoryModal, setCategoryModal] = useState({
    open: false,
    mode: "create",
    saving: false,
    error: "",
    form: emptyCategoryForm(),
  });
  const [providerModal, setProviderModal] = useState({
    open: false,
    mode: "create",
    saving: false,
    error: "",
    form: emptyProviderForm(),
  });
  const [donationDetailModal, setDonationDetailModal] = useState({
    open: false,
    donation: null,
  });
  const [donationRefundModal, setDonationRefundModal] = useState({
    open: false,
    saving: false,
    error: "",
    donation: null,
    form: emptyDonationRefundForm(),
  });

  const parameterTabs = [
    {
      id: PARAMETER_TABS.CATEGORIES,
      label: "Categorías",
      allowed: canReadCategories || canCreateCategories || canUpdateCategories || canDeleteCategories,
    },
    {
      id: PARAMETER_TABS.PROVIDERS,
      label: "Proveedores de pago",
      allowed: canReadProviders || canCreateProviders || canUpdateProviders || canDeleteProviders,
    },
    {
      id: PARAMETER_TABS.PAYMENT_ORDERS,
      label: "Órdenes de pago",
      allowed: canReadPaymentOrders,
    },
    {
      id: PARAMETER_TABS.WEBHOOKS,
      label: "Webhooks",
      allowed: canReadWebhooks,
    },
  ].filter((tab) => tab.allowed);

  const payableCategories = categories.filter(isPayableCategory);
  const normalPaymentProviders = paymentProviders.filter(isNormalPaymentProvider);
  const getSelectableNormalProviders = (selectedId = "") => {
    const visibleProviders = [...normalPaymentProviders];
    const selectedProvider = selectedId
      ? paymentProviders.find((item) => String(item.id) === String(selectedId))
      : null;

    if (
      selectedProvider
      && !visibleProviders.some((item) => String(item.id) === String(selectedProvider.id))
    ) {
      visibleProviders.push(selectedProvider);
    }

    return visibleProviders;
  };
  const selectedPaymentProvider = payablePaymentModal.form.proveedorPagoId
    ? paymentProviders.find(
      (item) => String(item.id) === String(payablePaymentModal.form.proveedorPagoId),
    )
    : null;
  const showPayablePaymentFeeField = providerSupportsFees(selectedPaymentProvider);
  const payablePaymentAmount = parsePositiveNumber(payablePaymentModal.form.montoAplicado);
  const payablePaymentSaldoPendiente = Number(payablePaymentModal.payable?.saldoPendiente || 0);
  const payablePaymentExceedsBalance = Boolean(
    payablePaymentModal.form.montoAplicado
      && payablePaymentAmount
      && payablePaymentAmount > payablePaymentSaldoPendiente,
  );
  const payablePaymentHasValidAmount = Boolean(
    payablePaymentAmount
      && Number.isFinite(payablePaymentAmount)
      && payablePaymentAmount > 0
      && payablePaymentAmount <= payablePaymentSaldoPendiente,
  );
  const payablePaymentUsesFullBalance = Boolean(
    payablePaymentModal.form.montoAplicado
      && payablePaymentAmount
      && payablePaymentAmount === payablePaymentSaldoPendiente,
  );
  const donationRefundAmount = parsePositiveNumber(donationRefundModal.form.monto);
  const donationRefundRemainingAmount = Number(donationRefundModal.donation?.remainingAmount || 0);
  const donationRefundExceedsBalance = Boolean(
    donationRefundModal.form.monto
      && donationRefundAmount
      && donationRefundAmount > donationRefundRemainingAmount,
  );
  const donationRefundHasReason = Boolean(donationRefundModal.form.motivo.trim());
  const donationRefundHasValidAmount = Boolean(
    donationRefundAmount
      && Number.isFinite(donationRefundAmount)
      && donationRefundAmount > 0
      && donationRefundAmount <= donationRefundRemainingAmount,
  );
  const donationRefundUsesFullBalance = Boolean(
    donationRefundModal.form.monto
      && donationRefundAmount
      && donationRefundAmount === donationRefundRemainingAmount,
  );
  const donationRefundCanSubmit = Boolean(
    donationRefundModal.donation
      && donationRefundModal.donation.refundAllowed
      && donationRefundHasValidAmount
      && donationRefundHasReason
      && !donationRefundModal.saving,
  );

  const visiblePayables = payablesData.items.filter((payable) => {
    if (
      payableFilters.vencimientoDesde
      && (!payable.fechaVencimiento || isBeforeDate(payable.fechaVencimiento, payableFilters.vencimientoDesde))
    ) {
      return false;
    }

    if (
      payableFilters.vencimientoHasta
      && (!payable.fechaVencimiento || isBeforeDate(payableFilters.vencimientoHasta, payable.fechaVencimiento))
    ) {
      return false;
    }

    return true;
  });

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab) && tabs[0]) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (!parameterTabs.some((tab) => tab.id === activeParameterTab) && parameterTabs[0]) {
      setActiveParameterTab(parameterTabs[0].id);
    }
  }, [activeParameterTab, parameterTabs]);

  useEffect(() => {
    if (!canReadDashboard) return;

    let cancelled = false;

    async function run() {
      setLoading((current) => ({ ...current, summary: true }));
      setSummaryError("");

      try {
        const data = await getAccountingDashboard();
        if (!cancelled) {
          setSummaryData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setSummaryError(error.message || "No fue posible cargar el resumen contable.");
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, summary: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [canReadDashboard]);

  useEffect(() => {
    if (!canReadCategories && !canReadProviders) return;

    let cancelled = false;

    async function run() {
      setLoading((current) => ({ ...current, references: true, parameters: true }));
      setParameterError("");

      try {
        const tasks = [];
        if (canReadCategories) {
          tasks.push(getAccountingCategories({ page: 1, limit: 100 }));
        } else {
          tasks.push(Promise.resolve({ items: [] }));
        }

        if (canReadProviders) {
          tasks.push(getAccountingPaymentProviders({ page: 1, limit: 100 }));
        } else {
          tasks.push(Promise.resolve({ items: [] }));
        }

        const [categoriesResult, providersResult] = await Promise.all(tasks);
        if (!cancelled) {
          setCategories(categoriesResult.items || []);
          setPaymentProviders(providersResult.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          setParameterError(error.message || "No fue posible cargar los parámetros contables.");
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, references: false, parameters: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [canReadCategories, canReadProviders]);

  useEffect(() => {
    if (!canReadPayables || (!canReadSuppliers && !canReadVetClinics)) {
      setReportSuppliers([]);
      setReportVetClinics([]);
      setReportCatalogsError("");
      setReportCatalogsLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      setReportCatalogsLoading(true);
      setReportCatalogsError("");

      try {
        const [suppliersResult, clinicsResult] = await Promise.all([
          canReadSuppliers ? getSuppliers({ limit: 100, page: 1, activo: true }) : Promise.resolve({ items: [] }),
          canReadVetClinics ? getVetClinics({ activo: true }) : Promise.resolve([]),
        ]);

        if (!cancelled) {
          setReportSuppliers(Array.isArray(suppliersResult?.items) ? suppliersResult.items : []);
          setReportVetClinics(Array.isArray(clinicsResult) ? clinicsResult : []);
        }
      } catch (error) {
        if (!cancelled) {
          setReportCatalogsError(error.message || "No fue posible cargar los catálogos de informes.");
          setReportSuppliers([]);
          setReportVetClinics([]);
        }
      } finally {
        if (!cancelled) {
          setReportCatalogsLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [canReadPayables, canReadSuppliers, canReadVetClinics]);

  useEffect(() => {
    if (activeTab !== ACCOUNTING_TABS.TRANSACTIONS || !canReadTransactions) return;

    let cancelled = false;

    async function run() {
      setLoading((current) => ({ ...current, transactions: true }));
      setTransactionsError("");

      try {
        const data = await getAccountingTransactions({
          page: transactionPage.page,
          limit: transactionPage.limit,
          tipo: transactionFilters.tipo || undefined,
          estado: transactionFilters.estado || undefined,
          categoria_transaccion_id: transactionFilters.categoriaId || undefined,
          proveedor_pago_id: transactionFilters.proveedorPagoId || undefined,
          fecha_desde: transactionFilters.fechaDesde || undefined,
          fecha_hasta: transactionFilters.fechaHasta || undefined,
          search: transactionFilters.search || undefined,
        });

        if (!cancelled) {
          setTransactionsData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setTransactionsError(error.message || "No fue posible cargar las transacciones.");
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, transactions: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canReadTransactions, transactionFilters, transactionPage]);

  useEffect(() => {
    if (activeTab !== ACCOUNTING_TABS.PAYABLES || !canReadPayables) return;

    let cancelled = false;

    async function run() {
      setLoading((current) => ({ ...current, payables: true }));
      setPayablesError("");

      try {
        const data = await getAccountingPayables({
          page: payablePage.page,
          limit: payablePage.limit,
          estado: payableFilters.estado || undefined,
          origen_tipo: payableFilters.origenTipo || undefined,
          proveedor_tipo: payableFilters.proveedorTipo || undefined,
          categoria_transaccion_id: payableFilters.categoriaId || undefined,
          moneda: payableFilters.moneda || undefined,
          search: payableFilters.search || undefined,
          vencidas: payableFilters.vencidas || undefined,
        });

        if (!cancelled) {
          setPayablesData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setPayablesError(error.message || "No fue posible cargar las cuentas por pagar.");
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, payables: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canReadPayables, payableFilters, payablePage]);

  useEffect(() => {
    if (
      activeTab !== ACCOUNTING_TABS.PARAMETERS
      || activeParameterTab !== PARAMETER_TABS.PAYMENT_ORDERS
      || !canReadPaymentOrders
    ) {
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading((current) => ({ ...current, paymentOrders: true }));
      setPaymentOrdersError("");

      try {
        const data = await getAccountingPaymentOrders({
          page: paymentOrderPage.page,
          limit: paymentOrderPage.limit,
          estado: paymentOrderFilters.estado || undefined,
          proposito: paymentOrderFilters.proposito || undefined,
          proveedor_pago_id: paymentOrderFilters.proveedorPagoId || undefined,
          search: paymentOrderFilters.search || undefined,
        });

        if (!cancelled) {
          setPaymentOrdersData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentOrdersError(error.message || "No fue posible cargar las órdenes de pago.");
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, paymentOrders: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, activeParameterTab, canReadPaymentOrders, paymentOrderFilters, paymentOrderPage]);

  useEffect(() => {
    if (activeTab !== ACCOUNTING_TABS.DONATIONS || !canReadDonations) return;

    let cancelled = false;

    async function run() {
      setLoading((current) => ({ ...current, donations: true }));
      setDonationsError("");

      try {
        const data = await getAccountingDonations({
          page: donationPage.page,
          limit: donationPage.limit,
          search: donationFilters.search || undefined,
          status: donationFilters.status || undefined,
          anonymous: donationFilters.anonymous === "all"
            ? undefined
            : donationFilters.anonymous === "anonymous",
          date_from: donationFilters.dateFrom || undefined,
          date_to: donationFilters.dateTo || undefined,
          provider: donationFilters.provider || undefined,
          currency: donationFilters.currency || undefined,
          refund_status: donationFilters.refundStatus || undefined,
          sort_by: donationFilters.sortBy || undefined,
          sort_order: donationFilters.sortOrder || undefined,
        });

        if (!cancelled) {
          setDonationsData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setDonationsError(error.message || "No fue posible cargar las donaciones.");
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, donations: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canReadDonations, donationFilters, donationPage]);

  useEffect(() => {
    if (
      activeTab !== ACCOUNTING_TABS.PARAMETERS
      || activeParameterTab !== PARAMETER_TABS.WEBHOOKS
      || !canReadWebhooks
    ) {
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading((current) => ({ ...current, webhooks: true }));
      setWebhooksError("");

      try {
        const data = await getAccountingWebhooks({
          page: webhookPage.page,
          limit: webhookPage.limit,
          estado: webhookFilters.estado || undefined,
          evento_tipo: webhookFilters.eventoTipo || undefined,
          proveedor_pago_id: webhookFilters.proveedorPagoId || undefined,
          search: webhookFilters.search || undefined,
        });

        if (!cancelled) {
          setWebhooksData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setWebhooksError(error.message || "No fue posible cargar los webhooks técnicos.");
        }
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, webhooks: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, activeParameterTab, canReadWebhooks, webhookFilters, webhookPage]);

  function openCreateTransactionModal() {
    setTransactionModal({
      open: true,
      mode: "create",
      saving: false,
      error: "",
      form: emptyTransactionForm(),
    });
  }

  function openEditTransactionModal(item) {
    setTransactionModal({
      open: true,
      mode: "edit",
      saving: false,
      error: "",
      form: {
        id: item.id,
        tipo: item.tipo || "EGRESO",
        categoriaId: item.category?.id ? String(item.category.id) : "",
        proveedorPagoId: item.paymentProvider?.id ? String(item.paymentProvider.id) : "",
        montoBruto: String(item.montoBruto ?? ""),
        montoFee: String(item.montoFee ?? 0),
        moneda: item.moneda || "CLP",
        fechaTransaccion: item.fechaTransaccion ? String(item.fechaTransaccion).slice(0, 10) : todayValue(),
        descripcion: item.descripcion || "",
        referenciaExterna: item.referenciaExterna || "",
      },
    });
  }

  function openCreatePayableModal() {
    setPayableModal({
      open: true,
      mode: "create",
      saving: false,
      error: "",
      form: emptyPayableForm(),
    });
  }

  function openEditPayableModal(item) {
    setPayableModal({
      open: true,
      mode: "edit",
      saving: false,
      error: "",
      form: {
        id: item.id,
        origenTipo: item.origenTipo || "",
        origenId: item.origenId ?? "",
        proveedorTipo: item.proveedorTipo || "",
        proveedorId: item.proveedorId ?? "",
        categoriaId: item.category?.id ? String(item.category.id) : "",
        descripcion: item.descripcion || "",
        moneda: item.moneda || "CLP",
        montoTotal: String(item.montoTotal ?? ""),
        fechaEmision: item.fechaEmision || todayValue(),
        fechaVencimiento: item.fechaVencimiento || "",
      },
    });
  }

  function openPayablePaymentModal(item) {
    setPayablePaymentModal({
      open: true,
      saving: false,
      error: "",
      payable: item,
      form: emptyPayablePaymentForm(item),
    });
  }

  function openCreateCategoryModal() {
    setCategoryModal({
      open: true,
      mode: "create",
      saving: false,
      error: "",
      form: emptyCategoryForm(),
    });
  }

  function openEditCategoryModal(item) {
    setCategoryModal({
      open: true,
      mode: "edit",
      saving: false,
      error: "",
      form: {
        id: item.id,
        clave: item.clave || "",
        nombre: item.nombre || "",
        tipo: item.tipo || "EGRESO",
        descripcion: item.descripcion || "",
        categoriaPadreId: item.categoriaPadreId ? String(item.categoriaPadreId) : "",
        activo: Boolean(item.activo),
      },
    });
  }

  function openCreateProviderModal() {
    setProviderModal({
      open: true,
      mode: "create",
      saving: false,
      error: "",
      form: emptyProviderForm(),
    });
  }

  function openEditProviderModal(item) {
    setProviderModal({
      open: true,
      mode: "edit",
      saving: false,
      error: "",
      form: {
        id: item.id,
        clave: item.clave || "",
        nombre: item.nombre || "",
        tipo: item.tipo || "MANUAL",
        activo: Boolean(item.activo),
        metadataPublica: item.metadataPublica
          ? JSON.stringify(item.metadataPublica, null, 2)
          : "",
      },
    });
  }

  async function reloadParameters(showMessage = false) {
    if (!canReadCategories && !canReadProviders) return;

    setLoading((current) => ({ ...current, parameters: true }));
    setParameterError("");

    try {
      const tasks = [];
      if (canReadCategories) {
        tasks.push(getAccountingCategories({ page: 1, limit: 100 }));
      } else {
        tasks.push(Promise.resolve({ items: [] }));
      }

      if (canReadProviders) {
        tasks.push(getAccountingPaymentProviders({ page: 1, limit: 100 }));
      } else {
        tasks.push(Promise.resolve({ items: [] }));
      }

      const [categoriesResult, providersResult] = await Promise.all(tasks);
      setCategories(categoriesResult.items || []);
      setPaymentProviders(providersResult.items || []);

      if (showMessage) {
        setFeedback({
          type: "success",
          message: "Parámetros contables actualizados.",
        });
      }
    } catch (error) {
      setParameterError(error.message || "No fue posible refrescar los parámetros.");
    } finally {
      setLoading((current) => ({ ...current, parameters: false }));
    }
  }

  async function reloadSummary() {
    if (!canReadDashboard) return;

    setLoading((current) => ({ ...current, summary: true }));
    setSummaryError("");

    try {
      const data = await getAccountingDashboard();
      setSummaryData(data);
    } catch (error) {
      setSummaryError(error.message || "No fue posible refrescar el resumen contable.");
    } finally {
      setLoading((current) => ({ ...current, summary: false }));
    }
  }

  async function reloadTransactions() {
    if (!canReadTransactions) return;

    setLoading((current) => ({ ...current, transactions: true }));
    setTransactionsError("");

    try {
      const data = await getAccountingTransactions({
        page: transactionPage.page,
        limit: transactionPage.limit,
        tipo: transactionFilters.tipo || undefined,
        estado: transactionFilters.estado || undefined,
        categoria_transaccion_id: transactionFilters.categoriaId || undefined,
        proveedor_pago_id: transactionFilters.proveedorPagoId || undefined,
        fecha_desde: transactionFilters.fechaDesde || undefined,
        fecha_hasta: transactionFilters.fechaHasta || undefined,
        search: transactionFilters.search || undefined,
      });
      setTransactionsData(data);
    } catch (error) {
      setTransactionsError(error.message || "No fue posible refrescar las transacciones.");
    } finally {
      setLoading((current) => ({ ...current, transactions: false }));
    }
  }

  async function reloadPayables() {
    if (!canReadPayables) return;

    setLoading((current) => ({ ...current, payables: true }));
    setPayablesError("");

    try {
      const data = await getAccountingPayables({
        page: payablePage.page,
        limit: payablePage.limit,
        estado: payableFilters.estado || undefined,
        origen_tipo: payableFilters.origenTipo || undefined,
        proveedor_tipo: payableFilters.proveedorTipo || undefined,
        categoria_transaccion_id: payableFilters.categoriaId || undefined,
        moneda: payableFilters.moneda || undefined,
        search: payableFilters.search || undefined,
        vencidas: payableFilters.vencidas || undefined,
      });
      setPayablesData(data);
    } catch (error) {
      setPayablesError(error.message || "No fue posible refrescar las cuentas por pagar.");
    } finally {
      setLoading((current) => ({ ...current, payables: false }));
    }
  }

  async function reloadPaymentOrders() {
    if (!canReadPaymentOrders) return;

    setLoading((current) => ({ ...current, paymentOrders: true }));
    setPaymentOrdersError("");

    try {
      const data = await getAccountingPaymentOrders({
        page: paymentOrderPage.page,
        limit: paymentOrderPage.limit,
        estado: paymentOrderFilters.estado || undefined,
        proposito: paymentOrderFilters.proposito || undefined,
        proveedor_pago_id: paymentOrderFilters.proveedorPagoId || undefined,
        search: paymentOrderFilters.search || undefined,
      });
      setPaymentOrdersData(data);
    } catch (error) {
      setPaymentOrdersError(error.message || "No fue posible refrescar las órdenes de pago.");
    } finally {
      setLoading((current) => ({ ...current, paymentOrders: false }));
    }
  }

  async function reloadDonations() {
    if (!canReadDonations) return;

    setLoading((current) => ({ ...current, donations: true }));
    setDonationsError("");

    try {
      const data = await getAccountingDonations({
        page: donationPage.page,
        limit: donationPage.limit,
        search: donationFilters.search || undefined,
        status: donationFilters.status || undefined,
        anonymous: donationFilters.anonymous === "all"
          ? undefined
          : donationFilters.anonymous === "anonymous",
        date_from: donationFilters.dateFrom || undefined,
        date_to: donationFilters.dateTo || undefined,
        provider: donationFilters.provider || undefined,
        currency: donationFilters.currency || undefined,
        refund_status: donationFilters.refundStatus || undefined,
        sort_by: donationFilters.sortBy || undefined,
        sort_order: donationFilters.sortOrder || undefined,
      });
      setDonationsData(data);
    } catch (error) {
      setDonationsError(error.message || "No fue posible refrescar las donaciones.");
    } finally {
      setLoading((current) => ({ ...current, donations: false }));
    }
  }

  async function reloadWebhooks() {
    if (!canReadWebhooks) return;

    setLoading((current) => ({ ...current, webhooks: true }));
    setWebhooksError("");

    try {
      const data = await getAccountingWebhooks({
        page: webhookPage.page,
        limit: webhookPage.limit,
        estado: webhookFilters.estado || undefined,
        evento_tipo: webhookFilters.eventoTipo || undefined,
        proveedor_pago_id: webhookFilters.proveedorPagoId || undefined,
        search: webhookFilters.search || undefined,
      });
      setWebhooksData(data);
    } catch (error) {
      setWebhooksError(error.message || "No fue posible refrescar los webhooks.");
    } finally {
      setLoading((current) => ({ ...current, webhooks: false }));
    }
  }

  function openDonationRefundModal(donation) {
    setDonationRefundModal({
      open: true,
      saving: false,
      error: "",
      donation,
      form: emptyDonationRefundForm(donation),
    });
  }

  async function handleSubmitDonationRefund(event) {
    event.preventDefault();

    const currentDonation = donationRefundModal.donation;
    if (!currentDonation) {
      setDonationRefundModal((current) => ({
        ...current,
        error: "No fue posible resolver la donación a reembolsar.",
      }));
      return;
    }

    if (!currentDonation.refundAllowed) {
      setDonationRefundModal((current) => ({
        ...current,
        error: currentDonation.refundBlockedReason || "Esta donación ya no puede reembolsarse.",
      }));
      return;
    }

    if (!donationRefundHasValidAmount) {
      setDonationRefundModal((current) => ({
        ...current,
        error: donationRefundExceedsBalance
          ? "El reembolso no puede superar el saldo disponible."
          : "Ingrese un monto mayor a 0.",
      }));
      return;
    }

    if (!donationRefundHasReason) {
      setDonationRefundModal((current) => ({
        ...current,
        error: "El motivo del reembolso es obligatorio.",
      }));
      return;
    }

    const formattedAmount = formatMoney(donationRefundAmount, currentDonation.currency);
    const confirmed = window.confirm(
      `¿Está seguro de realizar este reembolso por ${formattedAmount} mediante PayPal?\n\nEsta acción devolverá el dinero al pagador y generará un egreso contable. No se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    setDonationRefundModal((current) => ({ ...current, saving: true, error: "" }));

    try {
      await createAccountingDonationRefund(currentDonation.paymentOrderId, {
        monto: donationRefundAmount,
        motivo: donationRefundModal.form.motivo.trim(),
      });

      setDonationRefundModal({
        open: false,
        saving: false,
        error: "",
        donation: null,
        form: emptyDonationRefundForm(),
      });
      setFeedback({ type: "success", message: "Refund PayPal registrado correctamente." });
      await reloadDonations();
      await reloadSummary();
    } catch (error) {
      setDonationRefundModal((current) => ({
        ...current,
        saving: false,
        error: error.message || "No fue posible crear el refund PayPal.",
      }));
    }
  }

  async function handleSubmitTransaction(event) {
    event.preventDefault();

    const isEditMode = transactionModal.mode === "edit" && transactionModal.form.id;
    if (!transactionModal.form.fechaTransaccion) {
      setTransactionModal((current) => ({
        ...current,
        error: isEditMode
          ? "La fecha es obligatoria."
          : "Tipo, moneda y fecha son obligatorios.",
      }));
      return;
    }

    let payload;
    if (isEditMode) {
      payload = buildTransactionUpdatePayload(transactionModal.form);
    } else {
      const grossAmount = parsePositiveNumber(transactionModal.form.montoBruto);
      const feeAmount = parseOptionalNumber(transactionModal.form.montoFee) ?? 0;
      if (!transactionModal.form.tipo || !transactionModal.form.moneda) {
        setTransactionModal((current) => ({
          ...current,
          error: "Tipo, moneda y fecha son obligatorios.",
        }));
        return;
      }

      if (!grossAmount) {
        setTransactionModal((current) => ({
          ...current,
          error: "El monto bruto debe ser mayor a 0.",
        }));
        return;
      }

      if (feeAmount < 0 || feeAmount > grossAmount) {
        setTransactionModal((current) => ({
          ...current,
          error: "El monto fee no puede ser negativo ni mayor al monto bruto.",
        }));
        return;
      }

      payload = buildTransactionCreatePayload(transactionModal.form);
    }

    setTransactionModal((current) => ({ ...current, saving: true, error: "" }));

    try {
      if (isEditMode) {
        await updateAccountingTransaction(transactionModal.form.id, payload);
        setFeedback({ type: "success", message: "Transacción actualizada correctamente." });
      } else {
        await createAccountingTransaction(payload);
        setFeedback({ type: "success", message: "Transacción creada correctamente." });
      }

      setTransactionModal({
        open: false,
        mode: "create",
        saving: false,
        error: "",
        form: emptyTransactionForm(),
      });
      await reloadTransactions();
      await reloadSummary();
    } catch (error) {
      setTransactionModal((current) => ({
        ...current,
        saving: false,
        error: error.message || "No fue posible guardar la transacción.",
      }));
      return;
    }
  }

  async function handleCancelTransaction(item) {
    if (!window.confirm(`¿Deseas anular la transacción #${item.id}?`)) {
      return;
    }

    try {
      await cancelAccountingTransaction(item.id, {});
      setFeedback({ type: "success", message: "Transacción anulada correctamente." });
      await reloadTransactions();
      await reloadSummary();
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "No fue posible anular la transacción." });
    }
  }

  async function handleSubmitPayable(event) {
    event.preventDefault();

    const totalAmount = parsePositiveNumber(payableModal.form.montoTotal);
    if (!totalAmount || !payableModal.form.moneda || !payableModal.form.fechaEmision) {
      setPayableModal((current) => ({
        ...current,
        error: "Monto total, moneda y fecha de emisión son obligatorios.",
      }));
      return;
    }

    const payload = {
      origen_tipo: payableModal.form.origenTipo || null,
      origen_id: payableModal.form.origenId ? Number(payableModal.form.origenId) : null,
      proveedor_tipo: payableModal.form.proveedorTipo || null,
      proveedor_id: payableModal.form.proveedorId ? Number(payableModal.form.proveedorId) : null,
      categoria_transaccion_id: payableModal.form.categoriaId
        ? Number(payableModal.form.categoriaId)
        : null,
      descripcion: payableModal.form.descripcion || null,
      moneda: payableModal.form.moneda,
      monto_total: totalAmount,
      fecha_emision: payableModal.form.fechaEmision,
      fecha_vencimiento: payableModal.form.fechaVencimiento || null,
    };

    setPayableModal((current) => ({ ...current, saving: true, error: "" }));

    try {
      if (payableModal.mode === "edit" && payableModal.form.id) {
        await updateAccountingPayable(payableModal.form.id, payload);
        setFeedback({ type: "success", message: "Cuenta por pagar actualizada correctamente." });
      } else {
        await createAccountingPayable(payload);
        setFeedback({ type: "success", message: "Cuenta por pagar creada correctamente." });
      }

      setPayableModal({
        open: false,
        mode: "create",
        saving: false,
        error: "",
        form: emptyPayableForm(),
      });
      await reloadPayables();
      await reloadSummary();
    } catch (error) {
      setPayableModal((current) => ({
        ...current,
        saving: false,
        error: error.message || "No fue posible guardar la cuenta por pagar.",
      }));
      return;
    }
  }

  async function handleCancelPayable(item) {
    if (!window.confirm(`¿Deseas anular la cuenta por pagar #${item.id}?`)) {
      return;
    }

    try {
      await cancelAccountingPayable(item.id, { estado: "ANULADA" });
      setFeedback({ type: "success", message: "Cuenta por pagar anulada correctamente." });
      await reloadPayables();
      await reloadSummary();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "No fue posible anular la cuenta por pagar.",
      });
    }
  }

  async function handleSubmitPayablePayment(event) {
    event.preventDefault();

    const amountApplied = parsePositiveNumber(payablePaymentModal.form.montoAplicado);
    const feeAmount = showPayablePaymentFeeField
      ? (parseOptionalNumber(payablePaymentModal.form.montoFee) ?? 0)
      : 0;
    const currentPayable = payablePaymentModal.payable;

    if (!currentPayable || !amountApplied || !payablePaymentModal.form.fechaPago) {
      setPayablePaymentModal((current) => ({
        ...current,
        error: "Monto aplicado y fecha de pago son obligatorios.",
      }));
      return;
    }

    if (amountApplied > Number(currentPayable.saldoPendiente || 0)) {
      setPayablePaymentModal((current) => ({
        ...current,
        error: "El pago no puede ser mayor al saldo pendiente.",
      }));
      return;
    }

    const payload = {
      monto_aplicado: amountApplied,
      monto_fee: feeAmount,
      fecha_pago: payablePaymentModal.form.fechaPago,
      categoria_transaccion_id: currentPayable.category?.id
        ? Number(currentPayable.category.id)
        : null,
      proveedor_pago_id: payablePaymentModal.form.proveedorPagoId
        ? Number(payablePaymentModal.form.proveedorPagoId)
        : null,
      descripcion: payablePaymentModal.form.descripcion || null,
      moneda: currentPayable.moneda,
    };

    setPayablePaymentModal((current) => ({ ...current, saving: true, error: "" }));

    try {
      await createAccountingPayablePayment(currentPayable.id, payload);
      setFeedback({ type: "success", message: "Pago registrado correctamente." });
      setPayablePaymentModal({
        open: false,
        saving: false,
        error: "",
        payable: null,
        form: emptyPayablePaymentForm(),
      });
      await reloadPayables();
      await reloadSummary();
    } catch (error) {
      setPayablePaymentModal((current) => ({
        ...current,
        saving: false,
        error: error.message || "No fue posible registrar el pago.",
      }));
      return;
    }
  }

  async function handleSubmitCategory(event) {
    event.preventDefault();

    if (!categoryModal.form.clave || !categoryModal.form.nombre || !categoryModal.form.tipo) {
      setCategoryModal((current) => ({
        ...current,
        error: "Clave, nombre y tipo son obligatorios.",
      }));
      return;
    }

    const payload = {
      clave: categoryModal.form.clave,
      nombre: categoryModal.form.nombre,
      tipo: categoryModal.form.tipo,
      descripcion: categoryModal.form.descripcion || null,
      categoria_padre_id: categoryModal.form.categoriaPadreId
        ? Number(categoryModal.form.categoriaPadreId)
        : null,
      activo: categoryModal.form.activo,
    };

    setCategoryModal((current) => ({ ...current, saving: true, error: "" }));

    try {
      if (categoryModal.mode === "edit" && categoryModal.form.id) {
        await updateAccountingCategory(categoryModal.form.id, payload);
        setFeedback({ type: "success", message: "Categoría actualizada correctamente." });
      } else {
        await createAccountingCategory(payload);
        setFeedback({ type: "success", message: "Categoría creada correctamente." });
      }

      setCategoryModal({
        open: false,
        mode: "create",
        saving: false,
        error: "",
        form: emptyCategoryForm(),
      });
      await reloadParameters();
    } catch (error) {
      setCategoryModal((current) => ({
        ...current,
        saving: false,
        error: error.message || "No fue posible guardar la categoría.",
      }));
      return;
    }
  }

  async function handleDeleteCategory(item) {
    if (!window.confirm(`¿Deseas desactivar la categoría ${item.nombre}?`)) {
      return;
    }

    try {
      await deleteAccountingCategory(item.id);
      setFeedback({ type: "success", message: "Categoría desactivada correctamente." });
      await reloadParameters();
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "No fue posible desactivar la categoría." });
    }
  }

  async function handleSubmitProvider(event) {
    event.preventDefault();

    if (!providerModal.form.clave || !providerModal.form.nombre || !providerModal.form.tipo) {
      setProviderModal((current) => ({
        ...current,
        error: "Clave, nombre y tipo son obligatorios.",
      }));
      return;
    }

    let parsedMetadata = null;
    if (providerModal.form.metadataPublica.trim()) {
      try {
        parsedMetadata = JSON.parse(providerModal.form.metadataPublica);
      } catch {
        setProviderModal((current) => ({
          ...current,
          error: "metadata_publica debe ser un JSON válido.",
        }));
        return;
      }
    }

    const payload = {
      clave: providerModal.form.clave,
      nombre: providerModal.form.nombre,
      tipo: providerModal.form.tipo,
      activo: providerModal.form.activo,
      metadata_publica: parsedMetadata,
    };

    setProviderModal((current) => ({ ...current, saving: true, error: "" }));

    try {
      if (providerModal.mode === "edit" && providerModal.form.id) {
        await updateAccountingPaymentProvider(providerModal.form.id, payload);
        setFeedback({ type: "success", message: "Proveedor actualizado correctamente." });
      } else {
        await createAccountingPaymentProvider(payload);
        setFeedback({ type: "success", message: "Proveedor creado correctamente." });
      }

      setProviderModal({
        open: false,
        mode: "create",
        saving: false,
        error: "",
        form: emptyProviderForm(),
      });
      await reloadParameters();
    } catch (error) {
      setProviderModal((current) => ({
        ...current,
        saving: false,
        error: error.message || "No fue posible guardar el proveedor de pago.",
      }));
      return;
    }
  }

  async function handleDeleteProvider(item) {
    if (!window.confirm(`¿Deseas desactivar el proveedor ${item.nombre}?`)) {
      return;
    }

    try {
      await deleteAccountingPaymentProvider(item.id);
      setFeedback({ type: "success", message: "Proveedor desactivado correctamente." });
      await reloadParameters();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "No fue posible desactivar el proveedor de pago.",
      });
    }
  }

  if (!canAccessModule) {
    return (
      <section className="main-content settings-page">
        <AccountingPlaceholder
          title="Contabilidad no disponible"
          description="No tienes permisos contables asignados para acceder a este módulo."
        />
      </section>
    );
  }

  return (
    <section className="main-content settings-page">
      <header className="main-header settings-header">
        <div className="settings-header-copy">
          <h1>Contabilidad</h1>
          <p>
            Panel administrativo del módulo contable, conectado a resumen,
            transacciones, cuentas por pagar y parámetros operativos.
          </p>
        </div>
      </header>

      {feedback.message ? (
        <div className={`accounting-feedback accounting-feedback-${feedback.type || "info"}`}>
          {feedback.message}
        </div>
      ) : null}

      <nav className="home-tabs settings-tabs accounting-tabs" aria-label="Tabs contables">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`home-tab-button ${activeTab === tab.id ? "home-tab-button-active" : ""}`}
            onClick={() => {
              setFeedback({ type: "", message: "" });
              setActiveTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="home-tab-panel accounting-panel">
        {activeTab === ACCOUNTING_TABS.SUMMARY ? (
          <div className="accounting-summary-layout">
            {canReadDashboard ? (
              <>
                <div className="settings-kpi-grid accounting-kpi-grid accounting-summary-concept-grid">
                  {summaryData?.resumen?.porMoneda?.length ? (
                    ACCOUNTING_SUMMARY_METRICS.map((metric) => (
                      <AccountingMetricCard key={metric.key} label={metric.label}>
                        <AccountingCurrencyValueList
                          summaries={summaryData.resumen.porMoneda}
                          metric={metric}
                        />
                      </AccountingMetricCard>
                    ))
                  ) : (
                    ACCOUNTING_SUMMARY_METRICS.map((metric) => (
                      <AccountingMetricCard
                        key={metric.key}
                        label={metric.label}
                        value={loading.summary ? "Cargando..." : "No disponible"}
                      />
                    ))
                  )}
                </div>

                {summaryError ? <p className="error-text">{summaryError}</p> : null}

                <div className="accounting-summary-grid">
                  <AccountingSection
                    title="Últimas transacciones"
                    subtitle="Movimientos recientes confirmados o completados."
                    actions={
                      canReadTransactions ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => setActiveTab(ACCOUNTING_TABS.TRANSACTIONS)}
                        >
                          Ver transacciones
                        </button>
                      ) : null
                    }
                  >
                    {summaryData?.ultimasTransacciones?.length ? (
                      <div className="accounting-mini-list">
                        {summaryData.ultimasTransacciones.map((transaction) => (
                          <article key={transaction.id} className="accounting-mini-item">
                            <div>
                              <strong>
                                  {(transaction.descripcion || `Cuenta #${transaction.id}`).length > 50
                                  ? (transaction.descripcion || `Cuenta #${transaction.id}`).slice(0, 50) + "..."
                                  : (transaction.descripcion || `Cuenta #${transaction.id}`)}
                                </strong>
                              <p>{formatDateTime(transaction.fechaTransaccion).slice(0,10)}</p>
                            </div>
                            <div className="accounting-mini-meta">
                              <AccountingBadge tone={transactionTone(transaction.tipo)}>
                                {formatAccountingLabel(transaction.tipo)}
                              </AccountingBadge>
                              <AccountingBadge tone={stateTone(transaction.estado)}>
                                {formatAccountingLabel(transaction.estado)}
                              </AccountingBadge>
                              <strong>{formatMoney(transaction.montoNeto, transaction.moneda)}</strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <AccountingEmptyState>No hay transacciones recientes disponibles.</AccountingEmptyState>
                    )}
                  </AccountingSection>

                  <AccountingSection
                    title="Próximas cuentas por vencer"
                    subtitle="Seguimiento operativo de cuentas por pagar pendientes."
                    actions={
                      canReadPayables ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => setActiveTab(ACCOUNTING_TABS.PAYABLES)}
                        >
                          Ver cuentas
                        </button>
                      ) : null
                    }
                  >
                    {summaryData?.proximasCuentasPorVencer?.length ? (
                      <div className="accounting-mini-list">
                        {summaryData.proximasCuentasPorVencer.map((payable) => (
                          <article key={payable.id} className="accounting-mini-item">
                            <div>
                              <strong>{payable.descripcion || `Cuenta #${payable.id}`}</strong>
                              <p>Vence: {formatDate(payable.fechaVencimiento)}</p>
                            </div>
                            <div className="accounting-mini-meta">
                              <AccountingBadge tone={stateTone(payable.estado)}>
                                {formatAccountingLabel(payable.estado)}
                              </AccountingBadge>
                              <strong>{formatMoney(payable.saldoPendiente, payable.moneda)}</strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <AccountingEmptyState>No hay cuentas próximas por vencer.</AccountingEmptyState>
                    )}
                  </AccountingSection>
                </div>
              </>
            ) : (
              <AccountingPlaceholder
                title="Resumen restringido"
                description="No tienes el permiso accounting:dashboard:read. Aun así, puedes usar las otras tabs contables habilitadas por tu RBAC."
              />
            )}
          </div>
        ) : null}

        {activeTab === ACCOUNTING_TABS.TRANSACTIONS ? (
          <AccountingSection
            title="Transacciones"
            subtitle="Libro administrativo de movimientos contables. No se permite eliminación física."
            actions={
              canCreateTransactions ? (
                <button type="button" className="btn btn-primary" onClick={openCreateTransactionModal}>
                  Nueva transacción
                </button>
              ) : null
            }
          >
            {!canReadTransactions ? (
              <AccountingPlaceholder
                title="Lectura no disponible"
                description="No tienes permiso para listar transacciones contables."
              />
            ) : (
              <>
                <div className="accounting-filter-grid">
                  <label className="settings-form-field full">
                    <span>Búsqueda</span>
                    <input
                      type="text"
                      value={transactionFilters.search}
                      onChange={(event) => {
                        setTransactionFilters((current) => ({ ...current, search: event.target.value }));
                        setTransactionPage((current) => ({ ...current, page: 1 }));
                      }}
                      placeholder="Descripción, referencia, categoría o proveedor"
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Tipo</span>
                    <select
                      value={transactionFilters.tipo}
                      onChange={(event) => {
                        setTransactionFilters((current) => ({ ...current, tipo: event.target.value }));
                        setTransactionPage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="">Todos</option>
                      {TRANSACTION_TYPES.map((item) => (
                        <option key={item} value={item}>{formatAccountingLabel(item)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Estado</span>
                    <select
                      value={transactionFilters.estado}
                      onChange={(event) => {
                        setTransactionFilters((current) => ({ ...current, estado: event.target.value }));
                        setTransactionPage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="">Todos</option>
                      {TRANSACTION_STATES.map((item) => (
                        <option key={item} value={item}>{formatAccountingLabel(item)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Categoría</span>
                    <select
                      value={transactionFilters.categoriaId}
                      onChange={(event) => {
                        setTransactionFilters((current) => ({ ...current, categoriaId: event.target.value }));
                        setTransactionPage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="">Todas</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {getCategoryDisplayName(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Proveedor de pago</span>
                    <select
                      value={transactionFilters.proveedorPagoId}
                      onChange={(event) => {
                        setTransactionFilters((current) => ({ ...current, proveedorPagoId: event.target.value }));
                        setTransactionPage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="">Todos</option>
                      {normalPaymentProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {getProviderDisplayName(provider)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Fecha desde</span>
                    <input
                      type="date"
                      value={transactionFilters.fechaDesde}
                      onChange={(event) => {
                        setTransactionFilters((current) => ({ ...current, fechaDesde: event.target.value }));
                        setTransactionPage((current) => ({ ...current, page: 1 }));
                      }}
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Fecha hasta</span>
                    <input
                      type="date"
                      value={transactionFilters.fechaHasta}
                      onChange={(event) => {
                        setTransactionFilters((current) => ({ ...current, fechaHasta: event.target.value }));
                        setTransactionPage((current) => ({ ...current, page: 1 }));
                      }}
                    />
                  </label>
                </div>

                <AccountingFilterActions
                  onClear={() => {
                    setTransactionFilters({
                      tipo: "",
                      estado: "",
                      categoriaId: "",
                      proveedorPagoId: "",
                      fechaDesde: "",
                      fechaHasta: "",
                      search: "",
                    });
                    setTransactionPage({ page: 1, limit: transactionPage.limit });
                  }}
                />

                {transactionsError ? <p className="error-text">{transactionsError}</p> : null}

                {loading.transactions ? (
                  <AccountingEmptyState>Cargando transacciones...</AccountingEmptyState>
                ) : transactionsData.items.length ? (
                  <>
                    <div className="accounting-table-wrapper">
                      <table className="accounting-table">
                        <thead>
                          <tr>
                            <th>Descripción</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Categoría</th>
                            <th>Proveedor</th>
                            <th>Fecha</th>
                            <th>Monto neto</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactionsData.items.map((item) => (
                            <tr key={item.id}>
                                <td>
                                <strong>
                                  {(item.descripcion || `Transacción #${item.id}`).length >30 
                                  ? (item.descripcion || `Transacción #${item.id}`).slice(0, 30) + "..."
                                  : (item.descripcion || `Transacción #${item.id}`)}
                                </strong>
                              </td>
                              
                              <td>
                                <AccountingBadge tone={transactionTone(item.tipo)}>
                                  {formatAccountingLabel(item.tipo)}
                                </AccountingBadge>
                              </td>
                              <td>
                                <AccountingBadge tone={stateTone(item.estado)}>
                                  {formatAccountingLabel(item.estado)}
                                </AccountingBadge>
                              </td>
                              <td>{getCategoryDisplayName(item.category)}</td>
                              <td>{getProviderDisplayName(item.paymentProvider)}</td>
                              <td>{formatDateTime(item.fechaTransaccion).slice(0, 10)}</td>
                              <td>{formatMoney(item.montoNeto, item.moneda)}</td>
                              <td>
                                <div className="accounting-row-actions">
                                  {canUpdateTransactions ? (
                                    <IconButton
                                      icon={Pencil}
                                      label="Editar transacción"
                                      variant="secondary"
                                      onClick={() => openEditTransactionModal(item)}
                                    />
                                  ) : null}
                                  {canCancelTransactions && isTransactionCancelable(item.estado) ? (
                                    <IconButton
                                      icon={Ban}
                                      label="Anular transacción"
                                      variant="danger"
                                      onClick={() => handleCancelTransaction(item)}
                                    />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <PaginationControls
                      page={transactionsData.pagination.page}
                      pageSize={transactionsData.pagination.limit}
                      totalItems={transactionsData.pagination.total}
                      pageSizeOptions={PAGE_SIZE_OPTIONS}
                      onPageChange={(page) => setTransactionPage((current) => ({ ...current, page }))}
                      onPageSizeChange={(limit) => setTransactionPage({ page: 1, limit })}
                    />
                  </>
                ) : (
                  <AccountingEmptyState>No hay transacciones para los filtros actuales.</AccountingEmptyState>
                )}
              </>
            )}
          </AccountingSection>
        ) : null}

        {activeTab === ACCOUNTING_TABS.PAYABLES ? (
          <AccountingSection
            title="Cuentas por pagar"
            subtitle="Seguimiento de obligaciones pendientes y registro de pagos manuales."
            actions={
              canCreatePayables ? (
                <button type="button" className="btn btn-primary" onClick={openCreatePayableModal}>
                  Nueva cuenta
                </button>
              ) : null
            }
          >
            {!canReadPayables ? (
              <AccountingPlaceholder
                title="Lectura no disponible"
                description="No tienes permiso para listar cuentas por pagar."
              />
            ) : (
              <>
                <div className="accounting-filter-grid">
                  <label className="settings-form-field full">
                    <span>Búsqueda</span>
                    <input
                      type="text"
                      value={payableFilters.search}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, search: event.target.value }));
                        setPayablePage((current) => ({ ...current, page: 1 }));
                      }}
                      placeholder="Descripción, origen o proveedor"
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Estado</span>
                    <select
                      value={payableFilters.estado}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, estado: event.target.value }));
                        setPayablePage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="">Todos</option>
                      {PAYABLE_STATES.map((item) => (
                        <option key={item} value={item}>{formatAccountingLabel(item)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Origen</span>
                    <input
                      type="text"
                      value={payableFilters.origenTipo}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, origenTipo: event.target.value }));
                        setPayablePage((current) => ({ ...current, page: 1 }));
                      }}
                      placeholder="Compra, examen, etc."
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Proveedor tipo</span>
                    <input
                      type="text"
                      value={payableFilters.proveedorTipo}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, proveedorTipo: event.target.value }));
                        setPayablePage((current) => ({ ...current, page: 1 }));
                      }}
                      placeholder="Proveedor, clínica, etc."
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Categoría</span>
                    <select
                      value={payableFilters.categoriaId}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, categoriaId: event.target.value }));
                        setPayablePage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="">Todas</option>
                      {payableCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {getCategoryDisplayName(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Moneda</span>
                    <select
                      value={payableFilters.moneda}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, moneda: event.target.value }));
                        setPayablePage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="">Todas</option>
                      {CURRENCY_OPTIONS.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Vencen desde</span>
                    <input
                      type="date"
                      value={payableFilters.vencimientoDesde}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, vencimientoDesde: event.target.value }));
                      }}
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Vencen hasta</span>
                    <input
                      type="date"
                      value={payableFilters.vencimientoHasta}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, vencimientoHasta: event.target.value }));
                      }}
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Solo vencidas</span>
                    <select
                      value={payableFilters.vencidas ? "true" : "false"}
                      onChange={(event) => {
                        setPayableFilters((current) => ({ ...current, vencidas: event.target.value === "true" }));
                        setPayablePage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="false">No</option>
                      <option value="true">Sí</option>
                    </select>
                  </label>
                </div>

                <AccountingFilterActions
                  onClear={() => {
                    setPayableFilters({
                      estado: "",
                      origenTipo: "",
                      proveedorTipo: "",
                      categoriaId: "",
                      moneda: "",
                      search: "",
                      vencidas: false,
                      vencimientoDesde: "",
                      vencimientoHasta: "",
                    });
                    setPayablePage({ page: 1, limit: payablePage.limit });
                  }}
                />

                {payableFilters.vencimientoDesde || payableFilters.vencimientoHasta ? (
                  <p className="accounting-subtle">
                    El filtro por fecha de vencimiento se aplica sobre los resultados cargados en la página actual.
                  </p>
                ) : null}

                {payablesError ? <p className="error-text">{payablesError}</p> : null}

                {loading.payables ? (
                  <AccountingEmptyState>Cargando cuentas por pagar...</AccountingEmptyState>
                ) : visiblePayables.length ? (
                  <>
                    <div className="accounting-table-wrapper">
                      <table className="accounting-table">
                        <thead>
                          <tr>
                            <th>Cuenta</th>
                            <th>Estado</th>
                            <th>Origen</th>
                            <th>Proveedor</th>
                            <th>Emisión</th>
                            <th>Vencimiento</th>
                            <th>Total</th>
                            <th>Pagado</th>
                            <th>Saldo</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visiblePayables.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <strong>
                                  {(item.descripcion || `Cuenta #${item.id}`).length > 30
                                  ? (item.descripcion || `Cuenta #${item.id}`).slice(0, 30) + "..."
                                  : (item.descripcion || `Cuenta #${item.id}`)}
                                </strong>
                              </td>
                              <td>
                                <AccountingBadge tone={stateTone(item.estado)}>
                                  {formatAccountingLabel(item.estado)}
                                </AccountingBadge>
                              </td>
                              <td>{formatSourceSummary(item.origenTipo, item.origenId)}</td>
                              <td>{formatProviderSummary(item.proveedorTipo, item.proveedorId)}</td>
                              <td>{formatDate(item.fechaEmision)}</td>
                              <td>{formatDate(item.fechaVencimiento)}</td>
                              <td>{formatMoney(item.montoTotal, item.moneda)}</td>
                              <td>{formatMoney(item.montoPagado, item.moneda)}</td>
                              <td>{formatMoney(item.saldoPendiente, item.moneda)}</td>
                              <td>
                                <div className="accounting-row-actions">
                                  {canUpdatePayables ? (
                                    <IconButton
                                      icon={Pencil}
                                      label="Editar cuenta por pagar"
                                      variant="secondary"
                                      onClick={() => openEditPayableModal(item)}
                                    />
                                  ) : null}
                                  {canPayPayables ? (
                                    <IconButton
                                      icon={HandCoins}
                                      label="Registrar pago"
                                      variant="primary"
                                      onClick={() => openPayablePaymentModal(item)}
                                      disabled={item.estado === "ANULADA" || item.estado === "CONDONADA" || item.saldoPendiente <= 0}
                                    />
                                  ) : null}
                                  {canCancelPayables ? (
                                    <IconButton
                                      icon={Ban}
                                      label="Anular cuenta por pagar"
                                      variant="danger"
                                      onClick={() => handleCancelPayable(item)}
                                      disabled={item.estado === "ANULADA" || item.estado === "CONDONADA"}
                                    />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <PaginationControls
                      page={payablesData.pagination.page}
                      pageSize={payablesData.pagination.limit}
                      totalItems={payablesData.pagination.total}
                      pageSizeOptions={PAGE_SIZE_OPTIONS}
                      onPageChange={(page) => setPayablePage((current) => ({ ...current, page }))}
                      onPageSizeChange={(limit) => setPayablePage({ page: 1, limit })}
                    />
                  </>
                ) : (
                  <AccountingEmptyState>No hay cuentas por pagar para los filtros actuales.</AccountingEmptyState>
                )}
              </>
            )}
          </AccountingSection>
        ) : null}

        {activeTab === ACCOUNTING_TABS.REPORTS ? (
        <AccountingReportsPanel
          canReadTransactions={canReadTransactions}
          canReadPayables={canReadPayables}
          canReadPublicReports={canReadPublicReports}
          canCreatePublicReports={canCreatePublicReports}
          canPublishPublicReports={canPublishPublicReports}
          canArchivePublicReports={canArchivePublicReports}
          canExportReports={canExportAccountingReports}
          categories={categories}
          paymentProviders={paymentProviders}
            suppliers={reportSuppliers}
            clinics={reportVetClinics}
            reportCatalogsLoading={reportCatalogsLoading}
            reportCatalogsError={reportCatalogsError}
          />
        ) : null}

        {activeTab === ACCOUNTING_TABS.PARAMETERS ? (
          <div className="accounting-parameter-shell">
            <nav className="home-tabs settings-tabs accounting-subtabs" aria-label="Subtabs contables">
              {parameterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`home-tab-button ${activeParameterTab === tab.id ? "home-tab-button-active" : ""}`}
                  onClick={() => setActiveParameterTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeParameterTab === PARAMETER_TABS.CATEGORIES ? (
              <AccountingSection
                title="Categorías contables"
                subtitle="CRUD basico decategoríasde ingreso, egreso y ambos."
                actions={
                  canCreateCategories ? (
                    <button type="button" className="btn btn-primary" onClick={openCreateCategoryModal}>
                      Nueva categoria
                    </button>
                  ) : null
                }
              >
                {!canReadCategories ? (
                  <AccountingPlaceholder
                    title="Sin lectura de categorias"
                    description="No tienes permiso accounting:category:read."
                  />
                ) : loading.parameters && !categories.length ? (
                  <AccountingEmptyState>Cargando categorias...</AccountingEmptyState>
                ) : categories.length ? (
                  <div className="accounting-table-wrapper">
                    <table className="accounting-table">
                      <thead>
                        <tr>
                          <th>Clave visible</th>
                          <th>Nombre</th>
                          <th>Tipo</th>
                          <th>Padre</th>
                          <th>Estado</th>
                          <th>Sistema</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((item) => (
                          <tr key={item.id}>
                            <td>{formatAccountingLabel(item.clave)}</td>
                            <td>
                              <strong>{item.nombre || formatAccountingLabel(item.clave)}</strong>
                              {item.descripcion ? <small>{item.descripcion}</small> : null}
                            </td>
                            <td>{formatAccountingLabel(item.tipo)}</td>
                            <td>{item.categoriaPadre?.nombre || "Sin padre"}</td>
                            <td>
                              <AccountingBadge tone={item.activo ? "success" : "muted"}>
                                {item.activo ? "Activa" : "Inactiva"}
                              </AccountingBadge>
                            </td>
                            <td>{item.esSistema ? "Si" : "No"}</td>
                            <td>
                              <div className="accounting-row-actions">
                                {canUpdateCategories ? (
                                  <IconButton
                                    icon={Pencil}
                                    label="Editar categoría contable"
                                    variant="secondary"
                                    onClick={() => openEditCategoryModal(item)}
                                  />
                                ) : null}
                                {canDeleteCategories ? (
                                  <IconButton
                                    icon={PowerOff}
                                    label="Desactivar categoría contable"
                                    variant="warning"
                                    onClick={() => handleDeleteCategory(item)}
                                    disabled={item.esSistema}
                                  />
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <AccountingEmptyState>No haycategoríascontables disponibles.</AccountingEmptyState>
                )}
              </AccountingSection>
            ) : null}

            {activeParameterTab === PARAMETER_TABS.PROVIDERS ? (
              <AccountingSection
                title="Proveedores de pago"
                subtitle="Listado administrativo de proveedores sin exponer secretos."
                actions={
                  canCreateProviders ? (
                    <button type="button" className="btn btn-primary" onClick={openCreateProviderModal}>
                      Nuevo proveedor
                    </button>
                  ) : null
                }
              >
                {!canReadProviders ? (
                  <AccountingPlaceholder
                    title="Sin lectura de proveedores"
                    description="No tienes permiso accounting:payment_provider:read."
                  />
                ) : loading.parameters && !paymentProviders.length ? (
                  <AccountingEmptyState>Cargando proveedores...</AccountingEmptyState>
                ) : paymentProviders.length ? (
                  <div className="accounting-table-wrapper">
                    <table className="accounting-table">
                      <thead>
                        <tr>
                          <th>Clave visible</th>
                          <th>Nombre</th>
                          <th>Tipo</th>
                          <th>Estado</th>
                          <th>Configuracion pública</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentProviders.map((item) => (
                          <tr key={item.id}>
                            <td>{formatAccountingLabel(item.clave)}</td>
                            <td>{getProviderDisplayName(item, { technical: true })}</td>
                            <td>{formatAccountingLabel(item.tipo)}</td>
                            <td>
                              <AccountingBadge tone={item.activo ? "success" : "muted"}>
                                {item.activo ? "Activo" : "Inactivo"}
                              </AccountingBadge>
                            </td>
                            <td>{formatProviderMetadataSummary(item.metadataPublica)}</td>
                            <td>
                              <div className="accounting-row-actions">
                                {canUpdateProviders ? (
                                  <IconButton
                                    icon={Pencil}
                                    label="Editar proveedor de pago"
                                    variant="secondary"
                                    onClick={() => openEditProviderModal(item)}
                                  />
                                ) : null}
                                {canDeleteProviders ? (
                                  <IconButton
                                    icon={PowerOff}
                                    label="Desactivar proveedor de pago"
                                    variant="warning"
                                    onClick={() => handleDeleteProvider(item)}
                                  />
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <AccountingEmptyState>No hay proveedores de pago disponibles.</AccountingEmptyState>
                )}
              </AccountingSection>
            ) : null}

            {activeParameterTab === PARAMETER_TABS.PAYMENT_ORDERS ? (
              <AccountingSection
                title="Órdenes de pago"
                subtitle="Lectura tecnica de ordenes emitidas por el backend actual."
                actions={
                  canReadPaymentOrders ? (
                    <button type="button" className="btn btn-secondary" onClick={reloadPaymentOrders}>
                      Actualizar
                    </button>
                  ) : null
                }
              >
                {!canReadPaymentOrders ? (
                  <AccountingPlaceholder
                    title="Órdenes de pago no disponibles"
                    description="Las ordenes de pago se gestionaran en una etapa posterior."
                  />
                ) : (
                  <>
                    <div className="accounting-filter-grid">
                      <label className="settings-form-field full">
                        <span>Búsqueda</span>
                        <input
                          type="text"
                          value={paymentOrderFilters.search}
                          onChange={(event) => {
                            setPaymentOrderFilters((current) => ({ ...current, search: event.target.value }));
                            setPaymentOrderPage((current) => ({ ...current, page: 1 }));
                          }}
                          placeholder="Proveedor, approval URL o ID de orden"
                        />
                      </label>
                      <label className="settings-form-field">
                        <span>Estado</span>
                        <select
                          value={paymentOrderFilters.estado}
                          onChange={(event) => {
                            setPaymentOrderFilters((current) => ({ ...current, estado: event.target.value }));
                            setPaymentOrderPage((current) => ({ ...current, page: 1 }));
                          }}
                        >
                          <option value="">Todos</option>
                          {PAYMENT_ORDER_STATES.map((item) => (
                            <option key={item} value={item}>{formatAccountingLabel(item)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="settings-form-field">
                        <span>Proposito</span>
                        <select
                          value={paymentOrderFilters.proposito}
                          onChange={(event) => {
                            setPaymentOrderFilters((current) => ({ ...current, proposito: event.target.value }));
                            setPaymentOrderPage((current) => ({ ...current, page: 1 }));
                          }}
                        >
                          <option value="">Todos</option>
                          {PAYMENT_ORDER_PURPOSES.map((item) => (
                            <option key={item} value={item}>{formatAccountingLabel(item)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="settings-form-field">
                        <span>Proveedor</span>
                        <select
                          value={paymentOrderFilters.proveedorPagoId}
                          onChange={(event) => {
                            setPaymentOrderFilters((current) => ({ ...current, proveedorPagoId: event.target.value }));
                            setPaymentOrderPage((current) => ({ ...current, page: 1 }));
                          }}
                        >
                          <option value="">Todos</option>
                          {paymentProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {getProviderDisplayName(provider, { technical: true })}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {paymentOrdersError ? <p className="error-text">{paymentOrdersError}</p> : null}

                    {loading.paymentOrders ? (
                      <AccountingEmptyState>Cargando ordenes de pago...</AccountingEmptyState>
                    ) : paymentOrdersData.items.length ? (
                      <>
                        <div className="accounting-table-wrapper">
                          <table className="accounting-table">
                            <thead>
                              <tr>
                                <th>Creada</th>
                                <th>Proveedor</th>
                                <th>Proposito</th>
                                <th>Estado</th>
                                <th>Monto</th>
                                
                              </tr>
                            </thead>
                            <tbody>
                              {paymentOrdersData.items.map((item) => (
                                <tr key={item.id}>
                                  <td>{formatDateTime(item.createdAt)}</td>
                                  <td>{getProviderDisplayName(item.paymentProvider, { technical: true })}</td>
                                  <td>{formatAccountingLabel(item.proposito)}</td>
                                  <td>
                                    <AccountingBadge tone={stateTone(item.estado)}>
                                      {formatAccountingLabel(item.estado)}
                                    </AccountingBadge>
                                  </td>
                                  <td>{formatMoney(item.montoBruto, item.moneda)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <PaginationControls
                          page={paymentOrdersData.pagination.page}
                          pageSize={paymentOrdersData.pagination.limit}
                          totalItems={paymentOrdersData.pagination.total}
                          pageSizeOptions={PAGE_SIZE_OPTIONS}
                          onPageChange={(page) => setPaymentOrderPage((current) => ({ ...current, page }))}
                          onPageSizeChange={(limit) => setPaymentOrderPage({ page: 1, limit })}
                        />
                      </>
                    ) : (
                      <AccountingPlaceholder
                        title="Sin órdenes de pago"
                        description="Las ordenes de pago se gestionaran en una etapa posterior."
                      />
                    )}
                  </>
                )}
              </AccountingSection>
            ) : null}

            {activeParameterTab === PARAMETER_TABS.WEBHOOKS ? (
              <AccountingSection
                title="Auditoria tecnica"
                subtitle="Listado solo lectura con payloads y headers ya sanitizados por backend."
                actions={
                  canReadWebhooks ? (
                    <button type="button" className="btn btn-secondary" onClick={reloadWebhooks}>
                      Actualizar
                    </button>
                  ) : null
                }
              >
                {!canReadWebhooks ? (
                  <AccountingPlaceholder
                    title="Webhooks no disponibles"
                    description="No tienes permiso accounting:webhook:read."
                  />
                ) : (
                  <>
                    <div className="accounting-filter-grid">
                      <label className="settings-form-field full">
                        <span>Búsqueda</span>
                        <input
                          type="text"
                          value={webhookFilters.search}
                          onChange={(event) => {
                            setWebhookFilters((current) => ({ ...current, search: event.target.value }));
                            setWebhookPage((current) => ({ ...current, page: 1 }));
                          }}
                          placeholder="Evento, error o proveedor"
                        />
                      </label>
                      <label className="settings-form-field">
                        <span>Estado</span>
                        <input
                          type="text"
                          value={webhookFilters.estado}
                          onChange={(event) => {
                            setWebhookFilters((current) => ({ ...current, estado: event.target.value }));
                            setWebhookPage((current) => ({ ...current, page: 1 }));
                          }}
                          placeholder="RECIBIDO, PROCESADO..."
                        />
                      </label>
                      <label className="settings-form-field">
                        <span>Evento</span>
                        <input
                          type="text"
                          value={webhookFilters.eventoTipo}
                          onChange={(event) => {
                            setWebhookFilters((current) => ({ ...current, eventoTipo: event.target.value }));
                            setWebhookPage((current) => ({ ...current, page: 1 }));
                          }}
                          placeholder="PAYMENT.CAPTURE..."
                        />
                      </label>
                      <label className="settings-form-field">
                        <span>Proveedor</span>
                        <select
                          value={webhookFilters.proveedorPagoId}
                          onChange={(event) => {
                            setWebhookFilters((current) => ({ ...current, proveedorPagoId: event.target.value }));
                            setWebhookPage((current) => ({ ...current, page: 1 }));
                          }}
                        >
                          <option value="">Todos</option>
                          {paymentProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {getProviderDisplayName(provider, { technical: true })}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {webhooksError ? <p className="error-text">{webhooksError}</p> : null}

                    {loading.webhooks ? (
                      <AccountingEmptyState>Cargando webhooks...</AccountingEmptyState>
                    ) : webhooksData.items.length ? (
                      <>
                        <div className="accounting-table-wrapper">
                          <table className="accounting-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Evento</th>
                                <th>Proveedor</th>
                                <th>Estado</th>
                                <th>Firma</th>
                                <th>Error</th>
                                <th>Detalle</th>
                              </tr>
                            </thead>
                            <tbody>
                              {webhooksData.items.map((item) => (
                                <Fragment key={item.id}>
                                  <tr>
                                    <td>{formatDateTime(item.recibidoEn)}</td>
                                    <td>{item.eventoTipo}</td>
                                    <td>{getProviderDisplayName(item.paymentProvider, { technical: true })}</td>
                                    <td>
                                      <AccountingBadge tone={stateTone(item.estado)}>
                                        {formatAccountingLabel(item.estado)}
                                      </AccountingBadge>
                                    </td>
                                    <td>{item.firmaVerificada ? "Verificada" : "Pendiente"}</td>
                                    <td>{item.errorMensaje || "Sin error"}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-small"
                                        onClick={() =>
                                          setExpandedWebhookId((current) => (current === String(item.id) ? "" : String(item.id)))
                                        }
                                      >
                                        {expandedWebhookId === String(item.id) ? "Ocultar" : "Ver"}
                                      </button>
                                    </td>
                                  </tr>
                                  {expandedWebhookId === String(item.id) ? (
                                    <tr>
                                      <td colSpan="7">
                                        <div className="accounting-json-grid">
                                          <JsonPreview label="Payload sanitizado" value={item.payloadSanitizado} />
                                          <JsonPreview label="Headers sanitizados" value={item.headersSanitizados} />
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <PaginationControls
                          page={webhooksData.pagination.page}
                          pageSize={webhooksData.pagination.limit}
                          totalItems={webhooksData.pagination.total}
                          pageSizeOptions={PAGE_SIZE_OPTIONS}
                          onPageChange={(page) => setWebhookPage((current) => ({ ...current, page }))}
                          onPageSizeChange={(limit) => setWebhookPage({ page: 1, limit })}
                        />
                      </>
                    ) : (
                      <AccountingEmptyState>No hay webhooks para los filtros actuales.</AccountingEmptyState>
                    )}
                  </>
                )}
              </AccountingSection>
            ) : null}

            {parameterError ? <p className="error-text">{parameterError}</p> : null}
          </div>
        ) : null}

        {activeTab === ACCOUNTING_TABS.DONATIONS && !canReadDonations ? (
          <AccountingPlaceholder
            title="Donaciones"
            description="La gestión de donaciones monetarias se habilitará con la integración PayPal en Fase 6."
          />
        ) : null}

        {activeTab === ACCOUNTING_TABS.DONATIONS && canReadDonations ? (
          <AccountingSection
            title="Donaciones monetarias"
            subtitle="Listado administrativo consolidado por orden de pago PayPal, sin duplicar refunds ni reversals."
            actions={
              <button type="button" className="btn btn-secondary" onClick={reloadDonations}>
                Actualizar
              </button>
            }
          >
            <div className="accounting-filter-grid">
              <label className="settings-form-field full">
                <span>Busqueda</span>
                <input
                  type="text"
                  value={donationFilters.search}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, search: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                  placeholder="Donante, email, PayPal order ID o capture ID"
                />
              </label>
              <label className="settings-form-field">
                <span>Estado</span>
                <select
                  value={donationFilters.status}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, status: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="">Todos</option>
                  {DONATION_VISIBLE_STATES.map((item) => (
                    <option key={item} value={item}>{formatAccountingLabel(item)}</option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field">
                <span>Tipo</span>
                <select
                  value={donationFilters.anonymous}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, anonymous: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="all">Todas</option>
                  <option value="anonymous">Anónimas</option>
                  <option value="identified">Identificadas</option>
                </select>
              </label>
              <label className="settings-form-field">
                <span>Reembolso</span>
                <select
                  value={donationFilters.refundStatus}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, refundStatus: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="">Todos</option>
                  {DONATION_REFUND_STATUSES.map((item) => (
                    <option key={item} value={item}>{formatAccountingLabel(item)}</option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field">
                <span>Proveedor</span>
                <select
                  value={donationFilters.provider}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, provider: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="">Todos</option>
                  {paymentProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {getProviderDisplayName(provider, { technical: true })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field">
                <span>Moneda</span>
                <select
                  value={donationFilters.currency}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, currency: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="">Todas</option>
                  {CURRENCY_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field">
                <span>Desde</span>
                <input
                  type="date"
                  value={donationFilters.dateFrom}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, dateFrom: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                />
              </label>
              <label className="settings-form-field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={donationFilters.dateTo}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, dateTo: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                />
              </label>
              <label className="settings-form-field">
                <span>Orden</span>
                <select
                  value={donationFilters.sortBy}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, sortBy: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  {DONATION_SORT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field">
                <span>Sentido</span>
                <select
                  value={donationFilters.sortOrder}
                  onChange={(event) => {
                    setDonationFilters((current) => ({ ...current, sortOrder: event.target.value }));
                    setDonationPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  {DONATION_SORT_ORDERS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <AccountingFilterActions
              onClear={() => {
                setDonationFilters({
                  search: "",
                  status: "",
                  anonymous: "all",
                  dateFrom: "",
                  dateTo: "",
                  provider: "",
                  currency: "",
                  refundStatus: "",
                  sortBy: "captured_at",
                  sortOrder: "desc",
                });
                setDonationPage((current) => ({ page: 1, limit: current.limit }));
              }}
            />

            {donationsData.summary.byCurrency.length ? (
              <div className="accounting-summary-grid accounting-kpi-grid">
                {donationsData.summary.byCurrency.map((item) => (
                  <Fragment key={`donation-summary-${item.moneda}`}>
                    <AccountingMetricCard
                      label={`Donaciones confirmadas ${item.moneda}`}
                      value={String(item.cantidadDonacionesConfirmadas)}
                      hint="Filtrado actual"
                    />
                    <AccountingMetricCard
                      label={`Bruto ${item.moneda}`}
                      value={formatMoney(item.montoBrutoConfirmado, item.moneda)}
                      hint="Monto capturado"
                    />
                    <AccountingMetricCard
                      label={`Fee ${item.moneda}`}
                      value={formatMoney(item.montoFeeTotal, item.moneda)}
                      hint="Comisión PayPal"
                    />
                    <AccountingMetricCard
                      label={`Neto ${item.moneda}`}
                      value={formatMoney(item.montoNetoRecibido, item.moneda)}
                      hint="Ingreso conciliado"
                    />
                    <AccountingMetricCard
                      label={`Reembolsado ${item.moneda}`}
                      value={formatMoney(item.montoTotalReembolsado, item.moneda)}
                      hint={`Anonimas: ${item.cantidadAnonimas}`}
                    />
                  </Fragment>
                ))}
              </div>
            ) : null}

            {donationsError ? <p className="error-text">{donationsError}</p> : null}

            {loading.donations ? (
              <AccountingEmptyState>Cargando donaciones monetarias...</AccountingEmptyState>
            ) : donationsData.items.length ? (
              <>
                <div className="accounting-table-wrapper">
                  <table className="accounting-table accounting-donations-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Donante</th>
                        <th className="accounting-table-number">Bruto</th>
                        <th className="accounting-table-number">Fee</th>
                        <th className="accounting-table-number">Neto</th>
                        <th>Medio de pago</th>
                        <th>Estado</th>
                        <th>Reembolso</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donationsData.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{formatDateTime(item.capturedAt || item.createdAt)}</strong>
                          </td>
                          <td>
                            {item.anonymous ? (
                              <div className="accounting-cell-stack">
                                <strong>Anonimo</strong>
                                <span>Identidad no almacenada</span>
                              </div>
                            ) : (
                              <div className="accounting-cell-stack">
                                <strong>{item.donor?.nombreCompleto || "Donante sin nombre"}</strong>
                              </div>
                            )}
                          </td>
                          <td className="accounting-table-number">{formatMoney(item.grossAmount, item.currency)}</td>
                          <td className="accounting-table-number">{formatMoney(item.feeAmount, item.currency)}</td>
                          <td className="accounting-table-number">{formatMoney(item.netAmount, item.currency)}</td>
                          <td>
                            <div className="accounting-cell-stack">
                              <strong>{getProviderDisplayName(item.paymentProvider, { technical: true })}</strong>
                            </div>
                          </td>
                          <td>
                            <div className="accounting-cell-stack">
                              <AccountingBadge tone={stateTone(item.visibleStatus)}>
                                {formatAccountingLabel(item.visibleStatus)}
                              </AccountingBadge>
                            </div>
                          </td>
                          <td>
                            <div className="accounting-cell-stack">
                              <AccountingBadge tone={refundTone(item.refundStatus)}>
                                {formatAccountingLabel(item.refundStatus)}
                              </AccountingBadge>
                              <span>{formatMoney(item.totalRefunded, item.currency)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="accounting-row-actions">
                              <IconButton
                                icon={Eye}
                                label="Ver detalle de la donación"
                                variant="secondary"
                                onClick={() => setDonationDetailModal({ open: true, donation: item })}
                              />
                              {canRefundDonations && item.refundAllowed ? (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-small"
                                  onClick={() => openDonationRefundModal(item)}
                                >
                                  Reembolsar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  page={donationsData.pagination.page}
                  pageSize={donationsData.pagination.limit}
                  totalItems={donationsData.pagination.total}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={(page) => setDonationPage((current) => ({ ...current, page }))}
                  onPageSizeChange={(limit) => setDonationPage({ page: 1, limit })}
                />
              </>
            ) : (
              <AccountingEmptyState>
                {buildDonationStats(donationFilters, { total: 0 }).some((item) => item && item !== "Sin registros")
                  ? "No se encontraron donaciones con los filtros seleccionados."
                  : "No hay donaciones registradas."}
              </AccountingEmptyState>
            )}
          </AccountingSection>
        ) : null}

      </section>
{donationDetailModal.open && donationDetailModal.donation
  ? (() => {
      const donation = donationDetailModal.donation;

      const closeDonationDetailModal = () => {
        setDonationDetailModal({
          open: false,
          donation: null,
        });
      };

      const refundHistory = donation.refund?.history || [];
      const refundAvailable = Boolean(
        donation.refundWindow?.isWithinWindow
      );

      return (
        <div
          className="accounting-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDonationDetailModal();
            }
          }}
        >
          <div
            className="accounting-modal accounting-donation-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="donation-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="accounting-donation-detail-header">
              <div>
                <h3 id="donation-detail-title">
                  Detalle de donación
                </h3>

                <span>
                  Orden #{donation.paymentOrderId}
                </span>
              </div>

              <ModalCloseButton
                className="accounting-donation-detail-close"
                onClick={closeDonationDetailModal}
                label="Cerrar detalle de donación"
                title="Cerrar detalle de donación"
              />
            </header>

            <div className="accounting-donation-detail-content">
              <section className="accounting-donation-detail-summary">
                <div>
                  <span className="accounting-donation-detail-label">
                    Monto recibido
                  </span>

                  <strong className="accounting-donation-detail-amount">
                    {formatMoney(
                      donation.netAmount,
                      donation.currency
                    )}
                  </strong>

                  <span className="accounting-donation-detail-date">
                    {formatDateTime(
                      donation.capturedAt ||
                        donation.createdAt
                    )}
                  </span>
                </div>

                <AccountingBadge
                  tone={stateTone(donation.visibleStatus)}
                >
                  {formatAccountingLabel(
                    donation.visibleStatus
                  )}
                </AccountingBadge>
              </section>

              <section className="accounting-donation-detail-section">
                <h4>Información general</h4>

                <div className="accounting-donation-detail-rows">
                  <div className="accounting-donation-detail-row">
                    <span>Donante</span>

                    <strong>
                      {donation.anonymous
                        ? "Donación anónima"
                        : donation.donor?.nombreCompleto ||
                          "Sin nombre registrado"}
                    </strong>
                  </div>

                  {!donation.anonymous ? (
                    <div className="accounting-donation-detail-row">
                      <span>Correo electrónico</span>

                      <strong>
                        {donation.donor?.email ||
                          "No registrado"}
                      </strong>
                    </div>
                  ) : null}

                  <div className="accounting-donation-detail-row">
                    <span>Medio de pago</span>

                    <strong>
                      {getProviderDisplayName(
                        donation.paymentProvider,
                        { technical: true }
                      )}
                    </strong>
                  </div>

                  <div className="accounting-donation-detail-row">
                    <span>Moneda</span>

                    <strong>
                      {donation.currency || "No disponible"}
                    </strong>
                  </div>

                  <div className="accounting-donation-detail-row">
                    <span>PayPal order ID</span>

                    <code>
                      {donation.paypalOrderId ||
                        "No disponible"}
                    </code>
                  </div>
                </div>
              </section>

              <section className="accounting-donation-detail-section">
                <div className="accounting-donation-detail-section-heading">
                  <h4>Reembolsos</h4>

                  <span>
                    {formatAccountingLabel(
                      donation.refundStatus
                    )}
                  </span>
                </div>

                <div className="accounting-donation-detail-rows">
                  <div className="accounting-donation-detail-row">
                    <span>Total reembolsado</span>

                    <strong>
                      {formatMoney(
                        donation.totalRefunded,
                        donation.currency
                      )}
                    </strong>
                  </div>

                  <div className="accounting-donation-detail-row">
                    <span>Saldo restante</span>

                    <strong>
                      {formatMoney(
                        donation.remainingAmount,
                        donation.currency
                      )}
                    </strong>
                  </div>

                  <div className="accounting-donation-detail-row">
                    <span>Disponibilidad</span>

                    <strong>
                      {refundAvailable
                        ? `Hasta ${formatDateTime(
                            donation.refundWindow
                              ?.availableUntil
                          )}`
                        : "Plazo de 48 horas finalizado"}
                    </strong>
                  </div>
                </div>
              </section>

              {refundHistory.length ? (
                <section className="accounting-donation-detail-section">
                  <h4>Historial de reembolsos</h4>

                  <div className="accounting-refund-history">
                    {refundHistory.map(
                      (historyItem, index) => (
                        <div
                          key={
                            historyItem.id ||
                            historyItem.paypalRefundId ||
                            `${historyItem.refundedAt}-${index}`
                          }
                          className="accounting-refund-history-row"
                        >
                          <div>
                            <strong>
                              {formatMoney(
                                historyItem.amount,
                                historyItem.currency ||
                                  donation.currency
                              )}
                            </strong>

                            <span>
                              {formatDateTime(
                                historyItem.refundedAt
                              )}
                            </span>
                          </div>

                          <div>
                            <span>
                              {historyItem.reason ||
                                "Sin motivo registrado"}
                            </span>

                            <code>
                              {historyItem.paypalRefundId ||
                                historyItem.referenceExternal ||
                                "Sin refund ID"}
                            </code>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            <footer className="accounting-donation-detail-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDonationDetailModal}
              >
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      );
    })()
  : null}
      <AccountingModal
        isOpen={donationRefundModal.open}
        title="Reembolsar donación"
        submitLabel="Reembolsar"
        isSaving={donationRefundModal.saving}
        submitDisabled={!donationRefundCanSubmit}
        error={donationRefundModal.error}
        onClose={() =>
          setDonationRefundModal({
            open: false,
            saving: false,
            error: "",
            donation: null,
            form: emptyDonationRefundForm(),
          })
        }
        onSubmit={handleSubmitDonationRefund}
      >
        <div className="accounting-payment-modal-body">
          {donationRefundModal.donation ? (
            <p className="accounting-modal-kicker">
              Donacion #{donationRefundModal.donation.paymentOrderId}
            </p>
          ) : null}

          <div className="accounting-payment-summary">
            <div className="accounting-readonly-card accounting-readonly-card-compact">
              <span>Donante</span>
              <strong>
                {donationRefundModal.donation?.anonymous
                  ? "Anonimo"
                  : donationRefundModal.donation?.donor?.nombreCompleto || "Donante sin nombre"}
              </strong>
            </div>
            <div className="accounting-readonly-card accounting-readonly-card-compact">
              <span>Fecha de donación</span>
              <strong>{formatDateTime(donationRefundModal.donation?.capturedAt || donationRefundModal.donation?.createdAt)}</strong>
            </div>
            <div className="accounting-readonly-card accounting-readonly-card-compact">
              <span>Monto original</span>
              <strong>{formatMoney(donationRefundModal.donation?.grossAmount, donationRefundModal.donation?.currency)}</strong>
            </div>
            <div className="accounting-readonly-card accounting-readonly-card-compact">
              <span>Total reembolsado</span>
              <strong>{formatMoney(donationRefundModal.donation?.totalRefunded, donationRefundModal.donation?.currency)}</strong>
            </div>
            <div className="accounting-readonly-card accounting-readonly-card-compact">
              <span>Saldo reembolsable</span>
              <strong>{formatMoney(donationRefundModal.donation?.remainingAmount, donationRefundModal.donation?.currency)}</strong>
            </div>
            <div className="accounting-readonly-card accounting-readonly-card-compact">
              <span>Ventana</span>
              <strong>{getRemainingHoursLabel(donationRefundModal.donation?.refundWindow?.availableUntil)}</strong>
            </div>
          </div>

          <div className="accounting-payment-grid">
            <div className="accounting-payment-column">
              <label className={`settings-form-field ${donationRefundExceedsBalance ? "accounting-field-error" : ""}`}>
                <span>Monto a reembolsar</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={donationRefundModal.form.monto}
                  onChange={(event) =>
                    setDonationRefundModal((current) => ({
                      ...current,
                      error: "",
                      form: { ...current.form, monto: event.target.value },
                    }))
                  }
                />
              </label>

              <label className="accounting-checkbox-row">
                <input
                  type="checkbox"
                  checked={donationRefundUsesFullBalance}
                  onChange={(event) =>
                    setDonationRefundModal((current) => ({
                      ...current,
                      error: "",
                      form: {
                        ...current.form,
                        monto: event.target.checked
                          ? String(current.donation?.remainingAmount || "")
                          : "",
                      },
                    }))
                  }
                />
                <span>Reembolsar saldo completo</span>
              </label>
              {!donationRefundModal.form.monto ? (
                <small>Ingrese un monto mayor a 0.</small>
              ) : null}
              {donationRefundModal.form.monto && !donationRefundHasValidAmount && !donationRefundExceedsBalance ? (
                <small className="accounting-inline-error">Ingrese un monto mayor a 0.</small>
              ) : null}
              {donationRefundExceedsBalance ? (
                <small className="accounting-inline-error">
                  El reembolso no puede ser mayor al saldo disponible.
                </small>
              ) : null}
            </div>

            <div className="accounting-payment-column">
              <label className={`settings-form-field ${!donationRefundHasReason && donationRefundModal.error ? "accounting-field-error" : ""}`}>
                <span>Motivo del reembolso</span>
                <textarea
                  rows="4"
                  value={donationRefundModal.form.motivo}
                  onChange={(event) =>
                    setDonationRefundModal((current) => ({
                      ...current,
                      error: "",
                      form: { ...current.form, motivo: event.target.value },
                    }))
                  }
                />
              </label>
              {!donationRefundHasReason ? (
                <small className="accounting-inline-error">Ingrese un motivo obligatorio.</small>
              ) : null}
              {!donationRefundModal.donation?.refundAllowed && donationRefundModal.donation?.refundBlockedReason ? (
                <small className="accounting-inline-error">{donationRefundModal.donation.refundBlockedReason}</small>
              ) : null}
            </div>
          </div>
        </div>
      </AccountingModal>

      <AccountingModal
        isOpen={transactionModal.open}
        title={transactionModal.mode === "edit" ? "Editar transacción" : "Nueva transacción manual"}
        submitLabel={transactionModal.mode === "edit" ? "Guardar cambios" : "Crear transacción"}
        isSaving={transactionModal.saving}
        error={transactionModal.error}
        onClose={() =>
          setTransactionModal({
            open: false,
            mode: "create",
            saving: false,
            error: "",
            form: emptyTransactionForm(),
          })
        }
        onSubmit={handleSubmitTransaction}
      >
        <div className="settings-form-grid">
          <label className={`settings-form-field ${transactionModal.mode === "edit" ? "accounting-field-disabled" : ""}`}>
            <span>Tipo</span>
            <select
              value={transactionModal.form.tipo}
              disabled={transactionModal.mode === "edit"}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, tipo: event.target.value },
                }))
              }
            >
              {TRANSACTION_TYPES.map((item) => (
                <option key={item} value={item}>{formatAccountingLabel(item)}</option>
              ))}
            </select>
            {transactionModal.mode === "edit" ? (
              <small>Este campo no puede modificarse después de crear la transacción.</small>
            ) : null}
          </label>
          <label className={`settings-form-field ${transactionModal.mode === "edit" ? "accounting-field-disabled" : ""}`}>
            <span>Categoría</span>
            <select
              value={transactionModal.form.categoriaId}
              disabled={transactionModal.mode === "edit"}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, categoriaId: event.target.value },
                }))
              }
            >
              <option value="">Sin categoría</option>
              {categories.filter((item) => item.activo).map((item) => (
                <option key={item.id} value={item.id}>
                  {getCategoryDisplayName(item)}
                </option>
              ))}
            </select>
            {transactionModal.mode === "edit" ? (
              <small>Este campo no puede modificarse después de crear la transacción.</small>
            ) : null}
          </label>
          <label className="settings-form-field">
            <span>Proveedor de pago</span>
            <select
              value={transactionModal.form.proveedorPagoId}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, proveedorPagoId: event.target.value },
                }))
              }
            >
              <option value="">Sin proveedor</option>
              {getSelectableNormalProviders(transactionModal.form.proveedorPagoId).map((item) => (
                <option key={item.id} value={item.id}>{getProviderDisplayName(item)}</option>
              ))}
            </select>
          </label>
          <label className={`settings-form-field ${transactionModal.mode === "edit" ? "accounting-field-disabled" : ""}`}>
            <span>Moneda</span>
            <select
              value={transactionModal.form.moneda}
              disabled={transactionModal.mode === "edit"}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, moneda: event.target.value },
                }))
              }
            >
              {CURRENCY_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {transactionModal.mode === "edit" ? (
              <small>Este campo no puede modificarse después de crear la transacción.</small>
            ) : null}
          </label>
          <label className={`settings-form-field ${transactionModal.mode === "edit" ? "accounting-field-disabled" : ""}`}>
            <span>Monto bruto</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={transactionModal.form.montoBruto}
              readOnly={transactionModal.mode === "edit"}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, montoBruto: event.target.value },
                }))
              }
            />
            {transactionModal.mode === "edit" ? (
              <small>Este campo no puede modificarse después de crear la transacción.</small>
            ) : null}
          </label>
          <label className={`settings-form-field ${transactionModal.mode === "edit" ? "accounting-field-disabled" : ""}`}>
            <span>Monto fee</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={transactionModal.form.montoFee}
              readOnly={transactionModal.mode === "edit"}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, montoFee: event.target.value },
                }))
              }
            />
            {transactionModal.mode === "edit" ? (
              <small>Este campo no puede modificarse después de crear la transacción.</small>
            ) : null}
          </label>
          <label className="settings-form-field">
            <span>Fecha transacción</span>
            <input
              type="date"
              value={transactionModal.form.fechaTransaccion}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, fechaTransaccion: event.target.value },
                }))
              }
            />
          </label>
          <label className="settings-form-field full">
            <span>Descripción</span>
            <textarea
              rows="3"
              value={transactionModal.form.descripcion}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, descripcion: event.target.value },
                }))
              }
            />
          </label>
          <label className="settings-form-field full">
            <span>Referencia externa / N° operación</span>
            <input
              type="text"
              value={transactionModal.form.referenciaExterna}
              onChange={(event) =>
                setTransactionModal((current) => ({
                  ...current,
                  form: { ...current.form, referenciaExterna: event.target.value },
                }))
              }
            />
            <small>
              Opcional. Puede ser el número de operación bancaria, identificador PayPal,
              folio externo o referencia del proveedor.
            </small>
          </label>
        </div>
      </AccountingModal>

      <AccountingModal
        isOpen={payableModal.open}
        title={payableModal.mode === "edit" ? "Editar cuenta por pagar" : "Nueva cuenta por pagar"}
        submitLabel={payableModal.mode === "edit" ? "Guardar cambios" : "Crear cuenta"}
        isSaving={payableModal.saving}
        error={payableModal.error}
        onClose={() =>
          setPayableModal({
            open: false,
            mode: "create",
            saving: false,
            error: "",
            form: emptyPayableForm(),
          })
        }
        onSubmit={handleSubmitPayable}
      >
        <div className="settings-form-grid">
          {payableModal.mode === "edit" && (payableModal.form.origenTipo || payableModal.form.proveedorTipo) ? (
            <div className="accounting-readonly-grid full">
              {payableModal.form.origenTipo ? (
                <div className="accounting-readonly-card">
                  <span>Origen asociado</span>
                  <strong>{formatSourceSummary(payableModal.form.origenTipo, payableModal.form.origenId)}</strong>
                </div>
              ) : null}
              {payableModal.form.proveedorTipo ? (
                <div className="accounting-readonly-card">
                  <span>Proveedor / beneficiario</span>
                  <strong>{formatProviderSummary(payableModal.form.proveedorTipo, payableModal.form.proveedorId)}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="settings-form-field">
            <span>Categoria</span>
            <select
              value={payableModal.form.categoriaId}
              onChange={(event) =>
                setPayableModal((current) => ({
                  ...current,
                  form: { ...current.form, categoriaId: event.target.value },
                }))
              }
            >
              <option value="">Sin categoria</option>
              {payableCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {getCategoryDisplayName(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Moneda</span>
            <select
              value={payableModal.form.moneda}
              onChange={(event) =>
                setPayableModal((current) => ({
                  ...current,
                  form: { ...current.form, moneda: event.target.value },
                }))
              }
            >
              {CURRENCY_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Monto total</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={payableModal.form.montoTotal}
              onChange={(event) =>
                setPayableModal((current) => ({
                  ...current,
                  form: { ...current.form, montoTotal: event.target.value },
                }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha emisión</span>
            <input
              type="date"
              value={payableModal.form.fechaEmision}
              onChange={(event) =>
                setPayableModal((current) => ({
                  ...current,
                  form: { ...current.form, fechaEmision: event.target.value },
                }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha vencimiento</span>
            <input
              type="date"
              value={payableModal.form.fechaVencimiento}
              onChange={(event) =>
                setPayableModal((current) => ({
                  ...current,
                  form: { ...current.form, fechaVencimiento: event.target.value },
                }))
              }
            />
          </label>
          <label className="settings-form-field full">
            <span>Concepto o descripción</span>
            <textarea
              rows="3"
              value={payableModal.form.descripcion}
              onChange={(event) =>
                setPayableModal((current) => ({
                  ...current,
                  form: { ...current.form, descripcion: event.target.value },
                }))
              }
            />
            <small>
              Usa este campo para describir el concepto de la cuenta o una observación financiera breve.
            </small>
          </label>
        </div>
      </AccountingModal>

      <AccountingModal
        isOpen={payablePaymentModal.open}
        title="Registrar pago"
        submitLabel="Registrar pago"
        isSaving={payablePaymentModal.saving}
        submitDisabled={!payablePaymentHasValidAmount}
        error={payablePaymentModal.error}
        onClose={() =>
          setPayablePaymentModal({
            open: false,
            saving: false,
            error: "",
            payable: null,
            form: emptyPayablePaymentForm(),
          })
        }
        onSubmit={handleSubmitPayablePayment}
      >
        <div className="accounting-payment-modal-body">
          {payablePaymentModal.payable ? (
            <p className="accounting-modal-kicker">
              Cuenta por pagar #{payablePaymentModal.payable.id}
            </p>
          ) : null}

          <div className="accounting-payment-summary">
            {payablePaymentModal.payable?.category ? (
              <div className="accounting-readonly-card accounting-readonly-card-compact">
                <span>Categoría heredada</span>
                <strong>{getCategoryDisplayName(payablePaymentModal.payable.category)}</strong>
              </div>
            ) : null}
            {payablePaymentModal.payable ? (
              <div className="accounting-readonly-card accounting-readonly-card-compact">
                <span>Saldo pendiente</span>
                <strong>
                  {formatMoney(
                    payablePaymentModal.payable.saldoPendiente,
                    payablePaymentModal.payable.moneda,
                  )}
                </strong>
              </div>
            ) : null}
          </div>

          <div className="accounting-payment-grid">
            <div className="accounting-payment-column">
              <label className={`settings-form-field ${payablePaymentExceedsBalance ? "accounting-field-error" : ""}`}>
                <span>Monto aplicado</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payablePaymentModal.form.montoAplicado}
                  onChange={(event) =>
                    setPayablePaymentModal((current) => ({
                      ...current,
                      error: "",
                      form: { ...current.form, montoAplicado: event.target.value },
                    }))
                  }
                />
              </label>

              <label className="accounting-checkbox-row">
                <input
                  type="checkbox"
                  checked={payablePaymentUsesFullBalance}
                  onChange={(event) =>
                    setPayablePaymentModal((current) => ({
                      ...current,
                      error: "",
                      form: {
                        ...current.form,
                        montoAplicado: event.target.checked
                          ? String(current.payable?.saldoPendiente || "")
                          : "",
                      },
                    }))
                  }
                />
                <span>Usar saldo completo</span>
              </label>
              {!payablePaymentModal.form.montoAplicado ? (
                <small>Ingrese un monto mayor a 0.</small>
              ) : null}
              {payablePaymentModal.form.montoAplicado && !payablePaymentHasValidAmount && !payablePaymentExceedsBalance ? (
                <small className="accounting-inline-error">
                  Ingrese un monto mayor a 0.
                </small>
              ) : null}
              {payablePaymentExceedsBalance ? (
                <small className="accounting-inline-error">
                  El pago no puede ser mayor al saldo pendiente.
                </small>
              ) : null}
            </div>

            <div className="accounting-payment-column">
              <label className="settings-form-field">
                <span>Fecha de pago</span>
                <input
                  type="date"
                  value={payablePaymentModal.form.fechaPago}
                  onChange={(event) =>
                    setPayablePaymentModal((current) => ({
                      ...current,
                      error: "",
                      form: { ...current.form, fechaPago: event.target.value },
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field">
              <span>Proveedor de pago</span>
              <select
                value={payablePaymentModal.form.proveedorPagoId}
                onChange={(event) =>
                  setPayablePaymentModal((current) => ({
                    ...current,
                    error: "",
                    form: {
                      ...current.form,
                      proveedorPagoId: event.target.value,
                      montoFee: providerSupportsFees(
                        paymentProviders.find((item) => String(item.id) === String(event.target.value)),
                      )
                        ? current.form.montoFee
                        : "0",
                    },
                  }))
                }
              >
                <option value="">Sin proveedor</option>
                {getSelectableNormalProviders(payablePaymentModal.form.proveedorPagoId).map((item) => (
                  <option key={item.id} value={item.id}>{getProviderDisplayName(item)}</option>
                ))}
              </select>
            </label>
            {showPayablePaymentFeeField ? (
              <label className="settings-form-field">
                <span>Monto fee</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payablePaymentModal.form.montoFee}
                  onChange={(event) =>
                    setPayablePaymentModal((current) => ({
                      ...current,
                      form: { ...current.form, montoFee: event.target.value },
                    }))
                  }
                />
                <small>Solo visible para proveedores con comisión configurable.</small>
              </label>
            ) : null}
            <label className="settings-form-field full">
              <span>Descripción</span>
              <textarea
                rows="3"
                value={payablePaymentModal.form.descripcion}
                onChange={(event) =>
                  setPayablePaymentModal((current) => ({
                    ...current,
                    form: { ...current.form, descripcion: event.target.value },
                  }))
                }
              />
            </label>
          </div>
        </div>
      </AccountingModal>

      <AccountingModal
        isOpen={categoryModal.open}
        title={categoryModal.mode === "edit" ? "Editar categoría" : "Nueva categoría"}
        submitLabel={categoryModal.mode === "edit" ? "Guardar cambios" : "Crear categoría"}
        isSaving={categoryModal.saving}
        error={categoryModal.error}
        onClose={() =>
          setCategoryModal({
            open: false,
            mode: "create",
            saving: false,
            error: "",
            form: emptyCategoryForm(),
          })
        }
        onSubmit={handleSubmitCategory}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Clave</span>
            <input
              type="text"
              value={categoryModal.form.clave}
              onChange={(event) =>
                setCategoryModal((current) => ({
                  ...current,
                  form: { ...current.form, clave: event.target.value.toUpperCase() },
                }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Nombre</span>
            <input
              type="text"
              value={categoryModal.form.nombre}
              onChange={(event) =>
                setCategoryModal((current) => ({
                  ...current,
                  form: { ...current.form, nombre: event.target.value },
                }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Tipo</span>
            <select
              value={categoryModal.form.tipo}
              onChange={(event) =>
                setCategoryModal((current) => ({
                  ...current,
                  form: { ...current.form, tipo: event.target.value },
                }))
              }
            >
              {CATEGORY_TYPES.map((item) => (
                <option key={item} value={item}>{formatAccountingLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Activo</span>
            <select
              value={categoryModal.form.activo ? "true" : "false"}
              onChange={(event) =>
                setCategoryModal((current) => ({
                  ...current,
                  form: { ...current.form, activo: event.target.value === "true" },
                }))
              }
            >
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="settings-form-field full">
            <span>Descripción</span>
            <textarea
              rows="3"
              value={categoryModal.form.descripcion}
              onChange={(event) =>
                setCategoryModal((current) => ({
                  ...current,
                  form: { ...current.form, descripcion: event.target.value },
                }))
              }
            />
          </label>
          <details className="accounting-advanced-panel full">
            <summary>Opciones avanzadas</summary>
            <div className="settings-form-grid">
              <label className="settings-form-field">
                <span>Categoría padre</span>
                <select
                  value={categoryModal.form.categoriaPadreId}
                  onChange={(event) =>
                    setCategoryModal((current) => ({
                      ...current,
                      form: { ...current.form, categoriaPadreId: event.target.value },
                    }))
                  }
                >
                  <option value="">Sin padre</option>
                  {categories
                    .filter((item) => item.id !== categoryModal.form.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {getCategoryDisplayName(item)}
                      </option>
                    ))}
                </select>
                <small>Solo usar si necesitas agrupar categorías en reportes futuros.</small>
              </label>
            </div>
          </details>
        </div>
      </AccountingModal>

      <AccountingModal
        isOpen={providerModal.open}
        title={providerModal.mode === "edit" ? "Editar proveedor" : "Nuevo proveedor"}
        submitLabel={providerModal.mode === "edit" ? "Guardar cambios" : "Crear proveedor"}
        isSaving={providerModal.saving}
        error={providerModal.error}
        onClose={() =>
          setProviderModal({
            open: false,
            mode: "create",
            saving: false,
            error: "",
            form: emptyProviderForm(),
          })
        }
        onSubmit={handleSubmitProvider}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Clave</span>
            <input
              type="text"
              value={providerModal.form.clave}
              onChange={(event) =>
                setProviderModal((current) => ({
                  ...current,
                  form: { ...current.form, clave: event.target.value.toUpperCase() },
                }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Nombre</span>
            <input
              type="text"
              value={providerModal.form.nombre}
              onChange={(event) =>
                setProviderModal((current) => ({
                  ...current,
                  form: { ...current.form, nombre: event.target.value },
                }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Tipo</span>
            <select
              value={providerModal.form.tipo}
              onChange={(event) =>
                setProviderModal((current) => ({
                  ...current,
                  form: { ...current.form, tipo: event.target.value },
                }))
              }
            >
              {PROVIDER_TYPES.map((item) => (
                <option key={item} value={item}>{formatAccountingLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Activo</span>
            <select
              value={providerModal.form.activo ? "true" : "false"}
              onChange={(event) =>
                setProviderModal((current) => ({
                  ...current,
                  form: { ...current.form, activo: event.target.value === "true" },
                }))
              }
            >
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
          <details className="accounting-advanced-panel full">
            <summary>Configuración técnica pública</summary>
            <div className="settings-form-grid">
              <label className="settings-form-field full">
                <span>Metadata pública (JSON)</span>
                <textarea
                  rows="6"
                  value={providerModal.form.metadataPublica}
                  onChange={(event) =>
                    setProviderModal((current) => ({
                      ...current,
                      form: { ...current.form, metadataPublica: event.target.value },
                    }))
                  }
                  placeholder='{"supportsFees":true,"canal":"manual"}'
                />
                <small>No ingreses secretos, tokens, passwords, client_secret ni api_key.</small>
              </label>
            </div>
          </details>
        </div>
      </AccountingModal>
    </section>
  );
}
