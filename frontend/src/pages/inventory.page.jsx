import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, MinusCircle, Pencil, PowerOff, SlidersHorizontal, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import FilterSummaryBar from "../components/FilterSummaryBar";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import PaginationControls from "../components/PaginationControls";
import BulkReceiptModal from "../components/inventory/reports/BulkReceiptModal";
import DonorCombobox from "../components/inventory/reports/DonorCombobox";
import InventoryStatusBadge from "../components/inventory/reports/InventoryStatusBadge";
import InventoryReportsPanel from "../components/inventory/reports/InventoryReportsPanel";
import { PERMISSIONS } from "../config/permissions";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { getComunas } from "../services/comuna.service";
import {
  createDonation,
  deleteDonation,
  getDonation,
  getDonations,
  updateDonation,
} from "../services/donation.service";
import {
  createDonor,
  deleteDonor,
  getDonors,
  updateDonor,
} from "../services/donor.service";
import {
  createDonationItem,
  deleteDonationItem,
  receiveDonationItemsBulk,
  receiveDonationItem,
  updateDonationItem,
} from "../services/donation_item.service";
import {
  applyInventoryAdjustment,
  createAdjustmentFromStockCount,
  createManualInventoryAdjustment,
  getInventoryAdjustment,
  getInventoryAdjustments,
} from "../services/inventory_adjustment.service";
import { getInventoryMovements } from "../services/inventory_movement.service";
import {
  createInitialInventoryLoad,
  getInventorySummary,
} from "../services/inventory.service";
import { getInventoryExistences } from "../services/inventory_existence.service";
import {
  createItem,
  deleteItem,
  getItems,
  updateItem,
} from "../services/item.service";
import {
  createItemCategory,
  deleteItemCategory,
  getItemCategories,
  updateItemCategory,
} from "../services/item_category.service";
import { getLocations } from "../services/location.service";
import {
  confirmPurchase,
  createPurchase,
  deletePurchase,
  getPurchase,
  getPurchases,
  revertPurchaseToDraft,
  updatePurchase,
} from "../services/purchase.service";
import {
  createPurchaseDetail,
  deletePurchaseDetail,
  receivePurchaseDetailsBulk,
  receivePurchaseDetail,
  updatePurchaseDetail,
} from "../services/purchase_detail.service";
import { getRegions } from "../services/region.service";
import {
  createStockCount,
  getStockCount,
  getStockCounts,
} from "../services/stock_count.service";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from "../services/supplier.service";
import {
  createUnitOfMeasure,
  deleteUnitOfMeasure,
  getUnitsOfMeasure,
  updateUnitOfMeasure,
} from "../services/unit_of_measure.service";
import "../styles/home.page.css";
import "../styles/settings.page.css";
import "../styles/inventory.page.css";
import { paginateCollection } from "../utils/pagination";
import {
  findMatchingDonor,
  formatInstagramUsername,
  normalizeDonorEmail,
  normalizeInstagramUsername,
  validateInlineDonor,
} from "../utils/donor";
import {
  getDonationGeneralStatus,
  inventoryStatusLabel,
} from "../utils/inventory-status";
import {
  buildLocationPayload,
  emitInventoryUpdated,
  formatDate,
  formatLocationLine,
  formatPersonName,
  formatQuantity,
  getDonationActionState,
  getDonationItemActionState,
  getPurchaseActionState,
  getPurchaseDetailActionState,
  getSupplierActionState,
  INVENTORY_UPDATED_EVENT,
  movementLabel,
  parsePositiveDecimal,
  stockStateLabel,
  yesNoLabel,
  adjustmentStateLabel,
} from "../utils/inventory-ui";
import {
  formatMoney,
  SUPPORTED_FINANCIAL_CURRENCIES,
} from "../utils/financial";
import {
  calculatePurchaseSubtotal,
  calculatePurchaseTotal,
  parseEntityIdOrThrow,
} from "../utils/inventory-purchase-flow";

const MAIN_TABS = {
  INVENTORY: "inventory",
  REPORTS: "reports",
  DONATIONS: "donations",
  PURCHASES: "purchases",
  CONTROL: "control",
  CATALOG: "catalog",
};

const PURCHASE_TABS = {
  PURCHASES: "purchases",
  SUPPLIERS: "suppliers",
};

const DONATION_TABS = {
  DONATIONS: "donations",
  DONORS: "donors",
};

const CONTROL_TABS = {
  COUNTS: "counts",
  ADJUSTMENTS: "adjustments",
  INITIAL_LOAD: "initial_load",
  MOVEMENTS: "movements",
};

const CATALOG_TABS = {
  ITEMS: "items",
  CATEGORIES: "categories",
  UNITS: "units",
};

const STOCK_STATE_OPTIONS = ["OK", "BAJO_MINIMO", "SIN_STOCK"];
const MOVEMENT_TYPE_OPTIONS = ["ENTRADA", "SALIDA", "CONSUMO", "TRASLADO", "AJUSTE"];
const ITEM_CONDITION_OPTIONS = ["NUEVO", "USADO_BUENO", "USADO_MALO", "DEFECTUOSO"];
const DEFAULT_PAGE_SIZE = 10;
const INVENTORY_SWAL_Z_INDEX = 2147483647;

function placeInventorySwalAboveModals(popup) {
  const container = popup?.closest?.(".swal2-container") || Swal.getContainer();

  if (container) {
    container.style.setProperty(
      "z-index",
      String(INVENTORY_SWAL_Z_INDEX),
      "important",
    );
  }
}

