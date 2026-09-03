"use strict";

import { AppDataSource } from "../config/configDb.js";
import { regenerarTurnosSemanaActual } from "../services/shiftAuto.service.js";

async function main() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    console.log("Regenerando los turnos de la semana actual...");

    const result = await regenerarTurnosSemanaActual();

    console.log("Turnos regenerados correctamente.");
    console.table({
      "Inicio de semana": result.fechaInicio,
      "Fin de semana": result.fechaFin,
      "Turnos eliminados": result.deletedShifts,
      "Inscripciones eliminadas": result.deletedRegistrations,
      "Turnos creados": result.createdShifts,
      "Capacidad por turno": result.capacidad,
    });
  } catch (error) {
    console.error("No se pudieron regenerar los turnos:", error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

main();