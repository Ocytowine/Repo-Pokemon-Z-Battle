import type { ImportedEventPage, ImportedMapEvent } from "./imported-map.js";
import { addPokemonToParty, addPokemonToStorage, createEmptyPlayerParty, createEmptyPlayerPokemonStorage,
  healPlayerParty, parsePlayerParty, parsePlayerPokemonStorage, type PersistentPokemon, type PlayerPartyState,
  type PlayerPokemonStorageState } from "@pokemon-z-battle/player-state";
import { isSourceStarterSelectionPage } from "./source-script-ports.js";
import { isKnownSourceCommand, isSourceStateCommand } from "./source-command-registry.js";
import { reconcileSourcePokeVial, refillSourcePokeVial, type SourcePokeVialState } from "./source-poke-vial.js";
import { createEmptySourceDayCare, parseSourceDayCare, type SourceDayCareState } from "./source-day-care.js";
import { createEmptySourceIncubator, parseSourceIncubator, type SourceIncubatorState } from "./source-incubator.js";

export interface SourceEventState {
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly selfSwitches: Readonly<Record<string, boolean>>;
  readonly inventory: Readonly<Record<string, number>>;
  readonly money: number;
  readonly runningShoes: boolean;
  readonly pokedexEnabled: boolean;
  readonly pokedex: SourcePokedexHistory;
  readonly pokeVial: SourcePokeVialState;
  readonly followerEnabled: boolean;
  readonly checkpoint: SourceCheckpoint | null;
  readonly party: PlayerPartyState;
  readonly ranch: PlayerPokemonStorageState;
  /** Personnel state: never replicated as host narrative state in Coop. */
  readonly dayCare: SourceDayCareState;
  /** Six personal egg slots from the source INCUBADORA item; never projected to the room. */
  readonly incubator: SourceIncubatorState;
  /** Ordered personal hatch queue. Eggs remain opaque at one step until their blocking scene completes. */
  readonly pendingHatches: readonly string[];
  readonly pendingEncounter: SourceEncounter | null;
  /** Personal Bag shortcut; omitted in legacy saves until the player chooses a rod. */
  readonly preferredFishingRod?: SourceFishingRod;
  /** Personal and persisted; only the resulting encounter is presented to Coop participants. */
  readonly typeAmulet: SourceTypeAmuletState | null;
  /** Compteur personnel des pas, restauré après reconnexion, pour les effets périodiques comme le bonheur. */
  readonly happinessSteps: number;
  readonly wildEncounterSteps: number;
  readonly wildEncounterRngState: number;
  readonly appliedBattleSettlementIds: readonly string[];
}

export interface SourceTypeAmuletState {
  readonly itemId: string;
  readonly type: string;
  readonly stepsRemaining: number;
}

export type SourceFishingRod = "OLDROD" | "GOODROD" | "SUPERROD";

export interface SourcePokedexHistory {
  readonly seenSpecies: readonly string[];
  readonly caughtSpecies: readonly string[];
  readonly evolvedSpecies: readonly string[];
  readonly releasedSpecies: readonly string[];
}

export const EMPTY_SOURCE_POKEDEX: SourcePokedexHistory = Object.freeze({
  seenSpecies: Object.freeze([]), caughtSpecies: Object.freeze([]),
  evolvedSpecies: Object.freeze([]), releasedSpecies: Object.freeze([]),
});

export const SOURCE_INITIAL_MONEY = 3_000;
export const SOURCE_MAX_MONEY = 999_999;

export interface SourceEncounter {
  readonly species: string;
  readonly level: number;
  /** Migrated saves may omit it; new encounters preserve the field origin for capture rules and reports. */
  readonly method?: "land" | "cave" | "rock-smash" | "fishing" | "scripted";
  readonly victorySwitches: Readonly<Record<string, boolean>>;
  readonly escapable: boolean;
}

export interface SourceCheckpoint {
  readonly mapId: number;
  readonly x: number;
  readonly y: number;
  readonly direction: "up" | "down" | "left" | "right";
}

export interface SourceExecutionContext {
  readonly checkpoint: SourceCheckpoint;
  readonly createPokemon?: (species: string, level: number) => PersistentPokemon;
}

