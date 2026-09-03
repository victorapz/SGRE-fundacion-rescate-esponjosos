import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import {
  clearPendingDonationOrder,
  readPendingDonationOrder,
} from "../../utils/publicDonation";

export default function DonationCancelPage() {
  usePublicPageMeta({
    title: "Donacion cancelada",
    description: "La operacion de PayPal no se completo y no se confirmo ningun cobro.",
  });

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      return;
    }

    const pendingDonation = readPendingDonationOrder(token.trim());
    if (pendingDonation) {
      clearPendingDonationOrder();
    }
  }, [searchParams]);

  return (
    <section className="donation-public-page donation-public-page--result">
      <div className="donation-result-card is-cancelled" aria-live="polite">
        <div>
          <span className="donation-result-symbol">♥</span>
        </div>
        <h1>La donacion no fue completada</h1>
        <p>
          No se confirmo ningun cobro. Si lo deseas, puedes volver a intentarlo. Tu
          intencion de ayudar ya significa mucho para nosotros.
        </p>
        <p className="donation-result-caption">Estaremos aqui cuando quieras volver.</p>

        <div className="donation-result-actions">
          <Link className="donation-primary-button as-link" to={publicSiteConfig.routes.donate}>
            Intentar nuevamente
          </Link>
          <Link className="donation-secondary-link" to={publicSiteConfig.routes.home}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}
