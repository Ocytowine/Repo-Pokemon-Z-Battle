import type { MoveDefinition } from "@pokemon-z-battle/game-data";
import type { PersistentPokemon, PlayerPartyState } from "./index.js";
import type { PlayerInventory } from "./item-use.js";

export type MachineLearningFailure = "item-not-owned" | "target-not-found" | "incompatible"
  | "already-known" | "replacement-required" | "invalid-replacement";

export type MachineLearningResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
      readonly pokemon: PersistentPokemon; readonly learnedMove: string; readonly forgottenMove: string | null;
      readonly consumed: boolean }
  | { readonly ok: false; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
      readonly reason: MachineLearningFailure };

/** Atomic personal CT/CS transaction. Compatibility is sourced from Pokemon Z's tm.txt. */
export function teachPokemonMachineMove(inventory: PlayerInventory, party: PlayerPartyState,
  pokemonId: string, itemId: string, move: Pick<MoveDefinition, "internalName" | "pp">,
  compatible: boolean, consume: boolean, replacementIndex?: number): MachineLearningResult {
  const quantity = inventory[itemId] ?? 0;
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, inventory, party, reason: "item-not-owned" };
  }
  const pokemonIndex = party.members.findIndex((member) => member.id === pokemonId);
  if (pokemonIndex < 0) return { ok: false, inventory, party, reason: "target-not-found" };
  const pokemon = party.members[pokemonIndex]!;
  if (!compatible) return { ok: false, inventory, party, reason: "incompatible" };
  if (pokemon.moves.some((slot) => slot.internalName === move.internalName)) {
    return { ok: false, inventory, party, reason: "already-known" };
  }
  if (pokemon.moves.length >= 4 && replacementIndex === undefined) {
    return { ok: false, inventory, party, reason: "replacement-required" };
  }
  if (replacementIndex !== undefined
    && (!Number.isSafeInteger(replacementIndex) || replacementIndex < 0 || replacementIndex >= pokemon.moves.length)) {
    return { ok: false, inventory, party, reason: "invalid-replacement" };
  }
  const replacedSlot = replacementIndex === undefined ? null : pokemon.moves[replacementIndex]!;
  const nextSlot = { internalName: move.internalName,
    pp: replacedSlot === null ? move.pp : Math.min(replacedSlot.pp, move.pp), maxPp: move.pp };
  const forgottenMove = replacedSlot?.internalName ?? null;
  const moves = replacementIndex === undefined ? [...pokemon.moves, nextSlot]
    : pokemon.moves.map((slot, index) => index === replacementIndex ? nextSlot : slot);
  const nextPokemon = { ...pokemon, moves };
  const members = party.members.map((member, index) => index === pokemonIndex ? nextPokemon : member);
  const nextInventory = { ...inventory };
  if (consume) {
    if (quantity === 1) delete nextInventory[itemId]; else nextInventory[itemId] = quantity - 1;
  }
  return { ok: true, inventory: nextInventory, party: { ...party, members }, pokemon: nextPokemon,
    learnedMove: move.internalName, forgottenMove, consumed: consume };
}
