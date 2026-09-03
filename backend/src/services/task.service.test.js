"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { taskServiceInternals } from "./task.service.js";

const { buildTaskAccess, canReadTask, canEditTask, canDeleteTaskRecord } = taskServiceInternals;

function buildUserContext(overrides = {}) {
  return {
    id: 10,
    areaId: 1,
    areaName: "Salud",
    areaIds: [1, 2],
    areas: [
      { id_area: 1, nombre: "Salud", clave: "SAL" },
      { id_area: 2, nombre: "Operaciones", clave: "OPE" },
    ],
    fullName: "Encargada Área",
    roleNames: [],
    permissionNames: [],
    ...overrides,
  };
}

function buildTask(areaId, creatorId = 99, assigneeId = 88) {
  return {
    area: { id_area: areaId, nombre: `Área ${areaId}` },
    creado_por: { id_usuario: creatorId },
    assignments: [{ user: { id_usuario: assigneeId } }],
  };
}

test("buildTaskAccess expone contexto multiárea y todas las vistas para read:area", () => {
  const access = buildTaskAccess(
    buildUserContext(),
    ["home:task:read:area", "home:task:create:area", "home:task:assign:area"],
  );

  assert.deepEqual(access.context.currentUserAreaIds, [1, 2]);
  assert.equal(access.context.currentUserAreas.length, 2);
  assert.equal(access.views.some((view) => view.id === "all"), true);
  assert.equal(access.actorProfile.taskProfile, "area_manager");
});

test("área scoped puede leer y editar tareas de cualquiera de sus áreas", () => {
  const access = buildTaskAccess(
    buildUserContext(),
    ["home:task:read:area", "home:task:update:area"],
  );

  assert.equal(canReadTask(buildTask(2), access), true);
  assert.equal(canEditTask(buildTask(1), access), true);
  assert.equal(canReadTask(buildTask(9), access), false);
});

test("delete:area usa el área de la tarea y no solo autoría", () => {
  const access = buildTaskAccess(
    buildUserContext(),
    ["home:task:read:area", "home:task:delete:area"],
  );

  assert.equal(canDeleteTaskRecord(buildTask(2, 999, 777), access), true);
  assert.equal(canDeleteTaskRecord(buildTask(7, 10, 10), access), false);
});
