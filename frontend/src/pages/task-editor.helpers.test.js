"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskEditorPayload,
  filterAssignableUsersByArea,
  getActorAreaOptions,
  sanitizeAssigneeSelection,
} from "./task-editor.helpers.js";

test("getActorAreaOptions prioriza currentUserAreas y mantiene fallback legacy", () => {
  assert.deepEqual(
    getActorAreaOptions({
      context: {
        currentUserAreas: [
          { id_area: 3, nombre: "Clínica" },
          { id_area: 5, nombre: "Contenido" },
        ],
      },
    }),
    [
      { id: 3, name: "Clínica" },
      { id: 5, name: "Contenido" },
    ],
  );

  assert.deepEqual(
    getActorAreaOptions({
      context: {
        currentUserAreaId: 7,
        currentUserAreaName: "Legacy",
      },
    }),
    [{ id: 7, name: "Legacy" }],
  );
});

test("filterAssignableUsersByArea mantiene visible al encargado de contenido transversal", () => {
  const users = [
    { id: 1, areaIds: [1], taskProfile: "assignee" },
    { id: 2, areaIds: [5], taskProfile: "content_manager" },
    { id: 3, areaIds: [9], taskProfile: "assignee" },
  ];

  assert.deepEqual(
    filterAssignableUsersByArea(users, 1, { assign: "área" }).map((user) => user.id),
    [1, 2],
  );
  assert.deepEqual(
    filterAssignableUsersByArea(users, 1, { assign: "any" }).map((user) => user.id),
    [1],
  );
});

test("sanitizeAssigneeSelection elimina usuarios fuera del filtro actual", () => {
  assert.deepEqual(
    sanitizeAssigneeSelection(["1", "2", "9"], [{ id: 2 }, { id: 9 }]),
    ["2", "9"],
  );
});

test("buildTaskEditorPayload normaliza área y asignados válidos", () => {
  assert.deepEqual(
    buildTaskEditorPayload({
      title: "  Tarea  ",
      description: "<p>ok</p>",
      priority: "alta",
      dueDate: "2026-07-09",
      areaId: "3",
      assigneeIds: ["2", "x", "5"],
    }),
    {
      titulo: "Tarea",
      descripcion: "<p>ok</p>",
      prioridad: "alta",
      fecha_limite: "2026-07-09",
      area_id: 3,
      usuarios_asignados: [2, 5],
    },
  );
});
