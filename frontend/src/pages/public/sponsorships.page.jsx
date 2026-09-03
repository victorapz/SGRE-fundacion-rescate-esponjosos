import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PublicPageState from "../../components/public/PublicPageState";
import PublicPagination from "../../components/public/sponsorship/PublicPagination";
import SponsorshipAnimalCard from "../../components/public/sponsorship/SponsorshipAnimalCard";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import { getPublicSponsorshipAnimals } from "../../services/public-sponsorship.service";

const PAGE_SIZE = 9;

export default function PublicSponsorshipsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const currentPage = Math.max(Number(searchParams.get("page")) || 1, 1);
  const currentSearch = (searchParams.get("search") || "").trim();

  usePublicPageMeta({
    title: "Apadrinamiento",
    description: "Conoce a los animales apadrinables y acompanalos con un aporte mensual.",
  });

  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    let active = true;

    async function loadAnimals() {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getPublicSponsorshipAnimals({
          search: currentSearch,
          page: currentPage,
          limit: PAGE_SIZE,
        });

        if (!active) {
          return;
        }

        setItems(payload.items);
        setPagination(payload.pagination);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No fue posible cargar los animales disponibles para apadrinamiento.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAnimals();

    return () => {
      active = false;
    };
  }, [currentPage, currentSearch, reloadKey]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const nextParams = {};
    if (searchValue.trim()) {
      nextParams.search = searchValue.trim();
    }
    setSearchParams(nextParams);
  };

  const handlePageChange = (page) => {
    const nextParams = {};
    if (currentSearch) {
      nextParams.search = currentSearch;
    }
    if (page > 1) {
      nextParams.page = String(page);
    }
    setSearchParams(nextParams);
  };

  if (isLoading) {
    return (
      <PublicPageState
        variant="loading"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="Cargando animales apadrinables"
        description="Estamos preparando el listado para que conozcas a quienes hoy necesitan apoyo mensual."
      />
    );
  }

  if (error && !items.length) {
    return (
      <PublicPageState
        variant="error"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="No pudimos cargar los animales apadrinables"
        description={error}
        actions={(
          <button
            type="button"
            className="public-button public-button--primary"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Reintentar
          </button>
        )}
      />
    );
  }

  return (
    <div className="public-sponsorship-page">
      <section className="public-notices-hero">
        <p className="public-section-kicker">Apadrinamiento</p>
        <h1>Ayuda cada mes a un animal rescatado</h1>
        <p>
          Conoce a quienes hoy estan disponibles para apadrinamiento y elige una forma
          concreta de acompanar su recuperación.
        </p>
      </section>

      <section className="public-sponsorship-toolbar">
        <form className="public-sponsorship-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="public-sponsorship-search" className="public-sponsorship-search__label">
            Buscar animal
          </label>
          <div className="public-sponsorship-search__row">
            <input
              id="public-sponsorship-search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Nombre, especie o sexo"
            />
            <button type="submit" className="public-button public-button--secondary">
              Buscar
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <div className="public-inline-alert" role="alert">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <PublicPageState
          variant="empty"
          surface="immersive"
          eyebrow="Apadrinamiento"
          title="No encontramos animales con ese criterio"
          description="Prueba con otra busqueda o vuelve mas tarde para conocer nuevos casos."
        />
      ) : (
        <>
          <section className="public-sponsorship-grid" aria-label="Animales apadrinables">
            {items.map((animal) => (
              <SponsorshipAnimalCard key={animal.id} animal={animal} />
            ))}
          </section>

          <PublicPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            summaryLabel="Pagina"
            onPrevious={() => handlePageChange(pagination.page - 1)}
            onNext={() => handlePageChange(pagination.page + 1)}
          />
        </>
      )}
    </div>
  );
}
