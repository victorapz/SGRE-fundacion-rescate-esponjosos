import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Ban,
  Eye,
  HandCoins,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
} from "lucide-react";
import FilterSummaryBar from "../components/FilterSummaryBar";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import PaginationControls from "../components/PaginationControls";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import {
  cancelAdminSubscription,
  createAdminManualSponsorship,
  createAdminManualSubscriptionPayment,
  createAdminSponsor,
  createAdminSponsorshipPlan,
  deleteAdminSponsorshipPlan,
  getAdminSponsorship,
  getAdminSponsorshipAnimals,
  getAdminSponsorshipPlans,
  getAdminSponsorships,
  getAdminSponsor,
  getAdminSponsors,
  getAdminSubscriptionPayment,
  getAdminSubscriptionPayments,
  provisionAdminSponsorshipPlan,
  syncAdminSubscription,
  updateAdminSponsor,
  updateAdminSponsorshipAnimal,
  updateAdminSponsorshipPlan,
} from "../services/sponsorship-admin.service";
import { addOneCalendarMonthFromDateInput, formatSponsorshipMoney } from "../utils/sponsorship-admin";
import "../styles/home.page.css";
import "../styles/settings.page.css";
import "../styles/sponsorship.page.css";

const TABS = {
  SPONSORSHIPS: "sponsorships",
  SPONSORS: "sponsors",
  PAYMENTS: "payments",
  SETTINGS: "settings",
};

