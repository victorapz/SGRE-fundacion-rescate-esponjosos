"use strict";

import { APP_HOST, PORT, validateRuntimeEnv } from "./config/configEnv.js";
import { connectDB } from "./config/configDb.js";
import { initialSetup } from "./config/initialSetup.js";
import { startShiftScheduler } from "./schedulers/shift.scheduler.js";
import { createApp } from "./app.js";

async function setupServer() {
  const app = createApp();

  await new Promise((resolve) => {
    app.listen(PORT, APP_HOST, () => {
      console.log(`Servidor escuchando en ${APP_HOST}:${PORT}`);
      resolve();
    });
  });
}

async function setupAPI() {
  validateRuntimeEnv();
  await connectDB();
  await setupServer();
  await initialSetup();
  startShiftScheduler();
}

setupAPI()
  .then(() => console.log("=> API iniciada exitosamente"))
  .catch((error) => {
    console.error("Error iniciando la API:", error);
    process.exitCode = 1;
  });
