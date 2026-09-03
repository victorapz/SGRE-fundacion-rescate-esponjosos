"use strict";

import cron from "node-cron";
import { generarTurnosSemanales } from "../services/shiftAuto.service.js";
import { SCHEDULER_TZ } from "../config/configEnv.js";

const WEEKLY_SHIFT_CRON = "0 0 * * 0";

export function startShiftScheduler() {
  const options = SCHEDULER_TZ ? { timezone: SCHEDULER_TZ } : undefined;

  cron.schedule(
    WEEKLY_SHIFT_CRON,
    async () => {
      console.log("[scheduler] Inicio generacion de turnos semanales");
      try {
        const result = await generarTurnosSemanales();
        console.log(`[scheduler] Turnos creados: ${result.created}`);
      } catch (error) {
        console.error("[scheduler] Error generando turnos semanales:", error);
      }
    },
    options,
  );

  console.log("[scheduler] Programado para domingos 00:00");
}
