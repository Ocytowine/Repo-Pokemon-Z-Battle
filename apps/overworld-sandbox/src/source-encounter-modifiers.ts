import type { MajorStatusState } from "@pokemon-z-battle/battle-engine";
import { calculatePokemonStats, type PersistentMoveSlot, type PersistentPokemon,
  type PlayerCreationCatalog, type PokemonTrainingValues } from "@pokemon-z-battle/player-state";

type TrainingStat = keyof PokemonTrainingValues;

export interface SourceEncounterModifierEffects {
  readonly majorStatus?: MajorStatusState["kind"];
  readonly form?: number;
  readonly learnedMoves?: readonly string[];
  readonly ivs?: Readonly<Partial<Record<TrainingStat, number>>>;
  readonly evs?: Readonly<Partial<Record<TrainingStat, number>>>;
  readonly heldItem?: string;
  readonly shiny?: true;
  readonly nickname?: string;
  readonly levelPolicy?: "balanced-minus-four-to-zero";
}

export interface SourceEncounterModifierRule {
  readonly mapIds: readonly number[];
  readonly species: readonly string[];
  readonly requiredSwitches: readonly number[];
  readonly effects: SourceEncounterModifierEffects;
  readonly source: { readonly file: string; readonly line: number };
}

export interface SourceEncounterModifierCatalog { readonly records: readonly SourceEncounterModifierRule[] }
export interface SourceEncounterModifierContext {
  readonly mapId: number;
  readonly species: string;
  readonly switches: Readonly<Record<string, boolean>>;
}
export interface SourceEncounterInitialEffects {
  readonly majorStatus: MajorStatusState | null;
  readonly form?: number;
  readonly learnedMoves?: readonly string[];
  readonly ivs?: Readonly<Partial<Record<TrainingStat, number>>>;
  readonly evs?: Readonly<Partial<Record<TrainingStat, number>>>;
  readonly heldItem?: string;
  readonly shiny?: true;
  readonly nickname?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integers(value: unknown): readonly number[] | null {
  return Array.isArray(value) && value.every((entry) => Number.isSafeInteger(entry) && (entry as number) >= 0)
    ? value as number[] : null;
}
function strings(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value as string[] : null;
}

const MAJOR_STATUSES = new Set<MajorStatusState["kind"]>([
  "sleep", "poison", "burn", "paralysis", "frozen", "caduco", "hemorrhage",
]);
const TRAINING_STATS = new Set<TrainingStat>(["hp", "attack", "defense", "speed", "specialAttack", "specialDefense"]);

function trainingValues(value: unknown, maximum: number): Readonly<Partial<Record<TrainingStat, number>>> | null {
  if (!isRecord(value)) return null;
  const result: Partial<Record<TrainingStat, number>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!TRAINING_STATS.has(key as TrainingStat) || !Number.isSafeInteger(entry)
      || (entry as number) < 0 || (entry as number) > maximum) return null;
    result[key as TrainingStat] = entry as number;
  }
  return result;
}

