import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, PowerOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import IconButton from "../components/common/IconButton";
import FilterSummaryBar from "../components/FilterSummaryBar";
import FosterHomeFormModal from "../components/foster-home/FosterHomeFormModal.jsx";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import {
  createFosterHome,
  deleteFosterHome,
  getFosterHomes,
  getMyFosterHome,
} from "../services/foster_home.service";
import { getRegions } from "../services/region.service";
import { getUsers } from "../services/user.service";
import "../styles/home.page.css";
import "../styles/animals.page.css";
import "../styles/foster-home.page.css";
import { formatEnumLabel, getUserFullName } from "../utils/foster-home";

const HOME_PERMISSIONS = {
  update: PERMISSIONS.ANIMALS.FOSTER_HOME_UPDATE,
  create: PERMISSIONS.ANIMALS.FOSTER_HOME_CREATE,
  delete: PERMISSIONS.ANIMALS.FOSTER_HOME_DELETE,
};

const FOSTER_HOME_ROLE = "Hogar Temporal";

function emptyHomeForm() {
  return {
    observaciones: "",
    activo: true,
    usuarios_asociados: [],
    responsable_usuario_id: "",
  };
}

function buildHomePayload(form) {
  return {
    observaciones: form.observaciones.trim(),
    activo: Boolean(form.activo),
    usuarios_asociados: form.usuarios_asociados.map((value) => Number(value)),
    responsable_usuario_id: Number(form.responsable_usuario_id),
  };
}

function getActiveRescuedAnimals(home) {
  return Array.isArray(home.activeAssignments)
    ? home.activeAssignments.map((assignment) => assignment.animal).filter(Boolean)
    : [];
}

function buildRescuedSummary(home) {
  const rescuedAnimals = getActiveRescuedAnimals(home);
  const names = rescuedAnimals
    .map((animal) => animal.nombre || `Rescatado ${animal.id || ""}`.trim())
    .filter(Boolean);

  return {
    names: names.slice(0, 2),
    remainingCount: Math.max(names.length - 2, 0),
  };
}

function getHomeResponsibleName(home) {
  return getUserFullName(home?.responsableUsuario) || "Sin responsable";
}

function getHomeContact(home) {
  return home?.responsableUsuario?.telefono || home?.responsableUsuario?.email || "Sin contacto";
}

function getHomeLocationLabel(home) {
  return [
    home?.location?.region?.nombre,
    home?.location?.comuna?.nombre,
    home?.location?.direccion,
  ]
    .filter(Boolean)
    .join(" · ") || "Sin ubicación";
}

function getHomeRegionId(home) {
  return home?.location?.region?.id || "";
}

function validateHomeForm(form) {
  if (form.usuarios_asociados.length === 0) {
    return "Debes asociar al menos un usuario al hogar temporal.";
  }

  if (!form.responsable_usuario_id) {
    return "Debes elegir un responsable del hogar temporal.";
  }

  if (!form.usuarios_asociados.includes(Number(form.responsable_usuario_id))) {
    return "El responsable debe estar incluido dentro de los usuarios asociados.";
  }

  return "";
}

