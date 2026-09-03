import test from "node:test";
import assert from "node:assert/strict";
import {
  addOneCalendarMonthFromDateInput,
  formatSponsorshipMoney,
} from "./sponsorship-admin.js";

test("addOneCalendarMonthFromDateInput respeta fin de mes y anios bisiestos", () => {
  assert.equal(addOneCalendarMonthFromDateInput("2026-01-31"), "2026-02-28");
  assert.equal(addOneCalendarMonthFromDateInput("2028-01-31"), "2028-02-29");
  assert.equal(addOneCalendarMonthFromDateInput("2026-06-15"), "2026-07-15");
});

test("formatSponsorshipMoney formatea CLP y USD de forma consistente", () => {
  assert.equal(formatSponsorshipMoney(10000, "CLP"), "$10.000");
  assert.match(formatSponsorshipMoney(10, "USD"), /^USD\s?10,00$/);
});
