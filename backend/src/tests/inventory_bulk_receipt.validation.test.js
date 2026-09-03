import assert from "node:assert/strict";
import test from "node:test";

import { receiveDonationItemsBulkValidation } from "../validations/donation_item.validation.js";
import { receivePurchaseDetailsBulkValidation } from "../validations/purchase_detail.validation.js";

const commonPayload = {
  destination_location_id: 4,
  fecha_recepcion: "2026-07-06",
  observaciones: "Recepcion semanal",
  idempotency_key: "b2c91980-bb3d-4cd8-b201-5d706201ca55",
};

test("receivePurchaseDetailsBulkValidation acepta un lote valido", () => {
  const { error, value } = receivePurchaseDetailsBulkValidation.validate({
    ...commonPayload,
    purchase_id: 12,
    purchase_detail_ids: [31, 32, 35],
  });

  assert.equal(error, undefined);
  assert.deepEqual(value.purchase_detail_ids, [31, 32, 35]);
});

test("receiveDonationItemsBulkValidation acepta un lote valido", () => {
  const { error } = receiveDonationItemsBulkValidation.validate({
    ...commonPayload,
    donation_id: 8,
    donation_item_ids: [20, 21],
  });

  assert.equal(error, undefined);
});

test("las validaciones masivas rechazan lotes vacios y duplicados", () => {
  const emptyPurchase = receivePurchaseDetailsBulkValidation.validate({
    ...commonPayload,
    purchase_id: 12,
    purchase_detail_ids: [],
  });
  assert.match(emptyPurchase.error?.message || "", /seleccionar al menos/i);

  const duplicateDonation = receiveDonationItemsBulkValidation.validate({
    ...commonPayload,
    donation_id: 8,
    donation_item_ids: [20, 20],
  });
  assert.match(duplicateDonation.error?.message || "", /repetidos/i);
});

test("las validaciones masivas rechazan cantidades enviadas por el cliente", () => {
  const { error } = receivePurchaseDetailsBulkValidation.validate({
    ...commonPayload,
    purchase_id: 12,
    purchase_detail_ids: [31],
    cantidad_a_recepcionar: 999,
  });

  assert.match(error?.message || "", /propiedades adicionales/i);
});

test("las validaciones masivas exigen UUID y cabecera", () => {
  const { error } = receiveDonationItemsBulkValidation.validate({
    ...commonPayload,
    idempotency_key: "no-es-uuid",
    donation_item_ids: [20],
  });

  assert.match(error?.message || "", /donation_id|UUID/i);
});
