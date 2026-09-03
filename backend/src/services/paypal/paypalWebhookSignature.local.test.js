"use strict";

import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "crypto";
import test from "node:test";
import {
  assertPayPalWebhookCertUrlAllowed,
  buildPayPalWebhookVerificationMessage,
  calculateCrc32UnsignedDecimal,
  clearPayPalWebhookCertificateCache,
  mapPayPalWebhookAuthAlgorithm,
  parsePayPalX509Certificate,
  validatePayPalCertificateValidity,
  verifyPayPalWebhookSignatureLocal,
} from "./paypal.service.js";

const TEST_NOW = new Date("2026-06-17T12:00:00.000Z");
const TEST_CERT_URL = "https://api.sandbox.paypal.com/v1/notifications/certs/test-cert";

function buildFetchResponse(body, headers = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from(body, "utf8"));
        controller.close();
      },
    }),
  };
}

function buildFakeCertificate({
  publicKey,
  validFromDate,
  validToDate,
  validFrom,
  validTo,
}) {
  const certificate = { publicKey };

  if (validFromDate !== undefined) certificate.validFromDate = validFromDate;
  if (validToDate !== undefined) certificate.validToDate = validToDate;
  if (validFrom !== undefined) certificate.validFrom = validFrom;
  if (validTo !== undefined) certificate.validTo = validTo;

  return certificate;
}

function buildParsedFakeCertificate({
  publicKey,
  validFromDate,
  validToDate,
  validFrom,
  validTo,
}) {
  const certificate = buildFakeCertificate({
    publicKey,
    validFromDate,
    validToDate,
    validFrom,
    validTo,
  });
  const validity = validatePayPalCertificateValidity(certificate, { now: TEST_NOW, clockSkewMs: 0 });

  return {
    certificate,
    validity,
  };
}

function buildSignedWebhookScenario() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rawBody = Buffer.from('{"id":"WH-LOCAL-1","event_type":"CHECKOUT.ORDER.APPROVED"}', "utf8");
  const transmissionId = "transmission-1";
  const transmissionTime = "2026-06-17T12:00:00Z";
  const webhookId = "WH-LOCAL-TEST";
  const message = buildPayPalWebhookVerificationMessage({
    transmissionId,
    transmissionTime,
    webhookId,
    crc32: calculateCrc32UnsignedDecimal(rawBody),
  });
  const signature = sign("RSA-SHA256", Buffer.from(message, "utf8"), privateKey).toString("base64");

  return {
    privateKey,
    publicKey,
    rawBody,
    transmissionId,
    transmissionTime,
    webhookId,
    signature,
  };
}

function buildSignatureHeaders({
  transmissionId,
  transmissionTime,
  signature,
  certUrl = TEST_CERT_URL,
  authAlgo = "SHA256withRSA",
}) {
  return {
    "paypal-transmission-id": transmissionId,
    "paypal-transmission-time": transmissionTime,
    "paypal-transmission-sig": signature,
    "paypal-cert-url": certUrl,
    "paypal-auth-algo": authAlgo,
  };
}

test("calculateCrc32UnsignedDecimal devuelve CRC32 decimal unsigned", () => {
  assert.equal(calculateCrc32UnsignedDecimal(Buffer.from("123456789", "utf8")), "3421780262");
});

test("buildPayPalWebhookVerificationMessage usa el formato oficial exacto", () => {
  assert.equal(
    buildPayPalWebhookVerificationMessage({
      transmissionId: "abc",
      transmissionTime: "2026-06-17T00:00:00Z",
      webhookId: "WH-123",
      crc32: "3421780262",
    }),
    "abc|2026-06-17T00:00:00Z|WH-123|3421780262",
  );
});

test("mapPayPalWebhookAuthAlgorithm solo acepta SHA256withRSA", () => {
  assert.equal(mapPayPalWebhookAuthAlgorithm("SHA256withRSA"), "RSA-SHA256");
  assert.equal(mapPayPalWebhookAuthAlgorithm("sha256withrsa"), "RSA-SHA256");
  assert.equal(mapPayPalWebhookAuthAlgorithm("SHA1withRSA"), null);
});

test("assertPayPalWebhookCertUrlAllowed rechaza hosts no permitidos", () => {
  assert.throws(
    () => assertPayPalWebhookCertUrlAllowed("https://evil-paypal.com/v1/notifications/certs/test"),
    /host PayPal permitido/,
  );
});

