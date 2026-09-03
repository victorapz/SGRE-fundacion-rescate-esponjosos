import AttachmentList from "../files/AttachmentList";
import FileUploader from "../files/FileUploader";
import PageBreadcrumb from "../PageBreadcrumb";
import { SUPPORTED_FINANCIAL_CURRENCIES, formatMoney } from "../../utils/financial";
import { mergeHistoricalVeterinarianOption } from "./clinicalForm.shared.js";

export const CLINICAL_ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf";

export function buildAnimalHistoryReturnUrl(animalId, historyTab) {
  const query = new URLSearchParams({
    tab: "historial",
    historyTab,
    refresh: String(Date.now()),
  });

  return `/rescatados/${animalId}?${query.toString()}`;
}

export function parseLocalizedDecimalInput(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatResponsibleUser(user) {
  if (!user) return "Usuario autenticado";

  if (user.nombre || user.apellido) {
    return [user.nombre, user.apellido].filter(Boolean).join(" ").trim();
  }

  if (user.email) {
    return user.email;
  }

  if (user.id) {
    return `Usuario #${user.id}`;
  }

  return "Usuario autenticado";
}

export function ClinicalRecordPageShell({
  title,
  subtitle,
  moduleLabel = "Rescatados",
  moduleTo = "/rescatados",
  currentLabel,
  onCancel,
  submitLabel,
  isSubmitting,
  isLoading,
  loadError,
  formError,
  children,
  footerNote = "La validación final ocurre en backend.",
}) {
  return (
    <section className="main-content animals-detail">
      <PageBreadcrumb
        moduleLabel={moduleLabel}
        moduleTo={moduleTo}
        currentLabel={currentLabel || title}
      />

      <div className="crud-card">
        <div className="crud-header">
          <div>
            <h1>{title}</h1>
            <p className="animal-muted">{subtitle}</p>
          </div>
        </div>
      </div>

      {formError ? <p className="error-text">{formError}</p> : null}

      {isLoading ? (
        <div className="crud-card">
          <p className="animal-muted">Cargando formulario...</p>
        </div>
      ) : loadError ? (
        <div className="crud-card">
          <p className="error-text">{loadError}</p>
          <div className="event-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <form className="crud-card animal-form" onSubmit={(event) => event.preventDefault()}>
          {children}

          <div className="create-actions-card">
            <div>
              <p>{footerNote}</p>
            </div>
            <div className="create-actions-buttons">
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancelar
              </button>
              <button type="submit" form="clinical-record-form" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : submitLabel}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

export function ClinicVeterinarianFields({
  clinicId,
  onClinicChange,
  clinics,
  clinicsLoading,
  veterinarianId,
  onVeterinarianChange,
  veterinarians,
  veterinariansLoading,
  currentVeterinarian = null,
}) {
  const veterinarianOptions = mergeHistoricalVeterinarianOption(
    veterinarians,
    currentVeterinarian,
  );

  return (
    <div className="crud-form-grid">
      <label className="animal-form-block">
        <span className="animal-form-label">Clínica</span>
        <select value={clinicId} onChange={(event) => onClinicChange(event.target.value)} required>
          <option value="">
            {clinicsLoading
              ? "Cargando clínicas..."
              : clinics.length === 0
                ? "No hay clínicas disponibles"
                : "Selecciona una clínica"}
          </option>
          {clinics.map((clinic) => (
            <option key={clinic.id} value={clinic.id}>
              {clinic.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="animal-form-block">
        <span className="animal-form-label">Veterinario</span>
        <select
          value={veterinarianId}
          onChange={(event) => onVeterinarianChange(event.target.value)}
          disabled={!clinicId || veterinariansLoading || veterinarianOptions.length === 0}
        >
          <option value="">
            {!clinicId
              ? "Selecciona una clínica primero"
              : veterinariansLoading
                ? "Cargando veterinarios..."
                : veterinarianOptions.length === 0
                  ? "Esta clínica no tiene veterinarios asociados"
                  : "Sin veterinario"}
          </option>
          {veterinarianOptions.map((veterinarian) => (
            <option key={veterinarian.id} value={veterinarian.id}>
              {veterinarian.nombreCompleto || veterinarian.nombre}
              {veterinarian.isHistorical ? " · Histórico" : ""}
            </option>
          ))}
        </select>
        {clinicId && !veterinariansLoading && veterinarianOptions.length === 0 ? (
          <small className="animal-muted">
            Puedes guardar el registro sin veterinario.
          </small>
        ) : currentVeterinarian?.id
            && !veterinariansLoading
            && veterinarianOptions.some((item) => item.isHistorical) ? (
              <small className="animal-muted">
                El veterinario actual se conserva como histórico porque ya no esta disponible para nuevas asociaciones.
              </small>
            ) : null}
      </label>
    </div>
  );
}

export function ClinicalPayableFields({
  form,
  onChange,
  visible,
  canEdit,
  payableLocked = false,
}) {
  if (!visible) return null;

  const disabled = !canEdit || payableLocked;

  return (
    <div className="animal-form-block full">
      <span className="animal-form-label">Cuenta por pagar</span>
      <p className="animal-muted">
        Usa esta seccion solo si el gasto clínico debe sincronizarse con Contabilidad.
      </p>
      <div className="crud-form-grid">
        <label className="animal-form-block full">
          <span className="animal-form-label">Generar cuenta por pagar</span>
          <div className="animal-inline-checkbox">
            <input
              type="checkbox"
              checked={Boolean(form.genera_cuenta_por_pagar)}
              onChange={(event) => onChange("genera_cuenta_por_pagar", event.target.checked)}
              disabled={disabled}
            />
            <span>Activar integración contable</span>
          </div>
        </label>

        <label className="animal-form-block">
          <span className="animal-form-label">Monto</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.monto_total}
            onChange={(event) => onChange("monto_total", event.target.value)}
            placeholder="Ej. 12500 o 12,5"
            disabled={disabled}
          />
        </label>

        <label className="animal-form-block">
          <span className="animal-form-label">Moneda</span>
          <select
            value={form.moneda}
            onChange={(event) => onChange("moneda", event.target.value)}
            disabled={disabled}
          >
            {SUPPORTED_FINANCIAL_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>

        <label className="animal-form-block">
          <span className="animal-form-label">Fecha de vencimiento</span>
          <input
            type="date"
            value={form.fecha_vencimiento_pago}
            onChange={(event) => onChange("fecha_vencimiento_pago", event.target.value)}
            disabled={disabled || !form.genera_cuenta_por_pagar}
          />
        </label>

        <label className="animal-form-block full">
          <span className="animal-form-label">Observación financiera</span>
          <textarea
            rows="3"
            value={form.observacion_financiera}
            onChange={(event) => onChange("observacion_financiera", event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>

      {payableLocked ? (
        <p className="error-text">
          La cuenta por pagar ya posee pagos o movimientos asociados y no puede modificarse desde este registro.
        </p>
      ) : null}
    </div>
  );
}
export function ClinicalAttachmentsSection({
  title = "Adjuntos",
  entityType,
  entityId,
  context,
  isEdit,
  pendingFiles,
  onPendingFilesChange,
  existingFiles,
  filesLoading,
  filesError,
  onRefresh,
  canRead,
  canUpload,
  canDelete,
  warning,
}) {
  const pendingCount = pendingFiles?.length || 0;

  return (
    <div className="clinical-attachments-section">
      <div className="clinical-section-heading">
        <div>
          <h2>{title}</h2>
          <p>
            {isEdit
              ? "Agrega o administra los archivos asociados a este registro."
              : "Selecciona los archivos que deseas adjuntar al examen."}
          </p>
        </div>
      </div>

      {isEdit ? (
        <div className="clinical-attachments-content">
          <FileUploader
            entityType={entityType}
            entityId={entityId}
            context={context}
            defaultVisibility="PRIVADO"
            allowedAccept={CLINICAL_ATTACHMENT_ACCEPT}
            allowMultiple
            autoUpload
            allowVisibility={false}
            allowMain={false}
            buttonLabel="Subir adjuntos"
            compact
            showHeader={false}
            disabled={!canUpload}
            onUploaded={async () => {
              if (canRead && onRefresh) {
                await onRefresh();
              }
            }}
          />

          {canRead ? (
            <AttachmentList
              files={existingFiles}
              loading={filesLoading}
              error={filesError}
              emptyMessage="Este registro no tiene archivos adjuntos."
              showVisibility={false}
              allowDownload
              allowDelete={canDelete}
              allowMarkMain={false}
              onRefresh={onRefresh}
            />
          ) : null}
        </div>
      ) : (
        <div className="clinical-attachments-content">
          <FileUploader
            allowedAccept={CLINICAL_ATTACHMENT_ACCEPT}
            allowMultiple
            autoUpload={false}
            allowVisibility={false}
            allowMain={false}
            buttonLabel="Seleccionar adjuntos"
            compact
            showHeader={false}
            disabled={!canUpload}
            onFilesSelected={onPendingFilesChange}
          />

          {pendingCount > 0 ? (
            <div className="clinical-attachments-status">
              <strong>
                {pendingCount === 1
                  ? "1 archivo seleccionado"
                  : `${pendingCount} archivos seleccionados`}
              </strong>

              <span>
                Se {pendingCount === 1 ? "subirá" : "subirán"} al guardar el examen.
              </span>
            </div>
          ) : (
            <p className="clinical-attachments-help">
              Formatos permitidos: JPG, PNG, WEBP y PDF.
            </p>
          )}
        </div>
      )}

      {warning ? (
        <p className="error-text clinical-attachments-warning">{warning}</p>
      ) : null}
    </div>
  );
}

export function FinancialSummaryHint({ item }) {
  if (!item?.payableAccount?.cuenta_por_pagar_id) {
    return null;
  }

  return (
    <p className="animal-muted">
      Cuenta asociada #{item.payableAccount.cuenta_por_pagar_id}
      {item.payableAccount.estado ? ` · ${item.payableAccount.estado}` : ""}
      {item.payableAccount.saldo_pendiente !== null && item.payableAccount.saldo_pendiente !== undefined
        ? ` · Saldo ${formatMoney(item.payableAccount.saldo_pendiente, item.moneda)}`
        : ""}
    </p>
  );
}
