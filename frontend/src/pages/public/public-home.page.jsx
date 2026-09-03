import { ArrowRight, HeartHandshake, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import PublicAboutSection from "../../components/public/PublicAboutSection";
import PublicTransferCard from "../../components/public/PublicTransferCard";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";

const SUPPORT_AREAS = [
  {
    title: "Atención veterinaria",
    description:
      "Tu aporte permite financiar consultas, exámenes, medicamentos, cirugías y tratamientos necesarios para que nuestros rescatados recuperen su salud.",
  },
  {
    title: "Alimento y recuperación",
    description:
      "Con tu ayuda podemos proporcionar alimentación de calidad, suplementos y los cuidados diarios que cada animal necesita durante su proceso de recuperación.",
  },
  {
    title: "Rescate y rehabilitación",
    description:
      "Cada donación hace posible rescatar animales en situación de abandono, brindarles un lugar seguro y prepararlos para encontrar un hogar definitivo.",
  },
];

export default function PublicHomePage() {
  usePublicPageMeta({
    title: "Inicio",
    description: publicSiteConfig.description,
  });

  return (
    <div className="public-home">
      <section className="public-home__hero">
        <div className="public-home__hero-copy">
          <p className="public-section-kicker">Fundacion</p>
          <h1>{publicSiteConfig.name}</h1>
          <p className="public-home__lead">{publicSiteConfig.description}</p>

          <div className="public-home__actions">
            <Link to={publicSiteConfig.routes.donate} className="public-button public-button--primary">
              <HeartHandshake size={18} aria-hidden="true" />
              <span>Donar con PayPal</span>
            </Link>

            <Link
              to={publicSiteConfig.routes.sponsorshipList}
              className="public-button public-button--secondary"
            >
              <span>Ver apadrinamientos</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <a
              href={publicSiteConfig.foundation.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="public-button public-button--secondary"
            >
              <span>Instagram</span>
              <ArrowRight size={18} aria-hidden="true" />
            </a>

            <Link to={`${publicSiteConfig.routes.home}#sobre-nosotros`} className="public-button public-button--secondary">
              <span>Sobre nosotros</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>

          <div className="public-home__trust">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Donaciones unicas procesadas de forma segura por PayPal.</span>
          </div>
        </div>

      </section>

      <section className="public-home__support">
        <div className="public-section-heading">
          <p className="public-section-kicker">Apoyo directo</p>
          <h2>Hoy puedes ayudar de forma concreta</h2>
          <p>{publicSiteConfig.institutionalText}</p>
        </div>

  <div className="public-home__support-grid">
  {SUPPORT_AREAS.map((item) => (
    <article key={item.title} className="public-glass-card">
      <span className="public-card__badge" aria-hidden="true" />
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </article>
  ))}
</div>
      </section>

      <PublicAboutSection />

      <section className="public-home__help">
        <div className="public-section-heading public-section-heading--light">
          <p className="public-section-kicker">Cómo ayudar</p>
          <h2>Hay más de una forma de sostener un rescate</h2>
          <p>
            Puedes colaborar con un aporte único, un apadrinamiento mensual o ayudando a difundir
            nuestro trabajo para que más personas se sumen.
          </p>
        </div>

        <div className="public-home__support-grid">
          <article className="public-glass-card">
            <h3>Donar</h3>
            <p>Realiza un aporte puntual y seguro para sostener atención, alimentos e insumos.</p>
            <Link to={publicSiteConfig.routes.donate} className="public-inline-link">
              <span>Ir a donar</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
          <article className="public-glass-card">
            <h3>Apadrinar</h3>
            <p>Comprométete con apoyo mensual y acompaña procesos de recuperación más largos.</p>
            <Link to={publicSiteConfig.routes.sponsorshipList} className="public-inline-link">
              <span>Ver apadrinamientos</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
          <article className="public-glass-card">
            <h3>Difundir y contactar</h3>
            <p>Comparte nuestros casos, escríbenos y ayúdanos a ampliar la red de apoyo.</p>

          </article>
        </div>
      </section>

      <PublicTransferCard />
    </div>
  );
}