const SETTINGS_TABS = {
  PLANS: "plans",
  ANIMALS: "animals",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const MANUAL_PAYMENT_METHODS = ["TRANSFERENCIA", "EFECTIVO", "DEPOSITO", "OTRO"];
const SPONSORSHIP_STATES = ["ACTIVO", "PENDIENTE_APROBACION", "SUSPENDIDO", "CANCELADO", "FALLIDO"];
const PAYMENT_STATES = ["COMPLETADO", "FALLIDO", "REEMBOLSADO", "REVERSADO"];

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function buildErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value) {
  if (!value) return "No disponible";

  try {
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(value));
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

function formatLabel(value) {
  if (!value) return "No disponible";

  const labels = {
    ACTIVO: "Activo",
    PENDIENTE_APROBACION: "Pendiente",
    SUSPENDIDO: "Suspendido",
    CANCELADO: "Cancelado",
    FALLIDO: "Fallido",
    COMPLETADO: "Completado",
    REEMBOLSADO: "Reembolsado",
    REVERSADO: "Reversado",
    MANUAL: "Manual",
    PAYPAL: "PayPal",
    MONTH: "Mensual",
    TRANSFERENCIA: "Transferencia",
    EFECTIVO: "Efectivo",
    DEPOSITO: "Deposito",
    OTRO: "Otro",
  };

  if (labels[value]) return labels[value];
  const cleaned = String(value).replace(/[_-]+/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function statusTone(value) {
  switch (value) {
    case "ACTIVO":
    case "COMPLETADO":
      return "success";
    case "PENDIENTE_APROBACION":
      return "warning";
    case "SUSPENDIDO":
      return "warning";
    case "CANCELADO":
    case "FALLIDO":
    case "REEMBOLSADO":
    case "REVERSADO":
      return "danger";
    default:
      return "neutral";
  }
}

function normalizePositiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
}

function emptySponsorForm() {
  return {
    id: "",
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    consentimientoDatos: false,
    activo: true,
  };
}

function emptyManualSponsorshipForm() {
  return {
    sponsorId: "",
    animalId: "",
    planId: "",
    fechaInicio: todayValue(),
    proximoCobro: todayValue(),
    metodoEsperado: "TRANSFERENCIA",
    observacion: "",
  };
}

function emptyManualPaymentForm() {
  return {
    subscriptionId: "",
    sponsorshipId: "",
    fechaPago: todayValue(),
    monto: "",
    moneda: "",
    metodo: "TRANSFERENCIA",
    referencia: "",
    observacion: "",
    proximoCobro: addOneCalendarMonthFromDateInput(todayValue()),
  };
}

function emptyPlanForm() {
  return {
    id: "",
    nombre: "",
    descripcion: "",
    modalidad: "PAYPAL",
    monto: "",
    orden: 0,
    activo: true,
  };
}

function emptyCancellationForm() {
  return {
    subscriptionId: "",
    sponsorshipId: "",
    motivo: "",
    sponsorshipLabel: "",
  };
}

function StatusBadge({ children, tone = "neutral" }) {
  return <span className={`sponsorship-admin-badge sponsorship-admin-badge-${tone}`}>{children}</span>;
}

function ModuleCard({ title, subtitle, actions, children }) {
  return (
    <section className="crud-card sponsorship-admin-card">
      <div className="crud-header sponsorship-admin-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="sponsorship-admin-subtle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="sponsorship-admin-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ModuleModal({
  isOpen,
  title,
  submitLabel,
  onClose,
  onSubmit,
  isSaving,
  submitDisabled = false,
  error,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay sponsorship-admin-modal-overlay" onClick={onClose} role="presentation">
      <div className="event-modal sponsorship-admin-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="event-modal-header">
          <h3>{title}</h3>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form className="sponsorship-admin-form" onSubmit={onSubmit}>
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

function DetailRow({ label, value }) {
  return (
    <div className="sponsorship-admin-detail-row">
      <span>{label}</span>
      <strong>{value || "No disponible"}</strong>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="settings-filter-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function SponsorshipPage() {
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canReadSponsors = hasPermission(PERMISSIONS.ACCOUNTING.SPONSOR_READ);
  const canCreateSponsors = hasPermission(PERMISSIONS.ACCOUNTING.SPONSOR_CREATE);
  const canUpdateSponsors = hasPermission(PERMISSIONS.ACCOUNTING.SPONSOR_UPDATE);
  const canReadSponsorships = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_READ);
  const canCreateSponsorships = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_CREATE);
  const canCancelSponsorships = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_CANCEL)
    && hasPermission(PERMISSIONS.ACCOUNTING.SUBSCRIPTION_CANCEL);
  const canReadPayments = hasPermission(PERMISSIONS.ACCOUNTING.SUBSCRIPTION_PAYMENT_READ);
  const canCreatePayments = hasPermission(PERMISSIONS.ACCOUNTING.SUBSCRIPTION_PAYMENT_CREATE);
  const canReadPlans = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_PLAN_READ);
  const canCreatePlans = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_PLAN_CREATE);
  const canUpdatePlans = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_PLAN_UPDATE);
  const canDeletePlans = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_PLAN_DELETE);
  const canSyncSubscriptions = hasPermission(PERMISSIONS.ACCOUNTING.SUBSCRIPTION_SYNC);
  const canUpdateAnimals = hasPermission(PERMISSIONS.ACCOUNTING.SPONSORSHIP_UPDATE);

  const hasModuleAccess = hasAnyPermission([
    PERMISSIONS.ACCOUNTING.SPONSOR_READ,
    PERMISSIONS.ACCOUNTING.SPONSORSHIP_READ,
    PERMISSIONS.ACCOUNTING.SUBSCRIPTION_PAYMENT_READ,
    PERMISSIONS.ACCOUNTING.SPONSORSHIP_PLAN_READ,
  ]);

  const [activeTab, setActiveTab] = useState(TABS.SPONSORSHIPS);
  const [activeSettingsTab, setActiveSettingsTab] = useState(SETTINGS_TABS.PLANS);
  const [isSaving, setIsSaving] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const [sponsorsData, setSponsorsData] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [sponsorsLoading, setSponsorsLoading] = useState(false);
  const [sponsorsError, setSponsorsError] = useState("");
  const [sponsorFilters, setSponsorFilters] = useState({ search: "", activo: "", hasActive: "" });
  const [sponsorPage, setSponsorPage] = useState({ page: 1, limit: 10 });

  const [sponsorshipsData, setSponsorshipsData] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [sponsorshipsLoading, setSponsorshipsLoading] = useState(false);
  const [sponsorshipsError, setSponsorshipsError] = useState("");
  const [sponsorshipFilters, setSponsorshipFilters] = useState({ search: "", estado: "", planId: "" });
  const [sponsorshipPage, setSponsorshipPage] = useState({ page: 1, limit: 10 });

  const [paymentsData, setPaymentsData] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentFilters, setPaymentFilters] = useState({
    search: "",
    estado: "",
    sponsorId: "",
    animalId: "",
    planId: "",
    conTransaccion: "",
    fechaDesde: "",
    fechaHasta: "",
  });
  const [paymentPage, setPaymentPage] = useState({ page: 1, limit: 10 });

  const [plansData, setPlansData] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [planFilters, setPlanFilters] = useState({ search: "", activo: "" });
  const [planPage, setPlanPage] = useState({ page: 1, limit: 10 });

  const [animalsData, setAnimalsData] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [animalsLoading, setAnimalsLoading] = useState(false);
  const [animalsError, setAnimalsError] = useState("");
  const [animalFilters, setAnimalFilters] = useState({ search: "", apadrinable: "" });
  const [animalPage, setAnimalPage] = useState({ page: 1, limit: 10 });

  const [referenceSponsors, setReferenceSponsors] = useState([]);
  const [referencePlans, setReferencePlans] = useState([]);
  const [referenceAnimals, setReferenceAnimals] = useState([]);
  const [manualSponsorshipOptions, setManualSponsorshipOptions] = useState([]);

  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const [sponsorModalMode, setSponsorModalMode] = useState("create");
  const [sponsorForm, setSponsorForm] = useState(emptySponsorForm());
  const [sponsorFormError, setSponsorFormError] = useState("");
  const [selectedSponsor, setSelectedSponsor] = useState(null);

  const [isSponsorshipModalOpen, setIsSponsorshipModalOpen] = useState(false);
  const [sponsorshipForm, setSponsorshipForm] = useState(emptyManualSponsorshipForm());
  const [sponsorshipFormError, setSponsorshipFormError] = useState("");
  const [selectedSponsorship, setSelectedSponsorship] = useState(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyManualPaymentForm());
  const [paymentFormError, setPaymentFormError] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planModalMode, setPlanModalMode] = useState("create");
  const [planForm, setPlanForm] = useState(emptyPlanForm());
  const [planFormError, setPlanFormError] = useState("");

  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [cancellationForm, setCancellationForm] = useState(emptyCancellationForm());
  const [cancellationError, setCancellationError] = useState("");

  const refreshReferences = useCallback(async () => {
    try {
      const [sponsorsResponse, plansResponse, animalsResponse, sponsorshipsResponse] = await Promise.all([
        canReadSponsors ? getAdminSponsors({ page: 1, limit: 100 }) : Promise.resolve({ items: [], pagination: {} }),
        canReadPlans ? getAdminSponsorshipPlans({ page: 1, limit: 100 }) : Promise.resolve({ items: [], pagination: {} }),
        canUpdateAnimals || canReadSponsorships
          ? getAdminSponsorshipAnimals({ page: 1, limit: 100, apadrinable: true })
          : Promise.resolve({ items: [], pagination: {} }),
        canReadSponsorships
          ? getAdminSponsorships({ page: 1, limit: 100, estado: "ACTIVO" })
          : Promise.resolve({ items: [], pagination: {} }),
      ]);

      setReferenceSponsors(sponsorsResponse.items || []);
      setReferencePlans(plansResponse.items || []);
      setReferenceAnimals(animalsResponse.items || []);
      setManualSponsorshipOptions(
        (sponsorshipsResponse.items || []).filter(
          (item) =>
            item.modalidad === "MANUAL"
            && item.estado === "ACTIVO"
            && item.subscription?.id
            && item.subscription?.paymentProvider?.clave === "MANUAL"
            && item.sponsor?.id
            && item.sponsor?.nombreCompleto,
        ),
      );
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudieron cargar las referencias del módulo."));
    }
  }, [canReadPlans, canReadSponsors, canReadSponsorships, canUpdateAnimals]);

  const loadSponsors = useCallback(async () => {
    if (!canReadSponsors) return;
    setSponsorsLoading(true);
    setSponsorsError("");

    try {
      const response = await getAdminSponsors({
        page: sponsorPage.page,
        limit: sponsorPage.limit,
        search: sponsorFilters.search || undefined,
        activo: sponsorFilters.activo === "" ? undefined : sponsorFilters.activo === "true",
        has_active_sponsorship:
          sponsorFilters.hasActive === "" ? undefined : sponsorFilters.hasActive === "true",
      });
      setSponsorsData(response);
    } catch (error) {
      setSponsorsError(buildErrorMessage(error, "No se pudieron cargar los padrinos."));
    } finally {
      setSponsorsLoading(false);
    }
  }, [canReadSponsors, sponsorFilters, sponsorPage]);

  const loadSponsorships = useCallback(async () => {
    if (!canReadSponsorships) return;
    setSponsorshipsLoading(true);
    setSponsorshipsError("");

    try {
      const response = await getAdminSponsorships({
        page: sponsorshipPage.page,
        limit: sponsorshipPage.limit,
        search: sponsorshipFilters.search || undefined,
        estado: sponsorshipFilters.estado || undefined,
        plan_id: sponsorshipFilters.planId || undefined,
      });
      setSponsorshipsData(response);
    } catch (error) {
      setSponsorshipsError(buildErrorMessage(error, "No se pudieron cargar los apadrinamientos."));
    } finally {
      setSponsorshipsLoading(false);
    }
  }, [canReadSponsorships, sponsorshipFilters, sponsorshipPage]);

  const loadPayments = useCallback(async () => {
    if (!canReadPayments) return;
    setPaymentsLoading(true);
    setPaymentsError("");

    try {
      const response = await getAdminSubscriptionPayments({
        page: paymentPage.page,
        limit: paymentPage.limit,
        search: paymentFilters.search || undefined,
        estado: paymentFilters.estado || undefined,
        sponsor_id: paymentFilters.sponsorId || undefined,
        animal_id: paymentFilters.animalId || undefined,
        plan_id: paymentFilters.planId || undefined,
        con_transaccion:
          paymentFilters.conTransaccion === "" ? undefined : paymentFilters.conTransaccion === "true",
        fecha_desde: paymentFilters.fechaDesde || undefined,
        fecha_hasta: paymentFilters.fechaHasta || undefined,
      });
      setPaymentsData(response);
    } catch (error) {
      setPaymentsError(buildErrorMessage(error, "No se pudieron cargar los pagos."));
    } finally {
      setPaymentsLoading(false);
    }
  }, [canReadPayments, paymentFilters, paymentPage]);

  const loadPlans = useCallback(async () => {
    if (!canReadPlans) return;
    setPlansLoading(true);
    setPlansError("");

    try {
      const response = await getAdminSponsorshipPlans({
        page: planPage.page,
        limit: planPage.limit,
        search: planFilters.search || undefined,
        activo: planFilters.activo === "" ? undefined : planFilters.activo === "true",
      });
      setPlansData(response);
    } catch (error) {
      setPlansError(buildErrorMessage(error, "No se pudieron cargar los planes."));
    } finally {
      setPlansLoading(false);
    }
  }, [canReadPlans, planFilters, planPage]);

  const loadAnimals = useCallback(async () => {
    if (!canReadSponsorships && !canUpdateAnimals) return;
    setAnimalsLoading(true);
    setAnimalsError("");

    try {
      const response = await getAdminSponsorshipAnimals({
        page: animalPage.page,
        limit: animalPage.limit,
        search: animalFilters.search || undefined,
        apadrinable: animalFilters.apadrinable === "" ? undefined : animalFilters.apadrinable === "true",
      });
      setAnimalsData(response);
    } catch (error) {
      setAnimalsError(buildErrorMessage(error, "No se pudieron cargar los animales apadrinables."));
    } finally {
      setAnimalsLoading(false);
    }
  }, [animalFilters, animalPage, canReadSponsorships, canUpdateAnimals]);

  useEffect(() => {
    if (!hasModuleAccess) return;
    refreshReferences();
  }, [hasModuleAccess, refreshReferences]);

  useEffect(() => { loadSponsors(); }, [loadSponsors]);
  useEffect(() => { loadSponsorships(); }, [loadSponsorships]);
  useEffect(() => { loadPayments(); }, [loadPayments]);
  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadAnimals(); }, [loadAnimals]);

  const selectedManualSponsorship = useMemo(
    () => manualSponsorshipOptions.find((item) => String(item.subscription?.id) === String(paymentForm.subscriptionId)) || null,
    [manualSponsorshipOptions, paymentForm.subscriptionId],
  );

  useEffect(() => {
    if (!selectedManualSponsorship) return;

    setPaymentForm((current) => ({
      ...current,
      sponsorshipId: String(selectedManualSponsorship.id),
      monto: String(selectedManualSponsorship.plan?.monto || ""),
      moneda: selectedManualSponsorship.plan?.moneda || "CLP",
    }));
  }, [selectedManualSponsorship]);

  useEffect(() => {
    if (!paymentForm.fechaPago) return;

    const nextBilling = addOneCalendarMonthFromDateInput(paymentForm.fechaPago);
    setPaymentForm((current) => (
      current.proximoCobro === nextBilling
        ? current
        : { ...current, proximoCobro: nextBilling }
    ));
  }, [paymentForm.fechaPago]);

  if (!hasModuleAccess) {
    return (
      <main className="settings-page home-page">
        <div className="settings-empty-state">
          <h2>Apadrinamiento</h2>
          <p>No tienes permisos para acceder a este módulo.</p>
        </div>
      </main>
    );
  }

  async function openSponsorDetail(sponsorId) {
    try {
      setGlobalError("");
      setSelectedSponsor(await getAdminSponsor(sponsorId));
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo abrir el detalle del padrino."));
    }
  }

  async function openSponsorshipDetail(sponsorshipId) {
    try {
      setGlobalError("");
      setSelectedSponsorship(await getAdminSponsorship(sponsorshipId));
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo abrir el detalle del apadrinamiento."));
    }
  }

  async function openPaymentDetail(paymentId) {
    try {
      setGlobalError("");
      setSelectedPayment(await getAdminSubscriptionPayment(paymentId));
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo abrir el detalle del pago."));
    }
  }

  function openCreateSponsorModal() {
    setSponsorModalMode("create");
    setSponsorForm(emptySponsorForm());
    setSponsorFormError("");
    setIsSponsorModalOpen(true);
  }

  function openEditSponsorModal(sponsor) {
    setSponsorModalMode("edit");
    setSponsorForm({
      id: sponsor.id,
      nombre: sponsor.nombre,
      apellido: sponsor.apellido,
      email: sponsor.email,
      telefono: sponsor.telefono || "",
      consentimientoDatos: true,
      activo: sponsor.activo,
    });
    setSponsorFormError("");
    setIsSponsorModalOpen(true);
  }

  function openCreateSponsorshipModal() {
    setSponsorshipForm(emptyManualSponsorshipForm());
    setSponsorshipFormError("");
    setIsSponsorshipModalOpen(true);
  }

  function openCreatePaymentModal(sponsorship = null) {
    setPaymentForm({
      ...emptyManualPaymentForm(),
      subscriptionId: sponsorship?.subscription?.id ? String(sponsorship.subscription.id) : "",
      sponsorshipId: sponsorship?.id ? String(sponsorship.id) : "",
      monto: sponsorship?.plan?.monto ? String(sponsorship.plan.monto) : "",
      moneda: sponsorship?.plan?.moneda || "CLP",
      proximoCobro: addOneCalendarMonthFromDateInput(todayValue()),
    });
    setPaymentFormError("");
    setIsPaymentModalOpen(true);
  }

  function openPlanModal(plan = null) {
    setPlanModalMode(plan ? "edit" : "create");
    setPlanForm(plan
      ? {
          id: plan.id,
          nombre: plan.nombre,
          descripcion: plan.descripcion || "",
          modalidad: plan.modalidad || "PAYPAL",
          monto: String(plan.monto || ""),
          orden: plan.orden || 0,
          activo: Boolean(plan.activo),
        }
      : emptyPlanForm());
    setPlanFormError("");
    setIsPlanModalOpen(true);
  }

  function openCancellationModal(sponsorship) {
    setCancellationForm({
      subscriptionId: String(sponsorship.subscription?.id || ""),
      sponsorshipId: String(sponsorship.id || ""),
      motivo: "",
      sponsorshipLabel: `${sponsorship.sponsor?.nombreCompleto || "Padrino"} / ${sponsorship.animal?.nombre || "Animal"}`,
    });
    setCancellationError("");
    setIsCancellationModalOpen(true);
  }

  async function handleSubmitSponsor(event) {
    event.preventDefault();
    setSponsorFormError("");

    if (!sponsorForm.nombre.trim() || !sponsorForm.apellido.trim() || !sponsorForm.email.trim()) {
      setSponsorFormError("Debes completar nombre, apellido y correo.");
      return;
    }
    if (sponsorModalMode === "create" && !sponsorForm.consentimientoDatos) {
      setSponsorFormError("Debes aceptar el consentimiento de tratamiento de datos.");
      return;
    }

    setIsSaving(true);
    try {
      if (sponsorModalMode === "create") {
        await createAdminSponsor({
          nombre: sponsorForm.nombre.trim(),
          apellido: sponsorForm.apellido.trim(),
          email: sponsorForm.email.trim(),
          telefono: sponsorForm.telefono.trim() || null,
          consentimiento_datos: true,
          activo: Boolean(sponsorForm.activo),
        });
      } else {
        await updateAdminSponsor(sponsorForm.id, {
          nombre: sponsorForm.nombre.trim(),
          apellido: sponsorForm.apellido.trim(),
          email: sponsorForm.email.trim(),
          telefono: sponsorForm.telefono.trim() || null,
          activo: Boolean(sponsorForm.activo),
        });
      }

      setIsSponsorModalOpen(false);
      await Promise.all([loadSponsors(), refreshReferences()]);
    } catch (error) {
      setSponsorFormError(buildErrorMessage(error, "No se pudo guardar el padrino."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleSponsor(sponsor) {
    const nextActive = !sponsor.activo;
    if (!nextActive && sponsor.activeSponsorshipsCount > 0) {
      const confirmed = window.confirm(
        "Este padrino tiene apadrinamientos activos. Se desactivara solo el padrino, sin cancelar sus relaciones. Deseas continuar?",
      );
      if (!confirmed) return;
    }

    try {
      setGlobalError("");
      await updateAdminSponsor(sponsor.id, { activo: nextActive });
      await Promise.all([loadSponsors(), refreshReferences()]);
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo actualizar el estado del padrino."));
    }
  }

  async function handleSubmitSponsorship(event) {
    event.preventDefault();
    setSponsorshipFormError("");

    if (!sponsorshipForm.sponsorId || !sponsorshipForm.animalId || !sponsorshipForm.planId) {
      setSponsorshipFormError("Debes seleccionar padrino, animal y plan.");
      return;
    }

    setIsSaving(true);
    try {
      await createAdminManualSponsorship({
        sponsor_id: Number(sponsorshipForm.sponsorId),
        animal_id: Number(sponsorshipForm.animalId),
        plan_id: Number(sponsorshipForm.planId),
        fecha_inicio: sponsorshipForm.fechaInicio,
        proximo_cobro: sponsorshipForm.proximoCobro,
        metodo_esperado: sponsorshipForm.metodoEsperado,
        observacion: sponsorshipForm.observacion.trim() || null,
      });

      setIsSponsorshipModalOpen(false);
      await Promise.all([loadSponsorships(), loadPayments(), refreshReferences(), loadSponsors(), loadAnimals(), loadPlans()]);
    } catch (error) {
      setSponsorshipFormError(buildErrorMessage(error, "No se pudo crear el apadrinamiento manual."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitPayment(event) {
    event.preventDefault();
    setPaymentFormError("");

    const amount = normalizePositiveNumber(paymentForm.monto);
    if (!paymentForm.subscriptionId || !amount || !paymentForm.fechaPago || !paymentForm.proximoCobro) {
      setPaymentFormError("Debes completar apadrinamiento, fecha, monto y próximo cobro.");
      return;
    }

    setIsSaving(true);
    try {
      await createAdminManualSubscriptionPayment(
        {
          subscription_id: Number(paymentForm.subscriptionId),
          fecha_pago: paymentForm.fechaPago,
          monto: amount,
          moneda: paymentForm.moneda,
          metodo: paymentForm.metodo,
          referencia: paymentForm.referencia.trim() || null,
          observacion: paymentForm.observacion.trim() || null,
          proximo_cobro: paymentForm.proximoCobro,
        },
        crypto.randomUUID(),
      );

      setIsPaymentModalOpen(false);
      await Promise.all([loadPayments(), loadSponsorships(), refreshReferences()]);
    } catch (error) {
      setPaymentFormError(buildErrorMessage(error, "No se pudo registrar el pago manual."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitPlan(event) {
    event.preventDefault();
    setPlanFormError("");

    const amount = normalizePositiveNumber(planForm.monto);
    if (!planForm.nombre.trim() || !amount) {
      setPlanFormError("Debes completar nombre y monto.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nombre: planForm.nombre.trim(),
        descripcion: planForm.descripcion.trim() || null,
        modalidad: planForm.modalidad,
        monto: amount,
        orden: Number(planForm.orden || 0),
        activo: Boolean(planForm.activo),
      };

      if (planModalMode === "create") {
        await createAdminSponsorshipPlan(payload);
      } else {
        await updateAdminSponsorshipPlan(planForm.id, payload);
      }

      setIsPlanModalOpen(false);
      await Promise.all([loadPlans(), refreshReferences()]);
    } catch (error) {
      setPlanFormError(buildErrorMessage(error, "No se pudo guardar el plan."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleProvisionPlan(planId) {
    try {
      setGlobalError("");
      await provisionAdminSponsorshipPlan(planId);
      await Promise.all([loadPlans(), refreshReferences()]);
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo aprovisionar el plan."));
    }
  }

  async function handleDeletePlan(plan) {
    const confirmed = window.confirm(
      plan.hasHistory
        ? "Este plan tiene historial. Se intentara desactivar segun las reglas del backend. Deseas continuar?"
        : "Deseas eliminar este plan?",
    );
    if (!confirmed) return;

    try {
      setGlobalError("");
      await deleteAdminSponsorshipPlan(plan.id);
      await Promise.all([loadPlans(), refreshReferences()]);
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo eliminar o desactivar el plan."));
    }
  }

  async function handleToggleAnimal(animal) {
    try {
      setGlobalError("");
      await updateAdminSponsorshipAnimal(animal.id, { apadrinable: !animal.apadrinable });
      await Promise.all([loadAnimals(), refreshReferences()]);
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo actualizar el estado apadrinable del animal."));
    }
  }

  async function handleSyncSubscription(sponsorship) {
    try {
      setGlobalError("");
      await syncAdminSubscription(sponsorship.subscription.id);
      const detailed = await getAdminSponsorship(sponsorship.id);
      setSelectedSponsorship(detailed);
      await Promise.all([loadSponsorships(), loadPayments(), refreshReferences()]);
    } catch (error) {
      setGlobalError(buildErrorMessage(error, "No se pudo sincronizar la suscripción."));
    }
  }

  async function handleSubmitCancellation(event) {
    event.preventDefault();
    setCancellationError("");

    if (!cancellationForm.subscriptionId || !cancellationForm.motivo.trim()) {
      setCancellationError("Debes indicar un motivo de cancelación.");
      return;
    }

    setIsSaving(true);
    try {
      await cancelAdminSubscription(cancellationForm.subscriptionId, {
        motivo: cancellationForm.motivo.trim(),
      });

      setIsCancellationModalOpen(false);
      setSelectedSponsorship(null);
      await Promise.all([loadSponsorships(), loadPayments(), refreshReferences()]);
    } catch (error) {
      setCancellationError(buildErrorMessage(error, "No se pudo cancelar el apadrinamiento."));
    } finally {
      setIsSaving(false);
    }
  }

  const sponsorshipFilterSummary = [
    sponsorshipFilters.search ? `Buscar: ${sponsorshipFilters.search}` : null,
    sponsorshipFilters.estado ? `Estado: ${formatLabel(sponsorshipFilters.estado)}` : null,
    sponsorshipFilters.planId ? "Plan aplicado" : null,
  ].filter(Boolean);

  const sponsorFilterSummary = [
    sponsorFilters.search ? `Buscar: ${sponsorFilters.search}` : null,
    sponsorFilters.activo === "true" ? "Solo activos" : null,
    sponsorFilters.activo === "false" ? "Solo inactivos" : null,
    sponsorFilters.hasActive === "true" ? "Con apadrinamiento activo" : null,
    sponsorFilters.hasActive === "false" ? "Sin apadrinamiento activo" : null,
  ].filter(Boolean);

  const paymentFilterSummary = [
    paymentFilters.search ? `Buscar: ${paymentFilters.search}` : null,
    paymentFilters.estado ? `Estado: ${formatLabel(paymentFilters.estado)}` : null,
    paymentFilters.sponsorId ? "Padrino aplicado" : null,
    paymentFilters.animalId ? "Animal aplicado" : null,
    paymentFilters.planId ? "Plan aplicado" : null,
    paymentFilters.conTransaccion === "true" ? "Con transaccion" : null,
    paymentFilters.conTransaccion === "false" ? "Sin transaccion" : null,
    paymentFilters.fechaDesde ? `Desde: ${paymentFilters.fechaDesde}` : null,
    paymentFilters.fechaHasta ? `Hasta: ${paymentFilters.fechaHasta}` : null,
  ].filter(Boolean);

  const planFilterSummary = [
    planFilters.search ? `Buscar: ${planFilters.search}` : null,
    planFilters.activo === "true" ? "Solo activos" : null,
    planFilters.activo === "false" ? "Solo inactivos" : null,
  ].filter(Boolean);

  const animalFilterSummary = [
    animalFilters.search ? `Buscar: ${animalFilters.search}` : null,
    animalFilters.apadrinable === "true" ? "Solo apadrinables" : null,
    animalFilters.apadrinable === "false" ? "Solo no apadrinables" : null,
  ].filter(Boolean);

  return (
    <main className="main-content home-content foster-home-page">
      
      <div className="settings-header sponsorship-admin-header">
        <div>
          <h1>Apadrinamiento</h1>
          <p>Gestiona padrinos, apadrinamientos, pagos y configuracion del programa.</p>
        </div>
      </div>

      {globalError ? <p className="error-text sponsorship-admin-global-error">{globalError}</p> : null}

      <nav className="home-tabs settings-tabs sponsorship-admin-tabs" aria-label="Tabs de apadrinamiento">
        {[
          { id: TABS.SPONSORSHIPS, label: "Apadrinamientos" },
          { id: TABS.SPONSORS, label: "Padrinos" },
          { id: TABS.PAYMENTS, label: "Pagos" },
          { id: TABS.SETTINGS, label: "Configuracion" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`home-tab-button ${activeTab === tab.id ? "home-tab-button-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === TABS.SPONSORSHIPS ? (
        <ModuleCard
          title="Apadrinamientos"
          subtitle="Controla relaciones activas, pendientes y canceladas del programa."
          actions={canCreateSponsorships ? (
            <button type="button" className="btn btn-primary" onClick={openCreateSponsorshipModal}>
              Nuevo apadrinamiento manual
            </button>
          ) : null}
        >
          <div className="settings-filter-grid inventory-filter-grid">
            <FilterField label="Buscar">
              <input
                type="search"
                placeholder="Buscar por padrino, animal o plan"
                value={sponsorshipFilters.search}
                onChange={(event) => {
                  setSponsorshipPage((current) => ({ ...current, page: 1 }));
                  setSponsorshipFilters((current) => ({ ...current, search: event.target.value }));
                }}
              />
            </FilterField>
            <FilterField label="Estado">
              <select
                value={sponsorshipFilters.estado}
                onChange={(event) => {
                  setSponsorshipPage((current) => ({ ...current, page: 1 }));
                  setSponsorshipFilters((current) => ({ ...current, estado: event.target.value }));
                }}
              >
                <option value="">Todos los estados</option>
                {SPONSORSHIP_STATES.map((state) => (
                  <option key={state} value={state}>{formatLabel(state)}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Plan">
              <select
                value={sponsorshipFilters.planId}
                onChange={(event) => {
                  setSponsorshipPage((current) => ({ ...current, page: 1 }));
                  setSponsorshipFilters((current) => ({ ...current, planId: event.target.value }));
                }}
              >
                <option value="">Todos los planes</option>
                {referencePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.nombre}</option>
                ))}
              </select>
            </FilterField>
            <button
              type="button"
              className="btn-clear"
              onClick={() => {
                setSponsorshipFilters({ search: "", estado: "", planId: "" });
                setSponsorshipPage({ page: 1, limit: sponsorshipPage.limit });
              }}
            >
              Limpiar filtros
            </button>
          </div>

      
          {sponsorshipsError ? <p className="error-text">{sponsorshipsError}</p> : null}

          <div className="table-container">
            <table className="crud-table sponsorship-admin-table">
              <thead>
                <tr>
                  <th>Padrino</th>
                  <th>Animal</th>
                  <th>Especie</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sponsorshipsLoading ? (
                  <tr><td colSpan="7">Cargando apadrinamientos...</td></tr>
                ) : sponsorshipsData.items.length === 0 ? (
                  <tr><td colSpan="7">No hay apadrinamientos para mostrar.</td></tr>
                ) : sponsorshipsData.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sponsor?.nombreCompleto || "No disponible"}</td>
                    <td>
                      <div className="sponsorship-admin-animal-cell">
                        {item.animal?.imagenPrincipal ? (
                          <img src={item.animal.imagenPrincipal} alt={item.animal.nombre} />
                        ) : <span className="sponsorship-admin-animal-placeholder">Sin foto</span>}
                        <span>{item.animal?.nombre || "No disponible"}</span>
                      </div>
                    </td>
                    <td>{item.animal?.especie || "No disponible"}</td>
                    <td>{item.plan?.nombre || "No disponible"}</td>
                    <td><StatusBadge tone={statusTone(item.estado)}>{formatLabel(item.estado)}</StatusBadge></td>
                    <td>{formatDate(item.activadoEn || item.solicitadoEn)}</td>
                    <td>
                      <div className="sponsorship-admin-row-actions">
                        <IconButton
                          icon={Eye}
                          label={`Ver detalle del apadrinamiento ${item.id}`}
                          variant="secondary"
                          onClick={() => openSponsorshipDetail(item.id)}
                        />
                        {canCancelSponsorships && !["CANCELADO", "FALLIDO"].includes(item.estado) ? (
                          <IconButton
                            icon={Ban}
                            label={`Cancelar apadrinamiento ${item.id}`}
                            variant="danger"
                            onClick={() => openCancellationModal(item)}
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
            page={sponsorshipsData.pagination.page}
            pageSize={sponsorshipsData.pagination.limit}
            totalItems={sponsorshipsData.pagination.total}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(page) => setSponsorshipPage((current) => ({ ...current, page }))}
            onPageSizeChange={(limit) => setSponsorshipPage({ page: 1, limit })}
          />
        </ModuleCard>
      ) : null}

      {activeTab === TABS.SPONSORS ? (
        <ModuleCard
          title="Padrinos"
          subtitle="Administra personas del programa y su estado interno."
          actions={canCreateSponsors ? (
            <button type="button" className="btn btn-primary" onClick={openCreateSponsorModal}>
              Nuevo padrino
            </button>
          ) : null}
        >
          <div className="settings-filter-grid inventory-filter-grid">
            <FilterField label="Buscar">
              <input
                type="search"
                placeholder="Nombre o correo"
                value={sponsorFilters.search}
                onChange={(event) => {
                  setSponsorPage((current) => ({ ...current, page: 1 }));
                  setSponsorFilters((current) => ({ ...current, search: event.target.value }));
                }}
              />
            </FilterField>
            <FilterField label="Estado">
              <select
                value={sponsorFilters.activo}
                onChange={(event) => {
                  setSponsorPage((current) => ({ ...current, page: 1 }));
                  setSponsorFilters((current) => ({ ...current, activo: event.target.value }));
                }}
              >
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </FilterField>
            <FilterField label="Apadrinamiento activo">
              <select
                value={sponsorFilters.hasActive}
                onChange={(event) => {
                  setSponsorPage((current) => ({ ...current, page: 1 }));
                  setSponsorFilters((current) => ({ ...current, hasActive: event.target.value }));
                }}
              >
                <option value="">Todos</option>
                <option value="true">Con apadrinamiento activo</option>
                <option value="false">Sin apadrinamiento activo</option>
              </select>
            </FilterField>
            <button
              type="button"
              className="btn-clear"
              onClick={() => {
                setSponsorFilters({ search: "", activo: "", hasActive: "" });
                setSponsorPage({ page: 1, limit: sponsorPage.limit });
              }}
            >
              Limpiar filtros
            </button>
          </div>

          {sponsorsError ? <p className="error-text">{sponsorsError}</p> : null}

          <div className="table-container">
            <table className="crud-table sponsorship-admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Apadrinamientos</th>
                  <th>Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sponsorsLoading ? (
                  <tr><td colSpan="7">Cargando padrinos...</td></tr>
                ) : sponsorsData.items.length === 0 ? (
                  <tr><td colSpan="7">No hay padrinos para mostrar.</td></tr>
                ) : sponsorsData.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nombreCompleto}</td>
                    <td>{item.email}</td>
                    <td>{item.telefono || "-"}</td>
                    <td><StatusBadge tone={item.activo ? "success" : "neutral"}>{item.activo ? "Activo" : "Inactivo"}</StatusBadge></td>
                    <td>{item.activeSponsorshipsCount}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="sponsorship-admin-row-actions">
                        <IconButton
                          icon={Eye}
                          label={`Ver padrino ${item.nombreCompleto}`}
                          variant="secondary"
                          onClick={() => openSponsorDetail(item.id)}
                        />
                        {canUpdateSponsors ? (
                          <IconButton
                            icon={Pencil}
                            label={`Editar padrino ${item.nombreCompleto}`}
                            variant="secondary"
                            onClick={() => openEditSponsorModal(item)}
                          />
                        ) : null}
                        {canUpdateSponsors ? (
                          <IconButton
                            icon={item.activo ? PowerOff : Power}
                            label={`${item.activo ? "Desactivar" : "Activar"} padrino ${item.nombreCompleto}`}
                            variant={item.activo ? "warning" : "success"}
                            onClick={() => handleToggleSponsor(item)}
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
            page={sponsorsData.pagination.page}
            pageSize={sponsorsData.pagination.limit}
            totalItems={sponsorsData.pagination.total}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(page) => setSponsorPage((current) => ({ ...current, page }))}
            onPageSizeChange={(limit) => setSponsorPage({ page: 1, limit })}
          />
        </ModuleCard>
      ) : null}

      {activeTab === TABS.PAYMENTS ? (
        <ModuleCard
          title="Pagos"
          subtitle="Consulta cobros recurrentes y registra pagos manuales vinculados a Contabilidad."
          actions={canCreatePayments ? (
            <IconButton
              icon={HandCoins}
              label="Registrar pago manual"
              variant="primary"
              onClick={() => openCreatePaymentModal()}
            />
          ) : null}
        >
          <div className="settings-filter-grid inventory-filter-grid">
            <FilterField label="Buscar">
              <input
                type="search"
                placeholder="Padrino, animal o referencia"
                value={paymentFilters.search}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, search: event.target.value }));
                }}
              />
            </FilterField>
            <FilterField label="Estado">
              <select
                value={paymentFilters.estado}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, estado: event.target.value }));
                }}
              >
                <option value="">Todos los estados</option>
                {PAYMENT_STATES.map((state) => (
                  <option key={state} value={state}>{formatLabel(state)}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Padrino">
              <select
                value={paymentFilters.sponsorId}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, sponsorId: event.target.value }));
                }}
              >
                <option value="">Todos los padrinos</option>
                {referenceSponsors.map((sponsor) => (
                  <option key={sponsor.id} value={sponsor.id}>{sponsor.nombreCompleto}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Animal">
              <select
                value={paymentFilters.animalId}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, animalId: event.target.value }));
                }}
              >
                <option value="">Todos los animales</option>
                {referenceAnimals.map((animal) => (
                  <option key={animal.id} value={animal.id}>{animal.nombre}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Plan">
              <select
                value={paymentFilters.planId}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, planId: event.target.value }));
                }}
              >
                <option value="">Todos los planes</option>
                {referencePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.nombre}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Desde">
              <input
                type="date"
                value={paymentFilters.fechaDesde}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, fechaDesde: event.target.value }));
                }}
              />
            </FilterField>
            <FilterField label="Hasta">
              <input
                type="date"
                value={paymentFilters.fechaHasta}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, fechaHasta: event.target.value }));
                }}
              />
            </FilterField>
            <FilterField label="Transaccion">
              <select
                value={paymentFilters.conTransaccion}
                onChange={(event) => {
                  setPaymentPage((current) => ({ ...current, page: 1 }));
                  setPaymentFilters((current) => ({ ...current, conTransaccion: event.target.value }));
                }}
              >
                <option value="">Con y sin transaccion</option>
                <option value="true">Con transaccion</option>
                <option value="false">Sin transaccion</option>
              </select>
            </FilterField>
            <div></div>
            <div></div>
            <div></div>
            <button
              type="button"
              className="btn-clear"
              onClick={() => {
                setPaymentFilters({
                  search: "",
                  estado: "",
                  sponsorId: "",
                  animalId: "",
                  planId: "",
                  conTransaccion: "",
                  fechaDesde: "",
                  fechaHasta: "",
                });
                setPaymentPage({ page: 1, limit: paymentPage.limit });
              }}
            >
              Limpiar filtros
            </button>
          </div>

      
          {paymentsError ? <p className="error-text">{paymentsError}</p> : null}

          <div className="table-container">
            <table className="crud-table sponsorship-admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Padrino</th>
                  <th>Animal</th>
                  <th>Plan</th>
                  <th>Monto bruto</th>
                  <th>Comisión</th>
                  <th>Neto</th>
                  <th>Estado</th>
                  <th>Transaccion</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading ? (
                  <tr><td colSpan="10">Cargando pagos...</td></tr>
                ) : paymentsData.items.length === 0 ? (
                  <tr><td colSpan="10">No hay pagos para mostrar.</td></tr>
                ) : paymentsData.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.occurredAt)}</td>
                    <td>{item.subscription?.sponsor?.nombreCompleto || "No disponible"}</td>
                    <td>{item.subscription?.animal?.nombre || "No disponible"}</td>
                    <td>{item.subscription?.plan?.nombre || "No disponible"}</td>
                    <td>{formatSponsorshipMoney(item.montoBruto, item.moneda)}</td>
                    <td>{formatSponsorshipMoney(item.montoFee, item.moneda)}</td>
                    <td>{formatSponsorshipMoney(item.montoNeto, item.moneda)}</td>
                    <td><StatusBadge tone={statusTone(item.estado)}>{formatLabel(item.estado)}</StatusBadge></td>
                    <td>{item.transaction?.id ? `#${item.transaction.id}` : "-"}</td>
                    <td>
                      <div className="sponsorship-admin-row-actions">
                        <IconButton
                          icon={Eye}
                          label={`Ver detalle del pago ${item.id}`}
                          variant="secondary"
                          onClick={() => openPaymentDetail(item.id)}
                        />
                        {item.transaction?.id ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => navigate(`/contabilidad?tab=transactions&search=${item.transaction.id}`)}
                          >
                            Abrir transaccion
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
            page={paymentsData.pagination.page}
            pageSize={paymentsData.pagination.limit}
            totalItems={paymentsData.pagination.total}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(page) => setPaymentPage((current) => ({ ...current, page }))}
            onPageSizeChange={(limit) => setPaymentPage({ page: 1, limit })}
          />
        </ModuleCard>
      ) : null}

      {activeTab === TABS.SETTINGS ? (
        <div className="sponsorship-admin-settings-shell">
          <nav className="home-tabs settings-tabs sponsorship-admin-subtabs" aria-label="Subtabs de configuracion">
            {[
              { id: SETTINGS_TABS.PLANS, label: "Planes" },
              { id: SETTINGS_TABS.ANIMALS, label: "Animales apadrinables" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`home-tab-button ${activeSettingsTab === tab.id ? "home-tab-button-active" : ""}`}
                onClick={() => setActiveSettingsTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <ModuleCard
            title={activeSettingsTab === SETTINGS_TABS.PLANS ? "Planes" : "Animales apadrinables"}
            subtitle={
              activeSettingsTab === SETTINGS_TABS.PLANS
                ? "Configura los planes disponibles para apadrinamientos PayPal y manuales."
                : "Define qué animales pueden mostrarse y recibir apadrinamientos."
            }
            actions={
              activeSettingsTab === SETTINGS_TABS.PLANS && canCreatePlans ? (
                <button type="button" className="btn btn-primary" onClick={() => openPlanModal()}>
                  Nuevo plan
                </button>
              ) : null
            }
          >
            {activeSettingsTab === SETTINGS_TABS.PLANS ? (
            <div className="sponsorship-admin-settings-block">
              <div className="settings-filter-grid inventory-filter-grid">
                <FilterField label="Buscar">
                  <input
                    type="search"
                    placeholder="Nombre del plan"
                    value={planFilters.search}
                    onChange={(event) => {
                      setPlanPage((current) => ({ ...current, page: 1 }));
                      setPlanFilters((current) => ({ ...current, search: event.target.value }));
                    }}
                  />
                </FilterField>
                <FilterField label="Estado">
                  <select
                    value={planFilters.activo}
                    onChange={(event) => {
                      setPlanPage((current) => ({ ...current, page: 1 }));
                      setPlanFilters((current) => ({ ...current, activo: event.target.value }));
                    }}
                  >
                    <option value="">Todos los estados</option>
                    <option value="true">Activos</option>
                    <option value="false">Inactivos</option>
                  </select>
                </FilterField>
                <div></div>
                <button
                  type="button"
                  className="btn-clear"
                  onClick={() => {
                    setPlanFilters({ search: "", activo: "" });
                    setPlanPage({ page: 1, limit: planPage.limit });
                  }}
                >
                  Limpiar filtros
                </button>
              </div>

             
              {plansError ? <p className="error-text">{plansError}</p> : null}

              <div className="table-container">
                <table className="crud-table sponsorship-admin-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Modalidad</th>
                      <th>Aporte</th>
                      <th>Frecuencia</th>
                      <th>Estado</th>
                      <th>PayPal</th>
                      <th>Uso</th>
                      <th>Orden</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plansLoading ? (
                      <tr><td colSpan="9">Cargando planes...</td></tr>
                    ) : plansData.items.length === 0 ? (
                      <tr><td colSpan="9">No hay planes para mostrar.</td></tr>
                    ) : plansData.items.map((plan) => (
                      <tr key={plan.id}>
                        <td>{plan.nombre}</td>
                        <td>{formatLabel(plan.modalidad)}</td>
                        <td>{formatSponsorshipMoney(plan.monto, plan.moneda)}</td>
                        <td>{plan.frecuenciaLegible}</td>
                        <td><StatusBadge tone={plan.activo ? "success" : "neutral"}>{plan.activo ? "Activo" : "Inactivo"}</StatusBadge></td>
                        <td><StatusBadge tone={plan.modalidad === "MANUAL" ? "neutral" : (plan.paypalConfigurado ? "success" : "warning")}>{plan.modalidad === "MANUAL" ? "No aplica" : (plan.paypalConfigurado ? "Configurado" : "Pendiente")}</StatusBadge></td>
                        <td>{plan.hasHistory ? "Con historial" : "Sin uso"}</td>
                        <td>{plan.orden}</td>
                        <td>
                          <div className="sponsorship-admin-row-actions">
                            {canUpdatePlans ? (
                              <IconButton
                                icon={Pencil}
                                label={`Editar plan ${plan.nombre}`}
                                variant="secondary"
                                onClick={() => openPlanModal(plan)}
                              />
                            ) : null}
                            {canUpdatePlans && plan.modalidad === "PAYPAL" ? (
                              <button type="button" className="btn btn-secondary btn-small" onClick={() => handleProvisionPlan(plan.id)}>
                                Aprovisionar
                              </button>
                            ) : null}
                            {canDeletePlans ? (
                              <IconButton
                                icon={plan.hasHistory ? PowerOff : Trash2}
                                label={`${plan.hasHistory ? "Desactivar" : "Eliminar"} plan ${plan.nombre}`}
                                variant={plan.hasHistory ? "warning" : "danger"}
                                onClick={() => handleDeletePlan(plan)}
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
                page={plansData.pagination.page}
                pageSize={plansData.pagination.limit}
                totalItems={plansData.pagination.total}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={(page) => setPlanPage((current) => ({ ...current, page }))}
                onPageSizeChange={(limit) => setPlanPage({ page: 1, limit })}
              />
            </div>
          ) : null}

          {activeSettingsTab === SETTINGS_TABS.ANIMALS ? (
            <div className="sponsorship-admin-settings-block">
              <div className="settings-filter-grid inventory-filter-grid">
                <FilterField label="Buscar">
                  <input
                    type="search"
                    placeholder="Nombre del animal"
                    value={animalFilters.search}
                    onChange={(event) => {
                      setAnimalPage((current) => ({ ...current, page: 1 }));
                      setAnimalFilters((current) => ({ ...current, search: event.target.value }));
                    }}
                  />
                </FilterField>
                <FilterField label="Apadrinable">
                  <select
                    value={animalFilters.apadrinable}
                    onChange={(event) => {
                      setAnimalPage((current) => ({ ...current, page: 1 }));
                      setAnimalFilters((current) => ({ ...current, apadrinable: event.target.value }));
                    }}
                  >
                    <option value="">Todos</option>
                    <option value="true">Apadrinables</option>
                    <option value="false">No apadrinables</option>
                  </select>
                </FilterField>
                <div></div>
                <button
                  type="button"
                  className="btn-clear"
                  onClick={() => {
                    setAnimalFilters({ search: "", apadrinable: "" });
                    setAnimalPage({ page: 1, limit: animalPage.limit });
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
              {animalsError ? <p className="error-text">{animalsError}</p> : null}

              <div className="table-container">
                <table className="crud-table sponsorship-admin-table">
                  <thead>
                    <tr>
                      <th>Animal</th>
                      <th>Especie</th>
                      <th>Estado</th>
                      <th>Apadrinable</th>
                      <th>Apadrinamientos activos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animalsLoading ? (
                      <tr><td colSpan="6">Cargando animales...</td></tr>
                    ) : animalsData.items.length === 0 ? (
                      <tr><td colSpan="6">No hay animales para mostrar.</td></tr>
                    ) : animalsData.items.map((animal) => (
                      <tr key={animal.id}>
                        <td>
                          <div className="sponsorship-admin-animal-cell">
                            {animal.imagenPrincipal ? <img src={animal.imagenPrincipal} alt={animal.nombre} /> : <span className="sponsorship-admin-animal-placeholder">Sin foto</span>}
                            <span>{animal.nombre}</span>
                          </div>
                        </td>
                        <td>{animal.especie || "No disponible"}</td>
                        <td><StatusBadge tone={animal.fallecido ? "danger" : "success"}>{animal.fallecido ? "Fallecido" : "Vigente"}</StatusBadge></td>
                        <td><StatusBadge tone={animal.apadrinable ? "success" : "neutral"}>{animal.apadrinable ? "Si" : "No"}</StatusBadge></td>
                        <td>{animal.apadrinamientosActivos}</td>
                        <td>
                          <div className="sponsorship-admin-row-actions">
                            <IconButton
                              as={Link}
                              icon={Eye}
                              label={`Ver detalle del animal ${animal.nombre}`}
                              variant="secondary"
                              to={`/rescatados/${animal.id}`}
                            />
                            {canUpdateAnimals ? (
                              <IconButton
                                icon={animal.apadrinable ? PowerOff : Power}
                                label={`${animal.apadrinable ? "Desactivar" : "Activar"} apadrinamiento para ${animal.nombre}`}
                                variant={animal.apadrinable ? "warning" : "success"}
                                onClick={() => handleToggleAnimal(animal)}
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
                page={animalsData.pagination.page}
                pageSize={animalsData.pagination.limit}
                totalItems={animalsData.pagination.total}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={(page) => setAnimalPage((current) => ({ ...current, page }))}
                onPageSizeChange={(limit) => setAnimalPage({ page: 1, limit })}
              />
            </div>
          ) : null}
          </ModuleCard>
        </div>
      ) : null}

      <ModuleModal
        isOpen={isSponsorModalOpen}
        title={sponsorModalMode === "create" ? "Nuevo padrino" : "Editar padrino"}
        submitLabel={sponsorModalMode === "create" ? "Crear padrino" : "Guardar cambios"}
        onClose={() => setIsSponsorModalOpen(false)}
        onSubmit={handleSubmitSponsor}
        isSaving={isSaving}
        error={sponsorFormError}
      >
        <div className="sponsorship-admin-grid">
          <label>
            <span>Nombre</span>
            <input value={sponsorForm.nombre} onChange={(event) => setSponsorForm((current) => ({ ...current, nombre: event.target.value }))} />
          </label>
          <label>
            <span>Apellido</span>
            <input value={sponsorForm.apellido} onChange={(event) => setSponsorForm((current) => ({ ...current, apellido: event.target.value }))} />
          </label>
          <label>
            <span>Correo</span>
            <input type="email" value={sponsorForm.email} onChange={(event) => setSponsorForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            <span>Teléfono</span>
            <input value={sponsorForm.telefono} onChange={(event) => setSponsorForm((current) => ({ ...current, telefono: event.target.value }))} />
          </label>
        </div>
        {sponsorModalMode === "create" ? (
          <label className="sponsorship-admin-checkbox">
            <input
              type="checkbox"
              checked={sponsorForm.consentimientoDatos}
              onChange={(event) => setSponsorForm((current) => ({ ...current, consentimientoDatos: event.target.checked }))}
            />
            <span>Acepto el tratamiento de datos del padrino.</span>
          </label>
        ) : null}
        <label className="sponsorship-admin-checkbox">
          <input
            type="checkbox"
            checked={sponsorForm.activo}
            onChange={(event) => setSponsorForm((current) => ({ ...current, activo: event.target.checked }))}
          />
          <span>Padrino activo</span>
        </label>
      </ModuleModal>

      <ModuleModal
        isOpen={isSponsorshipModalOpen}
        title="Nuevo apadrinamiento manual"
        submitLabel="Crear apadrinamiento"
        onClose={() => setIsSponsorshipModalOpen(false)}
        onSubmit={handleSubmitSponsorship}
        isSaving={isSaving}
        error={sponsorshipFormError}
      >
        <div className="sponsorship-admin-grid">
          <label>
            <span>Padrino</span>
            <select value={sponsorshipForm.sponsorId} onChange={(event) => setSponsorshipForm((current) => ({ ...current, sponsorId: event.target.value }))}>
              <option value="">Selecciona un padrino</option>
              {referenceSponsors.filter((sponsor) => sponsor.activo).map((sponsor) => (
                <option key={sponsor.id} value={sponsor.id}>{sponsor.nombreCompleto}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Animal</span>
            <select value={sponsorshipForm.animalId} onChange={(event) => setSponsorshipForm((current) => ({ ...current, animalId: event.target.value }))}>
              <option value="">Selecciona un animal</option>
              {referenceAnimals.map((animal) => (
                <option key={animal.id} value={animal.id}>{animal.nombre} ({animal.especie})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Plan</span>
            <select value={sponsorshipForm.planId} onChange={(event) => setSponsorshipForm((current) => ({ ...current, planId: event.target.value }))}>
              <option value="">Selecciona un plan</option>
              {referencePlans.filter((plan) => plan.activo && plan.modalidad === "MANUAL").map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.nombre} - {formatSponsorshipMoney(plan.monto, plan.moneda)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Fecha de inicio</span>
            <input type="date" value={sponsorshipForm.fechaInicio} onChange={(event) => setSponsorshipForm((current) => ({ ...current, fechaInicio: event.target.value }))} />
          </label>
          <label>
            <span>Próximo cobro</span>
            <input type="date" value={sponsorshipForm.proximoCobro} onChange={(event) => setSponsorshipForm((current) => ({ ...current, proximoCobro: event.target.value }))} />
          </label>
          <label>
            <span>Método esperado</span>
            <select value={sponsorshipForm.metodoEsperado} onChange={(event) => setSponsorshipForm((current) => ({ ...current, metodoEsperado: event.target.value }))}>
              {MANUAL_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{formatLabel(method)}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Observación</span>
          <textarea value={sponsorshipForm.observacion} onChange={(event) => setSponsorshipForm((current) => ({ ...current, observacion: event.target.value }))} rows={3} />
        </label>
      </ModuleModal>

      <ModuleModal
        isOpen={isPaymentModalOpen}
        title="Registrar pago manual"
        submitLabel="Registrar pago"
        onClose={() => setIsPaymentModalOpen(false)}
        onSubmit={handleSubmitPayment}
        isSaving={isSaving}
        error={paymentFormError}
      >
        <div className="sponsorship-admin-grid">
          <label>
            <span>Apadrinamiento manual</span>
            <select value={paymentForm.subscriptionId} onChange={(event) => setPaymentForm((current) => ({ ...current, subscriptionId: event.target.value }))}>
              <option value="">Selecciona un apadrinamiento</option>
              {manualSponsorshipOptions.map((item) => (
                <option key={item.subscription.id} value={item.subscription.id}>
                  {item.sponsor?.nombreCompleto} - {item.animal?.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Padrino</span>
            <input value={selectedManualSponsorship?.sponsor?.nombreCompleto || ""} readOnly />
          </label>
          <label>
            <span>Animal</span>
            <input value={selectedManualSponsorship?.animal?.nombre || ""} readOnly />
          </label>
          <label>
            <span>Plan</span>
            <input value={selectedManualSponsorship?.plan?.nombre || ""} readOnly />
          </label>
          <label>
            <span>Moneda</span>
            <input value={paymentForm.moneda} readOnly />
          </label>
          <label>
            <span>Fecha del pago</span>
            <input type="date" value={paymentForm.fechaPago} onChange={(event) => setPaymentForm((current) => ({ ...current, fechaPago: event.target.value }))} />
          </label>
          <label>
            <span>Monto</span>
            <input value={paymentForm.monto} onChange={(event) => setPaymentForm((current) => ({ ...current, monto: event.target.value }))} />
          </label>
          <label>
            <span>Método</span>
            <select value={paymentForm.metodo} onChange={(event) => setPaymentForm((current) => ({ ...current, metodo: event.target.value }))}>
              {MANUAL_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{formatLabel(method)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Referencia del pago</span>
            <input value={paymentForm.referencia} onChange={(event) => setPaymentForm((current) => ({ ...current, referencia: event.target.value }))} />
            <small className="sponsorship-admin-help">Opcional. Puedes registrar número de transferencia, deposito o comprobante.</small>
          </label>
          <label>
            <span>Próximo cobro</span>
            <input type="date" value={paymentForm.proximoCobro} readOnly />
          </label>
        </div>
        <label>
          <span>Observación</span>
          <textarea value={paymentForm.observacion} onChange={(event) => setPaymentForm((current) => ({ ...current, observacion: event.target.value }))} rows={3} />
        </label>
      </ModuleModal>

      <ModuleModal
        isOpen={isPlanModalOpen}
        title={planModalMode === "create" ? "Nuevo plan" : "Editar plan"}
        submitLabel={planModalMode === "create" ? "Crear plan" : "Guardar cambios"}
        onClose={() => setIsPlanModalOpen(false)}
        onSubmit={handleSubmitPlan}
        isSaving={isSaving}
        error={planFormError}
      >
        <div className="sponsorship-admin-grid">
          <label>
            <span>Nombre</span>
            <input value={planForm.nombre} onChange={(event) => setPlanForm((current) => ({ ...current, nombre: event.target.value }))} />
          </label>
          <label>
            <span>Modalidad</span>
            <select value={planForm.modalidad} onChange={(event) => setPlanForm((current) => ({ ...current, modalidad: event.target.value }))}>
              <option value="PAYPAL">PayPal</option>
              <option value="MANUAL">Manual</option>
            </select>
          </label>
          <label>
            <span>Monto</span>
            <input value={planForm.monto} onChange={(event) => setPlanForm((current) => ({ ...current, monto: event.target.value }))} />
          </label>
          <label>
            <span>Moneda</span>
            <input value={planForm.modalidad === "MANUAL" ? "CLP" : "USD"} readOnly />
          </label>
          <label>
            <span>Frecuencia</span>
            <input value="Mensual" readOnly />
          </label>
          <label>
            <span>Orden</span>
            <input type="number" min="0" value={planForm.orden} onChange={(event) => setPlanForm((current) => ({ ...current, orden: event.target.value }))} />
          </label>
        </div>
        <label>
          <span>Descripción</span>
          <textarea value={planForm.descripcion} onChange={(event) => setPlanForm((current) => ({ ...current, descripcion: event.target.value }))} rows={3} />
        </label>
        <label className="sponsorship-admin-checkbox">
          <input type="checkbox" checked={planForm.activo} onChange={(event) => setPlanForm((current) => ({ ...current, activo: event.target.checked }))} />
          <span>Plan activo</span>
        </label>
      </ModuleModal>

      <ModuleModal
        isOpen={isCancellationModalOpen}
        title="Cancelar apadrinamiento"
        submitLabel="Cancelar apadrinamiento"
        onClose={() => setIsCancellationModalOpen(false)}
        onSubmit={handleSubmitCancellation}
        isSaving={isSaving}
        error={cancellationError}
      >
        <p className="sponsorship-admin-subtle">
          Se cancelara: <strong>{cancellationForm.sponsorshipLabel || "Apadrinamiento seleccionado"}</strong>
        </p>
        <label>
          <span>Motivo</span>
          <textarea value={cancellationForm.motivo} onChange={(event) => setCancellationForm((current) => ({ ...current, motivo: event.target.value }))} rows={4} />
        </label>
      </ModuleModal>

      {selectedSponsor ? (
        <div className="modal-overlay sponsorship-admin-modal-overlay" onClick={() => setSelectedSponsor(null)} role="presentation">
          <div className="event-modal sponsorship-admin-modal sponsorship-admin-detail-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="event-modal-header">
              <h3>{selectedSponsor.nombreCompleto}</h3>
              <ModalCloseButton onClick={() => setSelectedSponsor(null)} />
            </div>
            <div className="sponsorship-admin-detail-layout">
              <ModuleCard title="Datos de contacto">
                <div className="sponsorship-admin-detail-grid">
                  <DetailRow label="Nombre" value={selectedSponsor.nombre} />
                  <DetailRow label="Apellido" value={selectedSponsor.apellido} />
                  <DetailRow label="Correo" value={selectedSponsor.email} />
                  <DetailRow label="Teléfono" value={selectedSponsor.telefono || "-"} />
                </div>
              </ModuleCard>
              <ModuleCard title="Consentimiento y estado">
                <div className="sponsorship-admin-detail-grid">
                  <DetailRow label="Consentimiento" value={selectedSponsor.consentimientoOtorgado ? "Otorgado" : "No disponible"} />
                  <DetailRow label="Fecha de consentimiento" value={formatDateTime(selectedSponsor.consentimientoDatosAt)} />
                  <DetailRow label="Estado" value={selectedSponsor.activo ? "Activo" : "Inactivo"} />
                </div>
              </ModuleCard>
              <ModuleCard title="Animales apadrinados">
                {selectedSponsor.apadrinamientos.length === 0 ? (
                  <p className="sponsorship-admin-subtle">No registra apadrinamientos asociados.</p>
                ) : (
                  <div className="sponsorship-admin-compact-list">
                    {selectedSponsor.apadrinamientos.map((entry) => (
                      <article key={entry.id} className="sponsorship-admin-compact-item">
                        {entry.animal?.imagenPrincipal ? <img src={entry.animal.imagenPrincipal} alt={entry.animal.nombre} /> : null}
                        <div>
                          <strong>{entry.animal?.nombre || "Animal"}</strong>
                          <span>{entry.animal?.especie || "Sin especie"} · {entry.plan?.nombre || "Sin plan"}</span>
                        </div>
                        <StatusBadge tone={statusTone(entry.estado)}>{formatLabel(entry.estado)}</StatusBadge>
                      </article>
                    ))}
                  </div>
                )}
              </ModuleCard>
              <ModuleCard title="Pagos asociados resumidos">
                <div className="sponsorship-admin-detail-grid">
                  <DetailRow label="Cantidad de pagos" value={String(selectedSponsor.pagosResumen?.cantidad || 0)} />
                  <DetailRow label="Total neto" value={formatSponsorshipMoney(selectedSponsor.pagosResumen?.totalNeto || 0, "USD")} />
                </div>
              </ModuleCard>
            </div>
          </div>
        </div>
      ) : null}

      {selectedSponsorship ? (
        <div className="modal-overlay sponsorship-admin-modal-overlay" onClick={() => setSelectedSponsorship(null)} role="presentation">
          <div className="event-modal sponsorship-admin-modal sponsorship-admin-detail-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="event-modal-header">
              <h3>Detalle del apadrinamiento</h3>
              <ModalCloseButton onClick={() => setSelectedSponsorship(null)} />
            </div>
            <div className="sponsorship-admin-detail-layout">
              <section className="sponsorship-admin-detail-section">
                <div className="sponsorship-admin-detail-section-header">
                  <div>
                    <h4>Información general</h4>
                    <p className="sponsorship-admin-subtle">Resumen del padrino, animal y plan asociado.</p>
                  </div>
                  {selectedSponsorship.modalidad === "PAYPAL" && canSyncSubscriptions ? (
                    <IconButton
                      icon={RefreshCw}
                      label="Sincronizar apadrinamiento con PayPal"
                      variant="secondary"
                      onClick={() => handleSyncSubscription(selectedSponsorship)}
                    />
                  ) : null}
                </div>
                <div className="sponsorship-admin-detail-hero sponsorship-admin-detail-hero-compact">
                  {selectedSponsorship.animal?.imagenPrincipal ? (
                    <img src={selectedSponsorship.animal.imagenPrincipal} alt={selectedSponsorship.animal.nombre} />
                  ) : (
                    <span className="sponsorship-admin-animal-placeholder sponsorship-admin-animal-placeholder-large">Sin foto</span>
                  )}
                  <div className="sponsorship-admin-detail-grid">
                    <DetailRow label="Animal" value={selectedSponsorship.animal?.nombre} />
                    <DetailRow label="Especie" value={selectedSponsorship.animal?.especie} />
                    <DetailRow label="Padrino" value={selectedSponsorship.sponsor?.nombreCompleto} />
                    <DetailRow label="Plan" value={selectedSponsorship.plan?.nombre} />
                  </div>
                </div>
              </section>
              <section className="sponsorship-admin-detail-section">
                <h4>Estado y fechas</h4>
                <div className="sponsorship-admin-detail-grid">
                  <DetailRow label="Estado" value={formatLabel(selectedSponsorship.estado)} />
                  <DetailRow label="Modalidad" value={formatLabel(selectedSponsorship.modalidad)} />
                  <DetailRow label="Solicitud" value={formatDateTime(selectedSponsorship.solicitadoEn)} />
                  <DetailRow label="Activacion" value={formatDateTime(selectedSponsorship.activadoEn)} />
                  <DetailRow label="Cancelación" value={formatDateTime(selectedSponsorship.canceladoEn)} />
                  <DetailRow label="Motivo" value={selectedSponsorship.motivoCancelacion || "-"} />
                </div>
              </section>
              <section className="sponsorship-admin-detail-section">
                <h4>Plan</h4>
                <div className="sponsorship-admin-detail-grid">
                  <DetailRow label="Nombre" value={selectedSponsorship.plan?.nombre} />
                  <DetailRow label="Monto" value={formatSponsorshipMoney(selectedSponsorship.plan?.monto || 0, selectedSponsorship.plan?.moneda || "USD")} />
                  <DetailRow label="Moneda" value={selectedSponsorship.plan?.moneda || "USD"} />
                  <DetailRow
                    label="Último pago"
                    value={selectedSponsorship.ultimoPago ? formatDateTime(selectedSponsorship.ultimoPago.occurredAt) : "-"}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {selectedPayment ? (
        <div className="modal-overlay sponsorship-admin-modal-overlay" onClick={() => setSelectedPayment(null)} role="presentation">
          <div className="event-modal sponsorship-admin-modal sponsorship-admin-detail-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="event-modal-header">
              <h3>Detalle del pago</h3>
              <ModalCloseButton onClick={() => setSelectedPayment(null)} />
            </div>
            <div className="sponsorship-admin-detail-layout">
              <ModuleCard title="Pago">
                <div className="sponsorship-admin-detail-grid">
                  <DetailRow label="Fecha" value={formatDateTime(selectedPayment.occurredAt)} />
                  <DetailRow label="Monto bruto" value={formatSponsorshipMoney(selectedPayment.montoBruto, selectedPayment.moneda)} />
                  <DetailRow label="Comisión" value={formatSponsorshipMoney(selectedPayment.montoFee, selectedPayment.moneda)} />
                  <DetailRow label="Monto neto" value={formatSponsorshipMoney(selectedPayment.montoNeto, selectedPayment.moneda)} />
                  <DetailRow label="Moneda" value={selectedPayment.moneda} />
                  <DetailRow label="Estado" value={formatLabel(selectedPayment.estado)} />
                  <DetailRow label="Origen" value={selectedPayment.subscription?.paymentProvider?.clave === "MANUAL" ? "Manual" : "PayPal"} />
                  <DetailRow label="Método manual" value={selectedPayment.metodoManual || "-"} />
                </div>
              </ModuleCard>
              <ModuleCard title="Relación">
                <div className="sponsorship-admin-detail-grid">
                  <DetailRow label="Padrino" value={selectedPayment.subscription?.sponsor?.nombreCompleto} />
                  <DetailRow label="Animal" value={selectedPayment.subscription?.animal?.nombre} />
                  <DetailRow label="Plan" value={selectedPayment.subscription?.plan?.nombre} />
                  <DetailRow label="Referencia" value={selectedPayment.referenciaManual || selectedPayment.transaction?.referenciaExterna || "-"} />
                </div>
              </ModuleCard>
              <ModuleCard title="Transaccion contable" actions={selectedPayment.transaction?.id ? (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => navigate(`/contabilidad?tab=transactions&search=${selectedPayment.transaction.id}`)}>
                  Abrir en Contabilidad
                </button>
              ) : null}>
                {selectedPayment.transaction ? (
                  <div className="sponsorship-admin-detail-grid">
                    <DetailRow label="ID" value={`#${selectedPayment.transaction.id}`} />
                    <DetailRow label="Tipo" value={formatLabel(selectedPayment.transaction.tipo)} />
                    <DetailRow label="Estado" value={formatLabel(selectedPayment.transaction.estado)} />
                    <DetailRow label="Categoria" value={selectedPayment.transaction.category?.nombre || selectedPayment.transaction.category?.clave || "-"} />
                  </div>
                ) : (
                  <p className="sponsorship-admin-subtle">Este pago aun no tiene transaccion asociada.</p>
                )}
              </ModuleCard>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
