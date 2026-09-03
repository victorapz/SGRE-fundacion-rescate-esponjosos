import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicPageState from "../../components/public/PublicPageState";
import PublicApiImage from "../../components/public/PublicApiImage";
import { PUBLIC_SITE_ROUTES } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import { getPublicSponsorshipStatus } from "../../services/public-sponsorship.service";
import {
  clearPendingPublicSponsorship,
  getPublicSponsorshipPendingStatePhase,
  readPendingPublicSponsorship,
  readResolvedPublicSponsorship,
  resolvePublicSponsorshipAnimalId,
  resolvePublicSponsorshipReference,
  storeResolvedPublicSponsorship,
} from "../../utils/publicSponsorship";

const MAX_POLL_ATTEMPTS = 10;
const POLL_DELAY_MS = 3000;

export default function PublicSponsorshipSuccessPage() {
  const [searchParams] = useSearchParams();
  const refFromQuery = typeof searchParams.get("ref") === "string"
    ? searchParams.get("ref").trim()
    : "";
  const queryAnimalId = searchParams.get("animal_id");
  const pendingReference = readPendingPublicSponsorship();
  const resolvedReference = readResolvedPublicSponsorship();
  const publicReference = useMemo(
    () => resolvePublicSponsorshipReference({
      refFromQuery,
      pendingReference,
      resolvedReference,
    }),
    [pendingReference, refFromQuery, resolvedReference],
  );
  const initialStatus = useMemo(() => {
    if (!resolvedReference || !publicReference) {
      return null;
    }

    const resolvedPublicReference = resolvedReference.publicReference || resolvedReference.public_reference;
    return resolvedPublicReference === publicReference ? resolvedReference : null;
  }, [publicReference, resolvedReference]);
  const [status, setStatus] = useState(initialStatus);
  const [phase, setPhase] = useState(() => {
    if (!publicReference) {
      return "missing";
    }

    return initialStatus
      ? getPublicSponsorshipPendingStatePhase(initialStatus)
      : "pending";
  });
  const [error, setError] = useState("");
  const timeoutRef = useRef(null);
  const inFlightRef = useRef(false);
  const attemptsRef = useRef(0);

  usePublicPageMeta({
    title: "Confirmacion de apadrinamiento",
    description: "Consultamos el estado real del apadrinamiento después de volver desde PayPal.",
  });

  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!publicReference || phase === "active" || phase === "failed" || phase === "timeout") {
      return undefined;
    }

    let active = true;
    attemptsRef.current = 0;

    const scheduleNextPoll = (callback) => {
      timeoutRef.current = window.setTimeout(() => {
        void callback();
      }, POLL_DELAY_MS);
    };

    const pollStatus = async () => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      attemptsRef.current += 1;

      try {
        const payload = await getPublicSponsorshipStatus(publicReference);
        if (!active) {
          return;
        }

        setStatus(payload);
        const nextPhase = getPublicSponsorshipPendingStatePhase(payload);

        if (nextPhase === "active") {
          storeResolvedPublicSponsorship(payload);
          clearPendingPublicSponsorship();
          setPhase("active");
          setError("");
          return;
        }

        if (nextPhase === "failed") {
          storeResolvedPublicSponsorship(payload);
          clearPendingPublicSponsorship();
          setPhase("failed");
          setError("");
          return;
        }

        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setPhase("timeout");
          return;
        }

        setPhase("pending");
        setError("");
        scheduleNextPoll(pollStatus);
      } catch (requestError) {
        if (!active) {
          return;
        }

        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setPhase("timeout");
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No pudimos confirmar el apadrinamiento todavia.",
          );
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "No pudimos confirmar el apadrinamiento todavia.",
        );
        scheduleNextPoll(pollStatus);
      } finally {
        inFlightRef.current = false;
      }
    };

    void pollStatus();

    return () => {
      active = false;
      inFlightRef.current = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [phase, publicReference]);

  const resolvedAnimalId = resolvePublicSponsorshipAnimalId({
    pendingReference,
    queryAnimalId,
    status,
  });

  if (!publicReference) {
    return (
      <PublicPageState
        variant="neutral"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="No pudimos identificar el apadrinamiento en este navegador"
        description="Si acabas de volver desde PayPal, vuelve al animal o inicia nuevamente el flujo desde el listado."
        actions={(
          <Link className="public-button public-button--primary" to={PUBLIC_SITE_ROUTES.sponsorshipList}>
            Volver al listado
          </Link>
        )}
      />
    );
  }

  if (phase === "pending") {
    return (
      <PublicPageState
        variant="loading"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="Estamos confirmando tu apadrinamiento con PayPal"
        description="Consultamos el estado real antes de mostrar una confirmacion definitiva."
      />
    );
  }

  if (phase === "timeout") {
    return (
      <PublicPageState
        variant="neutral"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="Tu apadrinamiento fue enviado y todavia esta siendo confirmado"
        description={error || "Si PayPal ya mostro la aprobacion, puedes volver mas tarde a revisar el estado."}
        actions={(
          <>
            {resolvedAnimalId ? (
              <Link
                className="public-button public-button--secondary"
                to={PUBLIC_SITE_ROUTES.sponsorshipDetail.replace(":animalId", String(resolvedAnimalId))}
              >
                Volver al animal
              </Link>
            ) : null}
            <Link className="public-button public-button--primary" to={PUBLIC_SITE_ROUTES.sponsorshipList}>
              Volver al listado
            </Link>
          </>
        )}
      />
    );
  }

  if (phase === "failed") {
    return (
      <PublicPageState
        variant="error"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="El apadrinamiento no pudo confirmarse"
        description="Puedes volver al listado o intentar nuevamente desde la ficha del animal."
        actions={(
          <>
            {resolvedAnimalId ? (
              <Link
                className="public-button public-button--secondary"
                to={PUBLIC_SITE_ROUTES.sponsorshipDetail.replace(":animalId", String(resolvedAnimalId))}
              >
                Volver al animal
              </Link>
            ) : null}
            <Link className="public-button public-button--primary" to={PUBLIC_SITE_ROUTES.sponsorshipList}>
              Volver al listado
            </Link>
          </>
        )}
      />
    );
  }

  return (
    <section className="donation-public-page donation-public-page--result" aria-live="polite">
      <div className="donation-result-card is-success public-sponsorship-result-shell">
      <p className="donation-kicker">Apadrinamiento activo</p>
      <h1>Tu apoyo mensual ya quedó confirmado</h1>
      <p>
        Gracias por acompañar este proceso. A partir de ahora este animal cuenta con tu apoyo recurrente.
      </p>

      <div className="public-sponsorship-result-card__summary">
        <div className="public-sponsorship-result-card__animal">
          {status?.animal?.imagen_principal ? (
            <PublicApiImage
              src={status.animal.imagen_principal}
              alt={`Imagen de ${status.animal.nombre}`}
              fallback={(
                <div className="public-sponsorship-result-card__animal-fallback" aria-hidden="true">
                  <span>{status?.animal?.nombre?.charAt(0) || "R"}</span>
                </div>
              )}
            />
          ) : (
            <div className="public-sponsorship-result-card__animal-fallback" aria-hidden="true">
              <span>{status?.animal?.nombre?.charAt(0) || "R"}</span>
            </div>
          )}
          <div>
            <strong>{status?.animal?.nombre || "Animal rescatado"}</strong>
            <span>{status?.plan?.nombre || "Plan mensual"}</span>
          </div>
        </div>

        <dl className="public-sponsorship-result-card__meta">
          <div>
            <dt>Plan</dt>
            <dd>{status?.plan?.nombre || "Plan mensual"}</dd>
          </div>
          <div>
            <dt>Monto</dt>
            <dd>{`${status?.plan?.moneda || "USD"} ${Number(status?.plan?.monto || 0).toFixed(2)}`}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>Activo</dd>
          </div>
        </dl>
      </div>

      <div className="public-page-state__actions">
        <Link className="public-button public-button--primary" to={PUBLIC_SITE_ROUTES.sponsorshipList}>
          Volver al listado
        </Link>
        {resolvedAnimalId ? (
          <Link
            className="public-button public-button--secondary"
            to={PUBLIC_SITE_ROUTES.sponsorshipDetail.replace(":animalId", String(resolvedAnimalId))}
          >
            Ver al animal
          </Link>
        ) : null}
        <Link className="public-button public-button--secondary" to={PUBLIC_SITE_ROUTES.home}>
          Volver al inicio
        </Link>
      </div>
      </div>
    </section>
  );
}
