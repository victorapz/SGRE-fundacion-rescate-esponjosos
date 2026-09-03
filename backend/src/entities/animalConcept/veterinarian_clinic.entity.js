"use strict";

import { EntitySchema } from "typeorm";

const VeterinarianClinicScheme = new EntitySchema({
  name: "VeterinarianClinic",
  tableName: "VeterinarianClinics",
  columns: {
    id_veterinario_clinica: {
      type: "int",
      primary: true,
      generated: true,
    },
    createdAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },
  },
  uniques: [
    {
      name: "UQ_VeterinarianClinics_veterinarian_clinic",
      columns: ["veterinarian", "clinic"],
    },
  ],
  relations: {
    veterinarian: {
      target: "Veterinarian",
      type: "many-to-one",
      joinColumn: {
        name: "id_veterinario",
        referencedColumnName: "id_veterinario",
      },
      nullable: false,
      onDelete: "CASCADE",
    },
    clinic: {
      target: "VetClinic",
      type: "many-to-one",
      joinColumn: {
        name: "id_clinica",
        referencedColumnName: "id_clinica",
      },
      nullable: false,
      onDelete: "CASCADE",
    },
  },
});

export default VeterinarianClinicScheme;
