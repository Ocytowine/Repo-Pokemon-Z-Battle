import type {
  AbilityDefinition,
  DatasetKind,
  DefinitionCollision,
  EncounterDefinition,
  ItemDefinition,
  MoveDefinition,
  NormalizedDataset,
  PokemonDefinition,
  ReferenceIssue,
  ReferenceIssueCode,
  TypeDefinition,
  TrainerDefinition,
  TrainerTypeDefinition,
  UnreferencedDefinition,
  ValidationReport,
} from "@pokemon-z-battle/game-data";
import { access } from "node:fs/promises";
import path from "node:path";
import { GAME_DATA_SCHEMA_VERSION } from "../domain/game-data.js";
import {
  compareCompiledMoves,
  compareCompiledPokemonSize,
} from "./compiled-comparison.js";
import {
  EVOLUTION_PARAMETER_KINDS,
  type EvolutionParameterKind,
} from "./evolution-methods.js";

interface BaseRecord {
  readonly id: number;
  readonly internalName: string;
  readonly _source: { readonly line: number };
}

export interface ReferenceValidationInput {
  readonly types: NormalizedDataset<"types", TypeDefinition>;
  readonly pokemon: NormalizedDataset<"pokemon", PokemonDefinition>;
  readonly moves: NormalizedDataset<"moves", MoveDefinition>;
  readonly abilities: NormalizedDataset<"abilities", AbilityDefinition>;
  readonly items: NormalizedDataset<"items", ItemDefinition>;
  readonly trainerTypes: NormalizedDataset<"trainerTypes", TrainerTypeDefinition>;
  readonly trainers: NormalizedDataset<"trainers", TrainerDefinition>;
  readonly encounters: NormalizedDataset<"encounters", EncounterDefinition>;
}

type SymbolTable = ReadonlyMap<string, readonly BaseRecord[]>;
type ReferenceTargetDataset =
  | "types"
  | "pokemon"
  | "moves"
  | "abilities"
  | "items"
  | "trainerTypes";

function buildSymbolTable(records: readonly BaseRecord[]): SymbolTable {
  const table = new Map<string, BaseRecord[]>();
  for (const record of records) {
    const matches = table.get(record.internalName) ?? [];
    matches.push(record);
    table.set(record.internalName, matches);
  }
  return table;
}

function findCollisions(
  dataset: DatasetKind,
  records: readonly BaseRecord[],
): readonly DefinitionCollision[] {
  const collisions: DefinitionCollision[] = [];
  const fields = [
    ["id", (record: BaseRecord) => String(record.id)],
    ["internalName", (record: BaseRecord) => record.internalName],
  ] as const;

  for (const [field, getValue] of fields) {
    const groups = new Map<string, BaseRecord[]>();
    for (const record of records) {
      const value = getValue(record);
      const matches = groups.get(value) ?? [];
      matches.push(record);
      groups.set(value, matches);
    }
    for (const [value, matches] of groups) {
      if (matches.length < 2) continue;
      collisions.push({
        dataset,
        field,
        value,
        ids: matches.map((record) => record.id),
        lines: matches.map((record) => record._source.line),
      });
    }
  }
  return collisions;
}

