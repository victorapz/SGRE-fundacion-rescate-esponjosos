import { useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import IconButton from "../common/IconButton";
import {
  deleteFile,
  downloadFile,
  getPreviewBlob,
  markFileAsMain,
} from "../../services/file.service";
import "../../styles/files.css";

export default function ImageGallery({
  files = [],
  loading = false,
  error = "",
  emptyMessage = "No hay imágenes disponibles.",
  allowDelete = true,
  allowMarkMain = true,
  allowDownload = true,
  compact = false,
  onDeleted,
  onMarkedMain,
  onRefresh,
}) {
  const [previewMap, setPreviewMap] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  const imageFiles = useMemo(
    () => files.filter((fileAsset) => String(fileAsset.mime_type || "").startsWith("image/")),
    [files],
  );

  useEffect(() => {
    let isCancelled = false;
    const activeUrls = [];

    async function loadPreviews() {
      if (imageFiles.length === 0) {
        setPreviewMap({});
        return;
      }

      const nextMap = {};

      for (const fileAsset of imageFiles) {
        try {
          const blob = await getPreviewBlob(fileAsset.file_asset_id);
          const url = URL.createObjectURL(blob);
          activeUrls.push(url);
          nextMap[fileAsset.file_asset_id] = {
            status: "success",
            url,
          };
        } catch {
          nextMap[fileAsset.file_asset_id] = {
            status: "error",
            url: "",
          };
        }
      }

      if (!isCancelled) {
        setPreviewMap(nextMap);
      }
    }

    loadPreviews();

    return () => {
      isCancelled = true;
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageFiles]);

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
      setActionError(deleteError?.message || "No fue posible eliminar la imagen.");
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
      setActionError(markError?.message || "No fue posible marcar la imagen como principal.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(fileAsset) {
    setBusyId(fileAsset.file_asset_id);
    setActionError("");

    try {
      await downloadFile(fileAsset);
    } catch (downloadError) {
      setActionError(downloadError?.message || "No fue posible descargar la imagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="files-section">
      <div className={`image-gallery crud-card${compact ? " image-gallery-compact" : ""}`}>
        {loading ? <p className="list-message">Cargando imágenes...</p> : null}
        {!loading && error ? <p className="error-text">{error}</p> : null}
        {actionError ? <p className="error-text">{actionError}</p> : null}
        {!loading && !error && imageFiles.length === 0 ? <p className="list-message">{emptyMessage}</p> : null}

        {!loading && !error && imageFiles.length > 0 ? (
          <div className={`image-gallery-grid${compact ? " image-gallery-grid-compact" : ""}`}>
            {imageFiles.map((fileAsset) => {
              const preview = previewMap[fileAsset.file_asset_id];
              const isBusy = busyId === fileAsset.file_asset_id;

              return (
                <article
                  key={fileAsset.file_asset_id}
                  className={`image-gallery-card${compact ? " image-gallery-card-compact" : ""}${fileAsset.is_main ? " is-main" : ""}`}
                >
                  <div className="image-gallery-media">
                    {preview?.status === "success" ? (
                      <img src={preview.url} alt={fileAsset.original_name} />
                    ) : (
                      <div className="image-gallery-placeholder">
                        <span>Vista previa no disponible</span>
                      </div>
                    )}
                  </div>

                  <div className="image-gallery-body">
                    <div className="attachment-item-head">
                      <strong>{fileAsset.original_name}</strong>
                      <div className="attachment-item-badges">
                        {fileAsset.is_main ? <span className="file-badge file-badge-main">Principal</span> : null}
                        <span className="file-badge">{fileAsset.visibility}</span>
                      </div>
                    </div>

                    <div className="attachment-item-meta">
                      <span>{fileAsset.mime_type}</span>
                    </div>

                    <div className="file-actions">
                      {allowDownload ? (
                        <IconButton
                          icon={Download}
                          label={`Descargar imagen ${fileAsset.original_name || ""}`.trim()}
                          variant="secondary"
                          onClick={() => handleDownload(fileAsset)}
                          disabled={isBusy}
                        />
                      ) : null}

                      {allowMarkMain && !fileAsset.is_main ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => handleMarkMain(fileAsset)}
                          disabled={isBusy}
                        >
                          Marcar principal
                        </button>
                      ) : null}

                      {allowDelete ? (
                        <IconButton
                          icon={Trash2}
                          label={`Eliminar imagen ${fileAsset.original_name || ""}`.trim()}
                          variant="danger"
                          onClick={() => handleDelete(fileAsset)}
                          disabled={isBusy}
                        />
                      ) : null}
                    </div>
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