function parseEffects(value: Record<string, unknown>): SourceEncounterModifierEffects | null {
  const known = new Set(["majorStatus", "form", "learnedMoves", "ivs", "evs", "heldItem", "shiny", "nickname", "levelPolicy"]);
  if (Object.keys(value).some((key) => !known.has(key))) return null;
  const majorStatus = value.majorStatus;
  const form = value.form;
  const learnedMoves = value.learnedMoves === undefined ? undefined : strings(value.learnedMoves);
  const ivs = value.ivs === undefined ? undefined : trainingValues(value.ivs, 31);
  const evs = value.evs === undefined ? undefined : trainingValues(value.evs, 255);
  if (majorStatus !== undefined && (typeof majorStatus !== "string"
      || !MAJOR_STATUSES.has(majorStatus as MajorStatusState["kind"]))
    || form !== undefined && (!Number.isSafeInteger(form) || (form as number) < 0)
    || learnedMoves === null || ivs === null || evs === null
    || value.heldItem !== undefined && typeof value.heldItem !== "string"
    || value.shiny !== undefined && value.shiny !== true
    || value.nickname !== undefined && typeof value.nickname !== "string"
    || value.levelPolicy !== undefined && value.levelPolicy !== "balanced-minus-four-to-zero") return null;
  return {
    ...(majorStatus === undefined ? {} : { majorStatus: majorStatus as MajorStatusState["kind"] }),
    ...(form === undefined ? {} : { form: form as number }),
    ...(learnedMoves === undefined ? {} : { learnedMoves }),
    ...(ivs === undefined ? {} : { ivs }), ...(evs === undefined ? {} : { evs }),
    ...(value.heldItem === undefined ? {} : { heldItem: value.heldItem as string }),
    ...(value.shiny === undefined ? {} : { shiny: true as const }),
    ...(value.nickname === undefined ? {} : { nickname: value.nickname as string }),
    ...(value.levelPolicy === undefined ? {} : { levelPolicy: value.levelPolicy as "balanced-minus-four-to-zero" }),
  };
}

export function parseSourceEncounterModifierCatalog(value: unknown): SourceEncounterModifierCatalog {
  if (!isRecord(value) || value.schemaVersion !== "1.0.0" || !Array.isArray(value.records)) {
    throw new Error("Le catalogue des modificateurs de rencontre est invalide.");
  }
  const records = value.records.map((entry): SourceEncounterModifierRule => {
    if (!isRecord(entry) || !isRecord(entry.effects) || !isRecord(entry.source)) {
      throw new Error("Une règle de modification de rencontre est invalide.");
    }
    const mapIds = integers(entry.mapIds);
    const species = strings(entry.species);
    const requiredSwitches = integers(entry.requiredSwitches);
    const effects = parseEffects(entry.effects);
    if (mapIds === null || species === null || requiredSwitches === null || effects === null
      || typeof entry.source.file !== "string" || !Number.isSafeInteger(entry.source.line)) {
      throw new Error("Une règle de modification de rencontre est invalide.");
    }
    return { mapIds, species, requiredSwitches, effects,
      source: { file: entry.source.file, line: entry.source.line as number } };
  });
  return { records };
}

function statusState(kind: MajorStatusState["kind"]): MajorStatusState {
  if (kind === "sleep") return { kind, turnsRemaining: 2 };
  if (kind === "poison") return { kind, toxicCounter: null };
  return { kind };
}

export function resolveSourceEncounterInitialEffects(catalog: SourceEncounterModifierCatalog,
  context: SourceEncounterModifierContext): SourceEncounterInitialEffects {
  let effects: SourceEncounterInitialEffects = { majorStatus: null };
  for (const rule of catalog.records) {
    if (rule.mapIds.length > 0 && !rule.mapIds.includes(context.mapId)) continue;
    if (rule.species.length > 0 && !rule.species.includes(context.species)) continue;
    if (!rule.requiredSwitches.every((switchId) => context.switches[String(switchId)] === true)) continue;
    effects = {
      ...effects, ...rule.effects,
      majorStatus: rule.effects.majorStatus === undefined ? effects.majorStatus : statusState(rule.effects.majorStatus),
      ...(effects.learnedMoves === undefined && rule.effects.learnedMoves === undefined ? {}
        : { learnedMoves: [...(effects.learnedMoves ?? []), ...(rule.effects.learnedMoves ?? [])] }),
      ...(effects.ivs === undefined && rule.effects.ivs === undefined ? {}
        : { ivs: { ...effects.ivs, ...rule.effects.ivs } }),
      ...(effects.evs === undefined && rule.effects.evs === undefined ? {}
        : { evs: { ...effects.evs, ...rule.effects.evs } }),
    };
  }
  return effects;
}

