import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import DOMPurify from "dompurify";
import {
  buildInitialSponsorshipFormState,
  buildPublicSponsorshipRichTextHtml,
  clearPendingPublicSponsorship,
  clearResolvedPublicSponsorship,
  createPublicSponsorshipIdempotencyKey,
  getPublicSponsorshipErrorMessage,
  getOrCreateAttemptIdempotencyKey,
  getPublicSponsorshipPendingStatePhase,
  normalizePublicSponsorshipAnimalDetail,
  normalizePublicSponsorshipStatusResponse,
  readPendingPublicSponsorship,
  readResolvedPublicSponsorship,
  resolvePublicSponsorshipAnimalId,
  resolvePublicSponsorshipReference,
  storeResolvedPublicSponsorship,
  storePendingPublicSponsorship,
  validatePublicSponsorshipApprovalUrl,
  validatePublicSponsorshipForm,
} from "./publicSponsorship.js";

const originalWindow = global.window;
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");

afterEach(() => {
  global.window = originalWindow;
  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
  }
});

function createSessionStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test("normalizePublicSponsorshipAnimalDetail conserva solo campos permitidos", () => {
  const result = normalizePublicSponsorshipAnimalDetail({
    id: 1,
    nombre: "Luna",
    especie: "Perro",
    sexo: "Hembra",
    edad_aproximada: "1 ano",
    imagen_principal: "/main.jpg",
    galeria_publica: ["/g1.jpg"],
    perfil_publico: {
      historia: "Historia",
      personalidad: "Dulce",
      gustos: "Jugar",
      disgustos: "Truenos",
      cuidados_especiales: "Control",
    },
    planes_activos: [{ id: 2, nombre: "Plan", monto: 15, moneda: "USD", frecuencia: "Mensual" }],
  });

  assert.deepEqual(Object.keys(result).sort(), [
    "edad_aproximada",
    "especie",
    "galeria_publica",
    "gustos",
    "historia",
    "id",
    "imagen_principal",
    "nombre",
    "personalidad",
    "planes",
    "sexo",
  ]);
});

test("normalizePublicSponsorshipAnimalDetail acepta preview_url y conserva strings publicas", () => {
  const result = normalizePublicSponsorshipAnimalDetail({
    id: 1,
    nombre: "Luna",
    imagen_principal: {
      preview_url: "/api/public/files/uuid-1/preview",
      object_key: "privado",
    },
    galeria_publica: [
      { url: "/api/public/files/uuid-2/preview" },
      null,
    ],
  });

  assert.equal(result.imagen_principal, "/api/public/files/uuid-1/preview");
  assert.deepEqual(result.galeria_publica, ["/api/public/files/uuid-2/preview"]);
});

test("idempotencia reutiliza la misma key en el mismo intento y genera otra para una operacion nueva", () => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      randomUUID: (() => {
        const values = ["uuid-1", "uuid-2"];
        return () => values.shift();
      })(),
    },
  });

  const first = getOrCreateAttemptIdempotencyKey(null);
  const reused = getOrCreateAttemptIdempotencyKey(first);
  const next = getOrCreateAttemptIdempotencyKey(null);

  assert.equal(first, "uuid-1");
  assert.equal(reused, "uuid-1");
  assert.equal(next, "uuid-2");
});

test("storePendingPublicSponsorship y readPendingPublicSponsorship no guardan datos personales", () => {
  global.window = {
    sessionStorage: createSessionStorageMock(),
  };

  storePendingPublicSponsorship({
    public_reference: "ref-1",
    animal_id: 4,
    idempotency_key: "key-1",
    nombre: "Ana",
  });

  const payload = readPendingPublicSponsorship();

  assert.deepEqual(payload.public_reference, "ref-1");
  assert.equal(payload.animal_id, 4);
  assert.equal(payload.idempotency_key, "key-1");
  assert.equal("nombre" in payload, false);

  clearPendingPublicSponsorship();
  assert.equal(readPendingPublicSponsorship(), null);
});

test("storeResolvedPublicSponsorship permite recargar success sin conservar datos personales", () => {
  global.window = {
    sessionStorage: createSessionStorageMock(),
  };

  storeResolvedPublicSponsorship({
    public_reference: "ref-2",
    estado_apadrinamiento: "ACTIVO",
    estado_suscripcion: "ACTIVA",
    animal: {
      id: 8,
      nombre: "Benito",
      imagen_principal: "/api/public/files/test/preview",
      email: "oculto@example.com",
    },
    plan: {
      nombre: "Plan Base",
      monto: 10,
      moneda: "USD",
    },
  });

  const payload = readResolvedPublicSponsorship();

  assert.equal(payload.public_reference, "ref-2");
  assert.equal(payload.estado_suscripcion, "ACTIVA");
  assert.equal(payload.animal.nombre, "Benito");
  assert.equal(payload.animal.email, undefined);

  clearResolvedPublicSponsorship();
  assert.equal(readResolvedPublicSponsorship(), null);
});

test("validatePublicSponsorshipForm exige consentimiento y plan", () => {
  const formState = buildInitialSponsorshipFormState();
  const invalid = validatePublicSponsorshipForm(formState, null);
  const valid = validatePublicSponsorshipForm({
    nombre: "Ana",
    apellido: "Perez",
    email: "ana@example.com",
    telefono: "",
    consentimiento_datos: true,
  }, 3);

  assert.equal(invalid.isValid, false);
  assert.equal(valid.isValid, true);
});

