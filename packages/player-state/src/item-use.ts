import { applyPokemonItemEffect, isPokemonItemUseSupported as isCorePokemonItemUseSupported,
  isPokemonItemUsableInBattle as isCorePokemonItemUsableInBattle,
  isPokemonItemUsableInField as isCorePokemonItemUsableInField,
  pokemonItemTargetMode as corePokemonItemTargetMode,
  type PokemonItemUseEffect as CorePokemonItemUseEffect, type PokemonItemUseFailure as CorePokemonItemUseFailure,
  type PokemonItemUsePolicy } from "@pokemon-z-battle/battle-engine";
import type { PersistentPokemon, PlayerPartyState, PokemonNature, PokemonTrainingValues } from "./index.js";

export type PlayerInventory = Readonly<Record<string, number>>;
export type PokemonItemUseContext = PokemonItemUsePolicy["context"];
export type PokemonItemUseFailure = CorePokemonItemUseFailure | "item-not-owned" | "target-not-found";
export type PokemonItemUseEffect = CorePokemonItemUseEffect & { readonly maximumPpRaised?: number;
  readonly trainingStat?: keyof PokemonTrainingValues; readonly trainingValueRaised?: number;
  readonly effortValuesChanged?: Partial<PokemonTrainingValues>;
  readonly individualValuesRaised?: Partial<PokemonTrainingValues>;
  readonly natureChanged?: { readonly from: PokemonNature; readonly to: PokemonNature } };
export type { PokemonItemUsePolicy } from "@pokemon-z-battle/battle-engine";

const PP_BOOSTERS = new Set(["PPUP", "PPMAX"]);
type TrainingItem = { readonly stat: keyof PokemonTrainingValues; readonly amount: number;
  readonly vitaminLimit: boolean };
const TRAINING_ITEMS = new Map<string, TrainingItem>([
  ["HPUP", { stat: "hp", amount: 10, vitaminLimit: true }],
  ["PROTEIN", { stat: "attack", amount: 10, vitaminLimit: true }],
  ["IRON", { stat: "defense", amount: 10, vitaminLimit: true }],
  ["CALCIUM", { stat: "specialAttack", amount: 10, vitaminLimit: true }],
  ["ZINC", { stat: "specialDefense", amount: 10, vitaminLimit: true }],
  ["CARBOS", { stat: "speed", amount: 10, vitaminLimit: true }],
  ["SUPERHPUP", { stat: "hp", amount: 20, vitaminLimit: true }],
  ["SUPERPROTEIN", { stat: "attack", amount: 20, vitaminLimit: true }],
  ["SUPERIRON", { stat: "defense", amount: 20, vitaminLimit: true }],
  ["SUPERCALCIUM", { stat: "specialAttack", amount: 20, vitaminLimit: true }],
  ["SUPERZINC", { stat: "specialDefense", amount: 20, vitaminLimit: true }],
  ["SUPERCARBOS", { stat: "speed", amount: 20, vitaminLimit: true }],
  ["HEALTHWING", { stat: "hp", amount: 1, vitaminLimit: false }],
  ["MUSCLEWING", { stat: "attack", amount: 1, vitaminLimit: false }],
  ["RESISTWING", { stat: "defense", amount: 1, vitaminLimit: false }],
  ["GENIUSWING", { stat: "specialAttack", amount: 1, vitaminLimit: false }],
  ["CLEVERWING", { stat: "specialDefense", amount: 1, vitaminLimit: false }],
  ["SWIFTWING", { stat: "speed", amount: 1, vitaminLimit: false }],
]);
const IV_ITEMS = new Map<string, keyof PokemonTrainingValues>([
  ["SCapsula", "hp"], ["ACapsula", "attack"], ["DCapsula", "defense"],
  ["AECapsula", "specialAttack"], ["DECapsula", "specialDefense"], ["VCapsula", "speed"],
]);
const SOURCE_IV_ORDER: readonly (keyof PokemonTrainingValues)[] = [
  "hp", "attack", "defense", "speed", "specialAttack", "specialDefense",
];
const MINT_ITEMS = new Map<string, PokemonNature>([
  ["ADAMANTMINT", "ADAMANT"], ["BOLDMINT", "BOLD"], ["BRAVEMINT", "BRAVE"],
  ["CALMMINT", "CALM"], ["CAREFULMINT", "CAREFUL"], ["GENTLEMINT", "GENTLE"],
  ["HASTYMINT", "HASTY"], ["IMPISHMINT", "IMPISH"], ["JOLLYMINT", "JOLLY"],
  ["LAXMINT", "LAX"], ["LONELYMINT", "LONELY"], ["MILDMINT", "MILD"],
  ["MODESTMINT", "MODEST"], ["NAIVEMINT", "NAIVE"], ["NAUGHTYMINT", "NAUGHTY"],
  ["QUIETMINT", "QUIET"], ["RASHMINT", "RASH"], ["RELAXEDMINT", "RELAXED"],
  ["SASSYMINT", "SASSY"], ["SERIOUSMINT", "SERIOUS"], ["TIMIDMINT", "TIMID"],
]);
const FRIENDSHIP_BERRIES = new Map<string, keyof PokemonTrainingValues>([
  ["POMEGBERRY", "hp"], ["KELPSYBERRY", "attack"], ["QUALOTBERRY", "defense"],
  ["HONDEWBERRY", "specialAttack"], ["GREPABERRY", "specialDefense"], ["TAMATOBERRY", "speed"],
]);
const ESSENCE_ITEMS = new Set(["POKESENCIA", "POKESENCIAREFINADA"]);
export const POKEMON_Z_EVOLUTION_ITEMS = new Set([
  "FIRESTONE", "THUNDERSTONE", "WATERSTONE", "LEAFSTONE", "MOONSTONE", "SUNSTONE", "DUSKSTONE",
  "DAWNSTONE", "SHINYSTONE", "PLUMAEOLICA", "PELUCAREGIA", "PANDURO",
  "FIRESTONEIMBUIDA", "THUNDERSTONEIMBUIDA", "WATERSTONEIMBUIDA", "LEAFSTONEIMBUIDA",
  "MOONSTONEIMBUIDA", "SUNSTONEIMBUIDA", "DUSKSTONEIMBUIDA", "DAWNSTONEIMBUIDA", "SHINYSTONEIMBUIDA",
]);

