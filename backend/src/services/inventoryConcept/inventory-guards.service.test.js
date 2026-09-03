import assert from "node:assert/strict";
import test from "node:test";

import { assertPurchaseCanBeCancelledFromInventory } from "./purchase.service.js";
import { assertPurchaseDetailMutable } from "./purchase_detail.service.js";
import { assertDonationHeaderEditable } from "./donation.service.js";
import { assertDonationItemMutable } from "./donation_item.service.js";

test("assertPurchaseCanBeCancelledFromInventory permite cancelar borradores con detalles sin recepcion", () => {
  assert.doesNotThrow(() =>
    assertPurchaseCanBeCancelledFromInventory({
      estado: "BORRADOR",
      purchase_details: [{ cantidad_recepcionada: 0, inventory_movements: [] }],
    }));
});

test("assertPurchaseCanBeCancelledFromInventory bloquea compras con recepciones", () => {
  assert.throws(
    () =>
      assertPurchaseCanBeCancelledFromInventory({
        estado: "CONFIRMADA",
        purchase_details: [{ cantidad_recepcionada: 1, inventory_movements: [] }],
      }),
    /recepciones registradas/i,
  );
});

test("assertPurchaseCanBeCancelledFromInventory bloquea compras confirmadas con movimientos contables", () => {
  assert.throws(
    () =>
      assertPurchaseCanBeCancelledFromInventory({
        estado: "CONFIRMADA",
        transaction: { transaccion_id: 22 },
        purchase_details: [{ cantidad_recepcionada: 0, inventory_movements: [] }],
      }),
    /contables/i,
  );
});

test("assertPurchaseDetailMutable bloquea detalle recepcionado o con movimientos", () => {
  assert.throws(
    () =>
      assertPurchaseDetailMutable({
        cantidad_recepcionada: 1,
        inventory_movements: [],
        purchase: { estado: "BORRADOR" },
      }),
    /recepciones registradas/i,
  );

  assert.throws(
    () =>
      assertPurchaseDetailMutable({
        cantidad_recepcionada: 0,
        inventory_movements: [{}],
        purchase: { estado: "BORRADOR" },
      }),
    /movimientos de inventario/i,
  );
});

test("assertDonationHeaderEditable bloquea donaciones canceladas", () => {
  assert.throws(
    () => assertDonationHeaderEditable({ estado: "CANCELADO" }),
    /donacion cancelada/i,
  );
});

test("assertDonationItemMutable bloquea items recepcionados o con movimientos", () => {
  assert.throws(
    () =>
      assertDonationItemMutable({
        cantidad_recepcionada: 1,
        inventory_movement: [],
        donation: { estado: "PENDIENTE" },
      }),
    /recepciones registradas/i,
  );

  assert.throws(
    () =>
      assertDonationItemMutable({
        cantidad_recepcionada: 0,
        inventory_movement: [{}],
        donation: { estado: "PENDIENTE" },
      }),
    /movimientos de inventario/i,
  );
});