export interface StateCommandResult {
  readonly state: SourceEventState;
  readonly appliedCommands: number;
  readonly safe: boolean;
  readonly reason: string | null;
}

export const EMPTY_SOURCE_EVENT_STATE: SourceEventState = Object.freeze({
  switches: Object.freeze({}), variables: Object.freeze({}), selfSwitches: Object.freeze({}), inventory: Object.freeze({}), money: SOURCE_INITIAL_MONEY, runningShoes: false, pokedexEnabled: false, pokedex: EMPTY_SOURCE_POKEDEX, pokeVial: Object.freeze({ current: 0, maximum: 0 }), followerEnabled: false, checkpoint: null,
  party: Object.freeze(createEmptyPlayerParty()),
  ranch: Object.freeze(createEmptyPlayerPokemonStorage()),
  dayCare: Object.freeze(createEmptySourceDayCare()),
  incubator: Object.freeze(createEmptySourceIncubator()),
  pendingHatches: Object.freeze([]),
  pendingEncounter: null,
  typeAmulet: null,
  happinessSteps: 0,
  wildEncounterSteps: 0,
  wildEncounterRngState: 0x9e37_79b9,
  appliedBattleSettlementIds: Object.freeze([]),
});

export function createSourceEventState(): SourceEventState {
  return { switches: {}, variables: {}, selfSwitches: {}, inventory: {}, money: SOURCE_INITIAL_MONEY, runningShoes: false, pokedexEnabled: false, pokedex: { seenSpecies: [], caughtSpecies: [], evolvedSpecies: [], releasedSpecies: [] }, pokeVial: { current: 0, maximum: 0 }, followerEnabled: false, checkpoint: null, party: createEmptyPlayerParty(), ranch: createEmptyPlayerPokemonStorage(), dayCare: createEmptySourceDayCare(), incubator: createEmptySourceIncubator(), pendingHatches: [], pendingEncounter: null,
    typeAmulet: null, happinessSteps: 0, wildEncounterSteps: 0, wildEncounterRngState: 0x9e37_79b9,
    appliedBattleSettlementIds: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isFinite(value);
}

function selfSwitchKey(mapId: number, eventId: number, id: string): string {
  return `${mapId}:${eventId}:${id}`;
}

export function selectActiveEventPage(event: ImportedMapEvent, mapId: number, state: SourceEventState):
{ readonly page: ImportedEventPage; readonly pageIndex: number } | null {
  for (let index = event.pages.length - 1; index >= 0; index -= 1) {
    const page = event.pages[index];
    if (page === undefined) continue;
    const condition = page.condition;
    if (condition.switch1Id !== null && state.switches[String(condition.switch1Id)] !== true) continue;
    if (condition.switch2Id !== null && state.switches[String(condition.switch2Id)] !== true) continue;
    if (condition.variable !== null && (state.variables[String(condition.variable.id)] ?? 0) < condition.variable.minimum) continue;
    if (condition.selfSwitch !== null && state.selfSwitches[selfSwitchKey(mapId, event.id, condition.selfSwitch)] !== true) continue;
    if (state.party.members.length > 0 && isSourceStarterSelectionPage(page)) continue;
    return { page, pageIndex: index };
  }
  return null;
}

function range(data: Readonly<Record<string, unknown>>): readonly number[] | null {
  if (!finiteInteger(data.firstId) || !finiteInteger(data.lastId) || data.firstId < 1 || data.lastId < data.firstId) return null;
  return Array.from({ length: data.lastId - data.firstId + 1 }, (_, index) => data.firstId as number + index);
}

function variableOperand(data: Readonly<Record<string, unknown>>, state: SourceEventState): number | null {
  if (!isRecord(data.operand) || typeof data.operand.kind !== "string" || !Array.isArray(data.operand.values)) return null;
  const value = data.operand.values[0];
  if (!finiteInteger(value)) return null;
  if (data.operand.kind === "constant") return value;
  if (data.operand.kind === "variable") return state.variables[String(value)] ?? 0;
  return null;
}

function changedVariable(current: number, operation: unknown, operand: number): number | null {
  switch (operation) {
    case "set": return operand;
    case "add": return current + operand;
    case "subtract": return current - operand;
    case "multiply": return current * operand;
    case "divide": return operand === 0 ? null : Math.trunc(current / operand);
    case "modulo": return operand === 0 ? null : current % operand;
    default: return null;
  }
}

export function applySafeStateCommands(state: SourceEventState, page: ImportedEventPage, mapId: number, eventId: number,
  context?: SourceExecutionContext): StateCommandResult {
  const unsupported = page.commands.find((command) => !isKnownSourceCommand(command.kind));
  if (unsupported !== undefined) {
    return { state, appliedCommands: 0, safe: false, reason: `commande ${unsupported.kind} non prise en charge` };
  }
  let switches = { ...state.switches };
  let variables = { ...state.variables };
  let selfSwitches = { ...state.selfSwitches };
  let inventory = { ...state.inventory };
  let money = state.money;
  let runningShoes = state.runningShoes;
  let pokedexEnabled = state.pokedexEnabled;
  let followerEnabled = state.followerEnabled;
  let checkpoint = state.checkpoint;
  let party = state.party;
  let ranch = state.ranch;
  let pendingEncounter = state.pendingEncounter;
  let encounterQueued = false;
  let appliedCommands = 0;
  for (const command of page.commands) {
    if (!isSourceStateCommand(command.kind)) continue;
    if (encounterQueued) {
      if (command.kind !== "set-switches" || pendingEncounter === null) {
        return { state, appliedCommands: 0, safe: false, reason: `commande ${command.kind} après combat non prise en charge` };
      }
      const ids = range(command.data);
      if (ids === null || typeof command.data.value !== "boolean") {
        return { state, appliedCommands: 0, safe: false, reason: "paramètres d'interrupteur de victoire invalides" };
      }
      const victorySwitches = { ...pendingEncounter.victorySwitches };
      ids.forEach((id) => { victorySwitches[String(id)] = command.data.value as boolean; });
      pendingEncounter = { ...pendingEncounter, victorySwitches };
      appliedCommands += 1;
      continue;
    }
    if (command.kind === "set-switches") {
      const ids = range(command.data);
      if (ids === null || typeof command.data.value !== "boolean") return { state, appliedCommands: 0, safe: false, reason: "paramètres d'interrupteur invalides" };
      ids.forEach((id) => { switches[String(id)] = command.data.value as boolean; });
    } else if (command.kind === "set-self-switch") {
      if (typeof command.data.id !== "string" || typeof command.data.value !== "boolean") return { state, appliedCommands: 0, safe: false, reason: "paramètres de self-switch invalides" };
      selfSwitches[selfSwitchKey(mapId, eventId, command.data.id)] = command.data.value;
    } else if (command.kind === "change-variables") {
      const ids = range(command.data);
      const operand = variableOperand(command.data, { switches, variables, selfSwitches, inventory, money, runningShoes, pokedexEnabled, pokedex: state.pokedex, pokeVial: state.pokeVial, followerEnabled, checkpoint, party, ranch, dayCare: state.dayCare, incubator: state.incubator, pendingHatches: state.pendingHatches, pendingEncounter,
        typeAmulet: state.typeAmulet,
        happinessSteps: state.happinessSteps,
        wildEncounterSteps: state.wildEncounterSteps, wildEncounterRngState: state.wildEncounterRngState,
        appliedBattleSettlementIds: state.appliedBattleSettlementIds });
      if (ids === null || operand === null) return { state, appliedCommands: 0, safe: false, reason: "opérande de variable non prise en charge" };
      for (const id of ids) {
        const next = changedVariable(variables[String(id)] ?? 0, command.data.operation, operand);
        if (next === null) return { state, appliedCommands: 0, safe: false, reason: "opération de variable invalide" };
        variables[String(id)] = next;
      }
    } else if (command.kind === "change-money") {
      const values = Array.isArray(command.data.parameters) ? command.data.parameters : [];
      const operation = values[0];
      const operandType = values[1];
      const rawOperand = values[2];
      const operand = operandType === 0 && finiteInteger(rawOperand) ? rawOperand
        : operandType === 1 && finiteInteger(rawOperand) ? variables[String(rawOperand)] ?? 0 : null;
      if ((operation !== 0 && operation !== 1) || operand === null || operand < 0) {
        return { state, appliedCommands: 0, safe: false, reason: "parametres d'argent invalides" };
      }
      money = Math.max(0, Math.min(SOURCE_MAX_MONEY, operation === 0 ? money + operand : money - operand));
    } else if (command.kind === "grant-item" || command.kind === "remove-item") {
      const itemId = command.data.itemId;
      const quantity = command.data.quantity;
      if (typeof itemId !== "string" || !finiteInteger(quantity) || quantity < 1) {
        return { state, appliedCommands: 0, safe: false, reason: "paramètres d'objet invalides" };
      }
      const current = inventory[itemId] ?? 0;
      if (command.kind === "remove-item" && current < quantity) {
        return { state, appliedCommands: 0, safe: false, reason: `objet ${itemId} absent de l'inventaire` };
      }
      const next = command.kind === "grant-item" ? current + quantity : current - quantity;
      if (!Number.isSafeInteger(next)) return { state, appliedCommands: 0, safe: false, reason: "quantité d'objet invalide" };
      if (next === 0) delete inventory[itemId]; else inventory[itemId] = next;
    } else if (command.kind === "set-running-shoes") {
      if (typeof command.data.value !== "boolean") {
        return { state, appliedCommands: 0, safe: false, reason: "parametre de chaussures de course invalide" };
      }
      runningShoes = command.data.value;
    } else if (command.kind === "set-pokedex-enabled") {
      if (typeof command.data.value !== "boolean") {
        return { state, appliedCommands: 0, safe: false, reason: "parametre de Pokedex invalide" };
      }
      pokedexEnabled = command.data.value;
    } else if (command.kind === "set-follower") {
      if (command.data.value !== undefined && typeof command.data.value !== "boolean") {
        return { state, appliedCommands: 0, safe: false, reason: "parametre de suiveur invalide" };
      }
      followerEnabled = command.data.value !== false;
    } else if (command.kind === "set-checkpoint") {
      if (context === undefined) return { state, appliedCommands: 0, safe: false, reason: "position du point de reprise absente" };
      checkpoint = { ...context.checkpoint };
    } else if (command.kind === "heal-party") {
      party = healPlayerParty(party);
    } else if (command.kind === "refill-poke-vial") {
      const refilled = refillSourcePokeVial({ ...state, switches, variables, selfSwitches, inventory, money,
        runningShoes, pokedexEnabled, followerEnabled, checkpoint, party, ranch, dayCare: state.dayCare, incubator: state.incubator, pendingEncounter });
      variables = { ...refilled.variables };
    } else if (command.kind === "add-pokemon") {
      const species = command.data.species;
      const level = command.data.level;
      if (typeof species !== "string" || !finiteInteger(level) || level < 1 || level > 100 || context?.createPokemon === undefined) {
        return { state, appliedCommands: 0, safe: false, reason: "catalogue de création Pokémon absent" };
      }
      try {
        const pokemon = context.createPokemon(species, level);
        if (party.members.length < 6) party = addPokemonToParty(party, pokemon);
        else ranch = addPokemonToStorage(ranch, pokemon);
      } catch (error) {
        return { state, appliedCommands: 0, safe: false, reason: error instanceof Error ? error.message : "ajout du Pokémon impossible" };
      }
    } else if (command.kind === "request-encounter") {
      const species = command.data.species;
      const level = command.data.level;
      if (typeof species !== "string" || !finiteInteger(level) || level < 1 || level > 100 || party.members.length === 0) {
        return { state, appliedCommands: 0, safe: false, reason: "rencontre impossible sans équipe valide" };
      }
      pendingEncounter = { species, level, method: "scripted", victorySwitches: {}, escapable: false };
      encounterQueued = true;
    }
    appliedCommands += 1;
  }
  const nextState: SourceEventState = { switches, variables, selfSwitches, inventory, money, runningShoes,
    pokedexEnabled, pokedex: state.pokedex, pokeVial: state.pokeVial, followerEnabled, checkpoint, party, ranch, dayCare: state.dayCare, incubator: state.incubator, pendingHatches: state.pendingHatches, pendingEncounter,
    typeAmulet: state.typeAmulet,
    ...(state.preferredFishingRod === undefined ? {} : { preferredFishingRod: state.preferredFishingRod }),
    happinessSteps: state.happinessSteps,
    wildEncounterSteps: state.wildEncounterSteps, wildEncounterRngState: state.wildEncounterRngState,
    appliedBattleSettlementIds: state.appliedBattleSettlementIds };
  return { state: reconcileSourcePokedex(reconcileSourcePokeVial(nextState)), appliedCommands, safe: true, reason: null };
}

export function completePendingEncounter(state: SourceEventState): SourceEventState {
  if (state.pendingEncounter === null) return state;
  return { ...state, switches: { ...state.switches, ...state.pendingEncounter.victorySwitches }, pendingEncounter: null };
}

function booleanDictionary(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== "boolean")) return null;
  return { ...value } as Record<string, boolean>;
}

