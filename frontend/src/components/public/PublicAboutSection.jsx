import { Camera, HeartHandshake, Mail, MapPinned } from "lucide-react";
import { publicSiteConfig } from "../../config/publicSite.config";

export default function PublicAboutSection() {
  const { foundation } = publicSiteConfig;
  const historyParagraphs = String(foundation.history || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <section id="sobre-nosotros" className="public-about-section" aria-labelledby="sobre-nosotros-title">
      <div className="public-section-heading public-section-heading--light">
        <p className="public-section-kicker">Sobre nosotros</p>
        <h2 id="sobre-nosotros-title">Cuidamos rescates que necesitan tiempo, atención y continuidad</h2>
        <p>
          {foundation.description}
        </p>
      </div>

   <div className="public-about-section__grid">
  <article className="public-glass-card public-about-section__story">
    <div className="public-about-section__story-header">
      <h3>Nuestra Historia</h3>
    </div>

    <div className="public-about-section__story-copy">
      {historyParagraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
    </div>
  </article>

  <div className="public-about-section__values">
    <article className="public-glass-card public-about-section__value-card">
      <h3>Visión</h3>
      <p>{foundation.vision}</p>
    </article>

    <article className="public-glass-card public-about-section__value-card">
      <h3>Misión</h3>
      <p>{foundation.mission}</p>
    </article>
  </div>
</div>

      <div className="public-about-section__meta">
        <div className="public-glass-card public-about-section__regions">
          <div className="public-about-section__block-title">
            <MapPinned size={18} aria-hidden="true" />
            <h3>Regiones donde trabajamos</h3>
          </div>
          <div className="public-chip-list">
            {foundation.servedRegions.map((region) => (
              <span key={region} className="public-chip">
                {region}
              </span>
            ))}
          </div>
        </div>

        <div className="public-glass-card public-about-section__contact">
          <div className="public-about-section__block-title">
            <HeartHandshake size={18} aria-hidden="true" />
            <h3>Contacto</h3>
          </div>
          <div className="public-about-section__links">
            <a href={`mailto:${foundation.contactEmail}`} className="public-inline-link">
              <Mail size={16} aria-hidden="true" />
              <span>{foundation.contactEmail}</span>
            </a>
            <a
              href={foundation.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="public-inline-link"
              aria-label="Instagram de Fundación Rescate Esponjosos"
            >
              <Camera size={16} aria-hidden="true" />
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
