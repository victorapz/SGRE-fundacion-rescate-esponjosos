"use strict";

import { EntitySchema } from "typeorm";
import {
  ALLOWED_ANIMAL_HEALTH_STATUS,
  ANIMAL_SPECIES,
} from "../constants/animal.constants.js";

export const AnimalSpeciesENUM = ANIMAL_SPECIES;
export const AnimalHealthStatusENUM = ALLOWED_ANIMAL_HEALTH_STATUS;

const FosterHomeAllowedAnimalScheme = new EntitySchema({
  name: "FosterHomeAllowedAnimal",
  tableName: "FosterHomeAllowedAnimals",
  columns: {
    id_allowed_animal: {
      type: "int",
      primary: true,
      generated: true,
    },

    especie: {
      type: "enum",
      enum: AnimalSpeciesENUM,
      nullable: false,
    },

    estado_permitido: {
      type: "enum",
      enum: AnimalHealthStatusENUM,
      nullable: false,
      default: AnimalHealthStatusENUM.CUALQUIERA,
    },

    capacidad_maxima: {
      type: "int",
      nullable: true,
    },

    observaciones: {
      type: "text",
      nullable: true,
    },

    activo: {
      type: "boolean",
      nullable: false,
      default: true,
    },

    createdAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      nullable: false,
    },

    updatedAt: {
      type: "timestamp with time zone",
      default: () => "CURRENT_TIMESTAMP",
      onUpdate: "CURRENT_TIMESTAMP",
      nullable: false,
    },
  },

  relations: {
    foster_home: {
      target: "FosterHome",
      type: "many-to-one",
      joinColumn: {
        name: "foster_home_id",
        referencedColumnName: "id_hogar_temporal",
      },
      nullable: false,
      onDelete: "CASCADE",
    },
  },
});

export default FosterHomeAllowedAnimalScheme;
