import EventCard from "./EventCard";

export default function EventList({ events = [], onEdit, onDelete, canUpdate, canDelete }) {
  if (events.length === 0) {
    return <p className="list-message">No hay eventos para mostrar con los filtros actuales.</p>;
  }

  return (
    <div className="event-list">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          onEdit={onEdit}
          onDelete={onDelete}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      ))}
    </div>
  );
}