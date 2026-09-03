import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FilterSummaryBar from "../components/FilterSummaryBar";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import PaginationControls from "../components/PaginationControls";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import {
  createAnimal,
  deleteAnimal,
  getAnimals,
  updateAnimal,
} from "../services/animal.service";
import { getRegions } from "../services/region.service";
import {
  ANIMAL_ADOPTION_OPTIONS,
  ANIMAL_BIRTH_DATE_TYPE_OPTIONS,
  ANIMAL_HEALTH_OPTIONS,
  ANIMAL_SEX_OPTIONS,
  ANIMAL_SPECIES_OPTIONS,
  buildAnimalPayload,
  canSubmitAnimalForm,
  emptyAnimalForm,
  getAnimalOptionLabel,
  normalizeRegionCatalog,
} from "../utils/animalCore";
import "../styles/home.page.css";
import "../styles/animals.page.css";

function getAnimalStateLabel(value, options, emptyLabel = "-") {
  return getAnimalOptionLabel(options, value, emptyLabel) || emptyLabel;
}

function normalizeSearchText(animal = {}) {
  return [
    animal.nombre,
    animal.especie,
    animal.sexo,
    animal.estadoSalud,
    animal.estadoAdopcion,
    animal.region,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function AnimalsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canReadAnimals = hasPermission(PERMISSIONS.ANIMALS.ANIMAL_READ);
  const canCreateAnimals = hasPermission(PERMISSIONS.ANIMALS.ANIMAL_CREATE);
  const canUpdateAnimals = hasPermission(PERMISSIONS.ANIMALS.ANIMAL_UPDATE);
  const canDeleteAnimals = hasPermission(PERMISSIONS.ANIMALS.ANIMAL_DELETE);

  const [animals, setAnimals] = useState([]);
  const [animalsLoading, setAnimalsLoading] = useState(true);
  const [animalsError, setAnimalsError] = useState("");

  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState("");

  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
  const [animalModalMode, setAnimalModalMode] = useState("create");
  const [editingAnimalId, setEditingAnimalId] = useState(null);
  const [animalForm, setAnimalForm] = useState(emptyAnimalForm());
  const [animalModalError, setAnimalModalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [adoptionFilter, setAdoptionFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [deceasedFilter, setDeceasedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadAnimals = useCallback(async () => {
    if (!canReadAnimals) {
      setAnimals([]);
      setAnimalsLoading(false);
      return;
    }

    setAnimalsLoading(true);
    setAnimalsError("");

    try {
      const animalsData = await getAnimals();
      setAnimals(Array.isArray(animalsData) ? animalsData : []);
    } catch (error) {
      setAnimalsError(
        error instanceof Error ? error.message : "No se pudieron cargar los animales.",
      );
    } finally {
      setAnimalsLoading(false);
    }
  }, [canReadAnimals]);

  const loadRegions = useCallback(async () => {
    setRegionsLoading(true);
    setRegionsError("");

    try {
      const data = await getRegions({ active: true });
      setRegions(normalizeRegionCatalog(data));
    } catch (error) {
      setRegions([]);
      setRegionsError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las regiones disponibles.",
      );
    } finally {
      setRegionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnimals();
  }, [loadAnimals]);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const availableRegions = useMemo(() => {
    if (regions.length > 0) {
      return regions;
    }

    return normalizeRegionCatalog(
      Array.from(
        new Map(
          animals
            .filter((animal) => animal.regionId && animal.region)
            .map((animal) => [
              Number(animal.regionId),
              { id: Number(animal.regionId), nombre: animal.region },
            ]),
        ).values(),
      ),
    );
  }, [animals, regions]);

  const filteredAnimals = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return animals.filter((animal) => {
      if (normalizedSearch && !normalizeSearchText(animal).includes(normalizedSearch)) {
        return false;
      }

      if (speciesFilter !== "all" && animal.especie !== speciesFilter) {
        return false;
      }

      if (healthFilter !== "all" && animal.estadoSalud !== healthFilter) {
        return false;
      }

      if (adoptionFilter !== "all" && (animal.estadoAdopcion || "") !== adoptionFilter) {
        return false;
      }

      if (regionFilter !== "all" && String(animal.regionId || "") !== regionFilter) {
        return false;
      }

      if (deceasedFilter === "alive" && animal.fallecido) {
        return false;
      }

      if (deceasedFilter === "deceased" && !animal.fallecido) {
        return false;
      }

      return true;
    });
  }, [
    adoptionFilter,
    animals,
    deceasedFilter,
    healthFilter,
    regionFilter,
    searchTerm,
    speciesFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, speciesFilter, healthFilter, adoptionFilter, regionFilter, deceasedFilter]);

  const paginatedAnimals = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAnimals.slice(startIndex, startIndex + pageSize);
  }, [filteredAnimals, page, pageSize]);

  const animalStats = useMemo(
    () => [
      `Mostrando ${filteredAnimals.length} de ${animals.length}`,
      `Disponibles: ${
        filteredAnimals.filter((animal) => animal.estadoAdopcion === "DISPONIBLE").length
      }`,
      `Adoptados: ${
        filteredAnimals.filter((animal) => animal.estadoAdopcion === "ADOPTADO").length
      }`,
      `En tratamiento: ${
        filteredAnimals.filter((animal) => animal.estadoSalud === "EN_TRATAMIENTO").length
      }`,
      `Criticos: ${
        filteredAnimals.filter((animal) => animal.estadoSalud === "CRITICO").length
      }`,
      `Fallecidos: ${filteredAnimals.filter((animal) => animal.fallecido).length}`,
    ],
    [animals.length, filteredAnimals],
  );

  const canSubmitForm = canSubmitAnimalForm({
    mode: animalModalMode,
    form: animalForm,
    regionsLoading,
    regionsError,
    regions: availableRegions,
  });

  const handleResetFilters = () => {
    setSearchTerm("");
    setSpeciesFilter("all");
    setHealthFilter("all");
    setAdoptionFilter("all");
    setRegionFilter("all");
    setDeceasedFilter("all");
    setPage(1);
  };

  const openCreateAnimalModal = () => {
    if (!canCreateAnimals) return;
    setAnimalModalMode("create");
    setEditingAnimalId(null);
    setAnimalForm(emptyAnimalForm());
    setAnimalModalError("");
    setIsAnimalModalOpen(true);
  };

  const openEditAnimalModal = (animal) => {
    if (!canUpdateAnimals) return;
    setAnimalModalMode("edit");
    setEditingAnimalId(animal.id);
    setAnimalModalError("");
    setAnimalForm({
      nombre: animal.nombre || "",
      especie: animal.especie || "",
      sexo: animal.sexo || "",
      estado_salud_actual: animal.estadoSalud || "",
      estado_adopcion: animal.estadoAdopcion || "",
      region_id: animal.regionId ? String(animal.regionId) : "",
      fecha_llegada_fundacion: animal.fechaLlegadaFundacion || "",
      fecha_nacimiento: animal.fechaNacimiento || "",
      tipo_fecha_nacimiento: animal.tipoFechaNacimiento || "DESCONOCIDA",
      fallecido: Boolean(animal.fallecido),
      fecha_fallecimiento: animal.fechaFallecimiento || "",
    });
    setIsAnimalModalOpen(true);
  };

  const closeAnimalModal = () => {
    if (isSubmitting) return;
    setAnimalModalError("");
    setIsAnimalModalOpen(false);
  };

  const handleAnimalFormChange = (field, value) => {
    setAnimalForm((currentValue) => {
      const nextValue = {
        ...currentValue,
        [field]: value,
      };

      if (field === "tipo_fecha_nacimiento" && value === "DESCONOCIDA") {
        nextValue.fecha_nacimiento = "";
      }

      if (field === "fallecido" && !value) {
        nextValue.fecha_fallecimiento = "";
      }

      return nextValue;
    });
  };

  const handleSubmitAnimal = async (event) => {
    event.preventDefault();
    if (!canSubmitForm) return;

    setIsSubmitting(true);
    setAnimalModalError("");

    try {
      const payload = buildAnimalPayload(animalForm, animalModalMode);

      if (animalModalMode === "create") {
        await createAnimal(payload);
      } else {
        await updateAnimal(editingAnimalId, payload);
      }

      await loadAnimals();
      setIsAnimalModalOpen(false);
    } catch (error) {
      setAnimalModalError(
        error instanceof Error ? error.message : "No se pudo guardar el animal.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnimal = async (animal) => {
    if (!canDeleteAnimals) return;

    const confirmed = window.confirm(
      `¿Deseas eliminar a ${animal.nombre}? Esta acción solo se permite si no tiene historial asociado.`,
    );
    if (!confirmed) return;

    setAnimalsError("");

    try {
      await deleteAnimal(animal.id);
      await loadAnimals();
    } catch (error) {
      setAnimalsError(
        error instanceof Error ? error.message : "No se pudo eliminar el animal.",
      );
    }
  };

  const handleViewAnimal = (animal) => {
    navigate(`/rescatados/${animal.id}`);
  };

  const isBirthDateEditable = animalForm.tipo_fecha_nacimiento !== "DESCONOCIDA";

  return (
    <section className="main-content home-content animals-page">
      <header className="main-header">
        <h1>Animales</h1>
        <p>Administra el listado de animales rescatados y accede a su historial.</p>
      </header>

      <section className="crud-card">
        <div className="crud-header">
          <h3>Listado de animales</h3>
          {canCreateAnimals ? (
            <button type="button" className="btn btn-primary" onClick={openCreateAnimalModal}>
              Crear animal
            </button>
          ) : null}
        </div>

        <div className="table-tools">
          <label>
            <span>Buscar</span>
            <input
              type="search"
              className="search-input"
              placeholder="Buscar por nombre, especie, sexo, salud, adopción o region"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <label>
            <span>Especie</span>
            <select
              className="filter-select"
              value={speciesFilter}
              onChange={(event) => setSpeciesFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {ANIMAL_SPECIES_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Estado de salud</span>
            <select
              className="filter-select"
              value={healthFilter}
              onChange={(event) => setHealthFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              {ANIMAL_HEALTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Estado de adopción</span>
            <select
              className="filter-select"
              value={adoptionFilter}
              onChange={(event) => setAdoptionFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              {ANIMAL_ADOPTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Región</span>
            <select
              className="filter-select"
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value)}
              disabled={regionsLoading && availableRegions.length === 0}
            >
              <option value="all">Todas</option>
              {availableRegions.map((region) => (
                <option key={region.id} value={String(region.id)}>
                  {region.nombre}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Fallecido</span>
            <select
              className="filter-select"
              value={deceasedFilter}
              onChange={(event) => setDeceasedFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="alive">No fallecido</option>
              <option value="deceased">Fallecido</option>
            </select>
          </label>
        </div>

        {regionsError ? <p className="error-text">{regionsError}</p> : null}
        <FilterSummaryBar stats={animalStats} onClear={handleResetFilters} />

        <div className="table-scroll">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especie</th>
                <th>Sexo</th>
                <th>Estado salud</th>
                <th>Fecha de llegada</th>
                <th className="table-actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {animalsLoading ? (
                <tr>
                  <td colSpan="6">Cargando animales...</td>
                </tr>
              ) : filteredAnimals.length === 0 ? (
                <tr>
                  <td colSpan="6">No hay animales que coincidan con los filtros.</td>
                </tr>
              ) : (
                paginatedAnimals.map((animal) => (
                  <tr key={animal.id}>
                    <td>{animal.nombre || "-"}</td>
                    <td>{animal.especie || "-"}</td>
                    <td>{getAnimalStateLabel(animal.sexo, ANIMAL_SEX_OPTIONS, animal.sexo || "-")}</td>
                    <td>
                      {getAnimalStateLabel(
                        animal.estadoSalud,
                        ANIMAL_HEALTH_OPTIONS,
                        animal.estadoSalud || "-",
                      )}
                    </td>
                    <td>{animal.fechaLlegadaFundacion || "-"}</td>
                    <td className="table-actions-cell">
                      <div className="row-actions table-actions">
                        <IconButton
                          icon={Eye}
                          label={`Ver detalle del animal ${animal.nombre || ""}`.trim()}
                          variant="secondary"
                          onClick={() => handleViewAnimal(animal)}
                        />
                        {canUpdateAnimals ? (
                          <IconButton
                            icon={Pencil}
                            label={`Editar animal ${animal.nombre || ""}`.trim()}
                            variant="secondary"
                            onClick={() => openEditAnimalModal(animal)}
                          />
                        ) : null}
                        {canDeleteAnimals ? (
                          <IconButton
                            icon={Trash2}
                            label={`Eliminar animal ${animal.nombre || ""}`.trim()}
                            variant="danger"
                            onClick={() => handleDeleteAnimal(animal)}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!animalsLoading && filteredAnimals.length > 0 ? (
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={filteredAnimals.length}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        ) : null}

        {animalsError ? <p className="error-text">{animalsError}</p> : null}
      </section>

      {isAnimalModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeAnimalModal}>
          <div
            className="event-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>{animalModalMode === "create" ? "Crear animal" : "Editar animal"}</h3>
              <ModalCloseButton onClick={closeAnimalModal} />
            </div>

            <form className="crud-form-grid" onSubmit={handleSubmitAnimal}>
              <label>
                <span>Nombre</span>
                <input
                  type="text"
                  value={animalForm.nombre}
                  onChange={(event) => handleAnimalFormChange("nombre", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Especie</span>
                <select
                  value={animalForm.especie}
                  onChange={(event) => handleAnimalFormChange("especie", event.target.value)}
                  required
                >
                  <option value="">Seleccione una especie</option>
                  {ANIMAL_SPECIES_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sexo</span>
                <select
                  value={animalForm.sexo}
                  onChange={(event) => handleAnimalFormChange("sexo", event.target.value)}
                  required
                >
                  <option value="">Seleccione el sexo</option>
                  {ANIMAL_SEX_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Estado de salud actual</span>
                <select
                  value={animalForm.estado_salud_actual}
                  onChange={(event) =>
                    handleAnimalFormChange("estado_salud_actual", event.target.value)
                  }
                  required
                >
                  <option value="">Seleccione un estado de salud</option>
                  {ANIMAL_HEALTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Estado de adopción</span>
                <select
                  value={animalForm.estado_adopcion}
                  onChange={(event) => handleAnimalFormChange("estado_adopcion", event.target.value)}
                >
                  <option value="">Seleccione un estado de adopción</option>
                  {ANIMAL_ADOPTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Región</span>
                <select
                  value={animalForm.region_id}
                  onChange={(event) => handleAnimalFormChange("region_id", event.target.value)}
                  disabled={regionsLoading || availableRegions.length === 0}
                  required
                >
                  <option value="">
                    {regionsLoading
                      ? "Cargando regiones..."
                      : availableRegions.length === 0
                        ? "No hay regiones disponibles"
                        : "Seleccione una región"}
                  </option>
                  {availableRegions.map((region) => (
                    <option key={region.id} value={String(region.id)}>
                      {region.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Fecha de llegada a la fundacion</span>
                <input
                  type="date"
                  value={animalForm.fecha_llegada_fundacion}
                  onChange={(event) =>
                    handleAnimalFormChange("fecha_llegada_fundacion", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Tipo de fecha de nacimiento</span>
                <select
                  value={animalForm.tipo_fecha_nacimiento}
                  onChange={(event) =>
                    handleAnimalFormChange("tipo_fecha_nacimiento", event.target.value)
                  }
                  required
                >
                  {ANIMAL_BIRTH_DATE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Fecha de nacimiento</span>
                <input
                  type="date"
                  value={animalForm.fecha_nacimiento}
                  onChange={(event) => handleAnimalFormChange("fecha_nacimiento", event.target.value)}
                  disabled={!isBirthDateEditable}
                  required={isBirthDateEditable}
                />
              </label>

              {animalModalMode === "edit" ? (
                <>
                  <label>
                    <span>Fallecido</span>
                    <select
                      value={String(animalForm.fallecido)}
                      onChange={(event) =>
                        handleAnimalFormChange("fallecido", event.target.value === "true")
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Si</option>
                    </select>
                  </label>
                  <label>
                    <span>Fecha de fallecimiento</span>
                    <input
                      type="date"
                      value={animalForm.fecha_fallecimiento}
                      onChange={(event) =>
                        handleAnimalFormChange("fecha_fallecimiento", event.target.value)
                      }
                      disabled={!animalForm.fallecido}
                      required={animalForm.fallecido}
                    />
                  </label>
                </>
              ) : null}

              {regionsError ? <p className="error-text full">{regionsError}</p> : null}
              {animalModalError ? <p className="error-text full">{animalModalError}</p> : null}

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeAnimalModal}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !canSubmitForm}
                >
                  {isSubmitting
                    ? "Guardando..."
                    : animalModalMode === "create"
                      ? "Crear animal"
                      : "Actualizar animal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