test("validatePayPalCertificateValidity acepta un certificado vigente", () => {
  const certificate = buildFakeCertificate({
    publicKey: {},
    validFromDate: new Date("2026-06-17T11:00:00.000Z"),
    validToDate: new Date("2026-06-17T13:00:00.000Z"),
  });

  const validity = validatePayPalCertificateValidity(certificate, {
    now: TEST_NOW,
    clockSkewMs: 0,
  });

  assert.equal(validity.validFrom.toISOString(), "2026-06-17T11:00:00.000Z");
  assert.equal(validity.validTo.toISOString(), "2026-06-17T13:00:00.000Z");
});

test("validatePayPalCertificateValidity rechaza un certificado expirado", () => {
  const certificate = buildFakeCertificate({
    publicKey: {},
    validFromDate: new Date("2026-06-17T09:00:00.000Z"),
    validToDate: new Date("2026-06-17T11:00:00.000Z"),
  });

  assert.throws(
    () => validatePayPalCertificateValidity(certificate, { now: TEST_NOW, clockSkewMs: 0 }),
    /esta expirado/,
  );
});

test("validatePayPalCertificateValidity rechaza un certificado aun no valido", () => {
  const certificate = buildFakeCertificate({
    publicKey: {},
    validFromDate: new Date("2026-06-17T12:05:00.000Z"),
    validToDate: new Date("2026-06-17T13:00:00.000Z"),
  });

  assert.throws(
    () => validatePayPalCertificateValidity(certificate, { now: TEST_NOW, clockSkewMs: 0 }),
    /aun no es valido/,
  );
});

test("validatePayPalCertificateValidity rechaza un periodo invalido validFrom >= validTo", () => {
  const certificate = buildFakeCertificate({
    publicKey: {},
    validFromDate: new Date("2026-06-17T13:00:00.000Z"),
    validToDate: new Date("2026-06-17T13:00:00.000Z"),
  });

  assert.throws(
    () => validatePayPalCertificateValidity(certificate, { now: TEST_NOW, clockSkewMs: 0 }),
    /periodo de vigencia invalido/,
  );
});

test("validatePayPalCertificateValidity rechaza fechas X.509 no parseables", () => {
  const certificate = buildFakeCertificate({
    publicKey: {},
    validFrom: "not-a-date",
    validTo: "Jun 17 13:00:00 2026 GMT",
  });

  assert.throws(
    () => validatePayPalCertificateValidity(certificate, { now: TEST_NOW, clockSkewMs: 0 }),
    /validFrom invalido o no interpretable/,
  );
});

test("parsePayPalX509Certificate rechaza un PEM que no sea certificado X.509", () => {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  assert.throws(
    () => parsePayPalX509Certificate(publicKeyPem, { now: TEST_NOW }),
    /no es un certificado X\.509 valido/,
  );
});

test("verifyPayPalWebhookSignatureLocal valida una firma correcta y rechaza body alterado", async () => {
  clearPayPalWebhookCertificateCache();

  const scenario = buildSignedWebhookScenario();
  const parsedCertificate = buildParsedFakeCertificate({
    publicKey: scenario.publicKey,
    validFromDate: new Date("2026-06-17T11:00:00.000Z"),
    validToDate: new Date("2026-06-17T13:00:00.000Z"),
  });
  const headers = buildSignatureHeaders(scenario);
  const parseCertificate = () => parsedCertificate;
  const fetchImpl = async () => buildFetchResponse(
    "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
    { "cache-control": "max-age=60" },
  );

  const validResult = await verifyPayPalWebhookSignatureLocal({
    rawBody: scenario.rawBody,
    headers,
    webhookId: scenario.webhookId,
    fetchImpl,
    parseCertificate,
    now: TEST_NOW,
  });

  const alteredBodyResult = await verifyPayPalWebhookSignatureLocal({
    rawBody: Buffer.from('{"id":"WH-LOCAL-1","event_type":"CHECKOUT.ORDER.APPROVED","tampered":true}', "utf8"),
    headers,
    webhookId: scenario.webhookId,
    fetchImpl,
    parseCertificate,
    now: TEST_NOW,
  });

  assert.equal(validResult, true);
  assert.equal(alteredBodyResult, false);
});

