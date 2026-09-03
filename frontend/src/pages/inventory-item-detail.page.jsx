import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightFromLine,
  ArrowRightLeft,
  PackageMinus,
  SlidersHorizontal,
} from "lucide-react";
import { useParams } from "react-router-dom";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import FilterSummaryBar from "../components/FilterSummaryBar";
import PageBreadcrumb from "../components/PageBreadcrumb";
import PaginationControls from "../components/PaginationControls";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import {
  consumeInventory,
  exitInventory,
  getInventoryItemDetail,
  transferInventory,
} from "../services/inventory.service";
import { createManualInventoryAdjustment } from "../services/inventory_adjustment.service";
import { getLocations } from "../services/location.service";
import "../styles/home.page.css";
import "../styles/settings.page.css";
import "../styles/inventory.page.css";
import { paginateCollection } from "../utils/pagination";
import {
  emitInventoryUpdated,
  formatCurrency,
  formatDate,
  formatLocationLine,
  formatPersonName,
  formatQuantity,
  movementLabel,
  parsePositiveDecimal,
  stockStateLabel,
  INVENTORY_UPDATED_EVENT,
} from "../utils/inventory-ui";

const DETAIL_TABS = {
  GENERAL: "general",
  MOVEMENTS: "movements",
  DOCUMENTS: "documents",
};

const DEFAULT_PAGE_SIZE = 10;

function emptyOperationForm(existence = null) {
  return {
    cantidad: "",
    motivo: "",
    observaciones: "",
    destinationLocationId: "",
    existenciaId: existence?.id ? String(existence.id) : "",
  };
}

function emptyAdjustmentForm(existence = null) {
  return {
    existenciaId: existence?.id ? String(existence.id) : "",
    itemId: existence?.itemId ? String(existence.itemId) : "",
    locationId: existence?.locationId ? String(existence.locationId) : "",
    cantidadAntes:
      existence?.cantidadActual !== undefined && existence?.cantidadActual !== null
        ? String(existence.cantidadActual)
        : "",
    cantidadContada: "",
    motivo: existence?.itemNombre ? `Ajuste manual para ${existence.itemNombre}` : "",
    observaciones: "",
  };
}

