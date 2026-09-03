import assert from "node:assert/strict";
import test from "node:test";

import { AppDataSource } from "./inventory.shared.js";
import { receiveDonationItemsBulkService } from "./donation_item.service.js";
import { receivePurchaseDetailsBulkService } from "./purchase_detail.service.js";

function entityName(entity) {
  return entity?.options?.name || entity;
}

function buildStore(sourceType = "PURCHASE") {
  const isPurchase = sourceType === "PURCHASE";
  const parent = isPurchase
    ? { compra_id: 12, estado: "CONFIRMADA", fecha_recepcion: null, purchase_details: [] }
    : { donacion_id: 8, estado: "PENDIENTE", fecha_recepcion: null, donation_item: [] };
  const itemA = { item_id: 101, nombre: "Heno", activo: true };
  const itemB = { item_id: 102, nombre: "Pellet", activo: true };
  const detailA = isPurchase
    ? {
        detalle_compra_id: 31,
        cantidad: 5,
        cantidad_recepcionada: 0,
        estado: "PENDIENTE",
        recepcion_parcial_definitiva: false,
        purchase: parent,
        item: itemA,
        inventory_receipts: [],
        inventory_movements: [],
      }
    : {
        donacion_individual_id: 20,
        cantidad: 5,
        cantidad_recepcionada: 0,
        estado: "PENDIENTE",
        recepcion_parcial_definitiva: false,
        donation: parent,
        item: itemA,
        inventory_receipts: [],
        inventory_movement: [],
      };
  const detailB = isPurchase
    ? {
        detalle_compra_id: 32,
        cantidad: 4,
        cantidad_recepcionada: 1,
        estado: "PARCIAL",
        recepcion_parcial_definitiva: false,
        purchase: parent,
        item: itemB,
        inventory_receipts: [{
          recepcion_inventario_id: 900,
          cantidad: 1,
          idempotency_key: "existing-history",
        }],
        inventory_movements: [],
      }
    : {
        donacion_individual_id: 21,
        cantidad: 4,
        cantidad_recepcionada: 1,
        estado: "PARCIAL",
        recepcion_parcial_definitiva: false,
        donation: parent,
        item: itemB,
        inventory_receipts: [{
          recepcion_inventario_id: 900,
          cantidad: 1,
          idempotency_key: "existing-history",
        }],
        inventory_movement: [],
      };

  if (isPurchase) parent.purchase_details = [detailA, detailB];
  else parent.donation_item = [detailA, detailB];

  return {
    sourceType,
    parent,
    details: [detailA, detailB],
    receipts: [],
    movements: [],
    existences: [],
    location: {
      ubicacion_id: 4,
      nombre: "Bodega principal",
      direccion: "Fundacion",
      activo: true,
    },
    user: {
      id_usuario: 7,
      nombre: "Victor",
      apellido: "Perez",
      email: "victor@example.com",
      activo: true,
    },
    failMovementNumber: null,
    movementSaveCount: 0,
    lockOrder: [],
  };
}

function snapshotStore(store) {
  return {
    receipts: [...store.receipts],
    movements: [...store.movements],
    existences: [...store.existences],
    parentReceiptDate: store.parent.fecha_recepcion,
    movementSaveCount: store.movementSaveCount,
    details: store.details.map((detail) => ({
      cantidad_recepcionada: detail.cantidad_recepcionada,
      estado: detail.estado,
      recepcion_parcial_definitiva: detail.recepcion_parcial_definitiva,
      inventory_receipts: [...detail.inventory_receipts],
      inventory_movements: [...(detail.inventory_movements || [])],
      inventory_movement: [...(detail.inventory_movement || [])],
    })),
  };
}

function restoreStore(store, snapshot) {
  store.receipts.splice(0, store.receipts.length, ...snapshot.receipts);
  store.movements.splice(0, store.movements.length, ...snapshot.movements);
  store.existences.splice(0, store.existences.length, ...snapshot.existences);
  store.parent.fecha_recepcion = snapshot.parentReceiptDate;
  store.movementSaveCount = snapshot.movementSaveCount;
  store.details.forEach((detail, index) => {
    Object.assign(detail, {
      cantidad_recepcionada: snapshot.details[index].cantidad_recepcionada,
      estado: snapshot.details[index].estado,
      recepcion_parcial_definitiva:
        snapshot.details[index].recepcion_parcial_definitiva,
    });
    detail.inventory_receipts.splice(
      0,
      detail.inventory_receipts.length,
      ...snapshot.details[index].inventory_receipts,
    );
    if (detail.inventory_movements) {
      detail.inventory_movements.splice(
        0,
        detail.inventory_movements.length,
        ...snapshot.details[index].inventory_movements,
      );
    }
    if (detail.inventory_movement) {
      detail.inventory_movement.splice(
        0,
        detail.inventory_movement.length,
        ...snapshot.details[index].inventory_movement,
      );
    }
  });
}