export default function FosterHomePage() {
  const navigate = useNavigate();
  const { hasPermission, hasRole } = usePermissions();

  const canCreateHome = hasPermission(HOME_PERMISSIONS.create);
  const canUpdateHome = hasPermission(HOME_PERMISSIONS.update);
  const canDeleteHome = hasPermission(HOME_PERMISSIONS.delete);
  const isOwnHomeOnlyUser =
    hasRole(FOSTER_HOME_ROLE)
    && !canCreateHome
    && !canUpdateHome
    && !canDeleteHome;

  const [homes, setHomes] = useState([]);
  const [homesLoading, setHomesLoading] = useState(true);
  const [homesError, setHomesError] = useState("");
  const [myHomeRedirectLoading, setMyHomeRedirectLoading] = useState(false);
  const [myHomeRedirectError, setMyHomeRedirectError] = useState("");
  const [regions, setRegions] = useState([]);
  const [users, setUsers] = useState([]);
  const [formOptionsLoaded, setFormOptionsLoaded] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    regionId: "",
    status: "",
    species: "",
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPreparingModal, setIsPreparingModal] = useState(false);
  const [homeForm, setHomeForm] = useState(emptyHomeForm());
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadHomes = useCallback(async () => {
    setHomesLoading(true);
    setHomesError("");

    try {
      setHomes(await getFosterHomes());
    } catch (error) {
      setHomesError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los hogares temporales.",
      );
    } finally {
      setHomesLoading(false);
    }
  }, []);

  const loadRegions = useCallback(async () => {
    try {
      setRegions(await getRegions({ active: true }));
    } catch (error) {
      setHomesError(
        error instanceof Error ? error.message : "No se pudieron cargar las regiones.",
      );
    }
  }, []);

  useEffect(() => {
    if (isOwnHomeOnlyUser) {
      return;
    }

    loadHomes();
    loadRegions();
  }, [isOwnHomeOnlyUser, loadHomes, loadRegions]);

  useEffect(() => {
    if (!isOwnHomeOnlyUser) {
      setMyHomeRedirectLoading(false);
      setMyHomeRedirectError("");
      return;
    }

    let isMounted = true;

    async function resolveOwnHome() {
      setMyHomeRedirectLoading(true);
      setMyHomeRedirectError("");

      try {
        const ownHome = await getMyFosterHome();
        if (!isMounted) return;

        if (ownHome?.id) {
          navigate(`/hogar-temporal/${ownHome.id}`, { replace: true });
          return;
        }

        setMyHomeRedirectError("No tienes un hogar temporal asociado.");
      } catch (error) {
        if (!isMounted) return;

        setMyHomeRedirectError(
          error instanceof Error
            ? error.message
            : "No se pudo resolver tu hogar temporal asociado.",
        );
      } finally {
        if (isMounted) {
          setMyHomeRedirectLoading(false);
        }
      }
    }

    void resolveOwnHome();

    return () => {
      isMounted = false;
    };
  }, [isOwnHomeOnlyUser, navigate]);

  const ensureFormOptionsLoaded = useCallback(async () => {
    if (formOptionsLoaded) return;

    const usersData = await getUsers();
    setUsers(usersData.filter((user) => user.activo !== false));
    setFormOptionsLoaded(true);
  }, [formOptionsLoaded]);

  const filteredHomes = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return homes.filter((home) => {
      const matchesSearch =
        !searchTerm
        || [
          getHomeResponsibleName(home),
          home.responsableUsuario?.email,
          home.responsableUsuario?.telefono,
          home.location?.direccion,
          home.location?.region?.nombre,
          home.location?.comuna?.nombre,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesRegion =
        !filters.regionId || String(getHomeRegionId(home)) === String(filters.regionId);

      const matchesStatus =
        !filters.status
        || (filters.status === "ACTIVO" && home.activo)
        || (filters.status === "INACTIVO" && !home.activo);

      const matchesSpecies =
        !filters.species
        || home.allowedAnimals.some(
          (rule) => rule.activo !== false && rule.especie === filters.species,
        );

      return matchesSearch && matchesRegion && matchesStatus && matchesSpecies;
    });
  }, [filters, homes]);

  const dashboardStats = useMemo(() => {
    const activeHomes = homes.filter((home) => home.activo).length;
    return {
      activeHomes,
      inactiveHomes: Math.max(homes.length - activeHomes, 0),
      animalsInHomes: homes.reduce(
        (sum, home) => sum + Number(home.activeAssignmentsCount || 0),
        0,
      ),
    };
  }, [homes]);

  const fosterFilterStats = useMemo(() => {
    const filteredActiveHomes = filteredHomes.filter((home) => home.activo).length;
    const filteredAnimalsInHomes = filteredHomes.reduce(
      (sum, home) => sum + Number(home.activeAssignmentsCount || 0),
      0,
    );

    return [
      `Mostrando ${filteredHomes.length} de ${homes.length}`,
      `Activos: ${filteredActiveHomes}`,
      `Animales en hogar: ${filteredAnimalsInHomes}`,
    ];
  }, [filteredHomes, homes.length]);

  const handleResetFilters = () => {
    setFilters({
      search: "",
      regionId: "",
      status: "",
      species: "",
    });
  };

  const handleDeleteHome = async (home) => {
    const confirmed = window.confirm(
      `Deseas desactivar el hogar temporal de ${getHomeResponsibleName(home)}?`,
    );

    if (!confirmed) return;

    try {
      await deleteFosterHome(home.id);
      await loadHomes();
    } catch (error) {
      setHomesError(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar el hogar temporal.",
      );
    }
  };

  const handleOpenCreateModal = async () => {
    setFormError("");
    setIsPreparingModal(true);
    setHomeForm(emptyHomeForm());
    setIsCreateModalOpen(true);

    try {
      await ensureFormOptionsLoaded();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los usuarios disponibles.",
      );
    } finally {
      setIsPreparingModal(false);
    }
  };

  const handleCloseCreateModal = () => {
    if (isSaving) return;
    setIsCreateModalOpen(false);
    setHomeForm(emptyHomeForm());
    setFormError("");
  };

  const handleSubmitHome = async (event) => {
    event.preventDefault();
    setFormError("");

    const validationError = validateHomeForm(homeForm);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      await createFosterHome(buildHomePayload(homeForm));
      await loadHomes();
      handleCloseCreateModal();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se pudo crear el hogar temporal.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isOwnHomeOnlyUser) {
    return (
      <section className="main-content home-content foster-home-page">
        <header className="main-header foster-page-header">
          <div>
            <h1>Hogar temporal</h1>
            <p>
              Redirigiendo a tu hogar temporal asociado.
            </p>
          </div>
        </header>

        <section className="crud-card">
          {myHomeRedirectLoading ? (
            <p className="foster-muted">Resolviendo tu hogar temporal...</p>
          ) : myHomeRedirectError ? (
            <p className="error-text">{myHomeRedirectError}</p>
          ) : (
            <p className="foster-muted">Preparando el detalle de tu hogar temporal...</p>
          )}
        </section>
      </section>
    );
  }

  return (
    <section className="main-content home-content foster-home-page">
      <header className="main-header foster-page-header">
        <div>
          <h1>Hogar temporal</h1>
          <p>
            Gestiona hogares temporales, revisa rescatados activos y entra al detalle
            para editar miembros, reglas y asignaciones.
          </p>
        </div>
      </header>

      <section className="crud-card foster-filter-card">
        <div className="foster-card-header">
          <div className="foster-filter-card-copy">
            <h3>Filtros y resumen</h3>
          </div>
        </div>

        <div className="foster-filter-grid">
          <label className="foster-filter-field">
            <span>Buscar</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, search: event.target.value }))
              }
              placeholder="Responsable, contacto o ubicación"
            />
          </label>

          <label className="foster-filter-field">
            <span>Región</span>
            <select
              value={filters.regionId}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, regionId: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="foster-filter-field">
            <span>Activo</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, status: event.target.value }))
              }
            >
              <option value="">Todos</option>
              <option value="ACTIVO">Sí</option>
              <option value="INACTIVO">No</option>
            </select>
          </label>

          <label className="foster-filter-field">
            <span>Especie permitida</span>
            <select
              value={filters.species}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, species: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {Array.from(new Set(homes.flatMap((home) => home.allowedAnimals.map((rule) => rule.especie))))
                .filter(Boolean)
                .map((species) => (
                  <option key={species} value={species}>
                    {formatEnumLabel(species)}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </section>

      <div className="foster-summary">
        <span className="foster-summary-pill">HT activos: {dashboardStats.activeHomes}</span>
        <span className="foster-summary-pill">HT inactivos: {dashboardStats.inactiveHomes}</span>
        <span className="foster-summary-pill">Animales en hogar: {dashboardStats.animalsInHomes}</span>
      </div>

      <section className="crud-card">
        <div className="foster-card-header">
          <div>
            <h3>Listado de hogares temporales</h3>
          </div>
          {canCreateHome ? (
            <button type="button" className="btn btn-primary" onClick={handleOpenCreateModal}>
              Crear hogar temporal
            </button>
          ) : null}
        </div>

        <div className="foster-filter-grid foster-table-tools">
          <label className="foster-filter-field">
            <span>Buscar</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, search: event.target.value }))
              }
              placeholder="Responsable, contacto o ubicación"
            />
          </label>

          <label className="foster-filter-field">
            <span>Región</span>
            <select
              value={filters.regionId}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, regionId: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="foster-filter-field">
            <span>Activo</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, status: event.target.value }))
              }
            >
              <option value="">Todos</option>
              <option value="ACTIVO">SÃ­</option>
              <option value="INACTIVO">No</option>
            </select>
          </label>

          <label className="foster-filter-field">
            <span>Especie permitida</span>
            <select
              value={filters.species}
              onChange={(event) =>
                setFilters((currentValue) => ({ ...currentValue, species: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {Array.from(new Set(homes.flatMap((home) => home.allowedAnimals.map((rule) => rule.especie))))
                .filter(Boolean)
                .map((species) => (
                  <option key={species} value={species}>
                    {formatEnumLabel(species)}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <FilterSummaryBar stats={fosterFilterStats} onClear={handleResetFilters} />

        {homesError ? <p className="error-text">{homesError}</p> : null}

        {homesLoading ? (
          <p className="foster-muted">Cargando hogares temporales...</p>
        ) : filteredHomes.length === 0 ? (
          <p className="foster-muted">No se encontraron hogares temporales con los filtros actuales.</p>
        ) : (
          <div className="table-scroll">
            <table className="crud-table foster-table">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Contacto</th>
                  <th>Ubicación</th>
                  <th>Rescatados</th>
                  <th>Activo</th>
                  <th className="table-actions-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredHomes.map((home) => {
                  const rescuedSummary = buildRescuedSummary(home);

                  return (
                    <tr key={home.id}>
                      <td className="foster-table-cell">
                        <div className="foster-meta-stack">
                          <strong className="foster-meta-title">
                            {getHomeResponsibleName(home)}
                          </strong>
                        </div>
                      </td>
                      <td className="foster-table-cell">
                        <div className="foster-meta-stack">
                          <span>{getHomeContact(home)}</span>
                        </div>
                      </td>
                      <td className="foster-table-cell">
                        {getHomeLocationLabel(home)}
                      </td>
                      <td className="foster-table-cell">
                        {rescuedSummary.names.length === 0 ? (
                          <span className="foster-muted">Sin rescatados</span>
                        ) : (
                          <div className="foster-rescued-list">
                            {rescuedSummary.names.map((animalName) => (
                              <span key={`${home.id}-${animalName}`} className="foster-chip foster-rescued-chip">
                                {animalName}
                              </span>
                            ))}
                            {rescuedSummary.remainingCount > 0 ? (
                              <span className="foster-chip foster-chip-muted">
                                +{rescuedSummary.remainingCount}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td>{home.activo ? "Sí" : "No"}</td>
                      <td className="table-actions-cell">
                        <div className="row-actions table-actions">
                          <IconButton
                            icon={Eye}
                            label={`Ver detalle del hogar temporal de ${getHomeResponsibleName(home)}`}
                            variant="secondary"
                            onClick={() => navigate(`/hogar-temporal/${home.id}`)}
                          />
                          {canDeleteHome ? (
                            <IconButton
                              icon={PowerOff}
                              label={`Desactivar hogar temporal de ${getHomeResponsibleName(home)}`}
                              variant="warning"
                              onClick={() => handleDeleteHome(home)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FosterHomeFormModal
        isOpen={isCreateModalOpen}
        title="Crear hogar temporal"
        submitLabel="Crear hogar"
        form={homeForm}
        setForm={setHomeForm}
        users={users}
        error={formError}
        isSaving={isSaving}
        isPreparing={isPreparingModal}
        onClose={handleCloseCreateModal}
        onSubmit={handleSubmitHome}
      />
    </section>
  );
}
