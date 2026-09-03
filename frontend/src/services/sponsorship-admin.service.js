import api from "../api/axios";

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  const details = error?.response?.data?.details;

  if (Array.isArray(details) && details.length > 0) {
    return new Error(`${message}: ${details.join(", ")}`);
  }

  if (details && typeof details === "string") {
    return new Error(`${message}: ${details}`);
  }

  return new Error(message);
}

function extractData(response) {
  return response?.data?.data ?? null;
}

function emptyPagination() {
  return {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };
}

function normalizePagedResponse(response, itemNormalizer) {
  const data = extractData(response);
  const items = Array.isArray(data?.items) ? data.items.map(itemNormalizer) : [];

  return {
    items,
    pagination: {
      ...emptyPagination(),
      ...(data?.pagination || {}),
    },
  };
}

function normalizePaymentProvider(item = {}) {
  if (!item) return null;

  return {
    id: item.proveedor_pago_id || "",
    clave: item.clave || "",
    nombre: item.nombre || "",
    tipo: item.tipo || "",
  };
}

function normalizeTransaction(item = {}) {
  if (!item) return null;

  return {
    id: item.transaccion_id || "",
    descripcion: item.descripcion || "",
    tipo: item.tipo || "",
    estado: item.estado || "",
    referenciaExterna: item.referencia_externa || "",
    fechaTransaccion: item.fecha_transaccion || "",
    montoBruto: Number(item.monto_bruto || 0),
    montoFee: Number(item.monto_fee || 0),
    montoNeto: Number(item.monto_neto || 0),
    moneda: item.moneda || "USD",
    category: item.category
      ? {
          id: item.category.categoria_transaccion_id || "",
          clave: item.category.clave || "",
          nombre: item.category.nombre || "",
        }
      : null,
    paymentProvider: normalizePaymentProvider(item.payment_provider),
  };
}

function normalizeSponsorSummary(item = {}) {
  if (!item) return null;

  return {
    id: item.sponsor_id || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
    email: item.email || "",
    telefono: item.telefono || "",
  };
}

function normalizeAnimalSummary(item = {}) {
  if (!item) return null;

  return {
    id: item.id_animal || "",
    nombre: item.nombre || "",
    especie: item.especie || "",
    sexo: item.sexo || "",
    imagenPrincipal: item.imagen_principal || "",
  };
}

function normalizePlanSummary(item = {}) {
  if (!item) return null;

  return {
    id: item.sponsorship_plan_id || "",
    nombre: item.nombre || "",
    modalidad: item.modalidad || "PAYPAL",
    monto: Number(item.monto || 0),
    moneda: item.moneda || "USD",
    activo: Boolean(item.activo),
  };
}