export function isPokemonEvolutionItem(item: string): boolean {
  return POKEMON_Z_EVOLUTION_ITEMS.has(item);
}

function isPermanentFieldItem(item: string): boolean {
  return PP_BOOSTERS.has(item) || TRAINING_ITEMS.has(item) || IV_ITEMS.has(item)
    || item === "CHAPADORADA" || MINT_ITEMS.has(item) || FRIENDSHIP_BERRIES.has(item)
    || ESSENCE_ITEMS.has(item) || item === "RARECANDY" || isPokemonEvolutionItem(item);
}

export function isPokemonItemUseSupported(item: string): boolean {
  return isPermanentFieldItem(item) || isCorePokemonItemUseSupported(item);
}

export function isPokemonItemUsableInBattle(item: string): boolean {
  return !isPermanentFieldItem(item) && isCorePokemonItemUsableInBattle(item);
}

export function isPokemonItemUsableInField(item: string): boolean {
  return isPermanentFieldItem(item) || isCorePokemonItemUsableInField(item);
}

export function pokemonItemTargetMode(item: string): "pokemon" | "move" | "active" | null {
  return PP_BOOSTERS.has(item) ? "move"
    : TRAINING_ITEMS.has(item) || IV_ITEMS.has(item) || item === "CHAPADORADA" || MINT_ITEMS.has(item) ? "pokemon"
      : FRIENDSHIP_BERRIES.has(item) || ESSENCE_ITEMS.has(item) || item === "RARECANDY"
        || isPokemonEvolutionItem(item) ? "pokemon"
      : corePokemonItemTargetMode(item);
}

export type PokemonItemUseResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
    readonly pokemon: PersistentPokemon; readonly effect: PokemonItemUseEffect }
  | { readonly ok: false; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
    readonly reason: PokemonItemUseFailure };

export type DiscardInventoryItemResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly discarded: number }
  | { readonly ok: false; readonly inventory: PlayerInventory;
      readonly reason: "invalid-quantity" | "item-not-owned" | "not-discardable" };

export type PokemonPartyItemUseResult =
  | { readonly ok: true; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
      readonly revived: number }
  | { readonly ok: false; readonly inventory: PlayerInventory; readonly party: PlayerPartyState;
      readonly reason: "unsupported-item" | "item-not-owned" | "no-effect" };

export function isPokemonPartyItemUsableInField(item: string): boolean {
  return item === "SACREDASH";
}

