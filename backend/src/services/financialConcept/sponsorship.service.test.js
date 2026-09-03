"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import { AppDataSource } from "../../config/configDb.js";
import SubscriptionPayment from "../../entities/financialConcept/subscription_payment.entity.js";
import {
  createSponsorService,
  updateSponsorService,
} from "./sponsor.service.js";
import {
  createSponsorshipPlanService,
  deleteSponsorshipPlanService,
  updateSponsorshipPlanService,
} from "./sponsorshipPlan.service.js";
import {
  createManualSponsorshipService,
  updateSponsorshipAnimalService,
} from "./sponsorshipAdmin.service.js";
import {
  cancelSubscriptionService,
  createManualSubscriptionPaymentService,
} from "./sponsorshipSubscription.service.js";
import {
  getPublicSponsorshipAnimalDetailService,
  getPublicSponsorshipAnimalsService,
  getPublicSponsorshipPlansService,
} from "../publicSponsorship.service.js";
import { getPublicAnimalFilePreviewService } from "../publicFileAsset.service.js";
import {
  FILE_ASSET_CONTEXTS,
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
  FILE_ASSET_VISIBILITY,
} from "../../entities/file_asset.entity.js";

function withPatchedDataSource({ transaction, getRepository, manager }, callback) {
  const originalTransaction = AppDataSource.transaction;
  const originalGetRepository = AppDataSource.getRepository;
  const originalManager = AppDataSource.manager;

  if (transaction) AppDataSource.transaction = transaction;
  if (getRepository) AppDataSource.getRepository = getRepository;
  if (manager) AppDataSource.manager = manager;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      AppDataSource.transaction = originalTransaction;
      AppDataSource.getRepository = originalGetRepository;
      AppDataSource.manager = originalManager;
    });
}

test("createSponsorService exige consentimiento explicito, normaliza email y rechaza duplicados", async () => {
  const sponsors = [];
  const repository = {
    async findOne({ where }) {
      if (where.email) {
        return sponsors.find((item) => item.email === where.email) || null;
      }

      if (where.sponsor_id) {
        return sponsors.find((item) => Number(item.sponsor_id) === Number(where.sponsor_id)) || null;
      }

      return null;
    },
    create(payload) {
      return { sponsor_id: sponsors.length + 1, ...payload };
    },
    async save(payload) {
      sponsors.push(payload);
      return payload;
    },
  };

  const transaction = async (callback) => callback({
    getRepository() {
      return repository;
    },
  });

  const [, missingConsentError] = await withPatchedDataSource({ transaction }, () =>
    createSponsorService({
      nombre: "Ana",
      apellido: "Perez",
      email: "Ana.Perez@Mail.Com",
      telefono: "12345",
    }));

  assert.equal(missingConsentError, "Debes aceptar expresamente el consentimiento de datos.");

  const [created, createError] = await withPatchedDataSource({ transaction }, () =>
    createSponsorService({
      nombre: "Ana",
      apellido: "Perez",
      email: "Ana.Perez@Mail.Com",
      telefono: "12345",
      consentimiento_datos: true,
    }));

  assert.equal(createError, null);
  assert.equal(created.email, "ana.perez@mail.com");
  assert.ok(sponsors[0].consentimiento_datos_at instanceof Date);

  const [, duplicateError] = await withPatchedDataSource({ transaction }, () =>
    createSponsorService({
      nombre: "Ana",
      apellido: "Perez",
      email: "ANA.PEREZ@MAIL.COM",
      consentimiento_datos: true,
    }));

  assert.equal(duplicateError, "Ya existe un padrino registrado con ese email.");
});

