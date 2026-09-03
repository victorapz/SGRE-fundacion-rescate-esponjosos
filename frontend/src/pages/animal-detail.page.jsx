import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import AttachmentList from "../components/files/AttachmentList";
import FileUploader from "../components/files/FileUploader";
import ImageGallery from "../components/files/ImageGallery";
import FilterSummaryBar from "../components/FilterSummaryBar";
import PageBreadcrumb from "../components/PageBreadcrumb";
import RichTextEditor from "../components/common/RichTextEditor";
import HomeTabs from "../components/home/HomeTabs";
import { PERMISSIONS } from "../config/permissions";
import { usePermissions } from "../hooks/usePermissions";
import {
  getPreviewBlob,
  listFiles,
  uploadMultipleFiles,
} from "../services/file.service";
import {
  createAnimalDiet,
  deleteAnimalDiet,
  getAnimalDiets,
  updateAnimalDiet,
} from "../services/animal_diets.service";
import {
  createAnimalProfile,
  getAnimalProfiles,
  updateAnimalProfile,
} from "../services/animal_profile.service";
import { getAnimal } from "../services/animal.service";
import {
  deleteExam,
  getExams,
} from "../services/exam.service";
import {
  deleteHospitalization,
  getHospitalizations,
} from "../services/hospitalization.service";
import {
  createIntakeRecord,
  getIntakeRecords,
  updateIntakeRecord,
} from "../services/intake_record.service";
import {
  deleteProcedure,
  getProcedures,
} from "../services/procedure.service";
import {
  deleteVetCheckup,
  getVetCheckups,
} from "../services/vet_checkup.service";
import { getUsers } from "../services/user.service";
import {
  isRichTextEmpty,
  sanitizeRichTextHtml,
} from "../utils/rich-text";
import {
  formatFinancialSummary,
  formatMoney,
} from "../utils/financial";
import "../styles/home.page.css";
import "../styles/animals.page.css";
import "../styles/files.css";

const MAIN_TABS = [
  { id: "perfil", label: "Perfil" },
  { id: "historial", label: "Historial veterinario" },
  { id: "multimedia", label: "Multimedia" },
];

const HISTORY_TABS = [
  { id: "exam", label: "Exámenes" },
  { id: "hospitalization", label: "Hospitalizaciones" },
  { id: "procedure", label: "Procedimientos" },
  { id: "vet_checkup", label: "Controles" },
];
const REPRODUCTION_OPTIONS = ["ESTERILIZADO", "ENTERO", "DESCONOCIDO"];
function emptyIntakeForm() {
  return {
    fecha_entrega: "",
    estado_reproduccion_inicial: "",
    edad_estimada: "",
    lugar_entrega: "",
    causa_entrega: "",
    condiciones_iniciales: "",
    nombre_quien_entrega: "",
    quien_recibe_id: "",
  };
}

function emptyProfileForm() {
  return {
    personalidad: "",
    gustos: [],
    disgustos: [],
    historia: "",
    cuidados_especiales: [],
  };
}

function emptyDietForm() {
  return {
    marca_alimento: "",
    horario_alimentacion: "",
    notas: [],
  };
}

function formatValue(value) {
  return hasDisplayValue(value) ? value : "-";
}

