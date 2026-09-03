import api from "../api/axios.js";
import { buildPublicRequestConfig } from "../utils/publicSite.js";
import {
  getPublicSponsorshipErrorMessage,
  normalizePublicSponsorshipAnimalDetail,
  normalizePublicSponsorshipAnimalsPayload,
  normalizePublicSponsorshipPlansPayload,
  normalizePublicSponsorshipStatusResponse,
} from "../utils/publicSponsorship.js";

const PUBLIC_SPONSORSHIP_ANIMALS_PATH = "/public/sponsorship/animals";
const PUBLIC_SPONSORSHIP_PLANS_PATH = "/public/sponsorship/plans";
const PUBLIC_SPONSORSHIP_START_PATH = "/public/sponsorships/start";
const PUBLIC_SPONSORSHIP_STATUS_PATH = "/public/sponsorships";

function buildSafeError(error, fallbackMessage) {
  return new Error(getPublicSponsorshipErrorMessage(error, fallbackMessage));
}

function sanitizeListParams(params = {}) {
  const cleanParams = {};
  const normalizedSearch = typeof params.search === "string" ? params.search.trim() : "";
  const normalizedPage = Number(params.page);
  const normalizedLimit = Number(params.limit);

  if (normalizedSearch) {
    cleanParams.search = normalizedSearch;
  }

  if (Number.isInteger(normalizedPage) && normalizedPage > 0) {
    cleanParams.page = normalizedPage;
  }

  if (Number.isInteger(normalizedLimit) && normalizedLimit > 0) {
    cleanParams.limit = normalizedLimit;
  }

  return cleanParams;
}

export async function getPublicSponsorshipAnimals(params = {}) {
  try {
    const response = await api.get(
      PUBLIC_SPONSORSHIP_ANIMALS_PATH,
      buildPublicRequestConfig({
        params: sanitizeListParams(params),
      }),
    );

    return normalizePublicSponsorshipAnimalsPayload(response?.data?.data || {}, params.limit || 9);
  } catch (error) {
    throw buildSafeError(error, "No fue posible cargar los animales disponibles para apadrinamiento.");
  }
}

export async function getPublicSponsorshipAnimal(animalId) {
  try {
    const response = await api.get(
      `${PUBLIC_SPONSORSHIP_ANIMALS_PATH}/${encodeURIComponent(animalId)}`,
      buildPublicRequestConfig(),
    );

    return normalizePublicSponsorshipAnimalDetail(response?.data?.data || {});
  } catch (error) {
    throw buildSafeError(error, "No fue posible cargar el detalle del animal.");
  }
}

export async function getPublicSponsorshipPlans() {
  try {
    const response = await api.get(
      PUBLIC_SPONSORSHIP_PLANS_PATH,
      buildPublicRequestConfig(),
    );

    return normalizePublicSponsorshipPlansPayload(response?.data?.data || []);
  } catch (error) {
    throw buildSafeError(error, "No fue posible cargar los planes de apadrinamiento.");
  }
}

export async function startPublicSponsorship(payload, { idempotencyKey } = {}) {
  try {
    const response = await api.post(
      PUBLIC_SPONSORSHIP_START_PATH,
      {
        animal_id: Number(payload?.animal_id),
        plan_id: Number(payload?.plan_id),
        nombre: typeof payload?.nombre === "string" ? payload.nombre.trim() : "",
        apellido: typeof payload?.apellido === "string" ? payload.apellido.trim() : "",
        email: typeof payload?.email === "string" ? payload.email.trim() : "",
        telefono: typeof payload?.telefono === "string" ? payload.telefono.trim() || null : null,
        consentimiento_datos: payload?.consentimiento_datos === true,
      },
      buildPublicRequestConfig({
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      }),
    );

    return {
      public_reference: response?.data?.data?.public_reference || null,
      approval_url: response?.data?.data?.approval_url || null,
    };
  } catch (error) {
    throw buildSafeError(error, "No fue posible iniciar el apadrinamiento.");
  }
}

export async function getPublicSponsorshipStatus(publicReference) {
  try {
    const response = await api.get(
      `${PUBLIC_SPONSORSHIP_STATUS_PATH}/${encodeURIComponent(publicReference)}/status`,
      buildPublicRequestConfig(),
    );

    return normalizePublicSponsorshipStatusResponse(response?.data || {});
  } catch (error) {
    throw buildSafeError(error, "No fue posible consultar el estado del apadrinamiento.");
  }
}