test("createSponsorshipPlanService fija defaults por modalidad y deleteSponsorshipPlanService desactiva si hay historial", async () => {
  const planStore = {
    sponsorship_plan_id: 1,
    nombre: "Plan Base",
    descripcion: null,
    monto: 12,
    moneda: "USD",
    intervalo_unidad: "MONTH",
    intervalo_cantidad: 1,
    activo: true,
    orden: 0,
    sponsorships: [{ sponsorship_id: 77 }],
  };

  const repository = {
    create(payload) {
      return { sponsorship_plan_id: 1, sponsorships: [], ...payload };
    },
    async save(payload) {
      Object.assign(planStore, payload);
      return planStore;
    },
    async findOne() {
      return { ...planStore };
    },
    async update(_where, payload) {
      Object.assign(planStore, payload);
    },
    async remove() {
      throw new Error("No debe eliminar fisicamente un plan con historial.");
    },
  };

  const transaction = async (callback) => callback({
    getRepository() {
      return repository;
    },
  });

  const [created, createError] = await withPatchedDataSource({ transaction }, () =>
    createSponsorshipPlanService({
      nombre: "Plan Base",
      monto: 12,
    }));

  assert.equal(createError, null);
  assert.equal(created.modalidad, "PAYPAL");
  assert.equal(created.moneda, "USD");
  assert.equal(created.intervalo_unidad, "MONTH");
  assert.equal(created.intervalo_cantidad, 1);

  const [manualPlan, manualPlanError] = await withPatchedDataSource({ transaction }, () =>
    createSponsorshipPlanService({
      nombre: "Plan Manual",
      modalidad: "MANUAL",
      monto: 10000,
    }));

  assert.equal(manualPlanError, null);
  assert.equal(manualPlan.modalidad, "MANUAL");
  assert.equal(manualPlan.moneda, "CLP");

  planStore.sponsorships = [{ sponsorship_id: 77 }];

  const [deleted, deleteError] = await withPatchedDataSource({ transaction }, () =>
    deleteSponsorshipPlanService({ id: 1 }));

  assert.equal(deleteError, null);
  assert.equal(deleted.activo, false);
});

test("updateSponsorshipPlanService permite cambiar monto sin historial y bloquear cambios financieros con historial o paypal_plan_id", async () => {
  const planStore = {
    sponsorship_plan_id: 11,
    nombre: "Plan Flexible",
    descripcion: null,
    monto: 10,
    moneda: "USD",
    intervalo_unidad: "MONTH",
    intervalo_cantidad: 1,
    activo: true,
    orden: 0,
    sponsorships: [],
    paypal_plan_id: null,
  };

  const repository = {
    async findOne() {
      return { ...planStore, sponsorships: [...planStore.sponsorships] };
    },
    async update(_where, payload) {
      Object.assign(planStore, payload);
    },
  };

  const transaction = async (callback) => callback({
    getRepository() {
      return repository;
    },
  });

  const [updatedWithoutHistory, updateWithoutHistoryError] = await withPatchedDataSource(
    { transaction },
    () => updateSponsorshipPlanService({ id: 11 }, { monto: 14, activo: false }),
  );

  assert.equal(updateWithoutHistoryError, null);
  assert.equal(updatedWithoutHistory.monto, 14);
  assert.equal(updatedWithoutHistory.activo, false);

  planStore.sponsorships = [{ sponsorship_id: 200 }];

  const [, updateWithHistoryError] = await withPatchedDataSource({ transaction }, () =>
    updateSponsorshipPlanService({ id: 11 }, { monto: 20 }));

  assert.equal(
    updateWithHistoryError,
    "El monto y la frecuencia de un plan con historial no pueden modificarse. Crea un nuevo plan.",
  );

  const [deactivatedWithHistory, deactivateWithHistoryError] = await withPatchedDataSource(
    { transaction },
    () => updateSponsorshipPlanService({ id: 11 }, { activo: true, nombre: "Plan Flexible 2" }),
  );

  assert.equal(deactivateWithHistoryError, null);
  assert.equal(deactivatedWithHistory.nombre, "Plan Flexible 2");
  assert.equal(deactivatedWithHistory.activo, true);

  planStore.sponsorships = [];
  planStore.paypal_plan_id = "P-123";

  const [, updateWithPaypalIdError] = await withPatchedDataSource({ transaction }, () =>
    updateSponsorshipPlanService({ id: 11 }, { monto: 22 }));

  assert.equal(
    updateWithPaypalIdError,
    "El monto y la frecuencia de un plan con historial no pueden modificarse. Crea un nuevo plan.",
  );
});

