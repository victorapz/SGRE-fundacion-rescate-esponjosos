import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Power, PowerOff } from "lucide-react";
import FilterSummaryBar from "../components/FilterSummaryBar";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import PaginationControls from "../components/PaginationControls";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import {
  createArea,
  getAreas,
  toggleAreaActive,
  updateArea,
} from "../services/area.service";
import {
  createLocation,
  deactivateLocation,
  getLocations,
  updateLocation,
} from "../services/location.service";
import {
  buildClinicVeterinarianOptions,
  buildVeterinarianClinicOptions,
  buildVeterinarianPayload,
  emptyVeterinarianForm,
  formatVeterinarianClinics,
} from "./settings.page.helpers.js";
import {
  createComuna,
  getComunas,
  toggleComunaActive,
  updateComuna,
} from "../services/comuna.service";
import {
  createRegion,
  getRegions,
  toggleRegionActive,
  updateRegion,
} from "../services/region.service";
import {
  createVetClinic,
  deleteVetClinic,
  getVetClinics,
  updateVetClinic,
} from "../services/vet_clinic.service";
import {
  createVeterinarian,
  deleteVeterinarian,
  getVeterinarians,
  updateVeterinarian,
} from "../services/veterinarian.service";
import "../styles/home.page.css";
import "../styles/foster-home.page.css";
import "../styles/settings.page.css";
import { paginateCollection } from "../utils/pagination";

const LOCATION_TYPES = [
  "BODEGA",
  "PERSONA",
  "HOGAR_TEMPORAL",
  "CLINICA",
  "PROVEEDOR",
  "OTRA",
];

const TAB_IDS = {
  REGIONS: "regions",
  COMMUNES: "communes",
  AREAS: "areas",
  LOCATIONS: "locations",
  CLINICS: "clinics",
  VETERINARIANS: "veterinarians",
};

const DEFAULT_PAGE_SIZE = 10;

function emptyRegionForm() {
  return {
    nombre: "",
    codigo: "",
    orden: "",
    activo: true,
  };
}

function emptyCommuneForm() {
  return {
    nombre: "",
    codigo: "",
    regionId: "",
    activo: true,
  };
}

function emptyAreaForm() {
  return {
    nombre: "",
    clave: "",
    descripcion: "",
    activo: true,
  };
}

function emptyLocationForm() {
  return {
    tipo: "BODEGA",
    nombre: "",
    direccion: "",
    regionId: "",
    comunaId: "",
    activo: true,
    observaciones: "",
  };
}

function emptyClinicForm() {
  return {
    nombre: "",
    direccion: "",
    regionId: "",
    comunaId: "",
    activo: true,
    observaciones: "",
    veterinarianIds: [],
  };
}

function buildLocationPayload(form) {
  return {
    tipo: form.tipo,
    nombre_ubicacion: form.nombre.trim(),
    direccion: form.direccion.trim(),
    region_id: Number(form.regionId),
    comuna_id: Number(form.comunaId),
    activo: Boolean(form.activo),
    observaciones: form.observaciones.trim() || null,
  };
}

function buildRegionPayload(form) {
  return {
    nombre: form.nombre.trim(),
    clave: form.codigo.trim(),
    orden: form.orden === "" ? 0 : Number(form.orden),
    activo: Boolean(form.activo),
  };
}

function buildCommunePayload(form) {
  return {
    nombre: form.nombre.trim(),
    codigo: form.codigo.trim() || null,
    region_id: Number(form.regionId),
    activo: Boolean(form.activo),
  };
}

function buildAreaPayload(form) {
  return {
    nombre: form.nombre.trim(),
    clave: form.clave.trim(),
    descripcion: form.descripcion.trim(),
    activo: Boolean(form.activo),
  };
}

function buildClinicPayload(form) {
  return {
    nombre: form.nombre.trim(),
    activo: Boolean(form.activo),
    location: {
      direccion: form.direccion.trim(),
      region_id: Number(form.regionId),
      comuna_id: Number(form.comunaId),
      observaciones: form.observaciones.trim() || null,
    },
    veterinarian_ids: Array.from(new Set(form.veterinarianIds.map((id) => Number(id)))),
  };
}

function formatLocationLine(location) {
  if (!location) return "Sin ubicación";

  return [
    location.region?.nombre,
    location.comuna?.nombre,
    location.direccion,
  ]
    .filter(Boolean)
    .join(" · ") || "Sin ubicación";
}

function formatStatusLabel(isActive) {
  return isActive ? "Activo" : "Inactivo";
}

function buildErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function mergeCatalogItem(items, currentItem) {
  if (!currentItem?.id) {
    return items;
  }

  if (items.some((item) => String(item.id) === String(currentItem.id))) {
    return items;
  }

  return [currentItem, ...items];
}

function mapInactiveLabel(item, fallback = "Registro actual") {
  if (!item) return fallback;
  return item.activo ? item.nombre : `${item.nombre} (inactiva)`;
}

function validateLocationForm(form) {
  if (!form.nombre.trim()) return "Debes ingresar un nombre para la ubicación.";
  if (!form.direccion.trim()) return "Debes ingresar una dirección.";
  if (!form.regionId) return "Debes seleccionar una region.";
  if (!form.comunaId) return "Debes seleccionar una comuna.";
  return "";
}

function validateRegionForm(form) {
  if (!form.nombre.trim()) return "Debes ingresar el nombre de la región.";
  if (!form.codigo.trim()) return "Debes ingresar un código para la región.";
  if (form.orden !== "" && Number.isNaN(Number(form.orden))) {
    return "El orden debe ser numérico.";
  }
  return "";
}

function validateCommuneForm(form) {
  if (!form.nombre.trim()) return "Debes ingresar el nombre de la comuna.";
  if (!form.regionId) return "Debes seleccionar una región.";
  return "";
}

function validateAreaForm(form) {
  if (!form.nombre.trim()) return "Debes ingresar el nombre del área.";
  if (!form.clave.trim()) return "Debes ingresar una clave para el área.";
  if (!/^[A-Za-z0-9_-]+$/.test(form.clave.trim())) {
    return "La clave sólo puede contener letras, números, guiones y guiones bajos.";
  }
  return "";
}

function validateClinicForm(form) {
  if (!form.nombre.trim()) return "Debes ingresar el nombre de la clínica.";
  if (!form.direccion.trim()) return "Debes ingresar una dirección.";
  if (!form.regionId) return "Debes seleccionar una region.";
  if (!form.comunaId) return "Debes seleccionar una comuna.";
  return "";
}

function validateVeterinarianForm(form) {
  if (!form.nombre.trim()) return "Debes ingresar el nombre.";
  if (!form.apellido.trim()) return "Debes ingresar el apellido.";
  if (!form.email.trim()) return "Debes ingresar el email.";
  if (!form.telefono.trim()) return "Debes ingresar el teléfono.";
  return "";
}

