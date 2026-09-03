"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPublicTransferFields,
  buildTransferCopyText,
  isValidPublicEmail,
  sanitizePublicExternalUrl,
} from "./publicSite.js";

test("publicSiteConfig centraliza datos institucionales clave", () => {
  const source = readFileSync(new URL("../config/publicSite.config.js", import.meta.url), "utf8");
  assert.match(source, /officialName:\s*"Fundación Rescate Esponjosos"/);
  assert.match(source, /mission:/);
  assert.match(source, /vision:/);
  assert.match(source, /history:/);
  assert.match(source, /servedRegions:\s*\["Valparaíso", "Metropolitana"\]/);
});

test("buildPublicTransferFields nunca expone null o undefined", () => {
  const fields = buildPublicTransferFields({
    holder: "",
    rut: null,
    bank: undefined,
  });

  assert.equal(fields.every((field) => typeof field.value === "string" && field.value.length > 0), true);
});

test("buildTransferCopyText genera un bloque copiable humano", () => {
  const text = buildTransferCopyText({
    holder: "Fundación Rescate Esponjosos",
    rut: "Por confirmar",
    bank: "Por confirmar",
    accountType: "Por confirmar",
    accountNumber: "Por confirmar",
    email: "contacto@rescatesponjosos.org",
  });

  assert.match(text, /Titular:/);
  assert.match(text, /Correo:/);
  assert.doesNotMatch(text, /undefined|null/);
});

test("instagram y correo institucionales son válidos", () => {
  assert.ok(sanitizePublicExternalUrl("https://www.instagram.com/rescatesponjosos/"));
  assert.equal(isValidPublicEmail("contacto@rescatesponjosos.org"), true);
});
