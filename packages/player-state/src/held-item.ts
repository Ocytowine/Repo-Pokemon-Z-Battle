import { isHeldItemSupported, type HeldItem } from "@pokemon-z-battle/battle-engine";
import type { PersistentPokemon, PlayerPartyState } from "./index.js";
import type { PlayerInventory } from "./item-use.js";

export type HeldItemChangeFailure = "unsupported-item" | "item-not-owned" | "target-not-found"
  | "no-effect" | "bag-full";

export type HeldItemChangeResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
      readonly pokemon: PersistentPokemon; readonly equipped: HeldItem | null; readonly returned: string | null }
  | { readonly ok: false; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
      readonly reason: HeldItemChangeFailure };

function replaceMember(party: PlayerPartyState, index: number, heldItem: HeldItem | null): PlayerPartyState {
  return { ...party, members: party.members.map((pokemon, candidate) => candidate === index
    ? { ...pokemon, heldItem } : pokemon) };
}

/** Personal atomic transaction. It never receives another trainer's party or inventory. */
export function equipPokemonHeldItem(inventory: PlayerInventory, party: PlayerPartyState,
  pokemonId: string, itemId: string): HeldItemChangeResult {
  if (!isHeldItemSupported(itemId)) return { ok: false, inventory, party, reason: "unsupported-item" };
  const quantity = inventory[itemId] ?? 0;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, inventory, party, reason: "item-not-owned" };
  }
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) return { ok: false, inventory, party, reason: "target-not-found" };
  const pokemon = party.members[index]!;
  if (pokemon.heldItem === itemId) return { ok: false, inventory, party, reason: "no-effect" };
  if (pokemon.heldItem !== null && (inventory[pokemon.heldItem] ?? 0) >= 999) {
    return { ok: false, inventory, party, reason: "bag-full" };
  }
  const nextInventory = { ...inventory };
  if (quantity === 1) delete nextInventory[itemId]; else nextInventory[itemId] = quantity - 1;
  if (pokemon.heldItem !== null) nextInventory[pokemon.heldItem] = (nextInventory[pokemon.heldItem] ?? 0) + 1;
  const nextParty = replaceMember(party, index, itemId);
  return { ok: true, inventory: nextInventory, party: nextParty, pokemon: nextParty.members[index]!,
    equipped: itemId, returned: pokemon.heldItem };
}

export function removePokemonHeldItem(inventory: PlayerInventory, party: PlayerPartyState,
  pokemonId: string): HeldItemChangeResult {
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) return { ok: false, inventory, party, reason: "target-not-found" };
  const pokemon = party.members[index]!;
  if (pokemon.heldItem === null) return { ok: false, inventory, party, reason: "no-effect" };
  if (!isHeldItemSupported(pokemon.heldItem)) {
    return { ok: false, inventory, party, reason: "unsupported-item" };
  }
  if ((inventory[pokemon.heldItem] ?? 0) >= 999) return { ok: false, inventory, party, reason: "bag-full" };
  const nextInventory = { ...inventory, [pokemon.heldItem]: (inventory[pokemon.heldItem] ?? 0) + 1 };
  const nextParty = replaceMember(party, index, null);
  return { ok: true, inventory: nextInventory, party: nextParty, pokemon: nextParty.members[index]!,
    equipped: null, returned: pokemon.heldItem };
}
