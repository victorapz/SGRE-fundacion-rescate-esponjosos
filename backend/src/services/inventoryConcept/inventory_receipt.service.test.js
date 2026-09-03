import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveInventoryReceiptDetailState,
  deriveInventoryReceiptHeaderState,
} from "./inventory.shared.js";
import {
  assertInventoryReceiptIdempotencyMatch,
  buildLockedRowQuery,
  deriveBulkReceiptIdempotencyKey,
  isInventoryReceiptUniqueViolation,
  lockBaseRowOrThrow,
  normalizeBulkReceiptDetailIds,
  sumInventoryReceiptQuantities,
} from "./inventory_receipt.service.js";

test("deriveInventoryReceiptDetailState calcula parcial abierto, completo y cierre incompleto", () => {
  assert.deepEqual(
    deriveInventoryReceiptDetailState({
      expectedQuantity: 4,
      receivedQuantity: 0,
      closeDetail: false,
    }),
    {
      estado: "PENDIENTE",
      cerrado: false,
      cierre_incompleto: false,
      cantidad_pendiente: 4,
    },
  );

  assert.deepEqual(
    deriveInventoryReceiptDetailState({
      expectedQuantity: 4,
      receivedQuantity: 3,
      closeDetail: false,
    }),
    {
      estado: "PARCIAL",
      cerrado: false,
      cierre_incompleto: false,
      cantidad_pendiente: 1,
    },
  );

  assert.deepEqual(
    deriveInventoryReceiptDetailState({
      expectedQuantity: 4,
      receivedQuantity: 4,
      closeDetail: true,
    }),
    {
      estado: "COMPLETO",
      cerrado: true,
      cierre_incompleto: false,
      cantidad_pendiente: 0,
    },
  );

  assert.deepEqual(
    deriveInventoryReceiptDetailState({
      expectedQuantity: 4,
      receivedQuantity: 2,
      closeDetail: true,
    }),
    {
      estado: "CERRADO_INCOMPLETO",
      cerrado: true,
      cierre_incompleto: true,
      cantidad_pendiente: 2,
    },
  );
});

test("deriveInventoryReceiptHeaderState solo completa cuando todas las lineas cierran", () => {
  assert.equal(
    deriveInventoryReceiptHeaderState([
      { estado: "COMPLETO", cantidad_recepcionada: 4 },
      { estado: "PARCIAL", cantidad_recepcionada: 1 },
    ]),
    "PARCIAL",
  );

  assert.equal(
    deriveInventoryReceiptHeaderState([
      { estado: "COMPLETO", cantidad_recepcionada: 4 },
      { estado: "CERRADO_INCOMPLETO", cantidad_recepcionada: 1 },
    ]),
    "COMPLETA",
  );
});

test("sumInventoryReceiptQuantities suma el historial de recepciones", () => {
  assert.equal(
    sumInventoryReceiptQuantities([{ cantidad: 3 }, { cantidad: "1.5" }, { cantidad: 0 }]),
    4.5,
  );
});

test("buildLockedRowQuery aplica lock pesimista sobre la fila base", async () => {
  const calls = [];
  const queryBuilder = {
    setLock(lockMode) {
      calls.push(["setLock", lockMode]);
      return this;
    },
    where(sql, params) {
      calls.push(["where", sql, params]);
      return this;
    },
    async getOne() {
      calls.push(["getOne"]);
      return { detalle_compra_id: 10 };
    },
  };

  const repository = {
    createQueryBuilder(alias) {
      calls.push(["createQueryBuilder", alias]);
      return queryBuilder;
    },
  };

  const built = buildLockedRowQuery(repository, "purchaseDetail", "detalle_compra_id", 10);
  assert.equal(await built.getOne().then((entity) => entity.detalle_compra_id), 10);
  assert.deepEqual(calls, [
    ["createQueryBuilder", "purchaseDetail"],
    ["setLock", "pessimistic_write"],
    ["where", "purchaseDetail.detalle_compra_id = :idValue", { idValue: 10 }],
    ["getOne"],
  ]);
});

test("lockBaseRowOrThrow falla con mensaje humano si la fila no existe", async () => {
  const repository = {
    createQueryBuilder() {
      return {
        setLock() {
          return this;
        },
        where() {
          return this;
        },
        async getOne() {
          return null;
        },
      };
    },
  };

  await assert.rejects(
    () =>
      lockBaseRowOrThrow(repository, {
        alias: "purchaseDetail",
        idField: "detalle_compra_id",
        idValue: 55,
        notFoundMessage: "Detalle no encontrado.",
      }),
    /Detalle no encontrado/i,
  );
});

test("isInventoryReceiptUniqueViolation detecta duplicados de idempotency_key", () => {
  assert.equal(
    isInventoryReceiptUniqueViolation({
      code: "23505",
      detail: 'Key ("idempotency_key")=(abc) already exists.',
    }),
    true,
  );
  assert.equal(
    isInventoryReceiptUniqueViolation({
      code: "23505",
      detail: 'Key ("otro")=(abc) already exists.',
    }),
    false,
  );
});

test("normalizeBulkReceiptDetailIds elimina duplicados y ordena para bloquear consistentemente", () => {
  assert.deepEqual(normalizeBulkReceiptDetailIds([9, "2", 5, 2, 9]), [2, 5, 9]);
  assert.throws(
    () => normalizeBulkReceiptDetailIds([]),
    /seleccionar al menos un detalle/i,
  );
});

test("deriveBulkReceiptIdempotencyKey genera UUID v5 determinista por detalle", () => {
  const base = {
    batchIdempotencyKey: "b2c91980-bb3d-4cd8-b201-5d706201ca55",
    sourceType: "PURCHASE",
    parentId: 12,
    detailId: 31,
  };
  const first = deriveBulkReceiptIdempotencyKey(base);
  const second = deriveBulkReceiptIdempotencyKey(base);
  const otherDetail = deriveBulkReceiptIdempotencyKey({ ...base, detailId: 32 });

  assert.equal(first, second);
  assert.notEqual(first, otherDetail);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("assertInventoryReceiptIdempotencyMatch rechaza reutilizacion en otro detalle", () => {
  const receipt = {
    purchase_detail: { detalle_compra_id: 10 },
    donation_item: null,
  };

  assert.doesNotThrow(() =>
    assertInventoryReceiptIdempotencyMatch(receipt, {
      sourceType: "PURCHASE",
      detailId: 10,
    }));

  assert.throws(
    () =>
      assertInventoryReceiptIdempotencyMatch(receipt, {
        sourceType: "PURCHASE",
        detailId: 11,
      }),
    /otra recepcion/i,
  );

  assert.throws(
    () =>
      assertInventoryReceiptIdempotencyMatch(receipt, {
        sourceType: "DONATION",
        detailId: 10,
      }),
    /otra recepcion/i,
  );
});
