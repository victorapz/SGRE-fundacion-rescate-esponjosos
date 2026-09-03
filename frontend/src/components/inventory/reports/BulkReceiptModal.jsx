import { useMemo, useState } from "react";
import { CheckSquare, PackageCheck } from "lucide-react";
import ModalCloseButton from "../../common/ModalCloseButton";
import InventoryStatusBadge from "../reports/InventoryStatusBadge";
import {
  bulkReceiptPendingQuantity,
  defaultBulkReceiptSelection,
  generateBulkReceiptIdempotencyKey,
  isBulkReceiptClosed,
  isBulkReceiptPartial,
  isBulkReceiptSelectable,
  reconcileBulkReceiptSelection,
} from "../../../utils/bulk-receipt";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatQuantity(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function BulkReceiptModalContent({
  title,
  lines = [],
  locations = [],
  isSaving = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const [includePartial, setIncludePartial] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => defaultBulkReceiptSelection(lines, false));
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayValue());
  const [observations, setObservations] = useState("");
  const [idempotencyKey] = useState(generateBulkReceiptIdempotencyKey);
  const [localError, setLocalError] = useState("");

  const receivableLines = useMemo(
    () => lines.filter(
      (line) => bulkReceiptPendingQuantity(line) > 0 && !isBulkReceiptClosed(line),
    ),
    [lines],
  );

  const partialLinesCount = useMemo(
    () => receivableLines.filter(isBulkReceiptPartial).length,
    [receivableLines],
  );

  const selectableLines = useMemo(
    () => receivableLines.filter((line) => isBulkReceiptSelectable(line, includePartial)),
    [includePartial, receivableLines],
  );

  const allSelectableSelected = selectableLines.length > 0
    && selectableLines.every((line) => selectedIds.includes(String(line.id)));

  function handleIncludePartialChange(event) {
    const checked = event.target.checked;
    setIncludePartial(checked);
    setSelectedIds((current) => reconcileBulkReceiptSelection(lines, current, checked));
    setLocalError("");
  }

  function toggleLine(line) {
    if (!isBulkReceiptSelectable(line, includePartial)) return;

    const lineId = String(line.id);
    setSelectedIds((current) => (
      current.includes(lineId)
        ? current.filter((id) => id !== lineId)
        : [...current, lineId]
    ));
    setLocalError("");
  }

  function toggleAll() {
    if (allSelectableSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(selectableLines.map((line) => String(line.id)));
    setLocalError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedIds.length) {
      setLocalError("Debes seleccionar al menos una líneapara recepcionar.");
      return;
    }

    if (!destinationLocationId) {
      setLocalError("Debes seleccionar una ubicación destino.");
      return;
    }

    if (!receiptDate) {
      setLocalError("Debes ingresar la fecha de recepción.");
      return;
    }

    setLocalError("");
    await onSubmit({
      detailIds: selectedIds.map(Number),
      destinationLocationId: Number(destinationLocationId),
      receiptDate,
      observations: observations.trim() || null,
      idempotencyKey,
    });
  }

  const visibleError = localError || error;

  return (
    <div className="modal-overlay">
      <div className="event-modal inventory-modal-shell inventory-bulk-receipt-modal">
        <div className="event-modal-header">
          <div className="inventory-bulk-receipt-title">
            <PackageCheck size={20} aria-hidden="true" />
            <div>
              <h3>{title}</h3>
              <p>Selecciona las líneas que se recibiran completamente.</p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} disabled={isSaving} />
        </div>

        <form className="inventory-modal-form" onSubmit={handleSubmit}>
          {visibleError ? <p className="error-text">{visibleError}</p> : null}

          <div className="inventory-bulk-receipt-controls">
            <label className="settings-form-field">
              <span>Ubicación destino</span>
              <select
                value={destinationLocationId}
                onChange={(event) => setDestinationLocationId(event.target.value)}
                disabled={isSaving}
              >
                <option value="">Selecciona una ubicación</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form-field">
              <span>Fecha de recepción</span>
              <input
                type="date"
                value={receiptDate}
                onChange={(event) => setReceiptDate(event.target.value)}
                disabled={isSaving}
              />
            </label>
          </div>

          {partialLinesCount > 0 ? (
            <label className="inventory-bulk-receipt-partial-toggle">
              <input
                type="checkbox"
                checked={includePartial}
                onChange={handleIncludePartialChange}
                disabled={isSaving}
              />
              <span>Incluir líneas parcialmente recepcionadas</span>
            </label>
          ) : null}

          <section className="inventory-bulk-receipt-lines" aria-label="Líneas disponibles">
            <div className="inventory-bulk-receipt-list-header">
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={toggleAll}
                disabled={isSaving || selectableLines.length === 0}
              >
                <CheckSquare size={16} aria-hidden="true" />
                {allSelectableSelected ? "Quitar selección" : "Seleccionar disponibles"}
              </button>
              <span>{selectedIds.length} seleccionada{selectedIds.length === 1 ? "" : "s"}</span>
            </div>

            {receivableLines.length ? (
              <div className="inventory-bulk-receipt-list">
                {receivableLines.map((line) => {
                  const selectable = isBulkReceiptSelectable(line, includePartial);
                  const selected = selectedIds.includes(String(line.id));
                  const partial = isBulkReceiptPartial(line);

                  return (
                    <label
                      key={line.id}
                      className={`inventory-bulk-receipt-line ${selected ? "is-selected" : ""} ${!selectable ? "is-disabled" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleLine(line)}
                        disabled={isSaving || !selectable}
                      />
                      <span className="inventory-bulk-receipt-line-main">
                        <strong>{line.itemNombre || `Línea#${line.id}`}</strong>
                        <small>
                          Esperado {formatQuantity(line.cantidad)} · Recibido {formatQuantity(line.cantidadRecepcionada)}
                        </small>
                      </span>
                      <span className="inventory-bulk-receipt-line-pending">
                        <small>Se recibira</small>
                        <strong>{formatQuantity(bulkReceiptPendingQuantity(line))}</strong>
                      </span>
                      <InventoryStatusBadge status={line.estado} />
                      {partial && !includePartial ? (
                        <small className="inventory-bulk-receipt-line-note">Activa la opción para incluirla</small>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="inventory-bulk-receipt-empty">
                No existen líneas abiertas con cantidad pendiente.
              </p>
            )}
          </section>

          <label className="settings-form-field">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              placeholder="Opcional"
              disabled={isSaving}
            />
          </label>

          <div className="event-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || selectedIds.length === 0}
            >
              {isSaving ? "Registrando..." : `Recepcionar ${selectedIds.length || ""}`.trim()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function BulkReceiptModal({ isOpen, ...props }) {
  if (!isOpen) return null;
  return <BulkReceiptModalContent {...props} />;
}
