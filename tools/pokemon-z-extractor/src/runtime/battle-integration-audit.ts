import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedBattleAnimation } from "./extract-battle-animations.js";

type Support = "not-implemented" | "partial" | "supported";

interface MoveRecord {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly functionCode: string;
}

interface PokemonRecord {
  readonly internalName: string;
  readonly name: string;
  readonly abilities: readonly string[];
  readonly hiddenAbilities?: readonly string[];
  readonly levelUpMoves: readonly { readonly level: number; readonly move: string }[];
}

interface TrainerRecord {
  readonly internalName: string;
  readonly trainerType: string;
  readonly name: string;
  readonly version: number;
  readonly pokemon: readonly {
    readonly species: string;
    readonly level: number;
    readonly moves: readonly (string | null)[];
    readonly abilityIndex: number | null;
  }[];
}

interface Dataset<T> { readonly records: readonly T[] }

export interface BattleIntegrationAnimationCatalog {
  readonly mappings: readonly {
    readonly internalName: string;
    readonly player: number | null;
    readonly opponent: number | null;
  }[];
  readonly animations: readonly NormalizedBattleAnimation[];
}

const COMMON_VISUALS = {
  sleep: "Common:Sleep", poison: "Common:Poison", burn: "Common:Burn",
  paralysis: "Common:Paralysis", frozen: "Common:Frozen", confusion: "Common:Confusion",
  "stat-up": "Common:StatUp", "stat-down": "Common:StatDown",
  caduco: "Common:Caduco", hemorrhage: "Common:Hemorragia",
} as const;

function defaultMoves(pokemon: PokemonRecord | undefined, level: number): readonly string[] {
  if (pokemon === undefined) return [];
  return pokemon.levelUpMoves.filter((entry) => entry.level <= level).slice(-4).map((entry) => entry.move);
}

function addUsage(usages: Map<string, Set<string>>, key: string, scope: string): void {
  const current = usages.get(key) ?? new Set<string>();
  current.add(scope);
  usages.set(key, current);
}

