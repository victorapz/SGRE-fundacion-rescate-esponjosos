import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ClinicalAttachmentsSection,
  ClinicVeterinarianFields,
  FinancialSummaryHint,
  buildAnimalHistoryReturnUrl,
  formatResponsibleUser,
  parseLocalizedDecimalInput,
} from "../components/animal/ClinicalFormShared";
import { mergeHistoricalVeterinarianOption } from "../components/animal/clinicalForm.shared.js";
import PageBreadcrumb from "../components/PageBreadcrumb";
import { PERMISSIONS } from "../config/permissions";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { listFiles, uploadMultipleFiles } from "../services/file.service";
import { getAnimal } from "../services/animal.service";
import { createHospitalization, getHospitalization, updateHospitalization } from "../services/hospitalization.service";
import { getVetClinics } from "../services/vet_clinic.service";
import { getVeterinarians } from "../services/veterinarian.service";
import { buildLegacyPriceValue } from "../utils/financial";
import { buildRequestError } from "../utils/requestError";
import "../styles/home.page.css";
import "../styles/animals.page.css";

const HISTORY_TAB = "hospitalization";
const ENTITY_TYPE = "HOSPITALIZATION";
const ATTACHMENT_CONTEXT = "HOSPITALIZATION_ATTACHMENT";
const EMPTY_EDITOR_HTML = "<p></p>";

const CURRENCY_OPTIONS = [
  { value: "CLP", label: "CLP" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toEditorHtml(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return EMPTY_EDITOR_HTML;
  }

  if (/<[a-z][\s\S]*>/i.test(normalized)) {
    return normalized;
  }

  return `<p>${escapeHtml(normalized)}</p>`;
}

function richTextToPlainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRichTextForPayload(value) {
  const normalized = String(value || "").trim();
  return richTextToPlainText(normalized) ? normalized : null;
}

function sanitizeMoneyDraft(value, currency) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "";
  }

  if (currency === "CLP") {
    return /^\d+$/.test(normalized) ? normalized : null;
  }

  return /^\d*(?:[.,]\d{0,2})?$/.test(normalized) ? normalized : null;
}

function parseMoneyAmount(rawValue, currency) {
  const normalized = String(rawValue ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (currency === "CLP") {
    if (!/^\d+$/.test(normalized)) {
      throw new Error("Para CLP, ingresa el monto como un número entero sin comas ni decimales.");
    }

    const amount = Number(normalized);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Ingresa un monto CLP válido y mayor que cero.");
    }

    return amount;
  }

  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) {
    throw new Error(`Para ${currency}, ingresa un monto válido con hasta dos decimales.`);
  }

  const amount = Number(normalized.replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Ingresa un monto ${currency} válido y mayor que cero.`);
  }

  return amount;
}

function getAmountPlaceholder(currency) {
  return currency === "CLP" ? "Ej.: 12500" : "Ej.: 12,50";
}



function emptyHospitalizationForm() {
  return {
    fecha_ingreso: "",
    fecha_alta: "",
    motivo: EMPTY_EDITOR_HTML,
    diagnostico: EMPTY_EDITOR_HTML,
    pronostico: EMPTY_EDITOR_HTML,
    peso_ingreso: "",
    temperatura_ingreso: "",
    farmacos_recetados: EMPTY_EDITOR_HTML,
    examenes_realizados: EMPTY_EDITOR_HTML,
    indicaciones_hospital: EMPTY_EDITOR_HTML,
    indicaciones_casa: EMPTY_EDITOR_HTML,
    fecha_control_post_alta: "",
    monto_total: "",
    moneda: "CLP",
    genera_cuenta_por_pagar: false,
    fecha_vencimiento_pago: "",
    observacion_financiera: "",
    veterinarian_id: "",
    clinic_id: "",
  };
}

function ToolbarButton({ active = false, disabled = false, label, onClick, children }) {
  return (
    <button
      type="button"
      className={`clinical-editor-button${active ? " is-active" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ClinicalRichTextField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
    ],
    content: toEditorHtml(value),
    editable: !disabled,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;

    const nextContent = toEditorHtml(value);

    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, false);
    }
  }, [editor, value]);

  return (
    <div className="clinical-rich-text-field">
      <span className="clinical-field-label">
        {label}
        {required ? <span className="clinical-required-mark"> *</span> : null}
      </span>

      <div className="clinical-rich-text-shell">
        <div className="clinical-editor-toolbar" aria-label={`Formato de ${label}`}>
          <ToolbarButton
            label="Negrita"
            active={Boolean(editor?.isActive("bold"))}
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Cursiva"
            active={Boolean(editor?.isActive("italic"))}
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Lista con viñetas"
            active={Boolean(editor?.isActive("bulletList"))}
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Lista numerada"
            active={Boolean(editor?.isActive("orderedList"))}
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={16} />
          </ToolbarButton>

          <span className="clinical-editor-toolbar-separator" aria-hidden="true" />

          <ToolbarButton
            label="Deshacer"
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Rehacer"
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 size={16} />
          </ToolbarButton>
        </div>

 <EditorContent
  editor={editor}
  className="clinical-editor-content"
/>
      </div>
    </div>
  );
}