export async function validateReferences(
  input: ReferenceValidationInput,
  sourceDirectory: string,
): Promise<ValidationReport> {
  const tables = {
    types: buildSymbolTable(input.types.records),
    pokemon: buildSymbolTable(input.pokemon.records),
    moves: buildSymbolTable(input.moves.records),
    abilities: buildSymbolTable(input.abilities.records),
    items: buildSymbolTable(input.items.records),
    trainerTypes: buildSymbolTable(input.trainerTypes.records),
  };
  const referenced = {
    types: new Set<string>(),
    pokemon: new Set<string>(),
    moves: new Set<string>(),
    abilities: new Set<string>(),
    items: new Set<string>(),
    trainerTypes: new Set<string>(),
  };
  const issues: ReferenceIssue[] = [];
  let checkedReferences = 0;
  let validReferences = 0;

  function checkReference(
    ownerDataset: DatasetKind,
    owner: BaseRecord,
    field: string,
    reference: string,
    targetDataset: ReferenceTargetDataset,
    unknownCode: ReferenceIssueCode,
    line = owner._source.line,
  ): void {
    checkedReferences += 1;
    const matches = tables[targetDataset].get(reference) ?? [];
    if (matches.length === 0) {
      issues.push({
        severity: "error",
        code: unknownCode,
        dataset: ownerDataset,
        recordId: owner.id,
        internalName: owner.internalName,
        field,
        reference,
        message: `${field} reference ${reference}, absent de ${targetDataset}.`,
        line,
      });
      return;
    }

    referenced[targetDataset].add(reference);
    if (matches.length > 1) {
      issues.push({
        severity: "error",
        code: "AMBIGUOUS_REFERENCE",
        dataset: ownerDataset,
        recordId: owner.id,
        internalName: owner.internalName,
        field,
        reference,
        message: `${field} reference ${reference}, qui correspond a ${matches.length} definitions de ${targetDataset}.`,
        line,
      });
      return;
    }
    validReferences += 1;
  }

  for (const type of input.types.records) {
    for (const reference of type.weaknesses) {
      checkReference("types", type, "weaknesses", reference, "types", "UNKNOWN_TYPE");
    }
    for (const reference of type.resistances) {
      checkReference("types", type, "resistances", reference, "types", "UNKNOWN_TYPE");
    }
    for (const reference of type.immunities) {
      checkReference("types", type, "immunities", reference, "types", "UNKNOWN_TYPE");
    }
  }

  for (const move of input.moves.records) {
    checkReference("moves", move, "type", move.type, "types", "UNKNOWN_TYPE");
  }

  for (const item of input.items.records) {
    if (item.machineMove !== null) {
      checkReference("items", item, "machineMove", item.machineMove, "moves", "UNKNOWN_MOVE");
    }
  }

  function validateEvolutionParameter(
    pokemon: PokemonDefinition,
    method: string,
    parameter: string | null,
  ): void {
    const kind: EvolutionParameterKind | undefined =
      EVOLUTION_PARAMETER_KINDS[method as keyof typeof EVOLUTION_PARAMETER_KINDS];
    if (kind === undefined) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_EVOLUTION_METHOD",
        dataset: "pokemon",
        recordId: pokemon.id,
        internalName: pokemon.internalName,
        field: "evolutions.method",
        reference: method,
        message: `Methode d'evolution inconnue : ${method}.`,
        line: pokemon._source.line,
      });
      return;
    }
    if (kind === "none") {
      if (parameter !== null) {
        issues.push({
          severity: "warning",
          code: "INVALID_EVOLUTION_PARAMETER",
          dataset: "pokemon",
          recordId: pokemon.id,
          internalName: pokemon.internalName,
          field: "evolutions.parameter",
          reference: parameter,
          message: `${method} n'utilise pas de parametre, mais ${parameter} est fourni.`,
          line: pokemon._source.line,
        });
      }
      return;
    }
    if (parameter === null) {
      issues.push({
        severity: "error",
        code: "INVALID_EVOLUTION_PARAMETER",
        dataset: "pokemon",
        recordId: pokemon.id,
        internalName: pokemon.internalName,
        field: "evolutions.parameter",
        reference: "",
        message: `${method} exige un parametre de type ${kind}.`,
        line: pokemon._source.line,
      });
      return;
    }
    if (kind === "number") {
      if (!/^\d+$/u.test(parameter)) {
        issues.push({
          severity: "error",
          code: "INVALID_EVOLUTION_PARAMETER",
          dataset: "pokemon",
          recordId: pokemon.id,
          internalName: pokemon.internalName,
          field: "evolutions.parameter",
          reference: parameter,
          message: `${method} exige un entier, valeur recue : ${parameter}.`,
          line: pokemon._source.line,
        });
      }
      return;
    }

    const target = kind === "item"
      ? ["items", "UNKNOWN_ITEM"] as const
      : kind === "move"
        ? ["moves", "UNKNOWN_MOVE"] as const
        : kind === "pokemon"
          ? ["pokemon", "UNKNOWN_POKEMON"] as const
          : ["types", "UNKNOWN_TYPE"] as const;
    checkReference(
      "pokemon",
      pokemon,
      "evolutions.parameter",
      parameter,
      target[0],
      target[1],
    );
  }

  for (const pokemon of input.pokemon.records) {
    for (const reference of pokemon.types) {
      checkReference("pokemon", pokemon, "types", reference, "types", "UNKNOWN_TYPE");
    }
    for (const reference of pokemon.abilities) {
      checkReference(
        "pokemon",
        pokemon,
        "abilities",
        reference,
        "abilities",
        "UNKNOWN_ABILITY",
      );
    }
    for (const reference of pokemon.hiddenAbilities) {
      checkReference(
        "pokemon",
        pokemon,
        "hiddenAbilities",
        reference,
        "abilities",
        "UNKNOWN_ABILITY",
      );
    }
    for (const entry of pokemon.levelUpMoves) {
      checkReference("pokemon", pokemon, "levelUpMoves", entry.move, "moves", "UNKNOWN_MOVE");
    }
    for (const reference of pokemon.eggMoves) {
      checkReference("pokemon", pokemon, "eggMoves", reference, "moves", "UNKNOWN_MOVE");
    }
    for (const reference of Object.values(pokemon.wildHeldItems)) {
      if (reference !== null) {
        checkReference("pokemon", pokemon, "wildHeldItems", reference, "items", "UNKNOWN_ITEM");
      }
    }
    const incense = pokemon.raw.Incense;
    if (incense !== undefined && incense !== "") {
      checkReference("pokemon", pokemon, "Incense", incense, "items", "UNKNOWN_ITEM");
    }
    for (const evolution of pokemon.evolutions) {
      checkReference(
        "pokemon",
        pokemon,
        "evolutions.species",
        evolution.species,
        "pokemon",
        "UNKNOWN_POKEMON",
      );
      validateEvolutionParameter(pokemon, evolution.method, evolution.parameter);
    }
  }

  for (const trainer of input.trainers.records) {
    checkReference(
      "trainers",
      trainer,
      "trainerType",
      trainer.trainerType,
      "trainerTypes",
      "UNKNOWN_TRAINER_TYPE",
    );
    for (const item of trainer.items) {
      checkReference("trainers", trainer, "items", item, "items", "UNKNOWN_ITEM");
    }
    for (const member of trainer.pokemon) {
      checkReference(
        "trainers",
        trainer,
        "pokemon.species",
        member.species,
        "pokemon",
        "UNKNOWN_POKEMON",
        member.line,
      );
      if (member.heldItem !== null) {
        checkReference(
          "trainers",
          trainer,
          "pokemon.heldItem",
          member.heldItem,
          "items",
          "UNKNOWN_ITEM",
          member.line,
        );
      }
      for (const move of member.moves) {
        if (move !== null) {
          checkReference(
            "trainers",
            trainer,
            "pokemon.moves",
            move,
            "moves",
            "UNKNOWN_MOVE",
            member.line,
          );
        }
      }
    }
  }

  for (const encounter of input.encounters.records) {
    checkedReferences += 1;
    const mapFile = path.join(
      sourceDirectory,
      "Data",
      `Map${String(encounter.mapId).padStart(3, "0")}.rxdata`,
    );
    try {
      await access(mapFile);
      validReferences += 1;
    } catch {
      issues.push({
        severity: "error",
        code: "UNKNOWN_MAP",
        dataset: "encounters",
        recordId: encounter.id,
        internalName: encounter.internalName,
        field: "mapId",
        reference: String(encounter.mapId),
        message: `La carte ${encounter.mapId} ne possede pas de fichier Data/MapXXX.rxdata.`,
        line: encounter._source.line,
      });
    }
    for (const method of encounter.methods) {
      for (const slot of method.slots) {
        checkReference(
          "encounters",
          encounter,
          `methods.${method.method}.species`,
          slot.species,
          "pokemon",
          "UNKNOWN_POKEMON",
          slot.line,
        );
      }
    }
  }

  const definitionRecords = {
    types: input.types.records,
    pokemon: input.pokemon.records,
    moves: input.moves.records,
    abilities: input.abilities.records,
    items: input.items.records,
    trainerTypes: input.trainerTypes.records,
  } as const;
  const collisionRecords = {
    ...definitionRecords,
    trainers: input.trainers.records,
    encounters: input.encounters.records,
  } as const;
  const collisions = (Object.keys(collisionRecords) as DatasetKind[]).flatMap((dataset) =>
    findCollisions(dataset, collisionRecords[dataset]),
  );
  const unreferencedDefinitions: UnreferencedDefinition[] = [];
  for (const dataset of Object.keys(definitionRecords) as ReferenceTargetDataset[]) {
    for (const record of definitionRecords[dataset]) {
      if (!referenced[dataset].has(record.internalName)) {
        unreferencedDefinitions.push({ dataset, id: record.id, internalName: record.internalName });
      }
    }
  }

  const compiledComparisons = await Promise.all([
    compareCompiledMoves(sourceDirectory, input.moves, input.types),
    compareCompiledPokemonSize(sourceDirectory, input.pokemon),
  ]);
  const compiledErrors = compiledComparisons.filter((comparison) => comparison.status === "mismatch").length;
  const errors = issues.filter((issue) => issue.severity === "error").length + compiledErrors;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;

  return {
    schemaVersion: GAME_DATA_SCHEMA_VERSION,
    source: { game: "Pokemon Z", version: "2.12 FR" },
    summary: {
      checkedReferences,
      validReferences,
      errors,
      warnings,
      collisions: collisions.length,
      provisionalUnreferencedDefinitions: unreferencedDefinitions.length,
    },
    issues,
    collisions,
    unreferencedScope:
      "Provisional: references from the eight Phase 1.4 PBS datasets are counted. TM lists, scripts, forms and map events are not included yet.",
    unreferencedDefinitions,
    compiledComparisons,
  };
}
