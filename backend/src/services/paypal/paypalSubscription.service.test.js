"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafePayPalApprovalUrl,
  buildPayPalSubscriptionContextUrls,
  buildDeterministicPayPalRequestId,
  extractPayPalSubscriptionApprovalUrl,
  splitPayPalTransactionWindows,
} from "./paypalSubscription.service.js";

test("buildDeterministicPayPalRequestId es estable para el mismo input", () => {
  const first = buildDeterministicPayPalRequestId("paypal-subscription", "plan-1", "sandbox");
  const second = buildDeterministicPayPalRequestId("paypal-subscription", "plan-1", "sandbox");
  const third = buildDeterministicPayPalRequestId("paypal-subscription", "plan-2", "sandbox");

  assert.equal(first, second);
  assert.notEqual(first, third);
  assert.match(first, /^paypal-subscription-[a-f0-9]{32}$/);
});

test("extractPayPalSubscriptionApprovalUrl devuelve solo el enlace approve seguro", () => {
  const approvalUrl = extractPayPalSubscriptionApprovalUrl({
    links: [
      { rel: "self", href: "https://api.sandbox.paypal.com/v1/billing/subscriptions/I-123" },
      { rel: "approve", href: "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=I-123" },
    ],
  });

  assert.equal(
    approvalUrl,
    "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=I-123",
  );
});

test("assertSafePayPalApprovalUrl rechaza protocolos o hosts no permitidos", () => {
  assert.throws(
    () => assertSafePayPalApprovalUrl("http://www.sandbox.paypal.com/unsafe"),
    (error) => error?.message === "PayPal no devolvio una approval_url segura.",
  );
  assert.throws(
    () => assertSafePayPalApprovalUrl("https://evil.example.com/approve"),
    (error) => error?.message === "PayPal no devolvio una approval_url permitida.",
  );
});

test("splitPayPalTransactionWindows divide rangos largos en ventanas manejables", () => {
  const windows = splitPayPalTransactionWindows(
    new Date("2026-01-01T00:00:00Z"),
    new Date("2026-03-10T00:00:00Z"),
  );

  assert.ok(windows.length >= 3);
  assert.equal(windows[0].startTime, "2026-01-01T00:00:00.000Z");
  assert.equal(windows.at(-1).endTime, "2026-03-10T00:00:00.000Z");
});

test("buildPayPalSubscriptionContextUrls agrega ref y animal_id sin perder query params previos", () => {
  const result = buildPayPalSubscriptionContextUrls({
    publicReference: "af33f470-9216-4822-a8bb-86c72aef0a13",
    animalId: 1,
    returnUrl: "http://localhost:5173/apadrinamiento/success?source=paypal",
    cancelUrl: "http://localhost:5173/apadrinamiento/cancel?source=paypal",
  });

  assert.equal(
    result.returnUrl,
    "http://localhost:5173/apadrinamiento/success?source=paypal&ref=af33f470-9216-4822-a8bb-86c72aef0a13",
  );
  assert.equal(
    result.cancelUrl,
    "http://localhost:5173/apadrinamiento/cancel?source=paypal&ref=af33f470-9216-4822-a8bb-86c72aef0a13&animal_id=1",
  );
});

test("buildPayPalSubscriptionContextUrls no agrega datos personales ni animal_id invalido", () => {
  const result = buildPayPalSubscriptionContextUrls({
    publicReference: "uuid-safe",
    animalId: null,
    returnUrl: "http://localhost:5173/apadrinamiento/success",
    cancelUrl: "http://localhost:5173/apadrinamiento/cancel",
  });

  assert.equal(
    result.returnUrl,
    "http://localhost:5173/apadrinamiento/success?ref=uuid-safe",
  );
  assert.equal(
    result.cancelUrl,
    "http://localhost:5173/apadrinamiento/cancel?ref=uuid-safe",
  );
  assert.doesNotMatch(result.returnUrl, /email|nombre|apellido|telefono|payer|provider/i);
  assert.doesNotMatch(result.cancelUrl, /email|nombre|apellido|telefono|payer|provider/i);
});
