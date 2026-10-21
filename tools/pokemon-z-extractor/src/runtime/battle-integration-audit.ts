import { readdir, readFile } from "node:fs/promises";
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

interface MegaEvolutionRecord {
  readonly species: string;
  readonly form: number;
  readonly heldItem: string;
  readonly ability: string;
}

interface MegaEvolutionCatalog {
  readonly records: readonly MegaEvolutionRecord[];
}

interface Dataset<T> { readonly records: readonly T[] }

interface AbilitySelectionAudit {
  readonly species: string;
  readonly memberIndex: number | null;
  readonly policy: "random-normal" | "forced-index";
  readonly abilityIndex: number | null;
  readonly candidates: readonly string[];
}

interface EncounterRecord {
  readonly mapId: number;
  readonly methods: readonly { readonly slots: readonly {
    readonly species: string; readonly minimumLevel: number; readonly maximumLevel: number;
  }[] }[];
}

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

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

async function optionalJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function createBattleIntegrationAudit(outputDirectory: string,
  animationCatalog: BattleIntegrationAnimationCatalog): Promise<object> {
  const read = async <T>(file: string): Promise<T> => JSON.parse(
    await readFile(path.join(outputDirectory, file), "utf8"),
  ) as T;
  const [movesData, pokemonData, trainersData, megaEvolutionData, engineSupport, encounterData, eventFiles] = await Promise.all([
    read<Dataset<MoveRecord>>("moves.json"), read<Dataset<PokemonRecord>>("pokemon.json"),
    read<Dataset<TrainerRecord>>("trainers.json"),
    optionalJson<MegaEvolutionCatalog>(path.join(outputDirectory, "mega-evolutions.json"), { records: [] }),
    read<{ readonly categories: {
      readonly moveFunctionCodes: readonly { readonly key: string; readonly engineSupport: Support }[];
      readonly abilities: readonly { readonly key: string; readonly engineSupport: Support }[];
    } }>("engine-support-report.json"),
    optionalJson<Dataset<EncounterRecord>>(path.join(outputDirectory, "encounters.json"), { records: [] }),
    readdir(path.join(outputDirectory, "events")).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [] as string[];
      throw error;
    }),
  ]);
  const moves = new Map(movesData.records.map((record) => [record.internalName, record]));
  const pokemon = new Map(pokemonData.records.map((record) => [record.internalName, record]));
  const functionSupport = new Map(engineSupport.categories.moveFunctionCodes
    .map((entry) => [entry.key, entry.engineSupport] as const));
  const abilitySupport = new Map(engineSupport.categories.abilities
    .map((entry) => [entry.key, entry.engineSupport] as const));
  const moveUsage = new Map<string, Set<string>>();
  const abilityUsage = new Map<string, Set<string>>();
  const scopes: { kind: "pokemon" | "trainer" | "mega" | "map"; id: string; moves: string[];
    abilities: string[]; abilitySelections?: AbilitySelectionAudit[];
    pokemon?: string[]; trainers?: string[] }[] = [];

  for (const record of pokemonData.records) {
    const scope = `pokemon:${record.internalName}`;
    const scopeMoves = [...new Set(record.levelUpMoves.map((entry) => entry.move))];
    const scopeAbilities = [...new Set(record.abilities)];
    scopeMoves.forEach((move) => addUsage(moveUsage, move, scope));
    scopeAbilities.forEach((ability) => addUsage(abilityUsage, ability, scope));
    scopes.push({ kind: "pokemon", id: record.internalName, moves: scopeMoves, abilities: scopeAbilities,
      abilitySelections: [{ species: record.internalName, memberIndex: null, policy: "random-normal",
        abilityIndex: null, candidates: scopeAbilities }] });
  }
  for (const trainer of trainersData.records) {
    const scope = `trainer:${trainer.trainerType}:${trainer.name}:${trainer.version}`;
    const scopeMoves = new Set<string>();
    const scopeAbilities = new Set<string>();
    const abilitySelections: AbilitySelectionAudit[] = [];
    for (const [memberIndex, member] of trainer.pokemon.entries()) {
      const definition = pokemon.get(member.species);
      const explicitMoves = member.moves.filter((move): move is string => move !== null);
      (explicitMoves.length > 0 ? explicitMoves : defaultMoves(definition, member.level)).forEach((move) => scopeMoves.add(move));
      const normalAbilities = definition?.abilities ?? [];
      const indexedAbilities = [...normalAbilities, ...(definition?.hiddenAbilities ?? [])];
      const candidates = member.abilityIndex === null
        ? [...new Set(normalAbilities)]
        : indexedAbilities[member.abilityIndex] === undefined ? [] : [indexedAbilities[member.abilityIndex]!];
      candidates.forEach((ability) => scopeAbilities.add(ability));
      abilitySelections.push({ species: member.species, memberIndex,
        policy: member.abilityIndex === null ? "random-normal" : "forced-index",
        abilityIndex: member.abilityIndex, candidates });
    }
    scopeMoves.forEach((move) => addUsage(moveUsage, move, scope));
    scopeAbilities.forEach((ability) => addUsage(abilityUsage, ability, scope));
    scopes.push({ kind: "trainer", id: `${trainer.trainerType}:${trainer.name}:${trainer.version}`,
      moves: [...scopeMoves], abilities: [...scopeAbilities], abilitySelections });
  }
  for (const megaEvolution of megaEvolutionData.records) {
    const definition = pokemon.get(megaEvolution.species);
    const scope = `mega:${megaEvolution.species}:${megaEvolution.form}`;
    const scopeMoves = [...new Set(definition?.levelUpMoves.map((entry) => entry.move) ?? [])];
    const scopeAbilities = [megaEvolution.ability];
    scopeMoves.forEach((move) => addUsage(moveUsage, move, scope));
    scopeAbilities.forEach((ability) => addUsage(abilityUsage, ability, scope));
    scopes.push({ kind: "mega", id: `${megaEvolution.species}:${megaEvolution.form}`,
      moves: scopeMoves, abilities: scopeAbilities });
  }
  const encountersByMap = new Map<number, EncounterRecord>();
  for (const encounter of encounterData.records) encountersByMap.set(encounter.mapId, encounter);
  for (const eventFile of eventFiles.filter((file) => /^Map\d{3}\.json$/u.test(file)).sort()) {
    const mapId = Number.parseInt(eventFile.slice(3, 6), 10);
    const scope = `map:${mapId}`;
    const mapMoves = new Set<string>();
    const mapAbilities = new Set<string>();
    const mapPokemon = new Set<string>();
    const mapTrainers = new Set<string>();
    const includePokemon = (species: string, level: number): void => {
      const definition = pokemon.get(species);
      if (definition === undefined) return;
      mapPokemon.add(species);
      defaultMoves(definition, level).forEach((move) => mapMoves.add(move));
      if (definition.abilities[0] !== undefined) mapAbilities.add(definition.abilities[0]);
    };
    const encounter = encountersByMap.get(mapId);
    const encounteredLevels = new Map<string, number>();
    for (const slot of encounter?.methods.flatMap((method) => method.slots) ?? []) {
      encounteredLevels.set(slot.species, Math.max(encounteredLevels.get(slot.species) ?? 1, slot.maximumLevel));
    }
    for (const [species, level] of encounteredLevels) includePokemon(species, level);
    const eventData = await optionalJson<unknown>(path.join(outputDirectory, "events", eventFile), null);
    for (const source of stringsIn(eventData)) {
      const trainer = /pbTrainerBattle\(PBTrainers::([A-Z][A-Z0-9_]*),\s*"((?:\\.|[^"\\])*)",\s*_I\("(?:\\.|[^"\\])*"\),\s*(?:true|false),\s*(\d+),\s*(?:true|false)/u.exec(source);
      if (trainer !== null) {
        const trainerId = `${trainer[1]}:${trainer[2]}:${trainer[3]}`;
        const definition = trainersData.records.find((candidate) =>
          `${candidate.trainerType}:${candidate.name}:${candidate.version}` === trainerId);
        if (definition !== undefined) {
          mapTrainers.add(trainerId);
          for (const member of definition.pokemon) {
            mapPokemon.add(member.species);
            const species = pokemon.get(member.species);
            const explicitMoves = member.moves.filter((move): move is string => move !== null);
            (explicitMoves.length > 0 ? explicitMoves : defaultMoves(species, member.level))
              .forEach((move) => mapMoves.add(move));
            const availableAbilities = [...(species?.abilities ?? []), ...(species?.hiddenAbilities ?? [])];
            const abilityIndex = member.abilityIndex;
            if (abilityIndex === null && availableAbilities[0] !== undefined) {
              mapAbilities.add(availableAbilities[0]);
            }
            else if (abilityIndex !== null && availableAbilities[abilityIndex] !== undefined) {
              mapAbilities.add(availableAbilities[abilityIndex]!);
            }
          }
        }
      }
      for (const boss of source.matchAll(/pbBossFight\((.+?),\s*(\d+)\)/gu)) {
        const level = Number.parseInt(boss[2]!, 10);
        for (const species of boss[1]!.matchAll(/:([A-Z][A-Z0-9_]*)/gu)) includePokemon(species[1]!, level);
      }
      for (const wild of source.matchAll(/pbWildBattle\(PBSpecies::([A-Z][A-Z0-9_]*),\s*(\d+)\)/gu)) {
        includePokemon(wild[1]!, Number.parseInt(wild[2]!, 10));
      }
    }
    mapMoves.forEach((move) => addUsage(moveUsage, move, scope));
    mapAbilities.forEach((ability) => addUsage(abilityUsage, ability, scope));
    scopes.push({ kind: "map", id: String(mapId), moves: [...mapMoves], abilities: [...mapAbilities],
      pokemon: [...mapPokemon], trainers: [...mapTrainers] });
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
    schemaVersion: "1.1.0",
    policy: "Toute nouvelle espèce, forme Méga ou équipe de Dresseur hérite automatiquement de cet audit de dépendances.",
    summary: {
      pokemon: pokemonData.records.length, trainers: trainersData.records.length,
      maps: scopes.filter((scope) => scope.kind === "map").length,
      megaEvolutions: megaEvolutionData.records.length,
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