function numberDictionary(value: unknown): Record<string, number> | null {
  if (!isRecord(value) || Object.values(value).some((entry) => !finiteInteger(entry))) return null;
  return { ...value } as Record<string, number>;
}

function speciesList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 10_000
    || value.some((entry) => typeof entry !== "string" || !/^[A-Z0-9_]{1,64}$/u.test(entry))) return null;
  return [...new Set(value as string[])];
}

function addSpecies(entries: readonly string[], species: readonly string[]): readonly string[] {
  return [...new Set([...entries, ...species])];
}

export function reconcileSourcePokedex(state: SourceEventState): SourceEventState {
  const current = [...state.party.members, ...state.ranch.members]
    .filter((pokemon) => pokemon.metadata.eggSteps <= 0).map((pokemon) => pokemon.species);
  const caughtSpecies = addSpecies(state.pokedex.caughtSpecies, current);
  const seenSpecies = addSpecies(state.pokedex.seenSpecies,
    [...caughtSpecies, ...(state.pendingEncounter === null ? [] : [state.pendingEncounter.species])]);
  if (caughtSpecies.length === state.pokedex.caughtSpecies.length
    && seenSpecies.length === state.pokedex.seenSpecies.length) return state;
  return { ...state, pokedex: { ...state.pokedex, caughtSpecies, seenSpecies } };
}

