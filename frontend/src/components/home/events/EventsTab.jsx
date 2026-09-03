import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import { Pencil, Trash2 } from "lucide-react";
import IconButton from "../../common/IconButton";
import ModalCloseButton from "../../common/ModalCloseButton";
import EventFilters from "./EventFilters";
import {
  EVENT_CATEGORY,
  EVENT_CATEGORY_OPTIONS,
  formatEventCategory,
  getEventCategoryClass,
  normalizeEventCategory,
} from "../../../constants/eventCategories";

function isValidDate(value) {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);
  return !Number.isNaN(parsedDate.getTime());
}

function toDateTimestamp(eventItem) {
  if (!isValidDate(eventItem.startAt)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return new Date(eventItem.startAt).getTime();
}

function toLocalDateInput(value) {
  if (!isValidDate(value)) {
    return "";
  }

  const dateValue = new Date(value);
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalDateTimeInput(value) {
  if (!isValidDate(value)) {
    return "";
  }

  const dateValue = new Date(value);
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  const hours = String(dateValue.getHours()).padStart(2, "0");
  const minutes = String(dateValue.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createLocalMidnight(dateValue) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function addDays(dateValue, amount) {
  const parsedDate = createLocalMidnight(dateValue);
  if (!parsedDate) {
    return "";
  }

  parsedDate.setDate(parsedDate.getDate() + amount);
  return toLocalDateInput(parsedDate.toISOString());
}

function toAllDayInclusiveEnd(value) {
  if (!isValidDate(value)) {
    return "";
  }

  const dateValue = new Date(value);
  dateValue.setDate(dateValue.getDate() - 1);
  return toLocalDateInput(dateValue.toISOString());
}

function formatDate(value, options) {
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return value || "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", options).format(dateValue);
}

function formatDateRange(event) {
  if (!event?.startAt || !event?.endAt) {
    return "Fecha pendiente";
  }

  if (event.allDay) {
    const startLabel = formatDate(event.startAt, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const endDate = new Date(event.endAt);
    endDate.setDate(endDate.getDate() - 1);
    const endLabel = formatDate(endDate, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (startLabel === endLabel) {
      return `Todo el dia · ${startLabel}`;
    }

    return `Todo el dia · ${startLabel} - ${endLabel}`;
  }

  const startLabel = formatDate(event.startAt, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endLabel = formatDate(event.endAt, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatSchedule(event) {
  if (!event?.startAt || !event?.endAt) {
    return "Horario pendiente";
  }

  if (event.allDay) {
    return "Evento de dia completo";
  }

  const startTime = formatDate(event.startAt, { hour: "2-digit", minute: "2-digit" });
  const endTime = formatDate(event.endAt, { hour: "2-digit", minute: "2-digit" });
  return `${startTime} - ${endTime}`;
}

function toCalendarEvent(eventItem, selectedCalendarEventId) {
  if (!eventItem.isValidRange) {
    return null;
  }

  return {
    id: String(eventItem.id),
    title: eventItem.title,
    start: eventItem.startAt,
    end: eventItem.endAt,
    allDay: Boolean(eventItem.allDay),
    classNames: [
      getEventCategoryClass(eventItem.category),
      String(selectedCalendarEventId) === String(eventItem.id) ? "fc-event-selected" : "",
    ].filter(Boolean),
    extendedProps: {
      descripcion: eventItem.description,
      lugar: eventItem.location,
      activo: eventItem.active,
      categoria: eventItem.category,
    },
  };
}

function getDefaultFormState() {
  return {
    title: "",
    location: "",
    description: "",
    category: EVENT_CATEGORY.COMUNITARIO,
    allDay: false,
    startDateTime: "",
    endDateTime: "",
    startDate: "",
    endDate: "",
  };
}

function getFormStateFromEvent(eventItem) {
  if (!eventItem) {
    return getDefaultFormState();
  }

  if (eventItem.allDay) {
    return {
      title: eventItem.title ?? "",
      location: eventItem.location ?? "",
      description: eventItem.description ?? "",
      category: normalizeEventCategory(eventItem.category),
      allDay: true,
      startDateTime: "",
      endDateTime: "",
      startDate: toLocalDateInput(eventItem.startAt),
      endDate: toAllDayInclusiveEnd(eventItem.endAt) || toLocalDateInput(eventItem.startAt),
    };
  }

  return {
    title: eventItem.title ?? "",
    location: eventItem.location ?? "",
    description: eventItem.description ?? "",
    category: normalizeEventCategory(eventItem.category),
    allDay: false,
    startDateTime: toLocalDateTimeInput(eventItem.startAt),
    endDateTime: toLocalDateTimeInput(eventItem.endAt),
    startDate: "",
    endDate: "",
  };
}

function validateEventForm(eventForm) {
  if (!eventForm.title.trim()) {
    return "Debes ingresar un título para el evento.";
  }

  if (!eventForm.location.trim()) {
    return "Debes ingresar un lugar para el evento.";
  }

  if (!eventForm.description.trim()) {
    return "Debes ingresar una descripción para el evento.";
  }

  if (!eventForm.category) {
    return "Debes seleccionar una categoria para el evento.";
  }

  if (eventForm.allDay) {
    if (!eventForm.startDate || !eventForm.endDate) {
      return "Debes completar la fecha de inicio y la fecha final del evento.";
    }

    const startDate = createLocalMidnight(eventForm.startDate);
    const endDateExclusive = createLocalMidnight(addDays(eventForm.endDate, 1));
    if (!startDate || !endDateExclusive || endDateExclusive.getTime() <= startDate.getTime()) {
      return "La fecha final debe ser posterior a la fecha inicial.";
    }

    return "";
  }

  if (!eventForm.startDateTime || !eventForm.endDateTime) {
    return "Debes completar la fecha y hora de inicio y fin del evento.";
  }

  const startDate = new Date(eventForm.startDateTime);
  const endDate = new Date(eventForm.endDateTime);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return "La fecha y hora de fin debe ser posterior a la fecha y hora de inicio.";
  }

  return "";
}

function buildEventPayload(eventForm) {
  if (eventForm.allDay) {
    const startDate = createLocalMidnight(eventForm.startDate);
    const endDateExclusive = createLocalMidnight(addDays(eventForm.endDate, 1));

    return {
      titulo: eventForm.title.trim(),
      lugar: eventForm.location.trim(),
      descripcion: eventForm.description.trim(),
      categoria: normalizeEventCategory(eventForm.category),
      todo_el_dia: true,
      fecha_inicio: startDate?.toISOString(),
      fecha_fin: endDateExclusive?.toISOString(),
    };
  }

  return {
    titulo: eventForm.title.trim(),
    lugar: eventForm.location.trim(),
    descripcion: eventForm.description.trim(),
    categoria: normalizeEventCategory(eventForm.category),
    todo_el_dia: false,
    fecha_inicio: new Date(eventForm.startDateTime).toISOString(),
    fecha_fin: new Date(eventForm.endDateTime).toISOString(),
  };
}

export default function EventsTab({
  events = [],
  isLoading,
  error,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}) {
  const calendarHostRef = useRef(null);
  const calendarRef = useRef(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingEventId, setEditingEventId] = useState(null);
  const [selectedCalendarEventId, setSelectedCalendarEventId] = useState(null);
  const [formError, setFormError] = useState("");
  const [eventForm, setEventForm] = useState(getDefaultFormState);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = events.filter((eventItem) => {
      const matchesCategory = !categoryFilter || normalizeEventCategory(eventItem.category) === categoryFilter;
      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [eventItem.title, eventItem.location, eventItem.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    return result.sort((left, right) => toDateTimestamp(left) - toDateTimestamp(right));
  }, [categoryFilter, events, search]);

  const calendarEvents = useMemo(
    () => filteredEvents
      .map((eventItem) => toCalendarEvent(eventItem, selectedCalendarEventId))
      .filter(Boolean),
    [filteredEvents, selectedCalendarEventId],
  );

  const selectedEvent = useMemo(
    () => events.find((eventItem) => String(eventItem.id) === String(selectedCalendarEventId)) || null,
    [events, selectedCalendarEventId],
  );

  const resetForm = () => {
    setEventForm(getDefaultFormState());
    setFormError("");
  };

  const clearSelectedEvent = () => {
    setSelectedCalendarEventId(null);
    setIsDetailModalOpen(false);
  };

  const openCreateModal = () => {
    if (!canCreate) {
      return;
    }

    setModalMode("create");
    setEditingEventId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (eventItem) => {
    if (!canUpdate) {
      return;
    }

    setIsDetailModalOpen(false);
    setModalMode("edit");
    setEditingEventId(eventItem.id);
    setEventForm(getFormStateFromEvent(eventItem));
    setFormError("");
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setFormError("");
  };

  const closeDetailModal = () => {
    if (isDeletingEvent) {
      return;
    }

    clearSelectedEvent();
  };

  const handleDelete = async (id) => {
    if (!canDelete) {
      return;
    }

    await onDeleteEvent(id);
  };

  const handleDeleteFromDetail = async () => {
    if (!selectedEvent || !canDelete || isDeletingEvent) {
      return;
    }

    const confirmed = window.confirm("Seguro que quieres eliminar este evento?");
    if (!confirmed) {
      return;
    }

    setIsDeletingEvent(true);
    try {
      await onDeleteEvent(selectedEvent.id);
      clearSelectedEvent();
    } finally {
      setIsDeletingEvent(false);
    }
  };

  useEffect(() => {
    if (calendarRef.current || !calendarHostRef.current) {
      return;
    }

    const calendar = new Calendar(calendarHostRef.current, {
      plugins: [dayGridPlugin],
      initialView: "dayGridMonth",
      locale: "es",
      headerToolbar: {
        left: "title prev,next",
        center: "",
        right: "",
      },
      buttonText: { today: "Hoy", month: "Mes" },
      events: calendarEvents,
      height: "auto",
      eventDisplay: "block",
      datesSet: (arg) => {
        const titleElement = calendarHostRef.current?.querySelector(".fc-toolbar-title");
        if (!titleElement || !arg.view?.title) {
          return;
        }

        const [firstCharacter, ...rest] = arg.view.title;
        titleElement.textContent = `${firstCharacter.toUpperCase()}${rest.join("")}`;
      },
      eventClick: (info) => {
        setSelectedCalendarEventId(info.event.id);
        setIsDetailModalOpen(true);
      },
    });

    calendar.render();
    calendarRef.current = calendar;

    return () => {
      calendar.destroy();
      calendarRef.current = null;
    };
  }, [isLoading]);

  useEffect(() => {
    if (!calendarRef.current) {
      return;
    }

    calendarRef.current.removeAllEvents();
    calendarEvents.forEach((eventItem) => {
      calendarRef.current?.addEvent(eventItem);
    });
  }, [calendarEvents]);

  useEffect(() => {
    if (!selectedCalendarEventId) {
      return;
    }

    const existsInCurrentList = filteredEvents.some(
      (eventItem) => String(eventItem.id) === String(selectedCalendarEventId),
    );

    if (!existsInCurrentList) {
      clearSelectedEvent();
    }
  }, [filteredEvents, selectedCalendarEventId]);

  const handleInputChange = (field, value) => {
    setEventForm((currentValue) => {
      if (field === "allDay") {
        if (value) {
          return {
            ...currentValue,
            allDay: true,
            startDate: currentValue.startDate || currentValue.startDateTime.slice(0, 10),
            endDate:
              currentValue.endDate
              || currentValue.endDateTime.slice(0, 10)
              || currentValue.startDateTime.slice(0, 10),
            startDateTime: "",
            endDateTime: "",
          };
        }

        return {
          ...currentValue,
          allDay: false,
          startDateTime: currentValue.startDate ? `${currentValue.startDate}T09:00` : "",
          endDateTime: currentValue.endDate ? `${currentValue.endDate}T10:00` : "",
          startDate: "",
          endDate: "",
        };
      }

      return {
        ...currentValue,
        [field]: value,
      };
    });
    setFormError("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const validationError = validateEventForm(eventForm);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const payload = buildEventPayload(eventForm);

      if (modalMode === "edit") {
        await onUpdateEvent(editingEventId, payload);
      } else {
        await onCreateEvent(payload);
      }

      resetForm();
      setEditingEventId(null);
      setIsModalOpen(false);
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible guardar el evento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="events-calendar-shell">
      <div className="events-calendar-header">
        <div className="events-calendar-toolbar">
          <EventFilters
            search={search}
            category={categoryFilter}
            onSearchChange={setSearch}
            onCategoryChange={setCategoryFilter}
          />

          {canCreate ? (
            <button type="button" className="btn btn-create-home events-create-button" onClick={openCreateModal}>
              Nuevo evento
            </button>
          ) : null}
        </div>

        {!isLoading && !error && filteredEvents.length === 0 ? (
          <p className="list-message">No hay eventos que coincidan con los filtros.</p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <article className="calendar-card calendar-card-full">
        {isLoading ? (
          <p className="list-message">Cargando eventos...</p>
        ) : (
          <div className="calendar-wrap calendar-wrap-large" ref={calendarHostRef} />
        )}
      </article>

      {isDetailModalOpen && selectedEvent ? (
        <div className="modal-overlay" role="presentation" onClick={closeDetailModal}>
          <div
            className="event-modal event-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <div>
                <h3 id="event-detail-title">{selectedEvent.title || "Detalle de evento"}</h3>
                <p>Resumen del evento seleccionado en el calendario.</p>
              </div>

              <ModalCloseButton className="modal-close-button" onClick={closeDetailModal} />
            </div>

            <div className="event-detail-body">
              <div className="event-detail-meta">
                <span className={`badge ${getEventCategoryClass(selectedEvent.category)} event-category-badge`}>
                  {formatEventCategory(selectedEvent.category)}
                </span>
                <span className="event-detail-status">
                  {selectedEvent.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="event-detail-grid">
                <div className="event-detail-field">
                  <span>Fecha</span>
                  <strong>{formatDateRange(selectedEvent)}</strong>
                </div>

                <div className="event-detail-field">
                  <span>Horario</span>
                  <strong>{formatSchedule(selectedEvent)}</strong>
                </div>

                <div className="event-detail-field">
                  <span>Modalidad</span>
                  <strong>{selectedEvent.allDay ? "Todo el dia" : "Con horario"}</strong>
                </div>

                <div className="event-detail-field">
                  <span>Lugar</span>
                  <strong>{selectedEvent.location || "Sin lugar"}</strong>
                </div>

                <div className="event-detail-field event-detail-field-full">
                  <span>Descripción</span>
                  <p>{selectedEvent.description || "Sin descripción"}</p>
                </div>
              </div>
            </div>

            <div className="event-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeDetailModal}>
                Cancelar
              </button>
              {canUpdate ? (
                <IconButton
                  icon={Pencil}
                  label={`Editar evento ${selectedEvent.title || ""}`.trim()}
                  variant="secondary"
                  onClick={() => openEditModal(selectedEvent)}
                />
              ) : null}
              {canDelete ? (
                <IconButton
                  icon={Trash2}
                  label={`Eliminar evento ${selectedEvent.title || ""}`.trim()}
                  variant="danger"
                  onClick={handleDeleteFromDetail}
                  disabled={isDeletingEvent}
                  loading={isDeletingEvent}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeCreateModal}>
          <div
            className="event-modal event-modal-large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-event-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <div>
                <h3 id="create-event-title">
                  {modalMode === "edit" ? "Editar evento" : "Crear nuevo evento"}
                </h3>
                <p>
                  {eventForm.allDay
                    ? "Configura el rango del evento usando fechas completas."
                    : "Configura el rango del evento con fecha y hora de inicio y fin."}
                </p>
              </div>

              <ModalCloseButton className="modal-close-button" onClick={closeCreateModal} />
            </div>

            <form className="event-modal-form" onSubmit={handleCreate}>
              <label className="form-field full" htmlFor="event-title">
                <span>Título</span>
                <input
                  id="event-title"
                  type="text"
                  placeholder="Ej: Jornada de adopción Providencia"
                  value={eventForm.title}
                  onChange={(event) => handleInputChange("title", event.target.value)}
                  required
                />
              </label>

              <label className="form-field" htmlFor="event-location">
                <span>Lugar</span>
                <input
                  id="event-location"
                  type="text"
                  placeholder="Ej: Centro comunitario"
                  value={eventForm.location}
                  onChange={(event) => handleInputChange("location", event.target.value)}
                  required
                />
              </label>

              <label className="form-field event-toggle-field" htmlFor="event-all-day">
                <span>Modalidad</span>
                <div className="event-toggle-input">
                  <input
                    id="event-all-day"
                    type="checkbox"
                    checked={eventForm.allDay}
                    onChange={(event) => handleInputChange("allDay", event.target.checked)}
                  />
                  <span>Todo el dia</span>
                </div>
              </label>

              <div className="form-field event-form-hint">
                <span>Categoria</span>
                <select
                  value={eventForm.category}
                  onChange={(event) => handleInputChange("category", event.target.value)}
                  className="filter-select"
                  required
                >
                  {EVENT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {eventForm.allDay ? (
                <>
                  <label className="form-field" htmlFor="event-start-date">
                    <span>Fecha inicio</span>
                    <input
                      id="event-start-date"
                      type="date"
                      value={eventForm.startDate}
                      onChange={(event) => handleInputChange("startDate", event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field" htmlFor="event-end-date">
                    <span>Fecha fin</span>
                    <input
                      id="event-end-date"
                      type="date"
                      value={eventForm.endDate}
                      onChange={(event) => handleInputChange("endDate", event.target.value)}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="form-field" htmlFor="event-start">
                    <span>Fecha y hora inicio</span>
                    <input
                      id="event-start"
                      type="datetime-local"
                      value={eventForm.startDateTime}
                      onChange={(event) => handleInputChange("startDateTime", event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field" htmlFor="event-end">
                    <span>Fecha y hora fin</span>
                    <input
                      id="event-end"
                      type="datetime-local"
                      value={eventForm.endDateTime}
                      onChange={(event) => handleInputChange("endDateTime", event.target.value)}
                      required
                    />
                  </label>
                </>
              )}

              <label className="form-field full" htmlFor="event-description">
                <span>Descripción</span>
                <textarea
                  id="event-description"
                  placeholder="Agrega detalles relevantes del evento."
                  value={eventForm.description}
                  onChange={(event) => handleInputChange("description", event.target.value)}
                  required
                />
              </label>

              {formError ? <p className="error-text full">{formError}</p> : null}

              <div className="event-modal-actions full">
                <button type="button" className="btn btn-secondary" onClick={closeCreateModal}>
                  Cancelar
                </button>
                {canCreate || canUpdate ? (
                  <button
                    type="submit"
                    className={modalMode === "create" ? "btn btn-create-home" : "btn btn-primary"}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Guardando..."
                      : modalMode === "edit"
                        ? "Actualizar evento"
                        : "Crear evento"}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