test("los servicios de apadrinamiento trabajan con booleanos estrictos y preservan false real", async () => {
  const sponsor = {
    sponsor_id: 2,
    nombre: "Beto",
    apellido: "Lagos",
    email: "beto@test.cl",
    telefono: null,
    activo: true,
    sponsorships: [],
  };
  const sponsorRepository = {
    async findOne({ where }) {
      if (where.email) return { ...sponsor };
      return { ...sponsor };
    },
    async update(_where, payload) {
      Object.assign(sponsor, payload);
    },
  };

  const [updatedSponsor, sponsorUpdateError] = await withPatchedDataSource({
    transaction: async (callback) => callback({
      getRepository() {
        return sponsorRepository;
      },
    }),
  }, () => updateSponsorService({ id: 2 }, { activo: false }));

  assert.equal(sponsorUpdateError, null);
  assert.equal(updatedSponsor.activo, false);

  const animalRepository = {
    async findOne() {
      return { id_animal: 1, apadrinable: true };
    },
    async update() {
      throw new Error("No debe intentar actualizar con un booleano invalido.");
    },
  };
  const [invalidAnimalResult, invalidAnimalError] = await withPatchedDataSource({
    transaction: async (callback) => callback({
      getRepository() {
        return animalRepository;
      },
    }),
  }, () => updateSponsorshipAnimalService({ id: 1 }, { apadrinable: "false" }));

  assert.equal(invalidAnimalResult, null);
  assert.equal(invalidAnimalError, "El valor booleano enviado no es valido.");
});

test("getPublicSponsorshipPlansService expone solo DTO publico de planes activos", async () => {
  const repository = {
    async find(options) {
      assert.equal(options.where.activo, true);
      return [{
        sponsorship_plan_id: 9,
        nombre: "Plan Oro",
        descripcion: "Apoyo mensual",
        modalidad: "PAYPAL",
        monto: "25.00",
        moneda: "USD",
        activo: true,
        paypal_product_id: "PROD-1",
        paypal_plan_id: "PLAN-1",
      }, {
        sponsorship_plan_id: 10,
        nombre: "Plan Manual",
        descripcion: "Solo interno",
        modalidad: "MANUAL",
        monto: "10000.00",
        moneda: "CLP",
        activo: true,
        paypal_product_id: null,
        paypal_plan_id: null,
      }];
    },
  };

  const [plans, serviceError] = await withPatchedDataSource({
    getRepository() {
      return repository;
    },
  }, () => getPublicSponsorshipPlansService());

  assert.equal(serviceError, null);
  assert.deepEqual(plans, [{
    id: 9,
    nombre: "Plan Oro",
    descripcion: "Apoyo mensual",
    monto: 25,
    moneda: "USD",
    frecuencia: "Mensual",
  }]);
});

test("getPublicSponsorshipAnimalsService excluye fallecidos y no apadrinables", async () => {
  const animalRepository = {
    async find() {
      return [
        { id_animal: 1, nombre: "Luna", especie: "PERRO", sexo: "HEMBRA", apadrinable: true, fallecido: false },
        { id_animal: 2, nombre: "Toby", especie: "PERRO", sexo: "MACHO", apadrinable: false, fallecido: false },
        { id_animal: 3, nombre: "Milo", especie: "GATO", sexo: "MACHO", apadrinable: true, fallecido: true },
      ];
    },
  };
  const fileRepository = {
    async find({ where }) {
      assert.equal(where.visibility, FILE_ASSET_VISIBILITY.PUBLICO);
      return [{
        entity_id: 1,
        context: FILE_ASSET_CONTEXTS.ANIMAL_MAIN,
        public_id: "11111111-1111-4111-8111-111111111111",
        is_main: true,
      }];
    },
  };

  const [payload, serviceError] = await withPatchedDataSource({
    getRepository(entity) {
      return entity.options?.name === "Animal" ? animalRepository : fileRepository;
    },
    manager: {
      getRepository(entity) {
        return entity.options?.name === "FileAsset" ? fileRepository : animalRepository;
      },
    },
  }, () => getPublicSponsorshipAnimalsService({ page: 1, limit: 10 }));

  assert.equal(serviceError, null);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].id, 1);
  assert.equal(payload.items[0].imagen_principal, "/api/public/files/11111111-1111-4111-8111-111111111111/preview");
});