function createManager(store) {
  const isPurchase = store.sourceType === "PURCHASE";
  const detailIdField = isPurchase ? "detalle_compra_id" : "donacion_individual_id";
  const parentIdField = isPurchase ? "compra_id" : "donacion_id";

  function detailById(id) {
    return store.details.find((detail) => Number(detail[detailIdField]) === Number(id)) || null;
  }

  function relationDetail(payload) {
    const id = isPurchase
      ? payload.purchase_detail?.detalle_compra_id
      : payload.donation_item?.donacion_individual_id;
    return detailById(id);
  }

  function createLockingQuery(name, alias) {
    let idValue;
    return {
      setLock(mode) {
        assert.equal(mode, "pessimistic_write");
        return this;
      },
      where(_sql, params) {
        idValue = params.idValue;
        return this;
      },
      async getOne() {
        store.lockOrder.push(`${name}:${idValue}`);
        if (name === "PurchaseDetail" || name === "DonationItem") {
          return detailById(idValue);
        }
        if (name === "Purchase" || name === "Donation") {
          return Number(store.parent[parentIdField]) === Number(idValue)
            ? store.parent
            : null;
        }
        throw new Error(`QueryBuilder no soportado para ${name} (${alias}).`);
      },
    };
  }

  const repositories = {
    PurchaseDetail: {
      createQueryBuilder: (alias) => createLockingQuery("PurchaseDetail", alias),
      async findOne({ where }) {
        return detailById(where.detalle_compra_id);
      },
      async update(criteria, values) {
        Object.assign(detailById(criteria.detalle_compra_id), values);
      },
    },
    DonationItem: {
      createQueryBuilder: (alias) => createLockingQuery("DonationItem", alias),
      async findOne({ where }) {
        return detailById(where.donacion_individual_id);
      },
      async update(criteria, values) {
        Object.assign(detailById(criteria.donacion_individual_id), values);
      },
    },
    Purchase: {
      createQueryBuilder: (alias) => createLockingQuery("Purchase", alias),
      async findOne({ where }) {
        return Number(where.compra_id) === Number(store.parent.compra_id)
          ? store.parent
          : null;
      },
      async save(entity) {
        return entity;
      },
    },
    Donation: {
      createQueryBuilder: (alias) => createLockingQuery("Donation", alias),
      async findOne({ where }) {
        return Number(where.donacion_id) === Number(store.parent.donacion_id)
          ? store.parent
          : null;
      },
      async save(entity) {
        return entity;
      },
    },
    InventoryReceipt: {
      create(payload) {
        return { ...payload };
      },
      async findOne({ where }) {
        if (where.idempotency_key) {
          return store.receipts.find(
            (receipt) => receipt.idempotency_key === where.idempotency_key,
          ) || null;
        }
        return store.receipts.find(
          (receipt) => Number(receipt.recepcion_inventario_id)
            === Number(where.recepcion_inventario_id),
        ) || null;
      },
      async save(payload) {
        const detail = relationDetail(payload);
        const receipt = {
          ...payload,
          recepcion_inventario_id: 1000 + store.receipts.length,
          purchase_detail: isPurchase ? detail : null,
          donation_item: isPurchase ? null : detail,
          destination_location: store.location,
          performed_by: store.user,
          movement: store.movements.find(
            (movement) => Number(movement.movimiento_id)
              === Number(payload.movement?.movimiento_id),
          ) || null,
        };
        store.receipts.push(receipt);
        detail.inventory_receipts.push(receipt);
        return receipt;
      },
    },
    InventoryMovement: {
      create(payload) {
        return { ...payload };
      },
      async save(payload) {
        store.movementSaveCount += 1;
        if (store.failMovementNumber === store.movementSaveCount) {
          throw new Error("Fallo simulado al crear el movimiento.");
        }
        const detail = relationDetail(payload);
        const movement = {
          ...payload,
          movimiento_id: 2000 + store.movements.length,
          item: detail.item,
          source_location: null,
          destination_location: store.location,
          performed_by: store.user,
          purchase_detail: isPurchase ? detail : null,
          donation_item: isPurchase ? null : detail,
        };
        store.movements.push(movement);
        if (isPurchase) detail.inventory_movements.push(movement);
        else detail.inventory_movement.push(movement);
        return movement;
      },
      async findOne({ where }) {
        return store.movements.find(
          (movement) => Number(movement.movimiento_id) === Number(where.movimiento_id),
        ) || null;
      },
    },
    InventoryExistence: {
      create(payload) {
        return { ...payload };
      },
      async find({ where }) {
        return store.existences.filter(
          (existence) => Number(existence.item?.item_id) === Number(where.item.item_id)
            && Number(existence.location?.ubicacion_id)
              === Number(where.location.ubicacion_id),
        );
      },
      async findOne({ where }) {
        return store.existences.find(
          (existence) => Number(existence.existencia_id)
            === Number(where.existencia_id),
        ) || null;
      },
      async save(payload) {
        if (payload.existencia_id) return payload;
        const detail = store.details.find(
          (candidate) => Number(candidate.item.item_id)
            === Number(payload.item?.item_id),
        );
        const existence = {
          ...payload,
          existencia_id: 3000 + store.existences.length,
          item: detail.item,
          location: store.location,
        };
        store.existences.push(existence);
        return existence;
      },
    },
    Location: {
      async findOne({ where }) {
        return Number(where.ubicacion_id) === Number(store.location.ubicacion_id)
          ? store.location
          : null;
      },
    },
    User: {
      async findOne({ where }) {
        return Number(where.id_usuario) === Number(store.user.id_usuario)
          && where.activo === true
          ? store.user
          : null;
      },
    },
  };

  return {
    getRepository(entity) {
      const name = entityName(entity);
      const repository = repositories[name];
      if (!repository) throw new Error(`Repositorio falso no definido: ${name}`);
      return repository;
    },
  };
}