function InventoryModal({
  isOpen,
  title,
  submitLabel,
  error,
  isSaving,
  onClose,
  onSubmit,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="event-modal inventory-modal-shell inventory-detail-modal-shell">
        <div className="event-modal-header">
          <h3>{title}</h3>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form onSubmit={onSubmit} className="inventory-modal-form">
          {error ? <p className="error-text">{error}</p> : null}
          {children}
          <div className="event-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryBadge({ tone = "neutral", children }) {
  return <span className={`inventory-badge inventory-badge-${tone}`}>{children}</span>;
}

function SectionCard({ title, subtitle, children, actions }) {
  return (
    <section className="crud-card inventory-card">
      <div className="crud-header inventory-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="inventory-subtle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="row-actions inventory-header-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default function InventoryItemDetailPage() {
  const { id } = useParams();
  const { hasAnyPermission } = usePermissions();

  const canOperateMovement = hasAnyPermission([
    PERMISSIONS.INVENTORY.MOVEMENT_CREATE_ANY,
    PERMISSIONS.INVENTORY.MOVEMENT_CREATE_LOCATION,
    PERMISSIONS.INVENTORY.INVENTORY_MOVEMENT_CREATE,
  ]);
  const canCreateAdjustments = hasAnyPermission([
    PERMISSIONS.INVENTORY.ADJUSTMENT_CREATE,
    PERMISSIONS.INVENTORY.ADJUSTMENT_CREATE_ANY,
    PERMISSIONS.INVENTORY.ADJUSTMENT_CREATE_LOCATION,
  ]);

  const [detail, setDetail] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [activeTab, setActiveTab] = useState(DETAIL_TABS.GENERAL);
  const [existenceFilters, setExistenceFilters] = useState({
    search: "",
    locationId: "",
    condition: "",
    status: "",
    origin: "",
  });
  const [movementFilters, setMovementFilters] = useState({
    tipo: "",
    locationId: "",
    fecha: "",
  });
  const [tablePagination, setTablePagination] = useState({
    existences: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    movements: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    donations: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    purchases: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
  });

  const [operationType, setOperationType] = useState("");
  const [selectedExistence, setSelectedExistence] = useState(null);
  const [operationForm, setOperationForm] = useState(emptyOperationForm());
  const [operationError, setOperationError] = useState("");
  const [operationSaving, setOperationSaving] = useState(false);

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustmentForm());
  const [adjustmentError, setAdjustmentError] = useState("");
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");

    try {
      const detailData = await getInventoryItemDetail(id);
      let activeLocations = [];

      try {
        activeLocations = await getLocations({ activo: true });
      } catch {
        activeLocations = [];
      }

      setDetail(detailData);
      setLocations(activeLocations);
    } catch (requestError) {
      setError(requestError.message || "No se pudo cargar el detalle del item.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setActiveTab(DETAIL_TABS.GENERAL);
    setExistenceFilters({
      search: "",
      locationId: "",
      condition: "",
      status: "",
      origin: "",
    });
    setMovementFilters({
      tipo: "",
      locationId: "",
      fecha: "",
    });
    setTablePagination({
      existences: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
      movements: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
      donations: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
      purchases: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    });
  }, [id]);



  useEffect(() => {
    function handleInventoryUpdated() {
      void loadDetail();
    }

    window.addEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);
    return () => {
      window.removeEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);
    };
  }, [loadDetail]);

  const movementLocationOptions = useMemo(() => {
    const locationsMap = new Map();

    for (const movement of detail?.movimientosRecientes || []) {
      for (const location of [movement.sourceLocation, movement.destinationLocation]) {
        if (!location?.id || locationsMap.has(location.id)) continue;
        locationsMap.set(location.id, {
          id: location.id,
          label: location.label || location.nombre || "Sin ubicación",
        });
      }
    }

    return Array.from(locationsMap.values());
  }, [detail?.movimientosRecientes]);

  const existenceLocationOptions = useMemo(() => {
    const locationsMap = new Map();

    for (const existence of detail?.existencias || []) {
      if (!existence.location?.id || locationsMap.has(existence.location.id)) continue;
      locationsMap.set(existence.location.id, {
        id: existence.location.id,
        label: formatLocationLine(existence.location),
      });
    }

    return Array.from(locationsMap.values());
  }, [detail?.existencias]);

  const filteredExistences = useMemo(() => {
    const searchTerm = existenceFilters.search.trim().toLowerCase();

    return (detail?.existencias || []).filter((existence) => {
      const haystack = [
        formatLocationLine(existence.location),
        existence.condicion,
        existence.estado,
        existence.origenTipo,
        existence.origenId,
        existence.observaciones,
        existence.fechaVencimiento,
        existence.fechaApertura,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesLocation =
        !existenceFilters.locationId
        || String(existence.locationId) === String(existenceFilters.locationId);
      const matchesCondition =
        !existenceFilters.condition
        || String(existence.condicion || "") === String(existenceFilters.condition);
      const matchesStatus =
        !existenceFilters.status
        || String(existence.estado || "") === String(existenceFilters.status);
      const matchesOrigin =
        !existenceFilters.origin
        || String(existence.origenTipo || "") === String(existenceFilters.origin);

      return (
        matchesSearch
        && matchesLocation
        && matchesCondition
        && matchesStatus
        && matchesOrigin
      );
    });
  }, [detail?.existencias, existenceFilters]);

  const filteredMovements = useMemo(() => {
    return (detail?.movimientosRecientes || []).filter((movement) => {
      const matchesType =
        !movementFilters.tipo || movement.tipoMovimiento === movementFilters.tipo;
      const matchesDate =
        !movementFilters.fecha || movement.fechaMovimiento === movementFilters.fecha;
      const movementLocationIds = [
        String(movement.sourceLocation?.id || ""),
        String(movement.destinationLocation?.id || ""),
      ].filter(Boolean);
      const matchesLocation =
        !movementFilters.locationId
        || movementLocationIds.includes(String(movementFilters.locationId));

      return matchesType && matchesDate && matchesLocation;
    });
  }, [detail?.movimientosRecientes, movementFilters.fecha, movementFilters.locationId, movementFilters.tipo]);

  const paginatedExistences = useMemo(
    () =>
      paginateCollection(
        filteredExistences,
        tablePagination.existences.page,
        tablePagination.existences.pageSize,
      ),
    [filteredExistences, tablePagination.existences.page, tablePagination.existences.pageSize],
  );

  const paginatedMovements = useMemo(
    () =>
      paginateCollection(
        filteredMovements,
        tablePagination.movements.page,
        tablePagination.movements.pageSize,
      ),
    [filteredMovements, tablePagination.movements.page, tablePagination.movements.pageSize],
  );

  const paginatedDonations = useMemo(
    () =>
      paginateCollection(
        detail?.donacionesAsociadas || [],
        tablePagination.donations.page,
        tablePagination.donations.pageSize,
      ),
    [detail?.donacionesAsociadas, tablePagination.donations.page, tablePagination.donations.pageSize],
  );

  const paginatedPurchases = useMemo(
    () =>
      paginateCollection(
        detail?.comprasAsociadas || [],
        tablePagination.purchases.page,
        tablePagination.purchases.pageSize,
      ),
    [detail?.comprasAsociadas, tablePagination.purchases.page, tablePagination.purchases.pageSize],
  );

  const existenceStats = useMemo(
    () => [
      `Mostrando ${filteredExistences.length} de ${(detail?.existencias || []).length}`,
      `Ubicaciones: ${new Set(filteredExistences.map((existence) => existence.locationId).filter(Boolean)).size}`,
      `Stock total: ${formatQuantity(
        filteredExistences.reduce(
          (sum, existence) => sum + Number(existence.cantidadActual || 0),
          0,
        ),
      )}`,
    ],
    [detail?.existencias, filteredExistences],
  );

  const movementStats = useMemo(
    () => [
      `Mostrando ${filteredMovements.length} de ${(detail?.movimientosRecientes || []).length}`,
      `Traslados: ${
        filteredMovements.filter((movement) => movement.tipoMovimiento === "TRASLADO").length
      }`,
      `Ajustes: ${
        filteredMovements.filter((movement) => movement.tipoMovimiento === "AJUSTE").length
      }`,
    ],
    [detail?.movimientosRecientes, filteredMovements],
  );

  const updateTablePagination = useCallback((key, updates) => {
    setTablePagination((current) => ({
      ...current,
      [key]: { ...current[key], ...updates },
    }));
  }, []);

  useEffect(() => {
    updateTablePagination("existences", { page: 1 });
  }, [existenceFilters, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("movements", { page: 1 });
  }, [movementFilters, updateTablePagination]);

  function resetExistenceFilters() {
    setExistenceFilters({
      search: "",
      locationId: "",
      condition: "",
      status: "",
      origin: "",
    });
    updateTablePagination("existences", { page: 1 });
  }

  function resetMovementFilters() {
    setMovementFilters({
      tipo: "",
      locationId: "",
      fecha: "",
    });
    updateTablePagination("movements", { page: 1 });
  }

  function openOperationModal(type, existence) {
    setOperationType(type);
    setSelectedExistence(existence);
    setOperationForm(emptyOperationForm(existence));
    setOperationError("");
  }

  function closeOperationModal() {
    if (operationSaving) return;
    setOperationType("");
    setSelectedExistence(null);
    setOperationError("");
  }

  function openAdjustmentModal(existence) {
    setAdjustmentForm(emptyAdjustmentForm(existence));
    setAdjustmentError("");
    setAdjustmentModalOpen(true);
  }

  async function handleSubmitOperation(event) {
    event.preventDefault();
    const amount = parsePositiveDecimal(operationForm.cantidad);

    if (!selectedExistence?.id) {
      setOperationError("Debes seleccionar una existencia válida.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setOperationError("Debes ingresar una cantidad decimal mayor a 0.");
      return;
    }
    if (amount > Number(selectedExistence.cantidadActual || 0)) {
      setOperationError("La cantidad no puede exceder el stock actual de la existencia.");
      return;
    }
    if (operationType === "exit" && !operationForm.motivo.trim()) {
      setOperationError("Debes ingresar un motivo para la salida.");
      return;
    }
    if (operationType === "transfer") {
      if (!operationForm.destinationLocationId) {
        setOperationError("Debes seleccionar una ubicación destino.");
        return;
      }
      if (String(operationForm.destinationLocationId) === String(selectedExistence.locationId)) {
        setOperationError("La ubicación destino debe ser distinta al origen.");
        return;
      }
    }

    setOperationSaving(true);
    setOperationError("");
    try {
      if (operationType === "consume") {
        await consumeInventory({
          existencia_id: Number(selectedExistence.id),
          cantidad: amount,
          observaciones: operationForm.observaciones.trim() || null,
        });
      }
      if (operationType === "exit") {
        await exitInventory({
          existencia_id: Number(selectedExistence.id),
          cantidad: amount,
          motivo: operationForm.motivo.trim(),
          observaciones: operationForm.observaciones.trim() || null,
        });
      }
      if (operationType === "transfer") {
        await transferInventory({
          existencia_id: Number(selectedExistence.id),
          destination_location_id: Number(operationForm.destinationLocationId),
          cantidad: amount,
          observaciones: operationForm.observaciones.trim() || null,
        });
      }

      setFeedback({ type: "success", message: "Operación registrada correctamente." });
      emitInventoryUpdated({ section: "item-detail", itemId: id });
      closeOperationModal();
      await loadDetail();
    } catch (requestError) {
      setOperationError(requestError.message || "No se pudo registrar la operación.");
    } finally {
      setOperationSaving(false);
    }
  }

  async function handleSubmitAdjustment(event) {
    event.preventDefault();
    const before = parsePositiveDecimal(adjustmentForm.cantidadAntes);
    const counted = parsePositiveDecimal(adjustmentForm.cantidadContada);

    if (!adjustmentForm.existenciaId || !adjustmentForm.itemId || !adjustmentForm.locationId) {
      setAdjustmentError("El ajuste debe partir desde una existencia válida.");
      return;
    }
    if (!adjustmentForm.motivo.trim()) {
      setAdjustmentError("Debes ingresar el motivo del ajuste.");
      return;
    }
    if (!Number.isFinite(before) || before < 0 || !Number.isFinite(counted) || counted < 0) {
      setAdjustmentError("Debes ingresar cantidades validas para el ajuste.");
      return;
    }

    setAdjustmentSaving(true);
    setAdjustmentError("");
    try {
      await createManualInventoryAdjustment({
        location_id: Number(adjustmentForm.locationId),
        motivo: adjustmentForm.motivo.trim(),
        observaciones: adjustmentForm.observaciones.trim() || null,
        detalles: [
          {
            item_id: Number(adjustmentForm.itemId),
            existencia_id: Number(adjustmentForm.existenciaId),
            cantidad_antes: before,
            cantidad_contada: counted,
          },
        ],
      });

      setFeedback({ type: "success", message: "Ajuste manual creado correctamente." });
      emitInventoryUpdated({ section: "item-detail", itemId: id });
      setAdjustmentModalOpen(false);
      await loadDetail();
    } catch (requestError) {
      setAdjustmentError(requestError.message || "No se pudo crear el ajuste.");
    } finally {
      setAdjustmentSaving(false);
    }
  }

  function renderTablePagination(key, paginated) {
    return (
      <PaginationControls
        page={paginated.currentPage}
        pageSize={paginated.pageSize}
        totalItems={paginated.totalItems}
        onPageChange={(page) => updateTablePagination(key, { page })}
        onPageSizeChange={(pageSize) => updateTablePagination(key, { page: 1, pageSize })}
      />
    );
  }

  if (loading) {
    return (
      <section className="inventory-page">
        <PageBreadcrumb moduleLabel="Inventario" moduleTo="/inventario" currentLabel="Detalle" />
        <header className="main-header">
          <h1>Detalle de item</h1>
          <p>Cargando existencias, distribucion y movimientos recientes.</p>
        </header>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="inventory-page">
        <PageBreadcrumb moduleLabel="Inventario" moduleTo="/inventario" currentLabel="Detalle" />
        <p className="error-text">{error || "No fue posible cargar el item."}</p>
      </section>
    );
  }

  return (
    <section className="inventory-page inventory-detail-page">
      <PageBreadcrumb moduleLabel="Inventario" moduleTo="/inventario" currentLabel="Detalle" />

     {feedback.message ? (
  <p
    className={
      feedback.type === "error"
        ? "error-text"
        : "inventory-success-banner"
    }
  >
    {feedback.message}
  </p>
) : null}

<header className="inventory-detail-hero">
  <div className="inventory-detail-hero-main">
    <p className="inventory-detail-eyebrow">
      {detail.item?.categoriaNombre || "Sin categoría"}
    </p>

    <h1>{detail.item?.nombre || "Ítem sin nombre"}</h1>

    <p className="inventory-detail-description">
      {detail.item?.descripcion ||
        "Sin descripción registrada para este ítem."}
    </p>

    <div className="inventory-hero-meta">
      <span>
        Unidad
        <strong>
          {detail.item?.unidadMedidaNombre || "Sin unidad"}
        </strong>
      </span>

      <span>
        Stock mínimo
        <strong>
          {detail.stockMinimo === null
            ? "Sin mínimo"
            : formatQuantity(detail.stockMinimo)}
        </strong>
      </span>

      <span>
        Estado
        <strong>{stockStateLabel(detail.estadoStock)}</strong>
      </span>
    </div>
  </div>

<div className="inventory-detail-hero-side">
  <div className="inventory-detail-stock-header">
    <span className="inventory-detail-stock-label">
      Stock disponible
    </span>

    <InventoryBadge
      tone={
        detail.estadoStock === "SIN_STOCK"
          ? "danger"
          : detail.estadoStock === "BAJO_MINIMO"
            ? "warning"
            : "success"
      }
    >
      {stockStateLabel(detail.estadoStock)}
    </InventoryBadge>
  </div>

  <div className="inventory-detail-stock-summary">
    <strong className="inventory-detail-hero-quantity">
      {formatQuantity(detail.cantidadTotal)}
    </strong>

    <span className="inventory-detail-stock-unit">
      {detail.item?.unidadMedidaNombre || "unidades"}
    </span>
  </div>

  <span className="inventory-detail-stock-caption">
    Existencia total registrada
  </span>
</div>
</header>

{detail.alertas?.length ? (
  <section
    className="inventory-alert-strip"
    aria-label="Alertas del ítem"
  >
    {detail.alertas.map((alerta) => (
      <InventoryBadge key={alerta} tone="warning">
        {alerta}
      </InventoryBadge>
    ))}
  </section>
) : null}

      <div className="settings-tabs home-tabs inventory-detail-tabs">
        {[
          { id: DETAIL_TABS.GENERAL, label: "General / Existencias" },
          { id: DETAIL_TABS.MOVEMENTS, label: "Movimientos" },
          { id: DETAIL_TABS.DOCUMENTS, label: "Donaciones y compras" },
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
      </div>

      {activeTab === DETAIL_TABS.GENERAL ? (
        <>
       {/*
       <section className="settings-kpi-grid inventory-kpi-grid">
            <article className="settings-kpi-card inventory-kpi-card">
              <span>Existencias</span>
              <strong>{detail.existencias.length}</strong>
              <small>Lotes o existencias especificas para este item.</small>
            </article>
            <article className="settings-kpi-card inventory-kpi-card">
              <span>Ubicaciones</span>
              <strong>{detail.distribucionPorUbicacion.length}</strong>
              <small>Distribucion visible segun tu alcance.</small>
            </article>
            <article className="settings-kpi-card inventory-kpi-card">
              <span>Movimientos recientes</span>
              <strong>{detail.movimientosRecientes.length}</strong>
              <small>Historial disponible para este item.</small>
            </article>
            <article className="settings-kpi-card inventory-kpi-card">
              <span>Documentos asociados</span>
              <strong>{detail.donacionesAsociadas.length + detail.comprasAsociadas.length}</strong>
              <small>Donaciones y compras relacionadas.</small>
            </article>
          </section>
          */}

          

          <SectionCard
            title="Existencias especificas"
            subtitle="Cada fila representa una existencia o lote operativo. Las acciones siguen trabajando por existencia_id."
          >
            {detail.existencias.length === 0 ? (
              <div className="settings-empty-state inventory-empty-state">
                Este item no tiene existencias visibles para tu alcance actual.
              </div>
            ) : (
              <>
                <div className="settings-filter-grid inventory-filter-grid">
                  <label className="settings-filter-field">
                    <span>Buscar</span>
                    <input
                      type="search"
                      value={existenceFilters.search}
                      onChange={(event) =>
                        setExistenceFilters((current) => ({
                          ...current,
                          search: event.target.value,
                        }))
                      }
                      placeholder="Ubicación, condicion, origen u observaciones"
                    />
                  </label>
                  <label className="settings-filter-field">
                    <span>Ubicación</span>
                    <select
                      value={existenceFilters.locationId}
                      onChange={(event) =>
                        setExistenceFilters((current) => ({
                          ...current,
                          locationId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Todas</option>
                      {existenceLocationOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-filter-field">
                    <span>Condicion</span>
                    <select
                      value={existenceFilters.condition}
                      onChange={(event) =>
                        setExistenceFilters((current) => ({
                          ...current,
                          condition: event.target.value,
                        }))
                      }
                    >
                      <option value="">Todas</option>
                      {Array.from(
                        new Set((detail?.existencias || []).map((existence) => existence.condicion).filter(Boolean)),
                      ).map((condition) => (
                        <option key={condition} value={condition}>
                          {condition}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-filter-field">
                    <span>Estado</span>
                    <select
                      value={existenceFilters.status}
                      onChange={(event) =>
                        setExistenceFilters((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="">Todos</option>
                      {Array.from(
                        new Set((detail?.existencias || []).map((existence) => existence.estado).filter(Boolean)),
                      ).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-filter-field">
                    <span>Origen</span>
                    <select
                      value={existenceFilters.origin}
                      onChange={(event) =>
                        setExistenceFilters((current) => ({
                          ...current,
                          origin: event.target.value,
                        }))
                      }
                    >
                      <option value="">Todos</option>
                      {Array.from(
                        new Set((detail?.existencias || []).map((existence) => existence.origenTipo).filter(Boolean)),
                      ).map((origin) => (
                        <option key={origin} value={origin}>
                          {origin}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <FilterSummaryBar stats={existenceStats} onClear={resetExistenceFilters} />
                <div className="table-scroll">
                <table className="crud-table inventory-table inventory-existence-table">
                  <thead>
                    <tr>
                      <th>Existencia</th>
                      <th>Ubicación</th>
                      <th>Cantidad actual</th>
                      <th>Vencimiento</th>
                      <th>Apertura</th>
                      <th>Condicion</th>
                      <th>Estado</th>
                      <th>Origen</th>
                      <th>Observaciones</th>
                      <th className="table-actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExistences.items.map((existence) => (
                      <tr key={existence.id}>
                        <td>#{existence.id}</td>
                        <td>{formatLocationLine(existence.location)}</td>
                        <td>{formatQuantity(existence.cantidadActual)}</td>
                        <td>{formatDate(existence.fechaVencimiento)}</td>
                        <td>{formatDate(existence.fechaApertura)}</td>
                        <td>{existence.condicion || "Sin condicion"}</td>
                        <td>{existence.estado || "Sin estado"}</td>
                        <td>{[existence.origenTipo, existence.origenId].filter(Boolean).join(" #") || "Sin origen"}</td>
                        <td>{existence.observaciones || "Sin observaciones"}</td>
                        <td className="table-actions-cell">
                          <div className="row-actions table-actions inventory-row-actions">
                            {canOperateMovement ? (
                              <>
                                <IconButton
                                  icon={PackageMinus}
                                  label="Consumir inventario"
                                  variant="warning"
                                  onClick={() => openOperationModal("consume", existence)}
                                />
                                <IconButton
                                  icon={ArrowRightFromLine}
                                  label="Registrar salida de inventario"
                                  variant="secondary"
                                  onClick={() => openOperationModal("exit", existence)}
                                />
                                <IconButton
                                  icon={ArrowRightLeft}
                                  label="Trasladar inventario"
                                  variant="primary"
                                  onClick={() => openOperationModal("transfer", existence)}
                                />
                              </>
                            ) : null}
                            {canCreateAdjustments ? (
                              <IconButton
                                icon={SlidersHorizontal}
                                label="Ajustar inventario"
                                variant="secondary"
                                onClick={() => openAdjustmentModal(existence)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {renderTablePagination("existences", paginatedExistences)}
              </>
            )}
          </SectionCard>
          <SectionCard
            title="Distribucion por ubicación"
            subtitle="Suma total y número de existencias por ubicación dentro de tu alcance actual."
          >
            {detail.distribucionPorUbicacion.length === 0 ? (
              <div className="settings-empty-state inventory-empty-state">No hay distribucion visible.</div>
            ) : (
              <div className="inventory-distribution-list">
                {detail.distribucionPorUbicacion.map((entry) => (
                  <article key={entry.location?.id || entry.location?.ubicacion_id} className="inventory-distribution-card">
                    <strong>{entry.location?.nombre_ubicacion || entry.location?.nombre || "Sin ubicación"}</strong>
                    <span>{entry.location?.comuna?.nombre || entry.location?.comuna || "Sin comuna"}</span>
                    <div className="inventory-distribution-metrics">
                      <span>{formatQuantity(entry.cantidadTotal)} unidades</span>
                      <span>{entry.existencias} existencias</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      ) : null}

      {activeTab === DETAIL_TABS.MOVEMENTS ? (
        <SectionCard
          title="Movimientos del item"
          subtitle="Historial reciente del item, filtrable por tipo, ubicación y fecha."
        >
          <div className="settings-filter-grid inventory-filter-grid">
            <label className="settings-filter-field">
              <span>Tipo</span>
              <select
                value={movementFilters.tipo}
                onChange={(event) => setMovementFilters((current) => ({ ...current, tipo: event.target.value }))}
              >
                <option value="">Todos</option>
                {["ENTRADA", "SALIDA", "CONSUMO", "TRASLADO", "AJUSTE"].map((value) => (
                  <option key={value} value={value}>
                    {movementLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-filter-field">
              <span>Ubicación</span>
              <select
                value={movementFilters.locationId}
                onChange={(event) => setMovementFilters((current) => ({ ...current, locationId: event.target.value }))}
              >
                <option value="">Todas</option>
                {movementLocationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-filter-field">
              <span>Fecha</span>
              <input
                type="date"
                value={movementFilters.fecha}
                onChange={(event) => setMovementFilters((current) => ({ ...current, fecha: event.target.value }))}
              />
            </label>
          </div>

          <FilterSummaryBar stats={movementStats} onClear={resetMovementFilters} />

          {filteredMovements.length === 0 ? (
            <div className="settings-empty-state inventory-empty-state">
              No hay movimientos que coincidan con los filtros seleccionados.
            </div>
          ) : (
            <>
              <div className="table-scroll">
              <table className="crud-table inventory-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Cantidad</th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Usuario</th>
                    <th>Referencia</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.items.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movementLabel(movement.tipoMovimiento)}</td>
                      <td>{formatDate(movement.fechaMovimiento)}</td>
                      <td>{formatQuantity(movement.cantidad)}</td>
                      <td>{formatLocationLine(movement.sourceLocation)}</td>
                      <td>{formatLocationLine(movement.destinationLocation)}</td>
                      <td>{formatPersonName(movement.performedBy)}</td>
                      <td>{[movement.referenciaTipo, movement.referenciaId].filter(Boolean).join(" #") || "Sin referencia"}</td>
                      <td>{movement.observaciones || "Sin observaciones"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {renderTablePagination("movements", paginatedMovements)}
            </>
          )}
        </SectionCard>
      ) : null}

      {activeTab === DETAIL_TABS.DOCUMENTS ? (
        <div className="inventory-detail-grid-large">
          <SectionCard
            title="Donaciones asociadas"
            subtitle="Líneas de donación que generaron o alimentan existencias de este item."
          >
            {detail.donacionesAsociadas.length === 0 ? (
              <div className="settings-empty-state inventory-empty-state">No hay donaciones asociadas visibles.</div>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table inventory-table">
                  <thead>
                    <tr>
                      <th>Donación</th>
                      <th>Cantidad</th>
                      <th>Recepcionada</th>
                      <th>Estado</th>
                      <th>Cierre parcial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDonations.items.map((line) => (
                      <tr key={line.id}>
                        <td>{line.donation?.motivo || `Línea#${line.id}`}</td>
                        <td>{formatQuantity(line.cantidad)}</td>
                        <td>{formatQuantity(line.cantidadRecepcionada)}</td>
                        <td>{line.estado}</td>
                        <td>{line.recepcionParcialDefinitiva ? "Si" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {renderTablePagination("donations", paginatedDonations)}
              </>
            )}
          </SectionCard>

          <SectionCard title="Compras asociadas" subtitle="Líneas de compra relacionadas con este item.">
            {detail.comprasAsociadas.length === 0 ? (
              <div className="settings-empty-state inventory-empty-state">No hay compras asociadas visibles.</div>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table inventory-table">
                  <thead>
                    <tr>
                      <th>Compra</th>
                      <th>Cantidad</th>
                      <th>Recepcionada</th>
                      <th>Subtotal</th>
                      <th>Estado</th>
                      <th>Cierre parcial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPurchases.items.map((line) => (
                      <tr key={line.id}>
                        <td>{line.purchase?.id ? `Compra #${line.purchase.id}` : `Línea#${line.id}`}</td>
                        <td>{formatQuantity(line.cantidad)}</td>
                        <td>{formatQuantity(line.cantidadRecepcionada)}</td>
                        <td>{formatCurrency(line.subtotal)}</td>
                        <td>{line.estado}</td>
                        <td>{line.recepcionParcialDefinitiva ? "Si" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {renderTablePagination("purchases", paginatedPurchases)}
              </>
            )}
          </SectionCard>
        </div>
      ) : null}

      <InventoryModal
        isOpen={Boolean(operationType)}
        title={
          operationType === "consume"
            ? "Registrar consumo"
            : operationType === "exit"
              ? "Registrar salida"
              : "Registrar traslado"
        }
        submitLabel={
          operationType === "consume"
            ? "Registrar consumo"
            : operationType === "exit"
              ? "Registrar salida"
              : "Registrar traslado"
        }
        error={operationError}
        isSaving={operationSaving}
        onClose={closeOperationModal}
        onSubmit={handleSubmitOperation}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Existencia</span>
            <input type="text" value={selectedExistence ? `#${selectedExistence.id}` : ""} readOnly />
          </label>
          <label className="settings-form-field">
            <span>Stock actual</span>
            <input
              type="text"
              value={selectedExistence ? formatQuantity(selectedExistence.cantidadActual) : ""}
              readOnly
            />
          </label>
          <label className="settings-form-field">
            <span>Cantidad</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={operationForm.cantidad}
              onChange={(event) => setOperationForm((current) => ({ ...current, cantidad: event.target.value }))}
            />
          </label>
          {operationType === "exit" ? (
            <label className="settings-form-field">
              <span>Motivo</span>
              <input
                type="text"
                value={operationForm.motivo}
                onChange={(event) => setOperationForm((current) => ({ ...current, motivo: event.target.value }))}
              />
            </label>
          ) : null}
          {operationType === "transfer" ? (
            <label className="settings-form-field">
              <span>Ubicación destino</span>
              <select
                value={operationForm.destinationLocationId}
                onChange={(event) =>
                  setOperationForm((current) => ({
                    ...current,
                    destinationLocationId: event.target.value,
                  }))
                }
              >
                <option value="">Selecciona una ubicación</option>
                {locations
                  .filter((item) => String(item.id) !== String(selectedExistence?.locationId))
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="4"
              value={operationForm.observaciones}
              onChange={(event) =>
                setOperationForm((current) => ({
                  ...current,
                  observaciones: event.target.value,
                }))
              }
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={adjustmentModalOpen}
        title="Crear ajuste manual contextual"
        submitLabel="Crear ajuste"
        error={adjustmentError}
        isSaving={adjustmentSaving}
        onClose={() => {
          if (!adjustmentSaving) setAdjustmentModalOpen(false);
        }}
        onSubmit={handleSubmitAdjustment}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Existencia</span>
            <input type="text" value={adjustmentForm.existenciaId ? `#${adjustmentForm.existenciaId}` : ""} readOnly />
          </label>
          <label className="settings-form-field">
            <span>Cantidad antes</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={adjustmentForm.cantidadAntes}
              onChange={(event) =>
                setAdjustmentForm((current) => ({ ...current, cantidadAntes: event.target.value }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Cantidad contada</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={adjustmentForm.cantidadContada}
              onChange={(event) =>
                setAdjustmentForm((current) => ({ ...current, cantidadContada: event.target.value }))
              }
            />
          </label>
          <label className="settings-form-field">
            <span>Motivo</span>
            <input
              type="text"
              value={adjustmentForm.motivo}
              onChange={(event) =>
                setAdjustmentForm((current) => ({ ...current, motivo: event.target.value }))
              }
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="4"
              value={adjustmentForm.observaciones}
              onChange={(event) =>
                setAdjustmentForm((current) => ({ ...current, observaciones: event.target.value }))
              }
            />
          </label>
        </div>
      </InventoryModal>
    </section>
  );
}
