import assert from "node:assert/strict";
import test from "node:test";

import {
  getDonationGeneralStatus,
  getInventoryStatusMeta,
  inventoryStatusLabel,
} from "./inventory-status.js";

test("inventoryStatusLabel traduce estados tecnicos", () => {
  assert.equal(inventoryStatusLabel("CERRADO_INCOMPLETO"), "Cerrado incompleto");
  assert.equal(inventoryStatusLabel("PAGADA_PARCIAL"), "Pagada parcialmente");
});

test("inventoryStatusLabel humaniza estados desconocidos", () => {
  assert.equal(inventoryStatusLabel("OTRO_ESTADO_NUEVO"), "Otro estado nuevo");
});

test("getInventoryStatusMeta entrega tono y etiqueta", () => {
  assert.deepEqual(getInventoryStatusMeta("VENCIDA"), {
    label: "Vencida",
    tone: "danger",
  });
});

test("getDonationGeneralStatus separa cancelacion de recepcion", () => {
  assert.equal(getDonationGeneralStatus({ estado: "PENDIENTE" }), "ACTIVA");
  assert.equal(getDonationGeneralStatus({ estado: "CANCELADO" }), "CANCELADA");
});
