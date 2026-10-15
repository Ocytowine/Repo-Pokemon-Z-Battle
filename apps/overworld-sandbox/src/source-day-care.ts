import { grantPokemonExperience, parsePlayerPokemonStorage, type PersistentPokemon,
  type PlayerCreationCatalog, type PlayerPartyState } from "@pokemon-z-battle/player-state";

export const SOURCE_DAY_CARE_SCHEMA_VERSION = 1 as const;
export const SOURCE_DAY_CARE_CAPACITY = 2;

export interface SourceDayCareOccupant {
  readonly pokemon: PersistentPokemon;
  readonly depositedLevel: number;
}

export interface SourceDayCareState {
  readonly schemaVersion: typeof SOURCE_DAY_CARE_SCHEMA_VERSION;
  readonly slots: readonly [SourceDayCareOccupant | null, SourceDayCareOccupant | null];
  /** Reserved now so breeding can be connected to the Incubator without another save migration. */
  readonly eggCycleSteps: number;
  readonly eggReady: boolean;
}

export type SourceDayCareFailure = "slot-occupied" | "slot-empty" | "pokemon-not-found"
  | "last-able-pokemon" | "party-full" | "insufficient-money" | "invalid-slot";

export type SourceDayCareResult = { readonly ok: true; readonly dayCare: SourceDayCareState;
  readonly party: PlayerPartyState; readonly money: number; readonly pokemon: PersistentPokemon }
  | { readonly ok: false; readonly reason: SourceDayCareFailure };

export function createEmptySourceDayCare(): SourceDayCareState {
  return { schemaVersion: SOURCE_DAY_CARE_SCHEMA_VERSION, slots: [null, null], eggCycleSteps: 0, eggReady: false };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function occupant(value: unknown): SourceDayCareOccupant | null | undefined {
  if (value === null) return null;
  if (!record(value) || !Number.isSafeInteger(value.depositedLevel)
    || (value.depositedLevel as number) < 1 || (value.depositedLevel as number) > 100) return undefined;
  try {
    const parsed = parsePlayerPokemonStorage({ schemaVersion: 1, members: [value.pokemon] }).members[0];
    return parsed === undefined ? undefined : { pokemon: parsed, depositedLevel: value.depositedLevel as number };
  } catch { return undefined; }
}

export function parseSourceDayCare(value: unknown): SourceDayCareState {
  if (!record(value) || value.schemaVersion !== SOURCE_DAY_CARE_SCHEMA_VERSION || !Array.isArray(value.slots)
    || value.slots.length !== SOURCE_DAY_CARE_CAPACITY || !Number.isSafeInteger(value.eggCycleSteps)
    || (value.eggCycleSteps as number) < 0 || (value.eggCycleSteps as number) >= 256
    || typeof value.eggReady !== "boolean") throw new Error("État de Pension invalide.");
  const first = occupant(value.slots[0]); const second = occupant(value.slots[1]);
  if (first === undefined || second === undefined) throw new Error("Pensionnaire invalide.");
  const ids = [first?.pokemon.id, second?.pokemon.id].filter((id): id is string => id !== undefined);
  if (new Set(ids).size !== ids.length) throw new Error("Pensionnaire dupliqué.");
  return { schemaVersion: SOURCE_DAY_CARE_SCHEMA_VERSION, slots: [first, second],
    eggCycleSteps: value.eggCycleSteps as number, eggReady: value.eggReady };
}

export function sourceDayCareWithdrawalFee(occupant: SourceDayCareOccupant): number {
  return (Math.max(0, occupant.pokemon.level - occupant.depositedLevel) + 1) * 100;
}

function healed(pokemon: PersistentPokemon): PersistentPokemon {
  return { ...pokemon, hp: pokemon.stats.maxHp, majorStatus: null,
    moves: pokemon.moves.map((move) => ({ ...move, pp: move.maxPp })) };
}

function partyWithout(party: PlayerPartyState, index: number): PlayerPartyState {
  const members = party.members.filter((_, candidate) => candidate !== index);
  const activeIndex = members.length === 0 ? null : party.activeIndex === null ? 0
    : party.activeIndex === index ? 0 : Math.min(party.activeIndex - (party.activeIndex > index ? 1 : 0), members.length - 1);
  return { ...party, members, activeIndex };
}

function able(pokemon: PersistentPokemon): boolean {
  return pokemon.hp > 0 && pokemon.metadata.eggSteps <= 0;
}

function validSlot(slot: number): slot is 0 | 1 { return slot === 0 || slot === 1; }

export function depositSourceDayCarePokemon(dayCare: SourceDayCareState, party: PlayerPartyState,
  pokemonId: string, slot: number, money: number): SourceDayCareResult {
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  if (dayCare.slots[slot] !== null) return { ok: false, reason: "slot-occupied" };
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) return { ok: false, reason: "pokemon-not-found" };
  const nextParty = partyWithout(party, index);
  if (!nextParty.members.some(able)) return { ok: false, reason: "last-able-pokemon" };
  const pokemon = healed(party.members[index]!);
  const slots: [SourceDayCareOccupant | null, SourceDayCareOccupant | null] = [...dayCare.slots];
  slots[slot] = { pokemon, depositedLevel: pokemon.level };
  return { ok: true, dayCare: { ...dayCare, slots, eggCycleSteps: 0, eggReady: false },
    party: nextParty, money, pokemon };
}

