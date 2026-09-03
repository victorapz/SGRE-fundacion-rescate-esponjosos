import { useMemo, useRef, useState } from "react";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import { createPayPalDonationOrder } from "../../services/publicDonation.service";
import {
  normalizeMoneyInput,
  parseDonationAmount,
  storePendingDonationOrder,
  validatePayPalApprovalUrl,
} from "../../utils/publicDonation";

const SUGGESTED_AMOUNTS = [10, 25, 50, 100];
const FIXED_CURRENCY = "USD";
const IMPACT_ITEMS = [
  "Atención veterinaria",
  "Alimento y recuperación",
  "Rescate y rehabilitación",
];

export default function DonationPage() {
  usePublicPageMeta({
    title: "Donar",
    description: publicSiteConfig.description,
  });

  const [amountInput, setAmountInput] = useState("50");
  const [anonymous, setAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const statusRef = useRef(null);
  const submitGuardRef = useRef(false);

  const amountValidation = useMemo(() => parseDonationAmount(amountInput), [amountInput]);
  const selectedSuggestedAmount = amountValidation.valid ? amountValidation.amount : null;

  const handleSuggestedAmount = (amount) => {
    if (isSubmitting) return;
    setAmountInput(String(amount));
    setSubmitError("");
  };

  const handleAmountChange = (event) => {
    setAmountInput(normalizeMoneyInput(event.target.value));
    setSubmitError("");
  };

  const handleAnonymousChange = (event) => {
    setAnonymous(event.target.checked);
  };

  const focusStatus = () => {
    window.requestAnimationFrame(() => {
      statusRef.current?.focus();
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitGuardRef.current || isSubmitting) {
      return;
    }

    if (!amountValidation.valid) {
      setSubmitError(amountValidation.message);
      setStatusMessage("Revisa el monto antes de continuar.");
      focusStatus();
      return;
    }

    submitGuardRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");
    setStatusMessage("Creando orden segura...");

    try {
      const order = await createPayPalDonationOrder({
        monto_bruto: amountValidation.amount,
        moneda: FIXED_CURRENCY,
        descripcion: "Donacion unica",
        anonymous,
      });

      const approvalUrl = validatePayPalApprovalUrl(order?.approval_url);

      storePendingDonationOrder({
        paypal_order_id: order?.paypal_order_id || null,
        monto: amountValidation.amount,
        moneda: FIXED_CURRENCY,
        anonymous,
        timestamp: Date.now(),
      });

      window.location.assign(approvalUrl);
    } catch (error) {
      setSubmitError(error.message || "No pudimos iniciar la donación.");
      setStatusMessage("No pudimos iniciar la donación.");
      focusStatus();
    } finally {
      setIsSubmitting(false);
      submitGuardRef.current = false;
    }
  };

  return (
    <section className="donation-public-page">
      <div className="donation-hero-card">
        <p className="donation-kicker">Apoyo directo</p>
        <h1>Cambia una vida hoy</h1>
        <p className="donation-lead">
          {publicSiteConfig.description} El pago se procesa de forma segura con PayPal.
        </p>
      </div>

      <div className="donation-form-card">
        <div className="donation-form-heading">
          <h2>Selecciona un monto</h2>
          <p>Elige una opción sugerida o ingresa otro monto en {FIXED_CURRENCY}.</p>
        </div>

        {(submitError || statusMessage) && (
          <div
            ref={statusRef}
            className={`donation-status-banner ${submitError ? "is-error" : ""}`}
            aria-live="polite"
            tabIndex={-1}
          >
            {submitError || statusMessage}
          </div>
        )}

        <form className="donation-public-form" onSubmit={handleSubmit} noValidate>
          <div className="donation-amount-panel">
            <div className="donation-suggestions" aria-label="Montos sugeridos">
              {SUGGESTED_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={`donation-suggestion-chip ${
                    selectedSuggestedAmount === amount ? "is-active" : ""
                  }`}
                  onClick={() => handleSuggestedAmount(amount)}
                  disabled={isSubmitting}
                >
                  <span>$</span>
                  <strong>{amount}</strong>
                </button>
              ))}
            </div>

            <div className="donation-field">
              <label htmlFor="donation-amount">Monto de la donación</label>
              <div className="donation-amount-row">
                <span className="donation-currency-badge" aria-hidden="true">$</span>
                <input
                  id="donation-amount"
                  name="monto_bruto"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={handleAmountChange}
                  aria-invalid={amountValidation.valid ? "false" : "true"}
                  aria-describedby="donation-amount-help"
                  disabled={isSubmitting}
                />
                <span className="donation-currency-suffix">{FIXED_CURRENCY}</span>
              </div>
              <p id="donation-amount-help" className="donation-field-help">
                Ingresa un monto mayor a 0 en {FIXED_CURRENCY}. Se aceptan hasta 2 decimales.
              </p>
            </div>
          </div>

          <label className="donation-checkbox-card" htmlFor="donation-anonymous">
            <input
              id="donation-anonymous"
              type="checkbox"
              checked={anonymous}
              onChange={handleAnonymousChange}
              disabled={isSubmitting}
            />
            <span>
              <strong>Realizar esta donación de forma anónima</strong>
              <small>
                Puedes donar de forma anónima. PayPal procesara el pago, pero la fundación
                no guardara tu identidad como donante.
              </small>
            </span>
          </label>

          <div className="donation-actions">
            <button
              type="submit"
              className="donation-primary-button"
              disabled={isSubmitting || !amountValidation.valid}
            >
              {isSubmitting ? "Creando orden segura..." : "Donar con PayPal"}
            </button>
          </div>
        </form>
      </div>

      <section className="donation-impact-strip" aria-label="Impacto de la donacion">
        <h2>Tu aporte ayuda a</h2>
        <div className="donation-impact-list">
          {IMPACT_ITEMS.map((item) => (
            <div key={item} className="donation-impact-item">
              <span className="donation-impact-dot" aria-hidden="true" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="donation-trust-strip" aria-label="Pago seguro">
        <span className="donation-trust-icon" aria-hidden="true" />
        <div>
          <strong>Pago procesado de forma segura por PayPal</strong>
          <p>La fundación no almacena tus datos bancarios.</p>
        </div>
      </section>
    </section>
  );
}
