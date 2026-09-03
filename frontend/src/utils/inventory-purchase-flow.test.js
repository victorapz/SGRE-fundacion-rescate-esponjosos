import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePurchaseSubtotal,
  calculatePurchaseTotal,
  parseEntityIdOrThrow,
} from "./inventory-purchase-flow.js";

test("parseEntityIdOrThrow acepta ids validos", () => {
  assert.equal(parseEntityIdOrThrow("12", "compra"), 12);
});

test("parseEntityIdOrThrow rechaza undefined, null y NaN", () => {
  assert.throws(() => parseEntityIdOrThrow(undefined, "compra"), /compra/i);
  assert.throws(() => parseEntityIdOrThrow("undefined", "donacion"), /donacion/i);
  assert.throws(() => parseEntityIdOrThrow("NaN", "proveedor"), /proveedor/i);
});

test("calculatePurchaseSubtotal y total calculan montos en frontend", () => {
  assert.equal(calculatePurchaseSubtotal(4, 3500), 14000);
  assert.equal(calculatePurchaseSubtotal(2, 1000), 2000);
  assert.equal(
    calculatePurchaseTotal([
      { subtotal: 14000 },
      { subtotal: 2000 },
    ]),
    16000,
  );
});