test("verifyPayPalWebhookSignatureLocal rechaza una firma alterada", async () => {
  clearPayPalWebhookCertificateCache();

  const scenario = buildSignedWebhookScenario();
  const parsedCertificate = buildParsedFakeCertificate({
    publicKey: scenario.publicKey,
    validFromDate: new Date("2026-06-17T11:00:00.000Z"),
    validToDate: new Date("2026-06-17T13:00:00.000Z"),
  });
  const parseCertificate = () => parsedCertificate;
  const tamperedSignature = `${scenario.signature.slice(0, -4)}AAAA`;
  const fetchImpl = async () => buildFetchResponse("-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----");

  const result = await verifyPayPalWebhookSignatureLocal({
    rawBody: scenario.rawBody,
    headers: buildSignatureHeaders({
      ...scenario,
      signature: tamperedSignature,
    }),
    webhookId: scenario.webhookId,
    fetchImpl,
    parseCertificate,
    now: TEST_NOW,
  });

  assert.equal(result, false);
});

test("verifyPayPalWebhookSignatureLocal rechaza cert_url no permitida", async () => {
  const scenario = buildSignedWebhookScenario();

  await assert.rejects(
    () => verifyPayPalWebhookSignatureLocal({
      rawBody: scenario.rawBody,
      headers: buildSignatureHeaders({
        ...scenario,
        certUrl: "https://malicious.example.com/v1/notifications/certs/test-cert",
      }),
      webhookId: scenario.webhookId,
      fetchImpl: async () => buildFetchResponse("unused"),
      now: TEST_NOW,
    }),
    /host PayPal permitido/,
  );
});

test("verifyPayPalWebhookSignatureLocal rechaza algoritmos no soportados", async () => {
  const scenario = buildSignedWebhookScenario();

  await assert.rejects(
    () => verifyPayPalWebhookSignatureLocal({
      rawBody: scenario.rawBody,
      headers: buildSignatureHeaders({
        ...scenario,
        authAlgo: "SHA1withRSA",
      }),
      webhookId: scenario.webhookId,
      fetchImpl: async () => buildFetchResponse("unused"),
      now: TEST_NOW,
    }),
    /Solo se acepta SHA256withRSA/,
  );
});

test("verifyPayPalWebhookSignatureLocal rechaza un certificado expirado obtenido desde cache y lo elimina", async () => {
  clearPayPalWebhookCertificateCache();

  const scenario = buildSignedWebhookScenario();
  const certificateCache = new Map([
    [TEST_CERT_URL, {
      certificate: buildFakeCertificate({
        publicKey: scenario.publicKey,
        validFromDate: new Date("2026-06-17T09:00:00.000Z"),
        validToDate: new Date("2026-06-17T11:00:00.000Z"),
      }),
      expiresAt: new Date("2026-06-17T13:00:00.000Z").getTime(),
    }],
  ]);

  await assert.rejects(
    () => verifyPayPalWebhookSignatureLocal({
      rawBody: scenario.rawBody,
      headers: buildSignatureHeaders(scenario),
      webhookId: scenario.webhookId,
      certificateCache,
      fetchImpl: async () => {
        throw new Error("No deberia intentar re-descargar el certificado.");
      },
      now: TEST_NOW,
      clockSkewMs: 0,
    }),
    /esta expirado/,
  );

  assert.equal(certificateCache.size, 0);
});

test("verifyPayPalWebhookSignatureLocal limita el TTL del cache para no sobrepasar validTo", async () => {
  clearPayPalWebhookCertificateCache();

  const scenario = buildSignedWebhookScenario();
  const certificateCache = new Map();
  const validToDate = new Date("2026-06-17T12:00:05.000Z");
  const parsedCertificate = buildParsedFakeCertificate({
    publicKey: scenario.publicKey,
    validFromDate: new Date("2026-06-17T11:00:00.000Z"),
    validToDate,
  });
  const parseCertificate = () => parsedCertificate;
  const fetchImpl = async () => buildFetchResponse(
    "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
    { "cache-control": "max-age=3600" },
  );

  const result = await verifyPayPalWebhookSignatureLocal({
    rawBody: scenario.rawBody,
    headers: buildSignatureHeaders(scenario),
    webhookId: scenario.webhookId,
    fetchImpl,
    certificateCache,
    parseCertificate,
    now: TEST_NOW,
  });

  const cachedEntry = certificateCache.get(TEST_CERT_URL);

  assert.equal(result, true);
  assert.ok(cachedEntry);
  assert.equal(cachedEntry.expiresAt, validToDate.getTime());
});
