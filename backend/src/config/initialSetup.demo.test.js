import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_PURCHASES, ensureTransactionRecord } from "./initialSetup.demo.js";

function createTransactionRepositoryStub() {
  const records = new Map();
  let sequence = 1;

  return {
    async findOne({ where }) {
      return records.get(where.idempotencia_key) ?? null;
    },
    create(payload) {
      return {
        transaccion_id: sequence++,
        ...payload,
      };
    },
    async save(entity) {
      const normalized = {
        ...entity,
        transaccion_id: entity.transaccion_id ?? sequence++,
      };
      records.set(normalized.idempotencia_key, normalized);
      return normalized;
    },
    get size() {
      return records.size;
    },
  };
}

test("el escenario demo pendiente no asocia transaccion contable automaticamente", () => {
  const pendingPurchase = DEMO_PURCHASES.find((purchase) => purchase.key === "pendingPurchase");
  assert.equal(Boolean(pendingPurchase?.transactionKey), false);
  assert.equal(Boolean(pendingPurchase?.isPaid), false);
});

test("el escenario demo pagado conserva transactionKey explicita", () => {
  const paidPurchase = DEMO_PURCHASES.find((purchase) => purchase.key === "partialPurchase");
  assert.equal(Boolean(paidPurchase?.isPaid), true);
  assert.equal(typeof paidPurchase?.transactionKey, "string");
  assert.ok(paidPurchase.transactionKey.length > 0);
});

test("ensureTransactionRecord reutiliza la transaccion demo y no la duplica", async () => {
  const repository = createTransactionRepositoryStub();
  const createdByUser = { id_usuario: 7 };

  const firstTransaction = await ensureTransactionRecord(
    repository,
    "seed-demo-paid",
    36000,
    createdByUser,
  );
  const secondTransaction = await ensureTransactionRecord(
    repository,
    "seed-demo-paid",
    36000,
    createdByUser,
  );

  assert.equal(firstTransaction.transaccion_id, secondTransaction.transaccion_id);
  assert.equal(repository.size, 1);
});
