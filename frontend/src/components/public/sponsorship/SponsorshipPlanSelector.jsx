function formatSponsorshipPlanAmount(plan) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: plan.moneda || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(plan.monto || 0));
}

export default function SponsorshipPlanSelector({
  plans = [],
  selectedPlanId,
  onChange,
  disabled = false,
}) {
  return (
    <div className="public-sponsorship-plan-selector">
      <div className="public-sponsorship-form__section-copy">
        <h3>Selecciona un plan</h3>
        <p>Todos los planes son mensuales y se procesan con PayPal.</p>
      </div>

      <div className="public-sponsorship-plan-selector__grid" role="radiogroup" aria-label="Planes de apadrinamiento">
        {plans.map((plan) => {
          const isSelected = Number(selectedPlanId) === Number(plan.id);

          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={isSelected ? "true" : "false"}
              className={`public-sponsorship-plan-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => onChange(plan.id)}
              disabled={disabled}
            >
              <div className="public-sponsorship-plan-card__head">
                <strong>{plan.nombre}</strong>
                <span>{formatSponsorshipPlanAmount(plan)} al mes</span>
              </div>
              {plan.descripcion ? <p>{plan.descripcion}</p> : null}
              <small>{plan.frecuencia || "Mensual"} · PayPal</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
