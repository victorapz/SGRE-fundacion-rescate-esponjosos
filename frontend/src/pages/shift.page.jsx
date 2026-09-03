import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Ellipsis,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import ActionMenuItem from "../components/common/ActionMenuItem";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import {
  cancelShiftRegistration,
  createShift,
  deleteShift,
  getShifts,
  getShiftRegistrations,
  getUserHistoryShiftRegistrations,
  getUserShiftRegistrations,
  getUserUpcomingShiftRegistrations,
  markShiftAttendance,
  registerShift,
  saveShiftBitacora,
  updateShift,
  updateShiftRegistrationStatus,
} from "../services/shift.service";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { PERMISSIONS } from "../config/permissions";
import RichTextEditor from "../components/common/RichTextEditor";
import { richTextToPlainText, sanitizeRichTextHtml } from "../utils/rich-text";
import "../styles/home.page.css";
import "../styles/shift.page.css";

const WEEK_DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const REGISTRATION_STATUSES = ["INSCRITO", "PRESENTE", "AUSENTE", "CANCELADO"];
const MONTH_OPTIONS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];
const SHIFT_TYPE_META = {
  all: { key: "all", label: "Todos", title: "Turno", className: "shift-tone-default" },
  manana: {
    key: "manana",
    label: "Mañana",
    title: "Turno manana",
    className: "shift-tone-manana",
  },
  tarde: {
    key: "tarde",
    label: "Tarde",
    title: "Turno tarde",
    className: "shift-tone-tarde",
  },
  noche: {
    key: "noche",
    label: "Noche",
    title: "Turno noche",
    className: "shift-tone-noche",
  },
};
const BITACORA_MIN_LENGTH = 60;
const PRESENT_REGISTRATION_STATUSES = new Set(["ASISTIO", "PRESENTE"]);

function emptyForm() {
  return {
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    capacity: "",
    status: true,
  };
}

