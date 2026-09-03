"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("las rutas publicas de apadrinamiento y archivos no usan autenticacion y exponen solo lectura", () => {
  const sponsorshipRoutes = readFileSync(
    new URL("./public_sponsorship.routes.js", import.meta.url),
    "utf8",
  );
  const fileRoutes = readFileSync(
    new URL("./public_file_asset.routes.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(sponsorshipRoutes, /authenticateJwt/);
  assert.match(sponsorshipRoutes, /router\.get\("\/plans", getPublicSponsorshipPlans\)/);
  assert.match(sponsorshipRoutes, /router\.get\("\/animals", getPublicSponsorshipAnimals\)/);
  assert.match(sponsorshipRoutes, /router\.get\("\/animals\/:id", getPublicSponsorshipAnimalDetail\)/);
  assert.match(sponsorshipRoutes, /router\.post\("\/start", startPublicSponsorship\)/);
  assert.match(sponsorshipRoutes, /router\.get\("\/:publicReference\/status", getPublicSponsorshipStatus\)/);

  assert.doesNotMatch(fileRoutes, /authenticateJwt/);
  assert.match(fileRoutes, /router\.get\("\/:publicId\/preview", getPublicAnimalFilePreview\)/);
});
