import { ImagePlus, Trash2 } from "lucide-react";
import FileTriggerButton from "../../common/FileTriggerButton";
import IconButton from "../../common/IconButton";
import RichTextEditor from "../../common/RichTextEditor";

function NoticeField({ label, children }) {
  return (
    <label className="notice-form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function NoticeEditorForm({
  form,
  onChange,
  onUploadCover,
  onRemoveCover,
  onUploadImage,
  disabled = false,
  helperText = "",
  coverPreviewUrl = "",
  coverLabel = "",
  isUploadingCover = false,
  coverError = "",
}) {
  return (
    <div className="notice-editor-layout">
      <section className="notice-editor-card notice-editor-main-card">
        <div className="notice-editor-card-header">
          <h2>Contenido del aviso</h2>
          <p>Escribe un título claro, agrega un resumen breve y completa el contenido con formato enriquecido.</p>
        </div>

        <NoticeField label="Título">
          <input
            type="text"
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            disabled={disabled}
            maxLength={255}
            required
          />
        </NoticeField>

        <NoticeField label="Resumen">
          <textarea
            value={form.summary}
            onChange={(event) => onChange("summary", event.target.value)}
            disabled={disabled}
            maxLength={500}
            rows={4}
            placeholder="Resumen breve para cards, metadata y vista pública."
          />
        </NoticeField>

        <div className="notice-form-field notice-form-field-full">
          <span>Contenido</span>
          <RichTextEditor
            value={form.description}
            onChange={(value) => onChange("description", value)}
            onUploadImage={onUploadImage}
            disabled={disabled}
            placeholder="Escribe el contenido del aviso..."
          />
        </div>
      </section>

      <aside className="notice-editor-side">
        <section className="notice-editor-card">
          <div className="notice-editor-card-header">
            <h3>Portada</h3>
            <p>Sube una imagen de portada opcional para el listado y detalle público del aviso.</p>
          </div>

          <div className="notice-cover-panel">
            {coverPreviewUrl ? (
              <div className="notice-cover-preview">
                <img src={coverPreviewUrl} alt={coverLabel || "Portada del aviso"} />
              </div>
            ) : (
              <div className="notice-cover-placeholder">
                <span>Sin portada cargada</span>
              </div>
            )}

            <div className="notice-cover-actions">
              <FileTriggerButton
                icon={ImagePlus}
                label={coverPreviewUrl ? "Reemplazar portada" : "Subir portada"}
                accept="image/jpeg,image/png,image/webp"
                disabled={disabled || isUploadingCover}
                variant="secondary"
                className="notice-cover-upload"
                onChange={(event) => {
                  const [file] = Array.from(event.target.files || []);
                  if (file) {
                    onUploadCover(file);
                  }
                  event.target.value = "";
                }}
              />
              {coverPreviewUrl ? (
                <IconButton
                  icon={Trash2}
                  label="Eliminar portada"
                  variant="danger"
                  disabled={disabled || isUploadingCover}
                  onClick={onRemoveCover}
                />
              ) : null}
            </div>

            {coverLabel ? <small className="notice-cover-caption">{coverLabel}</small> : null}
            {coverError ? <p className="error-text">{coverError}</p> : null}
          </div>
        </section>

        <section className="notice-editor-card">
          <div className="notice-editor-card-header">
            <h3>Publicación</h3>
            <p>{helperText || "Puedes guardar un borrador o publicarlo cuando este listo."}</p>
          </div>

          <NoticeField label="Visibilidad">
            <select
              value={String(form.isPublic)}
              onChange={(event) => onChange("isPublic", event.target.value === "true")}
              disabled={disabled}
            >
              <option value="true">Visible para todos</option>
              <option value="false">Visibilidad interna</option>
            </select>
          </NoticeField>

          <div className="notice-publication-meta">
            <span className="notice-publication-meta__label">Fecha de publicación</span>
            <strong>{form.publishedAt || "Se asignara automaticamente al publicar"}</strong>
            <p>
              La fecha se calcula automaticamente al publicar y se actualiza solo si el aviso
              archivado vuelve a publicarse.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