test("getPublicSponsorshipAnimalDetailService devuelve perfil publico, galeria publica y sin datos privados", async () => {
  const animal = {
    id_animal: 4,
    nombre: "Nina",
    especie: "PERRO",
    sexo: "HEMBRA",
    fecha_nacimiento: "2024-01-10",
    tipo_fecha_nacimiento: "REAL",
    apadrinable: true,
    fallecido: false,
  };

  const animalRepository = {
    async findOne() {
      return animal;
    },
  };
  const profileRepository = {
    async findOne() {
      return {
        historia: "Rescatada",
        personalidad: "Dulce",
        gustos: "Paseos",
        disgustos: "Ruidos fuertes",
        cuidados_especiales: "Control mensual",
      };
    },
  };
  const planRepository = {
    async find() {
      return [{
        sponsorship_plan_id: 2,
        nombre: "Plan Nina",
        descripcion: "Plan mensual",
        monto: "15.00",
        moneda: "USD",
        activo: true,
      }];
    },
  };
  const fileRepository = {
    async find({ where }) {
      assert.equal(where.entity_type, FILE_ASSET_ENTITY_TYPES.ANIMAL);
      assert.equal(where.visibility, FILE_ASSET_VISIBILITY.PUBLICO);
      return [
        {
          entity_id: 4,
          context: FILE_ASSET_CONTEXTS.ANIMAL_MAIN,
          public_id: "22222222-2222-4222-8222-222222222222",
          is_main: true,
        },
        {
          entity_id: 4,
          context: FILE_ASSET_CONTEXTS.ANIMAL_GALLERY,
          public_id: "33333333-3333-4333-8333-333333333333",
          is_main: false,
        },
      ];
    },
  };

  const [payload, serviceError] = await withPatchedDataSource({
    transaction: async (callback) => callback({
      getRepository(entity) {
        switch (entity.options?.name) {
          case "Animal":
            return animalRepository;
          case "AnimalProfile":
            return profileRepository;
          case "SponsorshipPlan":
            return planRepository;
          default:
            return fileRepository;
        }
      },
    }),
  }, () => getPublicSponsorshipAnimalDetailService({ id: 4 }));

  assert.equal(serviceError, null);
  assert.equal(payload.id, 4);
  assert.equal(payload.perfil_publico.historia, "Rescatada");
  assert.equal(payload.galeria_publica.length, 1);
  assert.equal("sponsor" in payload, false);
  assert.equal("subscription" in payload, false);
  assert.equal("payments" in payload, false);
});

test("getPublicAnimalFilePreviewService rechaza archivos privados o no publicables", async () => {
  const repository = {
    async findOne({ where }) {
      assert.equal(where.visibility, FILE_ASSET_VISIBILITY.PUBLICO);
      return null;
    },
  };

  const [payload, serviceError] = await withPatchedDataSource({
    getRepository() {
      return repository;
    },
  }, () => getPublicAnimalFilePreviewService("44444444-4444-4444-8444-444444444444"));

  assert.equal(payload, null);
  assert.equal(serviceError.statusCode, 404);
});

test("SubscriptionPayment mantiene unicidad nullable sobre transaction_id en metadata", () => {
  const transactionRelation = SubscriptionPayment.options.relations.transaction;
  const uniqueIndex = SubscriptionPayment.options.indices.find(
    (index) => index.name === "UQ_subscription_payment_transaction_id",
  );

  assert.equal(transactionRelation.type, "one-to-one");
  assert.equal(transactionRelation.nullable, true);
  assert.ok(uniqueIndex);
  assert.equal(uniqueIndex.unique, true);
});

