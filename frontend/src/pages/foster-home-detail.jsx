import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightFromLine,
  ArrowRightLeft,
  Eye,
  PackageMinus,
  Pencil,
  Trash2,
  UserMinus,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import FilterSummaryBar from "../components/FilterSummaryBar";
import PaginationControls from "../components/PaginationControls";
import PageBreadcrumb from "../components/PageBreadcrumb";
import FosterHomeFormModal from "../components/foster-home/FosterHomeFormModal.jsx";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import { getInventoryExistences } from "../services/inventory_existence.service";
import { getInventoryMovements } from "../services/inventory_movement.service";
import { consumeInventory, exitInventory } from "../services/inventory.service";
import {
  createFosterAssignment,
  updateFosterAssignment,
} from "../services/foster_assignment.service";
import {
  createFosterHomeObservation,
  deleteFosterHomeObservation,
} from "../services/foster_home_observation.service";
import {
  createFosterHomeAllowedAnimal,
  deleteFosterHomeAllowedAnimal,
  updateFosterHomeAllowedAnimal,
} from "../services/foster_home_allowed_animal.service";
import {
  getEligibleFosterHomeAnimals,
  getFosterHome,
  updateFosterHome,
} from "../services/foster_home.service";
import { getUsers } from "../services/user.service";
import "../styles/home.page.css";
import "../styles/animals.page.css";
import "../styles/foster-home.page.css";
import "../styles/inventory.page.css";
import { paginateCollection } from "../utils/pagination";
import {
  FOSTER_ALLOWED_STATUS_OPTIONS,
  FOSTER_ASSIGNMENT_CLOSE_STATUS_OPTIONS,
  FOSTER_SPECIES_OPTIONS,
  formatDate,
  formatEnumLabel,
  getTodayDateInputValue,
  getUserFullName,
} from "../utils/foster-home";
import {
  formatLocationLine,
  formatQuantity,
  movementLabel,
  parsePositiveDecimal,
} from "../utils/inventory-ui";

const DETAIL_TABS = [
  { id: "animales", label: "Animales" },
  { id: "hogar", label: "Hogar" },
  { id: "observaciones", label: "Observaciones" },
];

const HOME_PERMISSIONS = {
  read: PERMISSIONS.ANIMALS.FOSTER_HOME_READ,
  create: PERMISSIONS.ANIMALS.FOSTER_HOME_CREATE,
  update: PERMISSIONS.ANIMALS.FOSTER_HOME_UPDATE,
  delete: PERMISSIONS.ANIMALS.FOSTER_HOME_DELETE,
  observationRead: PERMISSIONS.ANIMALS.FOSTER_HOME_OBSERVATION_READ,
};

const ASSIGNMENT_PERMISSIONS = {
  create: PERMISSIONS.ANIMALS.FOSTER_ASSIGNMENT_CREATE,
  update: PERMISSIONS.ANIMALS.FOSTER_ASSIGNMENT_UPDATE,
};

const FOSTER_HOME_ROLE = "Hogar Temporal";

const INVENTORY_HOME_PERMISSIONS = {
  readExistences: [
    "inventory:read:any",
    "inventory:read:location",
    "inventory:inventory_existence:read",
  ],
  readMovements: [
    "inventory:read:any",
    "inventory:read:location",
    "inventory:inventory_movement:read",
  ],
  operate: [
    "inventory:movement:create:any",
    "inventory:movement:create:location",
    "inventory:inventory_movement:create",
  ],
};

function emptyInventoryOperationForm(existence = null) {
  return {
    existenciaId: existence?.id ? String(existence.id) : "",
    cantidad: "",
    motivo: "",
    observaciones: "",
  };
}

function emptyHomeForm() {
  return {
    observaciones: "",
    activo: true,
    usuarios_asociados: [],
    responsable_usuario_id: "",
  };
}

function homeToForm(home) {
  return {
    observaciones: home.generalObservaciones || "",
    activo: Boolean(home.activo),
    usuarios_asociados: Array.isArray(home.usuariosAsociados)
      ? home.usuariosAsociados.map((value) => Number(value))
      : [],
    responsable_usuario_id: home.responsableUsuarioId
      ? String(home.responsableUsuarioId)
      : "",
  };
}

function buildHomePayload(form) {
  return {
    observaciones: form.observaciones.trim(),
    activo: Boolean(form.activo),
    usuarios_asociados: form.usuarios_asociados.map((value) => Number(value)),
    responsable_usuario_id: Number(form.responsable_usuario_id),
  };
}

function validateHomeForm(form) {
  if (form.usuarios_asociados.length === 0) {
    return "Debes asociar al menos un usuario al hogar temporal.";
  }
  if (!form.responsable_usuario_id) {
    return "Debes elegir un responsable del hogar temporal.";
  }
  if (!form.usuarios_asociados.includes(Number(form.responsable_usuario_id))) {
    return "El responsable debe estar incluido dentro de los usuarios asociados.";
  }
  return "";
}

function createEmptyAssignmentForm() {
  return {
    animal_id: "",
    fecha_inicio: getTodayDateInputValue(),
    observaciones: "",
  };
}

function createEmptyCloseForm(status = "FINALIZADO") {
  return {
    estado: status,
    fecha_fin: getTodayDateInputValue(),
    motivo_termino: "",
    observaciones: "",
  };
}

function createEmptyRuleForm() {
  return {
    especie: "",
    estadoPermitido: "",
    capacidadMaxima: "",
    observaciones: "",
    activo: true,
  };
}

function createEmptyBulkRuleForm() {
  return {
    especie: "",
    estadoPermitido: "",
    capacidadMaxima: "",
    activo: true,
    observaciones: "",
  };
}

function buildRulePayload(form) {
  return {
    especie: form.especie,
    estado_permitido: form.estadoPermitido,
    capacidad_maxima: form.capacidadMaxima === "" ? null : Number(form.capacidadMaxima),
    observaciones: form.observaciones.trim(),
    activo: Boolean(form.activo),
  };
}

function validateRuleForm(form) {
  if (!form.especie) return "Debes seleccionar una especie.";
  if (!form.estadoPermitido) return "Debes seleccionar un estado permitido.";
  if (form.capacidadMaxima !== "" && Number(form.capacidadMaxima) <= 0) {
    return "La capacidad maxima debe ser positiva.";
  }
  return "";
}

function validateRuleForms(forms = []) {
  if (!Array.isArray(forms) || forms.length === 0) {
    return "Debes agregar al menos una regla.";
  }

  const seenRuleKeys = new Set();

  for (const [index, form] of forms.entries()) {
    if (!form.especie) {
      return `La fila ${index + 1} debe tener una especie seleccionada.`;
    }
    if (!form.estadoPermitido) {
      return `La fila ${index + 1} debe tener un estado permitido seleccionado.`;
    }
    if (form.capacidadMaxima !== "" && Number(form.capacidadMaxima) < 1) {
      return `La fila ${index + 1} debe tener una capacidad maxima vacia o mayor o igual a 1.`;
    }

    const key = `${form.especie}::${form.estadoPermitido}`;
    if (seenRuleKeys.has(key)) {
      return "No puedes crear reglas duplicadas con la misma combinacion especie + estado permitido.";
    }
    seenRuleKeys.add(key);
  }

  return "";
}

function getHomeStatusClass(isActive) {
  return isActive ? "foster-status-active" : "foster-status-inactive";
}

function getAssignmentStatusClass(status) {
  if (status === "TRASLADADO") return "foster-status-transferred";
  if (status === "FINALIZADO") return "foster-status-finalized";
  return "foster-status-active";
}

function getDaysInHome(fechaInicio) {
  if (!fechaInicio) return "0";

  const start = new Date(`${fechaInicio}T00:00:00`);
  const now = new Date();
  const diffInMs = now.getTime() - start.getTime();
  const diffInDays = Math.max(Math.floor(diffInMs / (1000 * 60 * 60 * 24)), 0);
  return String(diffInDays);
}

function getHomeLocationLabel(home) {
  return [
    home?.location?.region?.nombre,
    home?.location?.comuna?.nombre,
    home?.location?.direccion,
  ]
    .filter(Boolean)
    .join(" · ") || "Sin ubicación";
}

function buildShowingStat(totalItems, page = 1, pageSize = 10) {
  const safeTotal = Array.isArray(totalItems) ? totalItems.length : Number(totalItems) || 0;

  if (safeTotal === 0) {
    return "Mostrando 0-0 de 0";
  }

  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (currentPage - 1) * safePageSize + 1;
  const end = Math.min(currentPage * safePageSize, safeTotal);

  return `Mostrando ${start}-${end} de ${safeTotal}`;
}

export default function FosterHomeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, hasRole } = usePermissions();

  const canUpdateHome = hasPermission(HOME_PERMISSIONS.update);
  const canCreateHome = hasPermission(HOME_PERMISSIONS.create);
  const canDeleteRule = hasPermission(HOME_PERMISSIONS.delete);
  const canReadObservations = hasPermission(HOME_PERMISSIONS.observationRead);
  const canCreateAssignment = hasPermission(ASSIGNMENT_PERMISSIONS.create);
  const canUpdateAssignment = hasPermission(ASSIGNMENT_PERMISSIONS.update);
  const isOwnHomeOnlyUser =
    hasRole(FOSTER_HOME_ROLE)
    && hasPermission(HOME_PERMISSIONS.read)
    && !canCreateHome
    && !canUpdateHome
    && !canDeleteRule;