async function withFakeTransaction(store, callback) {
  const manager = createManager(store);
  const snapshot = snapshotStore(store);
  try {
    return await callback(manager);
  } catch (error) {
    restoreStore(store, snapshot);
    throw error;
  }
}

function authContext() {
  return {
    userId: 7,
    permissions: ["inventory:inventory_movement:create"],
  };
}

async function withPatchedTransaction(store, callback) {
  const originalTransaction = AppDataSource.transaction;
  AppDataSource.transaction = async (transactionCallback) =>
    withFakeTransaction(store, transactionCallback);
  try {
    return await callback();
  } finally {
    AppDataSource.transaction = originalTransaction;
  }
}

test("recepcion masiva de compra completa pendientes y parciales en una transaccion", async () => {
  const store = buildStore("PURCHASE");
  const [result, error] = await withPatchedTransaction(store, () =>
    receivePurchaseDetailsBulkService({
      purchase_id: 12,
      purchase_detail_ids: [32, 31],
      destination_location_id: 4,
      fecha_recepcion: "2026-07-06",
      observaciones: "Lote semanal",
      idempotency_key: "b2c91980-bb3d-4cd8-b201-5d706201ca55",
    }, authContext()));

  assert.equal(error, null);
  assert.equal(result.processed_count, 2);
  assert.equal(store.receipts.length, 2);
  assert.equal(store.movements.length, 2);
  assert.equal(store.existences.length, 2);
  assert.deepEqual(store.details.map((detail) => detail.estado), ["COMPLETO", "COMPLETO"]);
  assert.deepEqual(store.details.map((detail) => detail.cantidad_recepcionada), [5, 4]);
  assert.equal(store.parent.fecha_recepcion, "2026-07-06");
  assert.deepEqual(store.lockOrder.slice(0, 3), [
    "PurchaseDetail:31",
    "PurchaseDetail:32",
    "Purchase:12",
  ]);
});

test("reintentar el mismo lote no duplica recepciones, movimientos ni existencias", async () => {
  const store = buildStore("PURCHASE");
  const payload = {
    purchase_id: 12,
    purchase_detail_ids: [31, 32],
    destination_location_id: 4,
    fecha_recepcion: "2026-07-06",
    observaciones: null,
    idempotency_key: "b2c91980-bb3d-4cd8-b201-5d706201ca55",
  };

  await withPatchedTransaction(store, () =>
    receivePurchaseDetailsBulkService(payload, authContext()));
  const firstCounts = [store.receipts.length, store.movements.length, store.existences.length];
  const [replayed, replayError] = await withPatchedTransaction(store, () =>
    receivePurchaseDetailsBulkService(payload, authContext()));

  assert.equal(replayError, null);
  assert.equal(replayed.processed_count, 2);
  assert.deepEqual(
    [store.receipts.length, store.movements.length, store.existences.length],
    firstCounts,
  );
});

