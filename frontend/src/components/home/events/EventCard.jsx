import { Pencil, Trash2 } from "lucide-react";
import IconButton from "../../common/IconButton";
import {
  formatEventCategory,
  getEventCategoryClass,
} from "../../../constants/eventCategories";

function formatDate(value, options) {
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return value || "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", options).format(dateValue);
}

function formatDateRange(event) {
  if (!event.startAt || !event.endAt) {
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
  if (!event.startAt || !event.endAt) {
    return "Horario pendiente";
  }

  if (event.allDay) {
    return "Evento de dia completo";
  }

  const startTime = formatDate(event.startAt, { hour: "2-digit", minute: "2-digit" });
  const endTime = formatDate(event.endAt, { hour: "2-digit", minute: "2-digit" });
  return `${startTime} - ${endTime}`;
}

export default function EventCard({ event, onEdit, onDelete, canUpdate, canDelete }) {
  return (
    <article className="event-card">
      <div className="event-meta">
        <span className={`badge ${getEventCategoryClass(event.category)} event-category-badge`}>
          {formatEventCategory(event.category)}
        </span>
        <span className="event-date">{formatDateRange(event)}</span>
      </div>
      <h4>{event.title}</h4>
      <p>{event.description || "Sin descripción"}</p>
      <div className="event-extra">
        <span>{event.location || "Sin lugar"}</span>
        <span>{formatSchedule(event)}</span>
      </div>
      {canUpdate || canDelete ? (
        <div className="event-actions">
          {canUpdate ? (
            <IconButton
              icon={Pencil}
              label={`Editar evento ${event.title || ""}`.trim()}
              variant="secondary"
              onClick={() => onEdit(event)}
            />
          ) : null}
          {canDelete ? (
            <IconButton
              icon={Trash2}
              label={`Eliminar evento ${event.title || ""}`.trim()}
              variant="danger"
              onClick={() => onDelete(event.id)}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