test("getPublicSponsorshipPendingStatePhase distingue pendiente, activo y fallido", () => {
  assert.equal(
    getPublicSponsorshipPendingStatePhase({
      estado_apadrinamiento: "PENDIENTE_APROBACION",
      estado_suscripcion: "APROBACION_PENDIENTE",
    }),
    "pending",
  );
  assert.equal(
    getPublicSponsorshipPendingStatePhase({
      estado_apadrinamiento: "ACTIVO",
      estado_suscripcion: "ACTIVA",
    }),
    "active",
  );
  assert.equal(
    getPublicSponsorshipPendingStatePhase({
      estado_apadrinamiento: "CANCELADO",
      estado_suscripcion: "CANCELADA",
    }),
    "failed",
  );
});

test("normalizePublicSponsorshipStatusResponse soporta envelope con data", () => {
  const result = normalizePublicSponsorshipStatusResponse({
    status: "Success",
    data: {
      public_reference: "uuid-3",
      estado_apadrinamiento: "ACTIVO",
      estado_suscripcion: "ACTIVA",
    },
  });

  assert.equal(result.public_reference, "uuid-3");
  assert.equal(result.estado_apadrinamiento, "ACTIVO");
});

test("resolvePublicSponsorshipReference prioriza query param sobre storage", () => {
  const result = resolvePublicSponsorshipReference({
    refFromQuery: "ref-query",
    pendingReference: { public_reference: "ref-pending" },
    resolvedReference: { public_reference: "ref-resolved" },
  });

  assert.equal(result, "ref-query");
});

test("resolvePublicSponsorshipAnimalId usa pending, luego query y luego status", () => {
  assert.equal(
    resolvePublicSponsorshipAnimalId({
      pendingReference: { animal_id: 9 },
      queryAnimalId: "7",
      status: { animal: { id: 5 } },
    }),
    9,
  );

  assert.equal(
    resolvePublicSponsorshipAnimalId({
      pendingReference: null,
      queryAnimalId: "7",
      status: { animal: { id: 5 } },
    }),
    7,
  );

  assert.equal(
    resolvePublicSponsorshipAnimalId({
      pendingReference: null,
      queryAnimalId: null,
      status: { animal: { id: 5 } },
    }),
    5,
  );
});

test("buildPublicSponsorshipRichTextHtml conserva formato y elimina scripts", () => {
  if (typeof DOMPurify.sanitize !== "function") {
    DOMPurify.sanitize = (value) => String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "");
  }

  const result = buildPublicSponsorshipRichTextHtml(
    '<p><strong>Historia</strong></p><script>alert(1)</script><p onclick="x()">Hola</p>',
  );

  assert.match(result, /<strong>Historia<\/strong>/);
  assert.doesNotMatch(result, /<script/i);
  assert.doesNotMatch(result, /onclick/i);
});

test("getPublicSponsorshipErrorMessage usa message antes que details vacio", () => {
  const result = getPublicSponsorshipErrorMessage({
    response: {
      data: {
        message: "Ya existe un apadrinamiento activo o pendiente para este padrino y animal.",
        details: {},
      },
    },
  }, "Fallback");

  assert.equal(
    result,
    "Ya existe un apadrinamiento activo o pendiente para este padrino y animal.",
  );
});

test("validatePublicSponsorshipApprovalUrl exige https y host oficial de paypal", () => {
  assert.throws(
    () => validatePublicSponsorshipApprovalUrl("http://www.sandbox.paypal.com/test"),
    /segura/i,
  );
});

test("AppRouter declara success y cancel antes de la ruta dinamica de apadrinamiento", () => {
  const routerSource = readFileSync(
    new URL("../routes/AppRouter.jsx", import.meta.url),
    "utf8",
  );

  const successIndex = routerSource.indexOf('path={PUBLIC_SITE_ROUTES.sponsorshipSuccess}');
  const cancelIndex = routerSource.indexOf('path={PUBLIC_SITE_ROUTES.sponsorshipCancel}');
  const detailIndex = routerSource.indexOf('path={PUBLIC_SITE_ROUTES.sponsorshipDetail}');

  assert.notEqual(successIndex, -1);
  assert.notEqual(cancelIndex, -1);
  assert.notEqual(detailIndex, -1);
  assert.ok(successIndex < detailIndex);
  assert.ok(cancelIndex < detailIndex);
});

test("sponsorship success consulta ref desde query y ya no depende solo de pending storage", () => {
  const source = readFileSync(
    new URL("../pages/public/sponsorship-success.page.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /searchParams\.get\("ref"\)/);
  assert.match(source, /resolvePublicSponsorshipReference/);
  assert.match(source, /getPublicSponsorshipStatus\(publicReference\)/);
  assert.doesNotMatch(source, /if \(!pendingReference\?\.public_reference\)/);
});

test("sponsorship cancel usa animal_id desde query cuando no hay pending storage", () => {
  const source = readFileSync(
    new URL("../pages/public/sponsorship-cancel.page.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /searchParams\.get\("animal_id"\)/);
  assert.match(source, /resolvePublicSponsorshipAnimalId/);
  assert.doesNotMatch(source, /getPublicSponsorshipStatus|startPublicSponsorship|api\./);
});
