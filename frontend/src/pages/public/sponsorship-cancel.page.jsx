import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PUBLIC_SITE_ROUTES } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import {
  clearPendingPublicSponsorship,
  clearResolvedPublicSponsorship,
  readPendingPublicSponsorship,
  resolvePublicSponsorshipAnimalId,
} from "../../utils/publicSponsorship";

export default function PublicSponsorshipCancelPage() {
  const [searchParams] = useSearchParams();
  const pendingState = readPendingPublicSponsorship();
  const queryAnimalId = searchParams.get("animal_id");
  const resolvedAnimalId = useMemo(
    () => resolvePublicSponsorshipAnimalId({
      pendingReference: pendingState,
      queryAnimalId,
    }),
    [pendingState, queryAnimalId],
  );

  usePublicPageMeta({
    title: "Apadrinamiento no completado",
    description: "El flujo de PayPal no se completo y todavia no existe una confirmacion definitiva.",
  });

  useEffect(() => {
    clearPendingPublicSponsorship();
    clearResolvedPublicSponsorship();
  }, []);

  return (
    <section className="donation-public-page donation-public-page--result">
      <div className="donation-result-card is-cancelled public-sponsorship-result-shell" aria-live="polite">
        <div>
          <span className="donation-result-symbol">♥</span>
        </div>
        <h1>El proceso con PayPal no se completó</h1>
        <p>
          No confirmamos un apadrinamiento definitivo desde esta página. Si quieres, puedes volver
          a intentarlo desde la ficha del animal o desde el listado general.
        </p>
        <div className="donation-result-actions">
          {resolvedAnimalId ? (
            <Link
              className="donation-secondary-link"
              to={PUBLIC_SITE_ROUTES.sponsorshipDetail.replace(":animalId", String(resolvedAnimalId))}
            >
              Volver al animal
            </Link>
          ) : null}
          <Link className="donation-primary-button as-link" to={PUBLIC_SITE_ROUTES.sponsorshipList}>
            Intentar nuevamente
          </Link>
          <Link className="donation-secondary-link" to={PUBLIC_SITE_ROUTES.home}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}
