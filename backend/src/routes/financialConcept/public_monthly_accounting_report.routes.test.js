"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("las rutas administrativas de informes publicos contables requieren los permisos esperados", () => {
  const source = readFileSync(
    new URL("./public_monthly_accounting_report.routes.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /checkRbac\("accounting:public_report:read"\), listPublicMonthlyAccountingReports/);
  assert.match(source, /checkRbac\("accounting:public_report:read"\), getPublicMonthlyAccountingReportById/);
  assert.match(source, /checkRbac\("accounting:public_report:create"\),\s*generatePublicMonthlyAccountingReport/);
  assert.match(source, /checkRbac\("accounting:public_report:publish"\),\s*publishPublicMonthlyAccountingReport/);
  assert.match(source, /checkRbac\("accounting:public_report:archive"\),\s*archivePublicMonthlyAccountingReport/);
  assert.match(source, /checkRbac\("accounting:public_report:read"\),\s*downloadPublicMonthlyAccountingReport/);
});

test("initialSetup registra los permisos de informes publicos contables", () => {
  const source = readFileSync(
    new URL("../../config/initialSetup.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /"accounting:public_report:read"/);
  assert.match(source, /"accounting:public_report:create"/);
  assert.match(source, /"accounting:public_report:publish"/);
  assert.match(source, /"accounting:public_report:archive"/);
});
