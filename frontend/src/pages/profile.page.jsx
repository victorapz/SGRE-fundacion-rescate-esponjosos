import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import IconButton from "../components/common/IconButton";
import ModalCloseButton from "../components/common/ModalCloseButton";
import HomeTabs from "../components/home/HomeTabs";
import { useAuth } from "../hooks/useAuth";
import {
  changeMyPassword,
  getMyProfile,
  updateMyProfile,
} from "../services/auth.service";
import { getComunas } from "../services/comuna.service";
import { getRegions } from "../services/region.service";
import { PASSWORD_POLICY } from "../utils/passwordPolicy";
import { buildMyPasswordPayload } from "./profile.page.helpers";
import "../styles/home.page.css";
import "../styles/profile.page.css";

const PROFILE_TABS = [
  { id: "personal", label: "Datos personales" },
  { id: "security", label: "Seguridad" },
];

function emptyPasswordForm() {
  return {
    current_password: "",
    new_password: "",
    confirm_password: "",
  };
}

function emptyEditProfileForm() {
  return {
    nombre: "",
    apellido: "",
    email: "",
    email_confirm: "",
    telefono: "",
    location: {
      direccion: "",
      region_id: "",
      comuna_id: "",
      observaciones: "",
    },
  };
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function formatValue(value, emptyValue = "-") {
  const normalizedValue = normalizeText(value);
  return normalizedValue || emptyValue;
}

function formatListValue(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "-";
  }

  return items.map((item) => normalizeText(item)).filter(Boolean).join(", ") || "-";
}

function readFirstValue(source = {}, keys = []) {
  for (const key of keys) {
    if (source[key] !== null && source[key] !== undefined && source[key] !== "") {
      return source[key];
    }
  }

  return "";
}

function normalizeLabelItem(item) {
  if (!item) return "";
  if (typeof item === "string") return item;

  return (
    item.nombre
    || item.name
    || item.label
    || item.descripcion
    || item.clave
    || ""
  );
}

