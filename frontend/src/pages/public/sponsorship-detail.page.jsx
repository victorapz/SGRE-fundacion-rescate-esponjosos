import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicPageState from "../../components/public/PublicPageState";
import SafeRichText from "../../components/public/SafeRichText";
import SponsorshipAnimalGallery from "../../components/public/sponsorship/SponsorshipAnimalGallery";
import SponsorshipForm from "../../components/public/sponsorship/SponsorshipForm";
import SponsorshipPlanSelector from "../../components/public/sponsorship/SponsorshipPlanSelector";
import { PUBLIC_SITE_ROUTES } from "../../config/publicSite.config";
import { usePublicPageMeta } from "../../hooks/usePublicPageMeta";
import {
  getPublicSponsorshipAnimal,
  getPublicSponsorshipPlans,
  startPublicSponsorship,
} from "../../services/public-sponsorship.service";
import {
  buildInitialSponsorshipFormState,
  getOrCreateAttemptIdempotencyKey,
  storePendingPublicSponsorship,
  validatePublicSponsorshipApprovalUrl,
  validatePublicSponsorshipForm,
} from "../../utils/publicSponsorship";

export default function PublicSponsorshipDetailPage() {
  const { animalId } = useParams();
  const [animal, setAnimal] = useState(null);
  const [globalPlans, setGlobalPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [formValues, setFormValues] = useState(buildInitialSponsorshipFormState());
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const submitGuardRef = useRef(false);
  const idempotencyKeyRef = useRef(null);

  usePublicPageMeta({
    title: animal?.nombre ? `Apadrinar a ${animal.nombre}` : "Detalle de apadrinamiento",
    description: animal?.historia || "Conoce al animal y elige un plan mensual de apadrinamiento.",
  });

  useEffect(() => {
    let active = true;

    async function loadAnimalDetail() {
      setIsLoading(true);
      setError("");

      try {
        const animalPayload = await getPublicSponsorshipAnimal(animalId);
        let plansPayload = [];

        try {
          plansPayload = await getPublicSponsorshipPlans();
        } catch {
          plansPayload = [];
        }

        if (!active) {
          return;
        }

        setAnimal(animalPayload);
        setGlobalPlans(plansPayload);
        setSelectedPlanId((current) => {
          if (current && animalPayload.planes.some((plan) => Number(plan.id) === Number(current))) {
            return current;
          }
          return animalPayload.planes[0]?.id || plansPayload[0]?.id || null;
        });
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No fue posible cargar el detalle del animal.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAnimalDetail();

    return () => {
      active = false;
    };
  }, [animalId, reloadKey]);

  const availablePlans = useMemo(() => {
    if (animal?.planes?.length) {
      return animal.planes;
    }
    return globalPlans;
  }, [animal?.planes, globalPlans]);

  const selectedPlan = useMemo(
    () => availablePlans.find((plan) => Number(plan.id) === Number(selectedPlanId)) || null,
    [availablePlans, selectedPlanId],
  );

  const handleFieldChange = (fieldName, value) => {
    setFormValues((current) => ({
      ...current,
      [fieldName]: typeof value === "string" ? value : value,
    }));
    setFormErrors((current) => ({
      ...current,
      [fieldName]: "",
    }));
    setSubmitError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitGuardRef.current || isSubmitting || !animal) {
      return;
    }

    const validation = validatePublicSponsorshipForm(formValues, selectedPlanId);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      setSubmitError("Revisa el formulario antes de continuar con PayPal.");
      return;
    }

    submitGuardRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      idempotencyKeyRef.current = getOrCreateAttemptIdempotencyKey(idempotencyKeyRef.current);

      const payload = await startPublicSponsorship(
        {
          animal_id: animal.id,
          plan_id: selectedPlanId,
          ...formValues,
        },
        {
          idempotencyKey: idempotencyKeyRef.current,
        },
      );

      const approvalUrl = validatePublicSponsorshipApprovalUrl(payload?.approval_url);

      storePendingPublicSponsorship({
        public_reference: payload?.public_reference,
        animal_id: animal.id,
        idempotency_key: idempotencyKeyRef.current,
      });

      window.location.assign(approvalUrl);
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible iniciar el apadrinamiento.",
      );
    } finally {
      setIsSubmitting(false);
      submitGuardRef.current = false;
    }
  };

  if (isLoading) {
    return (
      <PublicPageState
        variant="loading"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="Cargando detalle del animal"
        description="Estamos preparando su historia y los planes disponibles."
      />
    );
  }

  if (error || !animal?.id) {
    return (
      <PublicPageState
        variant="error"
        surface="immersive"
        eyebrow="Apadrinamiento"
        title="No pudimos cargar este animal"
        description={error || "Este animal ya no esta disponible para apadrinamiento."}
        actions={(
          <>
            <button
              type="button"
              className="public-button public-button--primary"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Reintentar
            </button>
            <Link className="public-button public-button--secondary" to={PUBLIC_SITE_ROUTES.sponsorshipList}>
              Volver al listado
            </Link>
          </>
        )}
      />
    );
  }

  return (
    <div className="public-sponsorship-detail-page">
      <div className="public-notice-detail__back">
        <Link to={PUBLIC_SITE_ROUTES.sponsorshipList} className="public-notice-card__link">
          Volver al listado de apadrinamiento
        </Link>
      </div>

      <section className="public-sponsorship-detail">
        <div className="public-sponsorship-detail__media">
          <SponsorshipAnimalGallery
            name={animal.nombre}
            mainImage={animal.imagen_principal}
            galleryImages={animal.galeria_publica}
          />
        </div>

        <div className="public-sponsorship-detail__copy">
          <p className="public-section-kicker">Apadrinamiento</p>
          <h1>{animal.nombre}</h1>
          <div className="public-sponsorship-detail__facts">
            {[animal.especie, animal.sexo, animal.edad_aproximada].filter(Boolean).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          {animal.historia ? (
            <section className="public-sponsorship-copy-card">
              <h2>Historia</h2>
              <SafeRichText className="public-sponsorship-rich-text" value={animal.historia} />
            </section>
          ) : null}

          {animal.personalidad ? (
            <section className="public-sponsorship-copy-card">
              <h2>Personalidad</h2>
              <SafeRichText className="public-sponsorship-rich-text" value={animal.personalidad} />
            </section>
          ) : null}

          {animal.gustos ? (
            <section className="public-sponsorship-copy-card">
              <h2>Lo que más disfruta</h2>
              <SafeRichText className="public-sponsorship-rich-text" value={animal.gustos} />
            </section>
          ) : null}
        </div>
      </section>

      <section className="public-glass-card public-sponsorship-cta-card">
        <div className="public-sponsorship-cta-card__header">
          <h2>Inicia tu apadrinamiento mensual</h2>
          <p>
            Selecciona un plan disponible y completa tus datos para continuar de forma segura con PayPal.
          </p>
        </div>

        {submitError ? (
          <div className="public-inline-alert" role="alert">
            {submitError}
          </div>
        ) : null}

        {availablePlans.length > 0 ? (
          <>
            <SponsorshipPlanSelector
              plans={availablePlans}
              selectedPlanId={selectedPlanId}
              onChange={(planId) => {
                setSelectedPlanId(planId);
                setFormErrors((current) => ({ ...current, plan_id: "" }));
              }}
              disabled={isSubmitting}
            />

            <SponsorshipForm
              values={formValues}
              errors={formErrors}
              selectedPlan={selectedPlan}
              disabled={isSubmitting}
              submitLabel={isSubmitting ? "Redirigiendo a PayPal..." : "Continuar con PayPal"}
              submitHelp="Tu apadrinamiento se confirmara solo después de que PayPal y el backend reporten el estado real."
              onChange={handleFieldChange}
              onSubmit={handleSubmit}
            />
          </>
        ) : (
          <div className="public-inline-alert" role="status">
            En este momento no hay planes activos para este animal. Intenta nuevamente mas tarde.
          </div>
        )}
      </section>
    </div>
  );
}
