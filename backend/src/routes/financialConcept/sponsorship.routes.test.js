"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("las rutas administrativas de apadrinamiento exigen los permisos esperados", () => {
  const planRoutes = readFileSync(new URL("./sponsorship_plan.routes.js", import.meta.url), "utf8");
  const animalRoutes = readFileSync(new URL("./sponsorship_animals.routes.js", import.meta.url), "utf8");
  const sponsorRoutes = readFileSync(new URL("./sponsors.routes.js", import.meta.url), "utf8");
  const sponsorshipRoutes = readFileSync(new URL("./sponsorships.routes.js", import.meta.url), "utf8");
  const subscriptionRoutes = readFileSync(new URL("./subscriptions.routes.js", import.meta.url), "utf8");
  const subscriptionPaymentRoutes = readFileSync(new URL("./subscription_payments.routes.js", import.meta.url), "utf8");

  assert.match(planRoutes, /router\.use\(authenticateJwt\)/);
  assert.match(planRoutes, /checkRbac\("accounting:sponsorship_plan:read"\), getSponsorshipPlans/);
  assert.match(planRoutes, /checkRbac\("accounting:sponsorship_plan:create"\), createSponsorshipPlan/);
  assert.match(planRoutes, /checkRbac\("accounting:sponsorship_plan:update"\), updateSponsorshipPlan/);
  assert.match(planRoutes, /checkRbac\("accounting:sponsorship_plan:update"\), provisionSponsorshipPlanPayPal/);
  assert.match(planRoutes, /checkRbac\("accounting:sponsorship_plan:delete"\), deleteSponsorshipPlan/);

  assert.match(animalRoutes, /checkRbac\("accounting:sponsorship:read"\), getSponsorshipAnimals/);
  assert.match(animalRoutes, /checkRbac\("accounting:sponsorship:update"\), updateSponsorshipAnimal/);
  assert.match(sponsorRoutes, /checkRbac\("accounting:sponsor:create"\), createSponsor/);
  assert.match(sponsorRoutes, /checkRbac\("accounting:sponsor:read"\), getSponsors/);
  assert.match(sponsorRoutes, /checkRbac\("accounting:sponsor:update"\), updateSponsor/);
  assert.match(sponsorshipRoutes, /checkRbac\("accounting:sponsorship:create"\), createManualSponsorship/);
  assert.match(sponsorshipRoutes, /checkRbac\("accounting:sponsorship:read"\), getSponsorships/);
  assert.match(subscriptionRoutes, /checkRbac\("accounting:subscription:read"\), getSubscriptions/);
  assert.match(subscriptionRoutes, /checkRbac\("accounting:subscription:sync"\), syncSubscription/);
  assert.match(subscriptionRoutes, /checkRbac\("accounting:subscription:cancel"\)/);
  assert.match(subscriptionRoutes, /checkRbac\("accounting:sponsorship:cancel"\)/);
  assert.match(subscriptionPaymentRoutes, /checkRbac\("accounting:subscription_payment:create"\), createManualSubscriptionPayment/);
  assert.match(subscriptionPaymentRoutes, /checkRbac\("accounting:subscription_payment:read"\), getSubscriptionPayments/);
});

test("initialSetup ya registra los permisos de apadrinamiento reutilizados por las rutas", () => {
  const source = readFileSync(
    new URL("../../config/initialSetup.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /"accounting:sponsor:read"/);
  assert.match(source, /"accounting:sponsor:update"/);
  assert.match(source, /"accounting:sponsorship:read"/);
  assert.match(source, /"accounting:sponsorship:update"/);
  assert.match(source, /"accounting:sponsorship_plan:read"/);
  assert.match(source, /"accounting:sponsorship_plan:create"/);
  assert.match(source, /"accounting:sponsorship_plan:update"/);
  assert.match(source, /"accounting:sponsorship_plan:delete"/);
  assert.match(source, /"accounting:subscription:read"/);
  assert.match(source, /"accounting:subscription_payment:read"/);
  assert.match(source, /"accounting:subscription_payment:create"/);
});
