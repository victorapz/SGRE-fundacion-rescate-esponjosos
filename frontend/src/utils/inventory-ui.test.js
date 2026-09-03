import assert from "node:assert/strict";
import test from "node:test";

import {
  getDonationActionState,
  getDonationItemActionState,
  getDonorActionState,
  getPurchaseActionState,
  getPurchaseDetailActionState,
  getSupplierActionState,
} from "./inventory-ui.js";

test("getSupplierActionState distingue proveedor activo e inactivo", () => {
  assert.equal(getSupplierActionState({ activo: true }).canDeactivate, true);
  assert.equal(getSupplierActionState({ activo: false }).canReactivate, true);
});

test("getDonorActionState distingue donante activo e inactivo", () => {
  assert.equal(getDonorActionState({ activo: true }).canDeactivate, true);
  assert.equal(getDonorActionState({ activo: false }).canReactivate, true);
});

test("getDonationActionState bloquea donaciones con recepciones historicas", () => {
  const state = getDonationActionState({
    estado: "PENDIENTE",
    donationItems: [{ cantidadRecepcionada: 1, inventoryReceipts: [{ id: 1 }] }],
  });
  assert.equal(state.canEdit, false);
  assert.match(state.reason, /recepciones|movimientos/i);
});

test("getDonationItemActionState bloquea items con recepcion", () => {
  const state = getDonationItemActionState(
    {
      estado: "PENDIENTE",
      donationItems: [{ id: 1, cantidadRecepcionada: 1, inventoryReceipts: [{ id: 1 }] }],
    },
    { id: 1, cantidadRecepcionada: 1, inventoryReceipts: [{ id: 1 }], inventoryMovements: [] },
  );
  assert.equal(state.canEdit, false);
  assert.equal(state.canReceive, true);
});

test("getDonationItemActionState permite seguir recepcionando una líneaparcial abierta", () => {
  const state = getDonationItemActionState(
    {
      estado: "PENDIENTE",
      donationItems: [{ id: 10, cantidadRecepcionada: 1, inventoryReceipts: [{ id: 1 }] }],
    },
    {
      id: 10,
      estado: "PARCIAL",
      cantidadRecepcionada: 1,
      inventoryReceipts: [{ id: 1 }],
      inventoryMovements: [],
    },
  );

  assert.equal(state.canReceive, true);
  assert.equal(state.canViewReceipts, true);
});

test("getPurchaseActionState bloquea compras con movimientos contables", () => {
  const state = getPurchaseActionState({
    estado: "CONFIRMADA",
    payableAccount: { montoPagado: 1000 },
    transactionId: 22,
    purchaseDetails: [],
  });
  assert.equal(state.canDelete, false);
  assert.match(state.reason, /contables|pagos/i);
});

test("getPurchaseActionState permite confirmar borrador con detalles", () => {
  const state = getPurchaseActionState({
    estado: "BORRADOR",
    purchaseDetails: [{ id: 1 }],
  });
  assert.equal(state.canConfirm, true);
  assert.equal(state.canEditDetails, true);
});

test("getPurchaseDetailActionState bloquea detalles con movimientos", () => {
  const state = getPurchaseDetailActionState(
    { estado: "CONFIRMADA", purchaseDetails: [] },
    { cantidadRecepcionada: 0, inventoryMovements: [{}] },
  );
  assert.equal(state.canDelete, false);
  assert.equal(state.canReceive, true);
});

test("getPurchaseDetailActionState bloquea detalle cerrado y conserva historial", () => {
  const state = getPurchaseDetailActionState(
    { estado: "CONFIRMADA", purchaseDetails: [] },
    {
      estado: "CERRADO_INCOMPLETO",
      cantidadRecepcionada: 1,
      inventoryReceipts: [{ id: 1 }],
      inventoryMovements: [{ id: 2 }],
    },
  );

  assert.equal(state.canReceive, false);
  assert.equal(state.canViewReceipts, true);
});