export function withdrawSourceDayCarePokemon(dayCare: SourceDayCareState, party: PlayerPartyState,
  slot: number, money: number): SourceDayCareResult {
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  const stored = dayCare.slots[slot];
  if (stored === null) return { ok: false, reason: "slot-empty" };
  if (party.members.length >= 6) return { ok: false, reason: "party-full" };
  const fee = sourceDayCareWithdrawalFee(stored);
  if (money < fee) return { ok: false, reason: "insufficient-money" };
  const slots: [SourceDayCareOccupant | null, SourceDayCareOccupant | null] = [...dayCare.slots];
  slots[slot] = null;
  return { ok: true, dayCare: { ...dayCare, slots, eggCycleSteps: 0, eggReady: false },
    party: { ...party, members: [...party.members, stored.pokemon], activeIndex: party.activeIndex ?? 0 },
    money: money - fee, pokemon: stored.pokemon };
}

export function exchangeSourceDayCarePokemon(dayCare: SourceDayCareState, party: PlayerPartyState,
  slot: number, pokemonId: string, money: number): SourceDayCareResult {
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  const stored = dayCare.slots[slot];
  if (stored === null) return { ok: false, reason: "slot-empty" };
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) return { ok: false, reason: "pokemon-not-found" };
  const fee = sourceDayCareWithdrawalFee(stored);
  if (money < fee) return { ok: false, reason: "insufficient-money" };
  const deposited = healed(party.members[index]!);
  const members = party.members.map((pokemon, candidate) => candidate === index ? stored.pokemon : pokemon);
  const slots: [SourceDayCareOccupant | null, SourceDayCareOccupant | null] = [...dayCare.slots];
  slots[slot] = { pokemon: deposited, depositedLevel: deposited.level };
  return { ok: true, dayCare: { ...dayCare, slots, eggCycleSteps: 0, eggReady: false },
    party: { ...party, members }, money: money - fee, pokemon: stored.pokemon };
}

export function advanceSourceDayCare(dayCare: SourceDayCareState, steps: number,
  catalog: PlayerCreationCatalog): SourceDayCareState {
  if (!Number.isSafeInteger(steps) || steps < 0) throw new Error("Nombre de pas de Pension invalide.");
  if (steps === 0) return dayCare;
  const slots = dayCare.slots.map((stored) => stored === null ? null
    : { ...stored, pokemon: grantPokemonExperience(stored.pokemon, steps, catalog).pokemon }) as
    [SourceDayCareOccupant | null, SourceDayCareOccupant | null];
  return { ...dayCare, slots };
}