test("createManualSponsorshipService crea un apadrinamiento manual activo con proveedor MANUAL", async () => {
  const store = {
    sponsor: { sponsor_id: 8, nombre: "Ana", apellido: "Lopez", activo: true },
    animal: { id_animal: 5, nombre: "Luna", especie: "PERRO", apadrinable: true, fallecido: false },
    plan: { sponsorship_plan_id: 3, nombre: "Plan Luna", modalidad: "MANUAL", monto: 18000, moneda: "CLP", activo: true },
    provider: { proveedor_pago_id: 9, clave: "MANUAL", nombre: "Manual", tipo: "MANUAL", activo: true },
    sponsorship: null,
    subscription: null,
  };

  const sponsorshipRepository = {
    async find() {
      return [];
    },
    create(payload) {
      return { sponsorship_id: 41, ...payload };
    },
    async save(payload) {
      store.sponsorship = { ...payload };
      return store.sponsorship;
    },
    async findOne() {
      return {
        ...store.sponsorship,
        sponsor: store.sponsor,
        animal: store.animal,
        plan: store.plan,
        subscription: {
          ...store.subscription,
          payment_provider: store.provider,
          payments: [],
        },
      };
    },
  };
  const subscriptionRepository = {
    create(payload) {
      return { subscription_id: 51, ...payload };
    },
    async save(payload) {
      store.subscription = { ...payload };
      return store.subscription;
    },
  };
  const manager = {
    getRepository(entity) {
      switch (entity.options?.name) {
        case "Sponsor":
          return {
            async findOne() {
              return { ...store.sponsor };
            },
          };
        case "Animal":
          return {
            async findOne() {
              return { ...store.animal };
            },
          };
        case "SponsorshipPlan":
          return {
            async findOne() {
              return { ...store.plan };
            },
          };
        case "Sponsorship":
          return sponsorshipRepository;
        case "Subscription":
          return subscriptionRepository;
        case "PaymentProvider":
          return {
            async findOne() {
              return { ...store.provider };
            },
          };
        default:
          return {
            async find() {
              return [];
            },
            async findOne() {
              return null;
            },
          };
      }
    },
  };

  const [created, serviceError] = await withPatchedDataSource({
    transaction: async (callback) => callback(manager),
    manager: {
      getRepository(entity) {
        if (entity.options?.name === "FileAsset") {
          return { async find() { return []; } };
        }
        return manager.getRepository(entity);
      },
    },
  }, () => createManualSponsorshipService({
    sponsor_id: 8,
    animal_id: 5,
    plan_id: 3,
    fecha_inicio: "2026-06-01T00:00:00.000Z",
    proximo_cobro: "2026-07-01T00:00:00.000Z",
    metodo_esperado: "TRANSFERENCIA",
    observacion: "Primer acuerdo manual",
  }));

  assert.equal(serviceError, null);
  assert.equal(created.estado, "ACTIVO");
  assert.equal(created.modalidad, "MANUAL");
  assert.equal(created.subscription.payment_provider.clave, "MANUAL");
  assert.equal(created.subscription.estado, "ACTIVA");
});

