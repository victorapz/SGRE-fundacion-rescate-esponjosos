import assert from "node:assert/strict";
import test from "node:test";

import { shouldReactivateDisabledPayable } from "./payableIntegration.service.js";

test("reactiva una cuenta anulada por origen cuando no tiene movimientos", () => {
  assert.equal(
    shouldReactivateDisabledPayable(
      {
        estado: "ANULADA",
        monto_pagado: 0,
        payments: [],
        transactions: [],
      },
      true,
    ),
    true,
  );
});

test("no reactiva cuentas anuladas con pagos o transacciones", () => {
  assert.equal(
    shouldReactivateDisabledPayable(
      {
        estado: "ANULADA",
        monto_pagado: 100,
        payments: [],
        transactions: [],
      },
      true,
    ),
    false,
  );

  assert.equal(
    shouldReactivateDisabledPayable(
      {
        estado: "ANULADA",
        monto_pagado: 0,
        payments: [],
        transactions: [{ transaccion_id: 8 }],
      },
      true,
    ),
    false,
  );
});

test("no reactiva cuentas anuladas sin autorizacion explicita", () => {
  assert.equal(
    shouldReactivateDisabledPayable(
      {
        estado: "ANULADA",
        monto_pagado: 0,
        payments: [],
        transactions: [],
      },
      false,
    ),
    false,
  );
});
