import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePurchaseDetailSubtotal,
  calculatePurchaseTotalFromDetails,
} from "./purchase.service.js";

test("calculatePurchaseDetailSubtotal calcula subtotal valido", () => {
  assert.equal(
    calculatePurchaseDetailSubtotal({
      cantidad: 4,
      precio_unitario: 3500,
    }),
    14000,
  );
});

test("calculatePurchaseDetailSubtotal rechaza precio CLP decimal", () => {
  assert.throws(
    () =>
      calculatePurchaseDetailSubtotal(
        {
          cantidad: 1,
          precio_unitario: 1999.5,
        },
        { moneda: "CLP" },
      ),
    /CLP/i,
  );
});

test("calculatePurchaseTotalFromDetails ignora subtotal cliente y recalcula desde cantidad por precio", () => {
  assert.equal(
    calculatePurchaseTotalFromDetails(
      [
        { cantidad: 2, precio_unitario: 5000, subtotal: 1 },
        { cantidad: 3, precio_unitario: 2000, subtotal: 1 },
      ],
      { moneda: "CLP" },
    ),
    16000,
  );
});
