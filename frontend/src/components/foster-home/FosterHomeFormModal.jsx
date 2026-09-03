import { useEffect, useMemo, useState } from "react";
import ModalCloseButton from "../common/ModalCloseButton";
import "../../styles/home.page.css";
import "../../styles/animals.page.css";
import "../../styles/foster-home.page.css";

function getSelectedUsers(users, selectedIds) {
  return users.filter((user) => selectedIds.includes(Number(user.id)));
}

export default function FosterHomeFormModal({
  isOpen,
  title,
  submitLabel,
  form,
  setForm,
  users = [],
  error,
  isSaving = false,
  isPreparing = false,
  onClose,
  onSubmit,
}) {
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      setUserSearch("");
    }
  }, [isOpen]);

  const selectedUsers = useMemo(() => {
    return getSelectedUsers(users, form?.usuarios_asociados || []);
  }, [users, form?.usuarios_asociados]);

  const filteredUsers = useMemo(() => {
    const searchTerm = userSearch.trim().toLowerCase();

    if (!searchTerm) {
      return users;
    }

    return users.filter((user) => {
      const fullName = `${user.nombre || ""} ${user.apellido || ""}`
        .trim()
        .toLowerCase();

      return fullName.includes(searchTerm);
    });
  }, [userSearch, users]);

  if (!isOpen) return null;

  const handleFormChange = (field, value) => {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const handleToggleAssociatedUser = (userId) => {
    setForm((currentValue) => {
      const normalizedUserId = Number(userId);
      const currentAssociatedUsers = currentValue.usuarios_asociados || [];

      const isSelected = currentAssociatedUsers.includes(normalizedUserId);

      const nextUserIds = isSelected
        ? currentAssociatedUsers.filter((value) => value !== normalizedUserId)
        : [...currentAssociatedUsers, normalizedUserId];

      const nextResponsible = nextUserIds.includes(
        Number(currentValue.responsable_usuario_id)
      )
        ? currentValue.responsable_usuario_id
        : "";

      return {
        ...currentValue,
        usuarios_asociados: nextUserIds,
        responsable_usuario_id: nextResponsible,
      };
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="event-modal foster-modal foster-modal-medium"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="event-modal-header">
          <div>
            <h3>{title}</h3>
            <p className="foster-section-note">
              El hogar temporal usa la ubicación comun de sus miembros activos.
            </p>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {isPreparing ? (
          <p className="foster-muted">Preparando formulario...</p>
        ) : (
          <form className="foster-modal-body" onSubmit={onSubmit}>
            <section className="foster-form-section">
              <div className="foster-form-section-title">
                <h4>Datos base</h4>
                <p>Estado general y observaciones del hogar temporal.</p>
              </div>

              <div className="foster-form-grid">
                <label className="foster-section-field">
                  <span>Activo</span>
                  <select
                    value={form.activo ? "true" : "false"}
                    onChange={(event) => handleFormChange("activo", event.target.value === "true")}
                  >
                    <option value="true">Si</option>
                    <option value="false">No</option>
                  </select>
                </label>

                <label className="foster-section-field full">
                  <span>Observaciones generales</span>
                  <textarea
                    rows="4"
                    value={form.observaciones}
                    onChange={(event) => handleFormChange("observaciones", event.target.value)}
                    placeholder="Notas generales del hogar temporal"
                  />
                </label>
              </div>
            </section>

            <section className="foster-form-section">
              <div className="foster-form-section-title">
                <h4>Usuarios asociados</h4>
                <p>Todos deben compartir la misma ubicación para pertenecer al mismo hogar.</p>
              </div>

              <label className="foster-section-field">
                <span>Responsable del hogar</span>
                <select
                  value={form.responsable_usuario_id}
                  onChange={(event) => handleFormChange("responsable_usuario_id", event.target.value)}
                  disabled={selectedUsers.length === 0}
                >
                  <option value="">Selecciona un responsable</option>
                  {selectedUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {`${user.nombre} ${user.apellido}`.trim()}
                    </option>
                  ))}
                </select>
              </label>

              <div className="foster-checkbox-panel">
                <label className="foster-section-field">
                  <span>Buscar usuario</span>
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Nombre o apellido"
                  />
                </label>

                <div className="foster-checkbox-list">
                  {filteredUsers.length === 0 ? (
                    <p className="foster-muted">No se encontraron usuarios con esa busqueda.</p>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = form.usuarios_asociados.includes(Number(user.id));

                      return (
                        <label key={user.id} className="foster-checkbox-item">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleAssociatedUser(user.id)}
                          />
                          <span>{`${user.nombre} ${user.apellido}`.trim()}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <div className="event-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? "Guardando..." : submitLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