function normalizeList(value) {
  if (!value) return [];

  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items) {
  if (!Array.isArray(items)) return "";

  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function formatList(value) {
  return normalizeList(value);
}

function hasDisplayValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasFinancialAmount(item) {
  return item?.montoTotal !== null && item?.montoTotal !== undefined && item?.montoTotal !== "";
}



function getRequiredRichTextError(fields) {
  const invalidField = fields.find((field) => isRichTextEmpty(field.value));
  return invalidField ? `El campo "${invalidField.label}" es obligatorio.` : "";
}

function formatUserOptionLabel(user) {
  if (!user) return "";

  const fullName = [user.nombre, user.apellido].filter(Boolean).join(" ").trim();
  if (fullName && user.email) return `${fullName} - ${user.email}`;
  if (fullName) return fullName;
  if (user.email) return user.email;
  return `Usuario ${user.id}`;
}

function getSelectPlaceholder(loading, items, emptyLabel, readyLabel) {
  if (loading) return "Cargando opciones...";
  if (items.length === 0) return emptyLabel;
  return readyLabel;
}

function parseDateValue(value) {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseEstimatedAge(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  let years = 0;
  let months = 0;
  let hasMatch = false;

  const yearMatch = normalized.match(/(\d+)\s*(a|ano|anos|años)/i);
  const monthMatch = normalized.match(/(\d+)\s*(m|mes|meses)/i);

  if (yearMatch) {
    years = Number(yearMatch[1]);
    hasMatch = true;
  }

  if (monthMatch) {
    months = Number(monthMatch[1]);
    hasMatch = true;
  }

  return hasMatch ? { years, months } : null;
}

function subtractAgeFromDate(date, age) {
  if (!date || !age) return null;

  const estimatedBirthDate = new Date(date);
  estimatedBirthDate.setMonth(estimatedBirthDate.getMonth() - age.months);
  estimatedBirthDate.setFullYear(estimatedBirthDate.getFullYear() - age.years);
  return estimatedBirthDate;
}

function getAgeParts(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) return null;

  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();

  if (endDate.getDate() < startDate.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    years: Math.max(years, 0),
    months: Math.max(months, 0),
  };
}

function emptyListDrafts() {
  return {
    gustos: "",
    disgustos: "",
    cuidados_especiales: "",
    notas: "",
  };
}

function formatAgeParts(parts) {
  if (!parts) return "-";
  if (parts.years === 0 && parts.months === 0) return "Menos de 1 M";

  const tokens = [];

  if (parts.years > 0) {
    tokens.push(`${parts.years} A`);
  }

  if (parts.months > 0) {
    tokens.push(`${parts.months} M`);
  }

  return tokens.join(" y ");
}

function calculateAnimalAge(animal, currentIntake) {
  if (!animal) return null;

  const comparisonDate =
    animal.fallecido && animal.fechaFallecimiento
      ? parseDateValue(animal.fechaFallecimiento)
      : new Date();

  let birthDate = parseDateValue(animal.fechaNacimiento);
  let isEstimated = animal.tipoFechaNacimiento !== "REAL";

  if (!birthDate && currentIntake?.fechaEntrega && currentIntake?.edadEstimada) {
    const estimatedAgeAtArrival = parseEstimatedAge(currentIntake.edadEstimada);
    const arrivalDate = parseDateValue(currentIntake.fechaEntrega);

    if (arrivalDate && estimatedAgeAtArrival) {
      birthDate = subtractAgeFromDate(arrivalDate, estimatedAgeAtArrival);
      isEstimated = true;
    }
  }

  if (!birthDate || !comparisonDate) return null;

  const ageParts = getAgeParts(birthDate, comparisonDate);
  if (!ageParts) return null;

  return {
    label: isEstimated ? "Edad actual estimada" : "Edad actual",
    value: formatAgeParts(ageParts),
    precision: isEstimated ? "Estimada" : "Exacta",
  };
}

function formatReadableValue(value) {
  if (!hasDisplayValue(value)) return "Sin registro";

  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSummaryDate(value) {
  if (!hasDisplayValue(value)) return "Sin registro";

  const parsed = parseDateValue(value);
  if (!parsed) return String(value);

  return parsed.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function AnimalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "perfil");
  const [activeHistoryTab, setActiveHistoryTab] = useState(
    searchParams.get("historyTab") || "exam",
  );

  const [animal, setAnimal] = useState(null);
  const [animalLoading, setAnimalLoading] = useState(true);
  const [animalError, setAnimalError] = useState("");

  const [intakeRecords, setIntakeRecords] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [diets, setDiets] = useState([]);
  const [exams, setExams] = useState([]);
  const [hospitalizations, setHospitalizations] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [checkups, setCheckups] = useState([]);

  const [sectionErrors, setSectionErrors] = useState({
    perfil: "",
    historial: "",
    multimedia: "",
  });
  const [actionError, setActionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examFiles, setExamFiles] = useState([]);
  const [examFilesLoading, setExamFilesLoading] = useState(false);
  const [examFilesError, setExamFilesError] = useState("");
  const [hospitalizationFiles, setHospitalizationFiles] = useState([]);
  const [hospitalizationFilesLoading, setHospitalizationFilesLoading] = useState(false);
  const [hospitalizationFilesError, setHospitalizationFilesError] = useState("");
  const [procedureFiles, setProcedureFiles] = useState([]);
  const [procedureFilesLoading, setProcedureFilesLoading] = useState(false);
  const [procedureFilesError, setProcedureFilesError] = useState("");
  const [checkupFiles, setCheckupFiles] = useState([]);
  const [checkupFilesLoading, setCheckupFilesLoading] = useState(false);
  const [checkupFilesError, setCheckupFilesError] = useState("");
  const [intakeFiles, setIntakeFiles] = useState([]);
  const [intakeFilesLoading, setIntakeFilesLoading] = useState(false);
  const [intakeFilesError, setIntakeFilesError] = useState("");
  const [pendingIntakeFiles, setPendingIntakeFiles] = useState([]);
  const [intakeUploadWarning, setIntakeUploadWarning] = useState("");
  const [mainFiles, setMainFiles] = useState([]);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [mainFilesLoading, setMainFilesLoading] = useState(false);
  const [galleryFilesLoading, setGalleryFilesLoading] = useState(false);
  const [mainFilesError, setMainFilesError] = useState("");
  const [galleryFilesError, setGalleryFilesError] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [headerImageError, setHeaderImageError] = useState("");

  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [intakeMode, setIntakeMode] = useState("create");
  const [editingIntakeId, setEditingIntakeId] = useState(null);
  const [intakeForm, setIntakeForm] = useState(emptyIntakeForm());

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileMode, setProfileMode] = useState("create");
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm());

  const [isDietModalOpen, setIsDietModalOpen] = useState(false);
  const [dietMode, setDietMode] = useState("create");
  const [editingDietId, setEditingDietId] = useState(null);
  const [dietForm, setDietForm] = useState(emptyDietForm());

  const [listDrafts, setListDrafts] = useState(emptyListDrafts());
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);

  const animalId = Number(id);
  const canReadProfile = hasPermission(PERMISSIONS.ANIMALS.ANIMAL_PROFILE_READ);
  const canManageProfile =
    hasPermission(PERMISSIONS.ANIMALS.ANIMAL_PROFILE_CREATE)
    || hasPermission(PERMISSIONS.ANIMALS.ANIMAL_PROFILE_UPDATE);
  const canReadIntake = hasPermission(PERMISSIONS.ANIMALS.INTAKE_RECORD_READ);
  const canManageIntake =
    hasPermission(PERMISSIONS.ANIMALS.INTAKE_RECORD_CREATE)
    || hasPermission(PERMISSIONS.ANIMALS.INTAKE_RECORD_UPDATE);
  const canReadDiets = hasPermission(PERMISSIONS.ANIMALS.ANIMAL_DIETS_READ);
  const canManageDiets =
    hasPermission(PERMISSIONS.ANIMALS.ANIMAL_DIETS_CREATE)
    || hasPermission(PERMISSIONS.ANIMALS.ANIMAL_DIETS_UPDATE);
  const canDeleteDiets = hasPermission(PERMISSIONS.ANIMALS.ANIMAL_DIETS_DELETE);
  const canReadExams = hasPermission(PERMISSIONS.ANIMALS.EXAM_READ);
  const canManageExams =
    hasPermission(PERMISSIONS.ANIMALS.EXAM_CREATE)
    || hasPermission(PERMISSIONS.ANIMALS.EXAM_UPDATE);
  const canDeleteExams = hasPermission(PERMISSIONS.ANIMALS.EXAM_DELETE);
  const canReadHospitalizations = hasPermission(PERMISSIONS.ANIMALS.HOSPITALIZATION_READ);
  const canManageHospitalizations =
    hasPermission(PERMISSIONS.ANIMALS.HOSPITALIZATION_CREATE)
    || hasPermission(PERMISSIONS.ANIMALS.HOSPITALIZATION_UPDATE);
  const canDeleteHospitalizations = hasPermission(PERMISSIONS.ANIMALS.HOSPITALIZATION_DELETE);
  const canReadProcedures = hasPermission(PERMISSIONS.ANIMALS.PROCEDURE_READ);
  const canManageProcedures =
    hasPermission(PERMISSIONS.ANIMALS.PROCEDURE_CREATE)
    || hasPermission(PERMISSIONS.ANIMALS.PROCEDURE_UPDATE);
  const canDeleteProcedures = hasPermission(PERMISSIONS.ANIMALS.PROCEDURE_DELETE);
  const canReadCheckups = hasPermission(PERMISSIONS.ANIMALS.VET_CHECKUP_READ);
  const canManageCheckups =
    hasPermission(PERMISSIONS.ANIMALS.VET_CHECKUP_CREATE)
    || hasPermission(PERMISSIONS.ANIMALS.VET_CHECKUP_UPDATE);
  const canDeleteCheckups = hasPermission(PERMISSIONS.ANIMALS.VET_CHECKUP_DELETE);
  const canReadAnimalFiles = hasAnyPermission([
    PERMISSIONS.FILES.READ,
    PERMISSIONS.FILES.ANIMAL_READ,
  ]);
  const canUploadAnimalFiles = hasAnyPermission([
    PERMISSIONS.FILES.UPLOAD,
    PERMISSIONS.FILES.ANIMAL_UPLOAD,
  ]);
  const canDeleteAnimalFiles = hasAnyPermission([
    PERMISSIONS.FILES.DELETE,
    PERMISSIONS.FILES.ANIMAL_DELETE,
  ]);
  const canMarkAnimalFilesMain = hasAnyPermission([
    PERMISSIONS.FILES.UPDATE,
    PERMISSIONS.FILES.ANIMAL_UPLOAD,
  ]);
  const canReadIntakeFiles = hasAnyPermission([
    PERMISSIONS.FILES.READ,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_READ,
  ]);
  const canUploadIntakeFiles = hasAnyPermission([
    PERMISSIONS.FILES.UPLOAD,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_UPLOAD,
  ]);
  const canDeleteIntakeFiles = hasAnyPermission([
    PERMISSIONS.FILES.DELETE,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_DELETE,
  ]);
  const canReadClinicalFiles = hasAnyPermission([
    PERMISSIONS.FILES.READ,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_READ,
  ]);
  const canUploadClinicalFiles = hasAnyPermission([
    PERMISSIONS.FILES.UPLOAD,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_UPLOAD,
  ]);
  const canDeleteClinicalFiles = hasAnyPermission([
    PERMISSIONS.FILES.DELETE,
    PERMISSIONS.FILES.ANIMAL_CLINICAL_DELETE,
  ]);
  const canReadExamFiles = canReadClinicalFiles;
  const canUploadExamFiles = canUploadClinicalFiles;
  const canDeleteExamFiles = canDeleteClinicalFiles;
  const setSectionError = useCallback((section, message) => {
    setSectionErrors((currentValue) => ({
      ...currentValue,
      [section]: message || "",
    }));
  }, []);

  const clearSectionError = useCallback((section) => {
    setSectionError(section, "");
  }, [setSectionError]);

  const loadMainFiles = useCallback(async () => {
    if (!canReadAnimalFiles) {
      setMainFiles([]);
      setMainFilesError("");
      return;
    }

    setMainFilesLoading(true);
    setMainFilesError("");

    try {
      const data = await listFiles({
        entityType: "ANIMAL",
        entityId: animalId,
        context: "ANIMAL_MAIN",
        status: "ACTIVO",
      });
      setMainFiles(data);
    } catch (error) {
      setMainFilesError(error instanceof Error ? error.message : "No se pudo cargar la imagen principal");
    } finally {
      setMainFilesLoading(false);
    }
  }, [animalId, canReadAnimalFiles]);

  const loadGalleryFiles = useCallback(async () => {
    if (!canReadAnimalFiles) {
      setGalleryFiles([]);
      setGalleryFilesError("");
      return;
    }

    setGalleryFilesLoading(true);
    setGalleryFilesError("");

    try {
      const data = await listFiles({
        entityType: "ANIMAL",
        entityId: animalId,
        context: "ANIMAL_GALLERY",
        status: "ACTIVO",
      });
      setGalleryFiles(data);
    } catch (error) {
      setGalleryFilesError(error instanceof Error ? error.message : "No se pudo cargar la galeria");
    } finally {
      setGalleryFilesLoading(false);
    }
  }, [animalId, canReadAnimalFiles]);

  const loadIntakeFiles = useCallback(async (intakeRecordId) => {
    if (!intakeRecordId) {
      setIntakeFiles([]);
      setIntakeFilesError("");
      return;
    }

    setIntakeFilesLoading(true);
    setIntakeFilesError("");

    try {
      const data = await listFiles({
        entityType: "INTAKE_RECORD",
        entityId: intakeRecordId,
        context: "INTAKE_RECORD_ATTACHMENT",
        status: "ACTIVO",
      });
      setIntakeFiles(data);
    } catch (error) {
      setIntakeFilesError(error instanceof Error ? error.message : "No se pudieron cargar los adjuntos de la ficha");
    } finally {
      setIntakeFilesLoading(false);
    }
  }, []);

  const loadExamFiles = useCallback(async (examId) => {
    if (!examId) {
      setExamFiles([]);
      setExamFilesError("");
      return;
    }

    setExamFilesLoading(true);
    setExamFilesError("");

    try {
      const data = await listFiles({
        entityType: "EXAM",
        entityId: examId,
        context: "EXAM_ATTACHMENT",
        status: "ACTIVO",
      });
      setExamFiles(data);
    } catch (error) {
      setExamFilesError(error instanceof Error ? error.message : "No se pudieron cargar los adjuntos del examen");
    } finally {
      setExamFilesLoading(false);
    }
  }, []);

  const loadHospitalizationFiles = useCallback(async (hospitalizationId) => {
    if (!hospitalizationId) {
      setHospitalizationFiles([]);
      setHospitalizationFilesError("");
      return;
    }

    setHospitalizationFilesLoading(true);
    setHospitalizationFilesError("");

    try {
      const data = await listFiles({
        entityType: "HOSPITALIZATION",
        entityId: hospitalizationId,
        context: "HOSPITALIZATION_ATTACHMENT",
        status: "ACTIVO",
      });
      setHospitalizationFiles(data);
    } catch (error) {
      setHospitalizationFilesError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los adjuntos de la hospitalizacion",
      );
    } finally {
      setHospitalizationFilesLoading(false);
    }
  }, []);

  const loadProcedureFiles = useCallback(async (procedureId) => {
    if (!procedureId) {
      setProcedureFiles([]);
      setProcedureFilesError("");
      return;
    }

    setProcedureFilesLoading(true);
    setProcedureFilesError("");

    try {
      const data = await listFiles({
        entityType: "PROCEDURE",
        entityId: procedureId,
        context: "PROCEDURE_ATTACHMENT",
        status: "ACTIVO",
      });
      setProcedureFiles(data);
    } catch (error) {
      setProcedureFilesError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los adjuntos del procedimiento",
      );
    } finally {
      setProcedureFilesLoading(false);
    }
  }, []);

  const loadCheckupFiles = useCallback(async (checkupId) => {
    if (!checkupId) {
      setCheckupFiles([]);
      setCheckupFilesError("");
      return;
    }

    setCheckupFilesLoading(true);
    setCheckupFilesError("");

    try {
      const data = await listFiles({
        entityType: "VET_CHECKUP",
        entityId: checkupId,
        context: "VET_CHECKUP_ATTACHMENT",
        status: "ACTIVO",
      });
      setCheckupFiles(data);
    } catch (error) {
      setCheckupFilesError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los adjuntos del control veterinario",
      );
    } finally {
      setCheckupFilesLoading(false);
    }
  }, []);

  const loadAnimal = useCallback(async () => {
    setAnimalLoading(true);
    setAnimalError("");

    try {
      const data = await getAnimal(animalId);
      setAnimal(data);
    } catch (error) {
      setAnimalError(error instanceof Error ? error.message : "No se pudo cargar el animal");
    } finally {
      setAnimalLoading(false);
    }
  }, [animalId]);

  const loadIntakeRecords = useCallback(async () => {
    if (!canReadIntake) {
      setIntakeRecords([]);
      clearSectionError("perfil");
      return;
    }

    try {
      const data = await getIntakeRecords();
      setIntakeRecords(data.filter((item) => Number(item.animalId) === animalId));
      clearSectionError("perfil");
    } catch (error) {
      setSectionError(
        "perfil",
        error instanceof Error ? error.message : "No se pudieron cargar los registros.",
      );
    }
  }, [animalId, canReadIntake, clearSectionError, setSectionError]);

  const loadProfiles = useCallback(async () => {
    if (!canReadProfile) {
      setProfiles([]);
      clearSectionError("perfil");
      return;
    }

    try {
      const data = await getAnimalProfiles();
      setProfiles(data.filter((item) => Number(item.animalId) === animalId));
      clearSectionError("perfil");
    } catch (error) {
      setSectionError(
        "perfil",
        error instanceof Error ? error.message : "No se pudieron cargar los perfiles.",
      );
    }
  }, [animalId, canReadProfile, clearSectionError, setSectionError]);

  const loadDiets = useCallback(async () => {
    if (!canReadDiets) {
      setDiets([]);
      clearSectionError("perfil");
      return;
    }

    try {
      const data = await getAnimalDiets();
      setDiets(data.filter((item) => Number(item.animalId) === animalId));
      clearSectionError("perfil");
    } catch (error) {
      setSectionError(
        "perfil",
        error instanceof Error ? error.message : "No se pudieron cargar las dietas.",
      );
    }
  }, [animalId, canReadDiets, clearSectionError, setSectionError]);

  const loadExams = useCallback(async () => {
    if (!canReadExams) {
      setExams([]);
      clearSectionError("historial");
      return;
    }

    try {
      const data = await getExams();
      setExams(data.filter((item) => Number(item.animalId) === animalId));
      clearSectionError("historial");
    } catch (error) {
      setSectionError(
        "historial",
        error instanceof Error ? error.message : "No se pudieron cargar los exámenes.",
      );
    }
  }, [animalId, canReadExams, clearSectionError, setSectionError]);

  const loadHospitalizations = useCallback(async () => {
    if (!canReadHospitalizations) {
      setHospitalizations([]);
      clearSectionError("historial");
      return;
    }

    try {
      const data = await getHospitalizations();
      setHospitalizations(data.filter((item) => Number(item.animalId) === animalId));
      clearSectionError("historial");
    } catch (error) {
      setSectionError(
        "historial",
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las hospitalizaciones.",
      );
    }
  }, [animalId, canReadHospitalizations, clearSectionError, setSectionError]);

  const loadProcedures = useCallback(async () => {
    if (!canReadProcedures) {
      setProcedures([]);
      clearSectionError("historial");
      return;
    }

    try {
      const data = await getProcedures();
      setProcedures(data.filter((item) => Number(item.animalId) === animalId));
      clearSectionError("historial");
    } catch (error) {
      setSectionError(
        "historial",
        error instanceof Error ? error.message : "No se pudieron cargar los procedimientos.",
      );
    }
  }, [animalId, canReadProcedures, clearSectionError, setSectionError]);

  const loadCheckups = useCallback(async () => {
    if (!canReadCheckups) {
      setCheckups([]);
      clearSectionError("historial");
      return;
    }

    try {
      const data = await getVetCheckups();
      setCheckups(data.filter((item) => Number(item.animalId) === animalId));
      clearSectionError("historial");
    } catch (error) {
      setSectionError(
        "historial",
        error instanceof Error ? error.message : "No se pudieron cargar los controles.",
      );
    }
  }, [animalId, canReadCheckups, clearSectionError, setSectionError]);

  const loadUsers = useCallback(async () => {
    if (!hasPermission(PERMISSIONS.USERS.READ)) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }

    setUsersLoading(true);

    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    } finally {
      setUsersLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    loadAnimal();
  }, [
    loadAnimal,
  ]);

  useEffect(() => {
    if (!canReadAnimalFiles) {
      return;
    }

    loadMainFiles();
  }, [canReadAnimalFiles, loadMainFiles]);

  useEffect(() => {
    if (activeTab !== "multimedia" || !canReadAnimalFiles) {
      return;
    }

    clearSectionError("multimedia");
    loadMainFiles();
    loadGalleryFiles();
  }, [activeTab, canReadAnimalFiles, clearSectionError, loadGalleryFiles, loadMainFiles]);

  const currentIntake = useMemo(() => intakeRecords[intakeRecords.length - 1] || null, [intakeRecords]);

  useEffect(() => {
    if (activeTab !== "perfil") {
      return;
    }

    clearSectionError("perfil");
    if (canReadProfile) {
      loadProfiles();
    }
    if (canReadIntake) {
      loadIntakeRecords();
    }
    if (canReadDiets) {
      loadDiets();
    }
  }, [
    activeTab,
    canReadDiets,
    canReadIntake,
    canReadProfile,
    clearSectionError,
    loadDiets,
    loadIntakeRecords,
    loadProfiles,
  ]);

  useEffect(() => {
    if (activeTab !== "historial") {
      return;
    }

    clearSectionError("historial");

    if (activeHistoryTab === "exam" && canReadExams) {
      loadExams();
    }

    if (activeHistoryTab === "hospitalization" && canReadHospitalizations) {
      loadHospitalizations();
    }

    if (activeHistoryTab === "procedure" && canReadProcedures) {
      loadProcedures();
    }

    if (activeHistoryTab === "vet_checkup" && canReadCheckups) {
      loadCheckups();
    }
  }, [
    activeHistoryTab,
    activeTab,
    canReadCheckups,
    canReadExams,
    canReadHospitalizations,
    canReadProcedures,
    clearSectionError,
    loadCheckups,
    loadExams,
    loadHospitalizations,
    loadProcedures,
  ]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const requestedHistoryTab = searchParams.get("historyTab");

    if (requestedTab) {
      setActiveTab(requestedTab);
    }

    if (requestedHistoryTab) {
      setActiveHistoryTab(requestedHistoryTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isIntakeModalOpen || !canManageIntake) {
      return;
    }

    if (users.length === 0 && !usersLoading) {
      loadUsers();
    }
  }, [canManageIntake, isIntakeModalOpen, loadUsers, users.length, usersLoading]);

  useEffect(() => {
    if (!currentIntake?.id || !canReadIntakeFiles) {
      setIntakeFiles([]);
      setIntakeFilesError("");
      return;
    }

    loadIntakeFiles(currentIntake.id);
  }, [canReadIntakeFiles, currentIntake?.id, loadIntakeFiles]);

  useEffect(() => {
    if (
      !historyDetail
      || historyDetail.type !== "exam"
      || !historyDetail.item?.id
      || !canReadExamFiles
    ) {
      if (!historyDetail || historyDetail.type !== "exam" || !canReadExamFiles) {
        setExamFiles([]);
        setExamFilesError("");
      }
      return;
    }

    loadExamFiles(historyDetail.item.id);
  }, [canReadExamFiles, historyDetail, loadExamFiles]);

  useEffect(() => {
    if (
      !historyDetail
      || historyDetail.type !== "hospitalization"
      || !historyDetail.item?.id
      || !canReadClinicalFiles
    ) {
      if (!historyDetail || historyDetail.type !== "hospitalization" || !canReadClinicalFiles) {
        setHospitalizationFiles([]);
        setHospitalizationFilesError("");
      }
      return;
    }

    loadHospitalizationFiles(historyDetail.item.id);
  }, [canReadClinicalFiles, historyDetail, loadHospitalizationFiles]);

  useEffect(() => {
    if (
      !historyDetail
      || historyDetail.type !== "procedure"
      || !historyDetail.item?.id
      || !canReadClinicalFiles
    ) {
      if (!historyDetail || historyDetail.type !== "procedure" || !canReadClinicalFiles) {
        setProcedureFiles([]);
        setProcedureFilesError("");
      }
      return;
    }

    loadProcedureFiles(historyDetail.item.id);
  }, [canReadClinicalFiles, historyDetail, loadProcedureFiles]);

  useEffect(() => {
    if (
      !historyDetail
      || historyDetail.type !== "vet_checkup"
      || !historyDetail.item?.id
      || !canReadClinicalFiles
    ) {
      if (!historyDetail || historyDetail.type !== "vet_checkup" || !canReadClinicalFiles) {
        setCheckupFiles([]);
        setCheckupFilesError("");
      }
      return;
    }

    loadCheckupFiles(historyDetail.item.id);
  }, [canReadClinicalFiles, historyDetail, loadCheckupFiles]);


  useEffect(() => {
    let isCancelled = false;
    let objectUrl = "";

    async function loadHeaderImage() {
      const currentMainFile =
        galleryFiles.find((item) => item.is_main)
        || mainFiles.find((item) => item.is_main)
        || mainFiles[0]
        || null;

      if (!currentMainFile) {
        setHeaderImageUrl("");
        setHeaderImageError("");
        return;
      }

      try {
        const blob = await getPreviewBlob(currentMainFile.file_asset_id);
        objectUrl = URL.createObjectURL(blob);

        if (!isCancelled) {
          setHeaderImageUrl(objectUrl);
          setHeaderImageError("");
        }
      } catch (error) {
        if (!isCancelled) {
          setHeaderImageUrl("");
          setHeaderImageError(error instanceof Error ? error.message : "No se pudo cargar la foto principal");
        }
      }
    }

    loadHeaderImage();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [galleryFiles, mainFiles]);

  const animalInitial = useMemo(() => {
    if (!animal?.nombre) return "A";
    return animal.nombre.charAt(0).toUpperCase();
  }, [animal]);

  const currentProfile = useMemo(() => profiles[profiles.length - 1] || null, [profiles]);

  const currentDiet = useMemo(() => diets[diets.length - 1] || null, [diets]);
  const currentMainDisplayFiles = useMemo(() => {
    const galleryMainFiles = galleryFiles.filter((item) => item.is_main);
    if (galleryMainFiles.length > 0) {
      return galleryMainFiles;
    }

    const explicitMainFiles = mainFiles.filter((item) => item.is_main);
    if (explicitMainFiles.length > 0) {
      return explicitMainFiles;
    }

    return mainFiles;
  }, [galleryFiles, mainFiles]);
  const dietHistory = useMemo(() => diets.slice(0, -1), [diets]);
  const animalAge = useMemo(
    () => calculateAnimalAge(animal, currentIntake),
    [animal, currentIntake],
  );
  const examStats = useMemo(
    () => [
      `Mostrando ${exams.length} de ${exams.length}`,
      `Con monto contable: ${exams.filter((item) => hasFinancialAmount(item)).length}`,
    ],
    [exams],
  );
  const hospitalizationStats = useMemo(
    () => [
      `Mostrando ${hospitalizations.length} de ${hospitalizations.length}`,
      `Con alta: ${hospitalizations.filter((item) => hasDisplayValue(item.fechaAlta)).length}`,
    ],
    [hospitalizations],
  );
  const procedureStats = useMemo(
    () => [
      `Mostrando ${procedures.length} de ${procedures.length}`,
      `Con monto contable: ${procedures.filter((item) => hasFinancialAmount(item)).length}`,
    ],
    [procedures],
  );
  const checkupStats = useMemo(
    () => [
      `Mostrando ${checkups.length} de ${checkups.length}`,
      `Con próximo control: ${checkups.filter((item) => hasDisplayValue(item.fechaProximoControl)).length}`,
    ],
    [checkups],
  );
  const profileTabAllowed = canReadProfile || canReadIntake || canReadDiets;
  const historyTabAllowed =
    canReadExams || canReadHospitalizations || canReadProcedures || canReadCheckups;
  const mediaTabAllowed = canReadAnimalFiles;
  const visibleSectionError =
    activeTab === "perfil"
      ? sectionErrors.perfil
      : activeTab === "historial"
        ? sectionErrors.historial
        : sectionErrors.multimedia;

  const handleListDraftChange = (fieldKey, value) => {
    setListDrafts((state) => ({ ...state, [fieldKey]: value }));
  };

  const addListItem = (fieldKey, setter, maxItems = 5) => {
    const nextValue = (listDrafts[fieldKey] || "").trim();
    if (!nextValue) return;

    setter((state) => {
      const currentItems = Array.isArray(state[fieldKey]) ? state[fieldKey] : [];
      if (currentItems.length >= maxItems || currentItems.includes(nextValue)) {
        return state;
      }

      return { ...state, [fieldKey]: [...currentItems, nextValue] };
    });

    setListDrafts((state) => ({ ...state, [fieldKey]: "" }));
  };

  const removeListItem = (fieldKey, valueToRemove, setter) => {
    setter((state) => ({
      ...state,
      [fieldKey]: (state[fieldKey] || []).filter((item) => item !== valueToRemove),
    }));
  };

  const openIntakeModal = (record) => {
    if (!canManageIntake) return;
    setActionError("");
    setPendingIntakeFiles([]);
    setIntakeUploadWarning("");

    if (record) {
      setIntakeMode("edit");
      setEditingIntakeId(record.id);
      setIntakeForm({
        fecha_entrega: record.fechaEntrega || "",
        estado_reproduccion_inicial: record.estadoReproduccionInicial || "",
        edad_estimada: record.edadEstimada || "",
        lugar_entrega: record.lugarEntrega || "",
        causa_entrega: record.causaEntrega || "",
        condiciones_iniciales: record.condicionesIniciales || "",
        nombre_quien_entrega: record.nombreQuienEntrega || "",
        quien_recibe_id: record.quienRecibeId ? String(record.quienRecibeId) : "",
      });
    } else {
      setIntakeMode("create");
      setEditingIntakeId(null);
      setIntakeForm({
        ...emptyIntakeForm(),
        fecha_entrega: animal?.fechaLlegadaFundacion || "",
      });
    }
    setIsIntakeModalOpen(true);
  };

  const openProfileModal = (profile) => {
    if (!canManageProfile) return;
    setActionError("");
    setListDrafts(emptyListDrafts());

    if (profile) {
      setProfileMode("edit");
      setEditingProfileId(profile.id);
      setProfileForm({
        personalidad: profile.personalidad || "",
        gustos: normalizeList(profile.gustos),
        disgustos: normalizeList(profile.disgustos),
        historia: profile.historia || "",
        cuidados_especiales: normalizeList(profile.cuidadosEspeciales),
      });
    } else {
      setProfileMode("create");
      setEditingProfileId(null);
      setProfileForm(emptyProfileForm());
    }
    setIsProfileModalOpen(true);
  };

  const openDietModal = (diet) => {
    if (!canManageDiets) return;
    setActionError("");
    setListDrafts(emptyListDrafts());

    if (diet) {
      setDietMode("edit");
      setEditingDietId(diet.id);
      setDietForm({
        marca_alimento: diet.marcaAlimento || "",
        horario_alimentacion: diet.horarioAlimentacion || "",
        notas: normalizeList(diet.notas),
      });
    } else {
      setDietMode("create");
      setEditingDietId(null);
      setDietForm(emptyDietForm());
    }
    setIsDietModalOpen(true);
  };

  const openExamModal = (exam) => {
    if (!canManageExams) return;
    navigate(
      exam
        ? `/rescatados/${animalId}/examenes/${exam.id}/editar`
        : `/rescatados/${animalId}/examenes/nuevo`,
    );
  };

  const openHospitalizationModal = (hospitalization) => {
    if (!canManageHospitalizations) return;
    navigate(
      hospitalization
        ? `/rescatados/${animalId}/hospitalizaciones/${hospitalization.id}/editar`
        : `/rescatados/${animalId}/hospitalizaciones/nueva`,
    );
  };

  const openProcedureModal = (procedure) => {
    if (!canManageProcedures) return;
    navigate(
      procedure
        ? `/rescatados/${animalId}/procedimientos/${procedure.id}/editar`
        : `/rescatados/${animalId}/procedimientos/nuevo`,
    );
  };

  const openCheckupModal = (checkup) => {
    if (!canManageCheckups) return;
    navigate(
      checkup
        ? `/rescatados/${animalId}/controles/${checkup.id}/editar`
        : `/rescatados/${animalId}/controles/nuevo`,
    );
  };

  const closeModal = (setter) => {
    if (!isSubmitting) {
      setActionError("");
      setter(false);
    }
  };

  const renderClinicalAttachmentList = ({
    title = "Archivos adjuntos",
    files,
    loading,
    error,
    emptyMessage,
    allowDelete,
    onRefresh,
  }) => (
    <div className="animal-detail-attachments">
      <span className="animal-meta-label">{title}</span>
      <AttachmentList
        files={files}
        loading={loading}
        error={error}
        emptyMessage={emptyMessage}
        showVisibility={false}
        allowDownload
        allowDelete={allowDelete}
        allowMarkMain={false}
        onRefresh={onRefresh}
      />
    </div>
  );

  const submitIntake = async (event) => {
    event.preventDefault();
    setActionError("");
    setIsSubmitting(true);
    setIntakeUploadWarning("");

    try {
      const payload = {
        ...intakeForm,
        animal_id: animalId,
        quien_recibe_id: intakeForm.quien_recibe_id
          ? Number(intakeForm.quien_recibe_id)
          : null,
      };

      let savedRecord = null;

      if (intakeMode === "create") {
        savedRecord = await createIntakeRecord(payload);

        if (pendingIntakeFiles.length > 0 && savedRecord?.id) {
          const uploadResult = await uploadMultipleFiles(pendingIntakeFiles, {
            entityType: "INTAKE_RECORD",
            entityId: savedRecord.id,
            context: "INTAKE_RECORD_ATTACHMENT",
            visibility: "PRIVADO",
            isMain: false,
          });

          if (uploadResult.failed.length > 0) {
            setIntakeUploadWarning(
              `La ficha se creó correctamente, pero ${uploadResult.failed.length} adjunto(s) no pudieron subirse.`,
            );
          }
        }
      } else {
        savedRecord = await updateIntakeRecord(editingIntakeId, payload);
      }

      await loadIntakeRecords();
      if (savedRecord?.id) {
        await loadIntakeFiles(savedRecord.id);
      }
      setPendingIntakeFiles([]);
      setIsIntakeModalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error guardando el registro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    const richTextError = getRequiredRichTextError([
      { label: "Historia", value: profileForm.historia },
    ]);
    if (richTextError) {
      setActionError(richTextError);
      return;
    }

    setActionError("");
    setIsSubmitting(true);

    try {
      const payload = {
        ...profileForm,
        gustos: joinList(profileForm.gustos),
        disgustos: joinList(profileForm.disgustos),
        cuidados_especiales: joinList(profileForm.cuidados_especiales),
        animal_id: animalId,
      };

      if (profileMode === "create") {
        await createAnimalProfile(payload);
      } else {
        await updateAnimalProfile(editingProfileId, payload);
      }

      await loadProfiles();
      setIsProfileModalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error guardando el perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDiet = async (event) => {
    event.preventDefault();
    setActionError("");
    setIsSubmitting(true);

    try {
      const payload = {
        ...dietForm,
        notas: joinList(dietForm.notas),
        animal_id: animalId,
      };

      if (dietMode === "create") {
        await createAnimalDiet(payload);
      } else {
        await updateAnimalDiet(editingDietId, payload);
      }

      await loadDiets();
      setIsDietModalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error guardando la dieta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeRecord = async (handler, idToDelete, reload) => {
    const confirmed = window.confirm("Deseas eliminar este registro?");
    if (!confirmed) return;

    setActionError("");

    try {
      await handler(idToDelete);
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error eliminando el registro.");
    }
  };

  const renderBulletList = (items, emptyText) => {
    if (!items || items.length === 0) {
      return <p className="animal-muted">{emptyText || "Sin datos"}</p>;
    }

    return (
      <ul className="animal-bullet-list">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  };

  const renderModalField = (label, control, className = "") => (
    <label className={className}>
      <span>{label}</span>
      {control}
    </label>
  );

  const renderRichTextValue = (value, emptyText = "Sin datos") => {
    if (isRichTextEmpty(value)) {
      return <p className="animal-muted">{emptyText}</p>;
    }

    return (
      <div
        className="animal-history animal-rich-text-read"
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(value) }}
      />
    );
  };

  const openHistoryDetail = (type, item) => {
    setHistoryDetail({ type, item });
  };

  const closeHistoryDetail = () => {
    setHistoryDetail(null);
  };

  const renderDetailTextField = (label, value) => {
    if (!hasDisplayValue(value)) return null;

    return (
      <div key={label} className="animal-detail-item">
        <span className="animal-meta-label">{label}</span>
        <span className="animal-meta-value">{value}</span>
      </div>
    );
  };

  const renderDetailRichTextField = (label, value) => {
    if (isRichTextEmpty(value)) return null;

    return (
      <div key={label} className="animal-detail-richtext">
        <span className="animal-meta-label">{label}</span>
        <div
          className="animal-history animal-rich-text-read"
          dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(value) }}
        />
      </div>
    );
  };

  const renderHistoryActions = (
    type,
    item,
    onEdit,
    onDelete,
    { canEdit = true, canDelete = true } = {},
  ) => (
    <div className="animal-card-actions table-actions">
      <IconButton
        icon={Eye}
        label={`Ver detalle de ${type.toLowerCase()}`}
        variant="secondary"
        onClick={() => openHistoryDetail(type, item)}
      />
      {canEdit ? (
        <IconButton
          icon={Pencil}
          label={`Editar ${type.toLowerCase()}`}
          variant="secondary"
          onClick={() => onEdit(item)}
        />
      ) : null}
      {canDelete ? (
        <IconButton
          icon={Trash2}
          label={`Eliminar ${type.toLowerCase()}`}
          variant="danger"
          onClick={() => onDelete(item.id)}
        />
      ) : null}
    </div>
  );

  const renderListEditor = (label, fieldKey, items, setter, placeholder, isRequired = true) => {
    const currentItems = Array.isArray(items) ? items : [];
    const draftValue = listDrafts[fieldKey] || "";
    const hasReachedLimit = currentItems.length >= 5;

    return (
      <div className="animal-form-block full">
        <label className="animal-form-label" htmlFor={`${fieldKey}-draft`}>
          {label}
        </label>
        <div className="animal-list-entry">
          <input
            id={`${fieldKey}-draft`}
            type="text"
            value={draftValue}
            placeholder={placeholder}
            onChange={(event) => handleListDraftChange(fieldKey, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addListItem(fieldKey, setter);
              }
            }}
            disabled={hasReachedLimit}
            required={isRequired && currentItems.length === 0}
          />
          <button
            type="button"
            className="btn btn-primary btn-small animal-add-chip-button"
            onClick={() => addListItem(fieldKey, setter)}
            disabled={hasReachedLimit}
          >
            + Anadir
          </button>
        </div>
        {currentItems.length > 0 ? (
          <div className="animal-chip-list">
            {currentItems.map((item, index) => (
              <button
                key={`${fieldKey}-${item}-${index}`}
                type="button"
                className="animal-edit-chip"
                onClick={() => removeListItem(fieldKey, item, setter)}
              >
                <span>{item}</span>
                <span className="animal-edit-chip-remove" aria-hidden="true">
                  x
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <span className="animal-list-hint">
          {hasReachedLimit ? "Maximo 5 items." : "Puedes anadir hasta 5 items."}
        </span>
      </div>
    );
  };

  function buildFinancialDetailFields(item) {
    const fields = [
      renderDetailTextField(
        "Monto contable",
        hasFinancialAmount(item) ? formatMoney(item.montoTotal, item.moneda) : "Sin monto",
      ),
      renderDetailTextField(
        "Moneda",
        item.moneda || (hasFinancialAmount(item) ? "CLP" : null),
      ),
      renderDetailTextField(
        "Genera cuenta por pagar",
        item.generaCuentaPorPagar ? "Si" : "No",
      ),
      renderDetailTextField("Fecha de vencimiento de pago", item.fechaVencimientoPago),
    ];

    if (item.precio) {
      fields.push(renderDetailTextField("Precio legado", item.precio));
    }

    if (item.observacionFinanciera) {
      fields.push(
        renderDetailTextField("Observación financiera", item.observacionFinanciera),
      );
    }

    return fields.filter(Boolean);
  }

  const historyDetailView = historyDetail
    ? (() => {
        const { type, item } = historyDetail;

        switch (type) {
          case "exam":
            return {
              title: "Detalle de examen",
              content: (
                <>
                  <div className="animal-detail-grid">
                    {[
                      renderDetailTextField("Fecha de solicitud", item.fechaSolicitud),
                      renderDetailTextField("Nombre del examen", item.nombreExamen),
                      renderDetailTextField("Peso", item.peso),
                      renderDetailTextField("Temperatura", item.temperatura),
                      renderDetailTextField("Fecha de entrega", item.fechaEntregaResultado),
                      renderDetailTextField("Veterinario", item.veterinarianNombre),
                      renderDetailTextField("Clínica", item.clinicNombre),
                      renderDetailTextField("Registrado por", item.userNombre),
                      ...buildFinancialDetailFields(item),
                    ]}
                  </div>
                  {renderDetailRichTextField("Motivo", item.motivo)}
                  {renderDetailRichTextField("Diagnostico", item.diagnostico)}
                  {renderDetailRichTextField("Indicaciones", item.indicaciones)}
                  {canReadExamFiles ? (
                    <div className="animal-detail-attachments">
                      <span className="animal-meta-label">Archivos adjuntos</span>
                      <AttachmentList
                        files={examFiles}
                        loading={examFilesLoading}
                        error={examFilesError}
                        emptyMessage="No hay archivos adjuntos en este examen."
                        showVisibility={false}
                        allowDownload
                        allowDelete={canDeleteExamFiles}
                        allowMarkMain={false}
                        onRefresh={() => loadExamFiles(item.id)}
                      />
                    </div>
                  ) : null}
                </>
              ),
            };
          case "hospitalization":
            return {
              title: "Detalle de hospitalizacion",
              content: (
                <>
                  <div className="animal-detail-grid">
                    {[
                      renderDetailTextField("Fecha de ingreso", item.fechaIngreso),
                      renderDetailTextField("Fecha de alta", item.fechaAlta),
                      renderDetailTextField("Peso de ingreso", item.pesoIngreso),
                      renderDetailTextField("Temperatura de ingreso", item.temperaturaIngreso),
                      renderDetailTextField(
                        "Fecha de control post alta",
                        item.fechaControlPostAlta,
                      ),
                      renderDetailTextField("Veterinario", item.veterinarianNombre),
                      renderDetailTextField("Clínica", item.clinicNombre),
                      renderDetailTextField("Registrado por", item.userNombre),
                      ...buildFinancialDetailFields(item),
                    ]}
                  </div>
                  {renderDetailRichTextField("Motivo", item.motivo)}
                  {renderDetailRichTextField("Diagnostico", item.diagnostico)}
                  {renderDetailRichTextField("Pronostico", item.pronostico)}
                  {renderDetailRichTextField(
                    "Farmacos recetados",
                    item.farmacosRecetados,
                  )}
                  {renderDetailRichTextField(
                    "Exámenes realizados",
                    item.examenesRealizados,
                  )}
                  {renderDetailRichTextField(
                    "Indicaciones en hospital",
                    item.indicacionesHospital,
                  )}
                  {renderDetailRichTextField("Indicaciones en casa", item.indicacionesCasa)}
                  {canReadClinicalFiles
                    ? renderClinicalAttachmentList({
                        files: hospitalizationFiles,
                        loading: hospitalizationFilesLoading,
                        error: hospitalizationFilesError,
                        emptyMessage: "No hay archivos adjuntos en esta hospitalizacion.",
                        allowDelete: canDeleteClinicalFiles,
                        onRefresh: () => loadHospitalizationFiles(item.id),
                      })
                    : null}
                </>
              ),
            };
          case "procedure":
            return {
              title: "Detalle de procedimiento",
              content: (
                <>
                  <div className="animal-detail-grid">
                    {[
                      renderDetailTextField("Fecha del procedimiento", item.fechaProcedimiento),
                      renderDetailTextField("Tipo", item.tipo),
                      renderDetailTextField("Veterinario", item.veterinarianNombre),
                      renderDetailTextField("Clínica", item.clinicNombre),
                      renderDetailTextField("Registrado por", item.userNombre),
                      ...buildFinancialDetailFields(item),
                    ]}
                  </div>
                  {renderDetailRichTextField("Motivo", item.motivo)}
                  {renderDetailRichTextField("Observaciones", item.observaciones)}
                  {renderDetailRichTextField(
                    "Farmacos recetados",
                    item.farmacosRecetados,
                  )}
                  {renderDetailRichTextField("Indicaciones", item.indicaciones)}
                  {canReadClinicalFiles
                    ? renderClinicalAttachmentList({
                        files: procedureFiles,
                        loading: procedureFilesLoading,
                        error: procedureFilesError,
                        emptyMessage: "No hay archivos adjuntos en este procedimiento.",
                        allowDelete: canDeleteClinicalFiles,
                        onRefresh: () => loadProcedureFiles(item.id),
                      })
                    : null}
                </>
              ),
            };
          case "vet_checkup":
            return {
              title: "Detalle de control veterinario",
              content: (
                <>
                  <div className="animal-detail-grid">
                    {[
                      renderDetailTextField("Número de control", item.numeroControl),
                      renderDetailTextField("Fecha", item.fecha),
                      renderDetailTextField("Peso", item.peso),
                      renderDetailTextField("Temperatura", item.temperatura),
                      renderDetailTextField("Fecha de próximo control", item.fechaProximoControl),
                      renderDetailTextField("Veterinario", item.veterinarianNombre),
                      renderDetailTextField("Clínica", item.clinicNombre),
                      renderDetailTextField("Registrado por", item.userNombre),
                      ...buildFinancialDetailFields(item),
                    ]}
                  </div>
                  {renderDetailRichTextField("Motivo", item.motivo)}
                  {renderDetailRichTextField("Diagnostico", item.diagnostico)}
                  {renderDetailRichTextField("Observaciones", item.observaciones)}
                  {renderDetailRichTextField("Indicaciones en casa", item.indicacionesCasa)}
                  {renderDetailRichTextField(
                    "Indicaciones de exámenes",
                    item.indicacionesExamenes,
                  )}
                  {renderDetailRichTextField(
                    "Indicaciones de procedimiento",
                    item.indicacionesProcedimiento,
                  )}
                  {canReadClinicalFiles
                    ? renderClinicalAttachmentList({
                        files: checkupFiles,
                        loading: checkupFilesLoading,
                        error: checkupFilesError,
                        emptyMessage: "No hay archivos adjuntos en este control veterinario.",
                        allowDelete: canDeleteClinicalFiles,
                        onRefresh: () => loadCheckupFiles(item.id),
                      })
                    : null}
                </>
              ),
            };
          default:
            return null;
        }
      })()
    : null;

  const headerContent = animalLoading ? (
    <div className="animal-header-card">Cargando animal...</div>
  ) : animalError ? (
    <div className="animal-header-card">{animalError}</div>
  ) : animal ? (
    (() => {
      const arrivalDate =
        animal.fechaLlegadaFundacion || currentIntake?.fechaEntrega || "";
      const summaryFields = [
        { label: "Sexo", value: formatReadableValue(animal.sexo) },
        { label: "Salud", value: formatReadableValue(animal.estadoSalud) },
        { label: "Adopción", value: formatReadableValue(animal.estadoAdopcion) },
        { label: "Region", value: formatReadableValue(animal.region) },
        { label: "Edad", value: animalAge?.value || "Sin registro" },
        {
          label: "Llegada a la fundacion",
          value: formatSummaryDate(arrivalDate),
        },
      ];

      return (
        <div className="animal-summary-card detail-header-accent">
          <div className="animal-summary-media" aria-hidden="true">
            <div className="animal-summary-photo">
              {headerImageUrl ? (
                <img src={headerImageUrl} alt={`Foto principal de ${animal.nombre || "animal"}`} />
              ) : (
                <span className="animal-summary-photo-placeholder">{animalInitial}</span>
              )}
            </div>
            {headerImageError ? <small className="animal-summary-photo-note">{headerImageError}</small> : null}
          </div>
          <div className="animal-summary-content">
            <div className="animal-summary-head">
              <div className="animal-summary-heading">
                <h2 className="animal-summary-title">{animal.nombre || "Sin nombre"}</h2>
                <p className="animal-summary-species">
                  {formatReadableValue(animal.especie)}
                </p>
                {animal.proximoControl ? (
                  <span className="animal-chip">
                    Próximo control: {formatSummaryDate(animal.proximoControl)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="animal-summary-grid">
              {summaryFields.map((field) => (
                <div key={field.label} className="animal-summary-item">
                  <span className="animal-summary-item-label">{field.label}</span>
                  <span className="animal-summary-item-value">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    })()
  ) : null;

  return (
    <section className="main-content animals-detail">
      <PageBreadcrumb moduleLabel="Rescatados" moduleTo="/rescatados" currentLabel="Detalle" />

      {headerContent}

      <HomeTabs tabs={MAIN_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "perfil" ? (
        <section className="animal-section">
          {!profileTabAllowed ? (
            <div className="crud-card">
              <p className="animal-muted">
                No tienes permisos para ver las secciones de perfil de este animal.
              </p>
            </div>
          ) : null}

          {canReadProfile ? (
          <div className="crud-card animal-profile-card">
            <div className="crud-header">
              <div>
                <h3>Perfil</h3>
                <p className="animal-muted">Resumen del perfil del animal.</p>
              </div>
              <div className="animal-card-actions">
                {canManageProfile ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openProfileModal(currentProfile)}
                  >
                    {currentProfile ? "Editar perfil" : "Crear perfil"}
                  </button>
                ) : null}
              </div>
            </div>
            {currentProfile ? (
              <div className="animal-profile-content">
                <div className="animal-profile-block">
                  <span className="animal-meta-label">Personalidad</span>
                  <span className="animal-meta-value">{formatValue(currentProfile.personalidad)}</span>
                </div>
                <div className="animal-profile-block">
                  <span className="animal-meta-label">Historia</span>
                  {renderRichTextValue(currentProfile.historia, "Sin historia registrada")}
                </div>
                <div className="animal-profile-lists">
                  <div>
                    <span className="animal-meta-label">Gustos</span>
                    {renderBulletList(formatList(currentProfile.gustos), "Sin gustos registrados")}
                  </div>
                  <div>
                    <span className="animal-meta-label">Disgustos</span>
                    {renderBulletList(formatList(currentProfile.disgustos), "Sin disgustos registrados")}
                  </div>
                  <div>
                    <span className="animal-meta-label">Cuidados especiales</span>
                    {renderBulletList(formatList(currentProfile.cuidadosEspeciales), "Sin cuidados especiales")}
                  </div>
                </div>
              </div>
            ) : (
              <p className="animal-muted">No hay perfil creado.</p>
            )}
          </div>
          ) : null}

          {canReadIntake ? (
          <div className="crud-card animal-intake-card">
            <div className="crud-header">
              <div>
                <h3>Ficha de ingreso</h3>
                <p className="animal-muted">Datos base del ingreso a la fundacion.</p>
              </div>
              <div className="animal-card-actions">
                {canManageIntake ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openIntakeModal(currentIntake)}
                  >
                    {currentIntake ? "Editar ficha" : "Crear ficha"}
                  </button>
                ) : null}
              </div>
            </div>
            {currentIntake ? (
              <div>
              <div className="animal-intake-grid">
                <div>
                  <span className="animal-meta-label">Fecha de llegada a la fundacion</span>
                  <span className="animal-meta-value">{formatValue(currentIntake.fechaEntrega)}</span>
                </div>
                <div>
                  <span className="animal-meta-label">Edad estimada al ingreso</span>
                  <span className="animal-meta-value">{formatValue(currentIntake.edadEstimada)}</span>
                </div>
                <div>
                  <span className="animal-meta-label">Estado reproductivo inicial</span>
                  <span className="animal-meta-value">{formatValue(currentIntake.estadoReproduccionInicial)}</span>
                </div>
                <div>
                  <span className="animal-meta-label">Lugar de llegada</span>
                  <span className="animal-meta-value">{formatValue(currentIntake.lugarEntrega)}</span>
                </div>
                <div>
                  <span className="animal-meta-label">Nombre quien entrega</span>
                  <span className="animal-meta-value">{formatValue(currentIntake.nombreQuienEntrega)}</span>
                </div>
                
                </div>  
                  <div style={{ marginTop: "15px" }}>
                    <span className="animal-meta-label">Causa de entrega</span>
                    {renderRichTextValue(currentIntake.causaEntrega, "Sin causa de entrega registrada")}
                  </div>
                <div style={{ marginTop: "10px" }}>
                    <span className="animal-meta-label">Condiciones iniciales</span>
                    {renderRichTextValue(currentIntake.condicionesIniciales, "Sin condiciones iniciales")}
                </div>
                {canReadIntakeFiles ? (
                  <div style={{ marginTop: "14px" }}>
                    <span className="animal-meta-label">Fotos de ficha de ingreso</span>
                    <ImageGallery
                      files={intakeFiles}
                      loading={intakeFilesLoading}
                      error={intakeFilesError}
                      emptyMessage="No hay fotos asociadas a la ficha de ingreso."
                      allowDownload
                      allowDelete={canDeleteIntakeFiles}
                      allowMarkMain={false}
                      compact
                      onRefresh={() => loadIntakeFiles(currentIntake.id)}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="animal-muted">No hay ficha de ingreso registrada.</p>
            )}
          </div>
          ) : null}

          {canReadDiets ? (
          <div className="crud-card animal-diet-card">
            <div className="crud-header">
              <div>
                <h3>Dieta actual</h3>
                <p className="animal-muted">Prioriza la dieta vigente para el cuidado diario.</p>
              </div>
              <div className="animal-card-actions">
                {canManageDiets ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openDietModal(null)}
                  >
                    Crear dieta
                  </button>
                ) : null}
                {canManageDiets ? (
                  <IconButton
                    icon={Pencil}
                    label="Editar dieta"
                    variant="secondary"
                    onClick={() => openDietModal(currentDiet)}
                    disabled={!currentDiet}
                  />
                ) : null}
                {canDeleteDiets ? (
                  <IconButton
                    icon={Trash2}
                    label="Eliminar dieta"
                    variant="danger"
                    onClick={() => removeRecord(deleteAnimalDiet, currentDiet?.id, loadDiets)}
                    disabled={!currentDiet}
                  />
                ) : null}
              </div>
            </div>
            {currentDiet ? (
              <div className="animal-profile-content">
                <div className="animal-profile-block">
                  <span className="animal-meta-label">Marca alimento</span>
                  <span className="animal-meta-value">{formatValue(currentDiet.marcaAlimento)}</span>
                </div>
                <div className="animal-profile-block">
                  <span className="animal-meta-label">Horario alimentacion</span>
                  <span className="animal-meta-value">{formatValue(currentDiet.horarioAlimentacion)}</span>
                </div>
                <div className="animal-profile-block">
                  <span className="animal-meta-label">Notas</span>
                  {renderBulletList(formatList(currentDiet.notas), "Sin notas")}
                </div>
              </div>
            ) : (
              <p className="animal-muted">No hay dieta registrada.</p>
            )}
            <details className="animal-accordion">
              <summary>Historial de dietas</summary>
              {dietHistory.length === 0 ? (
                <p className="animal-muted">No hay dietas anteriores.</p>
              ) : (
                <div className="animal-history-list">
                  {dietHistory.map((diet) => (
                    <div className="animal-history-item" key={diet.id}>
                      <div>
                        <strong>{diet.marcaAlimento}</strong>
                        <p className="animal-muted">Horario: {formatValue(diet.horarioAlimentacion)}</p>
                      </div>
                      <div>{renderBulletList(formatList(diet.notas), "Sin notas")}</div>
                    </div>
                  ))}
                </div>
              )}
            </details>
          </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "historial" ? (
        <section className="animal-section">
          {!historyTabAllowed ? (
            <div className="crud-card">
              <p className="animal-muted">
                No tienes permisos para ver el historial veterinario de este animal.
              </p>
            </div>
          ) : null}

          <div className="animal-subtabs">
            {HISTORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`home-tab-button ${activeHistoryTab === tab.id ? "home-tab-button-active" : ""}`}
                onClick={() => setActiveHistoryTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeHistoryTab === "exam" ? (
            <div className="crud-card">
              {!canReadExams ? (
                <p className="animal-muted">No tienes permisos para ver exámenes.</p>
              ) : null}
              {canReadExams ? (
              <>
              <div className="crud-header">
                <h3>Exámenes</h3>
                {canManageExams ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openExamModal(null)}
                  >
                    Agregar examen
                  </button>
                ) : null}
              </div>
              {exams.length === 0 ? (
                <p className="animal-muted">No hay exámenes.</p>
              ) : (
                <>
                  <FilterSummaryBar stats={examStats} showClearButton={false} />
                  <div className="table-scroll">
                    <table className="crud-table animal-history-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Nombre del examen</th>
                          <th>Clínica</th>
                          <th>Voluntario encargado</th>
                          <th>Monto</th>
                          <th className="table-actions-header">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exams.map((exam) => (
                          <tr key={exam.id}>
                            <td>{formatValue(exam.fechaSolicitud)}</td>
                            <td className="animal-table-cell-truncate" title={exam.nombreExamen}>
                              {formatValue(exam.nombreExamen)}
                            </td>
                            <td className="animal-table-cell-truncate" title={exam.clinicNombre}>
                              {formatValue(exam.clinicNombre)}
                            </td>
                            <td className="animal-table-cell-truncate" title={exam.userNombre}>
                              {formatValue(exam.userNombre)}
                            </td>
                            <td>{formatFinancialSummary(exam)}</td>
                            <td className="table-actions-cell">
                              {renderHistoryActions(
                                "exam",
                                exam,
                                openExamModal,
                                (recordId) => removeRecord(deleteExam, recordId, loadExams),
                                { canEdit: canManageExams, canDelete: canDeleteExams },
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              </>
              ) : null}
            </div>
          ) : null}

          {activeHistoryTab === "hospitalization" ? (
            <div className="crud-card">
              {!canReadHospitalizations ? (
                <p className="animal-muted">No tienes permisos para ver hospitalizaciones.</p>
              ) : null}
              {canReadHospitalizations ? (
              <>
              <div className="crud-header">
                <h3>Hospitalizaciones</h3>
                {canManageHospitalizations ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openHospitalizationModal(null)}
                  >
                    Agregar hospitalizacion
                  </button>
                ) : null}
              </div>
              {hospitalizations.length === 0 ? (
                <p className="animal-muted">No hay hospitalizaciones.</p>
              ) : (
                <>
                <FilterSummaryBar stats={hospitalizationStats} showClearButton={false} />
                <div className="table-scroll">
                  <table className="crud-table animal-history-table">
                    <thead>
                      <tr>
                        <th>Fecha de ingreso</th>
                        <th>Control post alta</th>
                        <th>Clínica</th>
                        <th>Voluntario a cargo</th>
                        <th>Monto</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospitalizations.map((item) => (
                        <tr key={item.id}>
                          <td>{formatValue(item.fechaIngreso)}</td>
                          <td>{formatValue(item.fechaControlPostAlta)}</td>
                          <td className="animal-table-cell-truncate" title={item.clinicNombre}>
                            {formatValue(item.clinicNombre)}
                          </td>
                          <td className="animal-table-cell-truncate" title={item.userNombre}>
                            {formatValue(item.userNombre)}
                          </td>
                          <td>{formatFinancialSummary(item)}</td>
                          <td className="table-actions-cell">
                            {renderHistoryActions(
                              "hospitalization",
                              item,
                              openHospitalizationModal,
                              (recordId) =>
                                removeRecord(deleteHospitalization, recordId, loadHospitalizations),
                              {
                                canEdit: canManageHospitalizations,
                                canDelete: canDeleteHospitalizations,
                              },
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
              </>
              ) : null}
            </div>
          ) : null}

          {activeHistoryTab === "procedure" ? (
            <div className="crud-card">
              {!canReadProcedures ? (
                <p className="animal-muted">No tienes permisos para ver procedimientos.</p>
              ) : null}
              {canReadProcedures ? (
              <>
              <div className="crud-header">
                <h3>Procedimientos</h3>
                {canManageProcedures ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openProcedureModal(null)}
                  >
                    Agregar procedimiento
                  </button>
                ) : null}
              </div>
              {procedures.length === 0 ? (
                <p className="animal-muted">No hay procedimientos.</p>
              ) : (
                <>
                <FilterSummaryBar stats={procedureStats} showClearButton={false} />
                <div className="table-scroll">
                  <table className="crud-table animal-history-table">
                    <thead>
                      <tr>
                        <th>Fecha del procedimiento</th>
                        <th>Tipo</th>
                        <th>Clínica</th>
                        <th>Usuario / voluntario encargado</th>
                        <th>Monto</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procedures.map((item) => (
                        <tr key={item.id}>
                          <td>{formatValue(item.fechaProcedimiento)}</td>
                          <td className="animal-table-cell-truncate" title={item.tipo}>
                            {formatValue(item.tipo)}
                          </td>
                          <td className="animal-table-cell-truncate" title={item.clinicNombre}>
                            {formatValue(item.clinicNombre)}
                          </td>
                          <td className="animal-table-cell-truncate" title={item.userNombre}>
                            {formatValue(item.userNombre)}
                          </td>
                          <td>{formatFinancialSummary(item)}</td>
                          <td className="table-actions-cell">
                            {renderHistoryActions(
                              "procedure",
                              item,
                              openProcedureModal,
                              (recordId) => removeRecord(deleteProcedure, recordId, loadProcedures),
                              {
                                canEdit: canManageProcedures,
                                canDelete: canDeleteProcedures,
                              },
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
              </>
              ) : null}
            </div>
          ) : null}

          {activeHistoryTab === "vet_checkup" ? (
            <div className="crud-card">
              {!canReadCheckups ? (
                <p className="animal-muted">No tienes permisos para ver controles veterinarios.</p>
              ) : null}
              {canReadCheckups ? (
              <>
              <div className="crud-header">
                <h3>Controles veterinarios</h3>
                {canManageCheckups ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openCheckupModal(null)}
                  >
                    Agregar control
                  </button>
                ) : null}
              </div>
              {checkups.length === 0 ? (
                <p className="animal-muted">No hay controles.</p>
              ) : (
                <>
                <FilterSummaryBar stats={checkupStats} showClearButton={false} />
                <div className="table-scroll">
                  <table className="crud-table animal-history-table">
                    <thead>
                      <tr>
                        <th>Número de control</th>
                        <th>Fecha</th>
                        <th>Clínica</th>
                        <th>Voluntario a cargo</th>
                        <th>Monto</th>
                        <th className="table-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkups.map((item) => (
                        <tr key={item.id}>
                          <td>{formatValue(item.numeroControl)}</td>
                          <td>{formatValue(item.fecha)}</td>
                          <td className="animal-table-cell-truncate" title={item.clinicNombre}>
                            {formatValue(item.clinicNombre)}
                          </td>
                          <td className="animal-table-cell-truncate" title={item.userNombre}>
                            {formatValue(item.userNombre)}
                          </td>
                          <td>{formatFinancialSummary(item)}</td>
                          <td className="table-actions-cell">
                            {renderHistoryActions(
                              "vet_checkup",
                              item,
                              openCheckupModal,
                              (recordId) => removeRecord(deleteVetCheckup, recordId, loadCheckups),
                              {
                                canEdit: canManageCheckups,
                                canDelete: canDeleteCheckups,
                              },
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
              </>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "multimedia" ? (
        <section className="animal-section">
          {!mediaTabAllowed ? (
            <div className="crud-card">
              <p className="animal-muted">
                No tienes permisos para ver la galeria de este animal.
              </p>
            </div>
          ) : null}

          {mediaTabAllowed ? (
          <div className="crud-card animal-media-section">
            <div className="crud-header animal-media-header">
              <div>
                <h3>Galeria del animal</h3>
                <p className="animal-muted">
                  Fotos generales del animal. Desde aqui también puedes elegir la principal.
                </p>
              </div>
            </div>
            {canUploadAnimalFiles ? (
              <FileUploader
                entityType="ANIMAL"
                entityId={animalId}
                context="ANIMAL_GALLERY"
                defaultVisibility="PUBLICO"
                allowVisibility
                allowMultiple
                allowedAccept="image/jpeg,image/png,image/webp"
                buttonLabel="Subir fotos a la galeria"
                compact
                onUploaded={async () => {
                  await loadMainFiles();
                  await loadGalleryFiles();
                }}
              />
            ) : null}
            <ImageGallery
              files={galleryFiles}
              loading={galleryFilesLoading}
              error={galleryFilesError}
              emptyMessage="No hay fotos en la galeria."
              allowDelete={canDeleteAnimalFiles}
              allowMarkMain={canMarkAnimalFilesMain}
              allowDownload
              onRefresh={async () => {
                await loadMainFiles();
                await loadGalleryFiles();
              }}
            />
          </div>
          ) : null}
        </section>
      ) : null}

      {visibleSectionError ? <p className="error-text">{visibleSectionError}</p> : null}
      {actionError ? <p className="error-text">{actionError}</p> : null}
      {intakeUploadWarning ? <p className="error-text">{intakeUploadWarning}</p> : null}

      {isIntakeModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => closeModal(setIsIntakeModalOpen)}>
          <div
            className="event-modal animal-scroll-modal animal-modal-wide"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>{intakeMode === "create" ? "Crear ficha de ingreso" : "Editar ficha de ingreso"}</h3>
              <ModalCloseButton onClick={() => closeModal(setIsIntakeModalOpen)} />
            </div>
            <form className="crud-form-grid animal-scroll-form" onSubmit={submitIntake}>
              {renderModalField(
                "Fecha de llegada a la fundacion",
                <input
                  type="date"
                  value={intakeForm.fecha_entrega}
                  onChange={(event) => setIntakeForm((state) => ({ ...state, fecha_entrega: event.target.value }))}
                  required
                />,
              )}

              {renderModalField("Estado reproductivo inicial", <select
                value={intakeForm.estado_reproduccion_inicial}
                onChange={(event) => setIntakeForm((state) => ({ ...state, estado_reproduccion_inicial: event.target.value }))}
              >
                <option value="">Seleccione el estado de reproducción</option>
                {REPRODUCTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>, )}

              {renderModalField("Edad estimada al ingreso", <input
                type="text"
                placeholder="Edad estimada al ingreso (ej: 2 A y 3 M)"
                value={intakeForm.edad_estimada}
                onChange={(event) => setIntakeForm((state) => ({ ...state, edad_estimada: event.target.value }))}
              />, )}
              {renderModalField("Lugar de llegada", <input
                type="text"
                placeholder="Lugar de llegada"
                value={intakeForm.lugar_entrega}
                onChange={(event) => setIntakeForm((state) => ({ ...state, lugar_entrega: event.target.value }))}
              />, )}
              {renderModalField("Causa de entrega",   
              <RichTextEditor
                  value={intakeForm.causa_entrega}
                  onChange={(value) =>
                    setIntakeForm((state) => ({ ...state, causa_entrega: value }))
                  }
                  placeholder="Causa de entrega"
                />,
                "full animal-rich-text-field", )}
              {renderModalField(
                "Condiciones iniciales",
                <RichTextEditor
                  value={intakeForm.condiciones_iniciales}
                  onChange={(value) =>
                    setIntakeForm((state) => ({ ...state, condiciones_iniciales: value }))
                  }
                  placeholder="Condiciones iniciales del ingreso"
                />,
                "full animal-rich-text-field",
              )}
              {renderModalField("Nombre de quien entrega", <input
                type="text"
                placeholder="Nombre de quien entrega"
                value={intakeForm.nombre_quien_entrega}
                onChange={(event) => setIntakeForm((state) => ({ ...state, nombre_quien_entrega: event.target.value }))}
              />, )}
              {renderModalField(
                "Quién recibe",
                <select
                  value={intakeForm.quien_recibe_id}
                  onChange={(event) =>
                    setIntakeForm((state) => ({ ...state, quien_recibe_id: event.target.value }))
                  }
                  required={users.length > 0}
                  disabled={usersLoading || users.length === 0}
                >
                  <option value="">
                    {getSelectPlaceholder(
                      usersLoading,
                      users,
                      "No hay usuarios disponibles",
                      "Seleccione un usuario",
                    )}
                  </option>
                  {users.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {formatUserOptionLabel(user)}
                    </option>
                  ))}
                </select>,
              )}
              <div className="animal-form-block full">
                <span className="animal-form-label">Fotos de ficha de ingreso</span>
                {intakeMode === "create" ? (
                  <>
                    <p className="animal-muted">
                      Las fotos se subirán al guardar la ficha.
                    </p>
                    <FileUploader
                      allowedAccept="image/jpeg,image/png,image/webp"
                      allowMultiple
                      autoUpload={false}
                      allowVisibility={false}
                      allowMain={false}
                      buttonLabel="Seleccionar fotos"
                      compact
                      disabled={!canUploadIntakeFiles}
                      onFilesSelected={(files) => setPendingIntakeFiles(files)}
                    />
                    {pendingIntakeFiles.length > 0 ? (
                      <p className="animal-muted">
                        {pendingIntakeFiles.length} foto(s) quedarán pendientes hasta guardar la ficha.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <FileUploader
                      entityType="INTAKE_RECORD"
                      entityId={editingIntakeId}
                      context="INTAKE_RECORD_ATTACHMENT"
                      defaultVisibility="PRIVADO"
                      allowedAccept="image/jpeg,image/png,image/webp"
                      allowMultiple
                      autoUpload
                      allowVisibility={false}
                      allowMain={false}
                      buttonLabel="Subir fotos a la ficha"
                      compact
                      disabled={!canUploadIntakeFiles}
                      onUploaded={async () => {
                        await loadIntakeFiles(editingIntakeId);
                      }}
                    />
                    <ImageGallery
                      files={intakeFiles}
                      loading={intakeFilesLoading}
                      error={intakeFilesError}
                      emptyMessage="No hay fotos asociadas a la ficha de ingreso."
                      allowDownload
                      allowDelete={canDeleteIntakeFiles}
                      allowMarkMain={false}
                      compact
                      onRefresh={() => loadIntakeFiles(editingIntakeId)}
                    />
                  </>
                )}
              </div>
              {intakeUploadWarning ? <p className="error-text">{intakeUploadWarning}</p> : null}
              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeModal(setIsIntakeModalOpen)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || usersLoading || users.length === 0}
                >
                  {isSubmitting ? "Guardando..." : intakeMode === "create" ? "Crear" : "Actualizar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isProfileModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => closeModal(setIsProfileModalOpen)}>
          <div
            className="event-modal animal-scroll-modal animal-profile-modal animal-modal-wide"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>{profileMode === "create" ? "Crear perfil" : "Editar perfil"}</h3>
              <ModalCloseButton onClick={() => closeModal(setIsProfileModalOpen)} />
            </div>
            <form className="crud-form-grid animal-scroll-form" onSubmit={submitProfile}>
              {renderModalField(
                "Personalidad",
                <input
                  type="text"
                  placeholder="Describe su personalidad"
                  value={profileForm.personalidad}
                  onChange={(event) => setProfileForm((state) => ({ ...state, personalidad: event.target.value }))}
                  required
                />,
              )}
              {renderModalField(
                "Historia",
                <RichTextEditor
                  value={profileForm.historia}
                  onChange={(value) => setProfileForm((state) => ({ ...state, historia: value }))}
                  placeholder="Historia del animal"
                />,
                "full animal-rich-text-field",
              )}
              {renderListEditor(
                "Gustos",
                "gustos",
                profileForm.gustos,
                setProfileForm,
                "Ej: Le gusta jugar",
                true
              )}
              {renderListEditor(
                "Disgustos",
                "disgustos",
                profileForm.disgustos,
                setProfileForm,
                "Ej: No le gusta el ruido",
                true
              )}
              {renderListEditor(
                "Cuidados especiales",
                "cuidados_especiales",
                profileForm.cuidados_especiales,
                setProfileForm,
                "Ej: Dieta especial",
                true
              )}
              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeModal(setIsProfileModalOpen)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : profileMode === "create" ? "Crear" : "Actualizar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isDietModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => closeModal(setIsDietModalOpen)}>
          <div className="event-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <h3>{dietMode === "create" ? "Crear dieta" : "Editar dieta"}</h3>
              <ModalCloseButton onClick={() => closeModal(setIsDietModalOpen)} />
            </div>
            <form className="crud-form-grid" onSubmit={submitDiet}>
              {renderModalField(
                "Marca de alimento",
                <input
                  type="text"
                  placeholder="Ej: Fit Formula"
                  value={dietForm.marca_alimento}
                  onChange={(event) => setDietForm((state) => ({ ...state, marca_alimento: event.target.value }))}
                  required
                />,
              )}
              {renderModalField(
                "Horario de alimentacion",
                <input
                  type="text"
                  placeholder="Ej: 08:00 y 19:00"
                  value={dietForm.horario_alimentacion}
                  onChange={(event) => setDietForm((state) => ({ ...state, horario_alimentacion: event.target.value }))}
                  required
                />,
              )}
              {renderListEditor(
                "Notas",
                "notas",
                dietForm.notas,
                setDietForm,
                "Ej: Sin sal",
                false
              )}
              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => closeModal(setIsDietModalOpen)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : dietMode === "create" ? "Crear" : "Actualizar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {historyDetailView ? (
        <div className="modal-overlay" role="presentation" onClick={closeHistoryDetail}>
          <div
            className="event-modal animal-scroll-modal animal-modal-wide animal-detail-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>{historyDetailView.title}</h3>
              <ModalCloseButton onClick={closeHistoryDetail} />
            </div>
            <div className="animal-detail-content">
              {historyDetailView.content}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