export function recordSourcePokedexSeen(state: SourceEventState, species: readonly string[]): SourceEventState {
  return reconcileSourcePokedex({ ...state, pokedex: { ...state.pokedex,
    seenSpecies: addSpecies(state.pokedex.seenSpecies, species) } });
}

export function recordSourcePokedexEvolution(state: SourceEventState,
  previousSpecies: string, nextSpecies: string): SourceEventState {
  return reconcileSourcePokedex({ ...state, pokedex: { ...state.pokedex,
    seenSpecies: addSpecies(state.pokedex.seenSpecies, [previousSpecies, nextSpecies]),
    caughtSpecies: addSpecies(state.pokedex.caughtSpecies, [previousSpecies, nextSpecies]),
    evolvedSpecies: addSpecies(state.pokedex.evolvedSpecies, [previousSpecies]) } });
}

/** Prepared for the Ranch release action; it records history without owning the removal transaction. */
export function recordSourcePokedexRelease(state: SourceEventState, species: string): SourceEventState {
  return { ...state, pokedex: { ...state.pokedex,
    seenSpecies: addSpecies(state.pokedex.seenSpecies, [species]),
    caughtSpecies: addSpecies(state.pokedex.caughtSpecies, [species]),
    releasedSpecies: addSpecies(state.pokedex.releasedSpecies, [species]) } };
}

