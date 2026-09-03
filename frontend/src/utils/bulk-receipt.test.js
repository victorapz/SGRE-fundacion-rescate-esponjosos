import assert from "node:assert/strict";
import test from "node:test";

import {
  bulkReceiptPendingQuantity,
  defaultBulkReceiptSelection,
  isBulkReceiptSelectable,
  reconcileBulkReceiptSelection,
} from "./bulk-receipt.js";

test("bulkReceiptPendingQuantity usa el pendiente informado o lo calcula", () => {
  assert.equal(bulkReceiptPendingQuantity({ cantidadPendiente: 3 }), 3);
  assert.equal(
    bulkReceiptPendingQuantity({ cantidad: 5, cantidadRecepcionada: 2 }),
    3,
  );
});

test("defaultBulkReceiptSelection selecciona solo pendientes sin recepciones", () => {
  const lines = [
    { id: 1, estado: "PENDIENTE", cantidadPendiente: 4, inventoryReceipts: [] },
    { id: 2, estado: "PARCIAL", cantidadPendiente: 2, cantidadRecepcionada: 1, inventoryReceipts: [{ id: 9 }] },
    { id: 3, estado: "COMPLETO", cantidadPendiente: 0, cerrado: true },
  ];

  assert.deepEqual(defaultBulkReceiptSelection(lines, false), ["1"]);
  assert.deepEqual(defaultBulkReceiptSelection(lines, true), ["1", "2"]);
});

test("isBulkReceiptSelectable excluye cerrados y parciales cuando corresponde", () => {
  assert.equal(
    isBulkReceiptSelectable({ estado: "PARCIAL", cantidadPendiente: 2 }, false),
    false,
  );
  assert.equal(
    isBulkReceiptSelectable({ estado: "PARCIAL", cantidadPendiente: 2 }, true),
    true,
  );
  assert.equal(
    isBulkReceiptSelectable({ estado: "CERRADO_INCOMPLETO", cantidadPendiente: 2 }, true),
    false,
  );
});

test("reconcileBulkReceiptSelection incorpora y retira parciales al cambiar la opcion", () => {
  const lines = [
    { id: 1, estado: "PENDIENTE", cantidadPendiente: 4 },
    { id: 2, estado: "PARCIAL", cantidadPendiente: 2, cantidadRecepcionada: 1 },
  ];

  assert.deepEqual(
    reconcileBulkReceiptSelection(lines, ["1"], true).sort(),
    ["1", "2"],
  );
  assert.deepEqual(
    reconcileBulkReceiptSelection(lines, ["1", "2"], false),
    ["1"],
  );
});