test("createManualSubscriptionPaymentService crea pago y transaccion contable sin duplicar por idempotencia", async () => {
  const store = {
    sponsor: { sponsor_id: 1, nombre: "Ana", apellido: "Lopez" },
    animal: { id_animal: 3, nombre: "Luna", especie: "PERRO" },
    plan: { sponsorship_plan_id: 7, nombre: "Plan Base", modalidad: "MANUAL", monto: 20000, moneda: "CLP" },
    provider: { proveedor_pago_id: 5, clave: "MANUAL", nombre: "Manual", tipo: "MANUAL", activo: true },
    category: { categoria_transaccion_id: 11, clave: "APADRINAMIENTO", activo: true },
    subscription: {
      subscription_id: 20,
      estado: "ACTIVA",
      next_billing_time: null,
      last_synced_at: null,
      metadata: null,
      sponsorship: {
        sponsorship_id: 15,
        estado: "ACTIVO",
        sponsor: null,
        animal: null,
        plan: null,
      },
      payment_provider: null,
      payments: [],
    },
    payments: [],
    transactions: [],
    relationTransactionId: null,
  };
  store.subscription.sponsorship.sponsor = store.sponsor;
  store.subscription.sponsorship.animal = store.animal;
  store.subscription.sponsorship.plan = store.plan;
  store.subscription.payment_provider = store.provider;

  const paymentRepository = {
    create(payload) {
      return { subscription_payment_id: store.payments.length + 1, ...payload };
    },
    async save(payload) {
      const saved = { ...payload };
      store.payments.push(saved);
      return saved;
    },
    async findOne({ where }) {
      if (where.provider_payment_id) {
        const payment = store.payments.find((item) => item.provider_payment_id === where.provider_payment_id);
        return payment
          ? {
              ...payment,
              subscription: {
                ...store.subscription,
                sponsorship: store.subscription.sponsorship,
                payment_provider: store.provider,
              },
              transaction: (() => {
                const tx = store.transactions.find((item) => item.transaccion_id === store.relationTransactionId);
                return tx
                  ? {
                      ...tx,
                      category: store.category,
                      payment_provider: store.provider,
                    }
                  : null;
              })(),
            }
          : null;
      }

      if (where.subscription_payment_id) {
        const payment = store.payments.find(
          (item) => Number(item.subscription_payment_id) === Number(where.subscription_payment_id),
        );
        return payment
          ? {
              ...payment,
              subscription: {
                ...store.subscription,
                sponsorship: store.subscription.sponsorship,
                payment_provider: store.provider,
              },
              transaction: (() => {
                const tx = store.transactions.find((item) => item.transaccion_id === store.relationTransactionId);
                return tx
                  ? {
                      ...tx,
                      category: store.category,
                      payment_provider: store.provider,
                    }
                  : null;
              })(),
            }
          : null;
      }

      return null;
    },
  };
  const transactionRepository = {
    create(payload) {
      return { transaccion_id: store.transactions.length + 1, ...payload };
    },
    async save(payload) {
      const saved = { ...payload };
      store.transactions.push(saved);
      return saved;
    },
  };
  const subscriptionRepository = {
    async findOne() {
      return {
        ...store.subscription,
        sponsorship: store.subscription.sponsorship,
        payment_provider: store.provider,
        payments: store.payments.map((item) => ({ ...item })),
      };
    },
    async update(_where, payload) {
      Object.assign(store.subscription, payload);
    },
  };

  const manager = {
    getRepository(entity) {
      switch (entity.options?.name) {
        case "Subscription":
          return subscriptionRepository;
        case "SubscriptionPayment":
          return paymentRepository;
        case "Transaction":
          return transactionRepository;
        case "PaymentProvider":
          return {
            async findOne() {
              return store.provider;
            },
          };
        case "TransactionCategory":
          return {
            async findOne() {
              return store.category;
            },
          };
        default:
          return {
            async findOne() {
              return null;
            },
          };
      }
    },
    createQueryBuilder() {
      return {
        relation() {
          return this;
        },
        of() {
          return this;
        },
        async set(transactionId) {
          store.relationTransactionId = transactionId;
        },
      };
    },
  };

  const [created, serviceError] = await withPatchedDataSource({
    transaction: async (callback) => callback(manager),
    getRepository(entity) {
      if (entity.options?.name === "SubscriptionPayment") {
        return paymentRepository;
      }
      return manager.getRepository(entity);
    },
  }, () => createManualSubscriptionPaymentService(
    {
      subscription_id: 20,
      fecha_pago: "2026-06-15T00:00:00.000Z",
      monto: 20000,
      moneda: "CLP",
      metodo: "TRANSFERENCIA",
      referencia: "TRX-1",
      observacion: "Pago recibido",
      proximo_cobro: "2030-01-01T00:00:00.000Z",
    },
    {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      authContext: { userId: 7 },
    },
  ));

  assert.equal(serviceError, null);
  assert.equal(store.payments.length, 1);
  assert.equal(store.transactions.length, 1);
  assert.equal(created.monto_fee, 0);
  assert.equal(created.monto_bruto, created.monto_neto);
  assert.equal(created.subscription.payment_provider.clave, "MANUAL");
  assert.equal(created.transaction.category.clave, "APADRINAMIENTO");
  assert.equal(store.subscription.next_billing_time.toISOString(), "2026-07-15T00:00:00.000Z");

  const [replayed, replayError] = await withPatchedDataSource({
    transaction: async (callback) => callback(manager),
    getRepository(entity) {
      if (entity.options?.name === "SubscriptionPayment") {
        return paymentRepository;
      }
      return manager.getRepository(entity);
    },
  }, () => createManualSubscriptionPaymentService(
    {
      subscription_id: 20,
      fecha_pago: "2026-06-15T00:00:00.000Z",
      monto: 20000,
      moneda: "CLP",
      metodo: "TRANSFERENCIA",
      referencia: "TRX-1",
      observacion: "Pago recibido",
      proximo_cobro: "2026-07-15T00:00:00.000Z",
    },
    {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      authContext: { userId: 7 },
    },
  ));

  assert.equal(replayError, null);
  assert.equal(store.payments.length, 1);
  assert.equal(replayed.subscription_payment_id, created.subscription_payment_id);
});

