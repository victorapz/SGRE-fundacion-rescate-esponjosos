/**
 * Pruebas manuales simples para validaciones del CRUD Event
 */

import {
  eventCreateValidation,
  eventQueryValidation,
  eventUpdateBodyValidation,
} from "../validations/event.validation.js";
import { EventCategory } from "../entities/event.entity.js";

console.log("Iniciando pruebas de validacion Event\n");

const validTimedCreate = {
  titulo: "Charla educativa",
  descripcion: "Charla sobre cuidados basicos y adopción responsable",
  lugar: "Salon principal",
  fecha_inicio: "2026-06-10T15:00:00.000Z",
  fecha_fin: "2026-06-10T18:00:00.000Z",
  todo_el_dia: false,
  categoria: EventCategory.EDUCATIVO,
};

const validAllDayCreate = {
  titulo: "Campana de difusion",
  descripcion: "Evento all day para redes y seguimiento",
  lugar: "Online",
  fecha_inicio: "2026-06-10T04:00:00.000Z",
  fecha_fin: "2026-06-13T04:00:00.000Z",
  todo_el_dia: true,
  categoria: EventCategory.RECAUDACION_FONDOS,
};

for (const [label, payload] of [
  ["Create valido con horario", validTimedCreate],
  ["Create valido all day", validAllDayCreate],
  ["Update parcial valido", { titulo: "Nuevo titulo", todo_el_dia: true, categoria: EventCategory.CULTURAL }],
  ["Query valida", { id: 1 }],
]) {
  const validation = label.startsWith("Update")
    ? eventUpdateBodyValidation
    : label.startsWith("Query")
      ? eventQueryValidation
      : eventCreateValidation;
  const { error } = validation.validate(payload);
  console.log(`${label}: ${error ? `ERROR -> ${error.message}` : "OK"}`);
}

for (const [label, payload] of [
  ["Create con rango invalido", { ...validTimedCreate, fecha_fin: validTimedCreate.fecha_inicio }],
  ["Create con campo legacy", { ...validTimedCreate, fecha: "10-06-2026" }],
  ["Create con categoria invalida", { ...validTimedCreate, categoria: "INVALIDA" }],
  ["Update vacio", {}],
]) {
  const validation = label.startsWith("Update")
    ? eventUpdateBodyValidation
    : eventCreateValidation;
  const { error } = validation.validate(payload);
  console.log(`${label}: ${error ? `OK -> ${error.message}` : "ERROR no detectado"}`);
}