export async function createBattleIntegrationAudit(outputDirectory: string,
  animationCatalog: BattleIntegrationAnimationCatalog): Promise<object> {
  const read = async <T>(file: string): Promise<T> => JSON.parse(
    await readFile(path.join(outputDirectory, file), "utf8"),
  ) as T;
  const [movesData, pokemonData, trainersData, engineSupport] = await Promise.all([
    read<Dataset<MoveRecord>>("moves.json"), read<Dataset<PokemonRecord>>("pokemon.json"),
    read<Dataset<TrainerRecord>>("trainers.json"),
    read<{ readonly categories: {
      readonly moveFunctionCodes: readonly { readonly key: string; readonly engineSupport: Support }[];
      readonly abilities: readonly { readonly key: string; readonly engineSupport: Support }[];
    } }>("engine-support-report.json"),
  ]);
  const moves = new Map(movesData.records.map((record) => [record.internalName, record]));
  const pokemon = new Map(pokemonData.records.map((record) => [record.internalName, record]));
  const functionSupport = new Map(engineSupport.categories.moveFunctionCodes
    .map((entry) => [entry.key, entry.engineSupport] as const));
  const abilitySupport = new Map(engineSupport.categories.abilities
    .map((entry) => [entry.key, entry.engineSupport] as const));
  const moveUsage = new Map<string, Set<string>>();
  const abilityUsage = new Map<string, Set<string>>();
  const scopes: { kind: "pokemon" | "trainer"; id: string; moves: string[]; abilities: string[] }[] = [];

  for (const record of pokemonData.records) {
    const scope = `pokemon:${record.internalName}`;
    const scopeMoves = [...new Set(record.levelUpMoves.map((entry) => entry.move))];
    const scopeAbilities = [...new Set([...record.abilities, ...(record.hiddenAbilities ?? [])])];
    scopeMoves.forEach((move) => addUsage(moveUsage, move, scope));
    scopeAbilities.forEach((ability) => addUsage(abilityUsage, ability, scope));
    scopes.push({ kind: "pokemon", id: record.internalName, moves: scopeMoves, abilities: scopeAbilities });
  }
  for (const trainer of trainersData.records) {
    const scope = `trainer:${trainer.trainerType}:${trainer.name}:${trainer.version}`;
    const scopeMoves = new Set<string>();
    const scopeAbilities = new Set<string>();
    for (const member of trainer.pokemon) {
      const definition = pokemon.get(member.species);
      const explicitMoves = member.moves.filter((move): move is string => move !== null);
      (explicitMoves.length > 0 ? explicitMoves : defaultMoves(definition, member.level)).forEach((move) => scopeMoves.add(move));
      const availableAbilities = [...(definition?.abilities ?? []), ...(definition?.hiddenAbilities ?? [])];
      if (member.abilityIndex === null) availableAbilities.forEach((ability) => scopeAbilities.add(ability));
      else {
        const forced = availableAbilities[member.abilityIndex];
        if (forced !== undefined) scopeAbilities.add(forced);
      }
    }
    scopeMoves.forEach((move) => addUsage(moveUsage, move, scope));
    scopeAbilities.forEach((ability) => addUsage(abilityUsage, ability, scope));
    scopes.push({ kind: "trainer", id: `${trainer.trainerType}:${trainer.name}:${trainer.version}`,
      moves: [...scopeMoves], abilities: [...scopeAbilities] });
  }

  const importedAnimationIndices = new Set(animationCatalog.animations.map((animation) => animation.index));
  const mappings = new Map(animationCatalog.mappings.map((mapping) => [mapping.internalName, mapping]));
  const moveDependencies = [...moveUsage].sort(([left], [right]) => left.localeCompare(right)).map(([key, usedBy]) => {
    const move = moves.get(key);
    const support = move === undefined ? "not-implemented" : functionSupport.get(move.functionCode) ?? "not-implemented";
    const mapping = mappings.get(key);
    const animationIndices = mapping === undefined ? [] : [...new Set([mapping.player, mapping.opponent]
      .filter((index): index is number => index !== null))];
    return {
      key, name: move?.name ?? key, functionCode: move?.functionCode ?? null, support,
      animation: {
        mapped: animationIndices.length > 0,
        imported: animationIndices.some((index) => importedAnimationIndices.has(index)),
        indices: animationIndices,
      },
      usedBy: [...usedBy].sort(),
    };
  });
  const abilityDependencies = [...abilityUsage].sort(([left], [right]) => left.localeCompare(right)).map(([key, usedBy]) => ({
    key, support: abilitySupport.get(key) ?? "not-implemented", usedBy: [...usedBy].sort(),
  }));
  const commonVisuals = Object.entries(COMMON_VISUALS).map(([effect, animationName]) => ({
    effect, animationName,
    imported: animationCatalog.animations.some((animation) => animation.name === animationName),
  }));
  const issues = [
    ...moveDependencies.filter((entry) => entry.support !== "supported").map((entry) => ({
      kind: "move-mechanic", key: entry.key, support: entry.support, usedBy: entry.usedBy,
    })),
    ...moveDependencies.filter((entry) => entry.support !== "not-implemented" && !entry.animation.imported).map((entry) => ({
      kind: "move-animation", key: entry.key, support: entry.animation.mapped ? "not-imported" : "not-mapped", usedBy: entry.usedBy,
    })),
    ...abilityDependencies.filter((entry) => entry.support !== "supported").map((entry) => ({
      kind: "ability", key: entry.key, support: entry.support, usedBy: entry.usedBy,
    })),
    ...commonVisuals.filter((entry) => !entry.imported).map((entry) => ({
      kind: "status-animation", key: entry.effect, support: "not-imported", usedBy: ["battle-status"] as string[],
    })),
  ];
  return {
    schemaVersion: "1.0.0",
    policy: "Toute nouvelle espèce ou équipe de Dresseur hérite automatiquement de cet audit de dépendances.",
    summary: {
      pokemon: pokemonData.records.length, trainers: trainersData.records.length,
      moves: moveDependencies.length, abilities: abilityDependencies.length,
      importedAnimations: animationCatalog.animations.length, issues: issues.length,
      missingMoveMechanics: issues.filter((issue) => issue.kind === "move-mechanic").length,
      missingMoveAnimations: issues.filter((issue) => issue.kind === "move-animation").length,
      missingAbilities: issues.filter((issue) => issue.kind === "ability").length,
      missingStatusAnimations: issues.filter((issue) => issue.kind === "status-animation").length,
    },
    commonVisuals, moveDependencies, abilityDependencies, scopes, issues,
  };
}
