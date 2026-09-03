import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive } from "lucide-react";
import { useParams } from "react-router-dom";
import IconButton from "../components/common/IconButton";
import PageBreadcrumb from "../components/PageBreadcrumb";
import {
	archiveTask,
	createTaskComment,
	getTaskDetail,
	getTaskModuleAccess,
	updateTaskAssignmentStatus,
} from "../services/task.service";
import {
	formatDateTime,
	formatShortDate,
	historyActionLabel,
	sanitizeTaskHtml,
	statusLabel,
	userLabel,
} from "../utils/task-ui";
import "../styles/home.page.css";
import "../styles/tasks.page.css";

const DETAIL_TABS = [
	{ id: "info", label: "Información" },
	{ id: "comments", label: "Comentarios" },
	{ id: "history", label: "Historial" },
];

export default function TaskDetailPage() {
	const { id } = useParams();
	const [access, setAccess] = useState(null);
	const [task, setTask] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingAssignmentStatus, setIsSavingAssignmentStatus] = useState(false);
	const [isArchiving, setIsArchiving] = useState(false);
	const [activeTab, setActiveTab] = useState("info");
	const [error, setError] = useState("");
	const [commentDraft, setCommentDraft] = useState("");
	const [commentTarget, setCommentTarget] = useState("general");
	const [assignmentStatus, setAssignmentStatus] = useState("pendiente");
	const [assignmentStatusComment, setAssignmentStatusComment] = useState("");

	const capabilities = access?.capabilities || {};
	const scopes = access?.scopes || {};
	const currentUserId = access?.context?.currentUserId ?? null;
	const currentUserAssignment = useMemo(() => {
		if (!task) {
			return null;
		}

		return task.assignments.find((assignment) => assignment.isCurrentUserAssignment)
			|| task.assignments.find((assignment) => assignment.id === task.currentUserAssignmentId)
			|| null;
	}, [task]);

	const generalComments = useMemo(() => {
		return (task?.comments || []).filter((comment) => comment.type === "general");
	}, [task?.comments]);

	const assignmentCommentGroups = useMemo(() => {
		const grouped = new Map();

		for (const comment of task?.comments || []) {
			if (comment.type !== "assignment" || !comment.assignmentId) {
				continue;
			}

			if (!grouped.has(comment.assignmentId)) {
				grouped.set(comment.assignmentId, {
					assignmentId: comment.assignmentId,
					assignmentUser: comment.assignmentUser,
					items: [],
				});
			}

			grouped.get(comment.assignmentId).items.push(comment);
		}

		return Array.from(grouped.values());
	}, [task?.comments]);

	const commentAssignmentOptions = useMemo(() => {
		if (!task) {
			return [];
		}

		if (scopes.comment === "mine") {
			return task.assignments.filter((assignment) => assignment.user?.id === currentUserId);
		}

		return task.assignments;
	}, [currentUserId, scopes.comment, task]);

	const loadDetail = useCallback(async () => {
		setLoading(true);
		setError("");

		try {
			const [moduleAccess, taskDetail] = await Promise.all([
				getTaskModuleAccess(),
				getTaskDetail(id),
			]);

			setAccess(moduleAccess);
			setTask(taskDetail);
		} catch (requestError) {
			setTask(null);
			setAccess(null);
			setError(
				requestError instanceof Error
					? requestError.message
					: "No se pudo cargar el detalle de la tarea",
			);
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		void loadDetail();
	}, [loadDetail]);

	useEffect(() => {
		if (!task) {
			setCommentDraft("");
			setCommentTarget("general");
			setAssignmentStatus("pendiente");
			setAssignmentStatusComment("");
			return;
		}

		if (currentUserAssignment) {
			setAssignmentStatus(currentUserAssignment.status || "pendiente");
			setAssignmentStatusComment(currentUserAssignment.completionNote || "");
		}

		if (scopes.comment === "mine" && currentUserAssignment) {
			setCommentTarget(String(currentUserAssignment.id));
			return;
		}

		setCommentTarget("general");
	}, [currentUserAssignment, scopes.comment, task]);

	async function handleArchive() {
		if (!task || task.status !== "completada" || !capabilities.canArchiveTask) {
			return;
		}

		setIsArchiving(true);
		setError("");
		try {
			const updatedTask = await archiveTask(task.id);
			setTask(updatedTask);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "No se pudo archivar la tarea");
		} finally {
			setIsArchiving(false);
		}
	}

	async function handleAssignmentStatusSubmit() {
		if (!currentUserAssignment || !capabilities.canUpdateOwnAssignmentStatus || task?.status === "archivada") {
			return;
		}

		setIsSavingAssignmentStatus(true);
		setError("");
		try {
			const response = await updateTaskAssignmentStatus(currentUserAssignment.id, {
				estado: assignmentStatus,
				comentario: assignmentStatusComment.trim() || undefined,
			});

			setTask(response.task);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "No se pudo actualizar el estado");
		} finally {
			setIsSavingAssignmentStatus(false);
		}
	}

	async function handleCommentSubmit(event) {
		event.preventDefault();
		if (!task || !commentDraft.trim()) {
			return;
		}

		const isGeneralComment = commentTarget === "general";

		setIsSubmitting(true);
		setError("");
		try {
			await createTaskComment({
				taskId: task.id,
				tipo: isGeneralComment ? "general" : "assignment",
				assignmentId: isGeneralComment ? undefined : Number(commentTarget),
				comentario: commentDraft.trim(),
			});
			setCommentDraft("");
			await loadDetail();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "No se pudo crear el comentario");
		} finally {
			setIsSubmitting(false);
		}
	}

	function renderCommentsTab() {
		return (
			<div className="task-detail-stack">
				<section className="task-detail-section task-detail-panel-card">
					<div className="task-section-header">
						<h3>Comentarios generales</h3>
						<span>{generalComments.length}</span>
					</div>
					<div className="detail-comment-list">
						{generalComments.map((comment) => (
							<article key={comment.id} className="detail-comment-card">
								<div className="detail-comment-head">
									<div>
										<strong>{userLabel(comment.author)}</strong>
										<p>Comentario visible para todos los involucrados</p>
									</div>
									<small>{formatDateTime(comment.createdAt)}</small>
								</div>
								<p>{comment.text}</p>
							</article>
						))}
						{generalComments.length === 0 ? (
							<div className="kanban-empty">Todavía no hay comentarios generales en esta tarea.</div>
						) : null}
					</div>
				</section>

				<section className="task-detail-section task-detail-panel-card">
					<div className="task-section-header">
						<h3>Seguimiento por asignación</h3>
						<span>{assignmentCommentGroups.length}</span>
					</div>
					<div className="task-assignment-comment-groups">
						{assignmentCommentGroups.map((group) => (
							<section key={group.assignmentId} className="detail-comment-thread">
								<header className="detail-comment-thread-header">
									<strong>{userLabel(group.assignmentUser) || `Asignación #${group.assignmentId}`}</strong>
									<small>Asignación #{group.assignmentId}</small>
								</header>
								<div className="detail-comment-list">
									{group.items.map((comment) => (
										<article key={comment.id} className="detail-comment-card">
											<div className="detail-comment-head">
												<div>
													<strong>{userLabel(comment.author)}</strong>
													<p>Comentario privado de seguimiento</p>
												</div>
												<small>{formatDateTime(comment.createdAt)}</small>
											</div>
											<p>{comment.text}</p>
										</article>
									))}
								</div>
							</section>
						))}
						{assignmentCommentGroups.length === 0 ? (
							<div className="kanban-empty">No hay conversaciones privadas de asignación visibles para tu alcance.</div>
						) : null}
					</div>
				</section>

				{capabilities.canCommentTasks ? (
					<section className="task-detail-section task-detail-panel-card">
						<div className="task-section-header">
							<h3>Agregar comentario</h3>
							<span>{commentTarget === "general" ? "General" : "Asignación"}</span>
						</div>
						<form className="task-comment-form" onSubmit={handleCommentSubmit}>
							<select value={commentTarget} onChange={(event) => setCommentTarget(event.target.value)}>
								<option value="general">Comentario general</option>
								{commentAssignmentOptions.map((assignment) => (
									<option key={assignment.id} value={String(assignment.id)}>
										Seguimiento: {userLabel(assignment.user)}
									</option>
								))}
							</select>
							<textarea
								value={commentDraft}
								onChange={(event) => setCommentDraft(event.target.value)}
								placeholder="Comparte avance, contexto o bloqueo."
							/>
							<button className="btn-main" type="submit" disabled={isSubmitting || !commentDraft.trim()}>
								{isSubmitting ? "Publicando..." : "Publicar comentario"}
							</button>
						</form>
					</section>
				) : null}
			</div>
		);
	}

	function renderHistoryTab() {
		return (
			<section className="task-detail-section task-detail-panel-card">
				<div className="task-section-header">
					<h3>Historial</h3>
					<span>{task.history.length}</span>
				</div>
				<div className="detail-history-list">
					{task.history.map((item) => (
						<article key={item.id} className="detail-history-card">
							<div className="detail-history-head">
								<div>
									<strong>{userLabel(item.actor)}</strong>
									<p>{historyActionLabel(item)}</p>
								</div>
								<small>{formatDateTime(item.createdAt)}</small>
							</div>
							{item.fromStatus || item.toStatus ? (
								<small>
									{statusLabel(item.fromStatus || "pendiente")} → {statusLabel(item.toStatus || "pendiente")}
								</small>
							) : null}
							{item.comment ? <p>{item.comment}</p> : null}
						</article>
					))}
					{task.history.length === 0 ? (
						<div className="kanban-empty">Aún no hay eventos registrados en esta tarea.</div>
					) : null}
				</div>
			</section>
		);
	}

	function renderInfoTab() {
		return (
			<div className="task-detail-stack">
				<section className="task-detail-section task-detail-panel-card">
					<div className="task-detail-meta-grid">
						<div>
							<span>Estado global</span>
							<strong>{statusLabel(task.status)}</strong>
						</div>
						<div>
							<span>Fecha límite</span>
							<strong>{formatShortDate(task.dueDate)}</strong>
						</div>
						<div>
							<span>Creador</span>
							<strong>{userLabel(task.creator)}</strong>
						</div>
					</div>
				</section>

				<section className="task-detail-section task-detail-panel-card">
					<div className="task-section-header">
						<h3>Asignaciones</h3>
						<span>{task.assignments.length}</span>
					</div>
					<div className="detail-assignment-list">
						{task.assignments.map((assignment) => (
							<article key={assignment.id} className="detail-assignment-item">
								<div className="detail-assignment-row">
									<div>
										<strong>{userLabel(assignment.user)}</strong>
										<p>{assignment.user?.areaName || "Sin área"}</p>
									</div>
									<span className="detail-status-chip">{statusLabel(assignment.status)}</span>
								</div>
								<p>
									Asignada por {userLabel(assignment.assignedBy)}
									{assignment.completedAt ? ` · completada el ${formatDateTime(assignment.completedAt)}` : ""}
								</p>
								{assignment.completionNote ? <small>{assignment.completionNote}</small> : null}
							</article>
						))}
						{task.assignments.length === 0 ? (
							<div className="kanban-empty">Esta tarea no tiene usuarios asignados.</div>
						) : null}
					</div>
				</section>

				{capabilities.canUpdateOwnAssignmentStatus && currentUserAssignment && task.status !== "archivada" ? (
					<section className="task-detail-section task-detail-panel-card">
						<div className="task-section-header">
							<h3>Mi estado</h3>
							<span>{statusLabel(currentUserAssignment.status)}</span>
						</div>
						<div className="assignment-status-editor">
							<select
								value={assignmentStatus}
								onChange={(event) => setAssignmentStatus(event.target.value)}
							>
								{(access?.policies?.assignmentStatuses || []).map((status) => (
									<option key={status} value={status}>{statusLabel(status)}</option>
								))}
							</select>
							<textarea
								value={assignmentStatusComment}
								onChange={(event) => setAssignmentStatusComment(event.target.value)}
								placeholder="Comentario opcional sobre tu avance o cierre"
							/>
							<button
								type="button"
								className="btn-main"
								disabled={isSavingAssignmentStatus}
								onClick={() => void handleAssignmentStatusSubmit()}
							>
								{isSavingAssignmentStatus ? "Guardando..." : "Actualizar mi estado"}
							</button>
						</div>
					</section>
				) : null}
			</div>
		);
	}

	if (loading) {
		return (
			<section className="tasks-page">
				<div className="tasks-body">
					<div className="tasks-feedback">Cargando detalle de la tarea...</div>
				</div>
			</section>
		);
	}

	if (!task) {
		return (
			<section className="tasks-page">
				<div className="tasks-body">
					<div className="task-detail-page">
						<PageBreadcrumb moduleLabel="Tareas" moduleTo="/tareas" currentLabel="Detalle" />
						<div className="tasks-feedback tasks-error">
							{error || "No fue posible acceder a esta tarea."}
						</div>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className="tasks-page">
			<div className="tasks-body">
				<div className="task-detail-page">
					<PageBreadcrumb moduleLabel="Tareas" moduleTo="/tareas" currentLabel="Detalle" />

					<header className="task-detail-hero detail-header-accent">
						<div className="task-detail-heading">
							<p className="task-detail-eyebrow">{task.area?.name || "Sin área"}</p>
							<h1>{task.title}</h1>
							<div
								className="task-rich-content"
								dangerouslySetInnerHTML={{ __html: sanitizeTaskHtml(task.description || "<p>Sin descripción.</p>") }}
							/>
						</div>

						<div className="task-detail-actions-bar">
							<span className={`task-priority task-priority-${task.priority}`.trim()}>
								{task.priority}
							</span>
							{capabilities.canArchiveTask && task.status === "completada" ? (
								<IconButton
									icon={Archive}
									label="Archivar tarea"
									variant="warning"
									disabled={isArchiving}
									loading={isArchiving}
									onClick={() => void handleArchive()}
								/>
							) : null}
						</div>
					</header>

					{error ? <div className="tasks-feedback tasks-error">{error}</div> : null}

					<nav className="home-tabs tasks-tabs" role="tablist" aria-label="Tabs de detalle de tarea">
						{DETAIL_TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={activeTab === tab.id}
								className={`home-tab home-tab-button ${activeTab === tab.id ? "home-tab-button-active" : ""}`.trim()}
								onClick={() => setActiveTab(tab.id)}
							>
								{tab.label}
							</button>
						))}
					</nav>

					{activeTab === "info" ? renderInfoTab() : null}
					{activeTab === "comments" ? renderCommentsTab() : null}
					{activeTab === "history" ? renderHistoryTab() : null}
				</div>
			</div>
		</section>
	);
}
