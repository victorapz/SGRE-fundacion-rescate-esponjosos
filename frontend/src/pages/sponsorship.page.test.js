import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la navegacion ubica Apadrinamiento como módulo principal independiente y Contabilidad sin placeholder", () => {
  const navigationSource = readFileSync(new URL("../config/navigation.js", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../routes/AppRouter.jsx", import.meta.url), "utf8");
  const accountingSource = readFileSync(new URL("./accounting.page.jsx", import.meta.url), "utf8");
  const sponsorshipSource = readFileSync(new URL("./sponsorship.page.jsx", import.meta.url), "utf8");

  assert.match(navigationSource, /label: "Inicio"[\s\S]*label: "Rescatados"[\s\S]*label: "Hogar Temporal"[\s\S]*label: "Apadrinamiento"[\s\S]*label: "Voluntarios"[\s\S]*label: "Turnos"[\s\S]*label: "Tareas"[\s\S]*label: "Inventario"[\s\S]*label: "Contabilidad"[\s\S]*label: "Configuracion"/);
  assert.match(routerSource, /path="\/apadrinamientos"/);
  assert.doesNotMatch(accountingSource, /ACCOUNTING_TABS\.SPONSORSHIPS/);
  assert.match(sponsorshipSource, /label: "Apadrinamientos"/);
  assert.match(sponsorshipSource, /label: "Padrinos"/);
  assert.match(sponsorshipSource, /label: "Pagos"/);
  assert.match(sponsorshipSource, /label: "Configuracion"/);
  assert.doesNotMatch(sponsorshipSource, /Suscripciones/);
});

test("la página de apadrinamiento usa limpieza de filtros visible y pago manual guiado", () => {
  const sponsorshipSource = readFileSync(new URL("./sponsorship.page.jsx", import.meta.url), "utf8");

  assert.match(sponsorshipSource, /function FilterField/);
  assert.match(sponsorshipSource, /className="btn-clear"/);
  assert.match(sponsorshipSource, /Referencia del pago/);
  assert.match(sponsorshipSource, /addOneCalendarMonthFromDateInput/);
  assert.match(sponsorshipSource, /plan\.modalidad === "MANUAL"/);
});