test("createManualSubscriptionPaymentService recalcula el proximo cobro con calendario real", async () => {
  const store = {
    sponsor: { sponsor_id: 1, nombre: "Ana", apellido: "Lopez" },
    animal: { id_animal: 3, nombre: "Luna", especie: "PERRO" },
    plan: { sponsorship_plan_id: 8, nombre: "Plan Base", modalidad: "MANUAL", monto: 20000, moneda: "CLP" },
    provider: { proveedor_pago_id: 5, clave: "MANUAL", nombre: "Manual", tipo: "MANUAL", activo: true },
    category: { categoria_transaccion_id: 11, clave: "APADRINAMIENTO", activo: true },
    subscription: {
      subscription_id: 21,
      estado: "ACTIVA",
      next_billing_time: null,
      last_synced_at: null,
      metadata: null,
      sponsorship: {
        sponsorship_id: 16,
        estado: "ACTIVO",
        sponsor: null,
        animal: null,
        plan: null,
      },
      payment_provider: null,
      payments: [],
    },
    payments: [],
    transactions: [],
    relationTransactionId: null,
  };
  store.subscription.sponsorship.sponsor = store.sponsor;
  store.subscription.sponsorship.animal = store.animal;
  store.subscription.sponsorship.plan = store.plan;
  store.subscription.payment_provider = store.provider;

  const paymentRepository = {
    create(payload) {
      return { subscription_payment_id: store.payments.length + 1, ...payload };
    },
    async save(payload) {
      const saved = { ...payload };
      store.payments.push(saved);
      return saved;
    },
    async findOne({ where }) {
      if (where.provider_payment_id) {
        const payment = store.payments.find((item) => item.provider_payment_id === where.provider_payment_id);
        return payment
          ? {
              ...payment,
              subscription: {
                ...store.subscription,
                sponsorship: store.subscription.sponsorship,
                payment_provider: store.provider,
              },
              transaction: null,
            }
          : null;
      }

      if (where.subscription_payment_id) {
        const payment = store.payments.find(
          (item) => Number(item.subscription_payment_id) === Number(where.subscription_payment_id),
        );
        return payment
          ? {
              ...payment,
              subscription: {
                ...store.subscription,
                sponsorship: store.subscription.sponsorship,
                payment_provider: store.provider,
              },
              transaction: null,
            }
          : null;
      }

      return null;
    },
  };
  const transactionRepository = {
    create(payload) {
      return { transaccion_id: store.transactions.length + 1, ...payload };
    },
    async save(payload) {
      const saved = { ...payload };
      store.transactions.push(saved);
      return saved;
    },
  };
  const subscriptionRepository = {
    async findOne() {
      return {
        ...store.subscription,
        sponsorship: store.subscription.sponsorship,
        payment_provider: store.provider,
        payments: [],
      };
    },
    async update(_where, payload) {
      Object.assign(store.subscription, payload);
    },
  };

  const manager = {
    getRepository(entity) {
      switch (entity.options?.name) {
        case "Subscription":
          return subscriptionRepository;
        case "SubscriptionPayment":
          return paymentRepository;
        case "Transaction":
          return transactionRepository;
        case "PaymentProvider":
          return { async findOne() { return store.provider; } };
        case "TransactionCategory":
          return { async findOne() { return store.category; } };
        default:
          return { async findOne() { return null; } };
      }
    },
    createQueryBuilder() {
      return {
        relation() { return this; },
        of() { return this; },
        async set(transactionId) {
          store.relationTransactionId = transactionId;
        },
      };
    },
  };

  const [created, serviceError] = await withPatchedDataSource({
    transaction: async (callback) => callback(manager),
    getRepository(entity) {
      if (entity.options?.name === "SubscriptionPayment") {
        return paymentRepository;
      }
      return manager.getRepository(entity);
    },
  }, () => createManualSubscriptionPaymentService(
    {
      subscription_id: 21,
      fecha_pago: "2026-01-31T00:00:00.000Z",
      monto: 20000,
      moneda: "CLP",
      metodo: "TRANSFERENCIA",
      referencia: "TRX-31",
      observacion: null,
      proximo_cobro: "2030-01-01T00:00:00.000Z",
    },
    {
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      authContext: { userId: 8 },
    },
  ));

  assert.equal(serviceError, null);
  assert.equal(created.moneda, "CLP");
  assert.equal(store.subscription.next_billing_time.toISOString(), "2026-02-28T00:00:00.000Z");
});

