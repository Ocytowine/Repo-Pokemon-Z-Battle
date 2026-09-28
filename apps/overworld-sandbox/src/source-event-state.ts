import type { ImportedEventPage, ImportedMapEvent } from "./imported-map.js";
import { addPokemonToParty, createEmptyPlayerParty, healPlayerParty, parsePlayerParty, type PersistentPokemon, type PlayerPartyState } from "@pokemon-z-battle/player-state";

export interface SourceEventState {
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly selfSwitches: Readonly<Record<string, boolean>>;
  readonly inventory: Readonly<Record<string, number>>;
  readonly checkpoint: SourceCheckpoint | null;
  readonly party: PlayerPartyState;
  readonly pendingEncounter: SourceEncounter | null;
}

export interface SourceEncounter { readonly species: string; readonly level: number }

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
  switches: Object.freeze({}), variables: Object.freeze({}), selfSwitches: Object.freeze({}), inventory: Object.freeze({}), checkpoint: null,
  party: Object.freeze(createEmptyPlayerParty()),
  pendingEncounter: null,
});

export function createSourceEventState(): SourceEventState {
  return { switches: {}, variables: {}, selfSwitches: {}, inventory: {}, checkpoint: null, party: createEmptyPlayerParty(), pendingEncounter: null };
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
    return { page, pageIndex: index };
  }
  return null;
}

const SAFE_PRESENTATION_COMMANDS = new Set(["show-text", "text-continuation", "play-cry", "wait", "screen-tone",
  "play-jingle", "play-sound", "play-music", "play-background-sound", "show-animation", "screen-flash", "show-picture",
  "move-picture", "erase-picture", "move-route", "move-route-continuation", "wait-for-movement", "set-follower", "end"]);
const STATE_COMMANDS = new Set(["set-switches", "set-self-switch", "change-variables", "grant-item", "remove-item", "set-checkpoint",
  "heal-party", "add-pokemon", "request-encounter"]);

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
  const unsupported = page.commands.find((command) => !SAFE_PRESENTATION_COMMANDS.has(command.kind) && !STATE_COMMANDS.has(command.kind));
  if (unsupported !== undefined) {
    return { state, appliedCommands: 0, safe: false, reason: `commande ${unsupported.kind} non prise en charge` };
  }
  let switches = { ...state.switches };
  let variables = { ...state.variables };
  let selfSwitches = { ...state.selfSwitches };
  let inventory = { ...state.inventory };
  let checkpoint = state.checkpoint;
  let party = state.party;
  let pendingEncounter = state.pendingEncounter;
  let appliedCommands = 0;
  for (const command of page.commands) {
    if (!STATE_COMMANDS.has(command.kind)) continue;
    if (command.kind === "set-switches") {
      const ids = range(command.data);
      if (ids === null || typeof command.data.value !== "boolean") return { state, appliedCommands: 0, safe: false, reason: "paramètres d'interrupteur invalides" };
      ids.forEach((id) => { switches[String(id)] = command.data.value as boolean; });
    } else if (command.kind === "set-self-switch") {
      if (typeof command.data.id !== "string" || typeof command.data.value !== "boolean") return { state, appliedCommands: 0, safe: false, reason: "paramètres de self-switch invalides" };
      selfSwitches[selfSwitchKey(mapId, eventId, command.data.id)] = command.data.value;
    } else if (command.kind === "change-variables") {
      const ids = range(command.data);
      const operand = variableOperand(command.data, { switches, variables, selfSwitches, inventory, checkpoint, party, pendingEncounter });
      if (ids === null || operand === null) return { state, appliedCommands: 0, safe: false, reason: "opérande de variable non prise en charge" };
      for (const id of ids) {
        const next = changedVariable(variables[String(id)] ?? 0, command.data.operation, operand);
        if (next === null) return { state, appliedCommands: 0, safe: false, reason: "opération de variable invalide" };
        variables[String(id)] = next;
      }
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
    } else if (command.kind === "set-checkpoint") {
      if (context === undefined) return { state, appliedCommands: 0, safe: false, reason: "position du point de reprise absente" };
      checkpoint = { ...context.checkpoint };
    } else if (command.kind === "heal-party") {
      party = healPlayerParty(party);
    } else if (command.kind === "add-pokemon") {
      const species = command.data.species;
      const level = command.data.level;
      if (typeof species !== "string" || !finiteInteger(level) || level < 1 || level > 100 || context?.createPokemon === undefined) {
        return { state, appliedCommands: 0, safe: false, reason: "catalogue de création Pokémon absent" };
      }
      try {
        party = addPokemonToParty(party, context.createPokemon(species, level));
      } catch (error) {
        return { state, appliedCommands: 0, safe: false, reason: error instanceof Error ? error.message : "ajout du Pokémon impossible" };
      }
    } else {
      const species = command.data.species;
      const level = command.data.level;
      if (typeof species !== "string" || !finiteInteger(level) || level < 1 || level > 100 || party.members.length === 0) {
        return { state, appliedCommands: 0, safe: false, reason: "rencontre impossible sans équipe valide" };
      }
      pendingEncounter = { species, level };
    }
    appliedCommands += 1;
  }
  return { state: { switches, variables, selfSwitches, inventory, checkpoint, party, pendingEncounter }, appliedCommands, safe: true, reason: null };
}

function booleanDictionary(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== "boolean")) return null;
  return { ...value } as Record<string, boolean>;
}

function numberDictionary(value: unknown): Record<string, number> | null {
  if (!isRecord(value) || Object.values(value).some((entry) => !finiteInteger(entry))) return null;
  return { ...value } as Record<string, number>;
}

export function parseSourceEventState(value: unknown): SourceEventState {
  if (!isRecord(value)) throw new Error("État source invalide.");
  const switches = booleanDictionary(value.switches);
  const variables = numberDictionary(value.variables);
  const selfSwitches = booleanDictionary(value.selfSwitches);
  const inventory = value.inventory === undefined ? {} : numberDictionary(value.inventory);
  const checkpointValue = value.checkpoint;
  const checkpoint = checkpointValue === undefined || checkpointValue === null ? null
    : isRecord(checkpointValue) && finiteInteger(checkpointValue.mapId) && finiteInteger(checkpointValue.x) && finiteInteger(checkpointValue.y)
      && ["up", "down", "left", "right"].includes(String(checkpointValue.direction))
      ? { mapId: checkpointValue.mapId, x: checkpointValue.x, y: checkpointValue.y,
        direction: checkpointValue.direction as SourceCheckpoint["direction"] } : undefined;
  let party: PlayerPartyState;
  try {
    party = value.party === undefined ? createEmptyPlayerParty() : parsePlayerParty(value.party);
  } catch {
    throw new Error("Équipe persistante invalide.");
  }
  const encounterValue = value.pendingEncounter;
  const pendingEncounter = encounterValue === undefined || encounterValue === null ? null
    : isRecord(encounterValue) && typeof encounterValue.species === "string" && finiteInteger(encounterValue.level)
      && encounterValue.level >= 1 && encounterValue.level <= 100
      ? { species: encounterValue.species, level: encounterValue.level } : undefined;
  if (switches === null || variables === null || selfSwitches === null || inventory === null
    || Object.values(inventory).some((quantity) => quantity < 1) || checkpoint === undefined || pendingEncounter === undefined) throw new Error("État source invalide.");
  return { switches, variables, selfSwitches, inventory, checkpoint, party, pendingEncounter };
}
