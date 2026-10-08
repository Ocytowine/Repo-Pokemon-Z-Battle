import { applyPokemonItemEffect, isPokemonItemUseSupported, isPokemonItemUsableInField, pokemonItemTargetMode,
  type PokemonItemUseEffect, type PokemonItemUseFailure as CorePokemonItemUseFailure,
  type PokemonItemUsePolicy } from "@pokemon-z-battle/battle-engine";
import type { PersistentPokemon, PlayerPartyState } from "./index.js";

export { isPokemonItemUseSupported, isPokemonItemUsableInField, pokemonItemTargetMode };

export type PlayerInventory = Readonly<Record<string, number>>;
export type PokemonItemUseContext = PokemonItemUsePolicy["context"];
export type PokemonItemUseFailure = CorePokemonItemUseFailure | "item-not-owned" | "target-not-found";
export type { PokemonItemUseEffect, PokemonItemUsePolicy } from "@pokemon-z-battle/battle-engine";

export type PokemonItemUseResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
    readonly pokemon: PersistentPokemon; readonly effect: PokemonItemUseEffect }
  | { readonly ok: false; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
    readonly reason: PokemonItemUseFailure };

export type DiscardInventoryItemResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly discarded: number }
  | { readonly ok: false; readonly inventory: PlayerInventory;
      readonly reason: "invalid-quantity" | "item-not-owned" | "not-discardable" };

/** Personal inventory mutation used identically by solo, host and guest adapters. */
export function discardInventoryItem(inventory: PlayerInventory, item: string, quantity: number,
  discardable: boolean): DiscardInventoryItemResult {
  if (!discardable) return { ok: false, inventory, reason: "not-discardable" };
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, inventory, reason: "invalid-quantity" };
  }
  const owned = inventory[item] ?? 0;
  if (!Number.isSafeInteger(owned) || owned < quantity) {
    return { ok: false, inventory, reason: "item-not-owned" };
  }
  const next = { ...inventory };
  if (owned === quantity) delete next[item]; else next[item] = owned - quantity;
  return { ok: true, inventory: next, discarded: quantity };
}

/**
 * Applies one source item to one Pokemon owned by the same player. The inventory is consumed only
 * after a valid effect. Solo and Coop adapters must pass the current owner's party and inventory.
 */
export function usePokemonItem(inventory: PlayerInventory, party: PlayerPartyState, item: string,
  pokemonId: string, policy: PokemonItemUsePolicy, targetMoveIndex?: number): PokemonItemUseResult {
  if (!isPokemonItemUseSupported(item)) return { ok: false, inventory, party, reason: "unsupported-item" };
  const quantity = inventory[item] ?? 0;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, inventory, party, reason: "item-not-owned" };
  const index = party.members.findIndex((candidate) => candidate.id === pokemonId);
  if (index < 0) return { ok: false, inventory, party, reason: "target-not-found" };
  const applied = applyPokemonItemEffect(party.members[index]!, item, policy, targetMoveIndex);
  if (typeof applied === "string") return { ok: false, inventory, party, reason: applied };
  const nextInventory = { ...inventory };
  if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
  const members = party.members.map((pokemon, memberIndex) => memberIndex === index ? applied.pokemon : pokemon);
  return { ok: true, inventory: nextInventory, party: { ...party, members },
    pokemon: applied.pokemon, effect: applied.effect };
}
