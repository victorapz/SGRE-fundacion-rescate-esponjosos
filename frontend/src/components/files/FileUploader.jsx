import { useMemo, useRef, useState } from "react";
import { FileUp, Images, Paperclip } from "lucide-react";
import FileTriggerButton from "../common/FileTriggerButton";
import { uploadFile, uploadMultipleFiles } from "../../services/file.service";
import "../../styles/files.css";

function formatPendingNames(files = []) {
  return files.map((file) => file?.name).filter(Boolean);
}

function resolveTriggerIcon(buttonLabel = "") {
  const normalizedLabel = String(buttonLabel || "").toLowerCase();

  if (normalizedLabel.includes("foto") || normalizedLabel.includes("galeria")) {
    return Images;
  }

  if (normalizedLabel.includes("adjunto")) {
    return Paperclip;
  }

  return FileUp;
}

export default function FileUploader({
  entityType,
  entityId,
  context,
  defaultVisibility = "PRIVADO",
  allowedAccept,
  allowVisibility = true,
  allowMain = false,
  allowMultiple = false,
  autoUpload = true,
  title = "",
  description = "",
  buttonLabel = "Subir archivo",
  forceIsMain = false,
  compact = false,
  showHeader = true,
  onUploaded,
  onFilesSelected,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [markAsMain, setMarkAsMain] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const pendingNames = useMemo(() => formatPendingNames(selectedFiles), [selectedFiles]);
  const canAutoUpload = autoUpload && entityType && entityId && context;
  const effectiveIsMain = forceIsMain ? true : allowMain ? markAsMain : false;
  const TriggerIcon = useMemo(() => resolveTriggerIcon(buttonLabel), [buttonLabel]);

  function resetInput() {
    setSelectedFiles([]);
    setMarkAsMain(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleAutoUpload(files) {
    setIsUploading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (files.length > 1) {
        const result = await uploadMultipleFiles(files, {
          entityType,
          entityId,
          context,
          visibility,
          title,
          description,
          isMain: effectiveIsMain,
        });

        const failedCount = result.failed.length;
        const uploadedCount = result.uploaded.length;

        setSuccessMessage(
          failedCount > 0
            ? `Se subieron ${uploadedCount} archivo(s) y ${failedCount} fallaron.`
            : `Se subieron ${uploadedCount} archivo(s) correctamente.`,
        );

        if (failedCount > 0) {
          const firstFailure = result.failed[0];
          setError(firstFailure?.error?.message || "Uno o mas archivos no pudieron subirse.");
        }

        onUploaded?.(result);
      } else {
        const uploaded = await uploadFile({
          file: files[0],
          entityType,
          entityId,
          context,
          visibility,
          title,
          description,
          isMain: effectiveIsMain,
        });

        setSuccessMessage("Archivo subido correctamente.");
        onUploaded?.(uploaded);
      }

      resetInput();
    } catch (uploadError) {
      setError(uploadError?.message || "No fue posible subir el archivo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleFileChange(event) {
    const nextFiles = Array.from(event.target.files || []);
    setSelectedFiles(nextFiles);
    setError("");
    setSuccessMessage("");

    if (nextFiles.length === 0) {
      return;
    }

    if (!autoUpload) {
      onFilesSelected?.(nextFiles);
      setSuccessMessage(
  nextFiles.length === 1
    ? "Archivo listo para subir al guardar."
    : `${nextFiles.length} archivos listos para subir al guardar.`,
);
      return;
    }

    if (!canAutoUpload) {
      setError("Faltan entityType, entityId o context para subir el archivo.");
      return;
    }

    await handleAutoUpload(nextFiles);
  }

  return (
    <section className="files-section">
      <div className={`file-uploader file-uploader-card${compact ? " file-uploader-card-compact" : ""}`}>
       {showHeader ? (
  <div className={`crud-header${compact ? " file-uploader-header-compact" : ""}`}>
    <div>
      <h3>{buttonLabel}</h3>
      <p className="inventory-subtle">
        {autoUpload
          ? "El archivo se subirá al seleccionarlo."
          : "Los archivos se subirán al guardar el registro."}
      </p>
    </div>
  </div>
) : null}

        <div className={`crud-form-grid${compact ? " file-uploader-grid-compact" : ""}`}>
          {allowVisibility ? (
            <label className="file-uploader-visibility">
              <span>Visibilidad</span>
              <select
                className="file-visibility-select"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
                disabled={disabled || isUploading}
              >
                <option value="PRIVADO">Privado</option>
                <option value="PUBLICO">Público</option>
              </select>
            </label>
          ) : null}

          {allowMain && !forceIsMain ? (
            <label className="files-inline-check">
              <span>Archivo principal</span>
              <div className="inventory-inline-checkbox">
                <input
                  type="checkbox"
                  checked={markAsMain}
                  onChange={(event) => setMarkAsMain(event.target.checked)}
                  disabled={disabled || isUploading}
                />
                <span>Marcar como principal</span>
              </div>
            </label>
          ) : null}

          <div className="file-uploader-input">
            <span>Archivo{allowMultiple ? "s" : ""}</span>
            <FileTriggerButton
              icon={TriggerIcon}
              label={buttonLabel}
              accept={allowedAccept}
              multiple={allowMultiple}
              disabled={disabled || isUploading}
              onChange={handleFileChange}
              inputRef={inputRef}
            />
          </div>
        </div>

        {pendingNames.length > 0 ? (
          <div className="file-pending-list">
            <strong>Seleccionado{pendingNames.length > 1 ? "s" : ""}:</strong>
            <ul>
              {pendingNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {isUploading ? <p className="list-message">Subiendo archivo...</p> : null}
        {successMessage ? <p className="inventory-success-banner">{successMessage}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}