/** Exact port of Z's pbBalancedLevel, followed by Map999's -4+rand(5) rule. */
export function hasSourceEncounterDynamicLevel(catalog: SourceEncounterModifierCatalog,
  context: SourceEncounterModifierContext): boolean {
  return catalog.records.some((rule) => rule.effects.levelPolicy === "balanced-minus-four-to-zero"
    && (rule.mapIds.length === 0 || rule.mapIds.includes(context.mapId))
    && (rule.species.length === 0 || rule.species.includes(context.species))
    && rule.requiredSwitches.every((switchId) => context.switches[String(switchId)] === true));
}

export function resolveSourceEncounterLevel(catalog: SourceEncounterModifierCatalog,
  context: SourceEncounterModifierContext, partyLevels: readonly number[], baseLevel: number,
  nextInt: (maximum: number) => number): number {
  if (!hasSourceEncounterDynamicLevel(catalog, context) || partyLevels.length === 0) return baseLevel;
  const sum = partyLevels.reduce((total, level) => total + level, 0);
  if (sum === 0) return 1;
  const average = sum / partyLevels.length;
  const varianceTimesN = partyLevels.reduce((total, level) => total + (level - average) ** 2, 0);
  const deviation = Math.sqrt(varianceTimesN / partyLevels.length);
  const weights = partyLevels.map((level) => {
    const weight = level / sum;
    return weight < 0.5 ? Math.max(0.001, weight - deviation / 100)
      : Math.min(0.999, weight + deviation / 100);
  });
  const weightSum = weights.reduce((total, weight) => total + weight, 0);
  const weighted = partyLevels.reduce((total, level, index) => total + level * weights[index]!, 0) / weightSum;
  const balanced = Math.min(100, Math.max(1, Math.round(weighted)) + 2);
  return Math.min(100, Math.max(1, balanced - 4 + nextInt(5)));
}

function learnMoves(current: readonly PersistentMoveSlot[], requested: readonly string[],
  catalog: PlayerCreationCatalog): readonly PersistentMoveSlot[] {
  const moves = [...current];
  for (const internalName of requested) {
    const definition = catalog.moves.find((move) => move.internalName === internalName);
    if (definition === undefined) throw new Error(`Capacité de modificateur absente du catalogue : ${internalName}.`);
    const knownIndex = moves.findIndex((move) => move.internalName === internalName);
    if (knownIndex >= 0) {
      const [known] = moves.splice(knownIndex, 1);
      moves.push(known!);
      continue;
    }
    if (moves.length >= 4) moves.shift();
    moves.push({ internalName, pp: definition.pp, maxPp: definition.pp });
  }
  return moves;
}

export function applySourceEncounterInitialEffects(pokemon: PersistentPokemon,
  effects: SourceEncounterInitialEffects, catalog: PlayerCreationCatalog): PersistentPokemon {
  const metadata = {
    ...pokemon.metadata,
    ...(effects.form === undefined ? {} : { form: effects.form }),
    ...(effects.shiny === undefined ? {} : { shiny: true }),
    ivs: { ...pokemon.metadata.ivs, ...effects.ivs },
    evs: { ...pokemon.metadata.evs, ...effects.evs },
  };
  const definition = catalog.pokemon.find((candidate) => candidate.internalName === pokemon.species);
  if (definition === undefined) throw new Error(`Espèce de modificateur absente du catalogue : ${pokemon.species}.`);
  const stats = calculatePokemonStats(definition, pokemon.level, metadata);
  return {
    ...pokemon, metadata, stats, hp: stats.maxHp, majorStatus: effects.majorStatus,
    ...(effects.heldItem === undefined ? {} : { heldItem: effects.heldItem }),
    ...(effects.nickname === undefined ? {} : { nickname: effects.nickname }),
    moves: effects.learnedMoves === undefined ? pokemon.moves : learnMoves(pokemon.moves, effects.learnedMoves, catalog),
  };
}