function HospitalizationPayableFields({
  form,
  onChange,
  visible,
  canEdit,
  payableLocked,
}) {
  if (!visible) {
    return null;
  }

  const disabled = !canEdit || payableLocked;
  const amountPlaceholder = getAmountPlaceholder(form.moneda);

  const handleAmountChange = (rawValue) => {
    const nextValue = sanitizeMoneyDraft(rawValue, form.moneda);

    if (nextValue !== null) {
      onChange("monto_total", nextValue);
    }
  };

  const handleCurrencyChange = (currency) => {
    onChange("moneda", currency);
    onChange("monto_total", "");
  };

  return (
    <section className="clinical-form-section clinical-form-section-separated">
      <div className="clinical-section-heading">
        <div>
          <h2>Cuenta por pagar</h2>
          <p>Registra la obligación financiera asociada la hospitalización cuando corresponda.</p>
        </div>
      </div>

      <label className="animal-inline-checkbox clinical-inline-checkbox">
        <input
          type="checkbox"
          checked={Boolean(form.genera_cuenta_por_pagar)}
          disabled={disabled}
          onChange={(event) => onChange("genera_cuenta_por_pagar", event.target.checked)}
        />
        <span>Generar cuenta por pagar</span>
      </label>

      {payableLocked ? (
        <p className="clinical-field-help">
          La cuenta por pagar posee pagos o movimientos asociados y sus datos financieros no pueden modificarse desde este hospitalización.
        </p>
      ) : null}

      {form.genera_cuenta_por_pagar ? (
        <div className="clinical-form-grid">
          <label className="clinical-field">
            <span className="clinical-field-label">Moneda</span>
            <select
              value={form.moneda}
              disabled={disabled}
              onChange={(event) => handleCurrencyChange(event.target.value)}
            >
              {CURRENCY_OPTIONS.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>

          <label className="clinical-field">
            <span className="clinical-field-label">Monto</span>
            <input
              type="text"
              inputMode={form.moneda === "CLP" ? "numeric" : "decimal"}
              value={form.monto_total}
              disabled={disabled}
              placeholder={amountPlaceholder}
              onChange={(event) => handleAmountChange(event.target.value)}
            />
            <small className="clinical-field-help">
              {form.moneda === "CLP"
                ? "Ingresa un monto entero, sin comas ni decimales."
                : `Puedes usar coma o punto y hasta dos decimales para ${form.moneda}.`}
            </small>
          </label>

          <label className="clinical-field">
            <span className="clinical-field-label">Fecha de vencimiento</span>
            <input
              type="date"
              value={form.fecha_vencimiento_pago}
              disabled={disabled}
              onChange={(event) => onChange("fecha_vencimiento_pago", event.target.value)}
            />
          </label>

          <label className="clinical-field clinical-field-full">
            <span className="clinical-field-label">Observación financiera</span>
            <textarea
              rows="3"
              value={form.observacion_financiera}
              disabled={disabled}
              onChange={(event) => onChange("observacion_financiera", event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

export default function HospitalizationFormPage() {
  const { id, hospitalizationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { hasAnyPermission } = usePermissions();
  const animalId = Number(id);
  const isEdit = Boolean(hospitalizationId);
  const returnUrl = buildAnimalHistoryReturnUrl(animalId, HISTORY_TAB);

  const canViewPayables = hasAnyPermission([
    PERMISSIONS.ACCOUNTING.PAYABLE_READ,
    PERMISSIONS.ACCOUNTING.PAYABLE_CREATE,
    PERMISSIONS.ACCOUNTING.PAYABLE_UPDATE,
  ]);
  const canEditPayables = hasAnyPermission([
    PERMISSIONS.ACCOUNTING.PAYABLE_CREATE,
    PERMISSIONS.ACCOUNTING.PAYABLE_UPDATE,
  ]);
  const canReadClinicalFiles = hasAnyPermission([
    PERMISSIONS.FILES.READ,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_READ,
  ]);
  const canUploadClinicalFiles = hasAnyPermission([
    PERMISSIONS.FILES.UPLOAD,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_UPLOAD,
  ]);
  const canDeleteClinicalFiles = hasAnyPermission([
    PERMISSIONS.FILES.DELETE,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_DELETE,
  ]);

  const [animal, setAnimal] = useState(null);
  const [form, setForm] = useState(emptyHospitalizationForm());
  const [record, setRecord] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [veterinarians, setVeterinarians] = useState([]);
  const [historicalVeterinarian, setHistoricalVeterinarian] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [veterinariansLoading, setVeterinariansLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [filesError, setFilesError] = useState("");
  const [attachmentWarning, setAttachmentWarning] = useState(
    location.state?.attachmentWarning || "",
  );

  const loadVeterinariansForClinic = useCallback(async (clinicId) => {
    if (!clinicId) {
      setVeterinarians([]);
      return [];
    }

    setVeterinariansLoading(true);

    try {
      const items = await getVeterinarians({ clinic_id: clinicId, activo: true });
      const mergedItems = mergeHistoricalVeterinarianOption(items, historicalVeterinarian);
      setVeterinarians(mergedItems);
      return mergedItems;
    } catch (error) {
      const wrappedError = buildRequestError(
        error,
        "No fue posible obtener los veterinarios de la clínica.",
      );
      setFormError(wrappedError.message);
      setVeterinarians([]);
      return [];
    } finally {
      setVeterinariansLoading(false);
    }
  }, [historicalVeterinarian]);

  const loadExistingFiles = useCallback(async (entityId) => {
    if (!entityId || !canReadClinicalFiles) {
      setExistingFiles([]);
      return;
    }

    setFilesLoading(true);
    setFilesError("");

    try {
      const items = await listFiles({
        entityType: ENTITY_TYPE,
        entityId,
        context: ATTACHMENT_CONTEXT,
      });
      setExistingFiles(items);
    } catch (error) {
      setFilesError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los adjuntos de la hospitalización.",
      );
    } finally {
      setFilesLoading(false);
    }
  }, [canReadClinicalFiles]);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setLoadError("");
      setFormError("");
      setClinicsLoading(true);

      try {
        const [animalResponse, clinicsResponse, hospitalizationResponse] = await Promise.all([
          getAnimal(animalId),
          getVetClinics({ activo: true }),
          isEdit ? getHospitalization(hospitalizationId) : Promise.resolve(null),
        ]);

        if (!isMounted) return;

        setAnimal(animalResponse);
        setClinics(clinicsResponse);
        setRecord(hospitalizationResponse);

        if (hospitalizationResponse) {
          const currentVeterinarian = hospitalizationResponse.veterinarianId
            ? {
                id: hospitalizationResponse.veterinarianId,
                nombreCompleto:
                  hospitalizationResponse.veterinarianNombre || "Veterinario histórico",
              }
            : null;
          setHistoricalVeterinarian(currentVeterinarian);
          setForm({
            fecha_ingreso: hospitalizationResponse.fechaIngreso || "",
            fecha_alta: hospitalizationResponse.fechaAlta || "",
            motivo: toEditorHtml(hospitalizationResponse.motivo),
            diagnostico: toEditorHtml(hospitalizationResponse.diagnostico),
            pronostico: toEditorHtml(hospitalizationResponse.pronostico),
            peso_ingreso: hospitalizationResponse.pesoIngreso ?? "",
            temperatura_ingreso: hospitalizationResponse.temperaturaIngreso ?? "",
            farmacos_recetados: toEditorHtml(hospitalizationResponse.farmacosRecetados),
            examenes_realizados: toEditorHtml(hospitalizationResponse.examenesRealizados),
            indicaciones_hospital: toEditorHtml(hospitalizationResponse.indicacionesHospital),
            indicaciones_casa: toEditorHtml(hospitalizationResponse.indicacionesCasa),
            fecha_control_post_alta: hospitalizationResponse.fechaControlPostAlta || "",
            monto_total: hospitalizationResponse.montoTotal ?? hospitalizationResponse.precio ?? "",
            moneda: hospitalizationResponse.moneda || "CLP",
            genera_cuenta_por_pagar: Boolean(hospitalizationResponse.generaCuentaPorPagar),
            fecha_vencimiento_pago: hospitalizationResponse.fechaVencimientoPago || "",
            observacion_financiera: hospitalizationResponse.observacionFinanciera || "",
            veterinarian_id: hospitalizationResponse.veterinarianId
              ? String(hospitalizationResponse.veterinarianId)
              : "",
            clinic_id: hospitalizationResponse.clinicId ? String(hospitalizationResponse.clinicId) : "",
          });

          await Promise.all([
            loadVeterinariansForClinic(hospitalizationResponse.clinicId),
            loadExistingFiles(hospitalizationResponse.id),
          ]);
        }
        if (!hospitalizationResponse) {
          setHistoricalVeterinarian(null);
        }
      } catch (error) {
        if (!isMounted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el formulario de hospitalizacion.",
        );
      } finally {
        if (isMounted) {
          setClinicsLoading(false);
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [animalId, hospitalizationId, isEdit, loadExistingFiles, loadVeterinariansForClinic]);

  const pageTitle = isEdit ? "Editar hospitalización" : "Nueva hospitalización";

  const breadcrumbLabel = useMemo(() => {
    if (!animal?.nombre) {
      return "Detalle del animal";
    }

    return `Detalle de ${animal.nombre}`;
  }, [animal]);

  const isFormValid = useMemo(() => {
    return Boolean(
      form.fecha_ingreso && richTextToPlainText(form.motivo) && form.clinic_id && form.fecha_control_post_alta,
    );
  }, [form]);

  const handleChange = (field, value) => {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const handleClinicChange = async (clinicId) => {
    setForm((currentValue) => ({
      ...currentValue,
      clinic_id: clinicId,
      veterinarian_id: "",
    }));
    setFormError("");
    await loadVeterinariansForClinic(clinicId);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isFormValid || isSubmitting) {
      setFormError("Completa la fecha de ingreso, el motivo, la clínica y la fecha de control postalta.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    setAttachmentWarning("");

    try {
      const parsedAmount = form.genera_cuenta_por_pagar
        ? parseMoneyAmount(form.monto_total, form.moneda)
        : null;

      if (form.genera_cuenta_por_pagar && !parsedAmount) {
        throw new Error("Ingresa el monto de la cuenta por pagar.");
      }

      if (form.genera_cuenta_por_pagar && !form.fecha_vencimiento_pago) {
        throw new Error("Selecciona la fecha de vencimiento de la cuenta por pagar.");
      }
      const payload = {
        fecha_ingreso: form.fecha_ingreso,
        fecha_alta: form.fecha_alta || null,
        motivo: normalizeRichTextForPayload(form.motivo),
        diagnostico: normalizeRichTextForPayload(form.diagnostico),
        pronostico: normalizeRichTextForPayload(form.pronostico),
        peso_ingreso: parseLocalizedDecimalInput(form.peso_ingreso),
        temperatura_ingreso: parseLocalizedDecimalInput(form.temperatura_ingreso),
        farmacos_recetados: normalizeRichTextForPayload(form.farmacos_recetados),
        examenes_realizados: normalizeRichTextForPayload(form.examenes_realizados),
        indicaciones_hospital: normalizeRichTextForPayload(form.indicaciones_hospital),
        indicaciones_casa: normalizeRichTextForPayload(form.indicaciones_casa),
        fecha_control_post_alta: form.fecha_control_post_alta,
        precio: buildLegacyPriceValue(parsedAmount, form.monto_total),
        monto_total: parsedAmount,
        moneda: form.moneda,
        genera_cuenta_por_pagar: Boolean(form.genera_cuenta_por_pagar),
        fecha_vencimiento_pago: form.genera_cuenta_por_pagar
          ? form.fecha_vencimiento_pago || null
          : null,
        observacion_financiera: form.genera_cuenta_por_pagar
          ? form.observacion_financiera.trim() || null
          : null,
        veterinarian_id: form.veterinarian_id ? Number(form.veterinarian_id) : null,
        clinic_id: Number(form.clinic_id),
        animal_id: animalId,
      };

      const savedRecord = isEdit
        ? await updateHospitalization(hospitalizationId, payload)
        : await createHospitalization(payload);

      if (!isEdit) {
        setRecord(savedRecord);
      }

      if (!isEdit && pendingFiles.length > 0 && canUploadClinicalFiles) {
        const uploadResult = await uploadMultipleFiles(pendingFiles, {
          entityType: ENTITY_TYPE,
          entityId: savedRecord.id,
          context: ATTACHMENT_CONTEXT,
          visibility: "PRIVADO",
        });

        if (uploadResult.failed.length > 0) {
          navigate(`/rescatados/${animalId}/hospitalizaciones/${savedRecord.id}/editar`, {
            replace: true,
            state: {
              attachmentWarning: `La hospitalización se creó correctamente, pero ${uploadResult.failed.length} adjunto(s) no pudieron subirse.`,
            },
          });
          return;
        }
      }

      navigate(returnUrl);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la hospitalizacion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const payableLocked = Boolean(
    record?.payableAccount?.pago_cuenta_por_pagar_id || record?.payableAccount?.transaccion_id,
  );

  return (
    <section className="main-content clinical-form-page clinical-scroll-page">
      <PageBreadcrumb
        moduleLabel={breadcrumbLabel}
        moduleTo={returnUrl}
        currentLabel={pageTitle}
      />

      <div className="clinical-page-actions">
        <div>
          <h1>{pageTitle}</h1>
          <p className="clinical-page-copy">
            {animal
              ? `${animal.nombre || "Animal"} · ${animal.especie || "Sin especie"}`
              : "Cargando animal..."}
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="clinical-page-message">
          <p className="error-text">{loadError}</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(returnUrl)}>
            Volver al historial veterinario
          </button>
        </div>
      ) : null}

      {!loadError && isLoading ? (
        <p className="list-message">Cargando formulario...</p>
      ) : null}

      {!loadError && !isLoading ? (
        <form
          id="clinical-record-form"
          className="crud-card animal-form clinical-form-surface"
          onSubmit={handleSubmit}
          noValidate
        >
          {formError ? <p className="error-text clinical-form-error">{formError}</p> : null}


          <section className="clinical-form-section">
            <div className="clinical-section-heading">
              <div>
                <h2>Información de la hospitalización</h2>
                <p>Completa los antecedentes principales de la hospitalización.</p>
              </div>
            </div>

            <div className="clinical-form-grid">
              <label className="clinical-field">
                <span className="clinical-field-label">Fecha de ingreso *</span>
                <input
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(event) => handleChange("fecha_ingreso", event.target.value)}
                  required
                />
              </label>

              <label className="clinical-field">
                <span className="clinical-field-label">Fecha de alta</span>
                <input
                  type="date"
                  value={form.fecha_alta}
                  onChange={(event) => handleChange("fecha_alta", event.target.value)}
                />
              </label>

              <label className="clinical-field">
                <span className="clinical-field-label">Fecha de control postalta *</span>
                <input
                  type="date"
                  value={form.fecha_control_post_alta}
                  onChange={(event) => handleChange("fecha_control_post_alta", event.target.value)}
                  required
                />
              </label>

              <label className="clinical-field">
                <span className="clinical-field-label">Peso de ingreso (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.peso_ingreso}
                  onChange={(event) => handleChange("peso_ingreso", event.target.value)}
                  placeholder="Ej.: 12,5"
                />
              </label>

              <label className="clinical-field">
                <span className="clinical-field-label">Temperatura de ingreso (°C)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.temperatura_ingreso}
                  onChange={(event) => handleChange("temperatura_ingreso", event.target.value)}
                  placeholder="Ej.: 38,7"
                />
              </label>

              <ClinicalRichTextField
                label="Motivo"
                value={form.motivo}
                required
                disabled={isSubmitting}
                onChange={(value) => handleChange("motivo", value)}
              />
            </div>
          </section>

          <section className="clinical-form-section clinical-form-section-separated">
            <div className="clinical-section-heading">
              <div>
                <h2>Atención veterinaria</h2>
                <p>Selecciona la clínica y, de manera opcional, el veterinario asociado.</p>
              </div>
            </div>

            <ClinicVeterinarianFields
              clinicId={form.clinic_id}
              onClinicChange={handleClinicChange}
              clinics={clinics}
              clinicsLoading={clinicsLoading}
              veterinarianId={form.veterinarian_id}
              onVeterinarianChange={(value) => handleChange("veterinarian_id", value)}
              veterinarians={veterinarians}
              veterinariansLoading={veterinariansLoading}
              currentVeterinarian={
                historicalVeterinarian
                && String(form.veterinarian_id || "") === String(historicalVeterinarian.id)
                  ? historicalVeterinarian
                  : null
              }
            />

            <div className="clinical-responsible-row">
              <span className="clinical-field-label">Responsable</span>
              <strong>{formatResponsibleUser(user)}</strong>
            </div>
          </section>

          <section className="clinical-form-section clinical-form-section-separated">
            <div className="clinical-section-heading">
              <div>
                <h2>Evolución e indicaciones</h2>
                <p>Registra antecedentes clínicos e indicaciones cuando estén disponibles.</p>
              </div>
            </div>

            <div className="clinical-form-grid">
              <ClinicalRichTextField
                label="Diagnóstico"
                value={form.diagnostico}
                disabled={isSubmitting}
                onChange={(value) => handleChange("diagnostico", value)}
              />

              <ClinicalRichTextField
                label="Pronóstico"
                value={form.pronostico}
                disabled={isSubmitting}
                onChange={(value) => handleChange("pronostico", value)}
              />

              <ClinicalRichTextField
                label="Fármacos recetados"
                value={form.farmacos_recetados}
                disabled={isSubmitting}
                onChange={(value) => handleChange("farmacos_recetados", value)}
              />

              <ClinicalRichTextField
                label="Exámenes realizados"
                value={form.examenes_realizados}
                disabled={isSubmitting}
                onChange={(value) => handleChange("examenes_realizados", value)}
              />

              <ClinicalRichTextField
                label="Indicaciones en hospital"
                value={form.indicaciones_hospital}
                disabled={isSubmitting}
                onChange={(value) => handleChange("indicaciones_hospital", value)}
              />

              <ClinicalRichTextField
                label="Indicaciones en casa"
                value={form.indicaciones_casa}
                disabled={isSubmitting}
                onChange={(value) => handleChange("indicaciones_casa", value)}
              />
            </div>
          </section>

          <FinancialSummaryHint item={record} />

          <HospitalizationPayableFields
            form={form}
            onChange={handleChange}
            visible={canViewPayables}
            canEdit={canEditPayables}
            payableLocked={payableLocked}
          />

          <section className="clinical-form-section clinical-form-section-separated">
            <ClinicalAttachmentsSection
              title="Adjuntos"
              entityType={ENTITY_TYPE}
              entityId={record?.id}
              context={ATTACHMENT_CONTEXT}
              isEdit={isEdit}
              pendingFiles={pendingFiles}
              onPendingFilesChange={setPendingFiles}
              existingFiles={existingFiles}
              filesLoading={filesLoading}
              filesError={filesError}
              onRefresh={() => loadExistingFiles(record?.id)}
              canRead={canReadClinicalFiles}
              canUpload={canUploadClinicalFiles}
              canDelete={canDeleteClinicalFiles}
              warning={attachmentWarning}
            />
          </section>

          <div className="clinical-form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => navigate(returnUrl)}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn btn-primary clinical-save-button"
              disabled={isSubmitting || !isFormValid}
            >
              <Save size={17} />
              {isSubmitting ? "Guardando..." : "Guardar hospitalización"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
