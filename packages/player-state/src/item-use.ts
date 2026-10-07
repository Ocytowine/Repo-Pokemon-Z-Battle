import { applyPokemonItemEffect, isPokemonItemUseSupported,
  type PokemonItemUseEffect, type PokemonItemUseFailure as CorePokemonItemUseFailure,
  type PokemonItemUsePolicy } from "@pokemon-z-battle/battle-engine";
import type { PersistentPokemon, PlayerPartyState } from "./index.js";

export { isPokemonItemUseSupported };

export type PlayerInventory = Readonly<Record<string, number>>;
export type PokemonItemUseContext = PokemonItemUsePolicy["context"];
export type PokemonItemUseFailure = CorePokemonItemUseFailure | "item-not-owned" | "target-not-found";
export type { PokemonItemUseEffect, PokemonItemUsePolicy } from "@pokemon-z-battle/battle-engine";

export type PokemonItemUseResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
    readonly pokemon: PersistentPokemon; readonly effect: PokemonItemUseEffect }
  | { readonly ok: false; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
    readonly reason: PokemonItemUseFailure };

/**
 * Applies one source item to one Pokemon owned by the same player. The inventory is consumed only
 * after a valid effect. Solo and Coop adapters must pass the current owner's party and inventory.
 */
export function usePokemonItem(inventory: PlayerInventory, party: PlayerPartyState, item: string,
  pokemonId: string, policy: PokemonItemUsePolicy): PokemonItemUseResult {
  if (!isPokemonItemUseSupported(item)) return { ok: false, inventory, party, reason: "unsupported-item" };
  const quantity = inventory[item] ?? 0;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, inventory, party, reason: "item-not-owned" };
  const index = party.members.findIndex((candidate) => candidate.id === pokemonId);
  if (index < 0) return { ok: false, inventory, party, reason: "target-not-found" };
  const applied = applyPokemonItemEffect(party.members[index]!, item, policy);
  if (typeof applied === "string") return { ok: false, inventory, party, reason: applied };
  const nextInventory = { ...inventory };
  if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
  const members = party.members.map((pokemon, memberIndex) => memberIndex === index ? applied.pokemon : pokemon);
  return { ok: true, inventory: nextInventory, party: { ...party, members },
    pokemon: applied.pokemon, effect: applied.effect };
}
