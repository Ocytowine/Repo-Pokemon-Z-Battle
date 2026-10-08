import { addPokemonToParty, addPokemonToStorage, applySharedBattleExperience, createPersistentPokemon,
  healPlayerParty, storeOwnedBattleResults, type PlayerCreationCatalog, type PokemonCreationContext,
  type SharedBattleExperienceGain } from "@pokemon-z-battle/player-state";
import type { SourceBattleSettlement } from "@pokemon-z-battle/multiplayer-protocol";
import { SOURCE_BAG_SLOT_LIMIT, addSourceMoney, sourceDefeatLoss } from "./source-economy.js";
import type { SourceEventState } from "./source-event-state.js";

export interface AppliedSourceBattleSettlement {
  readonly state: SourceEventState;
  readonly applied: boolean;
  readonly gains: readonly SharedBattleExperienceGain[];
  readonly moneyDelta: number;
}

const SETTLEMENT_JOURNAL_LIMIT = 128;

/** Applies one owner-scoped settlement atomically and at most once to the personal save. */
export function applySourceBattleSettlement(state: SourceEventState, settlement: SourceBattleSettlement,
  playerId: string, catalog: PlayerCreationCatalog, captureContext?: PokemonCreationContext,
  evolutionHour?: number): AppliedSourceBattleSettlement {
  if (settlement.ownerId !== playerId || settlement.tactical.ownerId !== playerId) {
    throw new Error("Le règlement de combat appartient à un autre joueur.");
  }
  if (state.appliedBattleSettlementIds.includes(settlement.settlementId)) {
    return { state, applied: false, gains: [], moneyDelta: 0 };
  }
  let party = storeOwnedBattleResults(state.party, settlement.participation, settlement.state, playerId);
  const experience = applySharedBattleExperience(party, settlement.tactical, catalog, settlement.experience,
    evolutionHour === undefined ? {} : { hour: evolutionHour });
  party = settlement.healParty ? healPlayerParty(experience.party) : experience.party;
  let next = { ...state, party };
  if (settlement.capturedPokemon !== undefined) {
    if (captureContext === undefined) throw new Error("Contexte personnel de capture absent.");
    const captured = settlement.capturedPokemon;
    const source = captured.battler;
    let pokemon = createPersistentPokemon(crypto.randomUUID(), source.species, source.level, catalog, captureContext);
    pokemon = { ...pokemon,
      hp: captured.ballId === "HEALBALL" ? pokemon.stats.maxHp : Math.min(source.hp, pokemon.stats.maxHp),
      majorStatus: captured.ballId === "HEALBALL" ? null : source.majorStatus,
      moves: source.moves.map((slot) => ({ internalName: slot.move.internalName, pp: slot.pp, maxPp: slot.move.pp })),
      metadata: { ...pokemon.metadata,
        happiness: captured.ballId === "FRIENDBALL" ? 200 : pokemon.metadata.happiness,
        form: source.appearance?.form ?? pokemon.metadata.form,
        shiny: source.appearance?.shiny ?? pokemon.metadata.shiny,
        gender: source.appearance?.gender ?? pokemon.metadata.gender } };
    next = next.party.members.length < 6
      ? { ...next, party: addPokemonToParty(next.party, pokemon) }
      : { ...next, ranch: addPokemonToStorage(next.ranch, pokemon) };
  }
  const previousMoney = next.money;
  if (settlement.money.kind === "fixed") next = addSourceMoney(next, settlement.money.amount);
  else if (settlement.money.kind === "source-defeat") {
    next = { ...next, money: Math.max(0, next.money - sourceDefeatLoss(next)) };
  }
  const inventory = { ...next.inventory };
  for (const consumed of settlement.consumedItems ?? []) {
    if (!Number.isSafeInteger(consumed.quantity) || consumed.quantity < 1 || consumed.itemId.length === 0) {
      throw new Error("Consommation d'objet invalide.");
    }
    const quantity = inventory[consumed.itemId] ?? 0;
    if (quantity < consumed.quantity) throw new Error("Le sac local ne contient plus l'objet consomme en combat.");
    if (quantity === consumed.quantity) delete inventory[consumed.itemId];
    else inventory[consumed.itemId] = quantity - consumed.quantity;
  }
  for (const reward of settlement.items) {
    if (!Number.isSafeInteger(reward.quantity) || reward.quantity < 1 || reward.itemId.length === 0) {
      throw new Error("Récompense d'objet invalide.");
    }
    inventory[reward.itemId] = Math.min(SOURCE_BAG_SLOT_LIMIT,
      (inventory[reward.itemId] ?? 0) + reward.quantity);
  }
  const appliedBattleSettlementIds = [...next.appliedBattleSettlementIds, settlement.settlementId]
    .slice(-SETTLEMENT_JOURNAL_LIMIT);
  next = { ...next, inventory, appliedBattleSettlementIds };
  return { state: next, applied: true, gains: experience.gains, moneyDelta: next.money - previousMoney };
}
