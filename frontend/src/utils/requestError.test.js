import test from "node:test";
import assert from "node:assert/strict";
import { getRequestErrorMessage } from "./requestError.js";

test("getRequestErrorMessage conserva mensajes humanos del backend", () => {
  const message = getRequestErrorMessage({
    response: {
      data: {
        message: "La región seleccionada no existe o ya no está disponible.",
      },
    },
  });

  assert.equal(message, "La región seleccionada no existe o ya no está disponible.");
});

test("getRequestErrorMessage oculta errores tecnicos y SQL", () => {
  const technicalError = getRequestErrorMessage(
    {
      response: {
        data: {
          message: "QueryFailedError: UPDATE Animals SET region_id = null",
        },
      },
    },
    "No se pudo guardar el registro.",
  );

  assert.equal(technicalError, "No se pudo guardar el registro.");
});

test("getRequestErrorMessage usa mensaje de red cuando no hay respuesta", () => {
  const message = getRequestErrorMessage({
    message: "Network Error",
  });

  assert.equal(message, "No fue posible comunicarse con el servidor. Intenta nuevamente.");
});