function extractLabelList(source = {}, keys = []) {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      const items = value.map(normalizeLabelItem).map(normalizeText).filter(Boolean);
      if (items.length > 0) return items;
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function extractLocation(source = {}) {
  const location = source.location || source.ubicacion || {};
  const region = location.region || source.region || {};
  const comuna = location.comuna || source.comuna || {};

  return {
    direccion: readFirstValue(location, ["direccion", "address"])
      || readFirstValue(source, ["direccion", "address"]),
    region_id: normalizeId(
      readFirstValue(location, ["region_id", "regionId", "id_region"])
      || readFirstValue(region, ["id", "id_region", "region_id", "regionId"])
      || readFirstValue(source, ["region_id", "regionId", "id_region"]),
    ),
    region_nombre: readFirstValue(region, ["nombre", "name"])
      || readFirstValue(source, ["regionNombre", "region_name", "region"]),
    comuna_id: normalizeId(
      readFirstValue(location, ["comuna_id", "comunaId", "id_comuna"])
      || readFirstValue(comuna, ["id", "id_comuna", "comuna_id", "comunaId"])
      || readFirstValue(source, ["comuna_id", "comunaId", "id_comuna"]),
    ),
    comuna_nombre: readFirstValue(comuna, ["nombre", "name"])
      || readFirstValue(source, ["comunaNombre", "comuna_name", "comuna"]),
    observaciones: readFirstValue(location, ["observaciones", "notes"])
      || readFirstValue(source, ["observacionesUbicacion", "locationObservaciones"]),
  };
}

function buildEditProfileFormFromUser(source = {}) {
  const location = extractLocation(source);

  return {
    nombre: source.nombre || source.firstName || "",
    apellido: source.apellido || source.lastName || "",
    email: source.email || "",
    email_confirm: "",
    telefono: source.telefono || source.phone || "",
    location: {
      direccion: location.direccion || "",
      region_id: location.region_id || "",
      comuna_id: location.comuna_id || "",
      observaciones: location.observaciones || "",
    },
  };
}

function buildProfileUpdatePayload(form, currentProfile = {}) {
  const currentForm = buildEditProfileFormFromUser(currentProfile);
  const payload = {
    nombre: normalizeText(form.nombre),
    apellido: normalizeText(form.apellido),
    email: normalizeText(form.email),
    telefono: normalizeText(form.telefono),
  };

  if (normalizeEmail(form.email) !== normalizeEmail(currentForm.email)) {
    payload.email_confirm = normalizeText(form.email_confirm);
  }

  const locationChanged = (
    normalizeText(form.location.direccion) !== normalizeText(currentForm.location.direccion)
    || normalizeId(form.location.region_id) !== normalizeId(currentForm.location.region_id)
    || normalizeId(form.location.comuna_id) !== normalizeId(currentForm.location.comuna_id)
    || normalizeText(form.location.observaciones)
      !== normalizeText(currentForm.location.observaciones)
  );

  if (locationChanged) {
    const locationPayload = {};

    if (normalizeText(form.location.direccion) !== normalizeText(currentForm.location.direccion)) {
      locationPayload.direccion = normalizeText(form.location.direccion);
    }

    if (normalizeId(form.location.region_id) !== normalizeId(currentForm.location.region_id)) {
      locationPayload.region_id = form.location.region_id
        ? Number(form.location.region_id)
        : null;
    }

    if (normalizeId(form.location.comuna_id) !== normalizeId(currentForm.location.comuna_id)) {
      locationPayload.comuna_id = form.location.comuna_id
        ? Number(form.location.comuna_id)
        : null;
    }

    if (
      normalizeText(form.location.observaciones)
      !== normalizeText(currentForm.location.observaciones)
    ) {
      locationPayload.observaciones = normalizeText(form.location.observaciones);
    }

    payload.location = locationPayload;
  }

  return payload;
}

function profileEditFormsEqual(form, currentProfile) {
  const currentForm = buildEditProfileFormFromUser(currentProfile);

  return (
    normalizeText(form.nombre) === normalizeText(currentForm.nombre)
    && normalizeText(form.apellido) === normalizeText(currentForm.apellido)
    && normalizeEmail(form.email) === normalizeEmail(currentForm.email)
    && normalizeText(form.telefono) === normalizeText(currentForm.telefono)
    && normalizeText(form.location.direccion) === normalizeText(currentForm.location.direccion)
    && normalizeId(form.location.region_id) === normalizeId(currentForm.location.region_id)
    && normalizeId(form.location.comuna_id) === normalizeId(currentForm.location.comuna_id)
    && normalizeText(form.location.observaciones) === normalizeText(currentForm.location.observaciones)
  );
}

function mergeCurrentOption(options, id, nombre, fallbackLabel) {
  if (!id || options.some((item) => String(item.id) === String(id))) {
    return options;
  }

  return [
    {
      id,
      nombre: nombre || fallbackLabel,
    },
    ...options,
  ];
}

export default function ProfilePage() {
  const { user, updateCurrentUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("personal");
  const [profile, setProfile] = useState(null);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm());
  const [editProfileForm, setEditProfileForm] = useState(emptyEditProfileForm());
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState("");
  const [comunas, setComunas] = useState([]);
  const [comunasLoading, setComunasLoading] = useState(false);
  const [comunasError, setComunasError] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setProfileError("");

    try {
      const nextProfile = await getMyProfile();
      setProfile(nextProfile);
      setEditProfileForm(buildEditProfileFormFromUser(nextProfile));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "No se pudo cargar tu perfil.");
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.id]);

  const loadRegions = useCallback(async () => {
    setRegionsLoading(true);
    setRegionsError("");

    try {
      const data = await getRegions({ active: true });
      setRegions(Array.isArray(data) ? data : []);
    } catch (error) {
      setRegionsError(error instanceof Error ? error.message : "No se pudieron cargar las regiones.");
    } finally {
      setRegionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isEditProfileModalOpen) {
      return;
    }

    if (regions.length === 0 && !regionsLoading) {
      void loadRegions();
    }
  }, [isEditProfileModalOpen, loadRegions, regions.length, regionsLoading]);

  useEffect(() => {
    if (!isEditProfileModalOpen) {
      return;
    }

    const regionId = editProfileForm.location.region_id;

    if (!regionId) {
      setComunas([]);
      setComunasError("");
      return;
    }

    let cancelled = false;
    setComunasLoading(true);
    setComunasError("");

    getComunas({ region_id: Number(regionId), activo: true })
      .then((items) => {
        if (cancelled) return;
        setComunas(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        if (cancelled) return;
        setComunas([]);
        setComunasError(error instanceof Error ? error.message : "No se pudieron cargar las comunas.");
      })
      .finally(() => {
        if (cancelled) return;
        setComunasLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editProfileForm.location.region_id, isEditProfileModalOpen]);

  const normalizedCurrentProfile = useMemo(
    () => profile || user || {},
    [profile, user],
  );

  const profileLocation = useMemo(
    () => extractLocation(normalizedCurrentProfile),
    [normalizedCurrentProfile],
  );

  const profileAreas = useMemo(
    () => extractLabelList(normalizedCurrentProfile, ["areaNames", "areas", "areasDetailed", "area"]),
    [normalizedCurrentProfile],
  );

  const profileRoles = useMemo(
    () => extractLabelList(normalizedCurrentProfile, ["roles", "roleNames", "rolesDetailed", "rol", "role"]),
    [normalizedCurrentProfile],
  );

  const editProfileUnchanged = useMemo(
    () => profileEditFormsEqual(editProfileForm, normalizedCurrentProfile),
    [editProfileForm, normalizedCurrentProfile],
  );

  const editProfileEmailChanged = useMemo(
    () => normalizeEmail(editProfileForm.email)
      !== normalizeEmail(normalizedCurrentProfile.email),
    [editProfileForm.email, normalizedCurrentProfile.email],
  );

  const regionOptions = useMemo(
    () => mergeCurrentOption(
      regions,
      profileLocation.region_id,
      profileLocation.region_nombre,
      "Región actual",
    ),
    [profileLocation.region_id, profileLocation.region_nombre, regions],
  );

  const comunaOptions = useMemo(
    () => mergeCurrentOption(
      comunas,
      profileLocation.comuna_id,
      profileLocation.comuna_nombre,
      "Comuna actual",
    ),
    [comunas, profileLocation.comuna_id, profileLocation.comuna_nombre],
  );

  const handleEditProfileFieldChange = (field, value) => {
    setProfileError("");
    setProfileSuccess("");
    setEditProfileForm((current) => {
      if (field !== "email") {
        return {
          ...current,
          [field]: value,
        };
      }

      const nextEmailMatchesCurrent = normalizeEmail(value)
        === normalizeEmail(normalizedCurrentProfile.email);

      return {
        ...current,
        email: value,
        email_confirm: nextEmailMatchesCurrent ? "" : current.email_confirm,
      };
    });
  };

  const handleEditLocationFieldChange = (field, value) => {
    setProfileError("");
    setProfileSuccess("");
    setEditProfileForm((current) => ({
      ...current,
      location: {
        ...current.location,
        [field]: value,
        ...(field === "region_id" ? { comuna_id: "" } : {}),
      },
    }));
  };

  const handlePasswordFieldChange = (field, value) => {
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const openEditProfileModal = () => {
    setProfileError("");
    setProfileSuccess("");
    setEditProfileForm(buildEditProfileFormFromUser(normalizedCurrentProfile));
    setIsEditProfileModalOpen(true);
  };

  const closeEditProfileModal = () => {
    if (savingProfile) return;
    setProfileError("");
    setEditProfileForm(buildEditProfileFormFromUser(normalizedCurrentProfile));
    setIsEditProfileModalOpen(false);
  };

  const handleSubmitProfile = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (editProfileUnchanged) {
      setProfileSuccess("No hubo cambios para guardar.");
      setIsEditProfileModalOpen(false);
      return;
    }

    if (editProfileEmailChanged && !normalizeEmail(editProfileForm.email_confirm)) {
      setProfileError("Debes confirmar el correo electrónico.");
      return;
    }

    if (
      editProfileEmailChanged
      && normalizeEmail(editProfileForm.email) !== normalizeEmail(editProfileForm.email_confirm)
    ) {
      setProfileError("El correo electrónico y su confirmación no coinciden.");
      return;
    }

    setSavingProfile(true);

    try {
      const payload = buildProfileUpdatePayload(editProfileForm, normalizedCurrentProfile);
      const updatedProfile = await updateMyProfile(payload);
      let nextProfile = updatedProfile;

      try {
        nextProfile = await getMyProfile();
      } catch {
        nextProfile = updatedProfile;
      }

      setProfile(nextProfile);
      setEditProfileForm(buildEditProfileFormFromUser(nextProfile));
      updateCurrentUserProfile(nextProfile);
      setProfileSuccess("Tus datos fueron actualizados correctamente.");
      setIsEditProfileModalOpen(false);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "No se pudo actualizar tu perfil.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitPassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (
      !passwordForm.current_password
      || !passwordForm.new_password
      || !passwordForm.confirm_password
    ) {
      setPasswordError("Debes completar los tres campos de seguridad.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setSavingPassword(true);

    try {
      await changeMyPassword(buildMyPasswordPayload(passwordForm));
      setPasswordForm(emptyPasswordForm());
      setPasswordSuccess("La contraseña fue actualizada correctamente.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "No se pudo actualizar tu contraseña.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const renderProfileDataItem = (label, value) => (
    <div className="profile-data-item">
      <span className="profile-data-label">{label}</span>
      <span className="profile-data-value">{formatValue(value)}</span>
    </div>
  );

  const renderPersonalDataTab = () => (
    <section className="crud-card profile-card-block profile-tab-panel">
      <div className="profile-section-header">
        <div>
          <h2>Datos personales</h2>
          <p>Consulta tus datos registrados y actualizalos desde el modal de edición.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openEditProfileModal}>
          Editar datos
        </button>
      </div>

      {profileSuccess ? <p className="profile-success">{profileSuccess}</p> : null}
      {profileError && !isEditProfileModalOpen ? (
        <p className="error-text" role="alert">{profileError}</p>
      ) : null}

      <div className="profile-data-grid">
        {renderProfileDataItem("Nombre", normalizedCurrentProfile.nombre)}
        {renderProfileDataItem("Apellido", normalizedCurrentProfile.apellido)}
        {renderProfileDataItem("correo electrónico", normalizedCurrentProfile.email)}
        {renderProfileDataItem("Teléfono", normalizedCurrentProfile.telefono)}
        {renderProfileDataItem("Areas", formatListValue(profileAreas))}
        {renderProfileDataItem("Roles", formatListValue(profileRoles))}
        {renderProfileDataItem("Dirección", profileLocation.direccion)}
        {renderProfileDataItem(
          "Región / comuna",
          [profileLocation.region_nombre, profileLocation.comuna_nombre]
            .map(normalizeText)
            .filter(Boolean)
            .join(" / "),
        )}
        {profileLocation.observaciones
          ? renderProfileDataItem("Observaciones de ubicación", profileLocation.observaciones)
          : null}
      </div>
    </section>
  );

  const renderSecurityTab = () => (
    <section className="crud-card profile-card-block profile-tab-panel">
      <div className="profile-section-header">
        <div>
          <h2>Seguridad</h2>
          <p>Cambia tu contraseña actual. {PASSWORD_POLICY.hint}</p>
        </div>
      </div>

      <form className="profile-form-grid" onSubmit={handleSubmitPassword}>
        <label className="full">
          <span>Contraseña actual</span>
          <div className="profile-password-input">
            <input
              type={showPasswords.current ? "text" : "password"}
              value={passwordForm.current_password}
              onChange={(event) =>
                handlePasswordFieldChange("current_password", event.target.value)
              }
              autoComplete="current-password"
              required
            />
            <IconButton
              icon={showPasswords.current ? EyeOff : Eye}
              label={
                showPasswords.current
                  ? "Ocultar contraseña actual"
                  : "Mostrar contraseña actual"
              }
              variant="secondary"
              type="button"
              className="profile-password-toggle"
              onClick={() => togglePasswordVisibility("current")}
            />
          </div>
        </label>

        <label>
          <span>Nueva contraseña</span>
          <div className="profile-password-input">
            <input
              type={showPasswords.next ? "text" : "password"}
              value={passwordForm.new_password}
              onChange={(event) =>
                handlePasswordFieldChange("new_password", event.target.value)
              }
              autoComplete="new-password"
              required
            />
            <IconButton
              icon={showPasswords.next ? EyeOff : Eye}
              label={showPasswords.next ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
              variant="secondary"
              type="button"
              className="profile-password-toggle"
              onClick={() => togglePasswordVisibility("next")}
            />
          </div>
        </label>

        <label>
          <span>Confirmar nueva contraseña</span>
          <div className="profile-password-input">
            <input
              type={showPasswords.confirm ? "text" : "password"}
              value={passwordForm.confirm_password}
              onChange={(event) =>
                handlePasswordFieldChange("confirm_password", event.target.value)
              }
              autoComplete="new-password"
              required
            />
            <IconButton
              icon={showPasswords.confirm ? EyeOff : Eye}
              label={
                showPasswords.confirm
                  ? "Ocultar confirmación de contraseña"
                  : "Mostrar confirmación de contraseña"
              }
              variant="secondary"
              type="button"
              className="profile-password-toggle"
              onClick={() => togglePasswordVisibility("confirm")}
            />
          </div>
        </label>

        <small className="profile-help-text full">{PASSWORD_POLICY.hint}</small>
        {passwordError ? <p className="error-text full" role="alert">{passwordError}</p> : null}
        {passwordSuccess ? <p className="profile-success full">{passwordSuccess}</p> : null}

        <div className="profile-actions full">
          <button type="submit" className="btn btn-primary" disabled={savingPassword}>
            {savingPassword ? "Actualizando..." : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <section className="main-content home-content profile-page">
      <header className="main-header profile-main-header">
        <h1>Mi Perfil</h1>
        <p>Administra tus datos personales y la seguridad de tu cuenta.</p>
      </header>

      {loadingProfile ? (
        <section className="crud-card profile-card-block">
          <p className="list-message">Cargando tu perfil...</p>
        </section>
      ) : null}

      {!loadingProfile && profileError && !profile ? (
        <section className="crud-card profile-card-block">
          <p className="error-text" role="alert">{profileError}</p>
        </section>
      ) : null}

      {!loadingProfile && profile ? (
        <>
          <HomeTabs tabs={PROFILE_TABS} activeTab={activeTab} onChange={setActiveTab} />

          <div className="profile-tab-content">
            {activeTab === "personal" ? renderPersonalDataTab() : renderSecurityTab()}
          </div>
        </>
      ) : null}

      {isEditProfileModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeEditProfileModal}>
          <div
            className="event-modal profile-edit-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>Editar datos personales</h3>
              <ModalCloseButton onClick={closeEditProfileModal} />
            </div>

            <form className="crud-form-grid profile-edit-form" onSubmit={handleSubmitProfile}>
              <label>
                <span>Nombre</span>
                <input
                  type="text"
                  value={editProfileForm.nombre}
                  onChange={(event) => handleEditProfileFieldChange("nombre", event.target.value)}
                  required
                />
              </label>

              <label>
                <span>Apellido</span>
                <input
                  type="text"
                  value={editProfileForm.apellido}
                  onChange={(event) => handleEditProfileFieldChange("apellido", event.target.value)}
                  required
                />
              </label>

              <label>
                <span>correo electrónico</span>
                <input
                  type="email"
                  value={editProfileForm.email}
                  onChange={(event) => handleEditProfileFieldChange("email", event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              {editProfileEmailChanged ? (
                <label>
                  <span>Confirmar correo electrónico</span>
                  <input
                    type="email"
                    value={editProfileForm.email_confirm}
                    onChange={(event) =>
                      handleEditProfileFieldChange("email_confirm", event.target.value)
                    }
                    autoComplete="off"
                    placeholder="Repite el nuevo correo electrónico"
                    required
                  />
                  <small className="profile-help-text">
                    Este campo aparece solo porque estas cambiando el correo.
                  </small>
                </label>
              ) : null}

              <label>
                <span>Teléfono</span>
                <input
                  type="text"
                  value={editProfileForm.telefono}
                  onChange={(event) => handleEditProfileFieldChange("telefono", event.target.value)}
                  autoComplete="tel"
                  required
                />
              </label>

              <div className="profile-modal-section full">
                <div className="profile-modal-section-header">
                  <h4>Ubicación</h4>
                  <p>Edita la dirección asociada a tu perfil.</p>
                </div>

                <div className="profile-location-grid">
                  <label>
                    <span>Región</span>
                    <select
                      value={editProfileForm.location.region_id}
                      onChange={(event) =>
                        handleEditLocationFieldChange("region_id", event.target.value)
                      }
                      disabled={regionsLoading || regionOptions.length === 0}
                    >
                      <option value="">
                        {regionsLoading
                          ? "Cargando regiones..."
                          : regionOptions.length === 0
                            ? "No hay regiones disponibles"
                            : "Selecciona region"}
                      </option>
                      {regionOptions.map((region) => (
                        <option key={region.id} value={String(region.id)}>
                          {region.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Comuna</span>
                    <select
                      value={editProfileForm.location.comuna_id}
                      onChange={(event) =>
                        handleEditLocationFieldChange("comuna_id", event.target.value)
                      }
                      disabled={
                        !editProfileForm.location.region_id
                        || comunasLoading
                        || comunaOptions.length === 0
                      }
                    >
                      <option value="">
                        {comunasLoading
                          ? "Cargando comunas..."
                          : !editProfileForm.location.region_id
                            ? "Selecciona region primero"
                            : comunaOptions.length === 0
                              ? "No hay comunas disponibles"
                              : "Selecciona comuna"}
                      </option>
                      {comunaOptions.map((comuna) => (
                        <option key={comuna.id} value={String(comuna.id)}>
                          {comuna.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="full">
                    <span>Dirección</span>
                    <input
                      type="text"
                      value={editProfileForm.location.direccion}
                      onChange={(event) =>
                        handleEditLocationFieldChange("direccion", event.target.value)
                      }
                      placeholder="Calle, número, casa o departamento"
                      autoComplete="street-address"
                    />
                  </label>

                  <label className="full">
                    <span>Observaciones de ubicación</span>
                    <textarea
                      rows="3"
                      value={editProfileForm.location.observaciones}
                      onChange={(event) =>
                        handleEditLocationFieldChange("observaciones", event.target.value)
                      }
                    />
                  </label>
                </div>
              </div>

              {regionsError ? <p className="error-text full">{regionsError}</p> : null}
              {comunasError ? <p className="error-text full">{comunasError}</p> : null}
              {profileError ? <p className="error-text full" role="alert">{profileError}</p> : null}

              <div className="event-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeEditProfileModal}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProfile || editProfileUnchanged}
                >
                  {savingProfile ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
