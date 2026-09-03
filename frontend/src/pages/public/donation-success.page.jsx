import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import { capturePayPalDonationOrder } from "../../services/publicDonation.service";
import {
  clearPendingDonationOrder,
  getPublicDonationErrorMessage,
  isValidPayPalOrderToken,
  readPendingDonationOrder,
} from "../../utils/publicDonation";

const CAPTURE_STATE = {
  VALIDATING_RETURN: "VALIDATING_RETURN",
  CAPTURING: "CAPTURING",
  SUCCESS: "SUCCESS",
  RECOVERABLE_ERROR: "RECOVERABLE_ERROR",
  INVALID_RETURN: "INVALID_RETURN",
};

const inFlightCaptures = new Map();

function captureOnce(paypalOrderId) {
  if (!inFlightCaptures.has(paypalOrderId)) {
    const request = capturePayPalDonationOrder(paypalOrderId).finally(() => {
      inFlightCaptures.delete(paypalOrderId);
    });

    inFlightCaptures.set(paypalOrderId, request);
  }

  return inFlightCaptures.get(paypalOrderId);
}

export default function DonationSuccessPage() {
  usePublicPageMeta({
    title: "Donación confirmada",
    description: "Estamos confirmando la operación de PayPal y registrando la donación.",
  });

  const [searchParams] = useSearchParams();
  const [captureState, setCaptureState] = useState(CAPTURE_STATE.VALIDATING_RETURN);
  const [errorMessage, setErrorMessage] = useState("");
  const [attemptCounter, setAttemptCounter] = useState(0);
  const statusRef = useRef(null);

  const paypalOrderId = useMemo(() => {
    const token = searchParams.get("token");
    return typeof token === "string" ? token.trim() : "";
  }, [searchParams]);

  useEffect(() => {
    statusRef.current?.focus();
  }, [captureState, errorMessage]);

  useEffect(() => {
    let active = true;

    async function runCapture() {
      if (!isValidPayPalOrderToken(paypalOrderId)) {
        if (active) {
          setCaptureState(CAPTURE_STATE.INVALID_RETURN);
          setErrorMessage("No pudimos validar el retorno de PayPal.");
        }
        return;
      }

      if (active) {
        setCaptureState(CAPTURE_STATE.CAPTURING);
        setErrorMessage("");
      }

      try {
        const result = await captureOnce(paypalOrderId);

        if (!active) {
          return;
        }

        if (result?.status === "CAPTURADA") {
          setCaptureState(CAPTURE_STATE.SUCCESS);
          clearPendingDonationOrder();
          return;
        }

        setCaptureState(CAPTURE_STATE.RECOVERABLE_ERROR);
        setErrorMessage("No pudimos confirmar la operación en este momento. Intenta nuevamente.");
      } catch (error) {
        if (!active) {
          return;
        }

        setCaptureState(CAPTURE_STATE.RECOVERABLE_ERROR);
        setErrorMessage(
          getPublicDonationErrorMessage(
            error,
            "No pudimos confirmar la operación en este momento. Intenta nuevamente.",
          ),
        );
      }
    }

    runCapture();

    return () => {
      active = false;
    };
  }, [attemptCounter, paypalOrderId]);

  const pendingDonation = useMemo(
    () => readPendingDonationOrder(paypalOrderId),
    [paypalOrderId],
  );
  const isProcessing =
    captureState === CAPTURE_STATE.CAPTURING
    || captureState === CAPTURE_STATE.VALIDATING_RETURN;

  return (
    <section className="donation-public-page donation-public-page--result">
      <div
        ref={statusRef}
        className={`donation-result-card ${
          captureState === CAPTURE_STATE.SUCCESS
            ? "is-success"
            : isProcessing
              ? "is-pending"
              : "is-error"
        }`}
        tabIndex={-1}
        aria-live="polite"
      >
        {isProcessing ? (
          <>
            <div className="donation-result-illustration is-pending" aria-hidden="true">
              <span className="donation-result-spinner" />
            </div>
            <p className="donation-kicker">Procesando</p>
            <h1>Estamos confirmando tu donación</h1>
            <p>
              Validamos el retorno de PayPal y confirmamos la operación con el mismo token
              seguro.
            </p>
          </>
        ) : null}

        {captureState === CAPTURE_STATE.SUCCESS ? (
          <div className="donation-result-content">
            <div>
              <span className="donation-result-heart">♥</span>
            </div>
            <h1>Gracias por tu donación</h1>
            <p>
              Tu aporte ya fue recibido y será una ayuda real para los animales rescatados
              que están bajo nuestro cuidado.
            </p>

            {pendingDonation?.monto ? (
              <div className="donation-result-amount-block" aria-label="Monto donado">
                <span className="donation-result-amount-label">Monto donado</span>
                <div className="donation-result-amount">
                  <span>{pendingDonation.monto}</span>
                  <span className="donation-result-currency">
                    {pendingDonation.moneda || "USD"}
                  </span>
                </div>
              </div>
            ) : null}

            <dl className="donation-result-summary">
              <div className="donation-result-summary-row">
                <dt>Método de pago</dt>
                <dd>PayPal</dd>
              </div>
              <div className="donation-result-summary-row">
                <dt>Estado</dt>
                <dd className="donation-result-status">
                  <span className="donation-result-status-dot" aria-hidden="true" />
                  Donación confirmada
                </dd>
              </div>
            </dl>

            <div className="donation-result-actions">
              <Link className="donation-primary-button as-link" to={publicSiteConfig.routes.donate}>
                Volver a donar
              </Link>
              <Link className="donation-secondary-link" to={publicSiteConfig.routes.home}>
                Volver al inicio
              </Link>
            </div>
          </div>
        ) : null}

        {captureState === CAPTURE_STATE.RECOVERABLE_ERROR ? (
          <div className="donation-result-content">
            <div>
              <span className="donation-result-symbol">!</span>
            </div>
            <h1>No pudimos confirmar la operación ahora</h1>
            <p>{errorMessage}</p>
            <div className="donation-result-actions">
              <button
                type="button"
                className="donation-primary-button"
                onClick={() => setAttemptCounter((value) => value + 1)}
              >
                Reintentar confirmación
              </button>
              <Link className="donation-secondary-link" to={publicSiteConfig.routes.donate}>
                Volver a donar
              </Link>
              <Link className="donation-secondary-link" to={publicSiteConfig.routes.home}>
                Volver al inicio
              </Link>
            </div>
          </div>
        ) : null}

        {captureState === CAPTURE_STATE.INVALID_RETURN ? (
          <div className="donation-result-content">
            <div>
              <span className="donation-result-symbol">!</span>
            </div>
            <h1>No pudimos validar este regreso desde PayPal</h1>
            <p>
              El enlace de retorno no incluye un token válido para confirmar la donación.
            </p>
            <div className="donation-result-actions">
              <Link className="donation-primary-button as-link" to={publicSiteConfig.routes.donate}>
                Volver a donar
              </Link>
              <Link className="donation-secondary-link" to={publicSiteConfig.routes.home}>
                Volver al inicio
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
