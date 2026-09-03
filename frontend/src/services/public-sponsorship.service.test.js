import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import api from "../api/axios.js";
import {
  getPublicSponsorshipAnimal,
  getPublicSponsorshipAnimals,
  getPublicSponsorshipPlans,
  getPublicSponsorshipStatus,
  startPublicSponsorship,
} from "./public-sponsorship.service.js";

const originalApiGet = api.get;
const originalApiPost = api.post;

afterEach(() => {
  api.get = originalApiGet;
  api.post = originalApiPost;
});

test("getPublicSponsorshipAnimals usa el endpoint publico paginado", async () => {
  let requestPath = "";
  let requestConfig = null;

  api.get = async (path, config) => {
    requestPath = path;
    requestConfig = config;
    return {
      data: {
        data: {
          items: [{ id: 1, nombre: "Luna", especie: "Perro", sexo: "Hembra", imagen_principal: "/img.jpg" }],
          pagination: { page: 2, limit: 6, total: 1, totalPages: 1, hasNext: false, hasPrevious: true },
        },
      },
    };
  };

  const payload = await getPublicSponsorshipAnimals({ search: " luna ", page: 2, limit: 6 });

  assert.equal(requestPath, "/public/sponsorship/animals");
  assert.equal(requestConfig.skipAuth, true);
  assert.deepEqual(requestConfig.params, { search: "luna", page: 2, limit: 6 });
  assert.equal(payload.items[0].nombre, "Luna");
});

test("getPublicSponsorshipAnimal aplica whitelist y excluye disgustos y cuidados especiales", async () => {
  api.get = async () => ({
    data: {
      data: {
        id: 7,
        nombre: "Nina",
        especie: "Perro",
        sexo: "Hembra",
        edad_aproximada: "2 anos",
        imagen_principal: "/main.jpg",
        galeria_publica: ["/g1.jpg"],
        perfil_publico: {
          historia: "Rescatada",
          personalidad: "Curiosa",
          gustos: "Pasear",
          disgustos: "Ruidos",
          cuidados_especiales: "Control",
        },
        planes_activos: [{ id: 9, nombre: "Plan Base", monto: 12, moneda: "USD", frecuencia: "Mensual" }],
      },
    },
  });

  const payload = await getPublicSponsorshipAnimal(7);

  assert.equal(payload.nombre, "Nina");
  assert.equal(payload.historia, "Rescatada");
  assert.equal(payload.personalidad, "Curiosa");
  assert.equal(payload.gustos, "Pasear");
  assert.equal("disgustos" in payload, false);
  assert.equal("cuidados_especiales" in payload, false);
});

test("getPublicSponsorshipPlans usa solo el endpoint publico esperado", async () => {
  let requestPath = "";

  api.get = async (path) => {
    requestPath = path;
    return { data: { data: [{ id: 2, nombre: "Plan Oro", monto: 20, moneda: "USD" }] } };
  };

  const payload = await getPublicSponsorshipPlans();

  assert.equal(requestPath, "/public/sponsorship/plans");
  assert.equal(payload[0].nombre, "Plan Oro");
});

test("startPublicSponsorship envia el header Idempotency-Key", async () => {
  let requestPath = "";
  let requestBody = null;
  let requestConfig = null;

  api.post = async (path, body, config) => {
    requestPath = path;
    requestBody = body;
    requestConfig = config;
    return { data: { data: { public_reference: "uuid-1", approval_url: "https://www.sandbox.paypal.com/test" } } };
  };

  const payload = await startPublicSponsorship(
    {
      animal_id: 3,
      plan_id: 4,
      nombre: " Ana ",
      apellido: " Perez ",
      email: " ana@example.com ",
      telefono: " 123 ",
      consentimiento_datos: true,
    },
    { idempotencyKey: "uuid-key-1" },
  );

  assert.equal(requestPath, "/public/sponsorships/start");
  assert.equal(requestConfig.skipAuth, true);
  assert.equal(requestConfig.headers["Idempotency-Key"], "uuid-key-1");
  assert.equal(requestBody.nombre, "Ana");
  assert.equal(payload.public_reference, "uuid-1");
});

test("getPublicSponsorshipStatus usa el endpoint publico plural", async () => {
  let requestPath = "";

  api.get = async (path) => {
    requestPath = path;
    return {
      data: {
        data: {
          public_reference: "uuid-2",
          estado_apadrinamiento: "ACTIVO",
          estado_suscripcion: "ACTIVA",
          animal: { id: 5, nombre: "Toby", imagen_principal: "/toby.jpg" },
          plan: { nombre: "Plan Plata", monto: 10, moneda: "USD" },
        },
      },
    };
  };

  const payload = await getPublicSponsorshipStatus("uuid-2");

  assert.equal(requestPath, "/public/sponsorships/uuid-2/status");
  assert.equal(payload.estado_suscripcion, "ACTIVA");
  assert.equal(payload.animal.nombre, "Toby");
});

test("getPublicSponsorshipStatus soporta response.data como payload directo", async () => {
  api.get = async () => ({
    data: {
      public_reference: "uuid-4",
      estado_apadrinamiento: "PENDIENTE_APROBACION",
      estado_suscripcion: "CREADA",
    },
  });

  const payload = await getPublicSponsorshipStatus("uuid-4");

  assert.equal(payload.public_reference, "uuid-4");
  assert.equal(payload.estado_suscripcion, "CREADA");
});

test("startPublicSponsorship expone message legible cuando details es un objeto vacio", async () => {
  api.post = async () => {
    const error = new Error("Request failed");
    error.response = {
      data: {
        message: "Ya existe un apadrinamiento activo o pendiente para este padrino y animal.",
        details: {},
      },
    };
    throw error;
  };

  await assert.rejects(
    () => startPublicSponsorship({
      animal_id: 3,
      plan_id: 4,
      nombre: "Ana",
      apellido: "Perez",
      email: "ana@example.com",
      consentimiento_datos: true,
    }),
    /Ya existe un apadrinamiento activo o pendiente/,
  );
});