function fireInventorySwal(options = {}) {
  const { willOpen, didOpen, ...swalOptions } = options;

  return Swal.fire({
    ...swalOptions,
    willOpen: (popup) => {
      placeInventorySwalAboveModals(popup);
      if (typeof willOpen === "function") {
        willOpen(popup);
      }
    },
    didOpen: (popup) => {
      placeInventorySwalAboveModals(popup);
      if (typeof didOpen === "function") {
        didOpen(popup);
      }
    },
  });
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyInitialLoadForm(itemId = "") {
  return {
    itemId: itemId ? String(itemId) : "",
    ubicacionId: "",
    cantidad: "",
    fechaVencimiento: "",
    fechaApertura: "",
    condicion: "",
    observaciones: "",
  };
}

function emptyDonationForm(regionId = "") {
  return {
    motivoDonacion: "",
    donorId: "",
    puntoEncuentro: "",
    fechaRegistro: todayValue(),
    observaciones: "",
    regionId: regionId ? String(regionId) : "",
  };
}

function emptyDonationItemForm(donationId = "") {
  return {
    donationId: donationId ? String(donationId) : "",
    itemId: "",
    cantidad: "",
    condicion: "NUEVO",
    fechaVencimiento: "",
    fechaApertura: "",
    condicionesAlmacenamiento: "",
    observaciones: "",
  };
}

function emptyReceiveForm(lineId = "") {
  return {
    lineId: lineId ? String(lineId) : "",
    receiptDate: todayValue(),
    destinationLocationId: "",
    idempotencyKey: "",
    cantidad: "",
    condicion: "",
    fechaVencimiento: "",
    fechaApertura: "",
    condicionesAlmacenamiento: "",
    observaciones: "",
    cierraDetalle: false,
  };
}

function generateReceiptIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `receipt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyPurchaseForm(supplierId = "") {
  return {
    supplierId: supplierId ? String(supplierId) : "",
    fechaCompra: todayValue(),
    moneda: "CLP",
    fechaVencimientoPago: "",
    observacionFinanciera: "",
    descripcion: "",
    observaciones: "",
  };
}

function emptyPurchaseDetailForm(purchaseId = "") {
  return {
    purchaseId: purchaseId ? String(purchaseId) : "",
    itemId: "",
    cantidad: "",
    precioUnitario: "",
    subtotal: "",
    condicion: "NUEVO",
    fechaVencimiento: "",
    fechaApertura: "",
    condicionesAlmacenamiento: "",
    observaciones: "",
  };
}

function emptySupplierForm() {
  return {
    nombre: "",
    telefono: "",
    email: "",
    observaciones: "",
    activo: true,
    hasLocation: false,
    direccion: "",
    regionId: "",
    comunaId: "",
    locationObservaciones: "",
  };
}

function emptyDonorForm() {
  return {
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    usuarioInstagram: "",
    direccion: "",
    observaciones: "",
    activo: true,
  };
}

function emptyStockCountDetailRow() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    itemId: "",
    existenciaId: "",
    cantidadContada: "",
    observaciones: "",
  };
}

function emptyStockCountForm() {
  return {
    fechaConteo: todayValue(),
    locationId: "",
    observaciones: "",
    detalles: [emptyStockCountDetailRow()],
  };
}

function emptyAdjustmentDetailRow(itemId = "", existence = null) {
  return {
    key: `${Date.now()}-${Math.random()}`,
    itemId: itemId ? String(itemId) : "",
    existenciaId: existence?.id ? String(existence.id) : "",
    cantidadAntes:
      existence?.cantidadActual !== undefined && existence?.cantidadActual !== null
        ? String(existence.cantidadActual)
        : "",
    cantidadContada: "",
  };
}

function emptyAdjustmentForm(context = {}) {
  return {
    locationId: context.locationId ? String(context.locationId) : "",
    motivo: context.motivo || "",
    observaciones: "",
    detalles: [emptyAdjustmentDetailRow(context.itemId, context.existence || null)],
  };
}

function emptyAdjustmentFromCountForm(stockCountId = "") {
  return {
    stockCountId: stockCountId ? String(stockCountId) : "",
    motivo: "",
    observaciones: "",
  };
}

function emptyItemForm() {
  return {
    nombre: "",
    descripcion: "",
    stockMinimo: "",
    activo: true,
    categoriaId: "",
    unidadId: "",
  };
}

function emptyCategoryForm() {
  return {
    nombre: "",
    activo: true,
  };
}

function emptyUnitForm() {
  return {
    nombre: "",
    descripcion: "",
    activo: true,
  };
}

function InventoryModal({
  isOpen,
  title,
  submitLabel,
  isSaving,
  error,
  onClose,
  onSubmit,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="event-modal inventory-modal-shell">
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

function InventoryReadOnlyModal({
  isOpen,
  title,
  onClose,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="event-modal inventory-modal-shell">
        <div className="event-modal-header">
          <h3>{title}</h3>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="inventory-modal-form">
          {children}
          <div className="event-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventorySection({ title, subtitle, actions, children }) {
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

function InventoryBadge({ tone = "neutral", children }) {
  return (
    <span className={`inventory-badge inventory-badge-${tone}`}>{children}</span>
  );
}

function InventoryKpi({ label, value, hint }) {
  return (
    <article className="settings-kpi-card inventory-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function InventoryEmptyState({ children }) {
  return <div className="settings-empty-state inventory-empty-state">{children}</div>;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canReadInventoryGlobal = hasPermission(PERMISSIONS.INVENTORY.READ_ANY);
  const isLocationOnlyInventoryView =
    hasPermission(PERMISSIONS.INVENTORY.READ_LOCATION) && !canReadInventoryGlobal;

  const canReadInventory = hasAnyPermission([
    PERMISSIONS.INVENTORY.READ_ANY,
    PERMISSIONS.INVENTORY.READ_LOCATION,
    PERMISSIONS.INVENTORY.ITEM_READ,
  ]);
  const canReadExistences = hasAnyPermission([
    PERMISSIONS.INVENTORY.READ_ANY,
    PERMISSIONS.INVENTORY.READ_LOCATION,
    PERMISSIONS.INVENTORY.EXISTENCE_READ,
  ]);
  const canReadInventoryExistenceReports = canReadExistences;
  const canReadMovements = hasAnyPermission([
    PERMISSIONS.INVENTORY.READ_ANY,
    PERMISSIONS.INVENTORY.READ_LOCATION,
    PERMISSIONS.INVENTORY.MOVEMENT_READ,
  ]);
  const canCreateInitialLoad = hasAnyPermission([
    PERMISSIONS.INVENTORY.INITIAL_LOAD_CREATE,
    PERMISSIONS.INVENTORY.INVENTORY_MOVEMENT_CREATE,
  ]);
  const canReadDonations = hasPermission(PERMISSIONS.INVENTORY.DONATION_READ);
  const canCreateDonations = hasPermission(PERMISSIONS.INVENTORY.DONATION_CREATE);
  const canUpdateDonations = hasPermission(PERMISSIONS.INVENTORY.DONATION_UPDATE);
  const canDeleteDonations = hasPermission(PERMISSIONS.INVENTORY.DONATION_DELETE);
  const canCreateDonationItems = hasPermission(PERMISSIONS.INVENTORY.DONATION_ITEM_CREATE);
  const canUpdateDonationItems = hasPermission(PERMISSIONS.INVENTORY.DONATION_ITEM_UPDATE);
  const canDeleteDonationItems = hasPermission(PERMISSIONS.INVENTORY.DONATION_ITEM_DELETE);
  const canReceiveDonationItems = hasPermission(PERMISSIONS.INVENTORY.DONATION_ITEM_UPDATE);
  const canReadPurchases = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_READ);
  const canCreatePurchases = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_CREATE);
  const canUpdatePurchases = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_UPDATE);
  const canDeletePurchases = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_DELETE);
  const canCreatePurchaseDetails = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_DETAIL_CREATE);
  const canUpdatePurchaseDetails = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_DETAIL_UPDATE);
  const canDeletePurchaseDetails = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_DETAIL_DELETE);
  const canReceivePurchaseDetails = hasPermission(PERMISSIONS.INVENTORY.PURCHASE_DETAIL_UPDATE);
  const canReadSuppliers = hasPermission(PERMISSIONS.INVENTORY.SUPPLIER_READ);
  const canCreateSuppliers = hasPermission(PERMISSIONS.INVENTORY.SUPPLIER_CREATE);
  const canUpdateSuppliers = hasPermission(PERMISSIONS.INVENTORY.SUPPLIER_UPDATE);
  const canDeleteSuppliers = hasPermission(PERMISSIONS.INVENTORY.SUPPLIER_DELETE);
  const canReadCounts = hasAnyPermission([
    PERMISSIONS.INVENTORY.STOCK_COUNT_READ,
    PERMISSIONS.INVENTORY.READ_LOCATION,
  ]);
  const canCreateCounts = hasAnyPermission([
    PERMISSIONS.INVENTORY.STOCK_COUNT_CREATE,
    PERMISSIONS.INVENTORY.STOCK_COUNT_CREATE_LOCATION,
  ]);
  const canReadAdjustments = hasAnyPermission([
    PERMISSIONS.INVENTORY.ADJUSTMENT_READ,
    PERMISSIONS.INVENTORY.READ_LOCATION,
  ]);
  const canCreateAdjustments = hasAnyPermission([
    PERMISSIONS.INVENTORY.ADJUSTMENT_CREATE,
    PERMISSIONS.INVENTORY.ADJUSTMENT_CREATE_ANY,
    PERMISSIONS.INVENTORY.ADJUSTMENT_CREATE_LOCATION,
  ]);
  const canReadInventoryCountsAdjustmentsReports =
    hasPermission(PERMISSIONS.INVENTORY.STOCK_COUNT_READ)
    && hasPermission(PERMISSIONS.INVENTORY.ADJUSTMENT_READ);
  const canExportInventoryReports = hasPermission(PERMISSIONS.INVENTORY.REPORT_EXPORT);
  const canApplyAdjustments = hasAnyPermission([
    PERMISSIONS.INVENTORY.ADJUSTMENT_UPDATE,
    PERMISSIONS.INVENTORY.ADJUSTMENT_APPLY_ANY,
    PERMISSIONS.INVENTORY.ADJUSTMENT_CREATE_LOCATION,
  ]);
  const canReadItems = hasPermission(PERMISSIONS.INVENTORY.ITEM_READ);
  const canCreateItems = hasPermission(PERMISSIONS.INVENTORY.ITEM_CREATE);
  const canUpdateItems = hasPermission(PERMISSIONS.INVENTORY.ITEM_UPDATE);
  const canDeleteItems = hasPermission(PERMISSIONS.INVENTORY.ITEM_DELETE);
  const canReadCategories = hasPermission(PERMISSIONS.INVENTORY.ITEM_CATEGORY_READ);
  const canCreateCategories = hasPermission(PERMISSIONS.INVENTORY.ITEM_CATEGORY_CREATE);
  const canUpdateCategories = hasPermission(PERMISSIONS.INVENTORY.ITEM_CATEGORY_UPDATE);
  const canDeleteCategories = hasPermission(PERMISSIONS.INVENTORY.ITEM_CATEGORY_DELETE);
  const canReadUnits = hasPermission(PERMISSIONS.INVENTORY.UNIT_READ);
  const canCreateUnits = hasPermission(PERMISSIONS.INVENTORY.UNIT_CREATE);
  const canUpdateUnits = hasPermission(PERMISSIONS.INVENTORY.UNIT_UPDATE);
  const canDeleteUnits = hasPermission(PERMISSIONS.INVENTORY.UNIT_DELETE);
  const canReadLocations = hasPermission(PERMISSIONS.INVENTORY.LOCATION_READ);
  const canReadDonors = hasPermission(PERMISSIONS.ACCOUNTING.DONOR_READ);
  const canCreateDonors = hasPermission(PERMISSIONS.ACCOUNTING.DONOR_CREATE);
  const canUpdateDonors = hasPermission(PERMISSIONS.ACCOUNTING.DONOR_UPDATE);

  const [activeTab, setActiveTab] = useState(MAIN_TABS.INVENTORY);
  const [activeDonationTab, setActiveDonationTab] = useState(DONATION_TABS.DONATIONS);
  const [activePurchaseTab, setActivePurchaseTab] = useState(PURCHASE_TABS.PURCHASES);
  const [activeControlTab, setActiveControlTab] = useState(CONTROL_TABS.COUNTS);
  const [activeCatalogTab, setActiveCatalogTab] = useState(CATALOG_TABS.ITEMS);
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);

  const [loading, setLoading] = useState({
    bootstrap: true,
    summary: false,
    donations: false,
    donors: false,
    purchases: false,
    suppliers: false,
    counts: false,
    adjustments: false,
    movements: false,
    catalogItems: false,
    categories: false,
    units: false,
  });
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const [regions, setRegions] = useState([]);
  const [comunasByRegion, setComunasByRegion] = useState({});
  const [locations, setLocations] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [donors, setDonors] = useState([]);
  const [donations, setDonations] = useState([]);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [stockCounts, setStockCounts] = useState([]);
  const [selectedStockCount, setSelectedStockCount] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [movements, setMovements] = useState([]);
  const [existencesByLocation, setExistencesByLocation] = useState({});

  const [summaryFilters, setSummaryFilters] = useState({
    search: "",
    categoriaId: "",
    estadoStock: "",
    soloBajoMinimo: false,
    activo: "",
    mostrarSinStock: false,
  });
  const [donationFilters, setDonationFilters] = useState({
    search: "",
    status: "",
    regionId: "",
    userId: "",
    fecha: "",
  });
  const [purchaseFilters, setPurchaseFilters] = useState({
    search: "",
    status: "",
    supplierId: "",
    fecha: "",
  });
  const [donorFilters, setDonorFilters] = useState({
    search: "",
    status: "",
  });
  const [countFilters, setCountFilters] = useState({
    search: "",
    locationId: "",
    userId: "",
    fecha: "",
  });
  const [adjustmentFilters, setAdjustmentFilters] = useState({
    search: "",
    status: "",
    locationId: "",
    source: "",
    fecha: "",
  });
  const [movementFilters, setMovementFilters] = useState({
    itemId: "",
    locationId: "",
    tipo: "",
    search: "",
  });
  const [tablePagination, setTablePagination] = useState({
    summary: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    donations: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    donors: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    donationLines: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    purchases: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    purchaseLines: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    suppliers: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    counts: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    countDetails: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    adjustments: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    adjustmentDetails: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    movements: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    items: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    categories: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    units: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
  });

  const [initialLoadModalOpen, setInitialLoadModalOpen] = useState(false);
  const [initialLoadForm, setInitialLoadForm] = useState(emptyInitialLoadForm());
  const [initialLoadError, setInitialLoadError] = useState("");
  const [initialLoadSaving, setInitialLoadSaving] = useState(false);

  const [donationModalOpen, setDonationModalOpen] = useState(false);
  const [donationFormMode, setDonationFormMode] = useState("create");
  const [editingDonationId, setEditingDonationId] = useState("");
  const [donationForm, setDonationForm] = useState(emptyDonationForm());
  const [donationFormError, setDonationFormError] = useState("");
  const [donationSaving, setDonationSaving] = useState(false);
  const [inlineDonorOpen, setInlineDonorOpen] = useState(false);
  const [inlineDonorForm, setInlineDonorForm] = useState(emptyDonorForm());
  const [inlineDonorErrors, setInlineDonorErrors] = useState({});
  const [inlineDonorSaving, setInlineDonorSaving] = useState(false);
  const [inlineDonorMatch, setInlineDonorMatch] = useState(null);
  const [inlineDonorNotice, setInlineDonorNotice] = useState("");

  const [donationItemModalOpen, setDonationItemModalOpen] = useState(false);
  const [editingDonationItemId, setEditingDonationItemId] = useState("");
  const [donationItemForm, setDonationItemForm] = useState(emptyDonationItemForm());
  const [donationItemError, setDonationItemError] = useState("");
  const [donationItemSaving, setDonationItemSaving] = useState(false);

  const [donationReceiveModalOpen, setDonationReceiveModalOpen] = useState(false);
  const [donationReceiveForm, setDonationReceiveForm] = useState(emptyReceiveForm());
  const [donationReceiveError, setDonationReceiveError] = useState("");
  const [donationReceiveSaving, setDonationReceiveSaving] = useState(false);
  const [donationBulkReceiptOpen, setDonationBulkReceiptOpen] = useState(false);
  const [donationBulkReceiptSaving, setDonationBulkReceiptSaving] = useState(false);
  const [donationBulkReceiptError, setDonationBulkReceiptError] = useState("");
  const [donationReceiptHistoryOpen, setDonationReceiptHistoryOpen] = useState(false);
  const [selectedDonationReceiptLine, setSelectedDonationReceiptLine] = useState(null);

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseFormMode, setPurchaseFormMode] = useState("create");
  const [editingPurchaseId, setEditingPurchaseId] = useState("");
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm());
  const [purchaseFormError, setPurchaseFormError] = useState("");
  const [purchaseSaving, setPurchaseSaving] = useState(false);

  const [purchaseDetailModalOpen, setPurchaseDetailModalOpen] = useState(false);
  const [editingPurchaseDetailId, setEditingPurchaseDetailId] = useState("");
  const [purchaseDetailForm, setPurchaseDetailForm] = useState(emptyPurchaseDetailForm());
  const [purchaseDetailError, setPurchaseDetailError] = useState("");
  const [purchaseDetailSaving, setPurchaseDetailSaving] = useState(false);

  const [purchaseReceiveModalOpen, setPurchaseReceiveModalOpen] = useState(false);
  const [purchaseReceiveForm, setPurchaseReceiveForm] = useState(emptyReceiveForm());
  const [purchaseReceiveError, setPurchaseReceiveError] = useState("");
  const [purchaseReceiveSaving, setPurchaseReceiveSaving] = useState(false);
  const [purchaseBulkReceiptOpen, setPurchaseBulkReceiptOpen] = useState(false);
  const [purchaseBulkReceiptSaving, setPurchaseBulkReceiptSaving] = useState(false);
  const [purchaseBulkReceiptError, setPurchaseBulkReceiptError] = useState("");
  const [purchaseReceiptHistoryOpen, setPurchaseReceiptHistoryOpen] = useState(false);
  const [selectedPurchaseReceiptLine, setSelectedPurchaseReceiptLine] = useState(null);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierFormMode, setSupplierFormMode] = useState("create");
  const [editingSupplierId, setEditingSupplierId] = useState("");
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm());
  const [supplierFormError, setSupplierFormError] = useState("");
  const [supplierSaving, setSupplierSaving] = useState(false);

  const [donorModalOpen, setDonorModalOpen] = useState(false);
  const [donorFormMode, setDonorFormMode] = useState("create");
  const [editingDonorId, setEditingDonorId] = useState("");
  const [donorForm, setDonorForm] = useState(emptyDonorForm());
  const [donorFormError, setDonorFormError] = useState("");
  const [donorSaving, setDonorSaving] = useState(false);

  const [stockCountModalOpen, setStockCountModalOpen] = useState(false);
  const [stockCountForm, setStockCountForm] = useState(emptyStockCountForm());
  const [stockCountFormError, setStockCountFormError] = useState("");
  const [stockCountSaving, setStockCountSaving] = useState(false);

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustmentForm());
  const [adjustmentError, setAdjustmentError] = useState("");
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);

  const [adjustmentFromCountModalOpen, setAdjustmentFromCountModalOpen] = useState(false);
  const [adjustmentFromCountForm, setAdjustmentFromCountForm] = useState(
    emptyAdjustmentFromCountForm(),
  );
  const [adjustmentFromCountError, setAdjustmentFromCountError] = useState("");
  const [adjustmentFromCountSaving, setAdjustmentFromCountSaving] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState("");
  const [itemForm, setItemForm] = useState(emptyItemForm());
  const [itemFormError, setItemFormError] = useState("");
  const [itemSaving, setItemSaving] = useState(false);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm());
  const [categoryFormError, setCategoryFormError] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState("");
  const [unitForm, setUnitForm] = useState(emptyUnitForm());
  const [unitFormError, setUnitFormError] = useState("");
  const [unitSaving, setUnitSaving] = useState(false);

  const visibleTabs = useMemo(
    () =>
      [
        {
          id: MAIN_TABS.INVENTORY,
          label: "Inventario",
          visible: canReadInventory || canCreateInitialLoad || canCreateAdjustments,
        },
        {
          id: MAIN_TABS.REPORTS,
          label: "Informes",
          visible: canReadInventoryExistenceReports || canReadInventoryCountsAdjustmentsReports,
        },
        {
          id: MAIN_TABS.DONATIONS,
          label: "Donaciones",
          visible:
            canReadDonations
            || canCreateDonations
            || canCreateDonationItems
            || canReceiveDonationItems
            || canReadDonors
            || canCreateDonors,
        },
        {
          id: MAIN_TABS.PURCHASES,
          label: "Compras",
          visible:
            canReadPurchases || canCreatePurchases || canReadSuppliers || canCreateSuppliers,
        },
        {
          id: MAIN_TABS.CONTROL,
          label: "Control de inventario",
          visible:
            canReadCounts || canCreateCounts || canReadAdjustments || canCreateAdjustments || canReadMovements,
        },
        {
          id: MAIN_TABS.CATALOG,
          label: "Catálogo",
          visible:
            canReadItems
            || canCreateItems
            || canReadCategories
            || canReadUnits
            || canCreateCategories
            || canCreateUnits,
        },
      ].filter((tab) => tab.visible),
    [
      canCreateAdjustments,
      canCreateCounts,
      canCreateDonationItems,
      canCreateDonations,
      canCreateDonors,
      canCreateInitialLoad,
      canCreateItems,
      canCreatePurchases,
      canCreateSuppliers,
      canCreateUnits,
      canCreateCategories,
      canReadAdjustments,
      canReadCounts,
      canReadDonations,
      canReadDonors,
      canReadInventoryCountsAdjustmentsReports,
      canReadInventoryExistenceReports,
      canReadInventory,
      canReadItems,
      canReadMovements,
      canReadPurchases,
      canReadSuppliers,
      canReadCategories,
      canReadUnits,
      canReceiveDonationItems,
    ],
  );

  const donationTabs = useMemo(
    () =>
      [
        {
          id: DONATION_TABS.DONATIONS,
          label: "Donaciones",
          visible:
            canReadDonations || canCreateDonations || canCreateDonationItems || canReceiveDonationItems,
        },
        {
          id: DONATION_TABS.DONORS,
          label: "Donantes",
          visible: canReadDonors || canCreateDonors,
        },
      ].filter((tab) => tab.visible),
    [
      canCreateDonationItems,
      canCreateDonations,
      canCreateDonors,
      canReadDonations,
      canReadDonors,
      canReceiveDonationItems,
    ],
  );

  const purchaseTabs = useMemo(
    () =>
      [
        { id: PURCHASE_TABS.PURCHASES, label: "Compras", visible: canReadPurchases || canCreatePurchases },
        { id: PURCHASE_TABS.SUPPLIERS, label: "Proveedores", visible: canReadSuppliers || canCreateSuppliers },
      ].filter((tab) => tab.visible),
    [canCreatePurchases, canCreateSuppliers, canReadPurchases, canReadSuppliers],
  );

  const controlTabs = useMemo(
    () =>
      [
        { id: CONTROL_TABS.COUNTS, label: "Conteos fisicos", visible: canReadCounts || canCreateCounts },
        { id: CONTROL_TABS.ADJUSTMENTS, label: "Ajustes", visible: canReadAdjustments || canCreateAdjustments },
        { id: CONTROL_TABS.INITIAL_LOAD, label: "Carga inicial", visible: canCreateInitialLoad },
        { id: CONTROL_TABS.MOVEMENTS, label: "Movimientos", visible: canReadMovements },
      ].filter((tab) => tab.visible),
    [canCreateAdjustments, canCreateCounts, canCreateInitialLoad, canReadAdjustments, canReadCounts, canReadMovements],
  );

  const catalogTabs = useMemo(
    () =>
      [
        { id: CATALOG_TABS.ITEMS, label: "Items", visible: canReadItems || canCreateItems },
        { id: CATALOG_TABS.CATEGORIES, label: "Categorias", visible: canReadCategories || canCreateCategories },
        { id: CATALOG_TABS.UNITS, label: "Unidades", visible: canReadUnits || canCreateUnits },
      ].filter((tab) => tab.visible),
    [canCreateCategories, canCreateItems, canCreateUnits, canReadCategories, canReadItems, canReadUnits],
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (!donationTabs.length) return;
    if (!donationTabs.some((tab) => tab.id === activeDonationTab)) {
      setActiveDonationTab(donationTabs[0].id);
    }
  }, [activeDonationTab, donationTabs]);

  useEffect(() => {
    if (!purchaseTabs.length) return;
    if (!purchaseTabs.some((tab) => tab.id === activePurchaseTab)) {
      setActivePurchaseTab(purchaseTabs[0].id);
    }
  }, [activePurchaseTab, purchaseTabs]);

  useEffect(() => {
    if (!controlTabs.length) return;
    if (!controlTabs.some((tab) => tab.id === activeControlTab)) {
      setActiveControlTab(controlTabs[0].id);
    }
  }, [activeControlTab, controlTabs]);

  useEffect(() => {
    if (!catalogTabs.length) return;
    if (!catalogTabs.some((tab) => tab.id === activeCatalogTab)) {
      setActiveCatalogTab(catalogTabs[0].id);
    }
  }, [activeCatalogTab, catalogTabs]);

  const setLoadingFlag = useCallback((key, value) => {
    setLoading((current) => ({ ...current, [key]: value }));
  }, []);

  const pushFeedback = useCallback((type, message) => {
    setFeedback({ type, message });
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback({ type: "", message: "" });
  }, []);

  const loadComunasForRegion = useCallback(
    async (regionId) => {
      if (!regionId) return [];
      if (comunasByRegion[regionId]) {
        return comunasByRegion[regionId];
      }
      const next = await getComunas({ region_id: regionId });
      setComunasByRegion((current) => ({ ...current, [regionId]: next }));
      return next;
    },
    [comunasByRegion],
  );

  const loadBootstrapData = useCallback(async () => {
    setLoadingFlag("bootstrap", true);

    try {
      const requests = [];

      if (canReadLocations) {
        requests.push(getLocations({ activo: true }));
      } else {
        requests.push(Promise.resolve([]));
      }

      if (canReadCategories || canCreateItems || canCreateCategories) {
        requests.push(getItemCategories());
      } else {
        requests.push(Promise.resolve([]));
      }

      if (canReadUnits || canCreateItems || canCreateUnits) {
        requests.push(getUnitsOfMeasure());
      } else {
        requests.push(Promise.resolve([]));
      }

      if (canReadItems || canCreateItems || canCreateDonationItems || canCreatePurchaseDetails) {
        requests.push(getItems());
      } else {
        requests.push(Promise.resolve([]));
      }

      if (canReadSuppliers || canCreateSuppliers || canCreatePurchases) {
        requests.push(getSuppliers());
      } else {
        requests.push(Promise.resolve([]));
      }

      if (canReadDonors) {
        requests.push(getDonors());
      } else {
        requests.push(Promise.resolve([]));
      }

      if (canReadLocations && (canCreateSuppliers || canCreateDonations)) {
        requests.push(getRegions());
      } else {
        requests.push(Promise.resolve([]));
      }

      const [
        locationsData,
        categoriesData,
        unitsData,
        itemsData,
        suppliersData,
        donorsData,
        regionsData,
      ] =
        await Promise.all(requests);

      setLocations(locationsData);
      setCategories(categoriesData);
      setUnits(unitsData);
      setItems(itemsData);
      setSuppliers(suppliersData);
      setDonors(donorsData);
      setRegions(regionsData);
      clearFeedback();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo cargar la configuracion base del módulo.");
    } finally {
      setLoadingFlag("bootstrap", false);
    }
  }, [
    canCreateDonationItems,
    canCreateDonations,
    canCreateItems,
    canCreatePurchases,
    canCreateSuppliers,
    canCreatePurchaseDetails,
    canCreateCategories,
    canCreateUnits,
    canReadCategories,
    canReadDonors,
    canReadItems,
    canReadLocations,
    canReadSuppliers,
    canReadUnits,
    clearFeedback,
    pushFeedback,
    setLoadingFlag,
  ]);

  const loadSummary = useCallback(async () => {
    if (!canReadInventory) return;

    setLoadingFlag("summary", true);
    try {
      setSummaryRows(await getInventorySummary());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo cargar el resumen de inventario.");
    } finally {
      setLoadingFlag("summary", false);
    }
  }, [canReadInventory, pushFeedback, setLoadingFlag]);

  const loadDonations = useCallback(async () => {
    if (!canReadDonations) return;
    setLoadingFlag("donations", true);
    try {
      setDonations(await getDonations());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar las donaciones.");
    } finally {
      setLoadingFlag("donations", false);
    }
  }, [canReadDonations, pushFeedback, setLoadingFlag]);

  const loadDonors = useCallback(async () => {
    if (!canReadDonors) return;
    setLoadingFlag("donors", true);
    try {
      setDonors(await getDonors());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar los donantes.");
    } finally {
      setLoadingFlag("donors", false);
    }
  }, [canReadDonors, pushFeedback, setLoadingFlag]);

  const loadDonationDetail = useCallback(async (donationId) => {
    if (!donationId || !canReadDonations) return;
    try {
      setSelectedDonation(await getDonation(donationId));
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo cargar el detalle de la donación.");
    }
  }, [canReadDonations, pushFeedback]);

  const loadPurchases = useCallback(async () => {
    if (!canReadPurchases) return;
    setLoadingFlag("purchases", true);
    try {
      setPurchases(await getPurchases());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar las compras.");
    } finally {
      setLoadingFlag("purchases", false);
    }
  }, [canReadPurchases, pushFeedback, setLoadingFlag]);

  const loadPurchaseDetail = useCallback(async (purchaseId) => {
    if (!purchaseId || !canReadPurchases) return;
    try {
      setSelectedPurchase(await getPurchase(purchaseId));
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo cargar el detalle de la compra.");
    }
  }, [canReadPurchases, pushFeedback]);

  const loadSuppliersData = useCallback(async () => {
    if (!canReadSuppliers) return;
    setLoadingFlag("suppliers", true);
    try {
      setSuppliers(await getSuppliers());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar los proveedores.");
    } finally {
      setLoadingFlag("suppliers", false);
    }
  }, [canReadSuppliers, pushFeedback, setLoadingFlag]);

  const loadCounts = useCallback(async () => {
    if (!canReadCounts) return;
    setLoadingFlag("counts", true);
    try {
      setStockCounts(await getStockCounts());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar los conteos.");
    } finally {
      setLoadingFlag("counts", false);
    }
  }, [canReadCounts, pushFeedback, setLoadingFlag]);

  const loadStockCountDetail = useCallback(async (stockCountId) => {
    if (!stockCountId || !canReadCounts) return;
    try {
      setSelectedStockCount(await getStockCount(stockCountId));
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo cargar el detalle del conteo.");
    }
  }, [canReadCounts, pushFeedback]);

  const loadAdjustments = useCallback(async () => {
    if (!canReadAdjustments) return;
    setLoadingFlag("adjustments", true);
    try {
      setAdjustments(await getInventoryAdjustments());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar los ajustes.");
    } finally {
      setLoadingFlag("adjustments", false);
    }
  }, [canReadAdjustments, pushFeedback, setLoadingFlag]);

  const loadAdjustmentDetail = useCallback(async (adjustmentId) => {
    if (!adjustmentId || !canReadAdjustments) return;
    try {
      setSelectedAdjustment(await getInventoryAdjustment(adjustmentId));
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo cargar el detalle del ajuste.");
    }
  }, [canReadAdjustments, pushFeedback]);

  const loadMovements = useCallback(async () => {
    if (!canReadMovements) return;
    setLoadingFlag("movements", true);
    try {
      const params = {};
      if (movementFilters.itemId) params.item_id = movementFilters.itemId;
      if (movementFilters.locationId) params.location_id = movementFilters.locationId;
      setMovements(await getInventoryMovements(params));
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar los movimientos.");
    } finally {
      setLoadingFlag("movements", false);
    }
  }, [canReadMovements, movementFilters.itemId, movementFilters.locationId, pushFeedback, setLoadingFlag]);

  const loadCatalogItems = useCallback(async () => {
    if (!canReadItems) return;
    setLoadingFlag("catalogItems", true);
    try {
      setItems(await getItems());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar los items.");
    } finally {
      setLoadingFlag("catalogItems", false);
    }
  }, [canReadItems, pushFeedback, setLoadingFlag]);

  const loadCategories = useCallback(async () => {
    if (!canReadCategories) return;
    setLoadingFlag("categories", true);
    try {
      setCategories(await getItemCategories());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar las categorias.");
    } finally {
      setLoadingFlag("categories", false);
    }
  }, [canReadCategories, pushFeedback, setLoadingFlag]);

  const loadUnits = useCallback(async () => {
    if (!canReadUnits) return;
    setLoadingFlag("units", true);
    try {
      setUnits(await getUnitsOfMeasure());
    } catch (error) {
      pushFeedback("error", error.message || "No se pudieron cargar las unidades.");
    } finally {
      setLoadingFlag("units", false);
    }
  }, [canReadUnits, pushFeedback, setLoadingFlag]);

  const ensureLocationExistences = useCallback(async (locationId) => {
    if (!locationId || !canReadExistences) return [];
    if (existencesByLocation[locationId]) {
      return existencesByLocation[locationId];
    }
    const data = await getInventoryExistences({ location_id: locationId });
    setExistencesByLocation((current) => ({ ...current, [locationId]: data }));
    return data;
  }, [canReadExistences, existencesByLocation]);

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  useEffect(() => {
    if (!visibleTabs.length) return;

    if (activeTab === MAIN_TABS.INVENTORY) {
      void loadSummary();
    }
    if (activeTab === MAIN_TABS.DONATIONS) {
      if (activeDonationTab === DONATION_TABS.DONATIONS) {
        void loadDonations();
      } else if (activeDonationTab === DONATION_TABS.DONORS) {
        void loadDonors();
      }
    }
    if (activeTab === MAIN_TABS.PURCHASES) {
      if (activePurchaseTab === PURCHASE_TABS.PURCHASES) {
        void loadPurchases();
      } else if (activePurchaseTab === PURCHASE_TABS.SUPPLIERS) {
        void loadSuppliersData();
      }
    }
    if (activeTab === MAIN_TABS.CONTROL) {
      if (activeControlTab === CONTROL_TABS.COUNTS) {
        void loadCounts();
      } else if (activeControlTab === CONTROL_TABS.ADJUSTMENTS) {
        void loadAdjustments();
      } else if (activeControlTab === CONTROL_TABS.MOVEMENTS) {
        void loadMovements();
      }
    }
    if (activeTab === MAIN_TABS.CATALOG) {
      if (activeCatalogTab === CATALOG_TABS.ITEMS) {
        void loadCatalogItems();
      } else if (activeCatalogTab === CATALOG_TABS.CATEGORIES) {
        void loadCategories();
      } else if (activeCatalogTab === CATALOG_TABS.UNITS) {
        void loadUnits();
      }
    }
  }, [
    activeCatalogTab,
    activeControlTab,
    activeDonationTab,
    activePurchaseTab,
    activeTab,
    loadAdjustments,
    loadCatalogItems,
    loadCategories,
    loadCounts,
    loadDonations,
    loadDonors,
    loadMovements,
    loadPurchases,
    loadSummary,
    loadSuppliersData,
    loadUnits,
    visibleTabs.length,
  ]);

  useEffect(() => {
    function handleInventoryUpdated() {
      if (canReadInventory) {
        void loadSummary();
      }
      if (canReadMovements && activeTab === MAIN_TABS.CONTROL && activeControlTab === CONTROL_TABS.MOVEMENTS) {
        void loadMovements();
      }
      if (selectedDonation?.id) {
        void loadDonationDetail(selectedDonation.id);
      }
      if (selectedPurchase?.id) {
        void loadPurchaseDetail(selectedPurchase.id);
      }
      if (selectedStockCount?.id) {
        void loadStockCountDetail(selectedStockCount.id);
      }
      if (selectedAdjustment?.id) {
        void loadAdjustmentDetail(selectedAdjustment.id);
      }
    }

    window.addEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);
    return () => {
      window.removeEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);
    };
  }, [
    activeControlTab,
    activeTab,
    canReadInventory,
    canReadMovements,
    loadAdjustmentDetail,
    loadDonationDetail,
    loadMovements,
    loadPurchaseDetail,
    loadStockCountDetail,
    loadSummary,
    selectedAdjustment?.id,
    selectedDonation?.id,
    selectedPurchase?.id,
    selectedStockCount?.id,
  ]);

  const summaryRowsFiltered = useMemo(() => {
    const searchTerm = summaryFilters.search.trim().toLowerCase();

    return summaryRows.filter((row) => {
      const matchesSearch =
        !searchTerm
        || [
          row.itemNombre,
          row.categoriaNombre,
          row.unidadMedidaNombre,
          row.estadoStock,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesCategory =
        !summaryFilters.categoriaId || String(row.item?.categoriaId) === String(summaryFilters.categoriaId);

      const matchesState =
        !summaryFilters.estadoStock || row.estadoStock === summaryFilters.estadoStock;

      const matchesActive =
        !summaryFilters.activo
        || (summaryFilters.activo === "ACTIVO" && row.activo)
        || (summaryFilters.activo === "INACTIVO" && !row.activo);

      const matchesLowStock =
        !summaryFilters.soloBajoMinimo || row.estadoStock === "BAJO_MINIMO" || row.estadoStock === "SIN_STOCK";

      const matchesStockVisibility =
        !isLocationOnlyInventoryView || summaryFilters.mostrarSinStock || Number(row.cantidadTotal || 0) > 0;

      return (
        matchesSearch
        && matchesCategory
        && matchesState
        && matchesActive
        && matchesLowStock
        && matchesStockVisibility
      );
    });
  }, [isLocationOnlyInventoryView, summaryFilters, summaryRows]);

  const donationUserOptions = useMemo(() => {
    const userMap = new Map();
    for (const donation of donations) {
      if (!donation.receivingUser?.id || userMap.has(donation.receivingUser.id)) continue;
      userMap.set(donation.receivingUser.id, donation.receivingUser);
    }
    return Array.from(userMap.values());
  }, [donations]);

  const filteredDonations = useMemo(() => {
    const searchTerm = donationFilters.search.trim().toLowerCase();

    return donations.filter((donation) => {
      const haystack = [
        donation.motivoDonacion,
        donation.donor?.nombreCompleto,
        donation.donor?.email,
        donation.region?.nombre,
        donation.observaciones,
        donation.receivingUser?.nombreCompleto,
        donation.receivingUser?.email,
        inventoryStatusLabel(getDonationGeneralStatus(donation)),
        inventoryStatusLabel(donation.estadoRecepcion),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesStatus =
        !donationFilters.status
        || getDonationGeneralStatus(donation) === donationFilters.status;
      const matchesRegion =
        !donationFilters.regionId || String(donation.region?.id || "") === String(donationFilters.regionId);
      const matchesUser =
        !donationFilters.userId
        || String(donation.receivingUser?.id || "") === String(donationFilters.userId);
      const matchesDate =
        !donationFilters.fecha || String(donation.fechaRegistro || "") === String(donationFilters.fecha);

      return matchesSearch && matchesStatus && matchesRegion && matchesUser && matchesDate;
    });
  }, [donationFilters, donations]);

  const filteredDonors = useMemo(() => {
    const searchTerm = donorFilters.search.trim().toLowerCase();

    return donors.filter((donor) => {
      const haystack = [
        donor.nombreCompleto,
        donor.email,
        donor.telefono,
        donor.usuarioInstagram,
        donor.direccion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesStatus =
        !donorFilters.status
        || (donorFilters.status === "ACTIVO" && donor.activo)
        || (donorFilters.status === "INACTIVO" && !donor.activo);

      return matchesSearch && matchesStatus;
    });
  }, [donorFilters, donors]);

  const selectedDonationFormDonor = useMemo(
    () => donors.find((donor) => String(donor.id) === String(donationForm.donorId || "")) || null,
    [donationForm.donorId, donors],
  );

  const paginatedSummaryRows = useMemo(
    () =>
      paginateCollection(
        summaryRowsFiltered,
        tablePagination.summary.page,
        tablePagination.summary.pageSize,
      ),
    [summaryRowsFiltered, tablePagination.summary.page, tablePagination.summary.pageSize],
  );

  const paginatedDonations = useMemo(
    () =>
      paginateCollection(
        filteredDonations,
        tablePagination.donations.page,
        tablePagination.donations.pageSize,
      ),
    [filteredDonations, tablePagination.donations.page, tablePagination.donations.pageSize],
  );

  const paginatedDonationLines = useMemo(
    () =>
      paginateCollection(
        selectedDonation?.donationItems || [],
        tablePagination.donationLines.page,
        tablePagination.donationLines.pageSize,
      ),
    [
      selectedDonation?.donationItems,
      tablePagination.donationLines.page,
      tablePagination.donationLines.pageSize,
    ],
  );

  const paginatedDonors = useMemo(
    () =>
      paginateCollection(
        filteredDonors,
        tablePagination.donors.page,
        tablePagination.donors.pageSize,
      ),
    [filteredDonors, tablePagination.donors.page, tablePagination.donors.pageSize],
  );

  const filteredPurchases = useMemo(() => {
    const searchTerm = purchaseFilters.search.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const haystack = [
        purchase.supplier?.nombre,
        purchase.descripcion,
        purchase.observaciones,
        purchase.estado,
        purchase.montoTotal,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesStatus = !purchaseFilters.status || purchase.estado === purchaseFilters.status;
      const matchesSupplier =
        !purchaseFilters.supplierId
        || String(purchase.supplierId || "") === String(purchaseFilters.supplierId);
      const matchesDate =
        !purchaseFilters.fecha || String(purchase.fechaCompra || "") === String(purchaseFilters.fecha);

      return matchesSearch && matchesStatus && matchesSupplier && matchesDate;
    });
  }, [purchaseFilters, purchases]);

  const paginatedPurchases = useMemo(
    () =>
      paginateCollection(
        filteredPurchases,
        tablePagination.purchases.page,
        tablePagination.purchases.pageSize,
      ),
    [filteredPurchases, tablePagination.purchases.page, tablePagination.purchases.pageSize],
  );

  const paginatedPurchaseLines = useMemo(
    () =>
      paginateCollection(
        selectedPurchase?.purchaseDetails || [],
        tablePagination.purchaseLines.page,
        tablePagination.purchaseLines.pageSize,
      ),
    [
      selectedPurchase?.purchaseDetails,
      tablePagination.purchaseLines.page,
      tablePagination.purchaseLines.pageSize,
    ],
  );

  const paginatedSuppliers = useMemo(
    () =>
      paginateCollection(
        suppliers,
        tablePagination.suppliers.page,
        tablePagination.suppliers.pageSize,
      ),
    [suppliers, tablePagination.suppliers.page, tablePagination.suppliers.pageSize],
  );

  const countUserOptions = useMemo(() => {
    const userMap = new Map();
    for (const count of stockCounts) {
      if (!count.performedBy?.id || userMap.has(count.performedBy.id)) continue;
      userMap.set(count.performedBy.id, count.performedBy);
    }
    return Array.from(userMap.values());
  }, [stockCounts]);

  const filteredCounts = useMemo(() => {
    const searchTerm = countFilters.search.trim().toLowerCase();

    return stockCounts.filter((count) => {
      const haystack = [
        formatLocationLine(count.location),
        count.performedBy?.nombreCompleto,
        count.performedBy?.email,
        count.observaciones,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesLocation =
        !countFilters.locationId || String(count.locationId || "") === String(countFilters.locationId);
      const matchesUser =
        !countFilters.userId || String(count.performedBy?.id || "") === String(countFilters.userId);
      const matchesDate =
        !countFilters.fecha || String(count.fechaConteo || "") === String(countFilters.fecha);

      return matchesSearch && matchesLocation && matchesUser && matchesDate;
    });
  }, [countFilters, stockCounts]);

  const paginatedCounts = useMemo(
    () =>
      paginateCollection(
        filteredCounts,
        tablePagination.counts.page,
        tablePagination.counts.pageSize,
      ),
    [filteredCounts, tablePagination.counts.page, tablePagination.counts.pageSize],
  );

  const paginatedCountDetails = useMemo(
    () =>
      paginateCollection(
        selectedStockCount?.detalles || [],
        tablePagination.countDetails.page,
        tablePagination.countDetails.pageSize,
      ),
    [
      selectedStockCount?.detalles,
      tablePagination.countDetails.page,
      tablePagination.countDetails.pageSize,
    ],
  );

  const filteredAdjustments = useMemo(() => {
    const searchTerm = adjustmentFilters.search.trim().toLowerCase();

    return adjustments.filter((adjustment) => {
      const sourceType = adjustment.stockCountId ? "CONTEO" : "MANUAL";
      const haystack = [
        adjustment.motivo,
        adjustment.estado,
        adjustment.observaciones,
        formatLocationLine(adjustment.location),
        adjustment.performedBy?.nombreCompleto,
        adjustment.performedBy?.email,
        sourceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesStatus =
        !adjustmentFilters.status || adjustment.estado === adjustmentFilters.status;
      const matchesLocation =
        !adjustmentFilters.locationId
        || String(adjustment.locationId || "") === String(adjustmentFilters.locationId);
      const matchesSource = !adjustmentFilters.source || sourceType === adjustmentFilters.source;
      const matchesDate =
        !adjustmentFilters.fecha || String(adjustment.fechaAjuste || "") === String(adjustmentFilters.fecha);

      return matchesSearch && matchesStatus && matchesLocation && matchesSource && matchesDate;
    });
  }, [adjustmentFilters, adjustments]);

  const paginatedAdjustments = useMemo(
    () =>
      paginateCollection(
        filteredAdjustments,
        tablePagination.adjustments.page,
        tablePagination.adjustments.pageSize,
      ),
    [filteredAdjustments, tablePagination.adjustments.page, tablePagination.adjustments.pageSize],
  );

  const paginatedAdjustmentDetails = useMemo(
    () =>
      paginateCollection(
        selectedAdjustment?.details || [],
        tablePagination.adjustmentDetails.page,
        tablePagination.adjustmentDetails.pageSize,
      ),
    [
      selectedAdjustment?.details,
      tablePagination.adjustmentDetails.page,
      tablePagination.adjustmentDetails.pageSize,
    ],
  );

  const filteredMovements = useMemo(() => {
    const searchTerm = movementFilters.search.trim().toLowerCase();
    const matchesText = (movement) =>
      !searchTerm
      || [
        movement.itemNombre,
        movement.observaciones,
        movement.sourceLocation?.nombre,
        movement.destinationLocation?.nombre,
        movement.referenciaTipo,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm));

    return movements.filter((movement) => {
      const matchesType = !movementFilters.tipo || movement.tipoMovimiento === movementFilters.tipo;
      return matchesType && matchesText(movement);
    });
  }, [movementFilters.search, movementFilters.tipo, movements]);

  const paginatedMovements = useMemo(
    () =>
      paginateCollection(
        filteredMovements,
        tablePagination.movements.page,
        tablePagination.movements.pageSize,
      ),
    [filteredMovements, tablePagination.movements.page, tablePagination.movements.pageSize],
  );

  const paginatedItems = useMemo(
    () => paginateCollection(items, tablePagination.items.page, tablePagination.items.pageSize),
    [items, tablePagination.items.page, tablePagination.items.pageSize],
  );

  const paginatedCategories = useMemo(
    () =>
      paginateCollection(
        categories,
        tablePagination.categories.page,
        tablePagination.categories.pageSize,
      ),
    [categories, tablePagination.categories.page, tablePagination.categories.pageSize],
  );

  const paginatedUnits = useMemo(
    () => paginateCollection(units, tablePagination.units.page, tablePagination.units.pageSize),
    [units, tablePagination.units.page, tablePagination.units.pageSize],
  );

  const summaryFilterStats = useMemo(
    () => [
      `Mostrando ${summaryRowsFiltered.length} de ${summaryRows.length}`,
      `Bajo minimo: ${
        summaryRowsFiltered.filter(
          (row) => row.estadoStock === "BAJO_MINIMO" || row.estadoStock === "SIN_STOCK",
        ).length
      }`,
      `Inactivos: ${summaryRowsFiltered.filter((row) => !row.activo).length}`,
    ],
    [summaryRows.length, summaryRowsFiltered],
  );

  const donationStats = useMemo(
    () => [
      `Mostrando ${filteredDonations.length} de ${donations.length}`,
      `Pendientes: ${filteredDonations.filter((donation) => donation.estadoRecepcion !== "COMPLETA").length}`,
      `Recepcionadas: ${filteredDonations.filter((donation) => donation.estadoRecepcion === "COMPLETA").length}`,
    ],
    [donations.length, filteredDonations],
  );

  const donorStats = useMemo(
    () => [
      `Mostrando ${filteredDonors.length} de ${donors.length}`,
      `Activos: ${filteredDonors.filter((donor) => donor.activo).length}`,
      `Inactivos: ${filteredDonors.filter((donor) => !donor.activo).length}`,
    ],
    [donors.length, filteredDonors],
  );

  const purchaseStats = useMemo(
    () => [
      `Mostrando ${filteredPurchases.length} de ${purchases.length}`,
      `Borrador: ${filteredPurchases.filter((purchase) => purchase.estado === "BORRADOR").length}`,
      `Confirmadas: ${filteredPurchases.filter((purchase) => purchase.estado === "CONFIRMADA").length}`,
    ],
    [filteredPurchases, purchases.length],
  );

  const countStats = useMemo(
    () => [
      `Mostrando ${filteredCounts.length} de ${stockCounts.length}`,
      `Ubicaciones: ${new Set(filteredCounts.map((count) => count.location?.id).filter(Boolean)).size}`,
      `Detalles: ${filteredCounts.reduce((sum, count) => sum + count.detalles.length, 0)}`,
    ],
    [filteredCounts, stockCounts.length],
  );

  const adjustmentStats = useMemo(
    () => [
      `Mostrando ${filteredAdjustments.length} de ${adjustments.length}`,
      `Pendientes: ${filteredAdjustments.filter((adjustment) => adjustment.estado === "PENDIENTE").length}`,
      `Aplicados: ${filteredAdjustments.filter((adjustment) => adjustment.estado === "APLICADO").length}`,
    ],
    [adjustments.length, filteredAdjustments],
  );

  const movementFilterStats = useMemo(
    () => [
      `Mostrando ${filteredMovements.length} de ${movements.length}`,
      `Traslados: ${
        filteredMovements.filter((movement) => movement.tipoMovimiento === "TRASLADO").length
      }`,
      `Consumos: ${
        filteredMovements.filter((movement) => movement.tipoMovimiento === "CONSUMO").length
      }`,
    ],
    [filteredMovements, movements.length],
  );

  const itemStats = useMemo(
    () => [
      `Mostrando ${items.length} de ${items.length}`,
      `Activos: ${items.filter((item) => item.activo).length}`,
      `Inactivos: ${items.filter((item) => !item.activo).length}`,
    ],
    [items],
  );

  const updateTablePagination = useCallback((key, updates) => {
    setTablePagination((current) => ({
      ...current,
      [key]: { ...current[key], ...updates },
    }));
  }, []);

  useEffect(() => {
    updateTablePagination("summary", { page: 1 });
  }, [summaryFilters, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("donations", { page: 1 });
  }, [donationFilters, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("purchases", { page: 1 });
  }, [purchaseFilters, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("donors", { page: 1 });
  }, [donorFilters, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("counts", { page: 1 });
  }, [countFilters, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("adjustments", { page: 1 });
  }, [adjustmentFilters, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("movements", { page: 1 });
  }, [movementFilters, updateTablePagination]);

  const resetSummaryFilters = useCallback(() => {
    setSummaryFilters({
      search: "",
      categoriaId: "",
      estadoStock: "",
      soloBajoMinimo: false,
      activo: "",
      mostrarSinStock: false,
    });
    updateTablePagination("summary", { page: 1 });
  }, [updateTablePagination]);

  const resetMovementFilters = useCallback(() => {
    setMovementFilters({
      itemId: "",
      locationId: "",
      tipo: "",
      search: "",
    });
    updateTablePagination("movements", { page: 1 });
  }, [updateTablePagination]);

  const resetDonationFilters = useCallback(() => {
    setDonationFilters({
      search: "",
      status: "",
      regionId: "",
      userId: "",
      fecha: "",
    });
    updateTablePagination("donations", { page: 1 });
  }, [updateTablePagination]);

  const resetPurchaseFilters = useCallback(() => {
    setPurchaseFilters({
      search: "",
      status: "",
      supplierId: "",
      fecha: "",
    });
    updateTablePagination("purchases", { page: 1 });
  }, [updateTablePagination]);

  const resetDonorFilters = useCallback(() => {
    setDonorFilters({
      search: "",
      status: "",
    });
    updateTablePagination("donors", { page: 1 });
  }, [updateTablePagination]);

  const resetCountFilters = useCallback(() => {
    setCountFilters({
      search: "",
      locationId: "",
      userId: "",
      fecha: "",
    });
    updateTablePagination("counts", { page: 1 });
  }, [updateTablePagination]);

  const resetAdjustmentFilters = useCallback(() => {
    setAdjustmentFilters({
      search: "",
      status: "",
      locationId: "",
      source: "",
      fecha: "",
    });
    updateTablePagination("adjustments", { page: 1 });
  }, [updateTablePagination]);

  useEffect(() => {
    updateTablePagination("donationLines", { page: 1 });
  }, [selectedDonation?.id, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("purchaseLines", { page: 1 });
  }, [selectedPurchase?.id, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("countDetails", { page: 1 });
  }, [selectedStockCount?.id, updateTablePagination]);

  useEffect(() => {
    updateTablePagination("adjustmentDetails", { page: 1 });
  }, [selectedAdjustment?.id, updateTablePagination]);

  function openInitialLoadModal(itemId = "") {
    setInitialLoadForm(emptyInitialLoadForm(itemId));
    setInitialLoadError("");
    setInitialLoadModalOpen(true);
  }

  function resetInlineDonorState() {
    setInlineDonorOpen(false);
    setInlineDonorForm(emptyDonorForm());
    setInlineDonorErrors({});
    setInlineDonorSaving(false);
    setInlineDonorMatch(null);
    setInlineDonorNotice("");
  }

  function closeDonationModal() {
    setDonationModalOpen(false);
    resetInlineDonorState();
  }

  async function showInventoryConfirmDialog({
    title,
    html,
    confirmButtonText,
    cancelButtonText = "Cancelar",
    confirmButtonColor = "#2563eb",
    icon = "warning",
  }) {
    const result = await fireInventorySwal({
      title,
      html,
      icon,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText,
      confirmButtonColor,
      reverseButtons: true,
      focusCancel: true,
    });

    return result.isConfirmed;
  }

  function openCreateDonationModal() {
    setDonationFormMode("create");
    setEditingDonationId("");
    setDonationForm(emptyDonationForm(regions[0]?.id || ""));
    setDonationFormError("");
    resetInlineDonorState();
    setDonationModalOpen(true);
  }

  function openEditDonationModal(donation) {
    if (
      donation.donor
      && !donors.some((donor) => String(donor.id) === String(donation.donor.id))
    ) {
      setDonors((current) => [donation.donor, ...current]);
    }
    setDonationFormMode("edit");
    setEditingDonationId(String(donation.id));
    setDonationForm({
      motivoDonacion: donation.motivoDonacion || "",
      donorId: donation.donorId ? String(donation.donorId) : "",
      puntoEncuentro: donation.puntoEncuentro || "",
      fechaRegistro: donation.fechaRegistro || todayValue(),
      observaciones: donation.observaciones || "",
      regionId: donation.region?.id ? String(donation.region.id) : "",
    });
    setDonationFormError("");
    resetInlineDonorState();
    setDonationModalOpen(true);
  }

  function selectMatchedInlineDonor(donor) {
    setDonationForm((current) => ({ ...current, donorId: String(donor.id) }));
    setInlineDonorNotice(
      `Se encontró y seleccionó el donante ${donor.nombreCompleto || donor.nombre}.`,
    );
    setInlineDonorOpen(false);
    setInlineDonorForm(emptyDonorForm());
    setInlineDonorErrors({});
    setInlineDonorMatch(null);
  }

  function checkInlineDonorDuplicate() {
    const match = findMatchingDonor(donors, inlineDonorForm);
    if (!match) {
      setInlineDonorMatch(null);
      return null;
    }

    if (match.donor.activo) {
      selectMatchedInlineDonor(match.donor);
    } else {
      setInlineDonorMatch(match);
      setInlineDonorErrors((current) => ({
        ...current,
        general:
          "Ya existe un donante inactivo con esos datos. Debe reactivarse para asociarlo.",
      }));
    }

    return match;
  }

  function updateInlineDonorField(field, value) {
    setInlineDonorForm((current) => ({ ...current, [field]: value }));
    setInlineDonorErrors((current) => ({ ...current, [field]: "", general: "" }));
    setInlineDonorMatch(null);
    setInlineDonorNotice("");
  }

  async function handleCreateInlineDonor() {
    const validationErrors = validateInlineDonor(inlineDonorForm);
    if (Object.keys(validationErrors).length > 0) {
      setInlineDonorErrors(validationErrors);
      return;
    }

    const duplicate = checkInlineDonorDuplicate();
    if (duplicate) return;

    setInlineDonorSaving(true);
    setInlineDonorErrors({});

    try {
      const savedDonor = await createDonor({
        nombre: inlineDonorForm.nombre.trim(),
        apellido: inlineDonorForm.apellido.trim(),
        email: normalizeDonorEmail(inlineDonorForm.email) || null,
        telefono: inlineDonorForm.telefono.trim(),
        usuario_instagram: normalizeInstagramUsername(inlineDonorForm.usuarioInstagram),
        activo: true,
      });

      setDonors((current) => {
        const remaining = current.filter((donor) => String(donor.id) !== String(savedDonor.id));
        return [savedDonor, ...remaining];
      });
      setDonationForm((current) => ({ ...current, donorId: String(savedDonor.id) }));
      setInlineDonorNotice(
        `Donante ${savedDonor.nombreCompleto || savedDonor.nombre} creado y seleccionado.`,
      );
      setInlineDonorOpen(false);
      setInlineDonorForm(emptyDonorForm());
      setInlineDonorMatch(null);
    } catch (error) {
      setInlineDonorErrors({
        general: error.message || "No se pudo crear el donante.",
      });
    } finally {
      setInlineDonorSaving(false);
    }
  }

  async function handleReactivateInlineDonor() {
    const donor = inlineDonorMatch?.donor;
    if (!donor || !canUpdateDonors) return;

    setInlineDonorSaving(true);
    setInlineDonorErrors({});
    try {
      const updatedDonor = await updateDonor(
        parseEntityIdOrThrow(donor.id, "donante"),
        { activo: true },
      );
      setDonors((current) => current.map((item) => (
        String(item.id) === String(updatedDonor.id) ? updatedDonor : item
      )));
      selectMatchedInlineDonor(updatedDonor);
      setInlineDonorNotice(
        `Donante ${updatedDonor.nombreCompleto || updatedDonor.nombre} reactivado y seleccionado.`,
      );
    } catch (error) {
      setInlineDonorErrors({
        general: error.message || "No se pudo reactivar el donante.",
      });
    } finally {
      setInlineDonorSaving(false);
    }
  }

  function openDonationItemModal(donationId = "", donationItem = null) {
    if (donationItem) {
      setEditingDonationItemId(String(donationItem.id));
      setDonationItemForm({
        donationId: donationId ? String(donationId) : String(donationItem.donationId || ""),
        itemId: donationItem.itemId ? String(donationItem.itemId) : "",
        cantidad: donationItem.cantidad ? String(donationItem.cantidad) : "",
        condicion: donationItem.condicion || "NUEVO",
        fechaVencimiento: donationItem.fechaVencimiento || "",
        fechaApertura: donationItem.fechaApertura || "",
        condicionesAlmacenamiento: donationItem.condicionesAlmacenamiento || "",
        observaciones: donationItem.observaciones || "",
      });
    } else {
      setEditingDonationItemId("");
      setDonationItemForm(emptyDonationItemForm(donationId));
    }
    setDonationItemError("");
    setDonationItemModalOpen(true);
  }

  function openDonationReceiveModal(donationItem = null) {
    const lineId =
      donationItem && typeof donationItem === "object" ? donationItem.id : donationItem;
    const nextForm = emptyReceiveForm(lineId);
    setDonationReceiveForm({
      ...nextForm,
      receiptDate: todayValue(),
      idempotencyKey: generateReceiptIdempotencyKey(),
      condicion: donationItem?.condicion || "",
      fechaVencimiento: donationItem?.fechaVencimiento || "",
      fechaApertura: donationItem?.fechaApertura || "",
      condicionesAlmacenamiento: donationItem?.condicionesAlmacenamiento || "",
    });
    setDonationReceiveError("");
    setDonationReceiveModalOpen(true);
  }

  function openDonationBulkReceiptModal() {
    setDonationBulkReceiptError("");
    setDonationBulkReceiptOpen(true);
  }

  function openCreatePurchaseModal() {
    setPurchaseFormMode("create");
    setEditingPurchaseId("");
    setPurchaseForm(emptyPurchaseForm(suppliers[0]?.id || ""));
    setPurchaseFormError("");
    setPurchaseModalOpen(true);
  }

  function openEditPurchaseModal(purchase) {
    setPurchaseFormMode("edit");
    setEditingPurchaseId(String(purchase.id));
    setPurchaseForm({
      supplierId: purchase.supplierId ? String(purchase.supplierId) : "",
      fechaCompra: purchase.fechaCompra || todayValue(),
      moneda: purchase.moneda || "CLP",
      fechaVencimientoPago: purchase.fechaVencimientoPago || "",
      observacionFinanciera: purchase.observacionFinanciera || "",
      descripcion: purchase.descripcion || "",
      observaciones: purchase.observaciones || "",
    });
    setPurchaseFormError("");
    setPurchaseModalOpen(true);
  }

  function openPurchaseDetailModal(purchaseId = "", purchaseDetail = null) {
    if (purchaseDetail) {
      setEditingPurchaseDetailId(String(purchaseDetail.id));
      setPurchaseDetailForm({
        purchaseId: purchaseId ? String(purchaseId) : String(purchaseDetail.purchaseId || ""),
        itemId: purchaseDetail.itemId ? String(purchaseDetail.itemId) : "",
        cantidad: purchaseDetail.cantidad ? String(purchaseDetail.cantidad) : "",
        precioUnitario:
          purchaseDetail.precioUnitario !== undefined && purchaseDetail.precioUnitario !== null
            ? String(purchaseDetail.precioUnitario)
            : "",
        subtotal:
          purchaseDetail.subtotal !== undefined && purchaseDetail.subtotal !== null
            ? String(purchaseDetail.subtotal)
            : "",
        condicion: purchaseDetail.condicion || "NUEVO",
        fechaVencimiento: purchaseDetail.fechaVencimiento || "",
        fechaApertura: purchaseDetail.fechaApertura || "",
        condicionesAlmacenamiento: purchaseDetail.condicionesAlmacenamiento || "",
        observaciones: purchaseDetail.observaciones || "",
      });
    } else {
      setEditingPurchaseDetailId("");
      setPurchaseDetailForm(emptyPurchaseDetailForm(purchaseId));
    }
    setPurchaseDetailError("");
    setPurchaseDetailModalOpen(true);
  }

  function openPurchaseReceiveModal(purchaseDetail = null) {
    const lineId =
      purchaseDetail && typeof purchaseDetail === "object" ? purchaseDetail.id : purchaseDetail;
    const nextForm = emptyReceiveForm(lineId);
    setPurchaseReceiveForm({
      ...nextForm,
      receiptDate: todayValue(),
      idempotencyKey: generateReceiptIdempotencyKey(),
      condicion: purchaseDetail?.condicion || "",
      fechaVencimiento: purchaseDetail?.fechaVencimiento || "",
      fechaApertura: purchaseDetail?.fechaApertura || "",
      condicionesAlmacenamiento: purchaseDetail?.condicionesAlmacenamiento || "",
    });
    setPurchaseReceiveError("");
    setPurchaseReceiveModalOpen(true);
  }

  function openPurchaseBulkReceiptModal() {
    setPurchaseBulkReceiptError("");
    setPurchaseBulkReceiptOpen(true);
  }

  function openDonationReceiptHistory(line) {
    setSelectedDonationReceiptLine(line);
    setDonationReceiptHistoryOpen(true);
  }

  function openPurchaseReceiptHistory(line) {
    setSelectedPurchaseReceiptLine(line);
    setPurchaseReceiptHistoryOpen(true);
  }

  function openCreateSupplierModal() {
    setSupplierFormMode("create");
    setEditingSupplierId("");
    setSupplierForm(emptySupplierForm());
    setSupplierFormError("");
    setSupplierModalOpen(true);
  }

  function openEditSupplierModal(supplier) {
    setSupplierFormMode("edit");
    setEditingSupplierId(String(supplier.id));
    setSupplierForm({
      nombre: supplier.nombre || "",
      telefono: supplier.telefono || "",
      email: supplier.email || "",
      observaciones: supplier.observaciones || "",
      activo: Boolean(supplier.activo),
      hasLocation: Boolean(supplier.location),
      direccion: supplier.location?.direccion || "",
      regionId: supplier.location?.region?.id ? String(supplier.location.region.id) : "",
      comunaId: supplier.location?.comuna?.id ? String(supplier.location.comuna.id) : "",
      locationObservaciones: supplier.location?.observaciones || "",
    });
    if (supplier.location?.region?.id) {
      void loadComunasForRegion(supplier.location.region.id);
    }
    setSupplierFormError("");
    setSupplierModalOpen(true);
  }

  function openCreateDonorModal() {
    setDonorFormMode("create");
    setEditingDonorId("");
    setDonorForm(emptyDonorForm());
    setDonorFormError("");
    setDonorModalOpen(true);
  }

  function openEditDonorModal(donor) {
    setDonorFormMode("edit");
    setEditingDonorId(String(donor.id));
    setDonorForm({
      nombre: donor.nombre || "",
      apellido: donor.apellido || "",
      email: donor.email || "",
      telefono: donor.telefono || "",
      usuarioInstagram: donor.usuarioInstagram || "",
      direccion: donor.direccion || "",
      observaciones: donor.observaciones || "",
      activo: Boolean(donor.activo),
    });
    setDonorFormError("");
    setDonorModalOpen(true);
  }

  function openStockCountModal() {
    setStockCountForm(emptyStockCountForm());
    setStockCountFormError("");
    setStockCountModalOpen(true);
  }

  async function handleStockCountLocationChange(locationId) {
    setStockCountForm((current) => ({
      ...current,
      locationId,
      detalles: current.detalles.map((detail) => ({ ...detail, existenciaId: "" })),
    }));
    if (locationId) {
      try {
        await ensureLocationExistences(locationId);
      } catch (error) {
        setStockCountFormError(error.message || "No se pudieron cargar las existencias de la ubicación.");
      }
    }
  }

  async function handleSupplierRegionChange(regionId) {
    setSupplierForm((current) => ({ ...current, regionId, comunaId: "" }));
    if (regionId) {
      try {
        await loadComunasForRegion(regionId);
      } catch (error) {
        setSupplierFormError(error.message || "No se pudieron cargar las comunas.");
      }
    }
  }

  function openAdjustmentModal(context = {}) {
    setAdjustmentForm(emptyAdjustmentForm(context));
    setAdjustmentError("");
    setAdjustmentModalOpen(true);
  }

  function openAdjustmentFromCountModal(stockCountId = "") {
    setAdjustmentFromCountForm(emptyAdjustmentFromCountForm(stockCountId));
    setAdjustmentFromCountError("");
    setAdjustmentFromCountModalOpen(true);
  }

  function openItemModal(item = null) {
    if (item) {
      setEditingItemId(String(item.id));
      setItemForm({
        nombre: item.nombre || "",
        descripcion: item.descripcion || "",
        stockMinimo: item.stockMinimo ?? "",
        activo: Boolean(item.activo),
        categoriaId: item.categoriaId ? String(item.categoriaId) : "",
        unidadId: item.unidadMedidaId ? String(item.unidadMedidaId) : "",
      });
    } else {
      setEditingItemId("");
      setItemForm(emptyItemForm());
    }
    setItemFormError("");
    setItemModalOpen(true);
  }

  function openCategoryModal(category = null) {
    if (category) {
      setEditingCategoryId(String(category.id));
      setCategoryForm({
        nombre: category.nombre || "",
        activo: Boolean(category.activo),
      });
    } else {
      setEditingCategoryId("");
      setCategoryForm(emptyCategoryForm());
    }
    setCategoryFormError("");
    setCategoryModalOpen(true);
  }

  function openUnitModal(unit = null) {
    if (unit) {
      setEditingUnitId(String(unit.id));
      setUnitForm({
        nombre: unit.nombre || "",
        descripcion: unit.descripcion || "",
        activo: Boolean(unit.activo),
      });
    } else {
      setEditingUnitId("");
      setUnitForm(emptyUnitForm());
    }
    setUnitFormError("");
    setUnitModalOpen(true);
  }

  async function handleSubmitInitialLoad(event) {
    event.preventDefault();
    const amount = parsePositiveDecimal(initialLoadForm.cantidad);
    if (!initialLoadForm.itemId) {
      setInitialLoadError("Debes seleccionar un item.");
      return;
    }
    if (!initialLoadForm.ubicacionId) {
      setInitialLoadError("Debes seleccionar una ubicación.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setInitialLoadError("Debes ingresar una cantidad decimal mayor a 0.");
      return;
    }

    setInitialLoadSaving(true);
    setInitialLoadError("");
    try {
      await createInitialInventoryLoad({
        item_id: Number(initialLoadForm.itemId),
        ubicacion_id: Number(initialLoadForm.ubicacionId),
        cantidad: amount,
        fecha_vencimiento: initialLoadForm.fechaVencimiento || null,
        fecha_apertura: initialLoadForm.fechaApertura || null,
        condicion: initialLoadForm.condicion || null,
        observaciones: initialLoadForm.observaciones.trim() || null,
      });
      setInitialLoadModalOpen(false);
      pushFeedback("success", "Carga inicial registrada correctamente.");
      emitInventoryUpdated({ section: "inventory" });
      await loadSummary();
    } catch (error) {
      setInitialLoadError(error.message || "No se pudo registrar la carga inicial.");
    } finally {
      setInitialLoadSaving(false);
    }
  }

  async function handleSubmitDonation(event) {
    event.preventDefault();
    if (!donationForm.motivoDonacion.trim()) {
      setDonationFormError("Debes ingresar el motivo de la donación.");
      return;
    }
    if (!donationForm.fechaRegistro) {
      setDonationFormError("Debes ingresar la fecha de registro.");
      return;
    }
    if (!donationForm.regionId) {
      setDonationFormError("Debes seleccionar una region.");
      return;
    }

    setDonationSaving(true);
    setDonationFormError("");
    try {
      const payload = {
        motivo_donacion: donationForm.motivoDonacion.trim(),
        donor_id: donationForm.donorId ? Number(donationForm.donorId) : null,
        punto_encuentro: donationForm.puntoEncuentro.trim() || null,
        fecha_registro: donationForm.fechaRegistro,
        observaciones: donationForm.observaciones.trim() || null,
        region_id: Number(donationForm.regionId),
        receiving_user_id: Number(user?.id),
      };
      const savedDonation = donationFormMode === "edit"
        ? await updateDonation(parseEntityIdOrThrow(editingDonationId, "donacion"), payload)
        : await createDonation(payload);
      setSelectedDonation(savedDonation);
      closeDonationModal();
      setEditingDonationId("");
      pushFeedback(
        "success",
        donationFormMode === "edit"
          ? "Donación actualizada correctamente."
          : "Donación creada correctamente.",
      );
      await loadDonations();
    } catch (error) {
      setDonationFormError(error.message || "No se pudo guardar la donación.");
    } finally {
      setDonationSaving(false);
    }
  }

  async function handleSubmitDonationItem(event) {
    event.preventDefault();
    const quantity = parsePositiveDecimal(donationItemForm.cantidad);
    if (!donationItemForm.donationId) {
      setDonationItemError("Debes seleccionar una donación.");
      return;
    }
    if (!donationItemForm.itemId) {
      setDonationItemError("Debes seleccionar un item.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setDonationItemError("Debes ingresar una cantidad decimal mayor a 0.");
      return;
    }
    if (!donationItemForm.condicionesAlmacenamiento.trim()) {
      setDonationItemError("Debes ingresar las condiciones de almacenamiento.");
      return;
    }

    setDonationItemSaving(true);
    setDonationItemError("");
    try {
      const payload = {
        donation_id: Number(donationItemForm.donationId),
        item_id: Number(donationItemForm.itemId),
        cantidad: quantity,
        condicion: donationItemForm.condicion || null,
        fecha_vencimiento: donationItemForm.fechaVencimiento || null,
        fecha_apertura: donationItemForm.fechaApertura || null,
        condiciones_almacenamiento: donationItemForm.condicionesAlmacenamiento.trim() || null,
        observaciones: donationItemForm.observaciones.trim() || null,
      };
      await (editingDonationItemId
        ? updateDonationItem(Number(editingDonationItemId), payload)
        : createDonationItem(payload));
      setDonationItemModalOpen(false);
      setEditingDonationItemId("");
      pushFeedback("success", editingDonationItemId ? "línea de donación actualizada correctamente." : "línea de donación creada correctamente.");
      await loadDonations();
      await loadDonationDetail(Number(donationItemForm.donationId));
    } catch (error) {
      setDonationItemError(error.message || "No se pudo guardar la línea de donación.");
    } finally {
      setDonationItemSaving(false);
    }
  }

  async function handleSubmitDonationReceive(event) {
    event.preventDefault();
    const quantity = parsePositiveDecimal(donationReceiveForm.cantidad);
    const currentLine = (selectedDonation?.donationItems || []).find(
      (line) => Number(line.id) === Number(donationReceiveForm.lineId),
    );
    if (!donationReceiveForm.lineId) {
      setDonationReceiveError("Debes seleccionar una línea.");
      return;
    }
    if (!donationReceiveForm.receiptDate) {
      setDonationReceiveError("Debes ingresar la fecha de recepción.");
      return;
    }
    if (!donationReceiveForm.destinationLocationId) {
      setDonationReceiveError("Debes seleccionar una ubicación destino.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setDonationReceiveError("Debes ingresar una cantidad decimal mayor a 0.");
      return;
    }
    const expectedQuantity = Number(currentLine?.cantidad || 0);
    const currentReceived = Number(currentLine?.cantidadRecepcionada || 0);
    const finalReceived = currentReceived + quantity;
    const incompleteClose =
      donationReceiveForm.cierraDetalle
      && expectedQuantity > 0
      && finalReceived < expectedQuantity;

    if (incompleteClose) {
      const confirmedClose = await showInventoryConfirmDialog({
        title: "Cerrar detalle de forma incompleta",
        html: `
          <p>Se esperaban <strong>${formatQuantity(expectedQuantity)}</strong> unidades y el total recibido quedara en <strong>${formatQuantity(finalReceived)}</strong>.</p>
          <p>Después de cerrar este detalle no podran registrarse nuevas recepciones.</p>
        `,
        confirmButtonText: "Cerrar detalle",
        cancelButtonText: "Volver",
      });

      if (!confirmedClose) {
        return;
      }
    }

    setDonationReceiveSaving(true);
    setDonationReceiveError("");
    fireInventorySwal({
      title: "Registrando recepción...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    try {
      const result = await receiveDonationItem({
        donation_item_id: Number(donationReceiveForm.lineId),
        fecha_recepcion: donationReceiveForm.receiptDate,
        destination_location_id: Number(donationReceiveForm.destinationLocationId),
        cantidad_a_recepcionar: quantity,
        condicion: donationReceiveForm.condicion || null,
        fecha_vencimiento: donationReceiveForm.fechaVencimiento || null,
        fecha_apertura: donationReceiveForm.fechaApertura || null,
        condiciones_almacenamiento: donationReceiveForm.condicionesAlmacenamiento.trim() || null,
        observaciones: donationReceiveForm.observaciones.trim() || null,
        cierra_detalle: donationReceiveForm.cierraDetalle,
        idempotency_key: donationReceiveForm.idempotencyKey,
      });
      setDonationReceiveModalOpen(false);
      pushFeedback("success", "Recepción de donación registrada correctamente.");
      emitInventoryUpdated({ section: "donations" });
      await loadDonations();
      if (result?.donationItem?.donationId) {
        await loadDonationDetail(result.donationItem.donationId);
      } else if (selectedDonation?.id) {
        await loadDonationDetail(selectedDonation.id);
      }
    } catch (error) {
      setDonationReceiveError(error.message || "No se pudo recepcionar la línea.");
    } finally {
      Swal.close();
      setDonationReceiveSaving(false);
    }
  }

  async function handleSubmitDonationBulkReceipt(form) {
    if (!selectedDonation?.id) {
      setDonationBulkReceiptError("No hay una donación seleccionada.");
      return;
    }

    const confirmed = await showInventoryConfirmDialog({
      title: "Recepcionar items seleccionados",
      html: `Se registrara la cantidad pendiente completa de <strong>${form.detailIds.length}</strong> item${form.detailIds.length === 1 ? "" : "s"}.`,
      confirmButtonText: "Registrar recepción",
      icon: "question",
    });

    if (!confirmed) return;

    setDonationBulkReceiptSaving(true);
    setDonationBulkReceiptError("");
    fireInventorySwal({
      title: "Registrando recepción masiva...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const result = await receiveDonationItemsBulk({
        donation_id: Number(selectedDonation.id),
        donation_item_ids: form.detailIds,
        destination_location_id: form.destinationLocationId,
        fecha_recepcion: form.receiptDate,
        observaciones: form.observations,
        idempotency_key: form.idempotencyKey,
      });

      setDonationBulkReceiptOpen(false);
      pushFeedback(
        "success",
        `Recepcion masiva registrada para ${result.processedCount} item${result.processedCount === 1 ? "" : "s"}.`,
      );
      emitInventoryUpdated({ section: "donations" });
      await loadDonations();
      await loadDonationDetail(selectedDonation.id);
    } catch (error) {
      setDonationBulkReceiptError(
        error.message || "No se pudo registrar la recepción masiva de la donación.",
      );
    } finally {
      Swal.close();
      setDonationBulkReceiptSaving(false);
    }
  }

  async function handleSubmitPurchase(event) {
    event.preventDefault();
    if (!purchaseForm.supplierId) {
      setPurchaseFormError("Debes seleccionar un proveedor.");
      return;
    }
    if (!purchaseForm.fechaCompra) {
      setPurchaseFormError("Debes ingresar la fecha de compra.");
      return;
    }

    setPurchaseSaving(true);
    setPurchaseFormError("");
    try {
      const payload = {
        supplier_id: Number(purchaseForm.supplierId),
        fecha_compra: purchaseForm.fechaCompra,
        moneda: purchaseForm.moneda,
        fecha_vencimiento_pago: purchaseForm.fechaVencimientoPago || null,
        observacion_financiera: purchaseForm.observacionFinanciera.trim() || null,
        descripcion: purchaseForm.descripcion.trim() || null,
        observaciones: purchaseForm.observaciones.trim() || null,
        registered_by_id: Number(user?.id),
      };
      const savedPurchase = purchaseFormMode === "edit"
        ? await updatePurchase(parseEntityIdOrThrow(editingPurchaseId, "compra"), payload)
        : await createPurchase(payload);
      setSelectedPurchase(savedPurchase);
      setPurchaseModalOpen(false);
      setEditingPurchaseId("");
      pushFeedback(
        "success",
        purchaseFormMode === "edit"
          ? "Compra actualizada correctamente."
          : "Compra creada correctamente. Ahora puedes agregar detalles antes de confirmarla.",
      );
      await loadPurchases();
    } catch (error) {
      setPurchaseFormError(error.message || "No se pudo guardar la compra.");
    } finally {
      setPurchaseSaving(false);
    }
  }

  async function handleSubmitPurchaseDetail(event) {
    event.preventDefault();
    const quantity = parsePositiveDecimal(purchaseDetailForm.cantidad);
    const unitPrice = parsePositiveDecimal(purchaseDetailForm.precioUnitario);

    if (!purchaseDetailForm.purchaseId) {
      setPurchaseDetailError("Debes seleccionar una compra.");
      return;
    }
    if (!purchaseDetailForm.itemId) {
      setPurchaseDetailError("Debes seleccionar un item.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setPurchaseDetailError("Debes ingresar una cantidad decimal mayor a 0.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setPurchaseDetailError("Debes ingresar un precio unitario mayor a 0.");
      return;
    }

    setPurchaseDetailSaving(true);
    setPurchaseDetailError("");
    try {
      const payload = {
        purchase_id: Number(purchaseDetailForm.purchaseId),
        item_id: Number(purchaseDetailForm.itemId),
        cantidad: quantity,
        precio_unitario: unitPrice,
        condicion: purchaseDetailForm.condicion || null,
        fecha_vencimiento: purchaseDetailForm.fechaVencimiento || null,
        fecha_apertura: purchaseDetailForm.fechaApertura || null,
        condiciones_almacenamiento: purchaseDetailForm.condicionesAlmacenamiento.trim() || null,
        observaciones: purchaseDetailForm.observaciones.trim() || null,
      };
      await (editingPurchaseDetailId
        ? updatePurchaseDetail(parseEntityIdOrThrow(editingPurchaseDetailId, "detalle"), payload)
        : createPurchaseDetail(payload));
      setPurchaseDetailModalOpen(false);
      setEditingPurchaseDetailId("");
      pushFeedback("success", editingPurchaseDetailId ? "Detalle de compra actualizado correctamente." : "Detalle de compra creado correctamente.");
      await loadPurchases();
      await loadPurchaseDetail(Number(purchaseDetailForm.purchaseId));
    } catch (error) {
      setPurchaseDetailError(error.message || "No se pudo guardar el detalle de compra.");
    } finally {
      setPurchaseDetailSaving(false);
    }
  }

  async function handleSubmitPurchaseReceive(event) {
    event.preventDefault();
    const quantity = parsePositiveDecimal(purchaseReceiveForm.cantidad);
    const currentLine = (selectedPurchase?.purchaseDetails || []).find(
      (line) => Number(line.id) === Number(purchaseReceiveForm.lineId),
    );
    if (!purchaseReceiveForm.lineId) {
      setPurchaseReceiveError("Debes seleccionar una línea.");
      return;
    }
    if (!purchaseReceiveForm.receiptDate) {
      setPurchaseReceiveError("Debes ingresar la fecha de recepción.");
      return;
    }
    if (!purchaseReceiveForm.destinationLocationId) {
      setPurchaseReceiveError("Debes seleccionar una ubicación destino.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setPurchaseReceiveError("Debes ingresar una cantidad decimal mayor a 0.");
      return;
    }
    const expectedQuantity = Number(currentLine?.cantidad || 0);
    const currentReceived = Number(currentLine?.cantidadRecepcionada || 0);
    const finalReceived = currentReceived + quantity;
    const incompleteClose =
      purchaseReceiveForm.cierraDetalle
      && expectedQuantity > 0
      && finalReceived < expectedQuantity;

    if (incompleteClose) {
      const confirmedClose = await showInventoryConfirmDialog({
        title: "Cerrar detalle de forma incompleta",
        html: `
          <p>Se esperaban <strong>${formatQuantity(expectedQuantity)}</strong> unidades y el total recibido quedara en <strong>${formatQuantity(finalReceived)}</strong>.</p>
          <p>Después de cerrar este detalle no podran registrarse nuevas recepciones.</p>
        `,
        confirmButtonText: "Cerrar detalle",
        cancelButtonText: "Volver",
      });

      if (!confirmedClose) {
        return;
      }
    }

    setPurchaseReceiveSaving(true);
    setPurchaseReceiveError("");
    fireInventorySwal({
      title: "Registrando recepción...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    try {
      const result = await receivePurchaseDetail({
        purchase_detail_id: Number(purchaseReceiveForm.lineId),
        fecha_recepcion: purchaseReceiveForm.receiptDate,
        destination_location_id: Number(purchaseReceiveForm.destinationLocationId),
        cantidad_a_recepcionar: quantity,
        condicion: purchaseReceiveForm.condicion || null,
        fecha_vencimiento: purchaseReceiveForm.fechaVencimiento || null,
        fecha_apertura: purchaseReceiveForm.fechaApertura || null,
        condiciones_almacenamiento: purchaseReceiveForm.condicionesAlmacenamiento.trim() || null,
        observaciones: purchaseReceiveForm.observaciones.trim() || null,
        cierra_detalle: purchaseReceiveForm.cierraDetalle,
        idempotency_key: purchaseReceiveForm.idempotencyKey,
      });
      setPurchaseReceiveModalOpen(false);
      pushFeedback("success", "Recepción de compra registrada correctamente.");
      emitInventoryUpdated({ section: "purchases" });
      await loadPurchases();
      if (result?.purchaseDetail?.purchaseId) {
        await loadPurchaseDetail(result.purchaseDetail.purchaseId);
      } else if (selectedPurchase?.id) {
        await loadPurchaseDetail(selectedPurchase.id);
      }
    } catch (error) {
      setPurchaseReceiveError(error.message || "No se pudo recepcionar la línea de compra.");
    } finally {
      Swal.close();
      setPurchaseReceiveSaving(false);
    }
  }

  async function handleSubmitPurchaseBulkReceipt(form) {
    if (!selectedPurchase?.id) {
      setPurchaseBulkReceiptError("No hay una compra seleccionada.");
      return;
    }

    const confirmed = await showInventoryConfirmDialog({
      title: "Recepcionar detalles seleccionados",
      html: `Se registrara la cantidad pendiente completa de <strong>${form.detailIds.length}</strong> detalle${form.detailIds.length === 1 ? "" : "s"}.`,
      confirmButtonText: "Registrar recepción",
      icon: "question",
    });

    if (!confirmed) return;

    setPurchaseBulkReceiptSaving(true);
    setPurchaseBulkReceiptError("");
    fireInventorySwal({
      title: "Registrando recepción masiva...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const result = await receivePurchaseDetailsBulk({
        purchase_id: Number(selectedPurchase.id),
        purchase_detail_ids: form.detailIds,
        destination_location_id: form.destinationLocationId,
        fecha_recepcion: form.receiptDate,
        observaciones: form.observations,
        idempotency_key: form.idempotencyKey,
      });

      setPurchaseBulkReceiptOpen(false);
      pushFeedback(
        "success",
        `Recepcion masiva registrada para ${result.processedCount} detalle${result.processedCount === 1 ? "" : "s"}.`,
      );
      emitInventoryUpdated({ section: "purchases" });
      await loadPurchases();
      await loadPurchaseDetail(selectedPurchase.id);
    } catch (error) {
      setPurchaseBulkReceiptError(
        error.message || "No se pudo registrar la recepción masiva de la compra.",
      );
    } finally {
      Swal.close();
      setPurchaseBulkReceiptSaving(false);
    }
  }

  async function handleSubmitSupplier(event) {
    event.preventDefault();
    if (!supplierForm.nombre.trim()) {
      setSupplierFormError("Debes ingresar el nombre del proveedor.");
      return;
    }
    if (supplierForm.hasLocation) {
      const payload = buildLocationPayload({
        direccion: supplierForm.direccion,
        regionId: supplierForm.regionId,
        comunaId: supplierForm.comunaId,
        observaciones: supplierForm.locationObservaciones,
      });
      if (!payload) {
        setSupplierFormError("Si agregas ubicación, debes completar dirección, region y comuna.");
        return;
      }
    }

    setSupplierSaving(true);
    setSupplierFormError("");
    try {
      const payload = {
        nombre: supplierForm.nombre.trim(),
        telefono: supplierForm.telefono.trim() || null,
        email: supplierForm.email.trim() || null,
        observaciones: supplierForm.observaciones.trim() || null,
        activo: Boolean(supplierForm.activo),
        location: supplierForm.hasLocation
          ? buildLocationPayload({
              direccion: supplierForm.direccion,
              regionId: supplierForm.regionId,
              comunaId: supplierForm.comunaId,
              observaciones: supplierForm.locationObservaciones,
            })
          : null,
      };
      const savedSupplier = supplierFormMode === "edit"
        ? await updateSupplier(parseEntityIdOrThrow(editingSupplierId, "proveedor"), payload)
        : await createSupplier(payload);
      setSupplierModalOpen(false);
      setEditingSupplierId("");
      setSuppliers((current) => {
        const remaining = current.filter((supplier) => String(supplier.id) !== String(savedSupplier.id));
        return [savedSupplier, ...remaining];
      });
      pushFeedback(
        "success",
        supplierFormMode === "edit"
          ? "Proveedor actualizado correctamente."
          : "Proveedor creado correctamente.",
      );
      await loadSuppliersData();
    } catch (error) {
      setSupplierFormError(error.message || "No se pudo guardar el proveedor.");
    } finally {
      setSupplierSaving(false);
    }
  }

  async function handleSubmitDonor(event) {
    event.preventDefault();
    if (!donorForm.nombre.trim()) {
      setDonorFormError("Debes ingresar el nombre del donante.");
      return;
    }

    const duplicate = findMatchingDonor(donors, donorForm, {
      excludeId: donorFormMode === "edit" ? editingDonorId : null,
    });
    if (duplicate) {
      const fieldLabel = duplicate.matchedBy === "telefono"
        ? "teléfono"
        : duplicate.matchedBy === "instagram"
          ? "usuario de Instagram"
          : "correo electrónico";
      setDonorFormError(
        `Ya existe el donante ${duplicate.donor.nombreCompleto || duplicate.donor.nombre} con el mismo ${fieldLabel}.`,
      );
      return;
    }

    setDonorSaving(true);
    setDonorFormError("");
    try {
      const payload = {
        nombre: donorForm.nombre.trim(),
        apellido: donorForm.apellido.trim() || null,
        email: normalizeDonorEmail(donorForm.email) || null,
        telefono: donorForm.telefono.trim() || null,
        usuario_instagram: normalizeInstagramUsername(donorForm.usuarioInstagram) || null,
        direccion: donorForm.direccion.trim() || null,
        observaciones: donorForm.observaciones.trim() || null,
        activo: Boolean(donorForm.activo),
      };
      const savedDonor = donorFormMode === "edit"
        ? await updateDonor(parseEntityIdOrThrow(editingDonorId, "donante"), payload)
        : await createDonor(payload);
      setDonorModalOpen(false);
      setEditingDonorId("");
      setDonors((current) => {
        const remaining = current.filter((donor) => String(donor.id) !== String(savedDonor.id));
        return [savedDonor, ...remaining];
      });
      pushFeedback(
        "success",
        donorFormMode === "edit"
          ? "Donante actualizado correctamente."
          : "Donante creado correctamente.",
      );
      await loadDonors();
    } catch (error) {
      setDonorFormError(error.message || "No se pudo guardar el donante.");
    } finally {
      setDonorSaving(false);
    }
  }


  async function handleDeleteDonationAction(donation) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Eliminar donación",
      html:
        "Se intentara eliminar la donación. Si ya tiene trazabilidad, el sistema la bloqueara o exigira una cancelación segura.",
      confirmButtonText: "Eliminar donación",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) return;

    try {
      await deleteDonation(parseEntityIdOrThrow(donation.id, "donacion"));
      if (String(selectedDonation?.id) === String(donation.id)) {
        setSelectedDonation(null);
      }
      pushFeedback("success", "Donación eliminada correctamente.");
      await loadDonations();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo eliminar la donación.");
    }
  }

  async function handleCancelDonationAction(donation) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Cancelar donación",
      html: "La donación se marcara como cancelada y conservara su trazabilidad.",
      confirmButtonText: "Cancelar donación",
      confirmButtonColor: "#d97706",
    });
    if (!confirmed) return;

    try {
      const updatedDonation = await updateDonation(parseEntityIdOrThrow(donation.id, "donacion"), {
        estado: "CANCELADO",
      });
      setSelectedDonation(updatedDonation);
      pushFeedback("success", "Donación cancelada correctamente.");
      await loadDonations();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo cancelar la donación.");
    }
  }

  async function handleDeleteDonationItemAction(donation, line) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Eliminar item de donación",
      html: "Se eliminara esta líneasolo si no tiene recepciones ni movimientos asociados.",
      confirmButtonText: "Eliminar item",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) return;

    try {
      await deleteDonationItem(parseEntityIdOrThrow(line.id, "linea"));
      pushFeedback("success", "línea de donación eliminada correctamente.");
      await loadDonations();
      await loadDonationDetail(parseEntityIdOrThrow(donation.id, "donacion"));
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo eliminar la línea de donación.");
    }
  }

  async function handleDeletePurchaseAction(purchase) {
    const isDraftWithoutDetails =
      purchase.estado === "BORRADOR" && Number(purchase.detailCount || 0) === 0;
    const confirmed = await showInventoryConfirmDialog({
      title: isDraftWithoutDetails ? "Eliminar borrador de compra" : "Cancelar compra",
      html: isDraftWithoutDetails
        ? "Se eliminara el borrador de compra de forma permanente."
        : "La compra se cancelara y el sistema validara inventario y dependencias contables antes de continuar.",
      confirmButtonText: isDraftWithoutDetails ? "Eliminar borrador" : "Cancelar compra",
      confirmButtonColor: isDraftWithoutDetails ? "#dc2626" : "#d97706",
    });
    if (!confirmed) return;

    try {
      const result = await deletePurchase(parseEntityIdOrThrow(purchase.id, "compra"));
      if (result?.estado === "CANCELADA" || result?.operacion === "cancelacion_logica") {
        setSelectedPurchase(result);
      } else if (String(selectedPurchase?.id) === String(purchase.id)) {
        setSelectedPurchase(null);
      }
      pushFeedback(
        "success",
        result?.operacion === "cancelacion_logica"
          ? "Compra cancelada y cuenta por pagar anulada correctamente."
          : isDraftWithoutDetails
            ? "Borrador eliminado correctamente."
            : "Compra cancelada correctamente.",
      );
      await loadPurchases();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo eliminar la compra.");
    }
  }

  async function handleConfirmPurchaseAction(purchase) {
  const confirmed = await showInventoryConfirmDialog({
    title: "Confirmar compra",
    html: `
      <div style="text-align:left">
        <p>
          <strong>Proveedor:</strong>
          ${purchase.supplier?.nombre || "Sin proveedor"}
        </p>
        <p>
          <strong>Detalles:</strong>
          ${purchase.purchaseDetails?.length || 0}
        </p>
        <p>
          <strong>Total:</strong>
          ${formatMoney(purchase.montoTotal, purchase.moneda)}
        </p>
        <p>
          <strong>Vencimiento:</strong>
          ${formatDate(purchase.fechaVencimientoPago)}
        </p>
        <p>
          Al confirmar se generará una cuenta por pagar y los detalles
          dejarán de ser editables.
        </p>
      </div>
    `,
    confirmButtonText: "Confirmar compra",
    confirmButtonColor: "#2563eb",
  });

  if (!confirmed) return;

  try {
    const purchaseId = parseEntityIdOrThrow(
      purchase.id,
      "compra",
    );

    fireInventorySwal({
      title: "Confirmando compra",
      text: "Estamos generando la cuenta por pagar.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const confirmedPurchase = await confirmPurchase(purchaseId);

    setSelectedPurchase(confirmedPurchase);

    await loadPurchases();
    await loadPurchaseDetail(confirmedPurchase.id);

    pushFeedback(
      "success",
      "Compra confirmada correctamente. La cuenta por pagar fue generada.",
    );
  } catch (error) {
    console.error("Error al confirmar la compra:", error);

    pushFeedback(
      "error",
      error.message || "No se pudo confirmar la compra.",
    );
  } finally {
    Swal.close();
  }
}

  async function handleRevertPurchaseToDraftAction(purchase) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Volver compra a borrador",
      html: "La cuenta por pagar pendiente sera anulada y los detalles volveran a ser editables.",
      confirmButtonText: "Volver a borrador",
      confirmButtonColor: "#2563eb",
    });
    if (!confirmed) return;

    try {
      const revertedPurchase = await revertPurchaseToDraft(parseEntityIdOrThrow(purchase.id, "compra"));
      setSelectedPurchase(revertedPurchase);
      pushFeedback("success", "La compra volvio a borrador correctamente.");
      await loadPurchases();
      await loadPurchaseDetail(revertedPurchase.id);
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo devolver la compra a borrador.");
    }
  }

  async function handleDeletePurchaseDetailAction(purchase, detail) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Eliminar detalle de compra",
      html: "Se eliminara esta líneasolo si no tiene recepciones ni movimientos asociados.",
      confirmButtonText: "Eliminar detalle",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) return;

    try {
      await deletePurchaseDetail(parseEntityIdOrThrow(detail.id, "detalle"));
      pushFeedback("success", "Detalle de compra eliminado correctamente.");
      await loadPurchases();
      await loadPurchaseDetail(parseEntityIdOrThrow(purchase.id, "compra"));
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo eliminar el detalle de compra.");
    }
  }

  async function handleDeactivateSupplierAction(supplier) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Desactivar proveedor",
      html: supplier.activo
        ? "El proveedor se desactivara para impedir nuevos registros, pero seguira visible en históricos."
        : "El proveedor ya se encuentra inactivo.",
      confirmButtonText: "Desactivar proveedor",
      confirmButtonColor: "#d97706",
    });
    if (!confirmed || !supplier.activo) return;

    try {
      await deleteSupplier(parseEntityIdOrThrow(supplier.id, "proveedor"));
      pushFeedback("success", "Proveedor desactivado correctamente.");
      await loadSuppliersData();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo desactivar el proveedor.");
    }
  }

  async function handleReactivateSupplierAction(supplier) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Activar proveedor",
      html: "El proveedor volvera a quedar disponible para nuevas compras.",
      confirmButtonText: "Activar proveedor",
      confirmButtonColor: "#2563eb",
      icon: "question",
    });
    if (!confirmed) return;

    try {
      await updateSupplier(parseEntityIdOrThrow(supplier.id, "proveedor"), { activo: true });
      pushFeedback("success", "Proveedor reactivado correctamente.");
      await loadSuppliersData();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo reactivar el proveedor.");
    }
  }

  async function handleDeleteDonorAction(donor) {
    const confirmed = await showInventoryConfirmDialog({
      title: "Eliminar donante",
      html: "Solo podrás eliminarlo si no tiene historial asociado. Si ya tiene registros, conviene desactivarlo.",
      confirmButtonText: "Eliminar donante",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) return;

    try {
      await deleteDonor(parseEntityIdOrThrow(donor.id, "donante"));
      if (String(donationForm.donorId || "") === String(donor.id)) {
        setDonationForm((current) => ({ ...current, donorId: "" }));
      }
      pushFeedback("success", "Donante eliminado correctamente.");
      await loadDonors();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo eliminar el donante.");
    }
  }

  async function handleToggleDonorActiveAction(donor) {
    const confirmed = await showInventoryConfirmDialog({
      title: donor.activo ? "Desactivar donante" : "Activar donante",
      html: donor.activo
        ? "El donante dejara de estar disponible para nuevas asociaciones, pero su historial se conservara."
        : "El donante volvera a estar disponible para nuevas asociaciones.",
      confirmButtonText: donor.activo ? "Desactivar donante" : "Activar donante",
      confirmButtonColor: donor.activo ? "#d97706" : "#2563eb",
      icon: donor.activo ? "warning" : "question",
    });
    if (!confirmed) return;

    try {
      await updateDonor(parseEntityIdOrThrow(donor.id, "donante"), {
        activo: !donor.activo,
      });
      pushFeedback(
        "success",
        donor.activo ? "Donante desactivado correctamente." : "Donante activado correctamente.",
      );
      await loadDonors();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo actualizar el estado del donante.");
    }
  }

  async function handleSubmitStockCount(event) {
    event.preventDefault();
    if (!stockCountForm.locationId) {
      setStockCountFormError("Debes seleccionar una ubicación.");
      return;
    }
    if (!stockCountForm.fechaConteo) {
      setStockCountFormError("Debes ingresar la fecha del conteo.");
      return;
    }

    const details = [];
    for (const row of stockCountForm.detalles) {
      const counted = parsePositiveDecimal(row.cantidadContada);
      if (!row.itemId) {
        setStockCountFormError("Todos los detalles del conteo deben tener item.");
        return;
      }
      if (!Number.isFinite(counted) || counted < 0) {
        setStockCountFormError("Las cantidades contadas deben ser numeros validos.");
        return;
      }
      details.push({
        item_id: Number(row.itemId),
        existencia_id: row.existenciaId ? Number(row.existenciaId) : null,
        cantidad_contada: counted,
        observaciones: row.observaciones.trim() || null,
      });
    }

    setStockCountSaving(true);
    setStockCountFormError("");
    try {
      const createdCount = await createStockCount({
        fecha_conteo: stockCountForm.fechaConteo,
        location_id: Number(stockCountForm.locationId),
        observaciones: stockCountForm.observaciones.trim() || null,
        detalles: details,
      });
      setSelectedStockCount(createdCount);
      setStockCountModalOpen(false);
      pushFeedback("success", "Conteo físico creado correctamente.");
      await loadCounts();
    } catch (error) {
      setStockCountFormError(error.message || "No se pudo crear el conteo.");
    } finally {
      setStockCountSaving(false);
    }
  }

  async function handleSubmitAdjustment(event) {
    event.preventDefault();
    if (!adjustmentForm.locationId) {
      setAdjustmentError("Debes seleccionar una ubicación.");
      return;
    }
    if (!adjustmentForm.motivo.trim()) {
      setAdjustmentError("Debes ingresar el motivo del ajuste.");
      return;
    }

    const details = [];
    for (const row of adjustmentForm.detalles) {
      const before = parsePositiveDecimal(row.cantidadAntes);
      const counted = parsePositiveDecimal(row.cantidadContada);

      if (!row.itemId) {
        setAdjustmentError("Todos los detalles del ajuste deben tener item.");
        return;
      }
      if (!Number.isFinite(before) || before < 0 || !Number.isFinite(counted) || counted < 0) {
        setAdjustmentError("Las cantidades del ajuste deben ser numeros validos.");
        return;
      }

      details.push({
        item_id: Number(row.itemId),
        existencia_id: row.existenciaId ? Number(row.existenciaId) : null,
        cantidad_antes: before,
        cantidad_contada: counted,
      });
    }

    setAdjustmentSaving(true);
    setAdjustmentError("");
    try {
      const createdAdjustment = await createManualInventoryAdjustment({
        location_id: Number(adjustmentForm.locationId),
        motivo: adjustmentForm.motivo.trim(),
        observaciones: adjustmentForm.observaciones.trim() || null,
        detalles: details,
      });
      setSelectedAdjustment(createdAdjustment);
      setAdjustmentModalOpen(false);
      pushFeedback("success", "Ajuste manual creado correctamente.");
      await loadAdjustments();
    } catch (error) {
      setAdjustmentError(error.message || "No se pudo crear el ajuste manual.");
    } finally {
      setAdjustmentSaving(false);
    }
  }

  async function handleSubmitAdjustmentFromCount(event) {
    event.preventDefault();
    if (!adjustmentFromCountForm.stockCountId) {
      setAdjustmentFromCountError("Debes seleccionar un conteo físico.");
      return;
    }
    if (!adjustmentFromCountForm.motivo.trim()) {
      setAdjustmentFromCountError("Debes ingresar el motivo del ajuste.");
      return;
    }

    setAdjustmentFromCountSaving(true);
    setAdjustmentFromCountError("");
    try {
      const createdAdjustment = await createAdjustmentFromStockCount({
        stock_count_id: Number(adjustmentFromCountForm.stockCountId),
        motivo: adjustmentFromCountForm.motivo.trim(),
        observaciones: adjustmentFromCountForm.observaciones.trim() || null,
      });
      setSelectedAdjustment(createdAdjustment);
      setAdjustmentFromCountModalOpen(false);
      pushFeedback("success", "Ajuste generado desde el conteo físico.");
      await loadAdjustments();
    } catch (error) {
      setAdjustmentFromCountError(error.message || "No se pudo crear el ajuste desde el conteo.");
    } finally {
      setAdjustmentFromCountSaving(false);
    }
  }

  async function handleApplyAdjustment(adjustmentId) {
    if (!adjustmentId) return;
    const confirmed = window.confirm("Se aplicara el ajuste y se generaran movimientos históricos. ¿Continuar?");
    if (!confirmed) return;

    try {
      const result = await applyInventoryAdjustment(adjustmentId);
      setSelectedAdjustment(result.adjustment || null);
      pushFeedback("success", "Ajuste aplicado correctamente.");
      emitInventoryUpdated({ section: "adjustments" });
      await loadAdjustments();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo aplicar el ajuste.");
    }
  }

  async function handleSubmitItem(event) {
    event.preventDefault();
    if (!itemForm.nombre.trim()) {
      setItemFormError("Debes ingresar el nombre del item.");
      return;
    }
    if (!itemForm.categoriaId) {
      setItemFormError("Debes seleccionar una categoria.");
      return;
    }
    if (!itemForm.unidadId) {
      setItemFormError("Debes seleccionar una unidad.");
      return;
    }
    const stockMinimo =
      itemForm.stockMinimo === "" ? null : parsePositiveDecimal(itemForm.stockMinimo);
    if (itemForm.stockMinimo !== "" && (!Number.isFinite(stockMinimo) || stockMinimo < 0)) {
      setItemFormError("El stock minimo debe ser un número válido.");
      return;
    }

    setItemSaving(true);
    setItemFormError("");
    try {
      const payload = {
        nombre: itemForm.nombre.trim(),
        descripcion: itemForm.descripcion.trim() || null,
        stock_minimo: stockMinimo,
        activo: Boolean(itemForm.activo),
        categoria_item_id: Number(itemForm.categoriaId),
        unidad_medida_id: Number(itemForm.unidadId),
      };

      if (editingItemId) {
        await updateItem(Number(editingItemId), payload);
        pushFeedback("success", "Item actualizado correctamente.");
      } else {
        await createItem(payload);
        pushFeedback("success", "Item creado correctamente.");
      }
      setItemModalOpen(false);
      await loadCatalogItems();
      await loadSummary();
    } catch (error) {
      setItemFormError(error.message || "No se pudo guardar el item.");
    } finally {
      setItemSaving(false);
    }
  }

  async function handleDeleteItem(item) {
    const confirmed = window.confirm(`Se desactivara el item "${item.nombre}". ¿Continuar?`);
    if (!confirmed) return;
    try {
      await deleteItem(item.id);
      pushFeedback("success", "Item desactivado correctamente.");
      await loadCatalogItems();
      await loadSummary();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo desactivar el item.");
    }
  }

  async function handleSubmitCategory(event) {
    event.preventDefault();
    if (!categoryForm.nombre.trim()) {
      setCategoryFormError("Debes ingresar el nombre de la categoria.");
      return;
    }

    setCategorySaving(true);
    setCategoryFormError("");
    try {
      const payload = {
        nombre_categoria: categoryForm.nombre.trim(),
        activo: Boolean(categoryForm.activo),
      };
      if (editingCategoryId) {
        await updateItemCategory(Number(editingCategoryId), payload);
        pushFeedback("success", "Categoria actualizada correctamente.");
      } else {
        await createItemCategory(payload);
        pushFeedback("success", "Categoria creada correctamente.");
      }
      setCategoryModalOpen(false);
      await loadCategories();
      await loadCatalogItems();
    } catch (error) {
      setCategoryFormError(error.message || "No se pudo guardar la categoria.");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleDeleteCategory(category) {
    const confirmed = window.confirm(`Se procesara la baja de "${category.nombre}". ¿Continuar?`);
    if (!confirmed) return;
    try {
      await deleteItemCategory(category.id);
      pushFeedback("success", "Categoria procesada correctamente.");
      await loadCategories();
      await loadCatalogItems();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo eliminar la categoria.");
    }
  }

  async function handleSubmitUnit(event) {
    event.preventDefault();
    if (!unitForm.nombre.trim()) {
      setUnitFormError("Debes ingresar el nombre de la unidad.");
      return;
    }

    setUnitSaving(true);
    setUnitFormError("");
    try {
      const payload = {
        nombre: unitForm.nombre.trim(),
        descripcion: unitForm.descripcion.trim() || null,
        activo: Boolean(unitForm.activo),
      };
      if (editingUnitId) {
        await updateUnitOfMeasure(Number(editingUnitId), payload);
        pushFeedback("success", "Unidad actualizada correctamente.");
      } else {
        await createUnitOfMeasure(payload);
        pushFeedback("success", "Unidad creada correctamente.");
      }
      setUnitModalOpen(false);
      await loadUnits();
      await loadCatalogItems();
    } catch (error) {
      setUnitFormError(error.message || "No se pudo guardar la unidad.");
    } finally {
      setUnitSaving(false);
    }
  }

  async function handleDeleteUnit(unit) {
    const confirmed = window.confirm(`Se procesara la baja de "${unit.nombre}". ¿Continuar?`);
    if (!confirmed) return;
    try {
      await deleteUnitOfMeasure(unit.id);
      pushFeedback("success", "Unidad procesada correctamente.");
      await loadUnits();
      await loadCatalogItems();
    } catch (error) {
      pushFeedback("error", error.message || "No se pudo eliminar la unidad.");
    }
  }

  const comunasForSupplierRegion = supplierForm.regionId
    ? comunasByRegion[supplierForm.regionId] || []
    : [];

  const locationsActiveOptions = useMemo(
    () => locations.filter((location) => location.activo),
    [locations],
  );

  const selectedStockCountExistences = stockCountForm.locationId
    ? existencesByLocation[stockCountForm.locationId] || []
    : [];

  function renderFeedback() {
    if (!feedback.message) return null;

    return (
      <p className={feedback.type === "error" ? "error-text" : "inventory-success-banner"}>
        {feedback.message}
      </p>
    );
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

  function renderInventoryTab() {
    return (
      <>
        <InventorySection
          title="Resumen de inventario"
          actions={
            <>
              {canCreateInitialLoad ? (
                <button type="button" className="btn btn-primary btn-small" onClick={() => openInitialLoadModal("")}>
                  Carga inicial
                </button>
              ) : null}
              {canCreateAdjustments ? (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => openAdjustmentModal({})}>
                  Ajuste manual
                </button>
              ) : null}
            </>
          }
        >
          <div className="settings-filter-grid inventory-filter-grid">
            <label className="settings-filter-field">
              <span>Buscar</span>
              <input
                type="search"
                value={summaryFilters.search}
                onChange={(event) => setSummaryFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Item, categoria o estado"
              />
            </label>

            <label className="settings-filter-field">
              <span>Categoria</span>
              <select
                value={summaryFilters.categoriaId}
                onChange={(event) => setSummaryFilters((current) => ({ ...current, categoriaId: event.target.value }))}
              >
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-filter-field">
              <span>Estado stock</span>
              <select
                value={summaryFilters.estadoStock}
                onChange={(event) => setSummaryFilters((current) => ({ ...current, estadoStock: event.target.value }))}
              >
                <option value="">Todos</option>
                {STOCK_STATE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {stockStateLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-filter-field">
              <span>Estado item</span>
              <select
                value={summaryFilters.activo}
                onChange={(event) => setSummaryFilters((current) => ({ ...current, activo: event.target.value }))}
              >
                <option value="">Todos</option>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </label>
          </div>

          <label className="inventory-inline-checkbox">
            <input
              type="checkbox"
              checked={summaryFilters.soloBajoMinimo}
              onChange={(event) =>
                setSummaryFilters((current) => ({
                  ...current,
                  soloBajoMinimo: event.target.checked,
                }))
              }
            />
            <span>Mostrar solo items con alerta de stock</span>
          </label>

          {isLocationOnlyInventoryView ? (
            <label className="inventory-inline-checkbox">
              <input
                type="checkbox"
                checked={summaryFilters.mostrarSinStock}
                onChange={(event) =>
                  setSummaryFilters((current) => ({
                    ...current,
                    mostrarSinStock: event.target.checked,
                  }))
                }
              />
              <span>Mostrar items sin stock</span>
            </label>
          ) : null}

          <FilterSummaryBar
            stats={summaryFilterStats}
            onClear={resetSummaryFilters}
          />

          {loading.summary ? (
            <p className="inventory-subtle">Cargando resumen de inventario...</p>
          ) : summaryRowsFiltered.length === 0 ? (
            <InventoryEmptyState>No hay items visibles con los filtros actuales.</InventoryEmptyState>
          ) : (
            <>
              <div className="table-scroll">
              <table className="crud-table inventory-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Categoria</th>
                    <th>Unidad</th>
                    <th>Cantidad total</th>
                    <th>Ubicaciones</th>
                    <th>Stock minimo</th>
                    <th>Estado</th>
                    <th className="table-actions-header">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSummaryRows.items.map((row) => (
                    <tr key={row.itemId}>
                      <td>
                        <div className="settings-meta-stack">
                          <strong>{row.itemNombre}</strong>
                          <small>ID #{row.itemId}</small>
                        </div>
                      </td>
                      <td>{row.categoriaNombre || "Sin categoria"}</td>
                      <td>{row.unidadMedidaNombre || "Sin unidad"}</td>
                      <td>{formatQuantity(row.cantidadTotal)}</td>
                      <td>{row.numeroUbicaciones}</td>
                      <td>{row.stockMinimo === null ? "Sin minimo" : formatQuantity(row.stockMinimo)}</td>
                      <td>
                        <InventoryBadge
                          tone={
                            row.estadoStock === "SIN_STOCK"
                              ? "danger"
                              : row.estadoStock === "BAJO_MINIMO"
                                ? "warning"
                                : "success"
                          }
                        >
                          {stockStateLabel(row.estadoStock)}
                        </InventoryBadge>
                      </td>
                      <td className="table-actions-cell">
                        <div className="row-actions table-actions">
                          <IconButton
                            as={Link}
                            icon={Eye}
                            label={`Ver detalle del item ${row.itemNombre || ""}`.trim()}
                            variant="secondary"
                            to={`/inventario/item/${row.itemId}`}
                          />
                          {canCreateInitialLoad ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              onClick={() => openInitialLoadModal(row.itemId)}
                            >
                              Carga inicial
                            </button>
                          ) : null}
                          {canCreateAdjustments ? (
                            <IconButton
                              icon={SlidersHorizontal}
                              label={`Ajustar inventario de ${row.itemNombre || ""}`.trim()}
                              variant="secondary"
                              onClick={() => openAdjustmentModal({ itemId: row.itemId, motivo: `Ajuste manual para ${row.itemNombre}` })}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {renderTablePagination("summary", paginatedSummaryRows)}
            </>
          )}
        </InventorySection>
      </>
    );
  }

  function renderDonationsTab() {
    return (
      <>
        <nav className="settings-tabs">
          {donationTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`home-tab-button ${activeDonationTab === tab.id ? "home-tab-button-active" : ""}`}
              onClick={() => setActiveDonationTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeDonationTab === DONATION_TABS.DONATIONS ? (
          <>
            <InventorySection
              title="Donaciones"
              actions={
                canCreateDonations ? (
                  <button type="button" className="btn btn-primary btn-small" onClick={() => openCreateDonationModal()}>
                    Nueva donación
                  </button>
                ) : null
              }
            >
              <div className="settings-filter-grid inventory-filter-grid">
                <label className="settings-filter-field">
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={donationFilters.search}
                    onChange={(event) => setDonationFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Motivo, donante, receptor, region u observaciones"
                  />
                </label>
                <label className="settings-filter-field">
                  <span>Estado general</span>
                  <select
                    value={donationFilters.status}
                    onChange={(event) => setDonationFilters((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="ACTIVA">Activas</option>
                    <option value="CANCELADA">Canceladas</option>
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Región</span>
                  <select
                    value={donationFilters.regionId}
                    onChange={(event) => setDonationFilters((current) => ({ ...current, regionId: event.target.value }))}
                  >
                    <option value="">Todas</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Usuario receptor</span>
                  <select
                    value={donationFilters.userId}
                    onChange={(event) => setDonationFilters((current) => ({ ...current, userId: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    {donationUserOptions.map((userOption) => (
                      <option key={userOption.id} value={userOption.id}>
                        {userOption.nombreCompleto || userOption.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Fecha registro</span>
                  <input
                    type="date"
                    value={donationFilters.fecha}
                    onChange={(event) => setDonationFilters((current) => ({ ...current, fecha: event.target.value }))}
                  />
                </label>
              </div>

              <FilterSummaryBar stats={donationStats} onClear={resetDonationFilters} />

              {loading.donations ? (
                <p className="inventory-subtle">Cargando donaciones...</p>
              ) : filteredDonations.length === 0 ? (
                <InventoryEmptyState>No hay donaciones registradas.</InventoryEmptyState>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="crud-table inventory-table">
                      <thead>
                        <tr>
                          <th>Donación</th>
                          <th>Donante</th>
                          <th>Fecha registro</th>
                          <th>Fecha recepción</th>
                          <th>Región</th>
                          <th>Estado general</th>
                          <th>Recepción</th>
                          <th>Líneas</th>
                          <th className="table-actions-header">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDonations.items.map((donation) => (
                          <tr key={donation.id}>
                            <td>
                              <div className="settings-meta-stack">
                                <strong>{donation.motivoDonacion}</strong>
                                <small>ID #{donation.id}</small>
                              </div>
                            </td>
                            <td>{donation.donor?.nombreCompleto || "Sin donante / anónima"}</td>
                            <td>{formatDate(donation.fechaRegistro)}</td>
                            <td>{formatDate(donation.fechaRecepcion)}</td>
                            <td>{donation.region?.nombre || "Sin region"}</td>
                            <td><InventoryStatusBadge status={getDonationGeneralStatus(donation)} /></td>
                            <td><InventoryStatusBadge status={donation.estadoRecepcion} /></td>
                            <td>{donation.itemCount}</td>
                            <td className="table-actions-cell">
                              {(() => {
                                const donationActions = getDonationActionState(donation);
                                return (
                                  <div className="row-actions table-actions">
                                    <IconButton
                                      icon={Eye}
                                      label={`Ver detalle de la donacion ${donation.id}`}
                                      variant="secondary"
                                      onClick={() => void loadDonationDetail(donation.id)}
                                    />
                                    {canUpdateDonations && donationActions.canEdit ? (
                                      <IconButton
                                        icon={Pencil}
                                        label={`Editar donacion ${donation.id}`}
                                        variant="secondary"
                                        onClick={() => openEditDonationModal(donation)}
                                      />
                                    ) : null}
                                    {canCreateDonationItems && donationActions.canEditDetails ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-small"
                                        onClick={() => openDonationItemModal(donation.id)}
                                      >
                                        Agregar item
                                      </button>
                                    ) : null}
                                    {canUpdateDonations && donationActions.canCancel ? (
                                      <IconButton
                                        icon={MinusCircle}
                                        label={`Cancelar donacion ${donation.id}`}
                                        variant="warning"
                                        onClick={() => void handleCancelDonationAction(donation)}
                                      />
                                    ) : null}
                                    {canDeleteDonations && donationActions.canDelete ? (
                                      <IconButton
                                        icon={Trash2}
                                        label={`Eliminar donacion ${donation.id}`}
                                        variant="danger"
                                        onClick={() => void handleDeleteDonationAction(donation)}
                                      />
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderTablePagination("donations", paginatedDonations)}
                </>
              )}
            </InventorySection>

            {selectedDonation ? (
              <InventorySection
                title={`Detalle de donacion #${selectedDonation.id}`}
                subtitle={selectedDonation.motivoDonacion}
                actions={
                  (() => {
                    const selectedDonationActions = getDonationActionState(selectedDonation);
                    const canBulkReceive = canReceiveDonationItems
                      && selectedDonation.donationItems.some(
                        (line) => getDonationItemActionState(selectedDonation, line).canReceive,
                      );

                    return selectedDonationActions.canEditDetails || canBulkReceive ? (
                      <div className="row-actions inventory-header-actions">
                        {canBulkReceive ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={openDonationBulkReceiptModal}
                          >
                            Recepcionar varios
                          </button>
                        ) : null}
                        {canCreateDonationItems && selectedDonationActions.canEditDetails ? (
                          <button type="button" className="btn btn-secondary btn-small" onClick={() => openDonationItemModal(selectedDonation.id)}>
                            Agregar item
                          </button>
                        ) : null}
                      </div>
                    ) : null;
                  })()
                }
              >
                <div className="inventory-detail-grid">
                  <article className="inventory-detail-card">
                    <span>Estado general</span>
                    <strong><InventoryStatusBadge status={getDonationGeneralStatus(selectedDonation)} /></strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Recepción</span>
                    <strong><InventoryStatusBadge status={selectedDonation.estadoRecepcion} /></strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Donante</span>
                    <strong>{selectedDonation.donor?.nombreCompleto || "Sin donante / anónima"}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Región</span>
                    <strong>{selectedDonation.region?.nombre || "Sin region"}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Recepciona</span>
                    <strong>{formatPersonName(selectedDonation.receivingUser)}</strong>
                  </article>
                </div>
                {(() => {
                  const selectedDonationActions = getDonationActionState(selectedDonation);
                  return selectedDonationActions.reason ? (
                    <p className="inventory-muted">{selectedDonationActions.reason}</p>
                  ) : null;
                })()}

                {selectedDonation.donationItems.length === 0 ? (
                  <InventoryEmptyState>Esta donación aun no tiene líneas asociadas.</InventoryEmptyState>
                ) : (
                  <>
                    <div className="table-scroll">
                      <table className="crud-table inventory-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Cantidad esperada</th>
                            <th>Cantidad recibida</th>
                            <th>Pendiente</th>
                            <th>Estado</th>
                            <th className="table-actions-header">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedDonationLines.items.map((line) => {
                            const pendingQuantity = Number(line.cantidadPendiente || 0);
                            return (
                              <tr key={line.id}>
                                <td>{line.itemNombre}</td>
                                <td>{formatQuantity(line.cantidad)}</td>
                                <td>{formatQuantity(line.cantidadRecepcionada)}</td>
                                <td>{formatQuantity(pendingQuantity)}</td>
                                <td><InventoryStatusBadge status={line.estado} /></td>
                                <td className="table-actions-cell">
                                  {(() => {
                                    const lineActions = getDonationItemActionState(selectedDonation, line);
                                    return (
                                      <div className="row-actions table-actions">
                                        {canUpdateDonationItems && lineActions.canEdit ? (
                                          <IconButton
                                            icon={Pencil}
                                            label={`Editar línea${line.id}`}
                                            variant="secondary"
                                            onClick={() => openDonationItemModal(selectedDonation.id, line)}
                                          />
                                        ) : null}
                                        {canReceiveDonationItems && lineActions.canReceive ? (
                                          <button
                                            type="button"
                                            className="btn btn-primary btn-small"
                                            onClick={() => openDonationReceiveModal(line)}
                                          >
                                            Recepcionar
                                          </button>
                                        ) : null}
                                        {canReadMovements && lineActions.canViewReceipts ? (
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-small"
                                            onClick={() => openDonationReceiptHistory(line)}
                                          >
                                            Ver recepciones
                                          </button>
                                        ) : null}
                                        {canDeleteDonationItems && lineActions.canDelete ? (
                                          <IconButton
                                            icon={Trash2}
                                            label={`Eliminar línea${line.id}`}
                                            variant="danger"
                                            onClick={() => void handleDeleteDonationItemAction(selectedDonation, line)}
                                          />
                                        ) : null}
                                      </div>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {renderTablePagination("donationLines", paginatedDonationLines)}
                  </>
                )}
              </InventorySection>
            ) : null}
          </>
        ) : null}

        {activeDonationTab === DONATION_TABS.DONORS ? (
          <InventorySection
            title="Donantes"
            actions={
              canCreateDonors ? (
                <button type="button" className="btn btn-primary btn-small" onClick={() => openCreateDonorModal()}>
                  Crear donante
                </button>
              ) : null
            }
          >
            <div className="settings-filter-grid inventory-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={donorFilters.search}
                  onChange={(event) => setDonorFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Nombre, correo, teléfono o Instagram"
                />
              </label>
              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={donorFilters.status}
                  onChange={(event) => setDonorFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activos</option>
                  <option value="INACTIVO">Inactivos</option>
                </select>
              </label>
            </div>

            <FilterSummaryBar stats={donorStats} onClear={resetDonorFilters} />

            {loading.donors ? (
              <p className="inventory-subtle">Cargando donantes...</p>
            ) : filteredDonors.length === 0 ? (
              <InventoryEmptyState>No hay donantes registrados.</InventoryEmptyState>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="crud-table inventory-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Correo</th>
                        <th>Teléfono</th>
                        <th>Instagram</th>
                        <th>Estado</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDonors.items.map((donor) => (
                        <tr key={donor.id}>
                          <td>{donor.nombreCompleto || donor.nombre}</td>
                          <td>{donor.email || "Sin correo"}</td>
                          <td>{donor.telefono || "Sin teléfono"}</td>
                          <td>{formatInstagramUsername(donor.usuarioInstagram) || "Sin Instagram"}</td>
                          <td>
                            <InventoryStatusBadge status={donor.activo ? "ACTIVO" : "INACTIVO"} />
                          </td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              {canUpdateDonors ? (
                                <IconButton
                                  icon={Pencil}
                                  label={`Editar donante ${donor.nombreCompleto || donor.nombre}`}
                                  variant="secondary"
                                  onClick={() => openEditDonorModal(donor)}
                                />
                              ) : null}
                              {canUpdateDonors ? (
                                <IconButton
                                  icon={PowerOff}
                                  label={donor.activo ? `Desactivar donante ${donor.nombre}` : `Activar donante ${donor.nombre}`}
                                  variant={donor.activo ? "warning" : "secondary"}
                                  onClick={() => void handleToggleDonorActiveAction(donor)}
                                />
                              ) : null}
                              {canUpdateDonors ? (
                                <IconButton
                                  icon={Trash2}
                                  label={`Eliminar donante ${donor.nombre}`}
                                  variant="danger"
                                  onClick={() => void handleDeleteDonorAction(donor)}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderTablePagination("donors", paginatedDonors)}
              </>
            )}
          </InventorySection>
        ) : null}
      </>
    );

  }

  function renderReportsTab() {
    return (
      <InventoryReportsPanel
        refreshKey={reportsRefreshKey}
        canReadExistences={canReadInventoryExistenceReports}
        canReadCountsAdjustments={canReadInventoryCountsAdjustmentsReports}
        canExportReports={canExportInventoryReports}
        categories={categories}
        items={items}
        locations={locations}
        units={units}
      />
    );
  }

  function renderPurchasesTab() {
    const selectedPurchaseActions = selectedPurchase
      ? getPurchaseActionState(selectedPurchase)
      : null;

    return (
      <>
        <nav className="settings-tabs">
          {purchaseTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`home-tab-button ${activePurchaseTab === tab.id ? "home-tab-button-active" : ""}`}
              onClick={() => setActivePurchaseTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activePurchaseTab === PURCHASE_TABS.PURCHASES ? (
          <>
            <InventorySection
              title="Compras"
              actions={
                canCreatePurchases ? (
                  <button type="button" className="btn btn-primary btn-small" onClick={() => openCreatePurchaseModal()}>
                    Nueva compra
                  </button>
                ) : null
              }
            >
              <div className="settings-filter-grid inventory-filter-grid">
                <label className="settings-filter-field">
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={purchaseFilters.search}
                    onChange={(event) => setPurchaseFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Proveedor, descripción, observaciones o estado"
                  />
                </label>
                <label className="settings-filter-field">
                  <span>Estado comercial</span>
                  <select
                    value={purchaseFilters.status}
                    onChange={(event) => setPurchaseFilters((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    {Array.from(new Set(purchases.map((purchase) => purchase.estado).filter(Boolean))).map((status) => (
                      <option key={status} value={status}>
                        {inventoryStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Proveedor</span>
                  <select
                    value={purchaseFilters.supplierId}
                    onChange={(event) => setPurchaseFilters((current) => ({ ...current, supplierId: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Fecha compra</span>
                  <input
                    type="date"
                    value={purchaseFilters.fecha}
                    onChange={(event) => setPurchaseFilters((current) => ({ ...current, fecha: event.target.value }))}
                  />
                </label>
              </div>

              <FilterSummaryBar stats={purchaseStats} onClear={resetPurchaseFilters} />

              {loading.purchases ? (
                <p className="inventory-subtle">Cargando compras...</p>
              ) : filteredPurchases.length === 0 ? (
                <InventoryEmptyState>No hay compras registradas.</InventoryEmptyState>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="crud-table inventory-table">
                      <thead>
                        <tr>
                          <th>Compra</th>
                          <th>Proveedor</th>
                          <th>Fecha compra</th>
                          <th>Estado compra</th>
                          <th>Recepción</th>
                          <th>Pago</th>
                          <th>Total</th>
                          <th className="table-actions-header">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPurchases.items.map((purchase) => {
                          const purchaseActions = getPurchaseActionState(purchase);
                          return (
                            <tr key={purchase.id}>
                              <td>
                                <div className="settings-meta-stack">
                                  <strong>Compra #{purchase.id}</strong>
                                  <small>{purchase.descripcion || "Sin descripción"}</small>
                                </div>
                              </td>
                              <td>{purchase.supplier?.nombre || "Sin proveedor"}</td>
                              <td>{formatDate(purchase.fechaCompra)}</td>
                              <td><InventoryStatusBadge status={purchase.estado} /></td>
                              <td><InventoryStatusBadge status={purchase.estadoRecepcion} /></td>
                              <td><InventoryStatusBadge status={purchase.estadoFinanciero} /></td>
                              <td>{formatMoney(purchase.montoTotal, purchase.moneda)}</td>
                              <td className="table-actions-cell">
                                <div className="row-actions table-actions">
                                  <IconButton
                                    icon={Eye}
                                    label={`Ver detalle de la compra ${purchase.id}`}
                                    variant="secondary"
                                    onClick={() => void loadPurchaseDetail(purchase.id)}
                                  />
                                  {canUpdatePurchases && purchaseActions.canEdit ? (
                                    <IconButton
                                      icon={Pencil}
                                      label={`Editar compra ${purchase.id}`}
                                      variant="secondary"
                                      onClick={() => openEditPurchaseModal(purchase)}
                                    />
                                  ) : null}
                                  {canCreatePurchaseDetails && purchaseActions.canEditDetails ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-small"
                                      onClick={() => openPurchaseDetailModal(purchase.id)}
                                    >
                                      Agregar detalle
                                    </button>
                                  ) : null}
                                  {canUpdatePurchases && purchaseActions.canConfirm ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-small"
                                      onClick={() => void handleConfirmPurchaseAction(purchase)}
                                    >
                                      Confirmar compra
                                    </button>
                                  ) : null}
                                  {canUpdatePurchases && purchaseActions.canRevertToDraft ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-small"
                                      onClick={() => void handleRevertPurchaseToDraftAction(purchase)}
                                    >
                                      Volver a borrador
                                    </button>
                                  ) : null}
                                  {canUpdatePurchases && purchaseActions.canCancel ? (
                                    <IconButton
                                      icon={MinusCircle}
                                      label={`Cancelar compra ${purchase.id}`}
                                      variant="warning"
                                      onClick={() => void handleDeletePurchaseAction(purchase)}
                                    />
                                  ) : null}
                                  {canDeletePurchases && purchaseActions.canDelete ? (
                                    <IconButton
                                      icon={Trash2}
                                      label={`Eliminar compra ${purchase.id}`}
                                      variant="danger"
                                      onClick={() => void handleDeletePurchaseAction(purchase)}
                                    />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {renderTablePagination("purchases", paginatedPurchases)}
                </>
              )}
            </InventorySection>

            {selectedPurchase ? (
              <InventorySection
                title={`Detalle de compra #${selectedPurchase.id}`}
                subtitle={selectedPurchase.descripcion || selectedPurchase.observaciones || "Líneas y recepciones asociadas"}
                actions={
                  (() => {
                    const canBulkReceive = canReceivePurchaseDetails
                      && selectedPurchase.purchaseDetails.some(
                        (detail) => getPurchaseDetailActionState(selectedPurchase, detail).canReceive,
                      );

                    return canBulkReceive || (canCreatePurchaseDetails && selectedPurchaseActions?.canEditDetails) ? (
                      <div className="row-actions inventory-header-actions">
                        {canBulkReceive ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={openPurchaseBulkReceiptModal}
                          >
                            Recepcionar varios
                          </button>
                        ) : null}
                        {canCreatePurchaseDetails && selectedPurchaseActions?.canEditDetails ? (
                          <button type="button" className="btn btn-secondary btn-small" onClick={() => openPurchaseDetailModal(selectedPurchase.id)}>
                            Agregar detalle
                          </button>
                        ) : null}
                      </div>
                    ) : null;
                  })()
                }
              >
                <div className="inventory-detail-grid">
                  <article className="inventory-detail-card">
                    <span>Proveedor</span>
                    <strong>{selectedPurchase.supplier?.nombre || "Sin proveedor"}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Estado compra</span>
                    <strong><InventoryStatusBadge status={selectedPurchase.estado} /></strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Recepción</span>
                    <strong><InventoryStatusBadge status={selectedPurchase.estadoRecepcion} /></strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Pago</span>
                    <strong><InventoryStatusBadge status={selectedPurchase.estadoFinanciero} /></strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Total de compra</span>
                    <strong>{formatMoney(selectedPurchase.montoTotal, selectedPurchase.moneda)}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Moneda</span>
                    <strong>{selectedPurchase.moneda || "CLP"}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Vencimiento pago</span>
                    <strong>{formatDate(selectedPurchase.fechaVencimientoPago)}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Cuenta por pagar</span>
                    <strong>
                      <InventoryStatusBadge status={selectedPurchase.payableAccount?.estado || "SIN_CUENTA"} />
                    </strong>
                  </article>
                </div>
                {selectedPurchase.observacionFinanciera ? (
                  <p className="inventory-muted">
                    <strong>Observación financiera:</strong> {selectedPurchase.observacionFinanciera}
                  </p>
                ) : null}
                {selectedPurchaseActions?.reason ? (
                  <p className="inventory-muted">{selectedPurchaseActions.reason}</p>
                ) : null}
                <div className="row-actions inventory-header-actions">
                  {canUpdatePurchases && selectedPurchaseActions?.canConfirm ? (
                    <button type="button" className="btn btn-primary btn-small" onClick={() => void handleConfirmPurchaseAction(selectedPurchase)}>
                      Confirmar compra
                    </button>
                  ) : null}
                  {canUpdatePurchases && selectedPurchaseActions?.canRevertToDraft ? (
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => void handleRevertPurchaseToDraftAction(selectedPurchase)}>
                      Volver a borrador
                    </button>
                  ) : null}
                </div>

                {selectedPurchase.purchaseDetails.length === 0 ? (
                  <InventoryEmptyState>Esta compra aun no tiene líneas asociadas.</InventoryEmptyState>
                ) : (
                  <>
                    <div className="table-scroll">
                      <table className="crud-table inventory-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Cantidad esperada</th>
                            <th>Cantidad recibida</th>
                            <th>Pendiente</th>
                            <th>Precio unitario</th>
                            <th>Subtotal</th>
                            <th>Estado</th>
                            <th className="table-actions-header">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedPurchaseLines.items.map((detail) => {
                            const detailActions = getPurchaseDetailActionState(selectedPurchase, detail);
                            return (
                              <tr key={detail.id}>
                                <td>{detail.itemNombre}</td>
                                <td>{formatQuantity(detail.cantidad)}</td>
                                <td>{formatQuantity(detail.cantidadRecepcionada)}</td>
                                <td>{formatQuantity(detail.cantidadPendiente)}</td>
                                <td>{formatMoney(detail.precioUnitario, selectedPurchase.moneda)}</td>
                                <td>{formatMoney(detail.subtotal, selectedPurchase.moneda)}</td>
                                <td><InventoryStatusBadge status={detail.estado} /></td>
                                <td className="table-actions-cell">
                                  <div className="row-actions table-actions">
                                    {canUpdatePurchaseDetails && detailActions.canEdit ? (
                                      <IconButton
                                        icon={Pencil}
                                        label={`Editar detalle ${detail.id}`}
                                        variant="secondary"
                                        onClick={() => openPurchaseDetailModal(selectedPurchase.id, detail)}
                                      />
                                    ) : null}
                                    {canReceivePurchaseDetails && detailActions.canReceive ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-small"
                                        onClick={() => openPurchaseReceiveModal(detail)}
                                      >
                                        Recepcionar
                                      </button>
                                    ) : null}
                                    {canReadMovements && detailActions.canViewReceipts ? (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-small"
                                        onClick={() => openPurchaseReceiptHistory(detail)}
                                      >
                                        Ver recepciones
                                      </button>
                                    ) : null}
                                    {canDeletePurchaseDetails && detailActions.canDelete ? (
                                      <IconButton
                                        icon={Trash2}
                                        label={`Eliminar detalle ${detail.id}`}
                                        variant="danger"
                                        onClick={() => void handleDeletePurchaseDetailAction(selectedPurchase, detail)}
                                      />
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="inventory-muted">
                      <strong>Total de compra:</strong> {formatMoney(calculatePurchaseTotal(selectedPurchase.purchaseDetails), selectedPurchase.moneda)}
                    </p>
                    {renderTablePagination("purchaseLines", paginatedPurchaseLines)}
                  </>
                )}
              </InventorySection>
            ) : null}
          </>
        ) : null}

        {activePurchaseTab === PURCHASE_TABS.SUPPLIERS ? (
          <InventorySection
            title="Proveedores"
            actions={
              canCreateSuppliers ? (
                <button type="button" className="btn btn-primary btn-small" onClick={() => openCreateSupplierModal()}>
                  Crear proveedor
                </button>
              ) : null
            }
          >
            {loading.suppliers ? (
              <p className="inventory-subtle">Cargando proveedores...</p>
            ) : suppliers.length === 0 ? (
              <InventoryEmptyState>No hay proveedores registrados.</InventoryEmptyState>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="crud-table inventory-table">
                    <thead>
                      <tr>
                        <th>Proveedor</th>
                        <th>Contacto</th>
                        <th>Ubicación</th>
                        <th>Estado</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSuppliers.items.map((supplier) => {
                        const supplierActions = getSupplierActionState(supplier);
                        return (
                          <tr key={supplier.id}>
                            <td>
                              <div className="settings-meta-stack">
                                <strong>{supplier.nombre}</strong>
                                <small>ID #{supplier.id}</small>
                              </div>
                            </td>
                            <td>
                              <div className="settings-meta-stack">
                                <span>{supplier.email || "Sin email"}</span>
                                <small>{supplier.telefono || "Sin teléfono"}</small>
                              </div>
                            </td>
                            <td>{formatLocationLine(supplier.location)}</td>
                            <td>
                              <InventoryBadge tone={supplier.activo ? "success" : "neutral"}>
                                {supplier.activo ? "Activo" : "Inactivo"}
                              </InventoryBadge>
                            </td>
                            <td className="table-actions-cell">
                              <div className="row-actions table-actions">
                                {canUpdateSuppliers && supplierActions.canEdit ? (
                                  <IconButton
                                    icon={Pencil}
                                    label={`Editar proveedor ${supplier.nombre}`}
                                    variant="secondary"
                                    onClick={() => openEditSupplierModal(supplier)}
                                  />
                                ) : null}
                                {canDeleteSuppliers && supplierActions.canDeactivate ? (
                                  <IconButton
                                    icon={PowerOff}
                                    label={`Desactivar proveedor ${supplier.nombre}`}
                                    variant="danger"
                                    onClick={() => void handleDeactivateSupplierAction(supplier)}
                                  />
                                ) : null}
                                {canUpdateSuppliers && supplierActions.canReactivate ? (
                                  <IconButton
                                    icon={PowerOff}
                                    label={`Reactivar proveedor ${supplier.nombre}`}
                                    variant="secondary"
                                    onClick={() => void handleReactivateSupplierAction(supplier)}
                                  />
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {renderTablePagination("suppliers", paginatedSuppliers)}
              </>
            )}
          </InventorySection>
        ) : null}
      </>
    );

  }

  function renderControlTab() {
    return (
      <>
        <nav className="settings-tabs">
          {controlTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`home-tab-button ${activeControlTab === tab.id ? "home-tab-button-active" : ""}`}
              onClick={() => setActiveControlTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeControlTab === CONTROL_TABS.COUNTS ? (
          <>
            <InventorySection
              title="Conteos fisicos"
              actions={
                canCreateCounts ? (
                  <button type="button" className="btn btn-primary btn-small" onClick={openStockCountModal}>
                    Nuevo conteo
                  </button>
                ) : null
              }
            >
              <div className="settings-filter-grid inventory-filter-grid">
                <label className="settings-filter-field">
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={countFilters.search}
                    onChange={(event) => setCountFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Ubicación, responsable u observaciones"
                  />
                </label>
                <label className="settings-filter-field">
                  <span>Ubicación</span>
                  <select
                    value={countFilters.locationId}
                    onChange={(event) => setCountFilters((current) => ({ ...current, locationId: event.target.value }))}
                  >
                    <option value="">Todas</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Responsable</span>
                  <select
                    value={countFilters.userId}
                    onChange={(event) => setCountFilters((current) => ({ ...current, userId: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    {countUserOptions.map((userOption) => (
                      <option key={userOption.id} value={userOption.id}>
                        {userOption.nombreCompleto || userOption.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Fecha conteo</span>
                  <input
                    type="date"
                    value={countFilters.fecha}
                    onChange={(event) => setCountFilters((current) => ({ ...current, fecha: event.target.value }))}
                  />
                </label>
              </div>

              <FilterSummaryBar stats={countStats} onClear={resetCountFilters} />

              {loading.counts ? (
                <p className="inventory-subtle">Cargando conteos...</p>
              ) : filteredCounts.length === 0 ? (
                <InventoryEmptyState>No hay conteos registrados.</InventoryEmptyState>
              ) : (
                <>
                  <div className="table-scroll">
                  <table className="crud-table inventory-table">
                    <thead>
                      <tr>
                        <th>Conteo</th>
                        <th>Fecha</th>
                        <th>Ubicación</th>
                        <th>Registrado por</th>
                        <th>Detalles</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCounts.items.map((count) => (
                        <tr key={count.id}>
                          <td>Conteo #{count.id}</td>
                          <td>{formatDate(count.fechaConteo)}</td>
                          <td>{formatLocationLine(count.location)}</td>
                          <td>{formatPersonName(count.performedBy)}</td>
                          <td>{count.detalles.length}</td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              <IconButton
                                icon={Eye}
                                label={`Ver detalle del conteo ${count.id}`}
                                variant="secondary"
                                onClick={() => void loadStockCountDetail(count.id)}
                              />
                              {canCreateAdjustments ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-small"
                                  onClick={() => openAdjustmentFromCountModal(count.id)}
                                >
                                  Crear ajuste
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {renderTablePagination("counts", paginatedCounts)}
                </>
              )}
            </InventorySection>

            {selectedStockCount ? (
              <InventorySection
                title={`Detalle de conteo #${selectedStockCount.id}`}
                subtitle={selectedStockCount.observaciones || "Detalle de cantidades contadas"}
                actions={
                  canCreateAdjustments ? (
                    <button type="button" className="btn btn-primary btn-small" onClick={() => openAdjustmentFromCountModal(selectedStockCount.id)}>
                      Crear ajuste desde conteo
                    </button>
                  ) : null
                }
              >
                <>
                  <div className="table-scroll">
                  <table className="crud-table inventory-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Existencia</th>
                        <th>Cantidad contada</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCountDetails.items.map((detail) => (
                        <tr key={detail.id}>
                          <td>{detail.item?.nombre || "Sin item"}</td>
                          <td>{detail.existence?.id ? `#${detail.existence.id}` : "Sin existencia"}</td>
                          <td>{formatQuantity(detail.cantidadContada)}</td>
                          <td>{detail.observaciones || "Sin observaciones"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {renderTablePagination("countDetails", paginatedCountDetails)}
                </>
              </InventorySection>
            ) : null}
          </>
        ) : null}

        {activeControlTab === CONTROL_TABS.ADJUSTMENTS ? (
          <>
            <InventorySection
              title="Ajustes"
              actions={
                canCreateAdjustments ? (
                  <button type="button" className="btn btn-primary btn-small" onClick={() => openAdjustmentModal({})}>
                    Nuevo ajuste manual
                  </button>
                ) : null
              }
            >
              <div className="settings-filter-grid inventory-filter-grid">
                <label className="settings-filter-field">
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={adjustmentFilters.search}
                    onChange={(event) => setAdjustmentFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Motivo, ubicación, estado u observaciones"
                  />
                </label>
                <label className="settings-filter-field">
                  <span>Estado</span>
                  <select
                    value={adjustmentFilters.status}
                    onChange={(event) => setAdjustmentFilters((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    {Array.from(new Set(adjustments.map((adjustment) => adjustment.estado).filter(Boolean))).map((status) => (
                      <option key={status} value={status}>
                        {adjustmentStateLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Ubicación</span>
                  <select
                    value={adjustmentFilters.locationId}
                    onChange={(event) => setAdjustmentFilters((current) => ({ ...current, locationId: event.target.value }))}
                  >
                    <option value="">Todas</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Origen</span>
                  <select
                    value={adjustmentFilters.source}
                    onChange={(event) => setAdjustmentFilters((current) => ({ ...current, source: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="MANUAL">Manual</option>
                    <option value="CONTEO">Desde conteo</option>
                  </select>
                </label>
                <label className="settings-filter-field">
                  <span>Fecha ajuste</span>
                  <input
                    type="date"
                    value={adjustmentFilters.fecha}
                    onChange={(event) => setAdjustmentFilters((current) => ({ ...current, fecha: event.target.value }))}
                  />
                </label>
              </div>

              <FilterSummaryBar stats={adjustmentStats} onClear={resetAdjustmentFilters} />

              {loading.adjustments ? (
                <p className="inventory-subtle">Cargando ajustes...</p>
              ) : filteredAdjustments.length === 0 ? (
                <InventoryEmptyState>No hay ajustes registrados.</InventoryEmptyState>
              ) : (
                <>
                  <div className="table-scroll">
                  <table className="crud-table inventory-table">
                    <thead>
                      <tr>
                        <th>Ajuste</th>
                        <th>Fecha</th>
                        <th>Ubicación</th>
                        <th>Estado</th>
                        <th>Motivo</th>
                        <th>Detalles</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAdjustments.items.map((adjustment) => (
                        <tr key={adjustment.id}>
                          <td>Ajuste #{adjustment.id}</td>
                          <td>{formatDate(adjustment.fechaAjuste)}</td>
                          <td>{formatLocationLine(adjustment.location)}</td>
                          <td>
                            <InventoryBadge
                              tone={
                                adjustment.estado === "APLICADO"
                                  ? "success"
                                  : adjustment.estado === "CANCELADO"
                                    ? "neutral"
                                    : "warning"
                              }
                            >
                              {adjustmentStateLabel(adjustment.estado)}
                            </InventoryBadge>
                          </td>
                          <td>{adjustment.motivo}</td>
                          <td>{adjustment.details.length}</td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              <IconButton
                                icon={Eye}
                                label={`Ver detalle del ajuste ${adjustment.id}`}
                                variant="secondary"
                                onClick={() => void loadAdjustmentDetail(adjustment.id)}
                              />
                              {canApplyAdjustments && adjustment.estado === "PENDIENTE" ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-small"
                                  onClick={() => void handleApplyAdjustment(adjustment.id)}
                                >
                                  Aplicar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {renderTablePagination("adjustments", paginatedAdjustments)}
                </>
              )}
            </InventorySection>

            {selectedAdjustment ? (
              <InventorySection
                title={`Detalle de ajuste #${selectedAdjustment.id}`}
                subtitle={selectedAdjustment.observaciones || selectedAdjustment.motivo}
                actions={
                  canApplyAdjustments && selectedAdjustment.estado === "PENDIENTE" ? (
                    <button type="button" className="btn btn-primary btn-small" onClick={() => void handleApplyAdjustment(selectedAdjustment.id)}>
                      Aplicar ajuste
                    </button>
                  ) : null
                }
              >
                <div className="inventory-detail-grid">
                  <article className="inventory-detail-card">
                    <span>Estado</span>
                    <strong>{adjustmentStateLabel(selectedAdjustment.estado)}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Ubicación</span>
                    <strong>{selectedAdjustment.location?.nombre || "Sin ubicación"}</strong>
                  </article>
                  <article className="inventory-detail-card">
                    <span>Conteo origen</span>
                    <strong>{selectedAdjustment.stockCountId || "Manual"}</strong>
                  </article>
                </div>
                <>
                  <div className="table-scroll">
                  <table className="crud-table inventory-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Existencia</th>
                        <th>Antes</th>
                        <th>Contada</th>
                        <th>Diferencia</th>
                        <th>Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAdjustmentDetails.items.map((detail) => (
                        <tr key={detail.id}>
                          <td>{detail.item?.nombre || "Sin item"}</td>
                          <td>{detail.existence?.id ? `#${detail.existence.id}` : "Sin existencia"}</td>
                          <td>{formatQuantity(detail.cantidadAntes)}</td>
                          <td>{formatQuantity(detail.cantidadContada)}</td>
                          <td>{formatQuantity(detail.diferencia)}</td>
                          <td>{detail.tipoAjuste}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {renderTablePagination("adjustmentDetails", paginatedAdjustmentDetails)}
                </>
              </InventorySection>
            ) : null}
          </>
        ) : null}

        {activeControlTab === CONTROL_TABS.INITIAL_LOAD ? (
          <InventorySection
            title="Carga inicial"
            subtitle="Registrar stock administrativo inicial mediante movimiento de entrada y existencia."
            actions={
              canCreateInitialLoad ? (
                <button type="button" className="btn btn-primary btn-small" onClick={() => openInitialLoadModal("")}>
                  Registrar carga inicial
                </button>
              ) : null
            }
          >
            <InventoryEmptyState>
              Usa esta acción para registrar inventario inicial. Si ya conoces el item, también puedes iniciar la carga desde la tabla principal de inventario.
            </InventoryEmptyState>
          </InventorySection>
        ) : null}

        {activeControlTab === CONTROL_TABS.MOVEMENTS ? (
          <InventorySection
            title="Historial de movimientos"
          >
            <div className="settings-filter-grid inventory-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={movementFilters.search}
                  onChange={(event) => setMovementFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Item, ubicación o referencia"
                />
              </label>
              <label className="settings-filter-field">
                <span>Item</span>
                <select
                  value={movementFilters.itemId}
                  onChange={(event) => setMovementFilters((current) => ({ ...current, itemId: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
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
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-filter-field">
                <span>Tipo</span>
                <select
                  value={movementFilters.tipo}
                  onChange={(event) => setMovementFilters((current) => ({ ...current, tipo: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {MOVEMENT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {movementLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <FilterSummaryBar
              stats={movementFilterStats}
              onClear={resetMovementFilters}
            />

            {loading.movements ? (
              <p className="inventory-subtle">Cargando movimientos...</p>
            ) : filteredMovements.length === 0 ? (
              <InventoryEmptyState>No hay movimientos visibles con los filtros actuales.</InventoryEmptyState>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table inventory-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Item</th>
                      <th>Cantidad</th>
                      <th>Origen</th>
                      <th>Destino</th>
                      <th>Referencia</th>
                      <th>Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMovements.items.map((movement) => (
                      <tr key={movement.id}>
                        <td>{formatDate(movement.fechaMovimiento)}</td>
                        <td>{movementLabel(movement.tipoMovimiento)}</td>
                        <td>{movement.itemNombre || "Sin item"}</td>
                        <td>{formatQuantity(movement.cantidad)}</td>
                        <td>{formatLocationLine(movement.sourceLocation)}</td>
                        <td>{formatLocationLine(movement.destinationLocation)}</td>
                        <td>{[movement.referenciaTipo, movement.referenciaId].filter(Boolean).join(" #") || "Sin referencia"}</td>
                        <td>{formatPersonName(movement.performedBy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {renderTablePagination("movements", paginatedMovements)}
              </>
            )}
          </InventorySection>
        ) : null}
      </>
    );
  }

  function renderCatalogTab() {
    return (
      <>
        <nav className="settings-tabs">
          {catalogTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`home-tab-button ${activeCatalogTab === tab.id ? "home-tab-button-active" : ""}`}
              onClick={() => setActiveCatalogTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeCatalogTab === CATALOG_TABS.ITEMS ? (
          <InventorySection
            title="Items"
            actions={
              canCreateItems ? (
                <button type="button" className="btn btn-primary btn-small" onClick={() => openItemModal(null)}>
                  Crear item
                </button>
              ) : null
            }
          >
            <FilterSummaryBar stats={itemStats} showClearButton={false} />

            {loading.catalogItems ? (
              <p className="inventory-subtle">Cargando items...</p>
            ) : items.length === 0 ? (
              <InventoryEmptyState>No hay items registrados.</InventoryEmptyState>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table inventory-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Categoria</th>
                      <th>Unidad</th>
                      <th>Stock minimo</th>
                      <th>Estado</th>
                      <th className="table-actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="settings-meta-stack">
                            <strong>{item.nombre}</strong>
                            <small>{item.descripcion || "Sin descripción"}</small>
                          </div>
                        </td>
                        <td>{item.categoriaNombre || "Sin categoria"}</td>
                        <td>{item.unidadMedidaNombre || "Sin unidad"}</td>
                        <td>{item.stockMinimo === null ? "Sin minimo" : formatQuantity(item.stockMinimo)}</td>
                        <td>
                          <InventoryBadge tone={item.activo ? "success" : "neutral"}>
                            {item.activo ? "Activo" : "Inactivo"}
                          </InventoryBadge>
                        </td>
                        <td className="table-actions-cell">
                          <div className="row-actions table-actions">
                            {canUpdateItems ? (
                              <IconButton
                                icon={Pencil}
                                label={`Editar item ${item.nombre || ""}`.trim()}
                                variant="secondary"
                                onClick={() => openItemModal(item)}
                              />
                            ) : null}
                            {canDeleteItems ? (
                              <IconButton
                                icon={PowerOff}
                                label={`Desactivar item ${item.nombre || ""}`.trim()}
                                variant="warning"
                                onClick={() => void handleDeleteItem(item)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {renderTablePagination("items", paginatedItems)}
              </>
            )}
          </InventorySection>
        ) : null}

        {activeCatalogTab === CATALOG_TABS.CATEGORIES ? (
          <InventorySection
            title="Categorias"            
            actions={
              canCreateCategories ? (
                <button type="button" className="btn btn-primary btn-small" onClick={() => openCategoryModal(null)}>
                  Crear categoria
                </button>
              ) : null
            }
          >
            {loading.categories ? (
              <p className="inventory-subtle">Cargando categorias...</p>
            ) : categories.length === 0 ? (
              <InventoryEmptyState>No haycategoríasregistradas.</InventoryEmptyState>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table inventory-table">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Estado</th>
                      <th className="table-actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCategories.items.map((category) => (
                      <tr key={category.id}>
                        <td>{category.nombre}</td>
                        <td>
                          <InventoryBadge tone={category.activo ? "success" : "neutral"}>
                            {category.activo ? "Activa" : "Inactiva"}
                          </InventoryBadge>
                        </td>
                        <td className="table-actions-cell">
                          <div className="row-actions table-actions">
                            {canUpdateCategories ? (
                              <IconButton
                                icon={Pencil}
                                label={`Editar categoría ${category.nombre || ""}`.trim()}
                                variant="secondary"
                                onClick={() => openCategoryModal(category)}
                              />
                            ) : null}
                            {canDeleteCategories ? (
                              <IconButton
                                icon={Trash2}
                                label={`Eliminar categoría ${category.nombre || ""}`.trim()}
                                variant="danger"
                                onClick={() => void handleDeleteCategory(category)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {renderTablePagination("categories", paginatedCategories)}
              </>
            )}
          </InventorySection>
        ) : null}

        {activeCatalogTab === CATALOG_TABS.UNITS ? (
          <InventorySection
            title="Unidades"            
            actions={
              canCreateUnits ? (
                <button type="button" className="btn btn-primary btn-small" onClick={() => openUnitModal(null)}>
                  Crear unidad
                </button>
              ) : null
            }
          >
            {loading.units ? (
              <p className="inventory-subtle">Cargando unidades...</p>
            ) : units.length === 0 ? (
              <InventoryEmptyState>No hay unidades registradas.</InventoryEmptyState>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table inventory-table">
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th className="table-actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUnits.items.map((unit) => (
                      <tr key={unit.id}>
                        <td>{unit.nombre}</td>
                        <td>{unit.descripcion || "Sin descripción"}</td>
                        <td>
                          <InventoryBadge tone={unit.activo ? "success" : "neutral"}>
                            {unit.activo ? "Activa" : "Inactiva"}
                          </InventoryBadge>
                        </td>
                        <td className="table-actions-cell">
                          <div className="row-actions table-actions">
                            {canUpdateUnits ? (
                              <IconButton
                                icon={Pencil}
                                label={`Editar unidad ${unit.nombre || ""}`.trim()}
                                variant="secondary"
                                onClick={() => openUnitModal(unit)}
                              />
                            ) : null}
                            {canDeleteUnits ? (
                              <IconButton
                                icon={Trash2}
                                label={`Eliminar unidad ${unit.nombre || ""}`.trim()}
                                variant="danger"
                                onClick={() => void handleDeleteUnit(unit)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {renderTablePagination("units", paginatedUnits)}
              </>
            )}
          </InventorySection>
        ) : null}
      </>
    );
  }

  if (loading.bootstrap) {
    return (
      <section className="inventory-page">
        <header className="main-header">
          <h1>Inventario</h1>
          <p>Cargando configuracion y catastro base del módulo.</p>
        </header>
      </section>
    );
  }

  if (!visibleTabs.length) {
    return (
      <section className="inventory-page">
        <header className="main-header">
          <h1>Inventario</h1>
          <p>No tienes permisos suficientes para ver secciones del módulo.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="inventory-page">
      <header className="main-header inventory-main-header">
        <div>
          <h1>Inventario</h1>
          <p>
            Vista operativa del stock, donaciones, compras, control y catálogo. Las acciones se
            renderizan segun permisos reales y usan solo los endpoints backend ya existentes.
          </p>
        </div>
        <div className="inventory-header-tools">
          <button type="button" className="btn btn-secondary" onClick={() => clearFeedback()}>
            Limpiar mensajes
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (activeTab === MAIN_TABS.INVENTORY) void loadSummary();
              if (activeTab === MAIN_TABS.REPORTS) setReportsRefreshKey((current) => current + 1);
              if (activeTab === MAIN_TABS.DONATIONS) void loadDonations();
              if (activeTab === MAIN_TABS.PURCHASES && activePurchaseTab === PURCHASE_TABS.PURCHASES) void loadPurchases();
              if (activeTab === MAIN_TABS.PURCHASES && activePurchaseTab === PURCHASE_TABS.SUPPLIERS) void loadSuppliersData();
              if (activeTab === MAIN_TABS.CONTROL && activeControlTab === CONTROL_TABS.COUNTS) void loadCounts();
              if (activeTab === MAIN_TABS.CONTROL && activeControlTab === CONTROL_TABS.ADJUSTMENTS) void loadAdjustments();
              if (activeTab === MAIN_TABS.CONTROL && activeControlTab === CONTROL_TABS.MOVEMENTS) void loadMovements();
              if (activeTab === MAIN_TABS.CATALOG && activeCatalogTab === CATALOG_TABS.ITEMS) void loadCatalogItems();
              if (activeTab === MAIN_TABS.CATALOG && activeCatalogTab === CATALOG_TABS.CATEGORIES) void loadCategories();
              if (activeTab === MAIN_TABS.CATALOG && activeCatalogTab === CATALOG_TABS.UNITS) void loadUnits();
            }}
          >
            Actualizar vista
          </button>
        </div>
      </header>

      {renderFeedback()}

      <nav className="settings-tabs">
        {visibleTabs.map((tab) => (
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

      {activeTab === MAIN_TABS.INVENTORY ? renderInventoryTab() : null}
      {activeTab === MAIN_TABS.REPORTS ? renderReportsTab() : null}
      {activeTab === MAIN_TABS.DONATIONS ? renderDonationsTab() : null}
      {activeTab === MAIN_TABS.PURCHASES ? renderPurchasesTab() : null}
      {activeTab === MAIN_TABS.CONTROL ? renderControlTab() : null}
      {activeTab === MAIN_TABS.CATALOG ? renderCatalogTab() : null}

      <InventoryModal
        isOpen={initialLoadModalOpen}
        title="Registrar carga inicial"
        submitLabel="Registrar carga"
        isSaving={initialLoadSaving}
        error={initialLoadError}
        onClose={() => {
          if (!initialLoadSaving) setInitialLoadModalOpen(false);
        }}
        onSubmit={handleSubmitInitialLoad}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Item</span>
            <select
              value={initialLoadForm.itemId}
              onChange={(event) => setInitialLoadForm((current) => ({ ...current, itemId: event.target.value }))}
            >
              <option value="">Selecciona un item</option>
              {items.filter((item) => item.activo).map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Ubicación destino</span>
            <select
              value={initialLoadForm.ubicacionId}
              onChange={(event) => setInitialLoadForm((current) => ({ ...current, ubicacionId: event.target.value }))}
            >
              <option value="">Selecciona una ubicación</option>
              {locationsActiveOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Cantidad</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={initialLoadForm.cantidad}
              onChange={(event) => setInitialLoadForm((current) => ({ ...current, cantidad: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Condicion</span>
            <select
              value={initialLoadForm.condicion}
              onChange={(event) => setInitialLoadForm((current) => ({ ...current, condicion: event.target.value }))}
            >
              <option value="">Sin condicion</option>
              {ITEM_CONDITION_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Fecha vencimiento</span>
            <input
              type="date"
              value={initialLoadForm.fechaVencimiento}
              onChange={(event) => setInitialLoadForm((current) => ({ ...current, fechaVencimiento: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha apertura</span>
            <input
              type="date"
              value={initialLoadForm.fechaApertura}
              onChange={(event) => setInitialLoadForm((current) => ({ ...current, fechaApertura: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="4"
              value={initialLoadForm.observaciones}
              onChange={(event) => setInitialLoadForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={donationModalOpen}
        title={donationFormMode === "edit" ? "Editar donación" : "Crear donación"}
        submitLabel={donationFormMode === "edit" ? "Guardar cambios" : "Crear donación"}
        isSaving={donationSaving || inlineDonorSaving}
        error={donationFormError}
        onClose={() => {
          if (!donationSaving && !inlineDonorSaving) closeDonationModal();
        }}
        onSubmit={handleSubmitDonation}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field full">
            <span>Motivo de donación</span>
            <input
              type="text"
              value={donationForm.motivoDonacion}
              onChange={(event) => setDonationForm((current) => ({ ...current, motivoDonacion: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha de registro</span>
            <input
              type="date"
              value={donationForm.fechaRegistro}
              onChange={(event) => setDonationForm((current) => ({ ...current, fechaRegistro: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Región</span>
            <select
              value={donationForm.regionId}
              onChange={(event) => setDonationForm((current) => ({ ...current, regionId: event.target.value }))}
            >
              <option value="">Selecciona una región</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>{region.nombre}</option>
              ))}
            </select>
          </label>
          <div className="settings-form-field full inventory-donor-field">
            <div className="inventory-field-heading">
              <span>Donante</span>
              {canCreateDonors ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => {
                    setInlineDonorOpen((current) => !current);
                    setInlineDonorErrors({});
                    setInlineDonorMatch(null);
                    setInlineDonorNotice("");
                  }}
                  disabled={inlineDonorSaving}
                >
                  {inlineDonorOpen ? "Ocultar creación" : "Crear donante"}
                </button>
              ) : null}
            </div>

            {canReadDonors ? (
              <DonorCombobox
                donors={donors}
                value={donationForm.donorId}
                onChange={(donorId) => {
                  setDonationForm((current) => ({ ...current, donorId }));
                  setInlineDonorNotice("");
                }}
                disabled={donationSaving || inlineDonorSaving}
                allowInactiveSelected={donationFormMode === "edit"}
              />
            ) : (
              <div className="inventory-inline-notice">
                <strong>
                  {selectedDonationFormDonor?.nombreCompleto
                    || selectedDonationFormDonor?.nombre
                    || "Donación anónima"}
                </strong>
                <span>
                  No tienes permiso para consultar el catálogo de donantes. La donación puede registrarse de forma anónima.
                </span>
              </div>
            )}

            {inlineDonorNotice ? (
              <p className="inventory-inline-notice inventory-inline-notice-success">
                {inlineDonorNotice}
              </p>
            ) : null}

            {inlineDonorOpen ? (
              <section className="inventory-subform inventory-inline-donor-form" aria-label="Crear donante sin cerrar la donación">
                <div className="inventory-subform-header">
                  <div>
                    <h4>Nuevo donante</h4>
                    <p>Se creará y quedará seleccionado en esta donación.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => {
                      setInlineDonorOpen(false);
                      setInlineDonorForm(emptyDonorForm());
                      setInlineDonorErrors({});
                      setInlineDonorMatch(null);
                    }}
                    disabled={inlineDonorSaving}
                  >
                    Cancelar creación
                  </button>
                </div>

                {inlineDonorErrors.general ? (
                  <p className="error-text inventory-inline-form-error">{inlineDonorErrors.general}</p>
                ) : null}

                <div className="inventory-inline-form-grid">
                  <label className="settings-form-field">
                    <span>Nombre *</span>
                    <input
                      type="text"
                      value={inlineDonorForm.nombre}
                      onChange={(event) => updateInlineDonorField("nombre", event.target.value)}
                      disabled={inlineDonorSaving}
                      autoComplete="given-name"
                    />
                    {inlineDonorErrors.nombre ? <small className="inventory-field-error">{inlineDonorErrors.nombre}</small> : null}
                  </label>
                  <label className="settings-form-field">
                    <span>Apellido *</span>
                    <input
                      type="text"
                      value={inlineDonorForm.apellido}
                      onChange={(event) => updateInlineDonorField("apellido", event.target.value)}
                      disabled={inlineDonorSaving}
                      autoComplete="family-name"
                    />
                    {inlineDonorErrors.apellido ? <small className="inventory-field-error">{inlineDonorErrors.apellido}</small> : null}
                  </label>
                  <label className="settings-form-field">
                    <span>Teléfono *</span>
                    <input
                      type="tel"
                      value={inlineDonorForm.telefono}
                      onChange={(event) => updateInlineDonorField("telefono", event.target.value)}
                      onBlur={checkInlineDonorDuplicate}
                      disabled={inlineDonorSaving}
                      autoComplete="tel"
                      placeholder="Ej. +56 9 1234 5678"
                    />
                    {inlineDonorErrors.telefono ? <small className="inventory-field-error">{inlineDonorErrors.telefono}</small> : null}
                  </label>
                  <label className="settings-form-field">
                    <span>Instagram *</span>
                    <input
                      type="text"
                      value={inlineDonorForm.usuarioInstagram}
                      onChange={(event) => updateInlineDonorField("usuarioInstagram", event.target.value)}
                      onBlur={checkInlineDonorDuplicate}
                      disabled={inlineDonorSaving}
                      autoComplete="off"
                      placeholder="@usuario"
                    />
                    {inlineDonorErrors.usuarioInstagram ? <small className="inventory-field-error">{inlineDonorErrors.usuarioInstagram}</small> : null}
                  </label>
                  <label className="settings-form-field full">
                    <span>Correo (opcional)</span>
                    <input
                      type="email"
                      value={inlineDonorForm.email}
                      onChange={(event) => updateInlineDonorField("email", event.target.value)}
                      onBlur={checkInlineDonorDuplicate}
                      disabled={inlineDonorSaving}
                      autoComplete="email"
                    />
                    {inlineDonorErrors.email ? <small className="inventory-field-error">{inlineDonorErrors.email}</small> : null}
                  </label>
                </div>

                {inlineDonorMatch ? (
                  <div className="inventory-inline-notice inventory-inline-notice-warning">
                    <strong>
                      Coincidencia: {inlineDonorMatch.donor.nombreCompleto || inlineDonorMatch.donor.nombre}
                    </strong>
                    <span>
                      Se detectó por {inlineDonorMatch.matchedBy}. El registro está inactivo y no se creará un duplicado.
                    </span>
                    {canUpdateDonors ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => void handleReactivateInlineDonor()}
                        disabled={inlineDonorSaving}
                      >
                        {inlineDonorSaving ? "Reactivando..." : "Reactivar y seleccionar"}
                      </button>
                    ) : (
                      <small>Necesitas permiso de actualización de donantes para reactivarlo.</small>
                    )}
                  </div>
                ) : null}

                <div className="inventory-inline-form-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleCreateInlineDonor()}
                    disabled={inlineDonorSaving || Boolean(inlineDonorMatch)}
                  >
                    {inlineDonorSaving ? "Creando donante..." : "Crear y seleccionar"}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
          <label className="settings-form-field full">
            <span>Punto de encuentro</span>
            <input
              type="text"
              value={donationForm.puntoEncuentro}
              onChange={(event) => setDonationForm((current) => ({ ...current, puntoEncuentro: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="4"
              value={donationForm.observaciones}
              onChange={(event) => setDonationForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={donationItemModalOpen}
        title={editingDonationItemId ? "Editar item de donación" : "Agregar item de donación"}
        submitLabel={editingDonationItemId ? "Guardar cambios" : "Crear línea"}
        isSaving={donationItemSaving}
        error={donationItemError}
        onClose={() => {
          if (!donationItemSaving) setDonationItemModalOpen(false);
        }}
        onSubmit={handleSubmitDonationItem}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Donación</span>
            <select
              value={donationItemForm.donationId}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, donationId: event.target.value }))}
            >
              <option value="">Selecciona una donación</option>
              {donations.map((donation) => (
                <option key={donation.id} value={donation.id}>{`#${donation.id} · ${donation.motivoDonacion}`}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Item</span>
            <select
              value={donationItemForm.itemId}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, itemId: event.target.value }))}
            >
              <option value="">Selecciona un item</option>
              {items.filter((item) => item.activo).map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Cantidad</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={donationItemForm.cantidad}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, cantidad: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Condicion</span>
            <select
              value={donationItemForm.condicion}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, condicion: event.target.value }))}
            >
              {ITEM_CONDITION_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Fecha vencimiento</span>
            <input
              type="date"
              value={donationItemForm.fechaVencimiento}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, fechaVencimiento: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha apertura</span>
            <input
              type="date"
              value={donationItemForm.fechaApertura}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, fechaApertura: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Condiciones de almacenamiento</span>
            <textarea
              rows="3"
              value={donationItemForm.condicionesAlmacenamiento}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, condicionesAlmacenamiento: event.target.value }))}
              placeholder="Ej. Mantener en lugar fresco y seco"
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={donationItemForm.observaciones}
              onChange={(event) => setDonationItemForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <BulkReceiptModal
        isOpen={donationBulkReceiptOpen}
        title="Recepcionar items de donación"
        lines={selectedDonation?.donationItems || []}
        locations={locationsActiveOptions}
        isSaving={donationBulkReceiptSaving}
        error={donationBulkReceiptError}
        onClose={() => {
          if (!donationBulkReceiptSaving) setDonationBulkReceiptOpen(false);
        }}
        onSubmit={handleSubmitDonationBulkReceipt}
      />

      <InventoryModal
        isOpen={donationReceiveModalOpen}
        title="Recepcionar item de donación"
        submitLabel="Registrar recepción"
        isSaving={donationReceiveSaving}
        error={donationReceiveError}
        onClose={() => {
          if (!donationReceiveSaving) setDonationReceiveModalOpen(false);
        }}
        onSubmit={handleSubmitDonationReceive}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Ubicación destino</span>
            <select
              value={donationReceiveForm.destinationLocationId}
              onChange={(event) => setDonationReceiveForm((current) => ({ ...current, destinationLocationId: event.target.value }))}
            >
              <option value="">Selecciona una ubicación</option>
              {locationsActiveOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Cantidad a recepcionar</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={donationReceiveForm.cantidad}
              onChange={(event) => setDonationReceiveForm((current) => ({ ...current, cantidad: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha de recepción</span>
            <input
              type="date"
              value={donationReceiveForm.receiptDate}
              onChange={(event) => setDonationReceiveForm((current) => ({ ...current, receiptDate: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Condicion real al recibir</span>
            <select
              value={donationReceiveForm.condicion}
              onChange={(event) => setDonationReceiveForm((current) => ({ ...current, condicion: event.target.value }))}
            >
              <option value="">Sin condicion</option>
              {ITEM_CONDITION_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Fecha de vencimiento real</span>
            <input
              type="date"
              value={donationReceiveForm.fechaVencimiento}
              onChange={(event) => setDonationReceiveForm((current) => ({ ...current, fechaVencimiento: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha de apertura real</span>
            <input
              type="date"
              value={donationReceiveForm.fechaApertura}
              onChange={(event) => setDonationReceiveForm((current) => ({ ...current, fechaApertura: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Condiciones de almacenamiento observadas</span>
            <textarea
              rows="3"
              value={donationReceiveForm.condicionesAlmacenamiento}
              onChange={(event) =>
                setDonationReceiveForm((current) => ({
                  ...current,
                  condicionesAlmacenamiento: event.target.value,
                }))
              }
            />
          </label>
          <label className="settings-form-field inventory-inline-checkbox-field">
            <span>Cierre del detalle</span>
            <label className="inventory-inline-checkbox">
              <input
                type="checkbox"
                checked={donationReceiveForm.cierraDetalle}
                onChange={(event) =>
                  setDonationReceiveForm((current) => ({
                    ...current,
                    cierraDetalle: event.target.checked,
                  }))
                }
              />
              <span>Esta recepción cierra el detalle</span>
            </label>
            <small>Marca esta opción unicamente si no se esperan mas unidades de este item.</small>
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="4"
              value={donationReceiveForm.observaciones}
              onChange={(event) => setDonationReceiveForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={purchaseModalOpen}
        title={purchaseFormMode === "edit" ? "Editar compra" : "Crear compra"}
        submitLabel={purchaseFormMode === "edit" ? "Guardar cambios" : "Crear borrador"}
        isSaving={purchaseSaving}
        error={purchaseFormError}
        onClose={() => {
          if (!purchaseSaving) setPurchaseModalOpen(false);
        }}
        onSubmit={handleSubmitPurchase}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Proveedor</span>
            <select
              value={purchaseForm.supplierId}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, supplierId: event.target.value }))}
            >
              <option value="">Selecciona un proveedor</option>
              {suppliers.filter((supplier) => supplier.activo).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.nombre}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Fecha compra</span>
            <input
              type="date"
              value={purchaseForm.fechaCompra}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, fechaCompra: event.target.value }))}
            />
          </label>
          <div className="animal-form-block full">
            <span className="animal-form-label">Información financiera</span>
            <div className="settings-form-grid">
              <label className="settings-form-field">
                <span>Moneda</span>
                <select
                  value={purchaseForm.moneda}
                  onChange={(event) => setPurchaseForm((current) => ({ ...current, moneda: event.target.value }))}
                >
                  {SUPPORTED_FINANCIAL_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field">
                <span>Fecha de vencimiento de pago</span>
                <input
                  type="date"
                  value={purchaseForm.fechaVencimientoPago}
                  onChange={(event) => setPurchaseForm((current) => ({ ...current, fechaVencimientoPago: event.target.value }))}
                />
              </label>
              <label className="settings-form-field full">
                <span>Observación financiera</span>
                <textarea
                  rows="3"
                  value={purchaseForm.observacionFinanciera}
                  onChange={(event) => setPurchaseForm((current) => ({ ...current, observacionFinanciera: event.target.value }))}
                />
              </label>
            </div>
          </div>
          <label className="settings-form-field full">
            <span>Descripción</span>
            <textarea
              rows="3"
              value={purchaseForm.descripcion}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, descripcion: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={purchaseForm.observaciones}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={purchaseDetailModalOpen}
        title={editingPurchaseDetailId ? "Editar detalle de compra" : "Agregar detalle de compra"}
        submitLabel={editingPurchaseDetailId ? "Guardar cambios" : "Crear detalle"}
        isSaving={purchaseDetailSaving}
        error={purchaseDetailError}
        onClose={() => {
          if (!purchaseDetailSaving) setPurchaseDetailModalOpen(false);
        }}
        onSubmit={handleSubmitPurchaseDetail}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Compra</span>
            <select
              value={purchaseDetailForm.purchaseId}
              onChange={(event) => setPurchaseDetailForm((current) => ({ ...current, purchaseId: event.target.value }))}
            >
              <option value="">Selecciona una compra</option>
              {purchases.map((purchase) => (
                <option key={purchase.id} value={purchase.id}>{`#${purchase.id} · ${purchase.supplier?.nombre || "Sin proveedor"}`}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Item</span>
            <select
              value={purchaseDetailForm.itemId}
              onChange={(event) => setPurchaseDetailForm((current) => ({ ...current, itemId: event.target.value }))}
            >
              <option value="">Selecciona un item</option>
              {items.filter((item) => item.activo).map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Cantidad</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchaseDetailForm.cantidad}
              onChange={(event) => {
                const nextQuantity = event.target.value;
                setPurchaseDetailForm((current) => ({
                  ...current,
                  cantidad: nextQuantity,
                  subtotal: (() => {
                    const subtotal = calculatePurchaseSubtotal(nextQuantity, current.precioUnitario);
                    return Number.isFinite(subtotal) ? String(subtotal) : "";
                  })(),
                }));
              }}
            />
          </label>
          <label className="settings-form-field">
            <span>Precio unitario</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchaseDetailForm.precioUnitario}
              onChange={(event) => {
                const nextPrice = event.target.value;
                setPurchaseDetailForm((current) => {
                  const subtotal = calculatePurchaseSubtotal(current.cantidad, nextPrice);
                  return {
                    ...current,
                    precioUnitario: nextPrice,
                    subtotal: Number.isFinite(subtotal) ? String(subtotal) : "",
                  };
                });
              }}
            />
          </label>
          <label className="settings-form-field">
            <span>Subtotal</span>
            <input
              type="text"
              value={purchaseDetailForm.subtotal}
              readOnly
              disabled
            />
          </label>
          <label className="settings-form-field">
            <span>Condicion</span>
            <select
              value={purchaseDetailForm.condicion}
              onChange={(event) => setPurchaseDetailForm((current) => ({ ...current, condicion: event.target.value }))}
            >
              {ITEM_CONDITION_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Fecha vencimiento</span>
            <input
              type="date"
              value={purchaseDetailForm.fechaVencimiento}
              onChange={(event) => setPurchaseDetailForm((current) => ({ ...current, fechaVencimiento: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha apertura</span>
            <input
              type="date"
              value={purchaseDetailForm.fechaApertura}
              onChange={(event) => setPurchaseDetailForm((current) => ({ ...current, fechaApertura: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Condiciones de almacenamiento</span>
            <textarea
              rows="3"
              value={purchaseDetailForm.condicionesAlmacenamiento}
              onChange={(event) => setPurchaseDetailForm((current) => ({ ...current, condicionesAlmacenamiento: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={purchaseDetailForm.observaciones}
              onChange={(event) => setPurchaseDetailForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <BulkReceiptModal
        isOpen={purchaseBulkReceiptOpen}
        title="Recepcionar detalles de compra"
        lines={selectedPurchase?.purchaseDetails || []}
        locations={locationsActiveOptions}
        isSaving={purchaseBulkReceiptSaving}
        error={purchaseBulkReceiptError}
        onClose={() => {
          if (!purchaseBulkReceiptSaving) setPurchaseBulkReceiptOpen(false);
        }}
        onSubmit={handleSubmitPurchaseBulkReceipt}
      />

      <InventoryModal
        isOpen={purchaseReceiveModalOpen}
        title="Recepcionar detalle de compra"
        submitLabel="Registrar recepción"
        isSaving={purchaseReceiveSaving}
        error={purchaseReceiveError}
        onClose={() => {
          if (!purchaseReceiveSaving) setPurchaseReceiveModalOpen(false);
        }}
        onSubmit={handleSubmitPurchaseReceive}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Ubicación destino</span>
            <select
              value={purchaseReceiveForm.destinationLocationId}
              onChange={(event) => setPurchaseReceiveForm((current) => ({ ...current, destinationLocationId: event.target.value }))}
            >
              <option value="">Selecciona una ubicación</option>
              {locationsActiveOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Cantidad a recepcionar</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchaseReceiveForm.cantidad}
              onChange={(event) => setPurchaseReceiveForm((current) => ({ ...current, cantidad: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha de recepción</span>
            <input
              type="date"
              value={purchaseReceiveForm.receiptDate}
              onChange={(event) => setPurchaseReceiveForm((current) => ({ ...current, receiptDate: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Condicion real al recibir</span>
            <select
              value={purchaseReceiveForm.condicion}
              onChange={(event) => setPurchaseReceiveForm((current) => ({ ...current, condicion: event.target.value }))}
            >
              <option value="">Sin condicion</option>
              {ITEM_CONDITION_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Fecha de vencimiento real</span>
            <input
              type="date"
              value={purchaseReceiveForm.fechaVencimiento}
              onChange={(event) => setPurchaseReceiveForm((current) => ({ ...current, fechaVencimiento: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Fecha de apertura real</span>
            <input
              type="date"
              value={purchaseReceiveForm.fechaApertura}
              onChange={(event) => setPurchaseReceiveForm((current) => ({ ...current, fechaApertura: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Condiciones de almacenamiento observadas</span>
            <textarea
              rows="3"
              value={purchaseReceiveForm.condicionesAlmacenamiento}
              onChange={(event) =>
                setPurchaseReceiveForm((current) => ({
                  ...current,
                  condicionesAlmacenamiento: event.target.value,
                }))
              }
            />
          </label>
          <label className="settings-form-field inventory-inline-checkbox-field">
            <span>Cierre del detalle</span>
            <label className="inventory-inline-checkbox">
              <input
                type="checkbox"
                checked={purchaseReceiveForm.cierraDetalle}
                onChange={(event) =>
                  setPurchaseReceiveForm((current) => ({
                    ...current,
                    cierraDetalle: event.target.checked,
                  }))
                }
              />
              <span>Esta recepción cierra el detalle</span>
            </label>
            <small>Marca esta opción unicamente si no se esperan mas unidades de este item.</small>
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="4"
              value={purchaseReceiveForm.observaciones}
              onChange={(event) => setPurchaseReceiveForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryReadOnlyModal
        isOpen={donationReceiptHistoryOpen}
        title="Historial de recepciones del item"
        onClose={() => {
          setDonationReceiptHistoryOpen(false);
          setSelectedDonationReceiptLine(null);
        }}
      >
        {selectedDonationReceiptLine?.inventoryReceipts?.length ? (
          <div className="table-scroll">
            <table className="crud-table inventory-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cantidad</th>
                  <th>Acumulado</th>
                  <th>Responsable</th>
                  <th>Ubicación</th>
                  <th>Cerro detalle</th>
                </tr>
              </thead>
              <tbody>
                {selectedDonationReceiptLine.inventoryReceipts
                  .slice()
                  .sort((left, right) => String(left.fechaRecepcion).localeCompare(String(right.fechaRecepcion)))
                  .reduce((rows, receipt) => {
                    const previousTotal = rows.length > 0 ? rows[rows.length - 1].acumulado : 0;
                    rows.push({
                      ...receipt,
                      acumulado: previousTotal + Number(receipt.cantidad || 0),
                    });
                    return rows;
                  }, [])
                  .map((receipt) => (
                    <tr key={receipt.id}>
                      <td>{formatDate(receipt.fechaRecepcion)}</td>
                      <td>{formatQuantity(receipt.cantidad)}</td>
                      <td>{formatQuantity(receipt.acumulado)}</td>
                      <td>{formatPersonName(receipt.performedBy)}</td>
                      <td>{receipt.destinationLocation?.label || "Sin ubicación"}</td>
                      <td>{yesNoLabel(receipt.cierraDetalle)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <InventoryEmptyState>Este item aun no tiene recepciones registradas.</InventoryEmptyState>
        )}
      </InventoryReadOnlyModal>

      <InventoryReadOnlyModal
        isOpen={purchaseReceiptHistoryOpen}
        title="Historial de recepciones del detalle"
        onClose={() => {
          setPurchaseReceiptHistoryOpen(false);
          setSelectedPurchaseReceiptLine(null);
        }}
      >
        {selectedPurchaseReceiptLine?.inventoryReceipts?.length ? (
          <div className="table-scroll">
            <table className="crud-table inventory-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cantidad</th>
                  <th>Acumulado</th>
                  <th>Responsable</th>
                  <th>Ubicación</th>
                  <th>Cerro detalle</th>
                </tr>
              </thead>
              <tbody>
                {selectedPurchaseReceiptLine.inventoryReceipts
                  .slice()
                  .sort((left, right) => String(left.fechaRecepcion).localeCompare(String(right.fechaRecepcion)))
                  .reduce((rows, receipt) => {
                    const previousTotal = rows.length > 0 ? rows[rows.length - 1].acumulado : 0;
                    rows.push({
                      ...receipt,
                      acumulado: previousTotal + Number(receipt.cantidad || 0),
                    });
                    return rows;
                  }, [])
                  .map((receipt) => (
                    <tr key={receipt.id}>
                      <td>{formatDate(receipt.fechaRecepcion)}</td>
                      <td>{formatQuantity(receipt.cantidad)}</td>
                      <td>{formatQuantity(receipt.acumulado)}</td>
                      <td>{formatPersonName(receipt.performedBy)}</td>
                      <td>{receipt.destinationLocation?.label || "Sin ubicación"}</td>
                      <td>{yesNoLabel(receipt.cierraDetalle)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <InventoryEmptyState>Este detalle aun no tiene recepciones registradas.</InventoryEmptyState>
        )}
      </InventoryReadOnlyModal>

      <InventoryModal
        isOpen={supplierModalOpen}
        title={supplierFormMode === "edit" ? "Editar proveedor" : "Crear proveedor"}
        submitLabel={supplierFormMode === "edit" ? "Guardar cambios" : "Crear proveedor"}
        isSaving={supplierSaving}
        error={supplierFormError}
        onClose={() => {
          if (!supplierSaving) setSupplierModalOpen(false);
        }}
        onSubmit={handleSubmitSupplier}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Nombre</span>
            <input
              type="text"
              value={supplierForm.nombre}
              onChange={(event) => setSupplierForm((current) => ({ ...current, nombre: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Activo</span>
            <select
              value={supplierForm.activo ? "true" : "false"}
              onChange={(event) => setSupplierForm((current) => ({ ...current, activo: event.target.value === "true" }))}
            >
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="settings-form-field">
            <span>Teléfono</span>
            <input
              type="text"
              value={supplierForm.telefono}
              onChange={(event) => setSupplierForm((current) => ({ ...current, telefono: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Email</span>
            <input
              type="email"
              value={supplierForm.email}
              onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={supplierForm.observaciones}
              onChange={(event) => setSupplierForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full inventory-inline-checkbox-field">
            <span>Ubicación opcional</span>
            <label className="inventory-inline-checkbox">
              <input
                type="checkbox"
                checked={supplierForm.hasLocation}
                onChange={(event) => setSupplierForm((current) => ({ ...current, hasLocation: event.target.checked }))}
              />
              <span>Quiero registrar ubicación física para este proveedor</span>
            </label>
          </label>
          {supplierForm.hasLocation ? (
            <>
              <label className="settings-form-field full">
                <span>Dirección</span>
                <input
                  type="text"
                  value={supplierForm.direccion}
                  onChange={(event) => setSupplierForm((current) => ({ ...current, direccion: event.target.value }))}
                />
              </label>
              <label className="settings-form-field">
                <span>Región</span>
                <select
                  value={supplierForm.regionId}
                  onChange={(event) => void handleSupplierRegionChange(event.target.value)}
                >
                  <option value="">Selecciona una región</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>{region.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field">
                <span>Comuna</span>
                <select
                  value={supplierForm.comunaId}
                  onChange={(event) => setSupplierForm((current) => ({ ...current, comunaId: event.target.value }))}
                >
                  <option value="">Selecciona una comuna</option>
                  {comunasForSupplierRegion.map((comuna) => (
                    <option key={comuna.id} value={comuna.id}>{comuna.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="settings-form-field full">
                <span>Observaciones de ubicación</span>
                <textarea
                  rows="3"
                  value={supplierForm.locationObservaciones}
                  onChange={(event) => setSupplierForm((current) => ({ ...current, locationObservaciones: event.target.value }))}
                />
              </label>
            </>
          ) : null}
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={donorModalOpen}
        title={donorFormMode === "edit" ? "Editar donante" : "Crear donante"}
        submitLabel={donorFormMode === "edit" ? "Guardar cambios" : "Crear donante"}
        isSaving={donorSaving}
        error={donorFormError}
        onClose={() => {
          if (!donorSaving) setDonorModalOpen(false);
        }}
        onSubmit={handleSubmitDonor}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Nombre</span>
            <input
              type="text"
              value={donorForm.nombre}
              onChange={(event) => setDonorForm((current) => ({ ...current, nombre: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Apellido</span>
            <input
              type="text"
              value={donorForm.apellido}
              onChange={(event) => setDonorForm((current) => ({ ...current, apellido: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Correo</span>
            <input
              type="email"
              value={donorForm.email}
              onChange={(event) => setDonorForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Teléfono</span>
            <input
              type="text"
              value={donorForm.telefono}
              onChange={(event) => setDonorForm((current) => ({ ...current, telefono: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Instagram</span>
            <input
              type="text"
              value={donorForm.usuarioInstagram}
              onChange={(event) => setDonorForm((current) => ({ ...current, usuarioInstagram: event.target.value }))}
            />
          </label>
          <label className="settings-form-field inventory-inline-checkbox-field">
            <span>Estado</span>
            <label className="inventory-inline-checkbox">
              <input
                type="checkbox"
                checked={Boolean(donorForm.activo)}
                onChange={(event) => setDonorForm((current) => ({ ...current, activo: event.target.checked }))}
              />
              <span>Donante activo</span>
            </label>
          </label>
          <label className="settings-form-field full">
            <span>Dirección</span>
            <input
              type="text"
              value={donorForm.direccion}
              onChange={(event) => setDonorForm((current) => ({ ...current, direccion: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={donorForm.observaciones}
              onChange={(event) => setDonorForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={stockCountModalOpen}
        title="Crear conteo físico"
        submitLabel="Guardar conteo"
        isSaving={stockCountSaving}
        error={stockCountFormError}
        onClose={() => {
          if (!stockCountSaving) setStockCountModalOpen(false);
        }}
        onSubmit={handleSubmitStockCount}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Fecha de conteo</span>
            <input
              type="date"
              value={stockCountForm.fechaConteo}
              onChange={(event) => setStockCountForm((current) => ({ ...current, fechaConteo: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Ubicación</span>
            <select
              value={stockCountForm.locationId}
              onChange={(event) => void handleStockCountLocationChange(event.target.value)}
            >
              <option value="">Selecciona una ubicación</option>
              {locationsActiveOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={stockCountForm.observaciones}
              onChange={(event) => setStockCountForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>

        <section className="inventory-subform">
          <div className="inventory-subform-header">
            <div>
              <h4>Detalles del conteo</h4>
              <p>Si ya conoces la existencia, puedes asociarla; si no, basta con el item.</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() =>
                setStockCountForm((current) => ({
                  ...current,
                  detalles: [...current.detalles, emptyStockCountDetailRow()],
                }))
              }
            >
              Agregar fila
            </button>
          </div>
          <div className="inventory-detail-rows">
            {stockCountForm.detalles.map((row, index) => (
              <div key={row.key} className="inventory-detail-row">
                <label className="settings-form-field">
                  <span>Item</span>
                  <select
                    value={row.itemId}
                    onChange={(event) =>
                      setStockCountForm((current) => ({
                        ...current,
                        detalles: current.detalles.map((detail, detailIndex) =>
                          detailIndex === index
                            ? { ...detail, itemId: event.target.value, existenciaId: "" }
                            : detail,
                        ),
                      }))
                    }
                  >
                    <option value="">Selecciona un item</option>
                    {items.filter((item) => item.activo).map((item) => (
                      <option key={item.id} value={item.id}>{item.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="settings-form-field">
                  <span>Existencia</span>
                  <select
                    value={row.existenciaId}
                    onChange={(event) =>
                      setStockCountForm((current) => ({
                        ...current,
                        detalles: current.detalles.map((detail, detailIndex) =>
                          detailIndex === index ? { ...detail, existenciaId: event.target.value } : detail,
                        ),
                      }))
                    }
                    disabled={!stockCountForm.locationId}
                  >
                    <option value="">Sin existencia especifica</option>
                    {selectedStockCountExistences
                      .filter((existence) => !row.itemId || String(existence.itemId) === String(row.itemId))
                      .map((existence) => (
                        <option key={existence.id} value={existence.id}>
                          {`#${existence.id} · ${existence.itemNombre} · ${formatQuantity(existence.cantidadActual)}`}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="settings-form-field">
                  <span>Cantidad contada</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.cantidadContada}
                    onChange={(event) =>
                      setStockCountForm((current) => ({
                        ...current,
                        detalles: current.detalles.map((detail, detailIndex) =>
                          detailIndex === index ? { ...detail, cantidadContada: event.target.value } : detail,
                        ),
                      }))
                    }
                  />
                </label>
                <label className="settings-form-field">
                  <span>Observaciones</span>
                  <input
                    type="text"
                    value={row.observaciones}
                    onChange={(event) =>
                      setStockCountForm((current) => ({
                        ...current,
                        detalles: current.detalles.map((detail, detailIndex) =>
                          detailIndex === index ? { ...detail, observaciones: event.target.value } : detail,
                        ),
                      }))
                    }
                  />
                </label>
                <IconButton
                  icon={MinusCircle}
                  label="Quitar línea de conteo"
                  variant="danger"
                  onClick={() =>
                    setStockCountForm((current) => ({
                      ...current,
                      detalles:
                        current.detalles.length > 1
                          ? current.detalles.filter((detail, detailIndex) => detailIndex !== index)
                          : current.detalles,
                    }))
                  }
                  disabled={stockCountForm.detalles.length === 1}
                />
              </div>
            ))}
          </div>
        </section>
      </InventoryModal>

      <InventoryModal
        isOpen={adjustmentModalOpen}
        title="Crear ajuste manual"
        submitLabel="Guardar ajuste"
        isSaving={adjustmentSaving}
        error={adjustmentError}
        onClose={() => {
          if (!adjustmentSaving) setAdjustmentModalOpen(false);
        }}
        onSubmit={handleSubmitAdjustment}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Ubicación</span>
            <select
              value={adjustmentForm.locationId}
              onChange={async (event) => {
                const locationId = event.target.value;
                setAdjustmentForm((current) => ({
                  ...current,
                  locationId,
                  detalles: current.detalles.map((detail) => ({ ...detail, existenciaId: "" })),
                }));
                if (locationId) {
                  try {
                    await ensureLocationExistences(locationId);
                  } catch (error) {
                    setAdjustmentError(error.message || "No se pudieron cargar las existencias.");
                  }
                }
              }}
            >
              <option value="">Selecciona una ubicación</option>
              {locationsActiveOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Motivo</span>
            <input
              type="text"
              value={adjustmentForm.motivo}
              onChange={(event) => setAdjustmentForm((current) => ({ ...current, motivo: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={adjustmentForm.observaciones}
              onChange={(event) => setAdjustmentForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>

        <section className="inventory-subform">
          <div className="inventory-subform-header">
            <div>
              <h4>Detalles del ajuste</h4>
              <p>Define cantidad antes y cantidad contada para que el backend calcule la diferencia.</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() =>
                setAdjustmentForm((current) => ({
                  ...current,
                  detalles: [...current.detalles, emptyAdjustmentDetailRow()],
                }))
              }
            >
              Agregar fila
            </button>
          </div>
          <div className="inventory-detail-rows">
            {adjustmentForm.detalles.map((row, index) => {
              const scopedExistences = adjustmentForm.locationId
                ? (existencesByLocation[adjustmentForm.locationId] || []).filter(
                    (existence) => !row.itemId || String(existence.itemId) === String(row.itemId),
                  )
                : [];

              return (
                <div key={row.key} className="inventory-detail-row">
                  <label className="settings-form-field">
                    <span>Item</span>
                    <select
                      value={row.itemId}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({
                          ...current,
                          detalles: current.detalles.map((detail, detailIndex) =>
                            detailIndex === index
                              ? { ...detail, itemId: event.target.value, existenciaId: "" }
                              : detail,
                          ),
                        }))
                      }
                    >
                      <option value="">Selecciona un item</option>
                      {items.filter((item) => item.activo).map((item) => (
                        <option key={item.id} value={item.id}>{item.nombre}</option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Existencia</span>
                    <select
                      value={row.existenciaId}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({
                          ...current,
                          detalles: current.detalles.map((detail, detailIndex) => {
                            if (detailIndex !== index) return detail;
                            const existence = scopedExistences.find(
                              (currentExistence) => String(currentExistence.id) === String(event.target.value),
                            );
                            return {
                              ...detail,
                              existenciaId: event.target.value,
                              cantidadAntes:
                                existence?.cantidadActual !== undefined
                                  ? String(existence.cantidadActual)
                                  : detail.cantidadAntes,
                            };
                          }),
                        }))
                      }
                      disabled={!adjustmentForm.locationId}
                    >
                      <option value="">Sin existencia especifica</option>
                      {scopedExistences.map((existence) => (
                        <option key={existence.id} value={existence.id}>
                          {`#${existence.id} · ${existence.itemNombre} · ${formatQuantity(existence.cantidadActual)}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-form-field">
                    <span>Cantidad antes</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.cantidadAntes}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({
                          ...current,
                          detalles: current.detalles.map((detail, detailIndex) =>
                            detailIndex === index ? { ...detail, cantidadAntes: event.target.value } : detail,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="settings-form-field">
                    <span>Cantidad contada</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.cantidadContada}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({
                          ...current,
                          detalles: current.detalles.map((detail, detailIndex) =>
                            detailIndex === index ? { ...detail, cantidadContada: event.target.value } : detail,
                          ),
                        }))
                      }
                    />
                  </label>
                  <IconButton
                    icon={MinusCircle}
                    label="Quitar línea de ajuste"
                    variant="danger"
                    onClick={() =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        detalles:
                          current.detalles.length > 1
                            ? current.detalles.filter((detail, detailIndex) => detailIndex !== index)
                            : current.detalles,
                      }))
                    }
                    disabled={adjustmentForm.detalles.length === 1}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </InventoryModal>

      <InventoryModal
        isOpen={adjustmentFromCountModalOpen}
        title="Crear ajuste desde conteo"
        submitLabel="Crear ajuste"
        isSaving={adjustmentFromCountSaving}
        error={adjustmentFromCountError}
        onClose={() => {
          if (!adjustmentFromCountSaving) setAdjustmentFromCountModalOpen(false);
        }}
        onSubmit={handleSubmitAdjustmentFromCount}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Conteo físico</span>
            <select
              value={adjustmentFromCountForm.stockCountId}
              onChange={(event) => setAdjustmentFromCountForm((current) => ({ ...current, stockCountId: event.target.value }))}
            >
              <option value="">Selecciona un conteo</option>
              {stockCounts.map((count) => (
                <option key={count.id} value={count.id}>
                  {`#${count.id} · ${formatDate(count.fechaConteo)} · ${count.location?.nombre || "Sin ubicacion"}`}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Motivo</span>
            <input
              type="text"
              value={adjustmentFromCountForm.motivo}
              onChange={(event) => setAdjustmentFromCountForm((current) => ({ ...current, motivo: event.target.value }))}
            />
          </label>
          <label className="settings-form-field full">
            <span>Observaciones</span>
            <textarea
              rows="4"
              value={adjustmentFromCountForm.observaciones}
              onChange={(event) => setAdjustmentFromCountForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={itemModalOpen}
        title={editingItemId ? "Editar item" : "Crear item"}
        submitLabel={editingItemId ? "Guardar cambios" : "Crear item"}
        isSaving={itemSaving}
        error={itemFormError}
        onClose={() => {
          if (!itemSaving) setItemModalOpen(false);
        }}
        onSubmit={handleSubmitItem}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field full">
            <span>Nombre</span>
            <input
              type="text"
              value={itemForm.nombre}
              onChange={(event) => setItemForm((current) => ({ ...current, nombre: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Categoria</span>
            <select
              value={itemForm.categoriaId}
              onChange={(event) => setItemForm((current) => ({ ...current, categoriaId: event.target.value }))}
            >
              <option value="">Selecciona una categoria</option>
              {categories.filter((category) => category.activo).map((category) => (
                <option key={category.id} value={category.id}>{category.nombre}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Unidad</span>
            <select
              value={itemForm.unidadId}
              onChange={(event) => setItemForm((current) => ({ ...current, unidadId: event.target.value }))}
            >
              <option value="">Selecciona una unidad</option>
              {units.filter((unit) => unit.activo).map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.nombre}</option>
              ))}
            </select>
          </label>
          <label className="settings-form-field">
            <span>Stock minimo</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={itemForm.stockMinimo}
              onChange={(event) => setItemForm((current) => ({ ...current, stockMinimo: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Activo</span>
            <select
              value={itemForm.activo ? "true" : "false"}
              onChange={(event) => setItemForm((current) => ({ ...current, activo: event.target.value === "true" }))}
            >
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="settings-form-field full">
            <span>Descripción</span>
            <textarea
              rows="4"
              value={itemForm.descripcion}
              onChange={(event) => setItemForm((current) => ({ ...current, descripcion: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={categoryModalOpen}
        title={editingCategoryId ? "Editar categoria" : "Crear categoria"}
        submitLabel={editingCategoryId ? "Guardar cambios" : "Crear categoria"}
        isSaving={categorySaving}
        error={categoryFormError}
        onClose={() => {
          if (!categorySaving) setCategoryModalOpen(false);
        }}
        onSubmit={handleSubmitCategory}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field full">
            <span>Nombre de categoria</span>
            <input
              type="text"
              value={categoryForm.nombre}
              onChange={(event) => setCategoryForm((current) => ({ ...current, nombre: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Activo</span>
            <select
              value={categoryForm.activo ? "true" : "false"}
              onChange={(event) => setCategoryForm((current) => ({ ...current, activo: event.target.value === "true" }))}
            >
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>
      </InventoryModal>

      <InventoryModal
        isOpen={unitModalOpen}
        title={editingUnitId ? "Editar unidad" : "Crear unidad"}
        submitLabel={editingUnitId ? "Guardar cambios" : "Crear unidad"}
        isSaving={unitSaving}
        error={unitFormError}
        onClose={() => {
          if (!unitSaving) setUnitModalOpen(false);
        }}
        onSubmit={handleSubmitUnit}
      >
        <div className="settings-form-grid">
          <label className="settings-form-field">
            <span>Nombre</span>
            <input
              type="text"
              value={unitForm.nombre}
              onChange={(event) => setUnitForm((current) => ({ ...current, nombre: event.target.value }))}
            />
          </label>
          <label className="settings-form-field">
            <span>Activo</span>
            <select
              value={unitForm.activo ? "true" : "false"}
              onChange={(event) => setUnitForm((current) => ({ ...current, activo: event.target.value === "true" }))}
            >
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="settings-form-field full">
            <span>Descripción</span>
            <textarea
              rows="4"
              value={unitForm.descripcion}
              onChange={(event) => setUnitForm((current) => ({ ...current, descripcion: event.target.value }))}
            />
          </label>
        </div>
      </InventoryModal>
    </section>
  );
}
