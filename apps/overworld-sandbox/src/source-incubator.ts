import { addPokemonToParty, addPokemonToStorage, parsePlayerPokemonStorage,
  type PersistentPokemon, type PlayerPartyState, type PlayerPokemonStorageState }
  from "@pokemon-z-battle/player-state";
import type { SourceDayCareState } from "./source-day-care.js";

export const SOURCE_INCUBATOR_SCHEMA_VERSION = 1 as const;
export const SOURCE_INCUBATOR_CAPACITY = 6;

export interface SourceIncubatorState {
  readonly schemaVersion: typeof SOURCE_INCUBATOR_SCHEMA_VERSION;
  readonly slots: readonly [PersistentPokemon | null, PersistentPokemon | null, PersistentPokemon | null,
    PersistentPokemon | null, PersistentPokemon | null, PersistentPokemon | null];
}

export type SourceIncubatorFailure = "invalid-slot" | "slot-occupied" | "slot-empty" | "pokemon-not-found"
  | "not-an-egg" | "party-full" | "incubator-full" | "egg-not-ready" | "duplicate-pokemon";

export type SourceIncubatorResult = { readonly ok: true; readonly incubator: SourceIncubatorState;
  readonly party: PlayerPartyState; readonly ranch: PlayerPokemonStorageState; readonly pokemon: PersistentPokemon }
  | { readonly ok: false; readonly reason: SourceIncubatorFailure };

export type SourceDayCareIncubatorResult = { readonly ok: true; readonly incubator: SourceIncubatorState;
  readonly dayCare: SourceDayCareState; readonly pokemon: PersistentPokemon }
  | { readonly ok: false; readonly reason: SourceIncubatorFailure };

export function createEmptySourceIncubator(): SourceIncubatorState {
  return { schemaVersion: SOURCE_INCUBATOR_SCHEMA_VERSION, slots: [null, null, null, null, null, null] };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEgg(value: unknown): PersistentPokemon | null | undefined {
  if (value === null) return null;
  try {
    const pokemon = parsePlayerPokemonStorage({ schemaVersion: 1, members: [value] }).members[0];
    return pokemon === undefined || pokemon.metadata.eggSteps <= 0 ? undefined : pokemon;
  } catch { return undefined; }
}

export function parseSourceIncubator(value: unknown): SourceIncubatorState {
  if (!record(value) || value.schemaVersion !== SOURCE_INCUBATOR_SCHEMA_VERSION
    || !Array.isArray(value.slots) || value.slots.length !== SOURCE_INCUBATOR_CAPACITY) {
    throw new Error("État d’Incubateur invalide.");
  }
  const slots = value.slots.map(parseEgg);
  if (slots.some((egg) => egg === undefined)) throw new Error("Œuf d’Incubateur invalide.");
  const ids = slots.flatMap((egg) => egg === null || egg === undefined ? [] : [egg.id]);
  if (new Set(ids).size !== ids.length) throw new Error("Œuf d’Incubateur dupliqué.");
  return { schemaVersion: SOURCE_INCUBATOR_SCHEMA_VERSION,
    slots: sixSlots(slots as readonly (PersistentPokemon | null)[]) };
}

function validSlot(slot: number): slot is 0 | 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(slot) && slot >= 0 && slot < SOURCE_INCUBATOR_CAPACITY;
}

function sixSlots(values: readonly (PersistentPokemon | null)[]): SourceIncubatorState["slots"] {
  return [values[0] ?? null, values[1] ?? null, values[2] ?? null,
    values[3] ?? null, values[4] ?? null, values[5] ?? null];
}

function partyWithout(party: PlayerPartyState, index: number): PlayerPartyState {
  const members = party.members.filter((_, candidate) => candidate !== index);
  const activeIndex = members.length === 0 ? null : party.activeIndex === null ? 0
    : party.activeIndex === index ? 0
      : Math.min(party.activeIndex - (party.activeIndex > index ? 1 : 0), members.length - 1);
  return { ...party, members, activeIndex };
}

export function depositPartyEggInIncubator(incubator: SourceIncubatorState, party: PlayerPartyState,
  ranch: PlayerPokemonStorageState, pokemonId: string, slot: number): SourceIncubatorResult {
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  if (incubator.slots[slot] !== null) return { ok: false, reason: "slot-occupied" };
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) return { ok: false, reason: "pokemon-not-found" };
  const egg = party.members[index]!;
  if (egg.metadata.eggSteps <= 0) return { ok: false, reason: "not-an-egg" };
  if (incubator.slots.some((candidate) => candidate?.id === egg.id)) return { ok: false, reason: "duplicate-pokemon" };
  const slots = [...incubator.slots] as Array<PersistentPokemon | null>;
  slots[slot] = egg;
  return { ok: true, incubator: { ...incubator, slots: sixSlots(slots) },
    party: partyWithout(party, index), ranch, pokemon: egg };
}

export function withdrawIncubatorEgg(incubator: SourceIncubatorState, party: PlayerPartyState,
  ranch: PlayerPokemonStorageState, slot: number, destination: "party" | "ranch"): SourceIncubatorResult {
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  const egg = incubator.slots[slot];
  if (egg === null) return { ok: false, reason: "slot-empty" };
  if (destination === "party" && party.members.length >= 6) return { ok: false, reason: "party-full" };
  if (party.members.some((pokemon) => pokemon.id === egg.id)
    || ranch.members.some((pokemon) => pokemon.id === egg.id)) return { ok: false, reason: "duplicate-pokemon" };
  const slots = [...incubator.slots] as Array<PersistentPokemon | null>;
  slots[slot] = null;
  return { ok: true, incubator: { ...incubator, slots: sixSlots(slots) },
    party: destination === "party" ? addPokemonToParty(party, egg) : party,
    ranch: destination === "ranch" ? addPokemonToStorage(ranch, egg) : ranch, pokemon: egg };
}

export function collectDayCareEggInIncubator(dayCare: SourceDayCareState,
  incubator: SourceIncubatorState): SourceDayCareIncubatorResult {
  if (!dayCare.eggReady || dayCare.pendingEgg === null) return { ok: false, reason: "egg-not-ready" };
  const slot = incubator.slots.findIndex((egg) => egg === null);
  if (!validSlot(slot)) return { ok: false, reason: "incubator-full" };
  if (incubator.slots.some((egg) => egg?.id === dayCare.pendingEgg!.id)) {
    return { ok: false, reason: "duplicate-pokemon" };
  }
  const slots = [...incubator.slots] as Array<PersistentPokemon | null>;
  slots[slot] = dayCare.pendingEgg;
  return { ok: true, incubator: { ...incubator, slots: sixSlots(slots) },
    dayCare: { ...dayCare, eggCycleSteps: 0, eggReady: false, pendingEgg: null },
    pokemon: dayCare.pendingEgg };
}

export function sourceEggHatchMessage(eggSteps: number): string {
  if (eggSteps < 1_275) return "Il bouge énormément ! Il va éclore !";
  if (eggSteps < 2_550) return "Il s’agite de plus en plus.";
  if (eggSteps < 10_200) return "Il bouge de temps en temps.";
  return "Il faudra du temps pour qu’il éclose.";
}