function SettingsModal({
  isOpen,
  title,
  submitLabel,
  error,
  isSaving,
  onClose,
  onSubmit,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="event-modal settings-modal">
        <div className="event-modal-header">
          <h3>{title}</h3>
          <ModalCloseButton onClick={onClose} />
        </div>

        <form onSubmit={onSubmit} className="settings-modal-body">
          {error ? <p className="error-text">{error}</p> : null}
          {children}
          <div className="event-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettingsStatusBadge({ active }) {
  return (
    <span
      className={`settings-status-badge ${
        active ? "settings-status-active" : "settings-status-inactive"
      }`}
    >
      {formatStatusLabel(active)}
    </span>
  );
}

export default function SettingsPage() {
  const { hasPermission } = usePermissions();

  const canReadRegions = hasPermission(PERMISSIONS.CONFIGURATION.REGION_READ);
  const canCreateRegions = hasPermission(PERMISSIONS.CONFIGURATION.REGION_CREATE);
  const canUpdateRegions = hasPermission(PERMISSIONS.CONFIGURATION.REGION_UPDATE);
  const canToggleRegions = hasPermission(PERMISSIONS.CONFIGURATION.REGION_DEACTIVATE);

  const canReadCommunes = hasPermission(PERMISSIONS.CONFIGURATION.COMMUNE_READ);
  const canCreateCommunes = hasPermission(PERMISSIONS.CONFIGURATION.COMMUNE_CREATE);
  const canUpdateCommunes = hasPermission(PERMISSIONS.CONFIGURATION.COMMUNE_UPDATE);
  const canToggleCommunes = hasPermission(PERMISSIONS.CONFIGURATION.COMMUNE_DEACTIVATE);

  const canReadAreas = hasPermission(PERMISSIONS.CONFIGURATION.AREA_READ);
  const canCreateAreas = hasPermission(PERMISSIONS.CONFIGURATION.AREA_CREATE);
  const canUpdateAreas = hasPermission(PERMISSIONS.CONFIGURATION.AREA_UPDATE);
  const canToggleAreas = hasPermission(PERMISSIONS.CONFIGURATION.AREA_DEACTIVATE);

  const canReadLocations = hasPermission(PERMISSIONS.INVENTORY.LOCATION_READ);
  const canCreateLocations = hasPermission(PERMISSIONS.INVENTORY.LOCATION_CREATE);
  const canUpdateLocations = hasPermission(PERMISSIONS.INVENTORY.LOCATION_UPDATE);
  const canDeleteLocations = hasPermission(PERMISSIONS.INVENTORY.LOCATION_DELETE);

  const canReadClinics = hasPermission(PERMISSIONS.ANIMALS.VET_CLINIC_READ);
  const canCreateClinics = hasPermission(PERMISSIONS.ANIMALS.VET_CLINIC_CREATE);
  const canUpdateClinics = hasPermission(PERMISSIONS.ANIMALS.VET_CLINIC_UPDATE);
  const canDeleteClinics = hasPermission(PERMISSIONS.ANIMALS.VET_CLINIC_DELETE);

  const canReadVeterinarians = hasPermission(PERMISSIONS.ANIMALS.VETERINARIAN_READ);
  const canCreateVeterinarians = hasPermission(PERMISSIONS.ANIMALS.VETERINARIAN_CREATE);
  const canUpdateVeterinarians = hasPermission(PERMISSIONS.ANIMALS.VETERINARIAN_UPDATE);
  const canDeleteVeterinarians = hasPermission(PERMISSIONS.ANIMALS.VETERINARIAN_DELETE);

  const [regions, setRegions] = useState([]);
  const [communesCatalog, setCommunesCatalog] = useState([]);
  const [comunasByRegion, setComunasByRegion] = useState({});
  const [loadingComunaRegions, setLoadingComunaRegions] = useState({});

  const [areas, setAreas] = useState([]);
  const [locations, setLocations] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [veterinarians, setVeterinarians] = useState([]);

  const [loading, setLoading] = useState({
    regions: false,
    communes: false,
    areas: false,
    locations: false,
    clinics: false,
    veterinarians: false,
  });

  const [errors, setErrors] = useState({
    shared: "",
    regions: "",
    communes: "",
    areas: "",
    locations: "",
    clinics: "",
    veterinarians: "",
  });

  const [activeTab, setActiveTab] = useState(TAB_IDS.REGIONS);

  const [regionFilters, setRegionFilters] = useState({
    search: "",
    status: "",
  });
  const [communeFilters, setCommuneFilters] = useState({
    search: "",
    status: "",
    regionId: "",
  });

  const [areaFilters, setAreaFilters] = useState({
    search: "",
    status: "",
  });

  const [locationFilters, setLocationFilters] = useState({
    search: "",
    status: "",
    regionId: "",
    tipo: "",
  });
  const [clinicFilters, setClinicFilters] = useState({
    search: "",
    status: "",
    regionId: "",
  });
  const [veterinarianFilters, setVeterinarianFilters] = useState({
    search: "",
    status: "",
    clinicId: "",
  });
  const [tablePagination, setTablePagination] = useState({
    regions: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    communes: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    areas: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    locations: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    clinics: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    veterinarians: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
  });

  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [editingRegionId, setEditingRegionId] = useState(null);
  const [regionForm, setRegionForm] = useState(emptyRegionForm());
  const [regionFormError, setRegionFormError] = useState("");
  const [regionSaving, setRegionSaving] = useState(false);

  const [communeModalOpen, setCommuneModalOpen] = useState(false);
  const [editingCommuneId, setEditingCommuneId] = useState(null);
  const [communeForm, setCommuneForm] = useState(emptyCommuneForm());
  const [communeFormError, setCommuneFormError] = useState("");
  const [communeSaving, setCommuneSaving] = useState(false);

  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [areaForm, setAreaForm] = useState(emptyAreaForm());
  const [areaFormError, setAreaFormError] = useState("");
  const [areaSaving, setAreaSaving] = useState(false);

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [locationForm, setLocationForm] = useState(emptyLocationForm());
  const [locationFormError, setLocationFormError] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);

  const [clinicModalOpen, setClinicModalOpen] = useState(false);
  const [editingClinicId, setEditingClinicId] = useState(null);
  const [clinicForm, setClinicForm] = useState(emptyClinicForm());
  const [clinicFormError, setClinicFormError] = useState("");
  const [clinicSaving, setClinicSaving] = useState(false);

  const [veterinarianModalOpen, setVeterinarianModalOpen] = useState(false);
  const [editingVeterinarianId, setEditingVeterinarianId] = useState(null);
  const [veterinarianForm, setVeterinarianForm] = useState(emptyVeterinarianForm());
  const [veterinarianFormError, setVeterinarianFormError] = useState("");
  const [veterinarianSaving, setVeterinarianSaving] = useState(false);

  const visibleTabs = useMemo(
    () =>
      [
        { id: TAB_IDS.REGIONS, label: "Regiones", visible: canReadRegions },
        { id: TAB_IDS.COMMUNES, label: "Comunas", visible: canReadCommunes },
        { id: TAB_IDS.AREAS, label: "Áreas", visible: canReadAreas },
        { id: TAB_IDS.LOCATIONS, label: "Ubicaciones", visible: canReadLocations },
        { id: TAB_IDS.CLINICS, label: "Clínicas", visible: canReadClinics },
        { id: TAB_IDS.VETERINARIANS, label: "Veterinarios", visible: canReadVeterinarians },
      ].filter((tab) => tab.visible),
    [
      canReadRegions,
      canReadCommunes,
      canReadAreas,
      canReadLocations,
      canReadClinics,
      canReadVeterinarians,
    ],
  );

  useEffect(() => {
    if (!visibleTabs.length) return;

    const currentTabExists = visibleTabs.some((tab) => tab.id === activeTab);
    if (!currentTabExists) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  const loadComunasForRegion = useCallback(
    async (regionId) => {
      if (!regionId) return [];

      if (comunasByRegion[regionId]) {
        return comunasByRegion[regionId];
      }

      setLoadingComunaRegions((current) => ({ ...current, [regionId]: true }));

      try {
        const items = await getComunas({ region_id: regionId, active: true });
        setComunasByRegion((current) => ({ ...current, [regionId]: items }));
        return items;
      } finally {
        setLoadingComunaRegions((current) => ({ ...current, [regionId]: false }));
      }
    },
    [comunasByRegion],
  );

  const loadRegionsData = useCallback(async () => {
    try {
      setLoading((current) => ({ ...current, regions: true }));
      setRegions(await getRegions({ includeInactive: true }));
      setErrors((current) => ({ ...current, shared: "", regions: "" }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        shared: buildErrorMessage(error, "No se pudieron cargar las regiones."),
        regions: buildErrorMessage(error, "No se pudieron cargar las regiones."),
      }));
    } finally {
      setLoading((current) => ({ ...current, regions: false }));
    }
  }, []);

  const loadCommunesCatalogData = useCallback(async () => {
    if (!canReadCommunes) return;

    setLoading((current) => ({ ...current, communes: true }));
    try {
      setCommunesCatalog(await getComunas({ includeInactive: true }));
      setErrors((current) => ({ ...current, communes: "" }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        communes: buildErrorMessage(error, "No se pudieron cargar las comunas."),
      }));
    } finally {
      setLoading((current) => ({ ...current, communes: false }));
    }
  }, [canReadCommunes]);

  const loadAreasData = useCallback(async () => {
    if (!canReadAreas) return;

    setLoading((current) => ({ ...current, areas: true }));

    try {
      setAreas(await getAreas({ includeInactive: true }));
      setErrors((current) => ({ ...current, areas: "" }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        areas: buildErrorMessage(error, "No se pudieron cargar las áreas."),
      }));
    } finally {
      setLoading((current) => ({ ...current, areas: false }));
    }
  }, [canReadAreas]);

  const loadLocationsData = useCallback(async () => {
    if (!canReadLocations) return;

    setLoading((current) => ({ ...current, locations: true }));

    try {
      setLocations(await getLocations());
      setErrors((current) => ({ ...current, locations: "" }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        locations: buildErrorMessage(error, "No se pudieron cargar las ubicaciones."),
      }));
    } finally {
      setLoading((current) => ({ ...current, locations: false }));
    }
  }, [canReadLocations]);

  const loadClinicsData = useCallback(async () => {
    if (!canReadClinics) return;

    setLoading((current) => ({ ...current, clinics: true }));

    try {
      setClinics(await getVetClinics());
      setErrors((current) => ({ ...current, clinics: "" }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        clinics: buildErrorMessage(error, "No se pudieron cargar las clínicas."),
      }));
    } finally {
      setLoading((current) => ({ ...current, clinics: false }));
    }
  }, [canReadClinics]);

  const loadVeterinariansData = useCallback(async () => {
    if (!canReadVeterinarians) return;

    setLoading((current) => ({ ...current, veterinarians: true }));

    try {
      setVeterinarians(await getVeterinarians());
      setErrors((current) => ({ ...current, veterinarians: "" }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        veterinarians: buildErrorMessage(error, "No se pudieron cargar los veterinarios."),
      }));
    } finally {
      setLoading((current) => ({ ...current, veterinarians: false }));
    }
  }, [canReadVeterinarians]);

  useEffect(() => {
    if (!visibleTabs.length) return;

    loadRegionsData();
    loadCommunesCatalogData();
    loadAreasData();
    loadLocationsData();
    loadClinicsData();
    loadVeterinariansData();
  }, [
    visibleTabs.length,
    loadRegionsData,
    loadCommunesCatalogData,
    loadAreasData,
    loadLocationsData,
    loadClinicsData,
    loadVeterinariansData,
  ]);

  const clinicOptions = useMemo(
    () => clinics.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [clinics],
  );

  const activeRegions = useMemo(
    () => regions.filter((item) => item.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es")),
    [regions],
  );

  const filteredRegions = useMemo(() => {
    const searchTerm = regionFilters.search.trim().toLowerCase();

    return regions.filter((item) => {
      const matchesSearch =
        !searchTerm
        || [item.nombre, item.codigo]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesStatus =
        !regionFilters.status
        || (regionFilters.status === "ACTIVO" && item.activo)
        || (regionFilters.status === "INACTIVO" && !item.activo);

      return matchesSearch && matchesStatus;
    });
  }, [regionFilters, regions]);

  const filteredCommunes = useMemo(() => {
    const searchTerm = communeFilters.search.trim().toLowerCase();

    return communesCatalog.filter((item) => {
      const matchesSearch =
        !searchTerm
        || [item.nombre, item.codigo, item.region?.nombre]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesStatus =
        !communeFilters.status
        || (communeFilters.status === "ACTIVO" && item.activo)
        || (communeFilters.status === "INACTIVO" && !item.activo);

      const matchesRegion =
        !communeFilters.regionId
        || String(item.region?.id || "") === String(communeFilters.regionId);

      return matchesSearch && matchesStatus && matchesRegion;
    });
  }, [communeFilters, communesCatalog]);

  const filteredAreas = useMemo(() => {
    const searchTerm = areaFilters.search.trim().toLowerCase();

    return areas.filter((item) => {
      const matchesSearch =
        !searchTerm
        || [item.nombre, item.clave, item.descripcion]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesStatus =
        !areaFilters.status
        || (areaFilters.status === "ACTIVO" && item.activo)
        || (areaFilters.status === "INACTIVO" && !item.activo);

      return matchesSearch && matchesStatus;
    });
  }, [areaFilters, areas]);

  const clinicVeterinarianOptions = useMemo(
    () => buildClinicVeterinarianOptions(veterinarians, clinicForm.veterinarianIds),
    [clinicForm.veterinarianIds, veterinarians],
  );

  const veterinarianClinicOptions = useMemo(
    () => buildVeterinarianClinicOptions(clinics, veterinarianForm.clinicIds),
    [clinics, veterinarianForm.clinicIds],
  );

  const filteredLocations = useMemo(() => {
    const searchTerm = locationFilters.search.trim().toLowerCase();

    return locations.filter((item) => {
      const matchesSearch =
        !searchTerm
        || [
          item.nombre,
          item.tipo,
          item.direccion,
          item.region?.nombre,
          item.comuna?.nombre,
          item.observaciones,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesStatus =
        !locationFilters.status
        || (locationFilters.status === "ACTIVO" && item.activo)
        || (locationFilters.status === "INACTIVO" && !item.activo);

      const matchesRegion =
        !locationFilters.regionId || String(item.region?.id || "") === String(locationFilters.regionId);

      const matchesType = !locationFilters.tipo || item.tipo === locationFilters.tipo;

      return matchesSearch && matchesStatus && matchesRegion && matchesType;
    });
  }, [locationFilters, locations]);

  const filteredClinics = useMemo(() => {
    const searchTerm = clinicFilters.search.trim().toLowerCase();

    return clinics.filter((item) => {
      const matchesSearch =
        !searchTerm
        || [
          item.nombre,
          item.direccion,
          item.region?.nombre,
          item.comuna?.nombre,
          ...item.veterinarians.map((veterinarian) => veterinarian.nombreCompleto),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesStatus =
        !clinicFilters.status
        || (clinicFilters.status === "ACTIVO" && item.activo)
        || (clinicFilters.status === "INACTIVO" && !item.activo);

      const matchesRegion =
        !clinicFilters.regionId || String(item.region?.id || "") === String(clinicFilters.regionId);

      return matchesSearch && matchesStatus && matchesRegion;
    });
  }, [clinicFilters, clinics]);

  const filteredVeterinarians = useMemo(() => {
    const searchTerm = veterinarianFilters.search.trim().toLowerCase();

    return veterinarians.filter((item) => {
      const matchesSearch =
        !searchTerm
        || [
          item.nombre,
          item.apellido,
          item.nombreCompleto,
          item.email,
          item.telefono,
          item.clinicNombre,
          formatVeterinarianClinics(item),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesStatus =
        !veterinarianFilters.status
        || (veterinarianFilters.status === "ACTIVO" && item.activo)
        || (veterinarianFilters.status === "INACTIVO" && !item.activo);

      const matchesClinic =
        !veterinarianFilters.clinicId
        || item.clinicIds?.some(
          (clinicId) => String(clinicId) === String(veterinarianFilters.clinicId),
        );

      return matchesSearch && matchesStatus && matchesClinic;
    });
  }, [veterinarianFilters, veterinarians]);

  const paginatedLocations = useMemo(
    () =>
      paginateCollection(
        filteredLocations,
        tablePagination.locations.page,
        tablePagination.locations.pageSize,
      ),
    [filteredLocations, tablePagination.locations.page, tablePagination.locations.pageSize],
  );

  const paginatedRegions = useMemo(
    () =>
      paginateCollection(
        filteredRegions,
        tablePagination.regions.page,
        tablePagination.regions.pageSize,
      ),
    [filteredRegions, tablePagination.regions.page, tablePagination.regions.pageSize],
  );

  const paginatedCommunes = useMemo(
    () =>
      paginateCollection(
        filteredCommunes,
        tablePagination.communes.page,
        tablePagination.communes.pageSize,
      ),
    [filteredCommunes, tablePagination.communes.page, tablePagination.communes.pageSize],
  );

  const paginatedAreas = useMemo(
    () =>
      paginateCollection(
        filteredAreas,
        tablePagination.areas.page,
        tablePagination.areas.pageSize,
      ),
    [filteredAreas, tablePagination.areas.page, tablePagination.areas.pageSize],
  );

  const paginatedClinics = useMemo(
    () =>
      paginateCollection(
        filteredClinics,
        tablePagination.clinics.page,
        tablePagination.clinics.pageSize,
      ),
    [filteredClinics, tablePagination.clinics.page, tablePagination.clinics.pageSize],
  );

  const paginatedVeterinarians = useMemo(
    () =>
      paginateCollection(
        filteredVeterinarians,
        tablePagination.veterinarians.page,
        tablePagination.veterinarians.pageSize,
      ),
    [
      filteredVeterinarians,
      tablePagination.veterinarians.page,
      tablePagination.veterinarians.pageSize,
    ],
  );

  const locationStats = useMemo(() => {
    const activeCount = locations.filter((item) => item.activo).length;

    return {
      total: locations.length,
      activeCount,
      inactiveCount: Math.max(locations.length - activeCount, 0),
      typeCount: new Set(locations.map((item) => item.tipo).filter(Boolean)).size,
    };
  }, [locations]);

  const regionStats = useMemo(() => {
    const activeCount = regions.filter((item) => item.activo).length;

    return {
      total: regions.length,
      activeCount,
      inactiveCount: Math.max(regions.length - activeCount, 0),
    };
  }, [regions]);

  const communeStats = useMemo(() => {
    const activeCount = communesCatalog.filter((item) => item.activo).length;

    return {
      total: communesCatalog.length,
      activeCount,
      inactiveCount: Math.max(communesCatalog.length - activeCount, 0),
    };
  }, [communesCatalog]);

  const areaStats = useMemo(() => {
    const activeCount = areas.filter((item) => item.activo).length;

    return {
      total: areas.length,
      activeCount,
      inactiveCount: Math.max(areas.length - activeCount, 0),
    };
  }, [areas]);

  const clinicStats = useMemo(() => {
    const activeCount = clinics.filter((item) => item.activo).length;

    return {
      total: clinics.length,
      activeCount,
      inactiveCount: Math.max(clinics.length - activeCount, 0),
      assignedVeterinarians: clinics.reduce(
        (sum, clinic) => sum + clinic.veterinarians.length,
        0,
      ),
    };
  }, [clinics]);

  const veterinarianStats = useMemo(() => {
    const activeCount = veterinarians.filter((item) => item.activo).length;

    return {
      total: veterinarians.length,
      activeCount,
      inactiveCount: Math.max(veterinarians.length - activeCount, 0),
      clinicsCovered: new Set(
        veterinarians.flatMap((item) => item.clinicIds || []).filter(Boolean),
      ).size,
    };
  }, [veterinarians]);

  const locationFilterStats = useMemo(
    () => [
      `Mostrando ${filteredLocations.length} de ${locations.length}`,
      `Activas: ${filteredLocations.filter((item) => item.activo).length}`,
      `Inactivas: ${filteredLocations.filter((item) => !item.activo).length}`,
    ],
    [filteredLocations, locations.length],
  );

  const regionFilterStats = useMemo(
    () => [
      `Mostrando ${filteredRegions.length} de ${regions.length}`,
      `Activas: ${filteredRegions.filter((item) => item.activo).length}`,
      `Inactivas: ${filteredRegions.filter((item) => !item.activo).length}`,
    ],
    [filteredRegions, regions.length],
  );

  const communeFilterStats = useMemo(
    () => [
      `Mostrando ${filteredCommunes.length} de ${communesCatalog.length}`,
      `Activas: ${filteredCommunes.filter((item) => item.activo).length}`,
      `Regiones visibles: ${new Set(filteredCommunes.map((item) => item.region?.id).filter(Boolean)).size}`,
    ],
    [communesCatalog.length, filteredCommunes],
  );

  const areaFilterStats = useMemo(
    () => [
      `Mostrando ${filteredAreas.length} de ${areas.length}`,
      `Activas: ${filteredAreas.filter((item) => item.activo).length}`,
      `Inactivas: ${filteredAreas.filter((item) => !item.activo).length}`,
    ],
    [areas.length, filteredAreas],
  );

  const clinicFilterStats = useMemo(
    () => [
      `Mostrando ${filteredClinics.length} de ${clinics.length}`,
      `Activas: ${filteredClinics.filter((item) => item.activo).length}`,
      `Veterinarios: ${filteredClinics.reduce(
        (sum, clinic) => sum + clinic.veterinarians.length,
        0,
      )}`,
    ],
    [clinics.length, filteredClinics],
  );

  const veterinarianFilterStats = useMemo(
    () => [
      `Mostrando ${filteredVeterinarians.length} de ${veterinarians.length}`,
      `Activos: ${filteredVeterinarians.filter((item) => item.activo).length}`,
      `Clinicas cubiertas: ${new Set(
        filteredVeterinarians.flatMap((item) => item.clinicIds || []).filter(Boolean),
      ).size}`,
    ],
    [filteredVeterinarians, veterinarians.length],
  );

  useEffect(() => {
    setTablePagination((current) => ({
      ...current,
      regions: { ...current.regions, page: 1 },
    }));
  }, [regionFilters]);

  useEffect(() => {
    setTablePagination((current) => ({
      ...current,
      communes: { ...current.communes, page: 1 },
    }));
  }, [communeFilters]);

  useEffect(() => {
    setTablePagination((current) => ({
      ...current,
      areas: { ...current.areas, page: 1 },
    }));
  }, [areaFilters]);

  useEffect(() => {
    setTablePagination((current) => ({
      ...current,
      locations: { ...current.locations, page: 1 },
    }));
  }, [locationFilters]);

  useEffect(() => {
    setTablePagination((current) => ({
      ...current,
      clinics: { ...current.clinics, page: 1 },
    }));
  }, [clinicFilters]);

  useEffect(() => {
    setTablePagination((current) => ({
      ...current,
      veterinarians: { ...current.veterinarians, page: 1 },
    }));
  }, [veterinarianFilters]);

  const locationFormComunas = locationForm.regionId
    ? comunasByRegion[locationForm.regionId] || []
    : [];
  const clinicFormComunas = clinicForm.regionId ? comunasByRegion[clinicForm.regionId] || [] : [];

  const locationRegionOptions = useMemo(
    () =>
      mergeCatalogItem(
        activeRegions,
        regions.find((item) => String(item.id) === String(locationForm.regionId)),
      ),
    [activeRegions, locationForm.regionId, regions],
  );

  const clinicRegionOptions = useMemo(
    () =>
      mergeCatalogItem(
        activeRegions,
        regions.find((item) => String(item.id) === String(clinicForm.regionId)),
      ),
    [activeRegions, clinicForm.regionId, regions],
  );

  const communeRegionOptions = useMemo(
    () =>
      mergeCatalogItem(
        activeRegions,
        regions.find((item) => String(item.id) === String(communeForm.regionId)),
      ),
    [activeRegions, communeForm.regionId, regions],
  );

  const resetRegionFilters = () => {
    setRegionFilters({
      search: "",
      status: "",
    });
    setTablePagination((current) => ({
      ...current,
      regions: { ...current.regions, page: 1 },
    }));
  };

  const resetCommuneFilters = () => {
    setCommuneFilters({
      search: "",
      status: "",
      regionId: "",
    });
    setTablePagination((current) => ({
      ...current,
      communes: { ...current.communes, page: 1 },
    }));
  };

  const resetAreaFilters = () => {
    setAreaFilters({
      search: "",
      status: "",
    });
    setTablePagination((current) => ({
      ...current,
      areas: { ...current.areas, page: 1 },
    }));
  };

  const resetLocationFilters = () => {
    setLocationFilters({
      search: "",
      status: "",
      regionId: "",
      tipo: "",
    });
    setTablePagination((current) => ({
      ...current,
      locations: { ...current.locations, page: 1 },
    }));
  };

  const resetClinicFilters = () => {
    setClinicFilters({
      search: "",
      status: "",
      regionId: "",
    });
    setTablePagination((current) => ({
      ...current,
      clinics: { ...current.clinics, page: 1 },
    }));
  };

  const resetVeterinarianFilters = () => {
    setVeterinarianFilters({
      search: "",
      status: "",
      clinicId: "",
    });
    setTablePagination((current) => ({
      ...current,
      veterinarians: { ...current.veterinarians, page: 1 },
    }));
  };

  const isLoadingLocationComunas = Boolean(loadingComunaRegions[locationForm.regionId]);
  const isLoadingClinicComunas = Boolean(loadingComunaRegions[clinicForm.regionId]);

  const ensureComunaAvailableInCache = useCallback((regionId, comuna) => {
    if (!regionId || !comuna?.id) return;

    setComunasByRegion((current) => {
      const regionItems = current[regionId] || [];
      if (regionItems.some((item) => String(item.id) === String(comuna.id))) {
        return current;
      }

      return {
        ...current,
        [regionId]: [comuna, ...regionItems],
      };
    });
  }, []);

  const openCreateRegionModal = () => {
    setEditingRegionId(null);
    setRegionForm(emptyRegionForm());
    setRegionFormError("");
    setRegionModalOpen(true);
  };

  const openEditRegionModal = (item) => {
    setEditingRegionId(item.id);
    setRegionForm({
      nombre: item.nombre || "",
      codigo: item.codigo || item.clave || "",
      orden: item.orden ?? 0,
      activo: Boolean(item.activo),
    });
    setRegionFormError("");
    setRegionModalOpen(true);
  };

  const openCreateCommuneModal = () => {
    setEditingCommuneId(null);
    setCommuneForm(emptyCommuneForm());
    setCommuneFormError("");
    setCommuneModalOpen(true);
  };

  const openEditCommuneModal = (item) => {
    setEditingCommuneId(item.id);
    setCommuneForm({
      nombre: item.nombre || "",
      codigo: item.codigo || "",
      regionId: item.region?.id ? String(item.region.id) : "",
      activo: Boolean(item.activo),
    });
    setCommuneFormError("");
    setCommuneModalOpen(true);
  };

  const openCreateAreaModal = () => {
    setEditingAreaId(null);
    setAreaForm(emptyAreaForm());
    setAreaFormError("");
    setAreaModalOpen(true);
  };

  const openEditAreaModal = (item) => {
    setEditingAreaId(item.id);
    setAreaForm({
      nombre: item.nombre || "",
      clave: item.clave || "",
      descripcion: item.descripcion || "",
      activo: Boolean(item.activo),
    });
    setAreaFormError("");
    setAreaModalOpen(true);
  };

  const openCreateLocationModal = () => {
    setEditingLocationId(null);
    setLocationForm(emptyLocationForm());
    setLocationFormError("");
    setLocationModalOpen(true);
  };

  const openEditLocationModal = async (item) => {
    setEditingLocationId(item.id);
    setLocationForm({
      tipo: item.tipo || "BODEGA",
      nombre: item.nombre || "",
      direccion: item.direccion || "",
      regionId: item.region?.id ? String(item.region.id) : "",
      comunaId: item.comuna?.id ? String(item.comuna.id) : "",
      activo: Boolean(item.activo),
      observaciones: item.observaciones || "",
    });
    setLocationFormError("");
    setLocationModalOpen(true);

    if (item.region?.id) {
      try {
        await loadComunasForRegion(String(item.region.id));
        ensureComunaAvailableInCache(String(item.region.id), item.comuna);
      } catch (error) {
        setLocationFormError(
          buildErrorMessage(error, "No se pudieron cargar las comunas de la ubicación."),
        );
      }
    }
  };

  const openCreateClinicModal = () => {
    setEditingClinicId(null);
    setClinicForm(emptyClinicForm());
    setClinicFormError("");
    setClinicModalOpen(true);
  };

  const openEditClinicModal = async (item) => {
    setEditingClinicId(item.id);
    setClinicForm({
      nombre: item.nombre || "",
      direccion: item.direccion || "",
      regionId: item.region?.id ? String(item.region.id) : "",
      comunaId: item.comuna?.id ? String(item.comuna.id) : "",
      activo: Boolean(item.activo),
      observaciones: item.observaciones || "",
      veterinarianIds: item.veterinarians.map((veterinarian) => String(veterinarian.id)),
    });
    setClinicFormError("");
    setClinicModalOpen(true);

    if (item.region?.id) {
      try {
        await loadComunasForRegion(String(item.region.id));
        ensureComunaAvailableInCache(String(item.region.id), item.comuna);
      } catch (error) {
        setClinicFormError(
          buildErrorMessage(error, "No se pudieron cargar las comunas de la clínica."),
        );
      }
    }
  };

  const openCreateVeterinarianModal = () => {
    setEditingVeterinarianId(null);
    setVeterinarianForm(emptyVeterinarianForm());
    setVeterinarianFormError("");
    setVeterinarianModalOpen(true);
  };

  const openEditVeterinarianModal = (item) => {
    setEditingVeterinarianId(item.id);
    setVeterinarianForm({
      nombre: item.nombre || "",
      apellido: item.apellido || "",
      email: item.email || "",
      telefono: item.telefono || "",
      clinicIds: Array.isArray(item.clinicIds)
        ? item.clinicIds.map((clinicId) => String(clinicId))
        : [],
      activo: Boolean(item.activo),
    });
    setVeterinarianFormError("");
    setVeterinarianModalOpen(true);
  };

  const handleLocationRegionChange = async (regionId) => {
    setLocationForm((current) => ({ ...current, regionId, comunaId: "" }));
    setLocationFormError("");

    if (!regionId) return;

    try {
      await loadComunasForRegion(regionId);
    } catch (error) {
      setLocationFormError(buildErrorMessage(error, "No se pudieron cargar las comunas."));
    }
  };

  const handleClinicRegionChange = async (regionId) => {
    setClinicForm((current) => ({ ...current, regionId, comunaId: "" }));
    setClinicFormError("");

    if (!regionId) return;

    try {
      await loadComunasForRegion(regionId);
    } catch (error) {
      setClinicFormError(buildErrorMessage(error, "No se pudieron cargar las comunas."));
    }
  };

  const handleSubmitRegion = async (event) => {
    event.preventDefault();
    const validationError = validateRegionForm(regionForm);

    if (validationError) {
      setRegionFormError(validationError);
      return;
    }

    setRegionSaving(true);
    setRegionFormError("");

    try {
      const payload = buildRegionPayload(regionForm);

      if (editingRegionId) {
        await updateRegion(editingRegionId, payload);
      } else {
        await createRegion(payload);
      }

      await loadRegionsData();
      setRegionModalOpen(false);
      setRegionForm(emptyRegionForm());
      setEditingRegionId(null);
    } catch (error) {
      setRegionFormError(buildErrorMessage(error, "No se pudo guardar la región."));
    } finally {
      setRegionSaving(false);
    }
  };

  const handleSubmitCommune = async (event) => {
    event.preventDefault();
    const validationError = validateCommuneForm(communeForm);

    if (validationError) {
      setCommuneFormError(validationError);
      return;
    }

    setCommuneSaving(true);
    setCommuneFormError("");

    try {
      const payload = buildCommunePayload(communeForm);

      if (editingCommuneId) {
        await updateComuna(editingCommuneId, payload);
      } else {
        await createComuna(payload);
      }

      await Promise.all([loadCommunesCatalogData(), loadRegionsData()]);
      setComunasByRegion((current) => {
        if (!communeForm.regionId) return current;
        const next = { ...current };
        delete next[communeForm.regionId];
        return next;
      });
      setCommuneModalOpen(false);
      setCommuneForm(emptyCommuneForm());
      setEditingCommuneId(null);
    } catch (error) {
      setCommuneFormError(buildErrorMessage(error, "No se pudo guardar la comuna."));
    } finally {
      setCommuneSaving(false);
    }
  };

  const handleSubmitArea = async (event) => {
    event.preventDefault();
    const validationError = validateAreaForm(areaForm);

    if (validationError) {
      setAreaFormError(validationError);
      return;
    }

    setAreaSaving(true);
    setAreaFormError("");

    try {
      const payload = buildAreaPayload(areaForm);

      if (editingAreaId) {
        await updateArea(editingAreaId, payload);
      } else {
        await createArea(payload);
      }

      await loadAreasData();
      setAreaModalOpen(false);
      setAreaForm(emptyAreaForm());
      setEditingAreaId(null);
    } catch (error) {
      setAreaFormError(buildErrorMessage(error, "No se pudo guardar el área."));
    } finally {
      setAreaSaving(false);
    }
  };

  const handleSubmitLocation = async (event) => {
    event.preventDefault();
    const validationError = validateLocationForm(locationForm);

    if (validationError) {
      setLocationFormError(validationError);
      return;
    }

    setLocationSaving(true);
    setLocationFormError("");

    try {
      const payload = buildLocationPayload(locationForm);

      if (editingLocationId) {
        await updateLocation(editingLocationId, payload);
      } else {
        await createLocation(payload);
      }

      await loadLocationsData();
      setLocationModalOpen(false);
      setLocationForm(emptyLocationForm());
      setEditingLocationId(null);
    } catch (error) {
      setLocationFormError(
        buildErrorMessage(error, "No se pudo guardar la ubicación."),
      );
    } finally {
      setLocationSaving(false);
    }
  };

  const handleSubmitClinic = async (event) => {
    event.preventDefault();
    const validationError = validateClinicForm(clinicForm);

    if (validationError) {
      setClinicFormError(validationError);
      return;
    }

    setClinicSaving(true);
    setClinicFormError("");

    try {
      const payload = buildClinicPayload(clinicForm);

      if (editingClinicId) {
        await updateVetClinic(editingClinicId, payload);
      } else {
        await createVetClinic(payload);
      }

      await Promise.all([loadClinicsData(), loadVeterinariansData()]);
      setClinicModalOpen(false);
      setClinicForm(emptyClinicForm());
      setEditingClinicId(null);
    } catch (error) {
      setClinicFormError(buildErrorMessage(error, "No se pudo guardar la clínica."));
    } finally {
      setClinicSaving(false);
    }
  };

  const handleSubmitVeterinarian = async (event) => {
    event.preventDefault();
    const validationError = validateVeterinarianForm(veterinarianForm);

    if (validationError) {
      setVeterinarianFormError(validationError);
      return;
    }

    setVeterinarianSaving(true);
    setVeterinarianFormError("");

    try {
      const payload = buildVeterinarianPayload(veterinarianForm);

      if (editingVeterinarianId) {
        await updateVeterinarian(editingVeterinarianId, payload);
      } else {
        await createVeterinarian(payload);
      }

      await Promise.all([loadVeterinariansData(), loadClinicsData()]);
      setVeterinarianModalOpen(false);
      setVeterinarianForm(emptyVeterinarianForm());
      setEditingVeterinarianId(null);
    } catch (error) {
      setVeterinarianFormError(
        buildErrorMessage(error, "No se pudo guardar el veterinario."),
      );
    } finally {
      setVeterinarianSaving(false);
    }
  };

  const handleLocationToggle = async (item) => {
    const actionLabel = item.activo ? "desactivar" : "activar";
    const confirmed = window.confirm(
      `Deseas ${actionLabel} la ubicacion "${item.nombre}"?`,
    );

    if (!confirmed) return;

    try {
      if (item.activo) {
        await deactivateLocation(item.id);
      } else {
        await updateLocation(item.id, { activo: true });
      }
      await loadLocationsData();
    } catch (error) {
      setErrors((current) => ({
        ...current,
        locations: buildErrorMessage(error, `No se pudo ${actionLabel} la ubicación.`),
      }));
    }
  };

  const handleRegionToggle = async (item) => {
    const actionLabel = item.activo ? "desactivar" : "activar";
    const confirmed = window.confirm(`Deseas ${actionLabel} la región "${item.nombre}"?`);

    if (!confirmed) return;

    try {
      await toggleRegionActive(item.id);
      await Promise.all([loadRegionsData(), loadCommunesCatalogData()]);
      setComunasByRegion({});
    } catch (error) {
      setErrors((current) => ({
        ...current,
        regions: buildErrorMessage(error, `No se pudo ${actionLabel} la región.`),
      }));
    }
  };

  const handleCommuneToggle = async (item) => {
    const actionLabel = item.activo ? "desactivar" : "activar";
    const confirmed = window.confirm(`Deseas ${actionLabel} la comuna "${item.nombre}"?`);

    if (!confirmed) return;

    try {
      await toggleComunaActive(item.id);
      await loadCommunesCatalogData();
      setComunasByRegion({});
    } catch (error) {
      setErrors((current) => ({
        ...current,
        communes: buildErrorMessage(error, `No se pudo ${actionLabel} la comuna.`),
      }));
    }
  };

  const handleAreaToggle = async (item) => {
    const actionLabel = item.activo ? "desactivar" : "activar";
    const confirmed = window.confirm(`Deseas ${actionLabel} el área "${item.nombre}"?`);

    if (!confirmed) return;

    try {
      await toggleAreaActive(item.id);
      await loadAreasData();
    } catch (error) {
      setErrors((current) => ({
        ...current,
        areas: buildErrorMessage(error, `No se pudo ${actionLabel} el área.`),
      }));
    }
  };

  const handleClinicToggle = async (item) => {
    const actionLabel = item.activo ? "desactivar" : "activar";
    const confirmed = window.confirm(`Deseas ${actionLabel} la clinica "${item.nombre}"?`);

    if (!confirmed) return;

    try {
      if (item.activo) {
        await deleteVetClinic(item.id);
      } else {
        await updateVetClinic(item.id, { activo: true });
      }
      await Promise.all([loadClinicsData(), loadVeterinariansData()]);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        clinics: buildErrorMessage(error, `No se pudo ${actionLabel} la clínica.`),
      }));
    }
  };

  const handleVeterinarianToggle = async (item) => {
    const actionLabel = item.activo ? "desactivar" : "activar";
    const confirmed = window.confirm(
      `Deseas ${actionLabel} a ${item.nombreCompleto || item.nombre}?`,
    );

    if (!confirmed) return;

    try {
      if (item.activo) {
        await deleteVeterinarian(item.id);
      } else {
        await updateVeterinarian(item.id, { activo: true });
      }
      await Promise.all([loadVeterinariansData(), loadClinicsData()]);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        veterinarians: buildErrorMessage(error, `No se pudo ${actionLabel} el veterinario.`),
      }));
    }
  };

  if (!visibleTabs.length) {
    return (
      <section className="main-content home-content settings-page">
        <header className="main-header settings-header">
          <div className="settings-header-copy">
            <h1>Configuracion</h1>
            <p>Administra catálogos y entidades base del sistema.</p>
          </div>
        </header>

        <section className="settings-empty-state">
          No tienes permisos de lectura para las secciones disponibles de este módulo.
        </section>
      </section>
    );
  }

  return (
    <section className="main-content home-content settings-page">
      <header className="main-header settings-header">
        <div className="settings-header-copy">
          <h1>Configuracion</h1>
          <p>
            Administra ubicaciones, áreas internas, clínicas veterinarias y veterinarios usando
            catálogos compartidos del sistema.
          </p>
        </div>
      </header>

      <nav className="home-tabs settings-tabs" aria-label="Secciones de configuracion">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`home-tab-button ${
              activeTab === tab.id ? "home-tab-button-active" : ""
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {errors.shared ? <p className="error-text">{errors.shared}</p> : null}

      {activeTab === TAB_IDS.REGIONS ? (
        <>
          <section className="crud-card foster-filter-card">
            <div className="foster-card-header">
              <div className="foster-filter-card-copy">
                <h3>Filtros y resumen</h3>
                <p>Busca por nombre o código y filtra por estado activo.</p>
              </div>
            </div>

            <div className="settings-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={regionFilters.search}
                  onChange={(event) =>
                    setRegionFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre o código"
                />
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={regionFilters.status}
                  onChange={(event) =>
                    setRegionFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="ACTIVO">Activas</option>
                  <option value="INACTIVO">Inactivas</option>
                </select>
              </label>
            </div>
          </section>

          <div className="settings-summary">
            <span className="settings-summary-pill">Total: {regionStats.total}</span>
            <span className="settings-summary-pill">Activas: {regionStats.activeCount}</span>
            <span className="settings-summary-pill">Inactivas: {regionStats.inactiveCount}</span>
          </div>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Listado de regiones</h3>
              </div>
              {canCreateRegions ? (
                <button type="button" className="btn btn-primary" onClick={openCreateRegionModal}>
                  Crear región
                </button>
              ) : null}
            </div>

            <div className="settings-filter-grid settings-table-tools">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={regionFilters.search}
                  onChange={(event) =>
                    setRegionFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre o código"
                />
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={regionFilters.status}
                  onChange={(event) =>
                    setRegionFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="ACTIVO">Activas</option>
                  <option value="INACTIVO">Inactivas</option>
                </select>
              </label>
            </div>

            <FilterSummaryBar stats={regionFilterStats} onClear={resetRegionFilters} />

            {errors.regions ? <p className="error-text">{errors.regions}</p> : null}

            {loading.regions ? (
              <p className="settings-subtle">Cargando regiones...</p>
            ) : filteredRegions.length === 0 ? (
              <p className="settings-subtle">No se encontraron regiones con los filtros actuales.</p>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="crud-table settings-table">
                    <thead>
                      <tr>
                        <th>Región</th>
                        <th>Código</th>
                        <th>Orden</th>
                        <th>Estado</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRegions.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="settings-meta-stack">
                              <strong>{item.nombre}</strong>
                              <small>ID #{item.id}</small>
                            </div>
                          </td>
                          <td>{item.codigo || item.clave || "-"}</td>
                          <td>{item.orden}</td>
                          <td>
                            <SettingsStatusBadge active={item.activo} />
                          </td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              {canUpdateRegions ? (
                                <IconButton
                                  icon={Pencil}
                                  label={`Editar región ${item.nombre}`.trim()}
                                  variant="secondary"
                                  onClick={() => openEditRegionModal(item)}
                                />
                              ) : null}
                              {(item.activo ? canToggleRegions : canUpdateRegions || canToggleRegions) ? (
                                <IconButton
                                  icon={item.activo ? PowerOff : Power}
                                  label={`${item.activo ? "Desactivar" : "Activar"} región ${item.nombre}`.trim()}
                                  variant={item.activo ? "warning" : "success"}
                                  onClick={() => handleRegionToggle(item)}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={paginatedRegions.currentPage}
                  pageSize={paginatedRegions.pageSize}
                  totalItems={paginatedRegions.totalItems}
                  onPageChange={(page) =>
                    setTablePagination((current) => ({
                      ...current,
                      regions: { ...current.regions, page },
                    }))
                  }
                  onPageSizeChange={(pageSize) =>
                    setTablePagination((current) => ({
                      ...current,
                      regions: { page: 1, pageSize },
                    }))
                  }
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {activeTab === TAB_IDS.COMMUNES ? (
        <>
          <section className="crud-card foster-filter-card">
            <div className="foster-card-header">
              <div className="foster-filter-card-copy">
                <h3>Filtros y resumen</h3>
                <p>Busca por comuna, código o región y filtra por región y estado.</p>
              </div>
            </div>

            <div className="settings-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={communeFilters.search}
                  onChange={(event) =>
                    setCommuneFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Comuna, código o región"
                />
              </label>

              <label className="settings-filter-field">
                <span>Región</span>
                <select
                  value={communeFilters.regionId}
                  onChange={(event) =>
                    setCommuneFilters((current) => ({
                      ...current,
                      regionId: event.target.value,
                    }))
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

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={communeFilters.status}
                  onChange={(event) =>
                    setCommuneFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="ACTIVO">Activas</option>
                  <option value="INACTIVO">Inactivas</option>
                </select>
              </label>
            </div>
          </section>

          <div className="settings-summary">
            <span className="settings-summary-pill">Total: {communeStats.total}</span>
            <span className="settings-summary-pill">Activas: {communeStats.activeCount}</span>
            <span className="settings-summary-pill">Inactivas: {communeStats.inactiveCount}</span>
          </div>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Listado de comunas</h3>
              </div>
              {canCreateCommunes ? (
                <button type="button" className="btn btn-primary" onClick={openCreateCommuneModal}>
                  Crear comuna
                </button>
              ) : null}
            </div>

            <div className="settings-filter-grid settings-table-tools">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={communeFilters.search}
                  onChange={(event) =>
                    setCommuneFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Comuna, código o región"
                />
              </label>

              <label className="settings-filter-field">
                <span>Región</span>
                <select
                  value={communeFilters.regionId}
                  onChange={(event) =>
                    setCommuneFilters((current) => ({
                      ...current,
                      regionId: event.target.value,
                    }))
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

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={communeFilters.status}
                  onChange={(event) =>
                    setCommuneFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="ACTIVO">Activas</option>
                  <option value="INACTIVO">Inactivas</option>
                </select>
              </label>
            </div>

            <FilterSummaryBar stats={communeFilterStats} onClear={resetCommuneFilters} />

            {errors.communes ? <p className="error-text">{errors.communes}</p> : null}

            {loading.communes ? (
              <p className="settings-subtle">Cargando comunas...</p>
            ) : filteredCommunes.length === 0 ? (
              <p className="settings-subtle">No se encontraron comunas con los filtros actuales.</p>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="crud-table settings-table">
                    <thead>
                      <tr>
                        <th>Comuna</th>
                        <th>Región</th>
                        <th>Código</th>
                        <th>Estado</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCommunes.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="settings-meta-stack">
                              <strong>{item.nombre}</strong>
                              <small>ID #{item.id}</small>
                            </div>
                          </td>
                          <td>{item.region?.nombre || "Sin región"}</td>
                          <td>{item.codigo || "-"}</td>
                          <td>
                            <SettingsStatusBadge active={item.activo} />
                          </td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              {canUpdateCommunes ? (
                                <IconButton
                                  icon={Pencil}
                                  label={`Editar comuna ${item.nombre}`.trim()}
                                  variant="secondary"
                                  onClick={() => openEditCommuneModal(item)}
                                />
                              ) : null}
                              {(item.activo ? canToggleCommunes : canUpdateCommunes || canToggleCommunes) ? (
                                <IconButton
                                  icon={item.activo ? PowerOff : Power}
                                  label={`${item.activo ? "Desactivar" : "Activar"} comuna ${item.nombre}`.trim()}
                                  variant={item.activo ? "warning" : "success"}
                                  onClick={() => handleCommuneToggle(item)}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={paginatedCommunes.currentPage}
                  pageSize={paginatedCommunes.pageSize}
                  totalItems={paginatedCommunes.totalItems}
                  onPageChange={(page) =>
                    setTablePagination((current) => ({
                      ...current,
                      communes: { ...current.communes, page },
                    }))
                  }
                  onPageSizeChange={(pageSize) =>
                    setTablePagination((current) => ({
                      ...current,
                      communes: { page: 1, pageSize },
                    }))
                  }
                />
              </>
            )}
          </section>
        </>
      ) : null}


      {activeTab === TAB_IDS.AREAS ? (
        <>
          <section className="crud-card foster-filter-card">
            <div className="foster-card-header">
              <div className="foster-filter-card-copy">
                <h3>Filtros y resumen</h3>
                <p>Busca por nombre, clave o descripción y filtra por estado.</p>
              </div>
            </div>

            <div className="settings-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={areaFilters.search}
                  onChange={(event) =>
                    setAreaFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre, clave o descripción"
                />
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={areaFilters.status}
                  onChange={(event) =>
                    setAreaFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="ACTIVO">Activas</option>
                  <option value="INACTIVO">Inactivas</option>
                </select>
              </label>
            </div>
          </section>

          <div className="settings-summary">
            <span className="settings-summary-pill">Total: {areaStats.total}</span>
            <span className="settings-summary-pill">Activas: {areaStats.activeCount}</span>
            <span className="settings-summary-pill">Inactivas: {areaStats.inactiveCount}</span>
          </div>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Listado de áreas</h3>
                <p className="settings-subtle">
                  Estas áreas se usan para usuarios, responsables y tareas por alcance de área.
                </p>
              </div>
              {canCreateAreas ? (
                <button type="button" className="btn btn-primary" onClick={openCreateAreaModal}>
                  Crear área
                </button>
              ) : null}
            </div>

            <FilterSummaryBar stats={areaFilterStats} onClear={resetAreaFilters} />

            {errors.areas ? <p className="error-text">{errors.areas}</p> : null}

            {loading.areas ? (
              <p className="settings-subtle">Cargando áreas...</p>
            ) : filteredAreas.length === 0 ? (
              <p className="settings-subtle">No se encontraron áreas con los filtros actuales.</p>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="crud-table settings-table">
                    <thead>
                      <tr>
                        <th>Área</th>
                        <th>Clave</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAreas.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="settings-meta-stack">
                              <strong>{item.nombre}</strong>
                              <small>ID #{item.id}</small>
                            </div>
                          </td>
                          <td>{item.clave || "-"}</td>
                          <td>{item.descripcion || "-"}</td>
                          <td>
                            <SettingsStatusBadge active={item.activo} />
                          </td>
                          <td className="table-actions-cell">
                            <div className="row-actions table-actions">
                              {canUpdateAreas ? (
                                <IconButton
                                  icon={Pencil}
                                  label={`Editar área ${item.nombre}`.trim()}
                                  variant="secondary"
                                  onClick={() => openEditAreaModal(item)}
                                />
                              ) : null}
                              {(item.activo ? canToggleAreas : canUpdateAreas || canToggleAreas) ? (
                                <IconButton
                                  icon={item.activo ? PowerOff : Power}
                                  label={`${item.activo ? "Desactivar" : "Activar"} área ${item.nombre}`.trim()}
                                  variant={item.activo ? "warning" : "success"}
                                  onClick={() => handleAreaToggle(item)}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={paginatedAreas.currentPage}
                  pageSize={paginatedAreas.pageSize}
                  totalItems={paginatedAreas.totalItems}
                  onPageChange={(page) =>
                    setTablePagination((current) => ({
                      ...current,
                      areas: { ...current.areas, page },
                    }))
                  }
                  onPageSizeChange={(pageSize) =>
                    setTablePagination((current) => ({
                      ...current,
                      areas: { page: 1, pageSize },
                    }))
                  }
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {activeTab === TAB_IDS.LOCATIONS ? (
        <>

          <section className="crud-card foster-filter-card">
            <div className="foster-card-header">
              <div className="foster-filter-card-copy">
                <h3>Filtros y resumen</h3>
                <p>Busca por nombre, tipo, comuna, dirección o filtra por estado y región.</p>
              </div>
            </div>

            <div className="settings-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={locationFilters.search}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre, comuna, dirección o tipo"
                />
              </label>

              <label className="settings-filter-field">
                <span>Tipo</span>
                <select
                  value={locationFilters.tipo}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      tipo: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  {LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={locationFilters.status}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Región</span>
                <select
                  value={locationFilters.regionId}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      regionId: event.target.value,
                    }))
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
            </div>
          </section>

          <div className="settings-summary">
            <span className="settings-summary-pill">Filtradas: {filteredLocations.length}</span>
            <span className="settings-summary-pill">Activas: {locationStats.activeCount}</span>
            <span className="settings-summary-pill">Inactivas: {locationStats.inactiveCount}</span>
          </div>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Listado de ubicaciones</h3>
              </div>
              {canCreateLocations ? (
                <button type="button" className="btn btn-primary" onClick={openCreateLocationModal}>
                  Crear ubicación
                </button>
              ) : null}
            </div>

            <div className="settings-filter-grid settings-table-tools">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={locationFilters.search}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre, comuna, dirección o tipo"
                />
              </label>

              <label className="settings-filter-field">
                <span>Tipo</span>
                <select
                  value={locationFilters.tipo}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      tipo: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  {LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={locationFilters.status}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Región</span>
                <select
                  value={locationFilters.regionId}
                  onChange={(event) =>
                    setLocationFilters((current) => ({
                      ...current,
                      regionId: event.target.value,
                    }))
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
            </div>

            <FilterSummaryBar
              stats={locationFilterStats}
              onClear={resetLocationFilters}
            />

            {errors.locations ? <p className="error-text">{errors.locations}</p> : null}

            {loading.locations ? (
              <p className="settings-subtle">Cargando ubicaciones...</p>
            ) : filteredLocations.length === 0 ? (
              <p className="settings-subtle">No se encontraron ubicaciones con los filtros actuales.</p>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table settings-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Ubicación</th>
                      <th>Observaciones</th>
                      <th>Estado</th>
                      <th className="table-actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLocations.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="settings-meta-stack">
                            <strong>{item.nombre}</strong>
                            <small>ID #{item.id}</small>
                          </div>
                        </td>
                        <td>{item.tipo}</td>
                        <td>{formatLocationLine(item)}</td>
                        <td>{item.observaciones || <span className="settings-subtle">Sin notas</span>}</td>
                        <td>
                          <SettingsStatusBadge active={item.activo} />
                        </td>
                        <td className="table-actions-cell">
                          <div className="row-actions table-actions">
                            {canUpdateLocations ? (
                              <IconButton
                                icon={Pencil}
                                label={`Editar ubicación ${item.nombre || item.nombreUbicacion || ""}`.trim()}
                                variant="secondary"
                                onClick={() => openEditLocationModal(item)}
                              />
                            ) : null}
                            {(item.activo ? canDeleteLocations : canUpdateLocations) ? (
                              <IconButton
                                icon={item.activo ? PowerOff : Power}
                                label={`${item.activo ? "Desactivar" : "Activar"} ubicación ${item.nombre || item.nombreUbicacion || ""}`.trim()}
                                variant={item.activo ? "warning" : "success"}
                                onClick={() => handleLocationToggle(item)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <PaginationControls
                  page={paginatedLocations.currentPage}
                  pageSize={paginatedLocations.pageSize}
                  totalItems={paginatedLocations.totalItems}
                  onPageChange={(page) =>
                    setTablePagination((current) => ({
                      ...current,
                      locations: { ...current.locations, page },
                    }))
                  }
                  onPageSizeChange={(pageSize) =>
                    setTablePagination((current) => ({
                      ...current,
                      locations: { page: 1, pageSize },
                    }))
                  }
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {activeTab === TAB_IDS.CLINICS ? (
        <>
         

          <section className="crud-card foster-filter-card">
            <div className="foster-card-header">
              <div className="foster-filter-card-copy">
                <h3>Filtros y resumen</h3>
                <p>Busca por nombre, dirección o veterinarios asociados y filtra por estado.</p>
              </div>
            </div>

            <div className="settings-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={clinicFilters.search}
                  onChange={(event) =>
                    setClinicFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Clínica, dirección o veterinario"
                />
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={clinicFilters.status}
                  onChange={(event) =>
                    setClinicFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Región</span>
                <select
                  value={clinicFilters.regionId}
                  onChange={(event) =>
                    setClinicFilters((current) => ({
                      ...current,
                      regionId: event.target.value,
                    }))
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
            </div>
          </section>

          <div className="settings-summary">
            <span className="settings-summary-pill">Filtradas: {filteredClinics.length}</span>
            <span className="settings-summary-pill">Activas: {clinicStats.activeCount}</span>
            <span className="settings-summary-pill">Con veterinarios: {clinicStats.assignedVeterinarians}</span>
          </div>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Listado de clínicas veterinarias</h3>
              </div>
              {canCreateClinics ? (
                <button type="button" className="btn btn-primary" onClick={openCreateClinicModal}>
                  Crear clínica
                </button>
              ) : null}
            </div>

            <div className="settings-filter-grid settings-table-tools">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={clinicFilters.search}
                  onChange={(event) =>
                    setClinicFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Clínica, dirección o veterinario"
                />
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={clinicFilters.status}
                  onChange={(event) =>
                    setClinicFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Región</span>
                <select
                  value={clinicFilters.regionId}
                  onChange={(event) =>
                    setClinicFilters((current) => ({
                      ...current,
                      regionId: event.target.value,
                    }))
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
            </div>

            <FilterSummaryBar
              stats={clinicFilterStats}
              onClear={resetClinicFilters}
            />

            {errors.clinics ? <p className="error-text">{errors.clinics}</p> : null}

            {loading.clinics ? (
              <p className="settings-subtle">Cargando clínicas...</p>
            ) : filteredClinics.length === 0 ? (
              <p className="settings-subtle">No se encontraron clínicas con los filtros actuales.</p>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table settings-table">
                  <thead>
                    <tr>
                      <th>Clínica</th>
                      <th>Ubicación</th>
                      <th>Veterinarios</th>
                      <th>Estado</th>
                      <th className="table-actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClinics.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="settings-meta-stack">
                            <strong>{item.nombre}</strong>
                            <small>ID #{item.id}</small>
                          </div>
                        </td>
                        <td>{formatLocationLine(item.location)}</td>
                        <td>
                          {item.veterinarians.length === 0 ? (
                            <span className="settings-subtle">Sin veterinarios asociados</span>
                          ) : (
                            <div className="settings-chip-list">
                              {item.veterinarians.slice(0, 3).map((veterinarian) => (
                                <span key={veterinarian.id} className="settings-chip">
                                  {veterinarian.nombreCompleto || veterinarian.nombre}
                                </span>
                              ))}
                              {item.veterinarians.length > 3 ? (
                                <span className="settings-chip settings-chip-muted">
                                  +{item.veterinarians.length - 3}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td>
                          <SettingsStatusBadge active={item.activo} />
                        </td>
                        <td className="table-actions-cell">
                          <div className="row-actions table-actions">
                            {canUpdateClinics ? (
                              <IconButton
                                icon={Pencil}
                                label={`Editar clínica ${item.nombre || ""}`.trim()}
                                variant="secondary"
                                onClick={() => openEditClinicModal(item)}
                              />
                            ) : null}
                            {(item.activo ? canDeleteClinics : canUpdateClinics) ? (
                              <IconButton
                                icon={item.activo ? PowerOff : Power}
                                label={`${item.activo ? "Desactivar" : "Activar"} clínica ${item.nombre || ""}`.trim()}
                                variant={item.activo ? "warning" : "success"}
                                onClick={() => handleClinicToggle(item)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <PaginationControls
                  page={paginatedClinics.currentPage}
                  pageSize={paginatedClinics.pageSize}
                  totalItems={paginatedClinics.totalItems}
                  onPageChange={(page) =>
                    setTablePagination((current) => ({
                      ...current,
                      clinics: { ...current.clinics, page },
                    }))
                  }
                  onPageSizeChange={(pageSize) =>
                    setTablePagination((current) => ({
                      ...current,
                      clinics: { page: 1, pageSize },
                    }))
                  }
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {activeTab === TAB_IDS.VETERINARIANS ? (
        <>
         
          <section className="crud-card foster-filter-card">
            <div className="foster-card-header">
              <div className="foster-filter-card-copy">
                <h3>Filtros y resumen</h3>
                <p>Busca por nombre o contacto y filtra por clínica y estado.</p>
              </div>
            </div>

            <div className="settings-filter-grid">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={veterinarianFilters.search}
                  onChange={(event) =>
                    setVeterinarianFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre, email, teléfono o clínica"
                />
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={veterinarianFilters.status}
                  onChange={(event) =>
                    setVeterinarianFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Clínica</span>
                <select
                  value={veterinarianFilters.clinicId}
                  onChange={(event) =>
                    setVeterinarianFilters((current) => ({
                      ...current,
                      clinicId: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  {clinicOptions.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <div className="settings-summary">
            <span className="settings-summary-pill">Filtrados: {filteredVeterinarians.length}</span>
            <span className="settings-summary-pill">Activos: {veterinarianStats.activeCount}</span>
            <span className="settings-summary-pill">Clinicas cubiertas: {veterinarianStats.clinicsCovered}</span>
          </div>

          <section className="crud-card">
            <div className="foster-card-header">
              <div>
                <h3>Listado de veterinarios</h3>
              </div>
              {canCreateVeterinarians ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateVeterinarianModal}
                  disabled={clinicOptions.length === 0}
                >
                  Crear veterinario
                </button>
              ) : null}
            </div>

            <div className="settings-filter-grid settings-table-tools">
              <label className="settings-filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={veterinarianFilters.search}
                  onChange={(event) =>
                    setVeterinarianFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre, email, teléfono o clínica"
                />
              </label>

              <label className="settings-filter-field">
                <span>Estado</span>
                <select
                  value={veterinarianFilters.status}
                  onChange={(event) =>
                    setVeterinarianFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>

              <label className="settings-filter-field">
                <span>Clínica</span>
                <select
                  value={veterinarianFilters.clinicId}
                  onChange={(event) =>
                    setVeterinarianFilters((current) => ({
                      ...current,
                      clinicId: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  {clinicOptions.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <FilterSummaryBar
              stats={veterinarianFilterStats}
              onClear={resetVeterinarianFilters}
            />

            {clinicOptions.length === 0 ? (
              <p className="settings-inline-note">
                Necesitas al menos una clínica disponible para crear o reasignar veterinarios.
              </p>
            ) : null}

            {errors.veterinarians ? <p className="error-text">{errors.veterinarians}</p> : null}

            {loading.veterinarians ? (
              <p className="settings-subtle">Cargando veterinarios...</p>
            ) : filteredVeterinarians.length === 0 ? (
              <p className="settings-subtle">No se encontraron veterinarios con los filtros actuales.</p>
            ) : (
              <>
                <div className="table-scroll">
                <table className="crud-table settings-table">
                  <thead>
                    <tr>
                      <th>Veterinario</th>
                      <th>Contacto</th>
                      <th>Clínica</th>
                      <th>Ubicación de clínica</th>
                      <th>Estado</th>
                      <th className="table-actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVeterinarians.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="settings-meta-stack">
                            <strong>{item.nombreCompleto || item.nombre}</strong>
                            <small>ID #{item.id}</small>
                          </div>
                        </td>
                        <td>
                          <div className="settings-meta-stack">
                            <span>{item.email || "Sin email"}</span>
                            <small>{item.telefono || "Sin teléfono"}</small>
                          </div>
                        </td>
                        <td>{formatVeterinarianClinics(item)}</td>
                        <td>{formatLocationLine(item.clinic?.location)}</td>
                        <td>
                          <SettingsStatusBadge active={item.activo} />
                        </td>
                        <td className="table-actions-cell">
                          <div className="row-actions table-actions">
                            {canUpdateVeterinarians ? (
                              <IconButton
                                icon={Pencil}
                                label={`Editar veterinario ${item.nombre || ""} ${item.apellido || ""}`.trim()}
                                variant="secondary"
                                onClick={() => openEditVeterinarianModal(item)}
                              />
                            ) : null}
                            {(item.activo ? canDeleteVeterinarians : canUpdateVeterinarians) ? (
                              <IconButton
                                icon={item.activo ? PowerOff : Power}
                                label={`${item.activo ? "Desactivar" : "Activar"} veterinario ${item.nombre || ""} ${item.apellido || ""}`.trim()}
                                variant={item.activo ? "warning" : "success"}
                                onClick={() => handleVeterinarianToggle(item)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <PaginationControls
                  page={paginatedVeterinarians.currentPage}
                  pageSize={paginatedVeterinarians.pageSize}
                  totalItems={paginatedVeterinarians.totalItems}
                  onPageChange={(page) =>
                    setTablePagination((current) => ({
                      ...current,
                      veterinarians: { ...current.veterinarians, page },
                    }))
                  }
                  onPageSizeChange={(pageSize) =>
                    setTablePagination((current) => ({
                      ...current,
                      veterinarians: { page: 1, pageSize },
                    }))
                  }
                />
              </>
            )}
          </section>
        </>
      ) : null}

      <SettingsModal
        isOpen={regionModalOpen}
        title={editingRegionId ? "Editar región" : "Crear región"}
        submitLabel={editingRegionId ? "Guardar cambios" : "Crear región"}
        error={regionFormError}
        isSaving={regionSaving}
        onClose={() => {
          if (regionSaving) return;
          setRegionModalOpen(false);
          setRegionFormError("");
        }}
        onSubmit={handleSubmitRegion}
      >
        <section className="settings-form-section">
          <div>
            <h4>Datos de la región</h4>
            <p>Este catálogo se usa para filtros y formularios de ubicación en todo el sistema.</p>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field full">
              <span>Nombre</span>
              <input
                type="text"
                value={regionForm.nombre}
                onChange={(event) =>
                  setRegionForm((current) => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Ej. Región de Valparaíso"
              />
            </label>

            <label className="settings-form-field">
              <span>Código</span>
              <input
                type="text"
                value={regionForm.codigo}
                onChange={(event) =>
                  setRegionForm((current) => ({ ...current, codigo: event.target.value }))
                }
                placeholder="Ej. VAL"
              />
            </label>

            <label className="settings-form-field">
              <span>Orden</span>
              <input
                type="number"
                min="0"
                value={regionForm.orden}
                onChange={(event) =>
                  setRegionForm((current) => ({ ...current, orden: event.target.value }))
                }
                placeholder="0"
              />
            </label>

            <label className="settings-form-field">
              <span>Activo</span>
              <select
                value={regionForm.activo ? "true" : "false"}
                onChange={(event) =>
                  setRegionForm((current) => ({
                    ...current,
                    activo: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
        </section>
      </SettingsModal>

      <SettingsModal
        isOpen={communeModalOpen}
        title={editingCommuneId ? "Editar comuna" : "Crear comuna"}
        submitLabel={editingCommuneId ? "Guardar cambios" : "Crear comuna"}
        error={communeFormError}
        isSaving={communeSaving}
        onClose={() => {
          if (communeSaving) return;
          setCommuneModalOpen(false);
          setCommuneFormError("");
        }}
        onSubmit={handleSubmitCommune}
      >
        <section className="settings-form-section">
          <div>
            <h4>Datos de la comuna</h4>
            <p>La comuna siempre pertenece a una región y hereda su disponibilidad territorial.</p>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field">
              <span>Región</span>
              <select
                value={communeForm.regionId}
                onChange={(event) =>
                  setCommuneForm((current) => ({ ...current, regionId: event.target.value }))
                }
              >
                <option value="">Selecciona una región</option>
                {communeRegionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.activo ? region.nombre : `${region.nombre} (inactiva)`}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form-field">
              <span>Activo</span>
              <select
                value={communeForm.activo ? "true" : "false"}
                onChange={(event) =>
                  setCommuneForm((current) => ({
                    ...current,
                    activo: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>

            <label className="settings-form-field full">
              <span>Nombre</span>
              <input
                type="text"
                value={communeForm.nombre}
                onChange={(event) =>
                  setCommuneForm((current) => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Ej. Providencia"
              />
            </label>

            <label className="settings-form-field">
              <span>Código opcional</span>
              <input
                type="text"
                value={communeForm.codigo}
                onChange={(event) =>
                  setCommuneForm((current) => ({ ...current, codigo: event.target.value }))
                }
                placeholder="Opcional"
              />
            </label>
          </div>
        </section>
      </SettingsModal>


      <SettingsModal
        isOpen={areaModalOpen}
        title={editingAreaId ? "Editar área" : "Crear área"}
        submitLabel={editingAreaId ? "Guardar cambios" : "Crear área"}
        error={areaFormError}
        isSaving={areaSaving}
        onClose={() => {
          if (areaSaving) return;
          setAreaModalOpen(false);
          setAreaFormError("");
        }}
        onSubmit={handleSubmitArea}
      >
        <section className="settings-form-section">
          <div>
            <h4>Datos del área</h4>
            <p>
              Las áreas permiten segmentar usuarios y tareas. La baja es lógica para mantener historial.
            </p>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field">
              <span>Nombre</span>
              <input
                type="text"
                value={areaForm.nombre}
                onChange={(event) =>
                  setAreaForm((current) => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Ej. Rescate"
              />
            </label>

            <label className="settings-form-field">
              <span>Clave</span>
              <input
                type="text"
                value={areaForm.clave}
                onChange={(event) =>
                  setAreaForm((current) => ({ ...current, clave: event.target.value.toUpperCase() }))
                }
                placeholder="Ej. RES"
              />
            </label>

            <label className="settings-form-field">
              <span>Activo</span>
              <select
                value={areaForm.activo ? "true" : "false"}
                onChange={(event) =>
                  setAreaForm((current) => ({
                    ...current,
                    activo: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>

            <label className="settings-form-field full">
              <span>Descripción</span>
              <textarea
                rows="4"
                value={areaForm.descripcion}
                onChange={(event) =>
                  setAreaForm((current) => ({ ...current, descripcion: event.target.value }))
                }
                placeholder="Describe el alcance operativo del área"
              />
            </label>
          </div>
        </section>
      </SettingsModal>

      <SettingsModal
        isOpen={locationModalOpen}
        title={editingLocationId ? "Editar ubicación" : "Crear ubicación"}
        submitLabel={editingLocationId ? "Guardar cambios" : "Crear ubicación"}
        error={locationFormError}
        isSaving={locationSaving}
        onClose={() => {
          if (locationSaving) return;
          setLocationModalOpen(false);
          setLocationFormError("");
        }}
        onSubmit={handleSubmitLocation}
      >
        <section className="settings-form-section">
          <div>
            <h4>Datos base</h4>
            <p>La ubicación almacena solo información física y administrativa minima.</p>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field">
              <span>Tipo</span>
              <select
                value={locationForm.tipo}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, tipo: event.target.value }))
                }
              >
                {LOCATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form-field">
              <span>Activo</span>
              <select
                value={locationForm.activo ? "true" : "false"}
                onChange={(event) =>
                  setLocationForm((current) => ({
                    ...current,
                    activo: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Si</option>
                <option value="false">No</option>
              </select>
            </label>

            <label className="settings-form-field full">
              <span>Nombre de ubicación</span>
              <input
                type="text"
                value={locationForm.nombre}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Ej. Bodega Central"
              />
            </label>

            <label className="settings-form-field full">
              <span>Dirección</span>
              <input
                type="text"
                value={locationForm.direccion}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, direccion: event.target.value }))
                }
                placeholder="Calle, número y referencias utiles"
              />
            </label>

            <label className="settings-form-field">
              <span>Región</span>
              <select
                value={locationForm.regionId}
                onChange={(event) => handleLocationRegionChange(event.target.value)}
              >
                <option value="">Selecciona una región</option>
                {locationRegionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.activo ? region.nombre : `${region.nombre} (inactiva)`}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form-field">
              <span>Comuna</span>
              <select
                value={locationForm.comunaId}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, comunaId: event.target.value }))
                }
                disabled={!locationForm.regionId || isLoadingLocationComunas}
              >
                <option value="">
                  {!locationForm.regionId
                    ? "Selecciona una region primero"
                    : isLoadingLocationComunas
                      ? "Cargando comunas..."
                      : "Selecciona una comuna"}
                </option>
                {locationFormComunas.map((comuna) => (
                  <option key={comuna.id} value={comuna.id}>
                    {comuna.activo ? comuna.nombre : `${comuna.nombre} (inactiva)`}
                  </option>
                ))}
              </select>
            </label>

            {locationForm.regionId && !isLoadingLocationComunas && locationFormComunas.length === 0 ? (
              <p className="settings-empty-note full">No hay comunas disponibles para la región seleccionada.</p>
            ) : null}

            <label className="settings-form-field full">
              <span>Observaciones</span>
              <textarea
                rows="4"
                value={locationForm.observaciones}
                onChange={(event) =>
                  setLocationForm((current) => ({
                    ...current,
                    observaciones: event.target.value,
                  }))
                }
                placeholder="Notas internas opcionales"
              />
            </label>
          </div>
        </section>
      </SettingsModal>

      <SettingsModal
        isOpen={clinicModalOpen}
        title={editingClinicId ? "Editar clínica" : "Crear clínica"}
        submitLabel={editingClinicId ? "Guardar cambios" : "Crear clínica"}
        error={clinicFormError}
        isSaving={clinicSaving}
        onClose={() => {
          if (clinicSaving) return;
          setClinicModalOpen(false);
          setClinicFormError("");
        }}
        onSubmit={handleSubmitClinic}
      >
        <section className="settings-form-section">
          <div>
            <h4>Clínica</h4>
            <p>El contacto y el nombre viven en VetClinic. La ubicación física usa Location.</p>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field">
              <span>Nombre</span>
              <input
                type="text"
                value={clinicForm.nombre}
                onChange={(event) =>
                  setClinicForm((current) => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Ej. Clínica Veterinaria Norte"
              />
            </label>

            <label className="settings-form-field">
              <span>Activo</span>
              <select
                value={clinicForm.activo ? "true" : "false"}
                onChange={(event) =>
                  setClinicForm((current) => ({
                    ...current,
                    activo: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Si</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-form-section">
          <div>
            <h4>Ubicación</h4>
            <p>Selecciona región y comuna reales. Si cambia la región, la comuna se reinicia.</p>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field full">
              <span>Dirección</span>
              <input
                type="text"
                value={clinicForm.direccion}
                onChange={(event) =>
                  setClinicForm((current) => ({ ...current, direccion: event.target.value }))
                }
                placeholder="Calle, número y referencia"
              />
            </label>

            <label className="settings-form-field">
              <span>Región</span>
              <select
                value={clinicForm.regionId}
                onChange={(event) => handleClinicRegionChange(event.target.value)}
              >
                <option value="">Selecciona una región</option>
                {clinicRegionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.activo ? region.nombre : `${region.nombre} (inactiva)`}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form-field">
              <span>Comuna</span>
              <select
                value={clinicForm.comunaId}
                onChange={(event) =>
                  setClinicForm((current) => ({ ...current, comunaId: event.target.value }))
                }
                disabled={!clinicForm.regionId || isLoadingClinicComunas}
              >
                <option value="">
                  {!clinicForm.regionId
                    ? "Selecciona una region primero"
                    : isLoadingClinicComunas
                      ? "Cargando comunas..."
                      : "Selecciona una comuna"}
                </option>
                {clinicFormComunas.map((comuna) => (
                  <option key={comuna.id} value={comuna.id}>
                    {comuna.activo ? comuna.nombre : `${comuna.nombre} (inactiva)`}
                  </option>
                ))}
              </select>
            </label>

            {clinicForm.regionId && !isLoadingClinicComunas && clinicFormComunas.length === 0 ? (
              <p className="settings-empty-note full">No hay comunas disponibles para la región seleccionada.</p>
            ) : null}

            <label className="settings-form-field full">
              <span>Observaciones</span>
              <textarea
                rows="4"
                value={clinicForm.observaciones}
                onChange={(event) =>
                  setClinicForm((current) => ({
                    ...current,
                    observaciones: event.target.value,
                  }))
                }
                placeholder="Notas internas sobre la ubicación"
              />
            </label>
          </div>
        </section>

        <section className="settings-form-section">
          <div>
            <h4>Veterinarios activos</h4>
            <p>
              Seleccionar aqui agrega o quita asociaciones activas entre veterinarios y esta clínica.
            </p>
          </div>

          {canReadVeterinarians ? (
            <div className="settings-checkbox-panel">
              <p className="settings-inline-note">
                Un veterinario puede pertenecer a varias clínicas o a ninguna. Desmarcarlo aqui
                solo quita la asociacion con esta clínica.
              </p>

              {clinicVeterinarianOptions.length === 0 ? (
                <p className="settings-empty-note">No hay veterinarios disponibles para asociar.</p>
              ) : (
                <div className="settings-checkbox-list">
                  {clinicVeterinarianOptions.map((item) => {
                    const checked = clinicForm.veterinarianIds.includes(String(item.id));
                    return (
                      <label key={item.id} className="settings-checkbox-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setClinicForm((current) => ({
                              ...current,
                              veterinarianIds: event.target.checked
                                ? [...current.veterinarianIds, String(item.id)]
                                : current.veterinarianIds.filter((value) => value !== String(item.id)),
                            }))
                          }
                        />
                        <div className="settings-checkbox-copy">
                          <strong>
                            {item.nombreCompleto || item.nombre}
                            {item.activo ? "" : " (Inactivo)"}
                          </strong>
                          <span className="settings-checkbox-caption">
                            {formatVeterinarianClinics(item)}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="settings-inline-note">
              No tienes permiso para listar veterinarios activos desde esta vista.
            </p>
          )}
        </section>
      </SettingsModal>

      <SettingsModal
        isOpen={veterinarianModalOpen}
        title={editingVeterinarianId ? "Editar veterinario" : "Crear veterinario"}
        submitLabel={editingVeterinarianId ? "Guardar cambios" : "Crear veterinario"}
        error={veterinarianFormError}
        isSaving={veterinarianSaving}
        onClose={() => {
          if (veterinarianSaving) return;
          setVeterinarianModalOpen(false);
          setVeterinarianFormError("");
        }}
        onSubmit={handleSubmitVeterinarian}
      >
        <section className="settings-form-section">
          <div>
            <h4>Datos del veterinario</h4>
            <p>La baja es logica para no perder trazabilidad clínica e histórica.</p>
          </div>

          <div className="settings-form-grid">
            <label className="settings-form-field">
              <span>Nombre</span>
              <input
                type="text"
                value={veterinarianForm.nombre}
                onChange={(event) =>
                  setVeterinarianForm((current) => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Nombre"
              />
            </label>

            <label className="settings-form-field">
              <span>Apellido</span>
              <input
                type="text"
                value={veterinarianForm.apellido}
                onChange={(event) =>
                  setVeterinarianForm((current) => ({
                    ...current,
                    apellido: event.target.value,
                  }))
                }
                placeholder="Apellido"
              />
            </label>

            <label className="settings-form-field">
              <span>Email</span>
              <input
                type="email"
                value={veterinarianForm.email}
                onChange={(event) =>
                  setVeterinarianForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="usuario@example.com"
              />
            </label>

            <label className="settings-form-field">
              <span>Teléfono</span>
              <input
                type="text"
                value={veterinarianForm.telefono}
                onChange={(event) =>
                  setVeterinarianForm((current) => ({
                    ...current,
                    telefono: event.target.value,
                  }))
                }
                placeholder="+56912345678"
              />
            </label>

            <label className="settings-form-field">
              <span>Activo</span>
              <select
                value={veterinarianForm.activo ? "true" : "false"}
                onChange={(event) =>
                  setVeterinarianForm((current) => ({
                    ...current,
                    activo: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Si</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-form-section">
          <div>
            <h4>Clínicas asociadas</h4>
            <p>
              Un veterinario puede quedar sin clínicas o asociado a varias. La primera seleccionada
              se usa como compatibilidad legacy mientras el backend la necesite.
            </p>
          </div>

          <div className="settings-checkbox-panel">
            {veterinarianClinicOptions.length === 0 ? (
              <p className="settings-empty-note">No hay clínicas activas disponibles para asociar.</p>
            ) : (
              <div className="settings-checkbox-list">
                {veterinarianClinicOptions.map((clinic) => {
                  const checked = veterinarianForm.clinicIds.includes(String(clinic.id));

                  return (
                    <label key={clinic.id} className="settings-checkbox-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setVeterinarianForm((current) => ({
                            ...current,
                            clinicIds: event.target.checked
                              ? [...current.clinicIds, String(clinic.id)]
                              : current.clinicIds.filter((value) => value !== String(clinic.id)),
                          }))
                        }
                      />
                      <div className="settings-checkbox-copy">
                        <strong>
                          {clinic.nombre}
                          {clinic.activo ? "" : " (Inactiva)"}
                        </strong>
                        <span className="settings-checkbox-caption">
                          {clinic.location?.region?.nombre || "Sin region"}
                          {clinic.location?.comuna?.nombre
                            ? ` · ${clinic.location.comuna.nombre}`
                            : ""}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </SettingsModal>
    </section>
  );
}