test("un fallo en una línearevierte recepciones, movimientos, existencias y estados previos", async () => {
  const store = buildStore("PURCHASE");
  store.failMovementNumber = 2;

  const [result, error] = await withPatchedTransaction(store, () =>
    receivePurchaseDetailsBulkService({
      purchase_id: 12,
      purchase_detail_ids: [31, 32],
      destination_location_id: 4,
      fecha_recepcion: "2026-07-06",
      observaciones: null,
      idempotency_key: "6ec59718-59dc-4a65-946f-96d0728fabd0",
    }, authContext()));

  assert.equal(result, null);
  assert.match(error || "", /fallo simulado/i);
  assert.equal(store.receipts.length, 0);
  assert.equal(store.movements.length, 0);
  assert.equal(store.existences.length, 0);
  assert.deepEqual(store.details.map((detail) => detail.cantidad_recepcionada), [0, 1]);
  assert.deepEqual(store.details.map((detail) => detail.estado), ["PENDIENTE", "PARCIAL"]);
  assert.equal(store.parent.fecha_recepcion, null);
});

test("recepcion masiva de donacion crea una recepcion por item", async () => {
  const store = buildStore("DONATION");
  const [result, error] = await withPatchedTransaction(store, () =>
    receiveDonationItemsBulkService({
      donation_id: 8,
      donation_item_ids: [20, 21],
      destination_location_id: 4,
      fecha_recepcion: "2026-07-06",
      observaciones: null,
      idempotency_key: "22514bb5-9006-442a-a0e8-050a37242db5",
    }, authContext()));

  assert.equal(error, null);
  assert.equal(result.processed_count, 2);
  assert.equal(store.receipts.length, 2);
  assert.equal(store.movements.length, 2);
  assert.equal(store.parent.fecha_recepcion, "2026-07-06");
});

test("el lote rechaza detalles que no pertenecen a la cabecera indicada", async () => {
  const store = buildStore("PURCHASE");
  const [result, error] = await withPatchedTransaction(store, () =>
    receivePurchaseDetailsBulkService({
      purchase_id: 99,
      purchase_detail_ids: [31],
      destination_location_id: 4,
      fecha_recepcion: "2026-07-06",
      observaciones: null,
      idempotency_key: "4014e84d-c295-47e5-a48f-0fb45b6d8876",
    }, authContext()));

  assert.equal(result, null);
  assert.match(error || "", /no pertenece/i);
  assert.equal(store.receipts.length, 0);
  assert.equal(store.movements.length, 0);
});

test("rechaza compras que no estan confirmadas sin generar efectos", async () => {
  const store = buildStore("PURCHASE");
  store.parent.estado = "BORRADOR";

  const [result, error] = await withPatchedTransaction(store, () =>
    receivePurchaseDetailsBulkService({
      purchase_id: 12,
      purchase_detail_ids: [31],
      destination_location_id: 4,
      fecha_recepcion: "2026-07-06",
      observaciones: null,
      idempotency_key: "950ae72c-827e-424c-9082-dd91d7b56ef2",
    }, authContext()));

  assert.equal(result, null);
  assert.match(error || "", /confirmada/i);
  assert.equal(store.receipts.length, 0);
  assert.equal(store.movements.length, 0);
});

test("rechaza donaciones canceladas sin generar efectos", async () => {
  const store = buildStore("DONATION");
  store.parent.estado = "CANCELADO";

  const [result, error] = await withPatchedTransaction(store, () =>
    receiveDonationItemsBulkService({
      donation_id: 8,
      donation_item_ids: [20],
      destination_location_id: 4,
      fecha_recepcion: "2026-07-06",
      observaciones: null,
      idempotency_key: "68322a04-c474-45d4-af9d-2050563db714",
    }, authContext()));

  assert.equal(result, null);
  assert.match(error || "", /cancelada/i);
  assert.equal(store.receipts.length, 0);
  assert.equal(store.movements.length, 0);
});

test("rechaza lineas cerradas aun cuando conserven cantidad pendiente", async () => {
  const store = buildStore("PURCHASE");
  store.details[0].estado = "CERRADO_INCOMPLETO";
  store.details[0].recepcion_parcial_definitiva = true;
  store.details[0].cantidad_recepcionada = 2;
  store.details[0].inventory_receipts.push({ cantidad: 2 });

  const [result, error] = await withPatchedTransaction(store, () =>
    receivePurchaseDetailsBulkService({
      purchase_id: 12,
      purchase_detail_ids: [31],
      destination_location_id: 4,
      fecha_recepcion: "2026-07-06",
      observaciones: null,
      idempotency_key: "757e129d-849f-4ece-b476-62bdc701e16b",
    }, authContext()));

  assert.equal(result, null);
  assert.match(error || "", /cerrado/i);
  assert.equal(store.receipts.length, 0);
  assert.equal(store.movements.length, 0);
});
