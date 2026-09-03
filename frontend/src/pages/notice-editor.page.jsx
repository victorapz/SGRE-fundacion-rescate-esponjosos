import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import IconButton from "../components/common/IconButton";
import PageBreadcrumb from "../components/PageBreadcrumb";
import NoticeEditorForm from "../components/home/notices/NoticeEditorForm";
import {
  createNotice,
  deleteNoticeCover,
  getNotice,
  getNoticeAssetPreviewBlob,
  updateNotice,
  uploadNoticeContentImage,
  uploadNoticeCover,
} from "../services/notice.service";
import { useAuth } from "../hooks/useAuth";
import {
  buildNoticeForm,
  buildNoticePayload,
  isNoticeContentEmpty,
  NOTICE_STATUS,
} from "../utils/notice-ui";
import {
  buildNoticeAdminAssetPath,
  toCanonicalNoticeHtml,
  toEditorNoticeHtml,
} from "../utils/notice-assets";
import "../styles/notice.page.css";

const NOTICE_MODULE_ROUTE = "/inicio?tab=notices";

function deriveImageAlt(fileName = "") {
  const normalized = String(fileName || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "Imagen del aviso";
}

export default function NoticeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const persistedNoticeId = id ? Number(id) : null;
  const [form, setForm] = useState(buildNoticeForm(null));
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(persistedNoticeId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [coverLabel, setCoverLabel] = useState("");
  const [coverError, setCoverError] = useState("");
  const [error, setError] = useState("");
  const draftCreationPromiseRef = useRef(null);
  const objectUrlsRef = useRef(new Set());

  const revokeObjectUrl = (url) => {
    if (url && objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  };

  const rememberObjectUrl = (url) => {
    if (url) {
      objectUrlsRef.current.add(url);
    }
    return url;
  };

  const resetObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  };

  useEffect(() => () => resetObjectUrls(), []);

  const isOwner = useMemo(() => {
    if (!notice?.user?.id || !user?.id) {
      return !persistedNoticeId;
    }

    return String(notice.user.id) === String(user.id);
  }, [notice, persistedNoticeId, user]);

  const isFormValid = form.title.trim().length > 0 && !isNoticeContentEmpty(form.description);

  const helperText = useMemo(() => {
    if (!notice?.id) {
      return "Puedes guardar como borrador o publicarlo directamente.";
    }

    if (notice.status === NOTICE_STATUS.PUBLISHED) {
      return "Las ediciones conservan la fecha actual de publicación mientras el aviso siga publicado.";
    }

    if (notice.status === NOTICE_STATUS.ARCHIVED) {
      return "Los cambios se guardaran manteniendo el aviso archivado, salvo que lo publiques.";
    }

    return "Los cambios se guardaran respetando el estado actual del aviso.";
  }, [notice]);

  const handleChange = (field, value) => {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const hydrateNoticeForEditing = useCallback(async (noticeData) => {
    const previewUrlMap = {};
    const seenAssetUuids = new Set();
    const uniqueContentImages = [];

    for (const asset of noticeData.contentImages || []) {
      if (!asset?.publicId || seenAssetUuids.has(asset.publicId)) {
        continue;
      }

      seenAssetUuids.add(asset.publicId);
      uniqueContentImages.push(asset);
    }

    const previewTasks = uniqueContentImages.map(async (asset) => {
        try {
          const blob = await getNoticeAssetPreviewBlob(asset.publicId);
          const objectUrl = rememberObjectUrl(URL.createObjectURL(blob));
          previewUrlMap[String(asset.publicId).toLowerCase()] = objectUrl;
        } catch {
          previewUrlMap[String(asset.publicId).toLowerCase()] = buildNoticeAdminAssetPath(asset.publicId);
        }
      });

    await Promise.allSettled(previewTasks);

    if (noticeData.coverAsset?.publicId) {
      try {
        const coverBlob = await getNoticeAssetPreviewBlob(noticeData.coverAsset.publicId);
        const objectUrl = rememberObjectUrl(URL.createObjectURL(coverBlob));
        setCoverPreviewUrl(objectUrl);
      } catch {
        setCoverPreviewUrl("");
      }
      setCoverLabel(noticeData.coverAsset.originalName || "Portada del aviso");
    } else {
      setCoverPreviewUrl("");
      setCoverLabel("");
    }

    setNotice(noticeData);
    setForm({
      ...buildNoticeForm(noticeData),
      description: toEditorNoticeHtml(noticeData.description, previewUrlMap),
    });
  }, []);

  useEffect(() => {
    if (!persistedNoticeId) {
      setNotice(null);
      setForm(buildNoticeForm(null));
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    async function loadNotice() {
      setIsLoading(true);
      setError("");
      setCoverError("");

      try {
        const noticeData = await getNotice(persistedNoticeId);
        if (!isMounted) return;

        resetObjectUrls();
        await hydrateNoticeForEditing(noticeData);
      } catch (requestError) {
        if (isMounted) {
          const message =
            requestError instanceof Error ? requestError.message : "No se pudo cargar el aviso";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadNotice();

    return () => {
      isMounted = false;
    };
  }, [hydrateNoticeForEditing, persistedNoticeId]);

  async function ensureDraftNotice() {
    if (notice?.id) {
      return notice;
    }

    if (draftCreationPromiseRef.current) {
      return draftCreationPromiseRef.current;
    }

    draftCreationPromiseRef.current = (async () => {
      const createdNotice = await createNotice({
        titulo: form.title.trim() || "Borrador de aviso",
        resumen: form.summary || "",
        descripcion: toCanonicalNoticeHtml(form.description || "<p></p>"),
        publico: Boolean(form.isPublic),
        estado: NOTICE_STATUS.DRAFT,
      });

      setNotice(createdNotice);
      navigate(`/aviso/${createdNotice.id}/editar`, { replace: true });
      return createdNotice;
    })();

    try {
      return await draftCreationPromiseRef.current;
    } finally {
      draftCreationPromiseRef.current = null;
    }
  }

  async function handleUploadCover(file) {
    setCoverError("");
    setIsUploadingCover(true);

    try {
      const draftNotice = await ensureDraftNotice();
      const uploadedCover = await uploadNoticeCover(draftNotice.id, file);
      const nextPreviewUrl = rememberObjectUrl(URL.createObjectURL(file));

      revokeObjectUrl(coverPreviewUrl);
      setCoverPreviewUrl(nextPreviewUrl);
      setCoverLabel(uploadedCover.originalName || file.name || "Portada del aviso");
      setNotice((currentValue) => (
        currentValue
          ? {
            ...currentValue,
            coverAsset: uploadedCover,
          }
          : currentValue
      ));
    } catch (requestError) {
      setCoverError(
        requestError instanceof Error ? requestError.message : "No se pudo cargar la portada",
      );
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleRemoveCover() {
    if (!notice?.id) {
      revokeObjectUrl(coverPreviewUrl);
      setCoverPreviewUrl("");
      setCoverLabel("");
      return;
    }

    setIsUploadingCover(true);
    setCoverError("");

    try {
      await deleteNoticeCover(notice.id);
      revokeObjectUrl(coverPreviewUrl);
      setCoverPreviewUrl("");
      setCoverLabel("");
      setNotice((currentValue) => (
        currentValue
          ? {
            ...currentValue,
            coverAsset: null,
          }
          : currentValue
      ));
    } catch (requestError) {
      setCoverError(
        requestError instanceof Error ? requestError.message : "No se pudo eliminar la portada",
      );
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleUploadImage(file) {
    const draftNotice = await ensureDraftNotice();
    const uploadedPayload = await uploadNoticeContentImage(draftNotice.id, file);
    const suggestedAlt = deriveImageAlt(file.name);
    const alt = window.prompt(
      "Describe brevemente la imagen para el texto alternativo.",
      suggestedAlt,
    )?.trim() || suggestedAlt;
    const previewUrl = rememberObjectUrl(URL.createObjectURL(file));

    setNotice((currentValue) => (
      currentValue
        ? {
          ...currentValue,
          contentImages: [...(currentValue.contentImages || []), uploadedPayload.asset],
        }
        : currentValue
    ));

    return {
      assetUuid: uploadedPayload.asset.publicId,
      src: previewUrl,
      alt,
      title: file.name || "",
      displayWidth: 100,
    };
  }

  async function handleSubmit(targetStatus) {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload = buildNoticePayload({
        ...form,
        description: toCanonicalNoticeHtml(form.description),
      }, targetStatus);

      const savedNotice = notice?.id
        ? await updateNotice(notice.id, payload)
        : await createNotice(payload);

      navigate(`/aviso/${savedNotice.id}`);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "No se pudo guardar el aviso";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <section className="main-content notice-page">
        <p className="list-message">Cargando aviso...</p>
      </section>
    );
  }

  if (persistedNoticeId && (!notice || !isOwner)) {
    return (
      <section className="main-content notice-page">
        <div className="home-empty-view">
          <PageBreadcrumb
            moduleLabel="Avisos"
            moduleTo={NOTICE_MODULE_ROUTE}
            currentLabel={persistedNoticeId ? "Editar aviso" : "Nuevo aviso"}
          />
          <h2>No puedes editar este aviso</h2>
          <p>{error || "El backend no permite editar este aviso en su estado actual."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="main-content notice-page">
      <PageBreadcrumb
        moduleLabel="Avisos"
        moduleTo={NOTICE_MODULE_ROUTE}
        currentLabel={persistedNoticeId ? "Editar aviso" : "Nuevo aviso"}
      />
      <div className="notice-page-actions">
        <div>
          <h1>{persistedNoticeId ? "Editar aviso" : "Crear aviso"}</h1>
          <p className="notice-page-copy">
            {persistedNoticeId
              ? "Actualiza el título, el resumen, el contenido, la portada y la visibilidad del aviso."
              : "Escribe un aviso nuevo y decide si guardarlo como borrador o publicarlo."}
          </p>
        </div>
        <div className="notice-page-actions-right">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(notice?.id ? `/aviso/${notice.id}` : "/inicio")}
          >
            Cancelar
          </button>
          <IconButton
            icon={Save}
            label="Guardar como borrador"
            variant="secondary"
            disabled={isSubmitting || !isFormValid}
            onClick={() => handleSubmit(NOTICE_STATUS.DRAFT)}
          />
          <button
            type="button"
            className="btn btn-create-home"
            disabled={isSubmitting || !isFormValid}
            onClick={() => handleSubmit(NOTICE_STATUS.PUBLISHED)}
          >
            Publicar aviso
          </button>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <NoticeEditorForm
        form={form}
        onChange={handleChange}
        onUploadCover={handleUploadCover}
        onRemoveCover={handleRemoveCover}
        onUploadImage={handleUploadImage}
        disabled={isSubmitting}
        helperText={helperText}
        coverPreviewUrl={coverPreviewUrl}
        coverLabel={coverLabel}
        isUploadingCover={isUploadingCover}
        coverError={coverError}
      />
    </section>
  );
}
