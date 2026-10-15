import { addPokemonToParty, addPokemonToStorage, type PersistentPokemon,
  type PlayerPartyState, type PlayerPokemonStorageState } from "@pokemon-z-battle/player-state";
import type { SourceIncubatorState } from "./source-incubator.js";

export interface SourcePendingHatch {
  readonly pokemon: PersistentPokemon;
  readonly location: "party" | "incubator";
  readonly slot: number;
}

export interface SourceEggIncubationAdvance {
  readonly party: PlayerPartyState;
  readonly incubator: SourceIncubatorState;
  readonly pendingHatches: readonly string[];
}

export type SourceEggHatchResult = { readonly ok: true; readonly party: PlayerPartyState;
  readonly ranch: PlayerPokemonStorageState; readonly incubator: SourceIncubatorState;
  readonly pendingHatches: readonly string[]; readonly pokemon: PersistentPokemon }
  | { readonly ok: false; readonly reason: "not-pending" | "pokemon-not-found" | "party-full" };

function hatchingBonus(party: PlayerPartyState): number {
  return party.members.some((pokemon) => pokemon.metadata.eggSteps <= 0
    && (pokemon.ability === "FLAMEBODY" || pokemon.ability === "MAGMAARMOR")) ? 2 : 1;
}

function sixSlots(values: readonly (PersistentPokemon | null)[]): SourceIncubatorState["slots"] {
  return [values[0] ?? null, values[1] ?? null, values[2] ?? null,
    values[3] ?? null, values[4] ?? null, values[5] ?? null];
}

function advanceEgg(pokemon: PersistentPokemon, amount: number,
  pending: Set<string>): PersistentPokemon {
  if (pokemon.metadata.eggSteps <= 0 || pending.has(pokemon.id)) return pokemon;
  const remaining = pokemon.metadata.eggSteps - amount;
  if (remaining <= 0) pending.add(pokemon.id);
  const eggSteps = Math.max(1, remaining);
  return eggSteps === pokemon.metadata.eggSteps ? pokemon
    : { ...pokemon, metadata: { ...pokemon.metadata, eggSteps } };
}

/** Advances only personal eggs. Ranch and uncollected Day-Care eggs never incubate. */
export function advanceSourceEggIncubation(party: PlayerPartyState, incubator: SourceIncubatorState,
  pendingHatches: readonly string[], steps = 1): SourceEggIncubationAdvance {
  if (!Number.isSafeInteger(steps) || steps < 0) throw new Error("Nombre de pas d’incubation invalide.");
  if (steps === 0) return { party, incubator, pendingHatches };
  const pending = new Set(pendingHatches);
  const amount = steps * hatchingBonus(party);
  const members = party.members.map((pokemon) => advanceEgg(pokemon, amount, pending));
  const slots = incubator.slots.map((pokemon) => pokemon === null ? null : advanceEgg(pokemon, amount, pending));
  return { party: members.every((pokemon, index) => pokemon === party.members[index]) ? party : { ...party, members },
    incubator: slots.every((pokemon, index) => pokemon === incubator.slots[index]) ? incubator
      : { ...incubator, slots: sixSlots(slots) },
    pendingHatches: [...pending] };
}

export function sourcePendingHatch(party: PlayerPartyState, incubator: SourceIncubatorState,
  pendingHatches: readonly string[]): SourcePendingHatch | null {
  for (const id of pendingHatches) {
    const partySlot = party.members.findIndex((pokemon) => pokemon.id === id);
    if (partySlot >= 0) return { pokemon: party.members[partySlot]!, location: "party", slot: partySlot };
    const incubatorSlot = incubator.slots.findIndex((pokemon) => pokemon?.id === id);
    if (incubatorSlot >= 0) return { pokemon: incubator.slots[incubatorSlot]!, location: "incubator", slot: incubatorSlot };
  }
  return null;
}

export function completeSourceEggHatch(party: PlayerPartyState, ranch: PlayerPokemonStorageState,
  incubator: SourceIncubatorState, pendingHatches: readonly string[], pokemonId: string,
  destination: "party" | "ranch", mapId: number, hatchedAt: string,
  nickname: string | null): SourceEggHatchResult {
  if (!pendingHatches.includes(pokemonId)) return { ok: false, reason: "not-pending" };
  const candidate = sourcePendingHatch(party, incubator, [pokemonId]);
  if (candidate === null) return { ok: false, reason: "pokemon-not-found" };
  if (candidate.location === "incubator" && destination === "party" && party.members.length >= 6) {
    return { ok: false, reason: "party-full" };
  }
  const pokemon: PersistentPokemon = { ...candidate.pokemon,
    nickname: nickname?.trim() ? nickname.trim().slice(0, 12) : null,
    hp: candidate.pokemon.stats.maxHp,
    metadata: { ...candidate.pokemon.metadata, happiness: 120, eggSteps: 0,
      origin: { ...candidate.pokemon.metadata.origin, hatchedMapId: mapId, hatchedAt } } };
  let nextParty = party;
  let nextRanch = ranch;
  let nextIncubator = incubator;
  if (candidate.location === "party") {
    nextParty = { ...party, members: party.members.map((member) => member.id === pokemonId ? pokemon : member) };
  } else {
    const slots = [...incubator.slots] as Array<PersistentPokemon | null>;
    slots[candidate.slot] = null;
    nextIncubator = { ...incubator, slots: sixSlots(slots) };
    if (destination === "party") nextParty = addPokemonToParty(party, pokemon);
    else nextRanch = addPokemonToStorage(ranch, pokemon);
  }
  return { ok: true, party: nextParty, ranch: nextRanch, incubator: nextIncubator,
    pendingHatches: pendingHatches.filter((id) => id !== pokemonId), pokemon };
}
