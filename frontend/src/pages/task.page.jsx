import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
	CalendarDays,
	Filter,
	Pencil,
	Plus,
	Search,
	Trash2,
	Users,
} from "lucide-react";
import ActionMenuItem from "../components/common/ActionMenuItem";
import { useAuth } from "../hooks/useAuth";
import {
	deleteTask,
	getTaskModuleAccess,
	getTasks,
} from "../services/task.service";
import {
	formatShortDate,
	htmlToTaskPreview,
	getTaskKanbanStatus,
	matchesTaskSearch,
	profileDescription,
	toSortKey,
	userLabel,
	isTaskOwnedOrAssigned,
	statusLabel,
} from "../utils/task-ui";
import "../styles/home.page.css";
import "../styles/tasks.page.css";

export default function TaskPage() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [access, setAccess] = useState(null);
	const [tasks, setTasks] = useState([]);
	const [bootstrapping, setBootstrapping] = useState(true);
	const [loading, setLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [activeView, setActiveView] = useState("");
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [priorityFilter, setPriorityFilter] = useState("all");
	const [dueFrom, setDueFrom] = useState("");
	const [dueTo, setDueTo] = useState("");
	const [creatorFilter, setCreatorFilter] = useState("");
	const [assigneeFilter, setAssigneeFilter] = useState("");
	const [openTaskMenuId, setOpenTaskMenuId] = useState(null);

	const viewTabs = useMemo(() => access?.views || [], [access?.views]);
	const capabilities = access?.capabilities || {};
	const scopes = access?.scopes || {};
	const currentUserId = access?.context?.currentUserId ?? user?.id ?? null;
	const currentUserAreaId = access?.context?.currentUserAreaId ?? "";
	const currentUserAreaName = access?.context?.currentUserAreaName ?? "";
	const areaOptions = access?.areas || [];
	const assignableUsers = useMemo(() => access?.assignableUsers || [], [access?.assignableUsers]);
	const hasModuleAccess = Boolean(capabilities.canAccessModule);
	const hasBoardView = activeView === "all" || activeView === "assigned" || activeView === "created";
	const hasArchivedView = activeView === "archived";

	const filteredTasks = useMemo(() => {
		return [...tasks]
			.filter((task) => matchesTaskSearch(task, search))
			.sort((left, right) => toSortKey(left.dueDate) - toSortKey(right.dueDate));
	}, [search, tasks]);

	const groupedTasks = useMemo(() => ({
		pendiente: filteredTasks.filter(
			(task) => getTaskKanbanStatus(task, activeView, currentUserId) === "pendiente",
		),
		en_progreso: filteredTasks.filter(
			(task) => getTaskKanbanStatus(task, activeView, currentUserId) === "en_progreso",
		),
		completada: filteredTasks.filter(
			(task) => getTaskKanbanStatus(task, activeView, currentUserId) === "completada",
		),
	}), [activeView, currentUserId, filteredTasks]);

	const summary = useMemo(() => ({
		total: tasks.length,
		pendiente: tasks.filter((task) => task.status === "pendiente").length,
		en_progreso: tasks.filter((task) => task.status === "en_progreso").length,
		completada: tasks.filter((task) => task.status === "completada").length,
		archivada: tasks.filter((task) => task.status === "archivada").length,
	}), [tasks]);

	const selectableUserOptions = useMemo(() => {
		return assignableUsers.map((member) => ({
			id: String(member.id),
			label: `${ `${member.nombre} ${member.apellido}`}`,
		}));
	}, [assignableUsers]);

	const loadModuleAccess = useCallback(async () => {
		setBootstrapping(true);
		setError("");

		try {
			const moduleAccess = await getTaskModuleAccess();
			setAccess(moduleAccess);
		} catch (requestError) {
			setAccess(null);
			setTasks([]);
			setError(
				requestError instanceof Error
					? requestError.message
					: "No se pudo cargar la configuración del módulo de tareas",
			);
		} finally {
			setBootstrapping(false);
		}
	}, []);

	const loadTasksView = useCallback(async () => {
		if (!access || !hasModuleAccess || !activeView) {
			setTasks([]);
			return;
		}

		setLoading(true);
		setError("");

		try {
			const filters = {
				view: activeView,
				estado: hasArchivedView ? undefined : (statusFilter !== "all" ? statusFilter : undefined),
				prioridad: priorityFilter !== "all" ? priorityFilter : undefined,
				dueFrom: capabilities.canFilterByDate ? dueFrom || undefined : undefined,
				dueTo: capabilities.canFilterByDate ? dueTo || undefined : undefined,
				creatorId: capabilities.canFilterByCreator && creatorFilter ? Number(creatorFilter) : undefined,
				assigneeId: capabilities.canFilterByAssignee && assigneeFilter ? Number(assigneeFilter) : undefined,
			};
			const nextTasks = await getTasks(filters);
			setTasks(nextTasks);
		} catch (requestError) {
			setTasks([]);
			setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la vista actual");
		} finally {
			setLoading(false);
		}
	}, [
		access,
		activeView,
		assigneeFilter,
		capabilities.canFilterByAssignee,
		capabilities.canFilterByCreator,
		capabilities.canFilterByDate,
		creatorFilter,
		dueFrom,
		dueTo,
		hasArchivedView,
		hasModuleAccess,
		priorityFilter,
		statusFilter,
	]);

	useEffect(() => {
		void loadModuleAccess();
	}, [loadModuleAccess]);

	useEffect(() => {
		if (!access) {
			return;
		}

		const availableViewIds = viewTabs.map((tab) => tab.id);
		if (!availableViewIds.length) {
			setActiveView("");
			return;
		}

		const requestedTab = searchParams.get("tab");
		if (requestedTab && availableViewIds.includes(requestedTab)) {
			if (requestedTab !== activeView) {
				setActiveView(requestedTab);
			}
			return;
		}

		const nextView = access.defaultView || availableViewIds[0];
		if (nextView !== activeView) {
			setActiveView(nextView);
		}
		setSearchParams((currentParams) => {
			const nextParams = new URLSearchParams(currentParams);
			nextParams.set("tab", nextView);
			return nextParams;
		}, { replace: true });
	}, [access, activeView, searchParams, setSearchParams, viewTabs]);

	useEffect(() => {
		if (bootstrapping || !activeView) {
			return;
		}

		void loadTasksView();
	}, [
		activeView,
		assigneeFilter,
		bootstrapping,
		creatorFilter,
		dueFrom,
		dueTo,
		loadTasksView,
		priorityFilter,
		statusFilter,
	]);

	useEffect(() => {
		if (openTaskMenuId === null) {
			return undefined;
		}

		const handleDocumentClick = () => {
			setOpenTaskMenuId(null);
		};

		document.addEventListener("click", handleDocumentClick);
		return () => document.removeEventListener("click", handleDocumentClick);
	}, [openTaskMenuId]);

	useEffect(() => {
		if (openTaskMenuId !== null) {
			setOpenTaskMenuId(null);
		}
	}, [
		activeView,
		statusFilter,
		priorityFilter,
		dueFrom,
		dueTo,
		creatorFilter,
		assigneeFilter,
	]);

	function resetFilters() {
		setSearch("");
		setStatusFilter("all");
		setPriorityFilter("all");
		setDueFrom("");
		setDueTo("");
		setCreatorFilter("");
		setAssigneeFilter("");
	}

	function canEditTaskCard(task) {
		if (!capabilities.canEditTask) {
			return false;
		}

		if (scopes.update === "any") {
			return true;
		}

		return isTaskOwnedOrAssigned(task, currentUserId);
	}

	function canDeleteTaskCard(task) {
		if (!capabilities.canDeleteTask) {
			return false;
		}

		if (scopes.delete === "any") {
			return true;
		}

		if (scopes.delete === "area") {
			return task.creator?.id === currentUserId;
		}

		if (scopes.delete === "mine") {
			return task.assignments.some((assignment) => assignment.user?.id === currentUserId);
		}

		return false;
	}

	async function handleDelete(task) {
		if (!canDeleteTaskCard(task)) {
			return;
		}

		if (access?.policies?.deleteRequiresNoAssignees && task.assignments.length > 0) {
			setError("No se puede eliminar una tarea con usuarios asignados");
			return;
		}

		const confirmed = window.confirm("¿Seguro que deseas eliminar esta tarea?");
		if (!confirmed) {
			return;
		}

		try {
			await deleteTask(task.id);
			await loadTasksView();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la tarea");
		}
	}

	function handleOpenDetail(taskId) {
		const returnSearch = new URLSearchParams(searchParams);
		if (activeView) {
			returnSearch.set("tab", activeView);
		}

		navigate(`/tareas/${taskId}`, {
			state: {
				returnTo: `/tareas${returnSearch.toString() ? `?${returnSearch.toString()}` : ""}`,
			},
		});
	}

	if (bootstrapping) {
		return (
			<section className="tasks-page">
				<div className="tasks-body">
					<div className="tasks-feedback">Cargando configuración del módulo de tareas...</div>
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

	return (
		<section className="tasks-page">
			<div className="tasks-body">
				<div className="tasks-top-row">
					<div>
						<h1>Tablero de tareas</h1>
						<p>{profileDescription(access?.profile)}</p>
					</div>

					<div className="tasks-actions-row">
						<button className="btn-light" type="button" onClick={() => void loadModuleAccess()}>
							<Filter size={16} />
							Actualizar
						</button>
						{capabilities.canCreateTask ? (
							<button className="btn-main" type="button" onClick={() => navigate("/tareas/crear")}>
								<Plus size={16} />
								Nueva tarea
							</button>
						) : null}
					</div>
				</div>

				{viewTabs.length ? (
					<nav className="home-tabs tasks-tabs" role="tablist" aria-label="Tabs de tareas">
						{viewTabs.map((tab) => (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={activeView === tab.id}
								className={`home-tab home-tab-button ${activeView === tab.id ? "home-tab-button-active" : ""}`.trim()}
								onClick={() => {
									setActiveView(tab.id);
									setSearchParams((currentParams) => {
										const nextParams = new URLSearchParams(currentParams);
										nextParams.set("tab", tab.id);
										return nextParams;
									});
								}}
							>
								{tab.label}
							</button>
						))}
					</nav>
				) : null}

				<div className="tasks-filter-bar">
					<label>
						<span>Buscar</span>
						<div className="tasks-search-wrap">					
							<Search size={16} />
							<input
								type="search"
								placeholder="Buscar por título"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
						</div>
					</label>

					{capabilities.canFilterByPriority ? (
						<label>
							<span>Prioridad</span>
							<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
								<option value="all">Todas</option>
								<option value="alta">Alta</option>
								<option value="media">Media</option>
								<option value="baja">Baja</option>
							</select>
						</label>
					) : null}

					{hasBoardView && capabilities.canFilterByStatus ? (
						<label>
							<span>Estado</span>
							<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
								<option value="all">Todos</option>
								<option value="pendiente">Pendiente</option>
								<option value="en_progreso">En proceso</option>
								<option value="completada">Completada</option>
							</select>
						</label>
					) : null}

					{capabilities.canFilterByDate ? (
						<label>
							<span>Desde</span>
							<input type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} />
						</label>
					) : null}

					{capabilities.canFilterByDate ? (
						<label>
							<span>Hasta</span>
							<input type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} />
						</label>
					) : null}

					{activeView === "all" && capabilities.canFilterByCreator ? (
						<label>
							<span>Creador</span>
							<select value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)}>
								<option value="">Todos</option>
								{selectableUserOptions.map((option) => (
									<option key={`creator-${option.id}`} value={option.id}>{option.label}</option>
								))}
							</select>
						</label>
					) : null}

					{activeView === "all" && capabilities.canFilterByAssignee ? (
						<label>
							<span>Asignado a</span>
							<select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
								<option value="">Todos</option>
								{selectableUserOptions.map((option) => (
									<option key={`assignee-${option.id}`} value={option.id}>{option.label}</option>
								))}
							</select>
						</label>
					) : null}

					<button className="btn-clear" type="button" onClick={resetFilters}>
						Limpiar filtros
					</button>
				</div>

				{error ? <div className="tasks-feedback tasks-error">{error}</div> : null}
				{loading ? <div className="tasks-feedback">Cargando tareas...</div> : null}

				<div className="tasks-summary-row">
					<span>Total: {summary.total}</span>
					<span>Pendientes: {summary.pendiente}</span>
					<span>En proceso: {summary.en_progreso}</span>
					<span>Completadas: {summary.completada}</span>
					{hasArchivedView ? <span>Archivadas: {filteredTasks.length}</span> : null}
				</div>

				<div className="tasks-board-shell">
					{hasBoardView ? (
						<div className="kanban-board">
							{[
								{ id: "pendiente", label: "Pendiente", dotClass: "dot-pending" },
								{ id: "en_progreso", label: "En proceso", dotClass: "dot-progress" },
								{ id: "completada", label: "Completada", dotClass: "dot-done" },
							].map((column) => {
								const items = groupedTasks[column.id] || [];

								return (
									<section key={column.id} className="kanban-column">
										<header className="kanban-column-header">
											<div className="kanban-column-title">
												<span className={`kanban-dot ${column.dotClass}`.trim()} />
												<h2>{column.label}</h2>
											</div>
											<span className="kanban-counter">{items.length}</span>
										</header>

										<div className="kanban-cards">
											{items.length === 0 ? <div className="kanban-empty">Sin tareas en esta columna.</div> : null}
											{items.map((task) => (
												<article key={task.id} className="task-card">
													<div className="task-card-head">
                                                                               <span className={`task-priority task-priority-${task.priority}`.trim()}>{task.priority}</span>
                                                                               {(canEditTaskCard(task) || canDeleteTaskCard(task)) ? (
                                                                               <div className="task-card-menu card-menu-shell" onClick={(event) => event.stopPropagation()}>
                                                                                   <button
                                                                                       type="button"
                                                                                       className="task-card-menu-button card-menu-trigger"
                                                                                       onClick={(event) => {
                                                                                           event.stopPropagation();
                                                                                           setOpenTaskMenuId((currentId) => (currentId === task.id ? null : task.id));
                                                                                       }}
                                                                                       aria-label="Acciones de tarea"
                                                                                       title="Acciones de tarea"
                                                                                   >
                                                                                       ⋮
                                                                                   </button>
                                                                                   {openTaskMenuId === task.id ? (
                                                                                       <div className="task-card-menu-dropdown" onClick={(event) => event.stopPropagation()}>
                                                                                           {canEditTaskCard(task) ? (
                                                                                               <ActionMenuItem
                                                                                                   icon={Pencil}
                                                                                                   label="Editar"
                                                                                                   onClick={(event) => {
                                                                                                       event.stopPropagation();
                                                                                                       setOpenTaskMenuId(null);
                                                                                                       navigate(`/tareas/${task.id}/editar`);
                                                                                                   }}
                                                                                               />
                                                                                           ) : null}
                                                                                           {canDeleteTaskCard(task) && task.assignments.length === 0 ? (
                                                                                               <ActionMenuItem
                                                                                                   icon={Trash2}
                                                                                                   label="Eliminar"
                                                                                                   variant="danger"
                                                                                                   className="task-card-menu-item-danger"
                                                                                                   onClick={(event) => {
                                                                                                       event.stopPropagation();
                                                                                                       setOpenTaskMenuId(null);
                                                                                                       void handleDelete(task);
                                                                                                   }}
                                                                                               />
                                                                                           ) : null}
                                                                                       </div>
                                                                                   ) : null}
                                                                               </div>
                                                                               ) : null}
                                                                               </div>
                                                    <button
                                                    className="task-detail-trigger"
														onClick={() => handleOpenDetail(task.id)}
													>
														<h3>{task.title}</h3>
													</button>

													<p className="task-card-description">{htmlToTaskPreview(task.description) || "Sin descripción"}</p>

													<div className="task-meta-row">
														<span>
															<CalendarDays size={14} />
															{formatShortDate(task.dueDate)}
														</span>
														<span>
															<Users size={14} />
															{task.assignments.length}
														</span>
													</div>



													<p className="task-created-by">
														Creada por {userLabel(task.creator)}
														{task.area?.name ? ` · ${task.area.name}` : ""}
													</p>
												</article>
											))}
										</div>
									</section>
								);
							})}
						</div>
					) : (
						<div className="archived-list">
							{filteredTasks.map((task) => (
								<article key={task.id} className="task-card">
									<div className="task-card-head">
										<span className={`task-priority task-priority-${task.priority}`.trim()}>{task.priority}</span>
										<span className="task-archived-pill">Archivada</span>
									</div>

									<button
										type="button"
										className="task-detail-trigger"
										onClick={() => handleOpenDetail(task.id)}
									>
										<h3>{task.title}</h3>
									</button>

									<p className="task-card-description">{htmlToTaskPreview(task.description) || "Sin descripción"}</p>

									<div className="task-meta-row">
										<span>
											<CalendarDays size={14} />
											{formatShortDate(task.dueDate)}
										</span>
										<span>{task.area?.name || "Sin área"}</span>
									</div>

									<div className="task-assignees">
										{task.assignments.slice(0, 3).map((assignment) => (
											<span key={assignment.id}>
												{userLabel(assignment.user)} · {statusLabel(assignment.status)}
											</span>
										))}
										{task.assignments.length === 0 ? <span>Sin asignados</span> : null}
									</div>
								</article>
							))}

							{filteredTasks.length === 0 ? (
								<div className="kanban-empty">No hay tareas archivadas visibles para este alcance.</div>
							) : null}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