export function parseSourceEventState(value: unknown): SourceEventState {
  if (!isRecord(value)) throw new Error("État source invalide.");
  const switches = booleanDictionary(value.switches);
  const variables = numberDictionary(value.variables);
  const selfSwitches = booleanDictionary(value.selfSwitches);
  const inventory = value.inventory === undefined ? {} : numberDictionary(value.inventory);
  const money = value.money === undefined ? SOURCE_INITIAL_MONEY : value.money;
  const runningShoes = value.runningShoes === undefined ? false : value.runningShoes;
  const pokedexEnabled = value.pokedexEnabled === undefined ? false : value.pokedexEnabled;
  const pokeVialValue = value.pokeVial;
  const pokeVial = pokeVialValue === undefined ? { current: 0, maximum: 0 }
    : isRecord(pokeVialValue) && finiteInteger(pokeVialValue.current) && finiteInteger(pokeVialValue.maximum)
      && pokeVialValue.current >= 0 && pokeVialValue.maximum >= pokeVialValue.current && pokeVialValue.maximum <= 5
      ? { current: pokeVialValue.current, maximum: pokeVialValue.maximum } : null;
  const followerValue = value.followerEnabled;
  const checkpointValue = value.checkpoint;
  const checkpoint = checkpointValue === undefined || checkpointValue === null ? null
    : isRecord(checkpointValue) && finiteInteger(checkpointValue.mapId) && finiteInteger(checkpointValue.x) && finiteInteger(checkpointValue.y)
      && ["up", "down", "left", "right"].includes(String(checkpointValue.direction))
      ? { mapId: checkpointValue.mapId, x: checkpointValue.x, y: checkpointValue.y,
        direction: checkpointValue.direction as SourceCheckpoint["direction"] } : undefined;
  let party: PlayerPartyState;
  let ranch: PlayerPokemonStorageState;
  let dayCare: SourceDayCareState;
  let incubator: SourceIncubatorState;
  try {
    party = value.party === undefined ? createEmptyPlayerParty() : parsePlayerParty(value.party);
    ranch = value.ranch === undefined ? createEmptyPlayerPokemonStorage() : parsePlayerPokemonStorage(value.ranch);
    dayCare = value.dayCare === undefined ? createEmptySourceDayCare() : parseSourceDayCare(value.dayCare);
    incubator = value.incubator === undefined ? createEmptySourceIncubator() : parseSourceIncubator(value.incubator);
  } catch {
    throw new Error("Collection Pokémon persistante invalide.");
  }
  const collectionIds = [...party.members, ...ranch.members,
    ...dayCare.slots.flatMap((slot) => slot === null ? [] : [slot.pokemon]),
    ...(dayCare.pendingEgg === null ? [] : [dayCare.pendingEgg]),
    ...incubator.slots.flatMap((egg) => egg === null ? [] : [egg])].map((pokemon) => pokemon.id);
  if (new Set(collectionIds).size !== collectionIds.length) throw new Error("Collection Pokémon dupliquée.");
  const pendingHatches = value.pendingHatches === undefined ? []
    : Array.isArray(value.pendingHatches) && value.pendingHatches.length <= 12
      && value.pendingHatches.every((id) => typeof id === "string")
      && new Set(value.pendingHatches).size === value.pendingHatches.length
      ? [...value.pendingHatches] as string[] : null;
  const hatchableIds = [...party.members, ...incubator.slots.flatMap((egg) => egg === null ? [] : [egg])]
    .filter((pokemon) => pokemon.metadata.eggSteps > 0).map((pokemon) => pokemon.id);
  const followerEnabled = followerValue === undefined ? party.members.length > 0 : followerValue;
  const encounterValue = value.pendingEncounter;
  const pendingEncounter = encounterValue === undefined || encounterValue === null ? null
    : isRecord(encounterValue) && typeof encounterValue.species === "string" && finiteInteger(encounterValue.level)
      && encounterValue.level >= 1 && encounterValue.level <= 100
      && (encounterValue.victorySwitches === undefined || booleanDictionary(encounterValue.victorySwitches) !== null)
      && (encounterValue.escapable === undefined || typeof encounterValue.escapable === "boolean")
      && (encounterValue.method === undefined || ["land", "cave", "rock-smash", "fishing", "scripted"]
        .includes(String(encounterValue.method)))
      ? { species: encounterValue.species, level: encounterValue.level,
        ...(encounterValue.method === undefined ? {} : {
          method: encounterValue.method as NonNullable<SourceEncounter["method"]>,
        }),
        victorySwitches: encounterValue.victorySwitches === undefined ? {} : booleanDictionary(encounterValue.victorySwitches)!,
        escapable: encounterValue.escapable === true } : undefined;
  const wildEncounterSteps = value.wildEncounterSteps === undefined ? 0 : value.wildEncounterSteps;
  const happinessSteps = value.happinessSteps === undefined ? 0 : value.happinessSteps;
  const wildEncounterRngState = value.wildEncounterRngState === undefined ? 0x9e37_79b9 : value.wildEncounterRngState;
  const preferredFishingRod = value.preferredFishingRod === undefined ? undefined
    : ["OLDROD", "GOODROD", "SUPERROD"].includes(String(value.preferredFishingRod))
      ? value.preferredFishingRod as SourceFishingRod : null;
  const typeAmuletValue = value.typeAmulet;
  const typeAmulet = typeAmuletValue === undefined || typeAmuletValue === null ? null
    : isRecord(typeAmuletValue) && typeof typeAmuletValue.itemId === "string"
      && typeof typeAmuletValue.type === "string" && finiteInteger(typeAmuletValue.stepsRemaining)
      && typeAmuletValue.stepsRemaining >= 1 && typeAmuletValue.stepsRemaining <= 500
      ? { itemId: typeAmuletValue.itemId, type: typeAmuletValue.type,
        stepsRemaining: typeAmuletValue.stepsRemaining } : undefined;
  const appliedBattleSettlementIds = value.appliedBattleSettlementIds === undefined ? []
    : Array.isArray(value.appliedBattleSettlementIds)
      && value.appliedBattleSettlementIds.length <= 128
      && value.appliedBattleSettlementIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128)
      && new Set(value.appliedBattleSettlementIds).size === value.appliedBattleSettlementIds.length
      ? [...value.appliedBattleSettlementIds] as string[] : null;
  const pokedexValue = value.pokedex;
  const currentSpecies = [...party.members, ...ranch.members,
    ...dayCare.slots.flatMap((slot) => slot === null ? [] : [slot.pokemon])]
    .filter((pokemon) => pokemon.metadata.eggSteps <= 0).map((pokemon) => pokemon.species);
  const parsedSeen = pokedexValue === undefined ? [] : isRecord(pokedexValue)
    ? speciesList(pokedexValue.seenSpecies) : null;
  const parsedCaught = pokedexValue === undefined ? [] : isRecord(pokedexValue)
    ? speciesList(pokedexValue.caughtSpecies) : null;
  const evolvedSpecies = pokedexValue === undefined ? [] : isRecord(pokedexValue)
    ? speciesList(pokedexValue.evolvedSpecies) : null;
  const releasedSpecies = pokedexValue === undefined ? [] : isRecord(pokedexValue)
    ? speciesList(pokedexValue.releasedSpecies) : null;
  const caughtSpecies = parsedCaught === null ? null : addSpecies(parsedCaught, currentSpecies);
  const seenSpecies = parsedSeen === null || caughtSpecies === null ? null : addSpecies(parsedSeen,
    [...caughtSpecies, ...(pendingEncounter === null || pendingEncounter === undefined ? [] : [pendingEncounter.species])]);
  if (switches === null || variables === null || selfSwitches === null || inventory === null || pokeVial === null
    || typeof runningShoes !== "boolean" || typeof pokedexEnabled !== "boolean"
    || typeof followerEnabled !== "boolean"
    || !finiteInteger(money) || money < 0 || money > SOURCE_MAX_MONEY
    || Object.values(inventory).some((quantity) => quantity < 1) || checkpoint === undefined || pendingEncounter === undefined
    || !finiteInteger(happinessSteps) || happinessSteps < 0 || happinessSteps >= 128
    || !finiteInteger(wildEncounterSteps) || wildEncounterSteps < 0 || !finiteInteger(wildEncounterRngState)
    || wildEncounterRngState < 0 || wildEncounterRngState > 0xffff_ffff
    || appliedBattleSettlementIds === null || pendingHatches === null || preferredFishingRod === null
    || typeAmulet === undefined
    || pendingHatches.some((id) => !hatchableIds.includes(id)) || seenSpecies === null || caughtSpecies === null
    || evolvedSpecies === null || releasedSpecies === null) throw new Error("État source invalide.");
  return reconcileSourcePokeVial({ switches, variables, selfSwitches, inventory, money, runningShoes, pokedexEnabled,
    pokedex: { seenSpecies, caughtSpecies, evolvedSpecies, releasedSpecies }, pokeVial, followerEnabled, checkpoint,
    party, ranch, dayCare, incubator, pendingHatches, pendingEncounter, typeAmulet,
    ...(preferredFishingRod === undefined ? {} : { preferredFishingRod }),
    happinessSteps, wildEncounterSteps, wildEncounterRngState,
    appliedBattleSettlementIds });
}
