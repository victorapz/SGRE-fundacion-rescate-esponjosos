import { useState } from "react";
import { Link } from "react-router-dom";
import PublicApiImage from "../PublicApiImage";
import { PUBLIC_SITE_ROUTES } from "../../../config/publicSite.config";

export default function SponsorshipAnimalCard({ animal }) {
  const [hasImageError, setHasImageError] = useState(false);
  const shouldShowImage = Boolean(animal.imagen_principal) && !hasImageError;

  return (
    <article className="public-sponsorship-card">
      <div className="public-sponsorship-card__media">
        {shouldShowImage ? (
          <PublicApiImage
            src={animal.imagen_principal}
            alt={`Imagen principal de ${animal.nombre}`}
            loading="lazy"
            onError={() => setHasImageError(true)}
            fallback={(
              <div className="public-sponsorship-card__fallback">
                <span>{animal.nombre?.charAt(0) || "R"}</span>
              </div>
            )}
          />
        ) : (
          <div className="public-sponsorship-card__fallback">
            <span>{animal.nombre?.charAt(0) || "R"}</span>
          </div>
        )}
      </div>

      <div className="public-sponsorship-card__body">
        <div className="public-sponsorship-card__copy">
          <h2>{animal.nombre}</h2>
          <p>{[animal.especie, animal.sexo].filter(Boolean).join(" / ") || "Animal rescatado"}</p>
          <small>
            {animal.descripcion_corta || animal.historia_corta || "Conoce su historia y acompaña su recuperación con apoyo mensual."}
          </small>
        </div>

        <Link
          to={PUBLIC_SITE_ROUTES.sponsorshipDetail.replace(":animalId", String(animal.id))}
          className="public-button public-button--primary"
        >
          Conocer y apadrinar
        </Link>
      </div>
    </article>
  );
}
