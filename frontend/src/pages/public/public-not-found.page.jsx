import { Link } from "react-router-dom";
import PublicPageState from "../../components/public/PublicPageState";
import { publicSiteConfig } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";

export default function PublicNotFoundPage() {
  usePublicPageMeta({
    title: "Pagina no encontrada",
    description: "La pagina que buscas no esta disponible en este momento.",
  });

  return (
    <PublicPageState
      variant="empty"
      eyebrow="404"
      title="No encontramos esta pagina"
      description="La ruta que intentaste abrir no forma parte del sitio publico disponible en esta etapa."
      actions={(
        <>
          <Link to={publicSiteConfig.routes.home} className="public-button public-button--primary">
            Ir al inicio publico
          </Link>
          <Link to={publicSiteConfig.routes.donate} className="public-button public-button--secondary">
            Ir a donar
          </Link>
        </>
      )}
    />
  );
}
