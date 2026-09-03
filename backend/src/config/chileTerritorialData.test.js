import assert from "node:assert/strict";
import test from "node:test";

import {
  CHILE_COMMUNES,
  CHILE_REGIONS,
  getChileCommunesCount,
} from "./chileTerritorialData.js";

test("chileTerritorialData expone las 16 regiones y el conteo esperado de comunas", () => {
  assert.equal(CHILE_REGIONS.length, 16);
  assert.equal(getChileCommunesCount(), CHILE_COMMUNES.length);
  assert.equal(CHILE_COMMUNES.length, 346);
});

test("chileTerritorialData mantiene claves unicas y sin comunas duplicadas por region", () => {
  const regionKeys = CHILE_REGIONS.map((region) => region.clave);
  assert.equal(new Set(regionKeys).size, regionKeys.length);

  const communeKeys = CHILE_COMMUNES.map(
    (commune) => `${commune.regionKey}::${commune.nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()}`,
  );
  assert.equal(new Set(communeKeys).size, communeKeys.length);
});

