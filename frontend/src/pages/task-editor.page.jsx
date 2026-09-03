import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageBreadcrumb from "../components/PageBreadcrumb";
import TaskDescriptionEditor from "../components/tasks/TaskDescriptionEditor.jsx";
import {
  createTask,
  getTaskDetail,
  getTaskModuleAccess,
  updateTask,
} from "../services/task.service";
import {
  buildTaskEditorPayload,
  filterAssignableUsersByArea,
  formatUserAreaNames,
  getActorAreaOptions,
  sanitizeAssigneeSelection,
} from "./task-editor.helpers";
import { toApiDate } from "../utils/task-ui";
import "../styles/tasks.page.css";

const TASK_MODULE_ROUTE = "/tareas";

function emptyForm() {
  return {
    title: "",
    description: "<p></p>",
    priority: "media",
    dueDate: "",
    areaId: "",
    assigneeIds: [],
  };
}

export default function TaskEditorPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const [access, setAccess] = useState(null);
  const [task, setTask] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [assignmentAreaFilter, setAssignmentAreaFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const capabilities = access?.capabilities || {};
  const scopes = access?.scopes || {};
  const currentUserAreaId = access?.context?.currentUserAreaId ?? "";
  const currentUserAreaName = access?.context?.currentUserAreaName ?? "";
  const canAssignAny = scopes.assign === "any";
  const areaOptions = useMemo(
    () => (canAssignAny ? (access?.areas || []) : getActorAreaOptions(access)),
    [access, canAssignAny],
  );
  const assignableUsers = useMemo(() => access?.assignableUsers || [], [access?.assignableUsers]);
  const hasModuleAccess = Boolean(capabilities.canAccessModule);
  const assignmentAreaId = canAssignAny
    ? assignmentAreaFilter
    : String(form.areaId || currentUserAreaId || "");

  const visibleUsers = useMemo(() => {
    return filterAssignableUsersByArea(assignableUsers, assignmentAreaId, scopes);
  }, [assignableUsers, assignmentAreaId, scopes]);

  const filteredUsers = useMemo(() => {
    const searchLower = userSearch.toLowerCase();
    return visibleUsers.filter((user) => {
      const fullName = `${user.nombre || ""} ${user.apellido || ""}`.toLowerCase();
      return fullName.includes(searchLower);
    });
  }, [visibleUsers, userSearch]);

  const isFormValid = Boolean(form.title.trim() && form.description && form.dueDate);

  const loadEditorData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const moduleAccess = await getTaskModuleAccess();
      const nextCanAssignAny = moduleAccess.scopes?.assign === "any";
      const actorAreas = getActorAreaOptions(moduleAccess);
      const nextCurrentUserAreaId = moduleAccess.context?.currentUserAreaId ?? actorAreas[0]?.id ?? "";

      setAccess(moduleAccess);
      setAssignmentAreaFilter(nextCanAssignAny ? "" : String(nextCurrentUserAreaId || ""));

      if (!isEditMode) {
        setForm((currentValue) => ({
          ...emptyForm(),
          areaId: nextCanAssignAny ? "" : String(actorAreas[0]?.id || nextCurrentUserAreaId || ""),
        }));
        return;
      }

      const taskDetail = await getTaskDetail(id);
      if (!taskDetail) {
        throw new Error("No se encontró la tarea para editar");
      }

      setTask(taskDetail);
      setForm({
        title: taskDetail.title || "",
        description: taskDetail.description || "<p></p>",
        priority: taskDetail.priority || "media",
        dueDate: taskDetail.dueDate || "",
        areaId: taskDetail.area?.id
          ? String(taskDetail.area.id)
          : (nextCanAssignAny ? "" : String(actorAreas[0]?.id || nextCurrentUserAreaId || "")),
        assigneeIds: taskDetail.assignments
          .map((assignment) => String(assignment.user?.id))
          .filter(Boolean),
      });
      setAssignmentAreaFilter(
        nextCanAssignAny
          ? String(taskDetail.area?.id || taskDetail.assignments[0]?.user?.areaId || "")
          : String(taskDetail.area?.id || actorAreas[0]?.id || nextCurrentUserAreaId || ""),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar el formulario de tareas",
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    void loadEditorData();
  }, [loadEditorData]);

  useEffect(() => {
    setForm((currentValue) => {
      const sanitizedSelection = sanitizeAssigneeSelection(currentValue.assigneeIds, visibleUsers);
      if (sanitizedSelection.length === currentValue.assigneeIds.length) {
        return currentValue;
      }

      return {
        ...currentValue,
        assigneeIds: sanitizedSelection,
      };
    });
  }, [visibleUsers]);

  function handleFieldChange(field, value) {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  function toggleAssignee(userId) {
    setForm((currentValue) => {
      const key = String(userId);
      const isSelected = currentValue.assigneeIds.includes(key);

      return {
        ...currentValue,
        assigneeIds: isSelected
          ? currentValue.assigneeIds.filter((idItem) => idItem !== key)
          : [...currentValue.assigneeIds, key],
      };
    });
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload = buildTaskEditorPayload({
        ...form,
        dueDate: toApiDate(form.dueDate),
      });

      if (isEditMode) {
        await updateTask(id, payload);
        navigate(`/tareas/${id}`);
      } else {
        await createTask(payload);
        navigate(TASK_MODULE_ROUTE);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "No se pudo guardar la tarea",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <section className="tasks-page">
        <div className="tasks-body">
          <div className="tasks-feedback">Cargando formulario de tarea...</div>
        </div>
      </section>
    );
  }

  if (!hasModuleAccess) {
    return (
      <section className="tasks-page">
        <div className="tasks-body">
          <div className="tasks-feedback tasks-error">
            {error || "No tienes permisos suficientes para usar el módulo de tareas."}
          </div>
        </div>
      </section>
    );
  }

  if (isEditMode && (!task || !capabilities.canEditTask)) {
    return (
      <section className="tasks-page">
        <div className="tasks-body">
          <div className="tasks-feedback tasks-error">
            {error || "No tienes permisos suficientes para editar esta tarea."}
          </div>
          <button className="btn-light" type="button" onClick={() => navigate(TASK_MODULE_ROUTE)}>
            Volver a tareas
          </button>
        </div>
      </section>
    );
  }

  if (!isEditMode && !capabilities.canCreateTask) {
    return (
      <section className="tasks-page">
        <div className="tasks-body">
          <div className="tasks-feedback tasks-error">
            {error || "No tienes permisos suficientes para crear tareas."}
          </div>
          <button className="btn-light" type="button" onClick={() => navigate(TASK_MODULE_ROUTE)}>
            Volver a tareas
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="task-create-page">
      <div className="task-create-shell">
        <header className="task-create-header">
          <PageBreadcrumb
            moduleLabel="Tareas"
            moduleTo={TASK_MODULE_ROUTE}
            currentLabel={isEditMode ? "Editar tarea" : "Nueva tarea"}
            className="task-create-breadcrumb"
          />
          <h1>{isEditMode ? "Actualizar tarea" : "Crear tarea"}</h1>
          <p>
            Las áreas editables, los usuarios asignables y el alcance real de esta acción
            vienen resueltos por el backend según tus permisos.
          </p>
        </header>

        <form onSubmit={handleFormSubmit} className="task-create-form">
          <div className="task-create-main-grid">
            <div className="task-create-left-column">
              <section className="create-card create-card-large">
                <label className="create-field-title" htmlFor="task-title">Título</label>
                <input
                  id="task-title"
                  type="text"
                  value={form.title}
                  onChange={(event) => handleFieldChange("title", event.target.value)}
                  placeholder="Ej: Confirmar insumos para jornada veterinaria"
                />
              </section>

              <section className="create-card create-card-large">
                <TaskDescriptionEditor
                  value={form.description}
                  onChange={(value) => handleFieldChange("description", value)}
                />
              </section>
            </div>

            <div className="task-create-right-column">
              <section className="create-card">
                <label className="create-field-title" htmlFor="task-priority">Prioridad</label>
                <select
                  id="task-priority"
                  value={form.priority}
                  onChange={(event) => handleFieldChange("priority", event.target.value)}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>

                <label className="create-field-title task-date-label" htmlFor="task-due-date">Fecha límite</label>
                <input
                  id="task-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => handleFieldChange("dueDate", event.target.value)}
                />

                <label className="create-field-title task-date-label" htmlFor="task-area">Área</label>
                <select
                  id="task-area"
                  value={form.areaId}
                  onChange={(event) => handleFieldChange("areaId", event.target.value)}
                  disabled={canAssignAny ? false : areaOptions.length <= 1}
                >
                  <option value="">{canAssignAny ? "Selecciona un área" : (currentUserAreaName || "Mis áreas")}</option>
                  {areaOptions.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </section>
            </div>
          </div>

          {capabilities.canAssignUsers ? (
            <section className="create-card">
              <div className="create-volunteers-header">
                <div>
                  <h3 className="create-field-title">Asignaciones</h3>
                  <p>
                    {canAssignAny
                      ? "Puedes asignar usuarios de cualquier área permitida por tu alcance."
                      : "Puedes asignar usuarios de tus áreas y al Encargado de Contenido como apoyo transversal."}
                  </p>
                </div>
                <span>{form.assigneeIds.length} seleccionados</span>
              </div>

              {canAssignAny ? (
                <>
                  <label className="create-field-title" htmlFor="task-assignee-area">Filtrar por área</label>
                  <select
                    id="task-assignee-area"
                    value={assignmentAreaId}
                    onChange={(event) => setAssignmentAreaFilter(event.target.value)}
                    disabled={!canAssignAny}
                  >
                    <option value="">Todas las áreas</option>
                    {areaOptions.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              <div className="task-user-checkbox-panel">
                <label className="create-field-title" htmlFor="task-user-search">Buscar usuario</label>
                <input
                  id="task-user-search"
                  type="search"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Nombre o apellido"
                />

                <div className="task-user-checkbox-list">
                  {filteredUsers.length === 0 ? (
                    <p className="task-user-muted">
                      {userSearch
                        ? "No se encontraron usuarios con esa búsqueda."
                        : "No hay usuarios disponibles en esta área."}
                    </p>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = form.assigneeIds.includes(String(user.id));
                      const fullName = `${user.nombre || ""} ${user.apellido || ""}`.trim();
                      const areaLabel = formatUserAreaNames(user);

                      return (
                        <label key={user.id} className="task-user-checkbox-item">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAssignee(user.id)}
                          />
                          <span>
                            <strong>{fullName}</strong>
                            {areaLabel ? ` · ${areaLabel}` : ""}
                            {user.assignmentScopeLabel ? ` · ${user.assignmentScopeLabel}` : ""}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {error ? <div className="tasks-feedback tasks-error">{error}</div> : null}

          <footer className="create-actions-card">
            <div>
              <p>Al guardar, la validación final ocurre en backend.</p>
              <strong>{isEditMode ? "Edición restringida por alcance" : "Nueva tarea dentro de tu alcance"}</strong>
            </div>
            <div className="create-actions-buttons">
              <button className="btn-light" type="button" onClick={() => navigate(TASK_MODULE_ROUTE)}>
                Cancelar
              </button>
              <button className="btn-main" type="submit" disabled={!isFormValid || isSubmitting}>
                {isSubmitting ? "Guardando..." : (isEditMode ? "Guardar cambios" : "Crear tarea")}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </section>
  );
}
