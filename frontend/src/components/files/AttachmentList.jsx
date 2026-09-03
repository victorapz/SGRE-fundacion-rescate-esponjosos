import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import IconButton from "../common/IconButton";
import {
  deleteFile,
  downloadFile,
  markFileAsMain,
} from "../../services/file.service";
import "../../styles/files.css";

function formatBytes(sizeBytes = 0) {
  const size = Number(sizeBytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AttachmentList({
  files = [],
  loading = false,
  error = "",
  emptyMessage = "No hay archivos adjuntos.",
  showVisibility = true,
  showContext = false,
  allowDownload = true,
  allowDelete = true,
  allowMarkMain = false,
  onDeleted,
  onMarkedMain,
  onRefresh,
}) {
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function handleDownload(fileAsset) {
    setBusyId(fileAsset.file_asset_id);
    setActionError("");

    try {
      await downloadFile(fileAsset);
    } catch (downloadError) {
      setActionError(downloadError?.message || "No fue posible descargar el archivo.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(fileAsset) {
    if (!window.confirm(`¿Eliminar "${fileAsset.original_name}"?`)) {
      return;
    }

    setBusyId(fileAsset.file_asset_id);
    setActionError("");

    try {
      const deleted = await deleteFile(fileAsset.file_asset_id);
      onDeleted?.(deleted, fileAsset);
      await onRefresh?.();
    } catch (deleteError) {
      setActionError(deleteError?.message || "No fue posible eliminar el archivo.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkMain(fileAsset) {
    setBusyId(fileAsset.file_asset_id);
    setActionError("");

    try {
      const updated = await markFileAsMain(fileAsset.file_asset_id);
      onMarkedMain?.(updated, fileAsset);
      await onRefresh?.();
    } catch (markError) {
      setActionError(markError?.message || "No fue posible marcar el archivo como principal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="files-section">
      <div className="attachment-list crud-card">
        {loading ? <p className="list-message">Cargando archivos...</p> : null}
        {!loading && error ? <p className="error-text">{error}</p> : null}
        {!loading && !error && files.length === 0 ? <p className="list-message">{emptyMessage}</p> : null}

        {actionError ? <p className="error-text">{actionError}</p> : null}

        {!loading && !error && files.length > 0 ? (
          <div className="inventory-mini-table">
            {files.map((fileAsset) => {
              const isBusy = busyId === fileAsset.file_asset_id;

              return (
                <article key={fileAsset.file_asset_id} className="attachment-item">
                  <div className="attachment-item-main">
                    <div className="attachment-item-head">
                      <strong>{fileAsset.original_name}</strong>
                      <div className="attachment-item-badges">
                        {fileAsset.is_main ? <span className="file-badge file-badge-main">Principal</span> : null}
                        {showVisibility && fileAsset.visibility ? (
                          <span className="file-badge">{fileAsset.visibility}</span>
                        ) : null}
                        {showContext && fileAsset.context ? (
                          <span className="file-badge">{fileAsset.context}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="attachment-item-meta">
                      <span>{fileAsset.mime_type || "Tipo desconocido"}</span>
                      <span>{formatBytes(fileAsset.size_bytes)}</span>
                      <span>{formatDate(fileAsset.uploaded_at)}</span>
                    </div>
                  </div>

                  <div className="file-actions">
                    {allowDownload ? (
                      <IconButton
                        icon={Download}
                        label={`Descargar ${fileAsset.original_name || "archivo"}`}
                        variant="secondary"
                        onClick={() => handleDownload(fileAsset)}
                        disabled={isBusy}
                      />
                    ) : null}

                    {allowMarkMain ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => handleMarkMain(fileAsset)}
                        disabled={isBusy || fileAsset.is_main}
                      >
                        {fileAsset.is_main ? "Principal" : "Marcar principal"}
                      </button>
                    ) : null}

                    {allowDelete ? (
                      <IconButton
                        icon={Trash2}
                        label={`Eliminar ${fileAsset.original_name || "archivo"}`}
                        variant="danger"
                        onClick={() => handleDelete(fileAsset)}
                        disabled={isBusy}
                      />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