const canReadHomeInventoryExistences = hasAnyPermission(
  INVENTORY_HOME_PERMISSIONS.readExistences,
);

const canReadHomeInventoryMovements = hasAnyPermission(
  INVENTORY_HOME_PERMISSIONS.readMovements,
);
  const canReadHomeInventory =
    canReadHomeInventoryExistences || canReadHomeInventoryMovements;
  const canOperateHomeInventory = hasAnyPermission(INVENTORY_HOME_PERMISSIONS.operate);
  const canRegisterHomeExit = hasAnyPermission(INVENTORY_HOME_PERMISSIONS.operate);

  const [activeTab, setActiveTab] = useState("animales");
  const [home, setHome] = useState(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState("");

  const [users, setUsers] = useState([]);
  const [formOptionsLoaded, setFormOptionsLoaded] = useState(false);

  const [isEditHomeModalOpen, setIsEditHomeModalOpen] = useState(false);
  const [isPreparingEditModal, setIsPreparingEditModal] = useState(false);
  const [homeForm, setHomeForm] = useState(emptyHomeForm());
  const [homeFormError, setHomeFormError] = useState("");
  const [isSavingHome, setIsSavingHome] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [eligibleAnimals, setEligibleAnimals] = useState([]);
  const [eligibleAnimalsLoading, setEligibleAnimalsLoading] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState(createEmptyAssignmentForm());
  const [assignmentError, setAssignmentError] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [closeForm, setCloseForm] = useState(createEmptyCloseForm());
  const [closeError, setCloseError] = useState("");
  const [isClosingAssignment, setIsClosingAssignment] = useState(false);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleModalMode, setRuleModalMode] = useState("create");
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleForm, setRuleForm] = useState(createEmptyRuleForm());
  const [ruleForms, setRuleForms] = useState([createEmptyBulkRuleForm()]);
  const [ruleError, setRuleError] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);

  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [observationText, setObservationText] = useState("");
  const [observationError, setObservationError] = useState("");
  const [isSavingObservation, setIsSavingObservation] = useState(false);
  const [activeAssignmentsPage, setActiveAssignmentsPage] = useState(1);
  const [activeAssignmentsPageSize, setActiveAssignmentsPageSize] = useState(5);
  const [assignmentHistoryFilters, setAssignmentHistoryFilters] = useState({
    search: "",
    status: "",
  });
  const [assignmentHistoryPage, setAssignmentHistoryPage] = useState(1);
  const [assignmentHistoryPageSize, setAssignmentHistoryPageSize] = useState(5);
  const [allowedRulesPage, setAllowedRulesPage] = useState(1);
  const [allowedRulesPageSize, setAllowedRulesPageSize] = useState(5);
  const [homeInventoryExistences, setHomeInventoryExistences] = useState([]);
  const [homeInventoryMovements, setHomeInventoryMovements] = useState([]);
  const [homeInventoryExistenceFilters, setHomeInventoryExistenceFilters] = useState({
    search: "",
    category: "",
    condition: "",
    status: "",
  });
  const [homeInventoryMovementFilters, setHomeInventoryMovementFilters] = useState({
    search: "",
    type: "",
  });
  const [homeInventoryMovementPage, setHomeInventoryMovementPage] = useState(1);
  const [homeInventoryMovementPageSize, setHomeInventoryMovementPageSize] = useState(5);
  const [homeInventoryLoading, setHomeInventoryLoading] = useState(false);
  const [homeInventoryError, setHomeInventoryError] = useState("");
  const [homeInventoryFeedback, setHomeInventoryFeedback] = useState("");
  const [inventoryOperationMode, setInventoryOperationMode] = useState("");
  const [selectedInventoryExistence, setSelectedInventoryExistence] = useState(null);
  const [inventoryOperationForm, setInventoryOperationForm] = useState(
    emptyInventoryOperationForm(),
  );
  const [inventoryOperationError, setInventoryOperationError] = useState("");
  const [isSubmittingInventoryOperation, setIsSubmittingInventoryOperation] = useState(false);

  const visibleTabs = useMemo(() => {
    const tabs = DETAIL_TABS.filter(
      (tab) => tab.id !== "observaciones" || canReadObservations,
    );
    if (canReadHomeInventory) {
      tabs.splice(2, 0, { id: "insumos", label: "Insumos" });
    }
    return tabs;
  }, [canReadHomeInventory, canReadObservations]);

  const homeLocationId = home?.locationId ? Number(home.locationId) : null;

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setHomeError("");

    try {
      setHome(await getFosterHome(id));
    } catch (error) {
      setHomeError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el hogar temporal.",
      );
    } finally {
      setHomeLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  const ensureFormOptionsLoaded = useCallback(async () => {
    if (formOptionsLoaded) return;

    const usersData = await getUsers();
    setUsers(usersData.filter((user) => user.activo !== false));
    setFormOptionsLoaded(true);
  }, [formOptionsLoaded]);

  const sortedMembers = useMemo(
    () => (Array.isArray(home?.miembros) ? [...home.miembros] : []),
    [home?.miembros],
  );

  const activeAssignmentsStats = useMemo(
    () => [
      buildShowingStat(home?.activeAssignments || [], activeAssignmentsPage, activeAssignmentsPageSize),
      `Activas: ${home?.activeAssignments?.length || 0}`,
    ],
    [activeAssignmentsPage, activeAssignmentsPageSize, home?.activeAssignments],
  );

  const paginatedActiveAssignments = useMemo(
    () => paginateCollection(home?.activeAssignments || [], activeAssignmentsPage, activeAssignmentsPageSize),
    [activeAssignmentsPage, activeAssignmentsPageSize, home?.activeAssignments],
  );

  const filteredAssignmentHistory = useMemo(() => {
    const assignments = Array.isArray(home?.assignmentHistory) ? home.assignmentHistory : [];
    const searchTerm = assignmentHistoryFilters.search.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const haystack = [
        assignment.animal?.nombre,
        assignment.animal?.especie,
        assignment.estado,
        assignment.motivoTermino,
        assignment.observaciones,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesStatus =
        !assignmentHistoryFilters.status
        || String(assignment.estado || "") === String(assignmentHistoryFilters.status);

      return matchesSearch && matchesStatus;
    });
  }, [assignmentHistoryFilters, home?.assignmentHistory]);

  const assignmentHistoryStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (home?.assignmentHistory || [])
            .map((assignment) => assignment.estado)
            .filter(Boolean),
        ),
      ),
    [home?.assignmentHistory],
  );

  const assignmentHistoryStats = useMemo(
    () => [
      `Mostrando ${filteredAssignmentHistory.length} de ${(home?.assignmentHistory || []).length}`,
      `Finalizadas: ${
        filteredAssignmentHistory.filter((assignment) => assignment.estado === "FINALIZADO").length
      }`,
      `Trasladadas: ${
        filteredAssignmentHistory.filter((assignment) => assignment.estado === "TRASLADADO").length
      }`,
    ],
    [filteredAssignmentHistory, home?.assignmentHistory],
  );

  const paginatedAssignmentHistory = useMemo(
    () =>
      paginateCollection(
        filteredAssignmentHistory,
        assignmentHistoryPage,
        assignmentHistoryPageSize,
      ),
    [assignmentHistoryPage, assignmentHistoryPageSize, filteredAssignmentHistory],
  );

  const allowedRulesStats = useMemo(
    () => [
      buildShowingStat(home?.allowedAnimals || [], allowedRulesPage, allowedRulesPageSize),
      `Activas: ${(home?.allowedAnimals || []).filter((rule) => rule.activo).length}`,
    ],
    [allowedRulesPage, allowedRulesPageSize, home?.allowedAnimals],
  );

  const paginatedAllowedRules = useMemo(
    () => paginateCollection(home?.allowedAnimals || [], allowedRulesPage, allowedRulesPageSize),
    [allowedRulesPage, allowedRulesPageSize, home?.allowedAnimals],
  );

  const homeInventorySummary = useMemo(() => {
    const uniqueItems = new Set(
      homeInventoryExistences
        .map((existence) => existence.itemId)
        .filter(Boolean)
        .map((value) => String(value)),
    );

    return {
      totalExistences: homeInventoryExistences.length,
      totalItems: uniqueItems.size,
      totalStock: homeInventoryExistences.reduce(
        (accumulator, existence) => accumulator + Number(existence.cantidadActual || 0),
        0,
      ),
      totalMovements: homeInventoryMovements.length,
    };
  }, [homeInventoryExistences, homeInventoryMovements]);

  const homeInventoryCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          homeInventoryExistences
            .map((existence) => existence.item?.categoriaNombre || "")
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right, "es")),
    [homeInventoryExistences],
  );

  const filteredHomeInventoryExistences = useMemo(() => {
    const searchTerm = homeInventoryExistenceFilters.search.trim().toLowerCase();

    return homeInventoryExistences.filter((existence) => {
      const haystack = [
        existence.itemNombre,
        existence.item?.categoriaNombre,
        formatLocationLine(existence.location),
        existence.observaciones,
        existence.condicion,
        existence.estado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesCategory =
        !homeInventoryExistenceFilters.category
        || String(existence.item?.categoriaNombre || "") === String(homeInventoryExistenceFilters.category);
      const matchesCondition =
        !homeInventoryExistenceFilters.condition
        || String(existence.condicion || "") === String(homeInventoryExistenceFilters.condition);
      const matchesStatus =
        !homeInventoryExistenceFilters.status
        || String(existence.estado || "") === String(homeInventoryExistenceFilters.status);

      return matchesSearch && matchesCategory && matchesCondition && matchesStatus;
    });
  }, [homeInventoryExistenceFilters, homeInventoryExistences]);

  const homeExistenceStats = useMemo(
    () => [
      `Mostrando ${filteredHomeInventoryExistences.length} de ${homeInventoryExistences.length}`,
      `Items: ${new Set(filteredHomeInventoryExistences.map((existence) => existence.itemId).filter(Boolean)).size}`,
    ],
    [filteredHomeInventoryExistences, homeInventoryExistences.length],
  );

  const homeInventoryMovementTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(homeInventoryMovements.map((movement) => movement.tipoMovimiento).filter(Boolean)),
      ),
    [homeInventoryMovements],
  );

  const filteredHomeInventoryMovements = useMemo(() => {
    const searchTerm = homeInventoryMovementFilters.search.trim().toLowerCase();

    return homeInventoryMovements.filter((movement) => {
      const haystack = [
        movement.itemNombre,
        movement.tipoMovimiento,
        movementLabel(movement.tipoMovimiento),
        movement.observaciones,
        formatLocationLine(movement.sourceLocation),
        formatLocationLine(movement.destinationLocation),
        movement.performedBy?.nombreCompleto,
        movement.performedBy?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      const matchesType =
        !homeInventoryMovementFilters.type
        || String(movement.tipoMovimiento || "") === String(homeInventoryMovementFilters.type);

      return matchesSearch && matchesType;
    });
  }, [homeInventoryMovementFilters, homeInventoryMovements]);

  const homeMovementStats = useMemo(
    () => [
      `Mostrando ${filteredHomeInventoryMovements.length} de ${homeInventoryMovements.length}`,
      `Entradas: ${
        filteredHomeInventoryMovements.filter((movement) => movement.tipoMovimiento === "ENTRADA").length
      }`,
      `Consumos: ${
        filteredHomeInventoryMovements.filter((movement) => movement.tipoMovimiento === "CONSUMO").length
      }`,
      `Salidas: ${
        filteredHomeInventoryMovements.filter((movement) => movement.tipoMovimiento === "SALIDA").length
      }`,
      `Traslados: ${
        filteredHomeInventoryMovements.filter((movement) => movement.tipoMovimiento === "TRASLADO").length
      }`,
    ],
    [filteredHomeInventoryMovements, homeInventoryMovements.length],
  );

  const paginatedHomeInventoryMovements = useMemo(
    () =>
      paginateCollection(
        filteredHomeInventoryMovements,
        homeInventoryMovementPage,
        homeInventoryMovementPageSize,
      ),
    [
      filteredHomeInventoryMovements,
      homeInventoryMovementPage,
      homeInventoryMovementPageSize,
    ],
  );

  function resetHomeInventoryExistenceFilters() {
    setHomeInventoryExistenceFilters({
      search: "",
      category: "",
      condition: "",
      status: "",
    });
  }

  function resetAssignmentHistoryFilters() {
    setAssignmentHistoryFilters({
      search: "",
      status: "",
    });
    setAssignmentHistoryPage(1);
  }

  function resetHomeInventoryMovementFilters() {
    setHomeInventoryMovementFilters({
      search: "",
      type: "",
    });
    setHomeInventoryMovementPage(1);
  }

  const loadHomeInventory = useCallback(async () => {
    if (!canReadHomeInventory || !homeLocationId) {
      setHomeInventoryExistences([]);
      setHomeInventoryMovements([]);
      setHomeInventoryError("");
      return;
    }

    setHomeInventoryLoading(true);
    setHomeInventoryError("");

    try {
      const [existences, movements] = await Promise.all([
        canReadHomeInventoryExistences
          ? getInventoryExistences({ location_id: homeLocationId })
          : Promise.resolve([]),
        canReadHomeInventoryMovements
          ? getInventoryMovements({ location_id: homeLocationId })
          : Promise.resolve([]),
      ]);

      setHomeInventoryExistences(existences);
      setHomeInventoryMovements(movements);
    } catch (error) {
      setHomeInventoryError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el inventario del hogar temporal.",
      );
    } finally {
      setHomeInventoryLoading(false);
    }
  }, [
    canReadHomeInventory,
    canReadHomeInventoryExistences,
    canReadHomeInventoryMovements,
    homeLocationId,
  ]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || "animales");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (activeTab !== "insumos") return;
    void loadHomeInventory();
  }, [activeTab, loadHomeInventory]);

  useEffect(() => {
    setActiveAssignmentsPage(1);
    setAssignmentHistoryPage(1);
    setAllowedRulesPage(1);
    setHomeInventoryMovementPage(1);
  }, [home?.id]);

  const closeAssignModal = (force = false) => {
    if (isAssigning && !force) return;
    setIsAssignModalOpen(false);
    setAssignmentForm(createEmptyAssignmentForm());
    setEligibleAnimals([]);
    setAssignmentError("");
  };

  const closeCloseModal = (force = false) => {
    if (isClosingAssignment && !force) return;
    setIsCloseModalOpen(false);
    setSelectedAssignment(null);
    setCloseForm(createEmptyCloseForm());
    setCloseError("");
  };

  const closeRuleModal = (force = false) => {
    if (isSavingRule && !force) return;
    setIsRuleModalOpen(false);
    setRuleModalMode("create");
    setEditingRuleId(null);
    setRuleForm(createEmptyRuleForm());
    setRuleForms([createEmptyBulkRuleForm()]);
    setRuleError("");
  };

  const closeObservationModal = (force = false) => {
    if (isSavingObservation && !force) return;
    setIsObservationModalOpen(false);
    setObservationText("");
    setObservationError("");
  };

  const closeInventoryOperationModal = (force = false) => {
    if (isSubmittingInventoryOperation && !force) return;
    setInventoryOperationMode("");
    setSelectedInventoryExistence(null);
    setInventoryOperationForm(emptyInventoryOperationForm());
    setInventoryOperationError("");
  };

  const closeEditHomeModal = (force = false) => {
    if (isSavingHome && !force) return;
    setIsEditHomeModalOpen(false);
    setHomeForm(emptyHomeForm());
    setHomeFormError("");
  };

  const openAssignModal = async () => {
    setAssignmentError("");
    setIsAssignModalOpen(true);
    setEligibleAnimalsLoading(true);
    setAssignmentForm(createEmptyAssignmentForm());

    try {
      setEligibleAnimals(await getEligibleFosterHomeAnimals(id));
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los animales elegibles.",
      );
    } finally {
      setEligibleAnimalsLoading(false);
    }
  };

  const openCloseModal = (assignment, status) => {
    setSelectedAssignment(assignment);
    setCloseForm(createEmptyCloseForm(status));
    setCloseError("");
    setIsCloseModalOpen(true);
  };

  const openEditHomeModal = async () => {
    setHomeFormError("");
    setIsPreparingEditModal(true);
    setIsEditHomeModalOpen(true);

    try {
      await ensureFormOptionsLoaded();
      setHomeForm(homeToForm(home));
    } catch (error) {
      setHomeFormError(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la edición del hogar temporal.",
      );
    } finally {
      setIsPreparingEditModal(false);
    }
  };

  const openCreateRuleModal = () => {
    setRuleModalMode("create");
    setEditingRuleId(null);
    setRuleForm(createEmptyRuleForm());
    setRuleForms([createEmptyBulkRuleForm()]);
    setRuleError("");
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule) => {
    setRuleModalMode("edit");
    setEditingRuleId(rule.id);
    setRuleForm({
      especie: rule.especie || "",
      estadoPermitido: rule.estadoPermitido || "",
      capacidadMaxima:
        rule.capacidadMaxima === null || rule.capacidadMaxima === undefined
          ? ""
          : String(rule.capacidadMaxima),
      observaciones: rule.observaciones || "",
      activo: Boolean(rule.activo),
    });
    setRuleError("");
    setIsRuleModalOpen(true);
  };

  const handleAddRuleRow = () => {
    setRuleForms((currentValue) => [...currentValue, createEmptyBulkRuleForm()]);
  };

  const handleRemoveRuleRow = (index) => {
    setRuleForms((currentValue) => {
      if (currentValue.length <= 1) {
        return currentValue;
      }

      return currentValue.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleRuleRowChange = (index, field, value) => {
    setRuleForms((currentValue) =>
      currentValue.map((row, currentIndex) =>
        currentIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  };

  const handleSubmitHomeEdit = async (event) => {
    event.preventDefault();
    setHomeFormError("");

    const validationError = validateHomeForm(homeForm);
    if (validationError) {
      setHomeFormError(validationError);
      return;
    }

    setIsSavingHome(true);

    try {
      await updateFosterHome(id, buildHomePayload(homeForm));
      await loadHome();
      closeEditHomeModal(true);
    } catch (error) {
      setHomeFormError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el hogar temporal.",
      );
    } finally {
      setIsSavingHome(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const isResponsible = String(member.user?.id) === String(home.responsableUsuarioId);
    if (isResponsible) {
      setHomeError("No puedes eliminar al responsable sin antes asignar otro responsable.");
      return;
    }

    const confirmed = window.confirm(
      `Deseas quitar a ${getUserFullName(member.user)} del hogar temporal?`,
    );
    if (!confirmed) return;

    const nextAssociatedUsers = home.usuariosAsociados.filter(
      (userId) => String(userId) !== String(member.user?.id),
    );

    try {
      await updateFosterHome(home.id, {
        usuarios_asociados: nextAssociatedUsers,
        responsable_usuario_id: Number(home.responsableUsuarioId),
      });
      await loadHome();
    } catch (error) {
      setHomeError(
        error instanceof Error
          ? error.message
          : "No se pudo quitar el miembro del hogar temporal.",
      );
    }
  };

  const handleSubmitAssignment = async (event) => {
    event.preventDefault();
    setAssignmentError("");

    if (!assignmentForm.animal_id) {
      setAssignmentError("Debes seleccionar un animal elegible.");
      return;
    }

    setIsAssigning(true);

    try {
      await createFosterAssignment({
        hogar_temporal_id: Number(id),
        animal_id: Number(assignmentForm.animal_id),
        fecha_inicio: assignmentForm.fecha_inicio,
        observaciones: assignmentForm.observaciones.trim(),
      });

      await loadHome();
      closeAssignModal(true);
    } catch (error) {
      setAssignmentError(
        error instanceof Error ? error.message : "No se pudo crear la asignación.",
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSubmitCloseAssignment = async (event) => {
    event.preventDefault();
    setCloseError("");

    if (!selectedAssignment) {
      setCloseError("No hay una asignación seleccionada.");
      return;
    }

    if (!closeForm.fecha_fin) {
      setCloseError("Debes indicar la fecha de término.");
      return;
    }

    setIsClosingAssignment(true);

    try {
      await updateFosterAssignment(selectedAssignment.id, {
        estado: closeForm.estado,
        fecha_fin: closeForm.fecha_fin,
        motivo_termino: closeForm.motivo_termino.trim(),
        observaciones: closeForm.observaciones.trim(),
      });
      await loadHome();
      closeCloseModal(true);
    } catch (error) {
      setCloseError(
        error instanceof Error ? error.message : "No se pudo cerrar la asignación.",
      );
    } finally {
      setIsClosingAssignment(false);
    }
  };

  const handleSubmitRule = async (event) => {
    event.preventDefault();
    setRuleError("");

    const validationError =
      ruleModalMode === "create"
        ? validateRuleForms(ruleForms)
        : validateRuleForm(ruleForm);

    if (validationError) {
      setRuleError(validationError);
      return;
    }

    setIsSavingRule(true);

    try {
      if (ruleModalMode === "create") {
        await Promise.all(
          ruleForms.map((form) =>
            createFosterHomeAllowedAnimal({
              foster_home_id: Number(id),
              ...buildRulePayload({
                ...form,
                observaciones: "",
              }),
            }),
          ),
        );
      } else {
        await updateFosterHomeAllowedAnimal(editingRuleId, buildRulePayload(ruleForm));
      }

      await loadHome();
      closeRuleModal(true);
    } catch (error) {
      setRuleError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la regla de animal permitido.",
      );
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    const confirmed = window.confirm("Deseas eliminar esta regla de animal permitido?");
    if (!confirmed) return;

    try {
      await deleteFosterHomeAllowedAnimal(rule.id);
      await loadHome();
    } catch (error) {
      setHomeError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la regla de animal permitido.",
      );
    }
  };

  const handleCreateObservation = async (event) => {
    event.preventDefault();
    setObservationError("");

    if (!observationText.trim()) {
      setObservationError("Debes escribir una observación.");
      return;
    }

    setIsSavingObservation(true);

    try {
      await createFosterHomeObservation({
        foster_home_id: Number(id),
        texto: observationText.trim(),
      });
      await loadHome();
      closeObservationModal(true);
    } catch (error) {
      setObservationError(
        error instanceof Error
          ? error.message
          : "No se pudo crear la observación.",
      );
    } finally {
      setIsSavingObservation(false);
    }
  };

  const handleDeleteObservation = async (observation) => {
    const confirmed = window.confirm("Deseas eliminar esta observación?");
    if (!confirmed) return;

    try {
      await deleteFosterHomeObservation(observation.id);
      await loadHome();
    } catch (error) {
      setHomeError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la observación.",
      );
    }
  };

  const openInventoryOperationModal = (mode, existence) => {
    setInventoryOperationMode(mode);
    setSelectedInventoryExistence(existence);
    setInventoryOperationForm(emptyInventoryOperationForm(existence));
    setInventoryOperationError("");
  };

  const handleSubmitInventoryOperation = async (event) => {
    event.preventDefault();
    const quantity = parsePositiveDecimal(inventoryOperationForm.cantidad);

    if (!selectedInventoryExistence?.id) {
      setInventoryOperationError("Debes seleccionar una existencia válida.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setInventoryOperationError("Debes ingresar una cantidad decimal mayor a 0.");
      return;
    }
    if (quantity > Number(selectedInventoryExistence.cantidadActual || 0)) {
      setInventoryOperationError("La cantidad no puede exceder el stock disponible.");
      return;
    }
    if (inventoryOperationMode === "exit" && !inventoryOperationForm.motivo.trim()) {
      setInventoryOperationError("Debes ingresar un motivo para la salida.");
      return;
    }

    setIsSubmittingInventoryOperation(true);
    setInventoryOperationError("");
    setHomeInventoryFeedback("");

    try {
      if (inventoryOperationMode === "consume") {
        await consumeInventory({
          existencia_id: Number(selectedInventoryExistence.id),
          cantidad: quantity,
          observaciones: inventoryOperationForm.observaciones.trim() || null,
        });
      } else if (inventoryOperationMode === "exit") {
        await exitInventory({
          existencia_id: Number(selectedInventoryExistence.id),
          cantidad: quantity,
          motivo: inventoryOperationForm.motivo.trim(),
          observaciones: inventoryOperationForm.observaciones.trim() || null,
        });
      }

      setHomeInventoryFeedback(
        inventoryOperationMode === "consume"
          ? "Consumo registrado correctamente."
          : "Salida registrada correctamente.",
      );
      await loadHomeInventory();
      closeInventoryOperationModal(true);
    } catch (error) {
      setInventoryOperationError(
        error instanceof Error ? error.message : "No se pudo registrar la operación.",
      );
    } finally {
      setIsSubmittingInventoryOperation(false);
    }
  };

  if (homeLoading) {
    return (
      <section className="main-content home-content foster-home-page">
        <p className="foster-muted">Cargando detalle del hogar temporal...</p>
      </section>
    );
  }

  if (homeError || !home) {
    return (
      <section className="main-content home-content foster-home-page">
        <PageBreadcrumb
          moduleLabel="Hogares temporales"
          moduleTo="/hogar-temporal"
          currentLabel="Detalle"
        />
        <p className="error-text">{homeError || "No se encontro el hogar temporal."}</p>
      </section>
    );
  }

  return (
    <section className="main-content home-content foster-home-page">
      <PageBreadcrumb
        moduleLabel="Hogares temporales"
        moduleTo={isOwnHomeOnlyUser ? "" : "/hogar-temporal"}
        currentLabel="Detalle"
      />

      {homeError ? <p className="error-text">{homeError}</p> : null}

      <article className="foster-detail-card foster-detail-hero detail-header-accent">
        <div className="foster-detail-topline">
          <div>
            <h1>{getUserFullName(home.responsableUsuario) || "Hogar temporal"}</h1>
            <p className="foster-section-note">
              {getHomeLocationLabel(home)}
            </p>
          </div>

          <span className={`foster-status-badge ${getHomeStatusClass(home.activo)}`}>
            {home.activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        <div className="foster-detail-grid-items">
          <div className="foster-detail-item">
            <span>Responsable</span>
            <strong>{getUserFullName(home.responsableUsuario)}</strong>
          </div>
          <div className="foster-detail-item">
            <span>Teléfono</span>
            <strong>{home.responsableUsuario?.telefono || "Sin teléfono"}</strong>
          </div>
          <div className="foster-detail-item">
            <span>Email</span>
            <strong>{home.responsableUsuario?.email || "Sin email"}</strong>
          </div>
          <div className="foster-detail-item">
            <span>Rescatados actuales</span>
            <strong>{home.activeAssignmentsCount || 0}</strong>
          </div>
        </div>
      </article>

      <div className="home-tabs foster-detail-tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`home-tab-button ${activeTab === tab.id ? "home-tab-button-active" : ""}`.trim()}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "animales" ? (
        <div className="foster-detail-stack-layout">
          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Rescatados actuales</h3>
                <p>Animales actualmente alojados en este hogar temporal.</p>
              </div>
              {canCreateAssignment && home.activo ? (
                <button type="button" className="btn btn-primary" onClick={openAssignModal}>
                  Asignar animal
                </button>
              ) : null}
            </div>

            {home.activeAssignments.length === 0 ? (
              <p className="foster-muted">No hay asignaciones activas para este hogar.</p>
            ) : (
              <>
                <FilterSummaryBar  showClearButton={false} />
                <div className="table-scroll">
                  <table className="crud-table foster-assignment-table">
                    <thead>
                      <tr>
                        <th>Animal</th>
                        <th>Especie</th>
                        <th>Salud / adopción</th>
                        <th>Fecha de inicio</th>
                        <th>Dias en hogar</th>
                        <th>Estado</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedActiveAssignments.items.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            <div className="foster-meta-stack">
                              <strong className="foster-meta-title">
                                {assignment.animal?.nombre || "Sin nombre"}
                              </strong>
                              <span className="foster-muted">
                                ID animal: {assignment.animal?.id || "Sin id"}
                              </span>
                            </div>
                          </td>
                          <td>{formatEnumLabel(assignment.animal?.especie)}</td>
                          <td>
                            {formatEnumLabel(assignment.animal?.estadoSalud)}
                            {" / "}
                            {formatEnumLabel(assignment.animal?.estadoAdopcion)}
                          </td>
                          <td>{formatDate(assignment.fechaInicio)}</td>
                          <td>{getDaysInHome(assignment.fechaInicio)}</td>
                          <td>
                            <span
                              className={`foster-status-badge ${getAssignmentStatusClass(assignment.estado)}`}
                            >
                              {formatEnumLabel(assignment.estado)}
                            </span>
                          </td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              {assignment.animal?.id ? (
                                <IconButton
                                  icon={Eye}
                                  label={`Ver detalle del animal ${assignment.animal.nombre || ""}`.trim()}
                                  variant="secondary"
                                  onClick={() => navigate(`/rescatados/${assignment.animal.id}`)}
                                />
                              ) : null}
                              {canUpdateAssignment ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-small"
                                  onClick={() => openCloseModal(assignment, "FINALIZADO")}
                                >
                                  Finalizar
                                </button>
                              ) : null}
                              {canUpdateAssignment ? (
                                <IconButton
                                  icon={ArrowRightLeft}
                                  label="Trasladar asignación"
                                  variant="primary"
                                  onClick={() => openCloseModal(assignment, "TRASLADADO")}
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
                  page={activeAssignmentsPage}
                  pageSize={activeAssignmentsPageSize}
                  totalItems={home.activeAssignments.length}
                  onPageChange={setActiveAssignmentsPage}
                  onPageSizeChange={(value) => {
                    setActiveAssignmentsPageSize(value);
                    setActiveAssignmentsPage(1);
                  }}
                />
              </>
            )}
          </section>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Historial de asignaciones</h3>
                <p>Asignaciones finalizadas o trasladadas de este hogar temporal.</p>
              </div>
            </div>

            {home.assignmentHistory.length === 0 ? (
              <p className="foster-muted">No hay historial disponible para este hogar.</p>
            ) : filteredAssignmentHistory.length === 0 ? (
              <>
                <div className="foster-filter-grid foster-table-tools">
                  <label className="foster-filter-field">
                    <span>Buscar</span>
                    <input
                      type="search"
                      value={assignmentHistoryFilters.search}
                      onChange={(event) => {
                        setAssignmentHistoryFilters((current) => ({
                          ...current,
                          search: event.target.value,
                        }));
                        setAssignmentHistoryPage(1);
                      }}
                      placeholder="Animal, especie, estado, motivo u observaciones"
                    />
                  </label>

                  <label className="foster-filter-field">
                    <span>Estado</span>
                    <select
                      value={assignmentHistoryFilters.status}
                      onChange={(event) => {
                        setAssignmentHistoryFilters((current) => ({
                          ...current,
                          status: event.target.value,
                        }));
                        setAssignmentHistoryPage(1);
                      }}
                    >
                      <option value="">Todos</option>
                      {assignmentHistoryStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatEnumLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <FilterSummaryBar
                  stats={assignmentHistoryStats}
                  onClear={resetAssignmentHistoryFilters}
                />
                <p className="foster-muted">
                  No hay asignaciones que coincidan con los filtros actuales.
                </p>
              </>
            ) : (
              <>
                <div className="foster-filter-grid foster-table-tools">
                  <label className="foster-filter-field">
                    <span>Buscar</span>
                    <input
                      type="search"
                      value={assignmentHistoryFilters.search}
                      onChange={(event) => {
                        setAssignmentHistoryFilters((current) => ({
                          ...current,
                          search: event.target.value,
                        }));
                        setAssignmentHistoryPage(1);
                      }}
                      placeholder="Animal, especie, estado, motivo u observaciones"
                    />
                  </label>

                  <label className="foster-filter-field">
                    <span>Estado</span>
                    <select
                      value={assignmentHistoryFilters.status}
                      onChange={(event) => {
                        setAssignmentHistoryFilters((current) => ({
                          ...current,
                          status: event.target.value,
                        }));
                        setAssignmentHistoryPage(1);
                      }}
                    >
                      <option value="">Todos</option>
                      {assignmentHistoryStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatEnumLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <FilterSummaryBar
                  stats={assignmentHistoryStats}
                  onClear={resetAssignmentHistoryFilters}
                />
                <div className="table-scroll">
                  <table className="crud-table foster-assignment-table">
                    <thead>
                      <tr>
                        <th>Animal</th>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Estado</th>
                        <th>Motivo</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssignmentHistory.items.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            <div className="foster-meta-stack">
                              <strong className="foster-meta-title">
                                {assignment.animal?.nombre || "Sin nombre"}
                              </strong>
                              <span className="foster-muted">
                                {formatEnumLabel(assignment.animal?.especie)}
                              </span>
                            </div>
                          </td>
                          <td>{formatDate(assignment.fechaInicio)}</td>
                          <td>{formatDate(assignment.fechaFin)}</td>
                          <td>
                            <span
                              className={`foster-status-badge ${getAssignmentStatusClass(assignment.estado)}`}
                            >
                              {formatEnumLabel(assignment.estado)}
                            </span>
                          </td>
                          <td>{assignment.motivoTermino || "Sin motivo"}</td>
                          <td>{assignment.observaciones || "Sin observaciones"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={assignmentHistoryPage}
                  pageSize={assignmentHistoryPageSize}
                  totalItems={filteredAssignmentHistory.length}
                  onPageChange={setAssignmentHistoryPage}
                  onPageSizeChange={(value) => {
                    setAssignmentHistoryPageSize(value);
                    setAssignmentHistoryPage(1);
                  }}
                />
              </>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "hogar" ? (
        <div className="foster-detail-stack-layout">
          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Miembros del hogar temporal</h3>
                <p>Usuarios asociados actualmente al hogar.</p>
              </div>
              {canUpdateHome ? (
                <IconButton
                  icon={Pencil}
                  label="Editar hogar temporal"
                  variant="secondary"
                  onClick={openEditHomeModal}
                />
              ) : null}
            </div>

            <div className="table-scroll">
              <table className="crud-table foster-member-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Apellido</th>
                    <th>Teléfono</th>
                    <th>Responsable</th>
                    <th className="table-actions-header">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => {
                    const isResponsible = String(member.user?.id) === String(home.responsableUsuarioId);

                    return (
                      <tr key={member.id}>
                        <td>{member.user?.nombre || "Sin nombre"}</td>
                        <td>{member.user?.apellido || "Sin apellido"}</td>
                        <td>{member.user?.telefono || "Sin teléfono"}</td>
                        <td>
                          <span className={`foster-status-badge ${isResponsible ? "foster-status-active" : "foster-status-inactive"}`}>
                            {isResponsible ? "Si" : "No"}
                          </span>
                        </td>
                        <td className="table-actions-cell">
                          {canUpdateHome ? (
                            <IconButton
                              icon={UserMinus}
                              label={`Quitar miembro ${member.user?.nombre || ""} ${member.user?.apellido || ""}`.trim()}
                              variant="warning"
                              disabled={isResponsible}
                              onClick={() => handleRemoveMember(member)}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Reglas de animales permitidos</h3>
                <p>Gestiona compatibilidad, cupos y estado de cada regla.</p>
              </div>
              {canUpdateHome ? (
                <button type="button" className="btn btn-primary" onClick={openCreateRuleModal}>
                  Crear regla
                </button>
              ) : null}
            </div>

            {home.allowedAnimals.length === 0 ? (
              <p className="foster-muted">Este hogar temporal aun no tiene reglas configuradas.</p>
            ) : (
              <>
                <FilterSummaryBar stats={allowedRulesStats} showClearButton={false} />
                <div className="table-scroll">
                  <table className="crud-table foster-rule-table">
                    <thead>
                      <tr>
                        <th>Especie</th>
                        <th>Estado permitido</th>
                        <th>Capacidad maxima</th>
                        <th>Observaciones</th>
                        <th>Estado de la regla</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAllowedRules.items.map((rule) => (
                        <tr key={rule.id}>
                          <td>{formatEnumLabel(rule.especie)}</td>
                          <td>{formatEnumLabel(rule.estadoPermitido)}</td>
                          <td>{rule.capacidadMaxima ?? "Sin limite"}</td>
                          <td className="foster-long-cell">{rule.observaciones || "Sin observaciones"}</td>
                          <td>
                            <span className={`foster-status-badge ${rule.activo ? "foster-status-active" : "foster-status-inactive"}`}>
                              {rule.activo ? "Activa" : "Inactiva"}
                            </span>
                          </td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              {canUpdateHome ? (
                                <IconButton
                                  icon={Pencil}
                                  label="Editar regla"
                                  variant="secondary"
                                  onClick={() => openEditRuleModal(rule)}
                                />
                              ) : null}
                              {canDeleteRule ? (
                                <IconButton
                                  icon={Trash2}
                                  label="Eliminar regla"
                                  variant="danger"
                                  onClick={() => handleDeleteRule(rule)}
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
                  page={allowedRulesPage}
                  pageSize={allowedRulesPageSize}
                  totalItems={home.allowedAnimals.length}
                  onPageChange={setAllowedRulesPage}
                  onPageSizeChange={(value) => {
                    setAllowedRulesPageSize(value);
                    setAllowedRulesPage(1);
                  }}
                />
              </>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "insumos" ? (
        <div className="foster-detail-stack-layout">
          {!home.location ? (
            <section className="crud-card">
              <div className="foster-card-header">
                <div>
                  <h3>Inventario del hogar</h3>
                  <p>Stock y movimientos operativos asociados a la ubicación real del hogar temporal.</p>
                </div>
              </div>
              <p className="foster-muted">
                No hay una ubicación asociada a este hogar temporal.
              </p>
            </section>
          ) : (
            <>
              {homeInventoryFeedback ? (
                <p className="inventory-success-banner">{homeInventoryFeedback}</p>
              ) : null}
              {homeInventoryError ? <p className="error-text">{homeInventoryError}</p> : null}

              <section className="crud-card">
                <div className="foster-card-header">
                  <div>
                    <h3>Existencias del hogar</h3>
                  </div>
                </div>

                {!canReadHomeInventoryExistences ? (
                  <p className="foster-muted">
                    No tienes permisos para ver las existencias de este hogar.
                  </p>
                ) : homeInventoryLoading ? (
                  <p className="foster-muted">Cargando existencias del hogar...</p>
                ) : homeInventoryExistences.length === 0 ? (
                  <p className="foster-muted">No hay existencias registradas para la ubicación del hogar.</p>
                ) : (
                  <>
                    <div className="settings-filter-grid inventory-filter-grid">
                      <label className="settings-filter-field">
                        <span>Buscar</span>
                        <input
                          type="search"
                          value={homeInventoryExistenceFilters.search}
                          onChange={(event) =>
                            setHomeInventoryExistenceFilters((current) => ({
                              ...current,
                              search: event.target.value,
                            }))
                          }
                          placeholder="Item, categoria, condicion u observaciones"
                        />
                      </label>
                      <label className="settings-filter-field">
                        <span>Categoria</span>
                        <select
                          value={homeInventoryExistenceFilters.category}
                          onChange={(event) =>
                            setHomeInventoryExistenceFilters((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                        >
                          <option value="">Todas</option>
                          {homeInventoryCategoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="settings-filter-field">
                        <span>Condicion</span>
                        <select
                          value={homeInventoryExistenceFilters.condition}
                          onChange={(event) =>
                            setHomeInventoryExistenceFilters((current) => ({
                              ...current,
                              condition: event.target.value,
                            }))
                          }
                        >
                          <option value="">Todas</option>
                          {Array.from(
                            new Set(homeInventoryExistences.map((existence) => existence.condicion).filter(Boolean)),
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
                          value={homeInventoryExistenceFilters.status}
                          onChange={(event) =>
                            setHomeInventoryExistenceFilters((current) => ({
                              ...current,
                              status: event.target.value,
                            }))
                          }
                        >
                          <option value="">Todos</option>
                          {Array.from(
                            new Set(homeInventoryExistences.map((existence) => existence.estado).filter(Boolean)),
                          ).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <FilterSummaryBar
                      stats={homeExistenceStats}
                      onClear={resetHomeInventoryExistenceFilters}
                    />
                    <div className="table-scroll">
                      <table className="crud-table foster-table foster-home-inventory-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Categoria</th>
                            <th>Unidad</th>
                            <th>Cantidad actual</th>
                            <th>Fecha de vencimiento</th>
                            <th>Fecha de apertura</th>
                            <th>Condicion</th>
                            <th>Estado</th>
                            <th>Observaciones</th>
                            <th className="table-actions-header">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHomeInventoryExistences.map((existence) => (
                            <tr key={existence.id}>
                              <td>{existence.itemNombre || "Sin item"}</td>
                              <td>{existence.item?.categoriaNombre || "Sin categoria"}</td>
                              <td>{existence.item?.unidadMedidaNombre || "Sin unidad"}</td>
                              <td>{formatQuantity(existence.cantidadActual)}</td>
                              <td>{formatDate(existence.fechaVencimiento)}</td>
                              <td>{formatDate(existence.fechaApertura)}</td>
                              <td>{existence.condicion || "Sin condicion"}</td>
                              <td>{existence.estado || "Sin estado"}</td>
                              <td>{existence.observaciones || "Sin observaciones"}</td>
                              <td className="table-actions-cell">
                                <div className="row-actions table-actions foster-inventory-actions">
                                  {canOperateHomeInventory ? (
                                    <IconButton
                                      icon={PackageMinus}
                                      label="Consumir inventario del hogar temporal"
                                      variant="warning"
                                      onClick={() => openInventoryOperationModal("consume", existence)}
                                    />
                                  ) : null}
                                  {canRegisterHomeExit ? (
                                    <IconButton
                                      icon={ArrowRightFromLine}
                                      label="Registrar salida de inventario"
                                      variant="secondary"
                                      onClick={() => openInventoryOperationModal("exit", existence)}
                                    />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              <section className="crud-card">
                <div className="foster-card-header">
                  <div>
                    <h3>Historial de movimientos</h3>
                    <p>Movimientos asociados a la ubicación del hogar temporal.</p>
                  </div>
                </div>

                {!canReadHomeInventoryMovements ? (
                  <p className="foster-muted">
                    No tienes permisos para ver los movimientos de este hogar.
                  </p>
                ) : homeInventoryLoading ? (
                  <p className="foster-muted">Cargando movimientos del hogar...</p>
                ) : homeInventoryMovements.length === 0 ? (
                  <p className="foster-muted">No hay movimientos registrados para esta ubicación.</p>
                ) : filteredHomeInventoryMovements.length === 0 ? (
                  <>
                    <div className="foster-filter-grid foster-table-tools">
                      <label className="foster-filter-field">
                        <span>Buscar</span>
                        <input
                          type="search"
                          value={homeInventoryMovementFilters.search}
                          onChange={(event) => {
                            setHomeInventoryMovementFilters((current) => ({
                              ...current,
                              search: event.target.value,
                            }));
                            setHomeInventoryMovementPage(1);
                          }}
                          placeholder="Item, tipo, observaciones, origen, destino o usuario"
                        />
                      </label>

                      <label className="foster-filter-field">
                        <span>Tipo de movimiento</span>
                        <select
                          value={homeInventoryMovementFilters.type}
                          onChange={(event) => {
                            setHomeInventoryMovementFilters((current) => ({
                              ...current,
                              type: event.target.value,
                            }));
                            setHomeInventoryMovementPage(1);
                          }}
                        >
                          <option value="">Todos los tipos</option>
                          {homeInventoryMovementTypeOptions.map((movementType) => (
                            <option key={movementType} value={movementType}>
                              {movementLabel(movementType)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <FilterSummaryBar
                      stats={homeMovementStats}
                      onClear={resetHomeInventoryMovementFilters}
                    />
                    <p className="foster-muted">
                      No hay movimientos que coincidan con los filtros actuales.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="foster-filter-grid foster-table-tools">
                      <label className="foster-filter-field">
                        <span>Buscar</span>
                        <input
                          type="search"
                          value={homeInventoryMovementFilters.search}
                          onChange={(event) => {
                            setHomeInventoryMovementFilters((current) => ({
                              ...current,
                              search: event.target.value,
                            }));
                            setHomeInventoryMovementPage(1);
                          }}
                          placeholder="Item, tipo, observaciones, origen, destino o usuario"
                        />
                      </label>

                      <label className="foster-filter-field">
                        <span>Tipo de movimiento</span>
                        <select
                          value={homeInventoryMovementFilters.type}
                          onChange={(event) => {
                            setHomeInventoryMovementFilters((current) => ({
                              ...current,
                              type: event.target.value,
                            }));
                            setHomeInventoryMovementPage(1);
                          }}
                        >
                          <option value="">Todos los tipos</option>
                          {homeInventoryMovementTypeOptions.map((movementType) => (
                            <option key={movementType} value={movementType}>
                              {movementLabel(movementType)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <FilterSummaryBar
                      stats={homeMovementStats}
                      onClear={resetHomeInventoryMovementFilters}
                    />
                    <div className="table-scroll">
                      <table className="crud-table foster-table foster-home-movement-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Item</th>
                            <th>Cantidad</th>
                            <th>Origen</th>
                            <th>Destino</th>
                            <th>Observaciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedHomeInventoryMovements.items.map((movement) => (
                            <tr key={movement.id}>
                              <td>{formatDate(movement.fechaMovimiento)}</td>
                              <td>{movementLabel(movement.tipoMovimiento)}</td>
                              <td>{movement.itemNombre || "Sin item"}</td>
                              <td>{formatQuantity(movement.cantidad)}</td>
                              <td>{formatLocationLine(movement.sourceLocation)}</td>
                              <td>{formatLocationLine(movement.destinationLocation)}</td>
                              <td>{movement.observaciones || "Sin observaciones"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControls
                      page={homeInventoryMovementPage}
                      pageSize={homeInventoryMovementPageSize}
                      totalItems={filteredHomeInventoryMovements.length}
                      onPageChange={setHomeInventoryMovementPage}
                      onPageSizeChange={(value) => {
                        setHomeInventoryMovementPageSize(value);
                        setHomeInventoryMovementPage(1);
                      }}
                    />
                  </>
                )}
              </section>
            </>
          )}
        </div>
      ) : null}

      {activeTab === "observaciones" ? (
        <section className="crud-card">
          <div className="foster-card-header">
            <div>
              <h3>Observaciones del hogar temporal</h3>
              <p>Registro estructurado de observaciones y notas relevantes del hogar.</p>
            </div>
            {canUpdateHome ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setObservationError("");
                  setObservationText("");
                  setIsObservationModalOpen(true);
                }}
              >
                Crear observación
              </button>
            ) : null}
          </div>

          <div className="foster-observation-grid">
            {home.generalObservaciones ? (
              <article className="foster-observation-card foster-observation-card-static">
                <div className="foster-card-header">
                  <div>
                    <h4>Observación general</h4>
                    <p>Resumen general configurable desde la edición del hogar.</p>
                  </div>
                </div>
                <p>{home.generalObservaciones}</p>
              </article>
            ) : null}

            {home.observationItems.map((observation, index) => (
              <article key={observation.id} className="foster-observation-card">
                <div className="foster-card-header">
                  <div>
                    <h4>Observacion {index + 1}</h4>
                    <p>{formatDate(observation.createdAt?.slice(0, 10) || "")}</p>
                  </div>
                  {canUpdateHome ? (
                    <IconButton
                      icon={Trash2}
                      label="Eliminar observación del hogar temporal"
                      variant="danger"
                      onClick={() => handleDeleteObservation(observation)}
                    />
                  ) : null}
                </div>
                <p>{observation.texto}</p>
              </article>
            ))}

            {!home.generalObservaciones && home.observationItems.length === 0 ? (
              <p className="foster-muted">No hay observaciones registradas para este hogar.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {inventoryOperationMode ? (
        <div className="modal-overlay" onClick={() => closeInventoryOperationModal()}>
          <div
            className="event-modal foster-modal foster-modal-medium"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <div>
                <h3>
                  {inventoryOperationMode === "consume"
                    ? "Consumir existencia"
                    : "Registrar salida"}
                </h3>
                <p className="foster-section-note">
                  Operación puntual sobre la existencia seleccionada del hogar temporal.
                </p>
              </div>
              <ModalCloseButton onClick={() => closeInventoryOperationModal()} />
            </div>

            {inventoryOperationError ? <p className="error-text">{inventoryOperationError}</p> : null}

            <form className="foster-modal-body" onSubmit={handleSubmitInventoryOperation}>
              <section className="foster-form-section">
                <div className="foster-form-grid">
                  <label className="foster-section-field">
                    <span>Existencia</span>
                    <input
                      type="text"
                      value={selectedInventoryExistence?.id ? `#${selectedInventoryExistence.id}` : ""}
                      readOnly
                    />
                  </label>

                  <label className="foster-section-field">
                    <span>Stock actual</span>
                    <input
                      type="text"
                      value={
                        selectedInventoryExistence
                          ? formatQuantity(selectedInventoryExistence.cantidadActual)
                          : ""
                      }
                      readOnly
                    />
                  </label>

                  <label className="foster-section-field">
                    <span>Cantidad</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={inventoryOperationForm.cantidad}
                      onChange={(event) =>
                        setInventoryOperationForm((current) => ({
                          ...current,
                          cantidad: event.target.value,
                        }))
                      }
                    />
                  </label>

                  {inventoryOperationMode === "exit" ? (
                    <label className="foster-section-field">
                      <span>Motivo</span>
                      <input
                        type="text"
                        value={inventoryOperationForm.motivo}
                        onChange={(event) =>
                          setInventoryOperationForm((current) => ({
                            ...current,
                            motivo: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}

                  <label className="foster-section-field full">
                    <span>Observaciones</span>
                    <textarea
                      rows="4"
                      value={inventoryOperationForm.observaciones}
                      onChange={(event) =>
                        setInventoryOperationForm((current) => ({
                          ...current,
                          observaciones: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeInventoryOperationModal()}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingInventoryOperation}
                >
                  {isSubmittingInventoryOperation
                    ? "Guardando..."
                    : inventoryOperationMode === "consume"
                      ? "Registrar consumo"
                      : "Registrar salida"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FosterHomeFormModal
        isOpen={isEditHomeModalOpen}
        title="Editar hogar temporal"
        submitLabel="Guardar cambios"
        form={homeForm}
        setForm={setHomeForm}
        users={users}
        error={homeFormError}
        isSaving={isSavingHome}
        isPreparing={isPreparingEditModal}
        onClose={closeEditHomeModal}
        onSubmit={handleSubmitHomeEdit}
      />

      {isRuleModalOpen ? (
        <div className="modal-overlay" onClick={() => closeRuleModal()}>
          <div className="event-modal foster-modal foster-modal-medium" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <div>
                <h3>{ruleModalMode === "create" ? "Crear reglas permitidas" : "Editar regla"}</h3>
                <p className="foster-section-note">
                  {ruleModalMode === "create"
                    ? "Agrega una o varias reglas nuevas en una sola acción. Las observaciones se podran editar después en cada regla individual."
                    : "Configura especie, estado permitido, cupo y observaciones de la regla."}
                </p>
              </div>
              <ModalCloseButton onClick={() => closeRuleModal()} />
            </div>

            {ruleError ? <p className="error-text">{ruleError}</p> : null}

            <form className="foster-modal-body" onSubmit={handleSubmitRule}>
              <section className="foster-form-section">
                {ruleModalMode === "create" ? (
                  <div className="foster-rule-bulk-editor">
                    <div className="foster-rule-bulk-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={handleAddRuleRow}
                      >
                        + Agregar regla
                      </button>
                    </div>

                    <div className="table-scroll">
                      <table className="crud-table foster-rule-bulk-table">
                        <thead>
                          <tr>
                            <th>Especie</th>
                            <th>Estado permitido</th>
                            <th>Capacidad maxima</th>
                            <th>Activa</th>
                            <th className="table-actions-header">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ruleForms.map((form, index) => (
                            <tr key={`rule-row-${index}`}>
                              <td>
                                <select
                                  value={form.especie}
                                  onChange={(event) =>
                                    handleRuleRowChange(index, "especie", event.target.value)
                                  }
                                >
                                  <option value="">Selecciona una especie</option>
                                  {FOSTER_SPECIES_OPTIONS.map((species) => (
                                    <option key={species} value={species}>
                                      {formatEnumLabel(species)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  value={form.estadoPermitido}
                                  onChange={(event) =>
                                    handleRuleRowChange(index, "estadoPermitido", event.target.value)
                                  }
                                >
                                  <option value="">Selecciona un estado</option>
                                  {FOSTER_ALLOWED_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {formatEnumLabel(status)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  value={form.capacidadMaxima}
                                  onChange={(event) =>
                                    handleRuleRowChange(index, "capacidadMaxima", event.target.value)
                                  }
                                  placeholder="Sin limite"
                                />
                              </td>
                              <td>
                                <select
                                  value={form.activo ? "true" : "false"}
                                  onChange={(event) =>
                                    handleRuleRowChange(index, "activo", event.target.value === "true")
                                  }
                                >
                                  <option value="true">Si</option>
                                  <option value="false">No</option>
                                </select>
                              </td>
                              <td className="table-actions-cell">
                                <div className="foster-rule-row-actions table-actions">
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-small"
                                    onClick={() => handleRemoveRuleRow(index)}
                                    disabled={ruleForms.length === 1}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="foster-rule-grid">
                    <label className="foster-section-field">
                      <span>Especie</span>
                      <select
                        value={ruleForm.especie}
                        onChange={(event) =>
                          setRuleForm((currentValue) => ({
                            ...currentValue,
                            especie: event.target.value,
                          }))
                        }
                      >
                        <option value="">Selecciona una especie</option>
                        {FOSTER_SPECIES_OPTIONS.map((species) => (
                          <option key={species} value={species}>
                            {formatEnumLabel(species)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="foster-section-field">
                      <span>Estado permitido</span>
                      <select
                        value={ruleForm.estadoPermitido}
                        onChange={(event) =>
                          setRuleForm((currentValue) => ({
                            ...currentValue,
                            estadoPermitido: event.target.value,
                          }))
                        }
                      >
                        <option value="">Selecciona un estado</option>
                        {FOSTER_ALLOWED_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatEnumLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="foster-section-field">
                      <span>Capacidad maxima</span>
                      <input
                        type="number"
                        min="1"
                        value={ruleForm.capacidadMaxima}
                        onChange={(event) =>
                          setRuleForm((currentValue) => ({
                            ...currentValue,
                            capacidadMaxima: event.target.value,
                          }))
                        }
                        placeholder="Sin limite"
                      />
                    </label>

                    <label className="foster-section-field">
                      <span>Activa</span>
                      <select
                        value={ruleForm.activo ? "true" : "false"}
                        onChange={(event) =>
                          setRuleForm((currentValue) => ({
                            ...currentValue,
                            activo: event.target.value === "true",
                          }))
                        }
                      >
                        <option value="true">Si</option>
                        <option value="false">No</option>
                      </select>
                    </label>

                    <label className="foster-section-field full">
                      <span>Observaciones</span>
                      <textarea
                        rows="4"
                        value={ruleForm.observaciones}
                        onChange={(event) =>
                          setRuleForm((currentValue) => ({
                            ...currentValue,
                            observaciones: event.target.value,
                          }))
                        }
                        placeholder="Notas utiles para la regla"
                      />
                    </label>
                  </div>
                )}
              </section>

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeRuleModal()}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingRule}>
                  {isSavingRule
                    ? "Guardando..."
                    : ruleModalMode === "create"
                      ? ruleForms.length === 1
                        ? "Crear regla"
                        : `Crear ${ruleForms.length} reglas`
                      : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isObservationModalOpen ? (
        <div className="modal-overlay" onClick={() => closeObservationModal()}>
          <div className="event-modal foster-modal foster-modal-medium" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <div>
                <h3>Crear observación</h3>
                <p className="foster-section-note">
                  Agrega una observación estructurada para el historial del hogar temporal.
                </p>
              </div>
              <ModalCloseButton onClick={() => closeObservationModal()} />
            </div>

            {observationError ? <p className="error-text">{observationError}</p> : null}

            <form className="foster-modal-body" onSubmit={handleCreateObservation}>
              <section className="foster-form-section">
                <label className="foster-section-field full">
                  <span>Texto de observación</span>
                  <textarea
                    rows="5"
                    value={observationText}
                    onChange={(event) => setObservationText(event.target.value)}
                    placeholder="Escribe una observación del hogar temporal"
                  />
                </label>
              </section>

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeObservationModal()}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingObservation}>
                  {isSavingObservation ? "Guardando..." : "Crear observación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isAssignModalOpen ? (
        <div className="modal-overlay" onClick={() => closeAssignModal()}>
          <div className="event-modal foster-modal" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <div>
                <h3>Asignar animal</h3>
                <p className="foster-section-note">
                  Se listan solo animales elegibles segun las reglas activas y la capacidad disponible del hogar.
                </p>
              </div>
              <ModalCloseButton onClick={() => closeAssignModal()} />
            </div>

            {assignmentError ? <p className="error-text">{assignmentError}</p> : null}

            <form className="foster-modal-body" onSubmit={handleSubmitAssignment}>
              <section className="foster-form-section">
                <div className="foster-form-grid">
                  <label className="foster-section-field">
                    <span>Fecha de inicio</span>
                    <input
                      type="date"
                      value={assignmentForm.fecha_inicio}
                      onChange={(event) =>
                        setAssignmentForm((currentValue) => ({
                          ...currentValue,
                          fecha_inicio: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="foster-section-field">
                    <span>Animal seleccionado</span>
                    <input
                      type="text"
                      value={
                        eligibleAnimals.find((animal) => String(animal.id) === String(assignmentForm.animal_id))?.nombre || "Ninguno"
                      }
                      readOnly
                    />
                  </label>

                  <label className="foster-section-field full">
                    <span>Observaciones</span>
                    <textarea
                      rows="3"
                      value={assignmentForm.observaciones}
                      onChange={(event) =>
                        setAssignmentForm((currentValue) => ({
                          ...currentValue,
                          observaciones: event.target.value,
                        }))
                      }
                      placeholder="Notas para el seguimiento de esta asignación"
                    />
                  </label>
                </div>
              </section>

              <section className="foster-form-section">
                <div className="foster-form-section-title">
                  <h4>Animales elegibles</h4>
                  <p>Selecciona uno para crear la asignación activa.</p>
                </div>

                {eligibleAnimalsLoading ? (
                  <p className="foster-muted">Buscando animales elegibles...</p>
                ) : eligibleAnimals.length === 0 ? (
                  <p className="foster-muted">No hay animales elegibles disponibles para este hogar en este momento.</p>
                ) : (
                  <div className="foster-eligible-list">
                    {eligibleAnimals.map((animal) => {
                      const isSelected = String(assignmentForm.animal_id) === String(animal.id);

                      return (
                        <article key={animal.id} className={`foster-eligible-item ${isSelected ? "is-selected" : ""}`}>
                          <div className="foster-eligible-top">
                            <div className="foster-meta-stack">
                              <strong>{animal.nombre || "Sin nombre"}</strong>
                              <span className="foster-muted">
                                {formatEnumLabel(animal.especie)} · {formatEnumLabel(animal.estadoSalud)}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() =>
                                setAssignmentForm((currentValue) => ({
                                  ...currentValue,
                                  animal_id: String(animal.id),
                                }))
                              }
                            >
                              {isSelected ? "Seleccionado" : "Seleccionar"}
                            </button>
                          </div>

                          {animal.compatibility ? (
                            <div className="foster-chip-list">
                              <span className="foster-chip">
                                Regla: {formatEnumLabel(animal.compatibility.especie)}
                                {" · "}
                                {formatEnumLabel(animal.compatibility.estado_permitido)}
                              </span>
                              {animal.compatibility.capacidad_maxima ? (
                                <span className="foster-chip foster-chip-secondary">
                                  Cupo disponible: {animal.compatibility.remaining_capacity}
                                </span>
                              ) : (
                                <span className="foster-chip foster-chip-muted">Sin limite</span>
                              )}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeAssignModal()}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isAssigning}>
                  {isAssigning ? "Asignando..." : "Crear asignación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCloseModalOpen ? (
        <div className="modal-overlay" onClick={() => closeCloseModal()}>
          <div className="event-modal foster-modal foster-modal-medium" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <div>
                <h3>{closeForm.estado === "TRASLADADO" ? "Trasladar asignación" : "Finalizar asignación"}</h3>
                <p className="foster-section-note">
                  Esta acción cerrara la asignación activa del animal seleccionado.
                </p>
              </div>
              <ModalCloseButton onClick={() => closeCloseModal()} />
            </div>

            {closeError ? <p className="error-text">{closeError}</p> : null}

            <form className="foster-modal-body" onSubmit={handleSubmitCloseAssignment}>
              <section className="foster-form-section">
                <div className="foster-form-grid">
                  <label className="foster-section-field">
                    <span>Estado de cierre</span>
                    <select
                      value={closeForm.estado}
                      onChange={(event) =>
                        setCloseForm((currentValue) => ({
                          ...currentValue,
                          estado: event.target.value,
                        }))
                      }
                    >
                      {FOSTER_ASSIGNMENT_CLOSE_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {formatEnumLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="foster-section-field">
                    <span>Fecha de término</span>
                    <input
                      type="date"
                      value={closeForm.fecha_fin}
                      onChange={(event) =>
                        setCloseForm((currentValue) => ({
                          ...currentValue,
                          fecha_fin: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="foster-section-field full">
                    <span>Motivo de término</span>
                    <textarea
                      rows="3"
                      value={closeForm.motivo_termino}
                      onChange={(event) =>
                        setCloseForm((currentValue) => ({
                          ...currentValue,
                          motivo_termino: event.target.value,
                        }))
                      }
                      placeholder="Describe el motivo del cierre o traslado"
                    />
                  </label>

                  <label className="foster-section-field full">
                    <span>Observaciones</span>
                    <textarea
                      rows="3"
                      value={closeForm.observaciones}
                      onChange={(event) =>
                        setCloseForm((currentValue) => ({
                          ...currentValue,
                          observaciones: event.target.value,
                        }))
                      }
                      placeholder="Notas adicionales para el historial"
                    />
                  </label>
                </div>
              </section>

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeCloseModal()}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isClosingAssignment}>
                  {isClosingAssignment ? "Guardando..." : "Confirmar cierre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