test("cancelSubscriptionService cancela una suscripcion manual sin invocar PayPal", async () => {
  const store = {
    sponsorship: {
      sponsorship_id: 44,
      estado: "ACTIVO",
      cancelado_en: null,
      motivo_cancelacion: null,
      sponsor: { sponsor_id: 2, nombre: "Eva", apellido: "Diaz" },
      animal: { id_animal: 9, nombre: "Milo", especie: "GATO" },
      plan: { sponsorship_plan_id: 3, nombre: "Plan Milo", monto: 12, moneda: "USD" },
    },
    subscription: {
      subscription_id: 50,
      estado: "ACTIVA",
      provider_subscription_id: null,
      provider_plan_id: null,
      payer_email: null,
      approval_url: null,
      next_billing_time: null,
      last_synced_at: null,
      provider_status_updated_at: null,
      metadata: null,
      payment_provider: { proveedor_pago_id: 9, clave: "MANUAL", nombre: "Manual", tipo: "MANUAL" },
      payments: [],
    },
  };
  store.subscription.sponsorship = store.sponsorship;

  const subscriptionRepository = {
    async findOne() {
      return {
        ...store.subscription,
        sponsorship: store.sponsorship,
        payment_provider: store.subscription.payment_provider,
        payments: [],
      };
    },
    async update(_where, payload) {
      Object.assign(store.subscription, payload);
    },
  };
  const sponsorshipRepository = {
    async update(_where, payload) {
      Object.assign(store.sponsorship, payload);
    },
  };

  let cancelCalled = false;

  const [cancelled, serviceError] = await withPatchedDataSource({
    getRepository(entity) {
      return entity.options?.name === "Subscription"
        ? subscriptionRepository
        : {
            async findOne() {
              return null;
            },
          };
    },
    transaction: async (callback) => callback({
      getRepository(entity) {
        if (entity.options?.name === "Subscription") {
          return subscriptionRepository;
        }
        if (entity.options?.name === "Sponsorship") {
          return sponsorshipRepository;
        }
        return {
          async update() {},
        };
      },
    }),
  }, () => cancelSubscriptionService(
    { id: 50 },
    { motivo: "Solicitud interna" },
    {
      cancelFn: async () => {
        cancelCalled = true;
      },
    },
  ));

  assert.equal(serviceError, null);
  assert.equal(cancelCalled, false);
  assert.equal(cancelled.estado, "CANCELADA");
  assert.equal(store.sponsorship.estado, "CANCELADO");
  assert.equal(store.sponsorship.motivo_cancelacion, "Solicitud interna");
});