function normalizeSubscriptionPayment(item = {}) {
  if (!item) return null;

  return {
    id: item.subscription_payment_id || "",
    estado: item.estado || "",
    moneda: item.moneda || "USD",
    montoBruto: Number(item.monto_bruto || 0),
    montoFee: Number(item.monto_fee || 0),
    montoNeto: Number(item.monto_neto || 0),
    occurredAt: item.occurred_at || "",
    metodoManual: item.metodo_manual || "",
    referenciaManual: item.referencia_manual || "",
    observacionManual: item.observacion_manual || "",
    subscription: item.subscription
      ? {
          id: item.subscription.subscription_id || "",
          estado: item.subscription.estado || "",
          sponsorshipId: item.subscription.sponsorship_id || "",
          sponsor: normalizeSponsorSummary(item.subscription.sponsor),
          animal: normalizeAnimalSummary(item.subscription.animal),
          plan: normalizePlanSummary(item.subscription.plan),
          paymentProvider: normalizePaymentProvider(item.subscription.payment_provider),
        }
      : null,
    transaction: normalizeTransaction(item.transaction),
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizeSponsorship(item = {}) {
  if (!item) return null;

  return {
    id: item.sponsorship_id || "",
    publicReference: item.public_reference || "",
    estado: item.estado || "",
    modalidad: item.modalidad || "",
    solicitadoEn: item.solicitado_en || "",
    activadoEn: item.activado_en || "",
    canceladoEn: item.cancelado_en || "",
    motivoCancelacion: item.motivo_cancelacion || "",
    sponsor: normalizeSponsorSummary(item.sponsor),
    animal: normalizeAnimalSummary(item.animal),
    plan: normalizePlanSummary(item.plan),
    subscription: item.subscription
      ? {
          id: item.subscription.subscription_id || "",
          estado: item.subscription.estado || "",
          nextBillingTime: item.subscription.next_billing_time || "",
          lastSyncedAt: item.subscription.last_synced_at || "",
          providerStatusUpdatedAt: item.subscription.provider_status_updated_at || "",
          paymentProvider: normalizePaymentProvider(item.subscription.payment_provider),
        }
      : null,
    ultimoPago: normalizeSubscriptionPayment(item.ultimo_pago),
    fechasImportantes: item.fechas_importantes || null,
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizeSponsor(item = {}) {
  if (!item) return null;

  return {
    id: item.sponsor_id || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
    email: item.email || "",
    telefono: item.telefono || "",
    activo: Boolean(item.activo),
    consentimientoDatosAt: item.consentimiento_datos_at || "",
    consentimientoOtorgado: Boolean(item.consentimiento_otorgado ?? item.consentimiento_datos_at),
    sponsorshipsCount: Number(item.sponsorships_count || 0),
    activeSponsorshipsCount: Number(item.active_sponsorships_count || 0),
    apadrinamientos: Array.isArray(item.apadrinamientos)
      ? item.apadrinamientos.map((entry) => ({
          id: entry.sponsorship_id || "",
          estado: entry.estado || "",
          solicitadoEn: entry.solicitado_en || "",
          animal: normalizeAnimalSummary(entry.animal),
          plan: normalizePlanSummary(entry.plan),
        }))
      : [],
    pagosResumen: item.pagos_resumen
      ? {
          cantidad: Number(item.pagos_resumen.cantidad || 0),
          totalNeto: Number(item.pagos_resumen.total_neto || 0),
          recientes: Array.isArray(item.pagos_resumen.recientes)
            ? item.pagos_resumen.recientes.map((entry) => ({
                id: entry.subscription_payment_id || "",
                fecha: entry.fecha || "",
                montoNeto: Number(entry.monto_neto || 0),
                moneda: entry.moneda || "USD",
                estado: entry.estado || "",
              }))
            : [],
        }
      : null,
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizePlan(item = {}) {
  if (!item) return null;

  return {
    id: item.sponsorship_plan_id || "",
    nombre: item.nombre || "",
    descripcion: item.descripcion || "",
    modalidad: item.modalidad || "PAYPAL",
    monto: Number(item.monto || 0),
    moneda: item.moneda || "USD",
    intervaloUnidad: item.intervalo_unidad || "MONTH",
    intervaloCantidad: Number(item.intervalo_cantidad || 1),
    frecuenciaLegible: item.frecuencia_legible || "Mensual",
    activo: Boolean(item.activo),
    orden: Number(item.orden || 0),
    hasHistory: Boolean(item.has_history),
    paypalConfigurado: Boolean(item.paypal_configurado),
    paypalEstado: item.paypal_estado || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizeAnimalToggle(item = {}) {
  if (!item) return null;

  return {
    id: item.id_animal || "",
    nombre: item.nombre || "",
    especie: item.especie || "",
    sexo: item.sexo || "",
    fallecido: Boolean(item.fallecido),
    apadrinable: Boolean(item.apadrinable),
    imagenPrincipal: item.imagen_principal || "",
    apadrinamientosActivos: Number(item.apadrinamientos_activos || 0),
  };
}

async function getPagedResource(path, params, normalizer, fallbackMessage) {
  try {
    const response = await api.get(path, { params });
    return normalizePagedResponse(response, normalizer);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return { items: [], pagination: emptyPagination() };
    }

    throw buildError(error, fallbackMessage);
  }
}

export async function getAdminSponsors(params = {}) {
  return getPagedResource(
    "/accounting/sponsors",
    params,
    normalizeSponsor,
    "No se pudieron cargar los padrinos.",
  );
}

export async function getAdminSponsor(id) {
  try {
    const response = await api.get(`/accounting/sponsors/${id}`);
    return normalizeSponsor(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo obtener el padrino.");
  }
}

export async function createAdminSponsor(payload) {
  try {
    const response = await api.post("/accounting/sponsors", payload);
    return normalizeSponsor(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo crear el padrino.");
  }
}

export async function updateAdminSponsor(id, payload) {
  try {
    const response = await api.patch(`/accounting/sponsors/${id}`, payload);
    return normalizeSponsor(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo actualizar el padrino.");
  }
}

export async function getAdminSponsorships(params = {}) {
  return getPagedResource(
    "/accounting/sponsorships",
    params,
    normalizeSponsorship,
    "No se pudieron cargar los apadrinamientos.",
  );
}

export async function getAdminSponsorship(id) {
  try {
    const response = await api.get(`/accounting/sponsorships/${id}`);
    return normalizeSponsorship(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo obtener el apadrinamiento.");
  }
}

export async function createAdminManualSponsorship(payload) {
  try {
    const response = await api.post("/accounting/sponsorships", payload);
    return normalizeSponsorship(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo crear el apadrinamiento manual.");
  }
}

export async function getAdminSubscriptions(params = {}) {
  return getPagedResource(
    "/accounting/subscriptions",
    params,
    (item) => item,
    "No se pudieron cargar las suscripciones.",
  );
}

export async function syncAdminSubscription(id) {
  try {
    const response = await api.post(`/accounting/subscriptions/${id}/sync`);
    return extractData(response);
  } catch (error) {
    throw buildError(error, "No se pudo sincronizar con PayPal.");
  }
}

export async function cancelAdminSubscription(id, payload) {
  try {
    const response = await api.post(`/accounting/subscriptions/${id}/cancel`, payload);
    return extractData(response);
  } catch (error) {
    throw buildError(error, "No se pudo cancelar el apadrinamiento.");
  }
}

export async function getAdminSubscriptionPayments(params = {}) {
  return getPagedResource(
    "/accounting/subscription-payments",
    params,
    normalizeSubscriptionPayment,
    "No se pudieron cargar los pagos.",
  );
}

export async function getAdminSubscriptionPayment(id) {
  try {
    const response = await api.get(`/accounting/subscription-payments/${id}`);
    return normalizeSubscriptionPayment(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo obtener el pago.");
  }
}

export async function createAdminManualSubscriptionPayment(payload, idempotencyKey) {
  try {
    const response = await api.post(
      "/accounting/subscription-payments",
      payload,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return normalizeSubscriptionPayment(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo registrar el pago manual.");
  }
}

export async function getAdminSponsorshipPlans(params = {}) {
  return getPagedResource(
    "/accounting/sponsorship-plans",
    params,
    normalizePlan,
    "No se pudieron cargar los planes.",
  );
}

export async function createAdminSponsorshipPlan(payload) {
  try {
    const response = await api.post("/accounting/sponsorship-plans", payload);
    return normalizePlan(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo crear el plan.");
  }
}

export async function updateAdminSponsorshipPlan(id, payload) {
  try {
    const response = await api.patch(`/accounting/sponsorship-plans/${id}`, payload);
    return normalizePlan(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo actualizar el plan.");
  }
}

export async function provisionAdminSponsorshipPlan(id) {
  try {
    const response = await api.post(`/accounting/sponsorship-plans/${id}/paypal/provision`);
    return normalizePlan(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo aprovisionar el plan en PayPal.");
  }
}

export async function deleteAdminSponsorshipPlan(id) {
  try {
    const response = await api.delete(`/accounting/sponsorship-plans/${id}`);
    return extractData(response) ? normalizePlan(extractData(response)) : null;
  } catch (error) {
    throw buildError(error, "No se pudo eliminar el plan.");
  }
}

export async function getAdminSponsorshipAnimals(params = {}) {
  return getPagedResource(
    "/accounting/sponsorship-animals",
    params,
    normalizeAnimalToggle,
    "No se pudieron cargar los animales apadrinables.",
  );
}

export async function updateAdminSponsorshipAnimal(id, payload) {
  try {
    const response = await api.patch(`/accounting/sponsorship-animals/${id}`, payload);
    return normalizeAnimalToggle(extractData(response));
  } catch (error) {
    throw buildError(error, "No se pudo actualizar el animal apadrinable.");
  }
}