/** Source-wide personal party transaction. SACREDASH revives and fully heals each non-egg fainted member. */
export function usePokemonPartyItem(inventory: PlayerInventory, party: PlayerPartyState,
  item: string): PokemonPartyItemUseResult {
  if (!isPokemonPartyItemUsableInField(item)) return { ok: false, inventory, party, reason: "unsupported-item" };
  const quantity = inventory[item] ?? 0;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, inventory, party, reason: "item-not-owned" };
  let revived = 0;
  const members = party.members.map((pokemon) => {
    if (pokemon.hp > 0 || pokemon.metadata.eggSteps > 0) return pokemon;
    revived += 1;
    return { ...pokemon, hp: pokemon.stats.maxHp, majorStatus: null,
      moves: pokemon.moves.map((slot) => ({ ...slot, pp: slot.maxPp })) };
  });
  if (revived === 0) return { ok: false, inventory, party, reason: "no-effect" };
  const nextInventory = { ...inventory };
  if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
  return { ok: true, inventory: nextInventory, party: { ...party, members }, revived };
}

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
  pokemonId: string, policy: PokemonItemUsePolicy, targetMoveIndex?: number,
  recalculate?: (pokemon: PersistentPokemon) => PersistentPokemon): PokemonItemUseResult {
  if (!isPokemonItemUseSupported(item)) return { ok: false, inventory, party, reason: "unsupported-item" };
  const quantity = inventory[item] ?? 0;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, inventory, party, reason: "item-not-owned" };
  const index = party.members.findIndex((candidate) => candidate.id === pokemonId);
  if (index < 0) return { ok: false, inventory, party, reason: "target-not-found" };
  if (PP_BOOSTERS.has(item)) {
    if (policy.context !== "field") return { ok: false, inventory, party, reason: "unsupported-item" };
    const pokemon = party.members[index]!;
    const moveIndex = targetMoveIndex ?? -1;
    const slot = pokemon.moves[moveIndex];
    if (!Number.isInteger(moveIndex) || slot === undefined) {
      return { ok: false, inventory, party, reason: "no-effect" };
    }
    const currentUps = slot.ppUps ?? 0;
    if (currentUps >= 3) return { ok: false, inventory, party, reason: "no-effect" };
    const nextUps = item === "PPMAX" ? 3 : currentUps + 1;
    const basePp = slot.basePp ?? slot.maxPp;
    const nextMaxPp = basePp + Math.floor((basePp * nextUps) / 5);
    const moves = pokemon.moves.map((candidate, candidateIndex) => candidateIndex === moveIndex
      ? { ...candidate, maxPp: nextMaxPp, ppUps: nextUps, basePp } : candidate);
    const nextPokemon = { ...pokemon, moves };
    const members = party.members.map((candidate, memberIndex) => memberIndex === index ? nextPokemon : candidate);
    const nextInventory = { ...inventory };
    if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
    return { ok: true, inventory: nextInventory, party: { ...party, members }, pokemon: nextPokemon,
      effect: { hpRestored: 0, ppRestored: 0, movePp: moves.map((candidate) => candidate.pp),
        targetMoveIndex: moveIndex, statusCured: null, revived: false, statRaised: null, stagesRaised: 0,
        happinessChanged: 0, maximumPpRaised: nextMaxPp - slot.maxPp } };
  }
  const training = TRAINING_ITEMS.get(item);
  if (training !== undefined) {
    if (policy.context !== "field" || recalculate === undefined) {
      return { ok: false, inventory, party, reason: "unsupported-item" };
    }
    const pokemon = party.members[index]!;
    const current = pokemon.metadata.evs[training.stat];
    const total = Object.values(pokemon.metadata.evs).reduce((sum, value) => sum + value, 0);
    if (training.vitaminLimit && current >= 250 || current >= 252 || total >= 510) {
      return { ok: false, inventory, party, reason: "no-effect" };
    }
    const raised = Math.min(training.amount, 252 - current, 510 - total,
      training.vitaminLimit ? 250 - current : Number.POSITIVE_INFINITY);
    if (raised <= 0) return { ok: false, inventory, party, reason: "no-effect" };
    const happiness = pokemon.metadata.happiness;
    const baseHappinessGain = happiness === null ? 0 : happiness < 100 ? 5 : happiness < 200 ? 3 : 2;
    const happinessGain = happiness === null ? 0 : Math.min(255 - happiness,
      pokemon.heldItem === "SOOTHEBELL" ? Math.floor(baseHappinessGain * 1.5) : baseHappinessGain);
    const metadata = { ...pokemon.metadata,
      evs: { ...pokemon.metadata.evs, [training.stat]: current + raised },
      happiness: happiness === null ? null : happiness + happinessGain };
    const nextPokemon = recalculate({ ...pokemon, metadata });
    const members = party.members.map((candidate, memberIndex) => memberIndex === index ? nextPokemon : candidate);
    const nextInventory = { ...inventory };
    if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
    return { ok: true, inventory: nextInventory, party: { ...party, members }, pokemon: nextPokemon,
      effect: { hpRestored: 0, ppRestored: 0, movePp: null, targetMoveIndex: null,
        statusCured: null, revived: false, statRaised: null, stagesRaised: 0,
        happinessChanged: happinessGain, trainingStat: training.stat, trainingValueRaised: raised,
        effortValuesChanged: { [training.stat]: raised } } };
  }
  const ivStat = IV_ITEMS.get(item);
  if (ivStat !== undefined || item === "CHAPADORADA") {
    if (policy.context !== "field" || recalculate === undefined) {
      return { ok: false, inventory, party, reason: "unsupported-item" };
    }
    const pokemon = party.members[index]!;
    const nextIvs = { ...pokemon.metadata.ivs };
    const raisedByStat: Partial<Record<keyof PokemonTrainingValues, number>> = {};
    let total = Object.values(nextIvs).reduce((sum, value) => sum + value, 0);
    const stats = ivStat === undefined ? SOURCE_IV_ORDER : [ivStat];
    for (const stat of stats) {
      const raised = Math.min(7, 31 - nextIvs[stat], 186 - total);
      if (raised <= 0) continue;
      nextIvs[stat] += raised;
      raisedByStat[stat] = raised;
      total += raised;
    }
    const totalRaised = Object.values(raisedByStat).reduce((sum, value) => sum + (value ?? 0), 0);
    // Z's golden-cap handler always returns a truthy refresh result. We deliberately keep the item when
    // all IVs are already capped, matching the shared transaction rule used by every other item family.
    if (totalRaised <= 0) return { ok: false, inventory, party, reason: "no-effect" };
    const happiness = pokemon.metadata.happiness;
    const baseHappinessGain = ivStat === undefined || happiness === null ? 0
      : happiness < 100 ? 5 : happiness < 200 ? 3 : 2;
    const happinessGain = happiness === null ? 0 : Math.min(255 - happiness,
      pokemon.heldItem === "SOOTHEBELL" ? Math.floor(baseHappinessGain * 1.5) : baseHappinessGain);
    const nextPokemon = recalculate({ ...pokemon, metadata: { ...pokemon.metadata, ivs: nextIvs,
      happiness: happiness === null ? null : happiness + happinessGain } });
    const members = party.members.map((candidate, memberIndex) => memberIndex === index ? nextPokemon : candidate);
    const nextInventory = { ...inventory };
    if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
    return { ok: true, inventory: nextInventory, party: { ...party, members }, pokemon: nextPokemon,
      effect: { hpRestored: 0, ppRestored: 0, movePp: null, targetMoveIndex: null,
        statusCured: null, revived: false, statRaised: null, stagesRaised: 0,
        happinessChanged: happinessGain, ...(ivStat === undefined ? {} : { trainingStat: ivStat }),
        trainingValueRaised: totalRaised,
        individualValuesRaised: raisedByStat } };
  }
  const mintNature = MINT_ITEMS.get(item);
  if (mintNature !== undefined) {
    if (policy.context !== "field" || recalculate === undefined) {
      return { ok: false, inventory, party, reason: "unsupported-item" };
    }
    const pokemon = party.members[index]!;
    if (pokemon.metadata.nature === mintNature) {
      return { ok: false, inventory, party, reason: "no-effect" };
    }
    const previousNature = pokemon.metadata.nature;
    const nextPokemon = recalculate({ ...pokemon,
      metadata: { ...pokemon.metadata, nature: mintNature } });
    const members = party.members.map((candidate, memberIndex) => memberIndex === index ? nextPokemon : candidate);
    const nextInventory = { ...inventory };
    if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
    return { ok: true, inventory: nextInventory, party: { ...party, members }, pokemon: nextPokemon,
      effect: { hpRestored: 0, ppRestored: 0, movePp: null, targetMoveIndex: null,
        statusCured: null, revived: false, statRaised: null, stagesRaised: 0, happinessChanged: 0,
        natureChanged: { from: previousNature, to: mintNature } } };
  }
  const friendshipBerryStat = FRIENDSHIP_BERRIES.get(item);
  if (friendshipBerryStat !== undefined) {
    if (policy.context !== "field" || recalculate === undefined) {
      return { ok: false, inventory, party, reason: "unsupported-item" };
    }
    const pokemon = party.members[index]!;
    const currentEv = pokemon.metadata.evs[friendshipBerryStat];
    const happiness = pokemon.metadata.happiness;
    if (currentEv <= 0 && (happiness === null || happiness >= 255)) {
      return { ok: false, inventory, party, reason: "no-effect" };
    }
    const evLost = Math.min(10, currentEv);
    const baseHappinessGain = happiness === null ? 0 : happiness < 100 ? 10 : happiness < 200 ? 5 : 2;
    const happinessGain = happiness === null ? 0 : Math.min(255 - happiness,
      pokemon.heldItem === "SOOTHEBELL" ? Math.floor(baseHappinessGain * 1.5) : baseHappinessGain);
    const nextPokemon = recalculate({ ...pokemon, metadata: { ...pokemon.metadata,
      evs: { ...pokemon.metadata.evs, [friendshipBerryStat]: currentEv - evLost },
      happiness: happiness === null ? null : happiness + happinessGain } });
    const members = party.members.map((candidate, memberIndex) => memberIndex === index ? nextPokemon : candidate);
    const nextInventory = { ...inventory };
    if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
    return { ok: true, inventory: nextInventory, party: { ...party, members }, pokemon: nextPokemon,
      effect: { hpRestored: 0, ppRestored: 0, movePp: null, targetMoveIndex: null,
        statusCured: null, revived: false, statRaised: null, stagesRaised: 0,
        happinessChanged: happinessGain, trainingStat: friendshipBerryStat, trainingValueRaised: -evLost,
        effortValuesChanged: { [friendshipBerryStat]: -evLost } } };
  }
  if (ESSENCE_ITEMS.has(item)) {
    if (policy.context !== "field" || recalculate === undefined) {
      return { ok: false, inventory, party, reason: "unsupported-item" };
    }
    const pokemon = party.members[index]!;
    const nextEvs = { ...pokemon.metadata.evs };
    const changes: Partial<Record<keyof PokemonTrainingValues, number>> = {};
    let total = Object.values(nextEvs).reduce((sum, value) => sum + value, 0);
    if (total >= 508) return { ok: false, inventory, party, reason: "no-effect" };
    for (const stat of SOURCE_IV_ORDER) {
      const desired = nextEvs[stat] > 152 ? 252 - nextEvs[stat] : 80;
      const raised = Math.max(0, Math.min(desired, 508 - total));
      if (raised <= 0) continue;
      nextEvs[stat] += raised;
      changes[stat] = raised;
      total += raised;
    }
    const totalRaised = Object.values(changes).reduce((sum, value) => sum + (value ?? 0), 0);
    if (totalRaised <= 0) return { ok: false, inventory, party, reason: "no-effect" };
    const nextPokemon = recalculate({ ...pokemon,
      metadata: { ...pokemon.metadata, evs: nextEvs } });
    const members = party.members.map((candidate, memberIndex) => memberIndex === index ? nextPokemon : candidate);
    const nextInventory = { ...inventory };
    if (item !== "POKESENCIAREFINADA") {
      if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
    }
    return { ok: true, inventory: nextInventory, party: { ...party, members }, pokemon: nextPokemon,
      effect: { hpRestored: 0, ppRestored: 0, movePp: null, targetMoveIndex: null,
        statusCured: null, revived: false, statRaised: null, stagesRaised: 0, happinessChanged: 0,
        trainingValueRaised: totalRaised, effortValuesChanged: changes } };
  }
  const applied = applyPokemonItemEffect(party.members[index]!, item, policy, targetMoveIndex);
  if (typeof applied === "string") return { ok: false, inventory, party, reason: applied };
  const nextInventory = { ...inventory };
  if (quantity === 1) delete nextInventory[item]; else nextInventory[item] = quantity - 1;
  const members = party.members.map((pokemon, memberIndex) => memberIndex === index ? applied.pokemon : pokemon);
  return { ok: true, inventory: nextInventory, party: { ...party, members },
    pokemon: applied.pokemon, effect: applied.effect };
}