function startOfWeek(date) {
  const normalized = new Date(date);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function toIsoDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseShiftDate(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  if (typeof dateValue === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const parsed = new Date(`${dateValue}T12:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
      const [day, month, year] = dateValue.split("-");
      const parsed = new Date(`${year}-${month}-${day}T12:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplayDate(dateValue) {
  const parsedDate = parseShiftDate(dateValue);
  if (!parsedDate) return dateValue || "";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

function periodForShift(startTime = "") {
  const [hourRaw] = String(startTime).split(":");
  const hour = Number(hourRaw);

  if (!Number.isFinite(hour)) return "all";
  if (hour < 12) return "manana";
  if (hour < 18) return "tarde";
  return "noche";
}

function formatWeekRange(startDate) {
  const endDate = addDays(startDate, 6);
  const startLabel = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(endDate);

  return `${startLabel} - ${endLabel}`;
}

function buildShiftDateTime(shiftDate, shiftTime) {
  const parsedDate = parseShiftDate(shiftDate);
  if (!parsedDate || !shiftTime) return null;

  const [hoursRaw, minutesRaw] = String(shiftTime).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const result = new Date(parsedDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function getShiftId(shift) {
  return shift?.id ?? shift?.id_turno ?? null;
}

function getShiftTitle(shift) {
  return shift?.title || shift?.titulo || getShiftTypeMeta(shift).title;
}

function getShiftDate(shift) {
  return shift?.date || shift?.fecha || "";
}

function getShiftStartTime(shift) {
  return shift?.startTime || shift?.hora_inicio || "";
}

function getShiftEndTime(shift) {
  return shift?.endTime || shift?.hora_fin || "";
}

function getShiftStatus(shift) {
  if (typeof shift?.status === "boolean") return shift.status;
  if (typeof shift?.estado === "boolean") return shift.estado;
  return Boolean(shift?.estado);
}

function getShiftWindow(shift) {
  const start = buildShiftDateTime(getShiftDate(shift), getShiftStartTime(shift));
  const end = buildShiftDateTime(getShiftDate(shift), getShiftEndTime(shift));

  if (!start || !end) return null;

  if (end <= start) {
    const overnightEnd = new Date(end);
    overnightEnd.setDate(overnightEnd.getDate() + 1);
    return { start, end: overnightEnd };
  }

  return { start, end };
}

function isShiftCurrent(shift, now = new Date()) {
  const window = getShiftWindow(shift);
  if (!window) return false;
  return now >= window.start && now <= window.end;
}

function isShiftPast(shift, now = new Date()) {
  const window = getShiftWindow(shift);
  if (!window) return false;
  return now > window.end;
}

function isShiftFuture(shift, now = new Date()) {
  const window = getShiftWindow(shift);
  if (!window) return false;
  return now < window.start;
}

function buildYearOptions(currentYear, range = 10) {
  return Array.from({ length: range + 1 }, (_, index) => currentYear - index);
}

function registrationStatusClass(status) {
  switch (status) {
    case "INSCRITO":
      return "status-inscrito";
    case "PRESENTE":
      return "status-presente";
    case "AUSENTE":
      return "status-ausente";
    case "CANCELADO":
      return "status-cancelado";
    default:
      return "status-inscrito";
  }
}

function formatStatusLabel(status) {
  if (!status) return "-";
  const normalized = String(status).toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isPresentRegistrationStatus(status) {
  return PRESENT_REGISTRATION_STATUSES.has(String(status || "").toUpperCase());
}

function getShiftTypeMeta(shiftOrTime) {
  const startTime = typeof shiftOrTime === "string"
    ? shiftOrTime
    : getShiftStartTime(shiftOrTime);
  return SHIFT_TYPE_META[periodForShift(startTime)] || SHIFT_TYPE_META.all;
}

function ShiftTabs({ activeTab, onChange, showMine }) {
  return (
    <div className="home-tabs shifts-tabs">
      <button
        type="button"
        className={`home-tab-button ${activeTab === "available" ? "home-tab-button-active" : ""}`.trim()}
        onClick={() => onChange("available")}
      >
        Turnos disponibles
      </button>
      {showMine ? (
        <button
          type="button"
          className={`home-tab-button ${activeTab === "mine" ? "home-tab-button-active" : ""}`.trim()}
          onClick={() => onChange("mine")}
        >
          Mis turnos
        </button>
      ) : null}
    </div>
  );
}

function MyShiftTabs({ activeTab, onChange }) {
  return (
    <div className="home-tabs shifts-subtabs">
      <button
        type="button"
        className={`home-tab-button ${activeTab === "upcoming" ? "home-tab-button-active" : ""}`.trim()}
        onClick={() => onChange("upcoming")}
      >
        Próximos turnos
      </button>
      <button
        type="button"
        className={`home-tab-button ${activeTab === "history" ? "home-tab-button-active" : ""}`.trim()}
        onClick={() => onChange("history")}
      >
        Historial
      </button>
    </div>
  );
}

function ShiftTypeBadge({ shift }) {
  const typeMeta = getShiftTypeMeta(shift);
  return <span className={`shift-type-badge ${typeMeta.className}`}>{typeMeta.label}</span>;
}

function ShiftAvailabilityBadge({ shift, isRegistered }) {
  if (isRegistered) {
    return <span className="shift-badge shift-badge-registered">Ya inscrito</span>;
  }

  if (!getShiftStatus(shift)) {
    return <span className="shift-badge shift-badge-closed">No disponible</span>;
  }

  return <span className="shift-badge shift-badge-open">Disponible</span>;
}

function ShiftActionsMenu({
  shiftId,
  canEdit,
  canDelete,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
}) {
  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className="shift-actions-menu">
      <button
        type="button"
        className="shift-menu-trigger"
        aria-label="Abrir acciones del turno"
        aria-expanded={isOpen}
        onClick={() => onToggle(shiftId)}
      >
        <Ellipsis size={18} />
      </button>

      {isOpen ? (
        <div className="shift-menu-dropdown">
          {canEdit ? (
            <ActionMenuItem icon={Pencil} label="Editar" onClick={onEdit} />
          ) : null}
          {canDelete ? (
            <ActionMenuItem icon={Trash2} label="Eliminar" variant="danger" className="is-danger" onClick={onDelete} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ShiftCard({
  shift,
  canEdit,
  canDelete,
  canViewRegistrations,
  canRegister,
  isRegistered,
  isRegistering,
  isMenuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
  onOpenRegistrations,
  onRegister,
}) {
  const typeMeta = getShiftTypeMeta(shift);
  const shiftId = getShiftId(shift);
  const shiftStatus = getShiftStatus(shift);
  const isAvailable = shiftStatus && isShiftFuture(shift);
  const availableSeats = Number.isFinite(Number(shift.availableSeats))
    ? Number(shift.availableSeats)
    : null;

  return (
    <article
      className={[
        "shift-card",
        typeMeta.className,
        shiftStatus ? "shift-card-open" : "shift-card-closed",
      ].join(" ")}
    >
      <div className="shift-card-head">
        <div className="shift-card-headline">
          <div className="shift-card-badges">
            <h4>{getShiftTitle(shift)}</h4>
            <ShiftAvailabilityBadge shift={shift} isRegistered={isRegistered} />
          </div>
          
        </div>

        <ShiftActionsMenu
          shiftId={shiftId}
          canEdit={canEdit}
          canDelete={canDelete}
          isOpen={isMenuOpen}
          onToggle={onToggleMenu}
          onEdit={() => onEdit(shift)}
          onDelete={() => onDelete(shiftId)}
        />
      </div>

      <div className="shift-card-meta">
    <div className="shift-meta-row">
  <Users size={14} />
  <span>
    {shift.capacity}
    {availableSeats != null ? ` / ${shift.capacity - availableSeats}` : ""}
  </span>
</div>
      </div>

      <div className="shift-user-actions">
        {canViewRegistrations ? (
          <IconButton
            icon={Eye}
            label={`Ver inscritos del turno ${getShiftTitle(shift)}`}
            variant="secondary"
            onClick={() => onOpenRegistrations(shift)}
          />
        ) : null}

        {!isRegistered && isAvailable && canRegister ? (
          <button
            type="button"
            className={`btn-shift-register ${typeMeta.className}`}
            onClick={() => onRegister(shiftId)}
            disabled={isRegistering}
          >
            {isRegistering ? "Procesando..." : "Inscribirme"}
          </button>
        ) : null}

        {isRegistered || !isAvailable || !canRegister ? (
          <div className="shift-actions-spacer" aria-hidden="true" />
        ) : null}
      </div>
    </article>
  );
}

function MyShiftCard({ registration, onCancel, canCancel, onSelect, isSelected }) {
  const shift = registration.shift || {};
  const typeMeta = getShiftTypeMeta(shift);
  const isSelectable = Boolean(onSelect);

  return (
    <article
      className={[
        "my-shift-card",
        typeMeta.className,
        isSelectable ? "is-selectable" : "",
        isSelected ? "is-selected" : "",
      ].join(" ").trim()}
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      <div className="my-shift-headline">
        <div className="shift-card-badges">
          <ShiftTypeBadge shift={shift} />
          <span className={`registration-badge ${registrationStatusClass(registration.estado)}`}>
            {formatStatusLabel(registration.estado)}
          </span>
        </div>
        <h4>{getShiftTitle(shift)}</h4>
        <p>{formatDisplayDate(getShiftDate(shift))}</p>
      </div>

      <div className="my-shift-meta">
        <span className="shift-meta-row">
          <Clock3 size={14} />
          {getShiftStartTime(shift)} - {getShiftEndTime(shift)}
        </span>
      </div>

      {canCancel ? (
        <div className="my-shift-actions">
          <button
            type="button"
            className="btn-soft"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            Cancelar inscripción
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function ShiftPage() {
  const { user } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canCreateShift = hasPermission(PERMISSIONS.SHIFTS.CREATE);
  const canUpdateShift = hasPermission(PERMISSIONS.SHIFTS.UPDATE);
  const canDeleteShift = hasPermission(PERMISSIONS.SHIFTS.DELETE);
  const canViewRegistrations = hasPermission(PERMISSIONS.SHIFTS.REGISTRATIONS_READ);
  const canRegisterShift = hasPermission(PERMISSIONS.SHIFTS.REGISTER);
  const canCancelRegistration = hasPermission(PERMISSIONS.SHIFTS.CANCEL);
  const canAccessMyShifts = hasAnyPermission([
    PERMISSIONS.SHIFTS.REGISTRATIONS_SELF_READ,
    PERMISSIONS.SHIFTS.REGISTRATIONS_READ,
  ]);

  const [activeTab, setActiveTab] = useState("available");
  const [activeMyTab, setActiveMyTab] = useState("upcoming");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [shifts, setShifts] = useState([]);
  const [myUpcomingRegistrations, setMyUpcomingRegistrations] = useState([]);
  const [myHistoryRegistrations, setMyHistoryRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myShiftsLoading, setMyShiftsLoading] = useState(false);
  const [error, setError] = useState("");
  const [, setSuccessMessage] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [registeredShiftIds, setRegisteredShiftIds] = useState(() => new Set());
  const [registeringShiftId, setRegisteringShiftId] = useState(null);
  const [openShiftMenuId, setOpenShiftMenuId] = useState(null);
  const [registrationsByShift, setRegistrationsByShift] = useState({});
  const [isRegistrationsModalOpen, setIsRegistrationsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [updatingRegistrations, setUpdatingRegistrations] = useState({});
  const [isMyShiftModalOpen, setIsMyShiftModalOpen] = useState(false);
  const [selectedMyRegistration, setSelectedMyRegistration] = useState(null);
  const [bitacoraDraft, setBitacoraDraft] = useState("");
  const [bitacoraError, setBitacoraError] = useState("");
  const [bitacoraSaving, setBitacoraSaving] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [myShiftModalLoading, setMyShiftModalLoading] = useState(false);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const nextShifts = await getShifts();
      setShifts(nextShifts);
      return nextShifts;
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "No se pudieron cargar los turnos",
      );
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyShiftCollections = useCallback(async () => {
    if (!user?.id || !canAccessMyShifts) {
      return { upcoming: [], history: [], all: [] };
    }

    const params = { year: selectedYear, month: selectedMonth };
    const [upcoming, history, all] = await Promise.all([
      getUserUpcomingShiftRegistrations(user.id, params),
      getUserHistoryShiftRegistrations(user.id, params),
      getUserShiftRegistrations(user.id),
    ]);

    return { upcoming, history, all };
  }, [canAccessMyShifts, selectedMonth, selectedYear, user?.id]);

  const applyMyShiftCollections = useCallback(({ upcoming = [], history = [], all = [] }) => {
    setMyUpcomingRegistrations(upcoming);
    setMyHistoryRegistrations(history);

    const registeredIds = new Set(
      all
        .map((registration) => getShiftId(registration?.shift))
        .filter((value) => Number.isFinite(Number(value)))
        .map((value) => Number(value)),
    );
    setRegisteredShiftIds(registeredIds);
  }, []);

  const loadMyShifts = useCallback(async () => {
    if (!user?.id || !canAccessMyShifts) {
      setMyUpcomingRegistrations([]);
      setMyHistoryRegistrations([]);
      setRegisteredShiftIds(new Set());
      return { upcoming: [], history: [], all: [] };
    }

    setMyShiftsLoading(true);
    setError("");

    try {
      const collections = await fetchMyShiftCollections();
      applyMyShiftCollections(collections);
      return collections;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar tus turnos",
      );
      return { upcoming: [], history: [], all: [] };
    } finally {
      setMyShiftsLoading(false);
    }
  }, [applyMyShiftCollections, canAccessMyShifts, fetchMyShiftCollections, user?.id]);

  const refreshMyShiftRegistration = useCallback(async (registrationId) => {
    if (!registrationId) return null;

    const collections = await fetchMyShiftCollections();
    applyMyShiftCollections(collections);

    return [
      ...collections.upcoming,
      ...collections.history,
      ...collections.all,
    ].find(
      (registration) => String(registration.turno_registro_id) === String(registrationId),
    ) || null;
  }, [applyMyShiftCollections, fetchMyShiftCollections]);

  const refreshRegistrationsForShift = useCallback(async (shiftId) => {
    if (!shiftId) return [];

    const registrations = await getShiftRegistrations(shiftId);
    setRegistrationsByShift((current) => ({
      ...current,
      [shiftId]: registrations,
    }));
    return registrations;
  }, []);

  useEffect(() => {
    if (activeTab === "available") {
      loadShifts();
    }
  }, [activeTab, currentWeekStart, loadShifts]);

  useEffect(() => {
    loadMyShifts();
  }, [loadMyShifts]);

  useEffect(() => {
    if (!canAccessMyShifts && activeTab === "mine") {
      setActiveTab("available");
    }
  }, [activeTab, canAccessMyShifts]);

  useEffect(() => {
    if (activeTab === "mine") {
      loadMyShifts();
    }
  }, [activeTab, loadMyShifts]);

  useEffect(() => {
    if (!selectedShift) return;

    const shiftId = getShiftId(selectedShift);
    const nextShift = shifts.find((shift) => String(getShiftId(shift)) === String(shiftId));

    if (nextShift) {
      setSelectedShift(nextShift);
    }
  }, [selectedShift, shifts]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const dateValue = addDays(currentWeekStart, index);
      return {
        id: toIsoDate(dateValue),
        label: WEEK_DAYS[index],
        dayNumber: String(dateValue.getDate()),
      };
    });
  }, [currentWeekStart]);

  const filteredShifts = useMemo(() => {
    return shifts
      .filter((shift) => {
        const parsedDate = parseShiftDate(getShiftDate(shift));
        if (!parsedDate) return false;

        const shiftIsoDate = toIsoDate(parsedDate);
        const belongsToCurrentWeek = weekDays.some((item) => item.id === shiftIsoDate);
        if (!belongsToCurrentWeek) return false;

        if (periodFilter !== "all" && periodForShift(getShiftStartTime(shift)) !== periodFilter) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftDate = parseShiftDate(getShiftDate(left));
        const rightDate = parseShiftDate(getShiftDate(right));
        const leftKey = `${leftDate ? toIsoDate(leftDate) : ""} ${getShiftStartTime(left)}`;
        const rightKey = `${rightDate ? toIsoDate(rightDate) : ""} ${getShiftStartTime(right)}`;
        return leftKey.localeCompare(rightKey);
      });
  }, [periodFilter, shifts, weekDays]);

  const shiftsByDay = useMemo(() => {
    const map = weekDays.reduce((accumulator, day) => {
      accumulator[day.id] = [];
      return accumulator;
    }, {});

    filteredShifts.forEach((shift) => {
      const parsedDate = parseShiftDate(getShiftDate(shift));
      if (!parsedDate) return;
      const shiftIsoDate = toIsoDate(parsedDate);
      if (!map[shiftIsoDate]) return;
      map[shiftIsoDate].push(shift);
    });

    return map;
  }, [filteredShifts, weekDays]);

  const summary = useMemo(() => {
    const activeCount = filteredShifts.filter((shift) => getShiftStatus(shift)).length;
    return {
      total: filteredShifts.length,
      active: activeCount,
      inactive: filteredShifts.length - activeCount,
    };
  }, [filteredShifts]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return buildYearOptions(currentYear, 10);
  }, []);

  const openCreateModal = () => {
    if (!canCreateShift) return;
    setModalMode("create");
    setEditingShiftId(null);
    setForm(emptyForm());
    setOpenShiftMenuId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (shift) => {
    if (!canUpdateShift) return;
    setModalMode("edit");
    setEditingShiftId(getShiftId(shift));
    setForm({
      title: getShiftTitle(shift),
      date: getShiftDate(shift),
      startTime: getShiftStartTime(shift),
      endTime: getShiftEndTime(shift),
      capacity: String(shift.capacity ?? ""),
      status: getShiftStatus(shift),
    });
    setOpenShiftMenuId(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const toggleShiftMenu = (shiftId) => {
    setOpenShiftMenuId((currentValue) => (currentValue === shiftId ? null : shiftId));
  };

  const handleFieldChange = (field, value) => {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title || !form.date || !form.startTime || !form.endTime || !form.capacity) {
      return;
    }

    if (modalMode === "edit" && !canUpdateShift) return;
    if (modalMode === "create" && !canCreateShift) return;

    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        titulo: form.title.trim(),
        fecha: form.date,
        hora_inicio: form.startTime,
        hora_fin: form.endTime,
        cantidad_maxima: Number(form.capacity),
        estado: Boolean(form.status),
      };

      if (modalMode === "edit") {
        await updateShift(editingShiftId, payload);
      } else {
        await createShift(payload);
      }

      await loadShifts();
      setIsModalOpen(false);
      setForm(emptyForm());
      setSuccessMessage(modalMode === "edit" ? "Turno actualizado correctamente." : "Turno creado correctamente.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar el turno");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (shiftId) => {
    if (!canDeleteShift) return;

    const confirmed = window.confirm("Seguro que deseas eliminar este turno?");
    if (!confirmed) return;

    try {
      setOpenShiftMenuId(null);
      await deleteShift(shiftId);
      await loadShifts();
      await loadMyShifts();
      setSuccessMessage("Turno eliminado correctamente.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar el turno");
    }
  };

  const handleRegister = async (shiftId) => {
    if (!canRegisterShift) return;

    if (!user?.id) {
      setError("Debes iniciar sesión para registrarte en un turno");
      return;
    }

    setRegisteringShiftId(shiftId);
    setError("");
    setSuccessMessage("");

    try {
      await registerShift(shiftId, user.id);
      await Promise.all([loadShifts(), loadMyShifts()]);
      setSuccessMessage("Registro realizado correctamente.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo registrar el turno");
    } finally {
      setRegisteringShiftId(null);
    }
  };

  const handleCancelRegistration = async (shiftId) => {
    if (!shiftId || !canCancelRegistration) return;

    if (!user?.id) {
      setError("Debes iniciar sesión para cancelar el registro");
      return;
    }

    setRegisteringShiftId(shiftId);
    setError("");
    setSuccessMessage("");

    try {
      await cancelShiftRegistration(shiftId, user.id);
      await Promise.all([loadShifts(), loadMyShifts()]);
      setSuccessMessage("Registro cancelado correctamente.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cancelar el registro");
    } finally {
      setRegisteringShiftId(null);
    }
  };

  const openRegistrationsModal = async (shift) => {
    if (!canViewRegistrations) return;

    const shiftId = getShiftId(shift);
    setSelectedShift(shift);
    setOpenShiftMenuId(null);
    setIsRegistrationsModalOpen(true);

    setRegistrationsLoading(true);
    setError("");

    try {
      await refreshRegistrationsForShift(shiftId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar los inscritos",
      );
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const closeRegistrationsModal = () => {
    setIsRegistrationsModalOpen(false);
    setSelectedShift(null);
  };

  const selectedRegistrations = useMemo(() => {
    const shiftId = getShiftId(selectedShift);
    if (!shiftId) return [];
    return registrationsByShift[shiftId] || [];
  }, [registrationsByShift, selectedShift]);

  const handleRegistrationStatusChange = async (registrationId, nextStatus) => {
    if (!canUpdateShift) return;

    const shiftId = getShiftId(selectedShift);
    if (!shiftId) return;

    const previousRegistrations = registrationsByShift[shiftId] || [];

    setRegistrationsByShift((current) => ({
      ...current,
      [shiftId]: (current[shiftId] || []).map((registration) =>
        registration.turno_registro_id === registrationId
          ? { ...registration, estado: nextStatus }
          : registration,
      ),
    }));

    setUpdatingRegistrations((current) => ({
      ...current,
      [registrationId]: true,
    }));

    try {
      await updateShiftRegistrationStatus(registrationId, nextStatus);
      await Promise.all([
        refreshRegistrationsForShift(shiftId),
        loadShifts(),
        loadMyShifts(),
      ]);
    } catch (requestError) {
      setRegistrationsByShift((current) => ({
        ...current,
        [shiftId]: previousRegistrations,
      }));
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar el registro",
      );
    } finally {
      setUpdatingRegistrations((current) => {
        const next = { ...current };
        delete next[registrationId];
        return next;
      });
    }
  };

  const openMyShiftModal = async (registration) => {
    setSelectedMyRegistration(registration);
    setBitacoraDraft(registration?.bitacora || "");
    setBitacoraError("");
    setIsMyShiftModalOpen(true);

    if (!registration?.turno_registro_id) {
      return;
    }

    setMyShiftModalLoading(true);

    try {
      const freshRegistration = await refreshMyShiftRegistration(registration.turno_registro_id);

      if (freshRegistration) {
        setSelectedMyRegistration(freshRegistration);
        setBitacoraDraft(freshRegistration.bitacora || "");
      }
    } catch (requestError) {
      setBitacoraError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo refrescar el detalle del turno",
      );
    } finally {
      setMyShiftModalLoading(false);
    }
  };

  const closeMyShiftModal = () => {
    if (bitacoraSaving || attendanceSaving || myShiftModalLoading) return;
    setIsMyShiftModalOpen(false);
    setSelectedMyRegistration(null);
    setBitacoraDraft("");
    setBitacoraError("");
  };

  const handleSaveBitacora = async () => {
    if (!selectedMyRegistration || !canRegisterShift) return;

    if (richTextToPlainText(bitacoraDraft).length < BITACORA_MIN_LENGTH) {
      setBitacoraError(`La bitacora debe tener al menos ${BITACORA_MIN_LENGTH} caracteres`);
      return;
    }

    setBitacoraSaving(true);
    setBitacoraError("");

    try {
      const updated = await saveShiftBitacora(
        selectedMyRegistration.turno_registro_id,
        bitacoraDraft,
      );

      if (updated) {
        const freshRegistration = await refreshMyShiftRegistration(
          selectedMyRegistration.turno_registro_id,
        );
        if (freshRegistration) {
          setSelectedMyRegistration(freshRegistration);
          setBitacoraDraft(freshRegistration.bitacora || updated.bitacora || "");
        }
      }
    } catch (requestError) {
      setBitacoraError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar la bitacora",
      );
    } finally {
      setBitacoraSaving(false);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedMyRegistration || !canRegisterShift) return;

    setAttendanceSaving(true);
    setBitacoraError("");

    try {
      const updated = await markShiftAttendance(
        selectedMyRegistration.turno_registro_id,
        "PRESENTE",
      );

      if (updated) {
        const freshRegistration = await refreshMyShiftRegistration(
          selectedMyRegistration.turno_registro_id,
        );
        if (freshRegistration) {
          setSelectedMyRegistration(freshRegistration);
          setBitacoraDraft(freshRegistration.bitacora || bitacoraDraft);
        }
        await loadShifts();
      }
    } catch (requestError) {
      setBitacoraError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar la asistencia",
      );
    } finally {
      setAttendanceSaving(false);
    }
  };

  const currentMyRegistrations = activeMyTab === "upcoming"
    ? myUpcomingRegistrations
    : myHistoryRegistrations;

  const myShiftSummary = useMemo(() => {
    const presentCount = currentMyRegistrations.filter(
      (registration) => registration.estado === "PRESENTE",
    ).length;
    const cancelledCount = currentMyRegistrations.filter(
      (registration) => registration.estado === "CANCELADO",
    ).length;
    const absentCount = currentMyRegistrations.filter(
      (registration) => registration.estado === "AUSENTE",
    ).length;

    return {
      total: currentMyRegistrations.length,
      present: presentCount,
      pending: currentMyRegistrations.length - presentCount - cancelledCount,
      cancelled: cancelledCount,
      absent: absentCount,
    };
  }, [currentMyRegistrations]);

  const selectedShiftDetails = selectedMyRegistration?.shift || null;
  const selectedShiftIsCurrent = selectedShiftDetails ? isShiftCurrent(selectedShiftDetails) : false;
  const selectedShiftIsPast = selectedShiftDetails ? isShiftPast(selectedShiftDetails) : false;
  const bitacoraLength = richTextToPlainText(bitacoraDraft).length;
  const selectedShiftTypeMeta = getShiftTypeMeta(selectedShiftDetails || "");
  const canEditCurrentBitacora = selectedShiftIsCurrent && canRegisterShift;
  const showAttendanceAsPresent = isPresentRegistrationStatus(selectedMyRegistration?.estado);
  const canMarkSelectedAttendance = canEditCurrentBitacora && !showAttendanceAsPresent;
  const selectedAttendanceLabel = showAttendanceAsPresent
    ? "Marcada como presente"
    : formatStatusLabel(selectedMyRegistration?.estado);

  return (
    <section className="shifts-page">
      <header className="main-header shifts-page-header">
        <h1>Calendario semanal</h1>
        <p>Organiza tu impacto. Selecciona los turnos y controla la disponibilidad de cada bloque.</p>
      </header>

      <ShiftTabs activeTab={activeTab} onChange={setActiveTab} showMine={canAccessMyShifts} />

      {activeTab === "available" ? (
        <section className="shifts-shell-card">
          <div className="shifts-toolbar-row">
            <div className="shifts-toolbar-main">
              <div className="shifts-filter-buttons" role="tablist" aria-label="Filtros por jornada">
                {["all", "manana", "tarde", "noche"].map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    className={periodFilter === filterKey ? "is-active" : ""}
                    onClick={() => setPeriodFilter(filterKey)}
                  >
                    {SHIFT_TYPE_META[filterKey]?.label || "Todos"}
                  </button>
                ))}
              </div>
          
            </div>

            
              <div className="shifts-week-nav">
                <button
                  type="button"
                  aria-label="Semana anterior"
                  onClick={() => setCurrentWeekStart((prev) => addDays(prev, -7))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{formatWeekRange(currentWeekStart)}</span>
                <button
                  type="button"
                  aria-label="Semana siguiente"
                  onClick={() => setCurrentWeekStart((prev) => addDays(prev, 7))}
                >
                  <ChevronRight size={16} />
                </button>
                
              </div>
              <div className="shifts-actions">
                {canCreateShift ? (
                  <button type="button" className="btn-primary" onClick={openCreateModal}>
                    <Plus size={14} />
                    Nuevo turno
                  </button>
                ) : null}
            

            </div>
          </div>
              <div className="shifts-summary">
                <span className="shift-stat-pill">Total {summary.total}</span>
                <span className="shift-stat-pill shift-stat-pill-open">Disponibles {summary.active}</span>
                <span className="shift-stat-pill shift-stat-pill-muted">No disponibles {summary.inactive}</span>
              </div>

          {error ? <div className="shifts-feedback error">{error}</div> : null}
          {loading ? <div className="shifts-feedback">Cargando turnos...</div> : null}

          <div className="shifts-week-scroll">
            <div className="shifts-week-grid">
              {weekDays.map((day) => {
                const dayShifts = shiftsByDay[day.id] || [];

                return (
                  <section key={day.id} className="day-column">
                    <header className="day-header">
                      <span className="day-header-label">{day.label}</span>
                      <h3>{day.dayNumber}</h3>
                    </header>

                    <div className="day-cards">
                      {dayShifts.length === 0 ? (
                        <div className="day-empty">
                          <CalendarClock size={16} />
                          <p>Sin turnos</p>
                        </div>
                      ) : null}

                      {dayShifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          canEdit={canUpdateShift}
                          canDelete={canDeleteShift}
                          canViewRegistrations={canViewRegistrations}
                          canRegister={canRegisterShift}
                          isRegistered={registeredShiftIds.has(shift.id)}
                          isRegistering={registeringShiftId === shift.id}
                          isMenuOpen={openShiftMenuId === shift.id}
                          onToggleMenu={toggleShiftMenu}
                          onEdit={openEditModal}
                          onDelete={handleDelete}
                          onOpenRegistrations={openRegistrationsModal}
                          onRegister={handleRegister}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="shifts-shell-card shifts-shell-card-mine">
          <div className="my-shifts-header">
            <div>
              <h2>Mis turnos</h2>
              <p>Revisa tus próximos turnos, historial y registra tu participacion cuando corresponda.</p>
            </div>
            <MyShiftTabs activeTab={activeMyTab} onChange={setActiveMyTab} />
          </div>

          <div className="my-shifts-filters">
            <label>
              <span>Anio</span>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {yearOptions.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Mes</span>
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
              >
                {MONTH_OPTIONS.map((monthOption) => (
                  <option key={monthOption.value} value={monthOption.value}>
                    {monthOption.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="shifts-summary">
            <span className="shift-stat-pill">Total {myShiftSummary.total}</span>
            <span className="shift-stat-pill shift-stat-pill-open">Pendientes {myShiftSummary.pending}</span>
            <span className="shift-stat-pill shift-stat-pill-open">Presentes {myShiftSummary.present}</span>
            <span className="shift-stat-pill shift-stat-pill-muted">Cancelados {myShiftSummary.cancelled}</span>
            <span className="shift-stat-pill shift-stat-pill-muted">Ausentes {myShiftSummary.absent}</span>
          </div>

          {error ? <div className="shifts-feedback error">{error}</div> : null}
          {myShiftsLoading ? <div className="shifts-feedback">Cargando tus turnos...</div> : null}

          <div className="my-shifts-content">
            {currentMyRegistrations.length === 0 && !myShiftsLoading ? (
              <div className="my-shifts-empty">
                {activeMyTab === "upcoming"
                  ? "No tienes turnos próximos"
                  : "No hay turnos en tu historial"}
              </div>
            ) : (
              <div className="my-shifts-grid">
                {currentMyRegistrations.map((registration) => (
                  <MyShiftCard
                    key={registration.turno_registro_id}
                    registration={registration}
                    canCancel={
                      canCancelRegistration
                      && activeMyTab === "upcoming"
                      && isShiftFuture(registration.shift)
                    }
                    onCancel={() => handleCancelRegistration(getShiftId(registration.shift))}
                    onSelect={() => openMyShiftModal(registration)}
                    isSelected={
                      selectedMyRegistration?.turno_registro_id === registration.turno_registro_id
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {isModalOpen ? (
        <div className="shift-modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="shift-modal-card shift-form-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shift-modal-header">
              <div>
                <h2>{modalMode === "edit" ? "Editar turno" : "Nuevo turno"}</h2>
                <p className="shift-modal-subtitle">
                  Organiza el bloque semanal, define horario y controla la disponibilidad.
                </p>
              </div>
              <ModalCloseButton onClick={closeModal} />
            </div>

            <form onSubmit={handleSubmit} className="shift-modal-form">
              <label>
                <span>Título</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => handleFieldChange("title", event.target.value)}
                />
              </label>
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => handleFieldChange("date", event.target.value)}
                />
              </label>
              <label>
                <span>Hora inicio</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) => handleFieldChange("startTime", event.target.value)}
                />
              </label>
              <label>
                <span>Hora fin</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => handleFieldChange("endTime", event.target.value)}
                />
              </label>
              <label>
                <span>Cupo maximo</span>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(event) => handleFieldChange("capacity", event.target.value)}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(event) => handleFieldChange("status", event.target.checked)}
                />
                <span>Turno activo</span>
              </label>

              <div className="shift-modal-actions">
                <button className="btn-soft" type="button" onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={
                    isSubmitting
                    || (modalMode === "create" ? !canCreateShift : !canUpdateShift)
                  }
                >
                  {isSubmitting
                    ? "Guardando..."
                    : modalMode === "edit"
                      ? "Guardar cambios"
                      : "Guardar turno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isRegistrationsModalOpen && selectedShift ? (
        <div className="shift-modal-overlay" role="presentation" onClick={closeRegistrationsModal}>
          <div
            className="shift-modal-card registrations-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shift-modal-header">
              <div>
                <h2>Inscritos</h2>
                <p className="registrations-subtitle">
                  {getShiftTitle(selectedShift)} · {formatDisplayDate(getShiftDate(selectedShift))} · {getShiftStartTime(selectedShift)} - {getShiftEndTime(selectedShift)}
                </p>
              </div>
              <ModalCloseButton onClick={closeRegistrationsModal} />
            </div>

            <div className="registrations-body">
              {registrationsLoading ? (
                <div className="registrations-empty">Cargando inscritos...</div>
              ) : selectedRegistrations.length === 0 ? (
                <div className="registrations-empty">No hay inscritos</div>
              ) : (
                <ul className="registrations-list">
                  {selectedRegistrations.map((registration) => {
                    const fullName = `${registration.user?.nombre || "Usuario"} ${registration.user?.apellido || ""}`.trim();
                    const isUpdating = Boolean(updatingRegistrations[registration.turno_registro_id]);

                    return (
                      <li key={registration.turno_registro_id} className="registration-row">
                        <div className="registration-info">
                          <span className="registration-name">{fullName}</span>
                          <span className={`registration-badge ${registrationStatusClass(registration.estado)}`}>
                            {formatStatusLabel(registration.estado)}
                          </span>
                        </div>
                        <div className="registration-actions">
                          <select
                            className="registration-select"
                            value={registration.estado}
                            onChange={(event) =>
                              handleRegistrationStatusChange(
                                registration.turno_registro_id,
                                event.target.value,
                              )
                            }
                            disabled={isUpdating || !canUpdateShift}
                          >
                            {REGISTRATION_STATUSES.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {statusOption}
                              </option>
                            ))}
                          </select>
                          {isUpdating ? (
                            <span className="registration-loading">Actualizando...</span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
{isMyShiftModalOpen && selectedMyRegistration ? (
  <div className="shift-modal-overlay" role="presentation" onClick={closeMyShiftModal}>
    <div
      className={`shift-modal-card my-shift-modal ${selectedShiftTypeMeta.className}`}
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="shift-modal-header">
        <div>
          <h2>{getShiftTitle(selectedShiftDetails)}</h2>
          <p className="registrations-subtitle">
            {formatDisplayDate(getShiftDate(selectedShiftDetails))} ·{" "}
            {getShiftStartTime(selectedShiftDetails)} - {getShiftEndTime(selectedShiftDetails)}
          </p>
        </div>

        <ModalCloseButton onClick={closeMyShiftModal} />
      </div>

      <div className="my-shift-detail-meta">
        <div className="my-shift-detail-pill">
          <span>Estado turno</span>
          <strong>
            {selectedShiftIsPast
              ? "Finalizado"
              : getShiftStatus(selectedShiftDetails)
                ? "Disponible"
                : "No disponible"}
          </strong>
        </div>

        <div className="my-shift-detail-pill">
          <span>Asistencia actual</span>
          <strong className={`registration-badge ${registrationStatusClass(selectedMyRegistration.estado)}`}>
            {formatStatusLabel(selectedMyRegistration.estado)}
          </strong>
        </div>

        {selectedShiftIsCurrent ? (
          <div className="my-shift-detail-pill is-current">
            <span>Estado actual</span>
            <strong>Turno vigente</strong>
          </div>
        ) : null}
      </div>

      <section className="my-shift-bitacora">
        <div className="my-shift-bitacora-head">
          <div>
            <h3>Bitacora</h3>
            <p>Registra lo realizado durante tu turno.</p>
          </div>

          {canEditCurrentBitacora ? (
            <span className={bitacoraLength < BITACORA_MIN_LENGTH ? "is-warning" : "is-ok"}>
              {bitacoraLength}/{BITACORA_MIN_LENGTH}
            </span>
          ) : null}
        </div>

        {myShiftModalLoading ? (
          <div className="my-shift-modal-loading">Actualizando detalle del turno...</div>
        ) : canEditCurrentBitacora ? (
          <>
            <RichTextEditor
              value={bitacoraDraft}
              onChange={setBitacoraDraft}
              placeholder="Describe lo realizado en el turno..."
            />

            {bitacoraError ? <p className="bitacora-error">{bitacoraError}</p> : null}

            <div className="my-shift-bitacora-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveBitacora}
                disabled={bitacoraSaving || bitacoraLength < BITACORA_MIN_LENGTH}
              >
                {bitacoraSaving ? "Guardando..." : "Guardar bitacora"}
              </button>

              {bitacoraLength < BITACORA_MIN_LENGTH ? (
                <span className="my-shift-action-hint">
                  La bitacora debe tener al menos {BITACORA_MIN_LENGTH} caracteres.
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="my-shift-bitacora-readonly">
            {selectedMyRegistration.bitacora ? (
              <div
                className="my-shift-bitacora-html"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichTextHtml(selectedMyRegistration.bitacora),
                }}
              />
            ) : (
              <p>
                {selectedShiftIsCurrent && !canRegisterShift
                  ? "No tienes permisos para registrar bitacora."
                  : "Sin bitacora registrada."}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="my-shift-attendance-row">
        <div className="my-shift-attendance-copy">
          <span>Acción de asistencia</span>

          <strong>{selectedAttendanceLabel}</strong>
          {!selectedShiftIsCurrent ? (
            <p className="my-shift-attendance-hint">
              La asistencia solo puede registrarse durante el turno vigente.
            </p>
          ) : !canRegisterShift ? (
            <p className="my-shift-attendance-hint">
              No tienes permisos para registrar asistencia.
            </p>
          ) : bitacoraLength < BITACORA_MIN_LENGTH && !showAttendanceAsPresent ? (
            <p className="my-shift-attendance-hint">
              Completa la bitacora antes de marcar asistencia.
            </p>
          ) : null}
        </div>

        <div className="my-shift-attendance-control">
          {showAttendanceAsPresent ? (
            <span className="my-shift-attendance-status is-present">
              Marcada como presente
            </span>
          ) : canMarkSelectedAttendance ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleMarkAttendance}
              disabled={attendanceSaving || bitacoraLength < BITACORA_MIN_LENGTH}
            >
              {attendanceSaving ? "Registrando..." : "Marcar presente"}
            </button>
          ) : (
            <span className="my-shift-attendance-status">
              {selectedShiftIsCurrent && !canRegisterShift
                ? "Sin permiso"
                : selectedShiftIsCurrent
                  ? "Pendiente"
                  : "No disponible"}
            </span>
          )}
        </div>
      </section>
    </div>
  </div>
) : null}
    </section>
  );
}
