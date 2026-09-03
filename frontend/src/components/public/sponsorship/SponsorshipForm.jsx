import { buildInitialSponsorshipFormState } from "../../../utils/publicSponsorship";

export default function SponsorshipForm({
  values = buildInitialSponsorshipFormState(),
  errors = {},
  selectedPlan,
  disabled = false,
  onChange,
  onSubmit,
  submitLabel = "Continuar con PayPal",
  submitHelp = null,
}) {
  const handleFieldChange = (event) => {
    const { name, type, checked, value } = event.target;
    onChange(name, type === "checkbox" ? checked : value);
  };

  return (
    <form className="public-sponsorship-form" onSubmit={onSubmit} noValidate>
      <div className="public-sponsorship-form__section">
        <div className="public-sponsorship-form__section-copy">
          <h3>Datos del padrino</h3>
          <p>Usaremos estos datos solo para iniciar el apadrinamiento y enviarte a PayPal.</p>
        </div>

        <div className="public-sponsorship-form__grid">
          <label className="public-sponsorship-field">
            <span>Nombre</span>
            <input
              type="text"
              name="nombre"
              value={values.nombre}
              onChange={handleFieldChange}
              autoComplete="given-name"
              disabled={disabled}
              aria-invalid={errors.nombre ? "true" : "false"}
            />
            {errors.nombre ? <small>{errors.nombre}</small> : null}
          </label>

          <label className="public-sponsorship-field">
            <span>Apellido</span>
            <input
              type="text"
              name="apellido"
              value={values.apellido}
              onChange={handleFieldChange}
              autoComplete="family-name"
              disabled={disabled}
              aria-invalid={errors.apellido ? "true" : "false"}
            />
            {errors.apellido ? <small>{errors.apellido}</small> : null}
          </label>

          <label className="public-sponsorship-field">
            <span>correo electrónico</span>
            <input
              type="email"
              name="email"
              value={values.email}
              onChange={handleFieldChange}
              autoComplete="email"
              disabled={disabled}
              aria-invalid={errors.email ? "true" : "false"}
            />
            {errors.email ? <small>{errors.email}</small> : null}
          </label>

          <label className="public-sponsorship-field">
            <span>Teléfono opcional</span>
            <input
              type="tel"
              name="telefono"
              value={values.telefono}
              onChange={handleFieldChange}
              autoComplete="tel"
              disabled={disabled}
            />
          </label>
        </div>
      </div>

      <div className="public-sponsorship-form__summary">
        <strong>Plan seleccionado</strong>
        <span>{selectedPlan ? `${selectedPlan.nombre} · ${selectedPlan.moneda} ${Number(selectedPlan.monto || 0).toFixed(2)} al mes` : "Debes seleccionar un plan."}</span>
        {errors.plan_id ? <small>{errors.plan_id}</small> : null}
      </div>

      <label className="public-sponsorship-consent">
        <input
          type="checkbox"
          name="consentimiento_datos"
          checked={values.consentimiento_datos}
          onChange={handleFieldChange}
          disabled={disabled}
        />
        <span>
          <strong>Acepto el tratamiento de mis datos para iniciar este apadrinamiento.</strong>
          <small>No almacenamos estos datos en tu navegador.</small>
        </span>
      </label>
      {errors.consentimiento_datos ? (
        <p className="public-sponsorship-form__error-line">{errors.consentimiento_datos}</p>
      ) : null}

      <div className="public-sponsorship-form__actions">
        <button
          type="submit"
          className="public-button public-button--primary"
          disabled={disabled}
        >
          {disabled ? <span className="public-inline-spinner" aria-hidden="true" /> : null}
          {submitLabel}
        </button>
        {submitHelp ? <p>{submitHelp}</p> : null}
      </div>
    </form>
  );
}
