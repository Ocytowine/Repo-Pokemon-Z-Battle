import { POKEMON_NATURES, calculatePokemonStats, createPersistentPokemon, grantPokemonExperience,
  parsePlayerPokemonStorage, type PersistentPokemon, type PokemonCreationContext,
  type PokemonNature, type PokemonTrainingValues, type PlayerCreationCatalog,
  type PlayerInventory, type PlayerPartyState } from "@pokemon-z-battle/player-state";

export const SOURCE_DAY_CARE_SCHEMA_VERSION = 2 as const;
export const SOURCE_DAY_CARE_CAPACITY = 2;
export const SOURCE_DAY_CARE_EGG_CYCLE_STEPS = 256;
export const SOURCE_DAY_CARE_INITIAL_RNG_STATE = 0x7f4a_7c15;

export type SourceDayCareCompatibilityScore = 0 | 1 | 2 | 3;

export interface SourceDayCareCompatibility {
  readonly score: SourceDayCareCompatibilityScore;
  readonly chancePercent: number;
  readonly compatible: boolean;
}

export interface SourceDayCareOccupant {
  readonly pokemon: PersistentPokemon;
  readonly depositedLevel: number;
}

export interface SourceDayCareState {
  readonly schemaVersion: typeof SOURCE_DAY_CARE_SCHEMA_VERSION;
  readonly slots: readonly [SourceDayCareOccupant | null, SourceDayCareOccupant | null];
  readonly eggCycleSteps: number;
  readonly eggReady: boolean;
  /** The outcome is frozen when the 256-step roll succeeds, preventing reload rerolls. */
  readonly pendingEgg: PersistentPokemon | null;
  /** Personal deterministic RNG, restored with the save and never replicated to the room. */
  readonly rngState: number;
}

export interface SourceDayCareAdvanceOptions {
  readonly inventory?: PlayerInventory;
  readonly creationContext?: PokemonCreationContext;
}

export type SourceDayCareFailure = "slot-occupied" | "slot-empty" | "pokemon-not-found"
  | "last-able-pokemon" | "party-full" | "insufficient-money" | "invalid-slot"
  | "egg-not-ready" | "egg-pending" | "egg-not-allowed";

export type SourceDayCareResult = { readonly ok: true; readonly dayCare: SourceDayCareState;
  readonly party: PlayerPartyState; readonly money: number; readonly pokemon: PersistentPokemon }
  | { readonly ok: false; readonly reason: SourceDayCareFailure };

export function createEmptySourceDayCare(): SourceDayCareState {
  return { schemaVersion: SOURCE_DAY_CARE_SCHEMA_VERSION, slots: [null, null], eggCycleSteps: 0,
    eggReady: false, pendingEgg: null, rngState: SOURCE_DAY_CARE_INITIAL_RNG_STATE };
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
  if (!record(value) || ![1, SOURCE_DAY_CARE_SCHEMA_VERSION].includes(value.schemaVersion as number) || !Array.isArray(value.slots)
    || value.slots.length !== SOURCE_DAY_CARE_CAPACITY || !Number.isSafeInteger(value.eggCycleSteps)
    || (value.eggCycleSteps as number) < 0 || (value.eggCycleSteps as number) >= 256
    || typeof value.eggReady !== "boolean") throw new Error("État de Pension invalide.");
  const first = occupant(value.slots[0]); const second = occupant(value.slots[1]);
  if (first === undefined || second === undefined) throw new Error("Pensionnaire invalide.");
  const ids = [first?.pokemon.id, second?.pokemon.id].filter((id): id is string => id !== undefined);
  if (new Set(ids).size !== ids.length) throw new Error("Pensionnaire dupliqué.");
  if (value.schemaVersion === 1) return { schemaVersion: SOURCE_DAY_CARE_SCHEMA_VERSION, slots: [first, second],
    eggCycleSteps: value.eggCycleSteps as number, eggReady: false, pendingEgg: null,
    rngState: SOURCE_DAY_CARE_INITIAL_RNG_STATE };
  if (!Number.isSafeInteger(value.rngState) || (value.rngState as number) < 0
    || (value.rngState as number) > 0xffff_ffff) throw new Error("RNG de Pension invalide.");
  const pending = value.pendingEgg === null ? null : occupant({ pokemon: value.pendingEgg, depositedLevel: 1 });
  if (pending === undefined || value.eggReady !== (pending !== null)) throw new Error("Œuf de Pension invalide.");
  if (pending !== null && (pending.pokemon.metadata.eggSteps <= 0 || ids.includes(pending.pokemon.id))) {
    throw new Error("Œuf de Pension invalide.");
  }
  return { schemaVersion: SOURCE_DAY_CARE_SCHEMA_VERSION, slots: [first, second],
    eggCycleSteps: value.eggCycleSteps as number, eggReady: value.eggReady,
    pendingEgg: pending?.pokemon ?? null, rngState: value.rngState as number };
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

function resetEggCycle(): Pick<SourceDayCareState,
  "eggCycleSteps" | "eggReady" | "pendingEgg"> {
  return { eggCycleSteps: 0, eggReady: false, pendingEgg: null };
}

export function depositSourceDayCarePokemon(dayCare: SourceDayCareState, party: PlayerPartyState,
  pokemonId: string, slot: number, money: number): SourceDayCareResult {
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  if (dayCare.slots[slot] !== null) return { ok: false, reason: "slot-occupied" };
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) return { ok: false, reason: "pokemon-not-found" };
  if (party.members[index]!.metadata.eggSteps > 0) return { ok: false, reason: "egg-not-allowed" };
  const nextParty = partyWithout(party, index);
  if (!nextParty.members.some(able)) return { ok: false, reason: "last-able-pokemon" };
  const pokemon = healed(party.members[index]!);
  const slots: [SourceDayCareOccupant | null, SourceDayCareOccupant | null] = [...dayCare.slots];
  slots[slot] = { pokemon, depositedLevel: pokemon.level };
  return { ok: true, dayCare: { ...dayCare, slots, ...resetEggCycle() },
    party: nextParty, money, pokemon };
}

export function withdrawSourceDayCarePokemon(dayCare: SourceDayCareState, party: PlayerPartyState,
  slot: number, money: number): SourceDayCareResult {
  if (dayCare.eggReady) return { ok: false, reason: "egg-pending" };
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  const stored = dayCare.slots[slot];
  if (stored === null) return { ok: false, reason: "slot-empty" };
  if (party.members.length >= 6) return { ok: false, reason: "party-full" };
  const fee = sourceDayCareWithdrawalFee(stored);
  if (money < fee) return { ok: false, reason: "insufficient-money" };
  const slots: [SourceDayCareOccupant | null, SourceDayCareOccupant | null] = [...dayCare.slots];
  slots[slot] = null;
  return { ok: true, dayCare: { ...dayCare, slots, ...resetEggCycle() },
    party: { ...party, members: [...party.members, stored.pokemon], activeIndex: party.activeIndex ?? 0 },
    money: money - fee, pokemon: stored.pokemon };
}

export function exchangeSourceDayCarePokemon(dayCare: SourceDayCareState, party: PlayerPartyState,
  slot: number, pokemonId: string, money: number): SourceDayCareResult {
  if (dayCare.eggReady) return { ok: false, reason: "egg-pending" };
  if (!validSlot(slot)) return { ok: false, reason: "invalid-slot" };
  const stored = dayCare.slots[slot];
  if (stored === null) return { ok: false, reason: "slot-empty" };
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) return { ok: false, reason: "pokemon-not-found" };
  if (party.members[index]!.metadata.eggSteps > 0) return { ok: false, reason: "egg-not-allowed" };
  const fee = sourceDayCareWithdrawalFee(stored);
  if (money < fee) return { ok: false, reason: "insufficient-money" };
  const deposited = healed(party.members[index]!);
  const members = party.members.map((pokemon, candidate) => candidate === index ? stored.pokemon : pokemon);
  const slots: [SourceDayCareOccupant | null, SourceDayCareOccupant | null] = [...dayCare.slots];
  slots[slot] = { pokemon: deposited, depositedLevel: deposited.level };
  return { ok: true, dayCare: { ...dayCare, slots, ...resetEggCycle() },
    party: { ...party, members }, money: money - fee, pokemon: stored.pokemon };
}

/**
 * Personal and atomic hand-off used by both the source NPC and the future incubator adapter.
 * A failed hand-off never consumes the frozen egg.
 */
export function collectSourceDayCareEgg(dayCare: SourceDayCareState,
  party: PlayerPartyState, money: number): SourceDayCareResult {
  if (!dayCare.eggReady || dayCare.pendingEgg === null) return { ok: false, reason: "egg-not-ready" };
  if (party.members.length >= 6) return { ok: false, reason: "party-full" };
  if (party.members.some((pokemon) => pokemon.id === dayCare.pendingEgg!.id)) {
    return { ok: false, reason: "pokemon-not-found" };
  }
  const egg = dayCare.pendingEgg;
  return { ok: true, dayCare: { ...dayCare, ...resetEggCycle() },
    party: { ...party, members: [...party.members, egg], activeIndex: party.activeIndex ?? 0 },
    money, pokemon: egg };
}

/** The destructive refusal is deliberately separate so the presentation must confirm it. */
export function discardSourceDayCareEgg(dayCare: SourceDayCareState): SourceDayCareState | null {
  if (!dayCare.eggReady || dayCare.pendingEgg === null) return null;
  return { ...dayCare, ...resetEggCycle() };
}

const UNDISCOVERED_GROUP = "undiscovered";
const DITTO_GROUP = "ditto";
const STAT_KEYS = ["hp", "attack", "defense", "speed", "specialAttack", "specialDefense"] as const;
const POWER_ITEMS: Readonly<Record<string, typeof STAT_KEYS[number]>> = {
  POWERWEIGHT: "hp", POWERBRACER: "attack", POWERBELT: "defense", POWERANKLET: "speed",
  POWERLENS: "specialAttack", POWERBAND: "specialDefense",
};
const INCENSE_BABIES: Readonly<Record<string, string>> = {
  AZURILL: "SEAINCENSE", WYNAUT: "LAXINCENSE", BUDEW: "ROSEINCENSE", CHINGLING: "PUREINCENSE",
  BONSLY: "ROCKINCENSE", MIMEJR: "ODDINCENSE", HAPPINY: "LUCKINCENSE", MUNCHLAX: "FULLINCENSE",
  MANTYKE: "WAVEINCENSE",
};

function eggGroup(definition: PlayerCreationCatalog["pokemon"][number], group: string): boolean {
  return definition.eggGroups.some((candidate) => candidate.toLowerCase() === group);
}

function definitionFor(catalog: PlayerCreationCatalog, species: string) {
  return catalog.pokemon.find((candidate) => candidate.internalName === species);
}

/** Exact four-value compatibility score used by pbDayCareGetCompat. */
export function sourceDayCareCompatibility(dayCare: Pick<SourceDayCareState, "slots">,
  catalog: PlayerCreationCatalog, hasOvalCharm = false): SourceDayCareCompatibility {
  const first = dayCare.slots[0]?.pokemon; const second = dayCare.slots[1]?.pokemon;
  if (first === undefined || second === undefined) return { score: 0, chancePercent: 0, compatible: false };
  const a = definitionFor(catalog, first.species); const b = definitionFor(catalog, second.species);
  if (a === undefined || b === undefined || eggGroup(a, UNDISCOVERED_GROUP) || eggGroup(b, UNDISCOVERED_GROUP)) {
    return { score: 0, chancePercent: 0, compatible: false };
  }
  const dittoA = eggGroup(a, DITTO_GROUP); const dittoB = eggGroup(b, DITTO_GROUP);
  const sharedGroup = a.eggGroups.some((group) => b.eggGroups.includes(group));
  const gendersFit = first.metadata.gender === "male" && second.metadata.gender === "female"
    || first.metadata.gender === "female" && second.metadata.gender === "male"
    || dittoA !== dittoB;
  if ((!sharedGroup && !dittoA && !dittoB) || !gendersFit) {
    return { score: 0, chancePercent: 0, compatible: false };
  }
  const score = (1 + (first.species === second.species ? 1 : 0)
    + (first.metadata.owner.trainerId !== second.metadata.owner.trainerId ? 1 : 0)) as SourceDayCareCompatibilityScore;
  const chancePercent = (hasOvalCharm ? [0, 40, 80, 88] : [0, 20, 50, 70])[score]!;
  return { score, chancePercent, compatible: true };
}

class DayCareRandom {
  public constructor(private state: number) { this.state >>>= 0; if (this.state === 0) this.state = 0x6d2b_79f5; }
  public nextInt(maximum: number): number {
    let value = this.state;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.state = value >>> 0;
    return this.state % maximum;
  }
  public snapshot(): number { return this.state >>> 0; }
}

function babySpecies(species: string, mother: PersistentPokemon, father: PersistentPokemon,
  catalog: PlayerCreationCatalog): string {
  let current = species; let checkIncense = true; const visited = new Set<string>();
  while (!visited.has(current)) {
    visited.add(current);
    const predecessors = catalog.pokemon.filter((candidate) => candidate.evolutions?.some(
      (evolution) => evolution.species === current)).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const predecessor = predecessors[0];
    if (predecessor === undefined) break;
    const incense = INCENSE_BABIES[predecessor.internalName];
    if (checkIncense && incense !== undefined && mother.heldItem !== incense && father.heldItem !== incense) break;
    current = predecessor.internalName;
    checkIncense = false;
  }
  return current;
}

function randomPersonalId(rng: DayCareRandom): number {
  return (rng.nextInt(65_536) | (rng.nextInt(65_536) << 16)) >>> 0;
}

function shiny(personalId: number, trainerId: number | null): boolean {
  if (trainerId === null) return false;
  const mixed = (personalId ^ trainerId) >>> 0;
  return ((mixed & 0xffff) ^ (mixed >>> 16)) < 100;
}

function gender(genderRate: string, personalId: number): PersistentPokemon["metadata"]["gender"] {
  if (genderRate === "Genderless") return "genderless";
  if (genderRate === "AlwaysFemale") return "female";
  if (genderRate === "AlwaysMale") return "male";
  const thresholds: Readonly<Record<string, number>> = {
    FemaleOneEighth: 31, Female25Percent: 63, Female50Percent: 127, Female75Percent: 191,
  };
  const threshold = thresholds[genderRate];
  if (threshold === undefined) throw new Error(`Taux de genre Pokémon inconnu : ${genderRate}.`);
  return (personalId & 0xff) <= threshold ? "female" : "male";
}

function inheritedMoves(baby: PlayerCreationCatalog["pokemon"][number], mother: PersistentPokemon,
  father: PersistentPokemon, catalog: PlayerCreationCatalog): PersistentPokemon["moves"] {
  const known = (pokemon: PersistentPokemon, move: string) => pokemon.moves.some((slot) => slot.internalName === move);
  const moves = baby.levelUpMoves.filter((entry) => entry.level <= 1).map((entry) => entry.move);
  moves.push(...baby.levelUpMoves.filter((entry) => entry.level > 1 && known(mother, entry.move) && known(father, entry.move))
    .map((entry) => entry.move));
  if (father.metadata.gender === "male") {
    moves.push(...(baby.eggMoves ?? []).filter((move) => known(father, move)));
  }
  moves.push(...(baby.eggMoves ?? []).filter((move) => known(mother, move)));
  if (baby.internalName === "PICHU" && [mother, father].some((parent) =>
    ["PIKACHU", "RAICHU"].includes(parent.species) && parent.heldItem === "LIGHTBALL")) moves.push("VOLTTACKLE");
  return [...new Set(moves)].slice(-4).map((internalName) => {
    const move = catalog.moves.find((candidate) => candidate.internalName === internalName);
    if (move === undefined) throw new Error(`Capacité d'Œuf absente du catalogue : ${internalName}.`);
    return { internalName, pp: move.pp, maxPp: move.pp };
  });
}

function inheritedIvs(mother: PersistentPokemon, father: PersistentPokemon,
  rng: DayCareRandom): PokemonTrainingValues {
  const result = Object.fromEntries(STAT_KEYS.map((stat) => [stat, rng.nextInt(32)])) as unknown as
    Record<typeof STAT_KEYS[number], number>;
  const forced = [mother, father].map((parent) => parent.heldItem === null ? undefined : POWER_ITEMS[parent.heldItem]);
  let inherited = 0; const firstParent = rng.nextInt(2);
  for (let offset = 0; offset < 2; offset += 1) {
    const parentIndex = (firstParent + offset) % 2; const stat = forced[parentIndex];
    if (stat === undefined) continue;
    const parent = parentIndex === 0 ? mother : father;
    result[stat] = parent.metadata.ivs[stat]; inherited += 1; break;
  }
  const unavailable = new Set(forced.filter((stat): stat is typeof STAT_KEYS[number] => stat !== undefined));
  const limit = mother.heldItem === "DESTINYKNOT" || father.heldItem === "DESTINYKNOT" ? 5 : 3;
  while (inherited < limit) {
    const available = STAT_KEYS.filter((stat) => !unavailable.has(stat));
    if (available.length === 0) break;
    const stat = available[rng.nextInt(available.length)]!;
    const parent = rng.nextInt(2) === 0 ? mother : father;
    result[stat] = parent.metadata.ivs[stat]; unavailable.add(stat); inherited += 1;
  }
  return result;
}

function inheritedAbility(baby: PlayerCreationCatalog["pokemon"][number], mother: PersistentPokemon,
  father: PersistentPokemon, motherIsDitto: boolean, fatherIsDitto: boolean, rng: DayCareRandom,
  catalog: PlayerCreationCatalog): string | null {
  const normal = baby.abilities; const hidden = baby.hiddenAbilities ?? [];
  const parentAbilityIndex = (parent: PersistentPokemon): { index: number; hidden: boolean } => {
    const definition = definitionFor(catalog, parent.species);
    const abilities = definition?.abilities ?? []; const hiddenAbilities = definition?.hiddenAbilities ?? [];
    const hiddenIndex = hiddenAbilities.indexOf(parent.ability ?? "");
    if (hiddenIndex >= 0) return { index: hiddenIndex, hidden: true };
    return { index: Math.max(0, abilities.indexOf(parent.ability ?? "")), hidden: false };
  };
  const abilityAt = (slot: { index: number; hidden: boolean }): string | null => slot.hidden
    ? hidden[slot.index] ?? normal[0] ?? null : normal[slot.index] ?? normal[0] ?? null;
  if (!motherIsDitto && !fatherIsDitto) {
    const slot = parentAbilityIndex(mother);
    if (slot.hidden) return rng.nextInt(10) < 6 ? abilityAt(slot) : normal[0] ?? null;
    return rng.nextInt(10) < 8 ? abilityAt(slot) : normal[(slot.index + 1) % 2] ?? normal[0] ?? null;
  }
  const parent = motherIsDitto ? father : mother;
  const slot = parentAbilityIndex(parent);
  return slot.hidden && rng.nextInt(10) < 6 ? abilityAt(slot) : normal[0] ?? null;
}

function specialBabySpecies(species: string, rng: DayCareRandom): string {
  if (species === "MANAPHY") return "PHIONE";
  if (species === "NIDORANfE" || species === "NIDORANmA") return rng.nextInt(2) === 0 ? "NIDORANmA" : "NIDORANfE";
  if (species === "VOLBEAT" || species === "ILLUMISE") return rng.nextInt(2) === 0 ? "VOLBEAT" : "ILLUMISE";
  return species;
}

/** Generates the complete hidden egg at the successful roll, using only personal state and a persisted RNG. */
export function generateSourceDayCareEgg(dayCare: Pick<SourceDayCareState, "slots" | "rngState">,
  catalog: PlayerCreationCatalog, options: SourceDayCareAdvanceOptions = {}): { egg: PersistentPokemon; rngState: number } {
  const first = dayCare.slots[0]?.pokemon; const second = dayCare.slots[1]?.pokemon;
  if (first === undefined || second === undefined || !sourceDayCareCompatibility(dayCare, catalog).compatible) {
    throw new Error("Couple de Pension incompatible.");
  }
  const firstDefinition = definitionFor(catalog, first.species); const secondDefinition = definitionFor(catalog, second.species);
  if (firstDefinition === undefined || secondDefinition === undefined) throw new Error("Espèce de pensionnaire absente.");
  const firstDitto = eggGroup(firstDefinition, DITTO_GROUP); const secondDitto = eggGroup(secondDefinition, DITTO_GROUP);
  const mother = first.metadata.gender === "female" || firstDitto ? first : second;
  const father = mother === first ? second : first;
  const motherIsDitto = mother === first ? firstDitto : secondDitto;
  const fatherIsDitto = father === first ? firstDitto : secondDitto;
  const rng = new DayCareRandom(dayCare.rngState);
  const baseSpecies = motherIsDitto ? father.species : mother.species;
  const species = specialBabySpecies(babySpecies(baseSpecies, mother, father, catalog), rng);
  const definition = definitionFor(catalog, species);
  if (definition === undefined || definition.stepsToHatch === undefined) {
    throw new Error(`Données de reproduction incomplètes pour ${species}.`);
  }
  const id = `day-care-egg-${dayCare.rngState.toString(16).padStart(8, "0")}`;
  const creationContext: PokemonCreationContext = options.creationContext === undefined ? {
    origin: { method: "egg", mapId: null, receivedAt: new Date(0).toISOString(), ball: "POKEBALL" },
  } : { ...options.creationContext, origin: { method: "egg",
      mapId: options.creationContext.origin?.mapId ?? null,
      receivedAt: options.creationContext.origin?.receivedAt ?? new Date(0).toISOString(), ball: "POKEBALL" } };
  const base = createPersistentPokemon(id, species, 1, catalog, creationContext);
  let personalId = randomPersonalId(rng);
  const trainerId = base.metadata.owner.trainerId;
  const retries = (options.inventory?.SHINYCHARM ?? 0) > 0 ? 2 : 0;
  for (let retry = 0; retry < retries && !shiny(personalId, trainerId); retry += 1) personalId = randomPersonalId(rng);
  const everstoneNatures = [mother, father].flatMap((parent) =>
    parent.heldItem === "EVERSTONE" ? [parent.metadata.nature] : []);
  const nature: PokemonNature = everstoneNatures.length === 0 ? POKEMON_NATURES[personalId % POKEMON_NATURES.length]!
    : everstoneNatures[rng.nextInt(everstoneNatures.length)]!;
  const ivs = inheritedIvs(mother, father, rng);
  const form = ["BURMY", "SHELLOS", "BASCULIN"].includes(species) ? mother.metadata.form : 0;
  const ball = mother.metadata.gender === "female" && !["MASTERBALL", "CHERISHBALL"].includes(
    mother.metadata.origin.ball ?? "") ? mother.metadata.origin.ball ?? "POKEBALL" : "POKEBALL";
  const metadata = { ...base.metadata, personalId, ivs, nature, form,
    gender: gender(definition.genderRate, personalId), shiny: shiny(personalId, trainerId),
    eggSteps: definition.stepsToHatch, origin: { ...base.metadata.origin, method: "egg" as const, ball } };
  const ability = inheritedAbility(definition, mother, father, motherIsDitto, fatherIsDitto, rng, catalog);
  const pokerusRoll = rng.nextInt(65_536);
  const pokerus = pokerusRoll < 100 ? (() => { const strain = 1 + rng.nextInt(15);
    return { strain, daysRemaining: 1 + strain % 4, cured: false }; })() : null;
  const stats = calculatePokemonStats(definition, 1, metadata);
  const moves = inheritedMoves(definition, mother, father, catalog);
  if (moves.length === 0) throw new Error(`Aucune capacité d'Œuf disponible pour ${species}.`);
  return { egg: { ...base, stats, hp: stats.maxHp, moves,
      ability,
      metadata: { ...metadata, pokerus } }, rngState: rng.snapshot() };
}

function advanceDayCarePokemon(pokemon: PersistentPokemon, catalog: PlayerCreationCatalog): PersistentPokemon {
  const result = grantPokemonExperience(pokemon, 1, catalog);
  if (result.skippedMoves.length === 0) return result.pokemon;
  let moves = [...result.pokemon.moves];
  for (const internalName of result.skippedMoves) {
    const move = catalog.moves.find((candidate) => candidate.internalName === internalName);
    if (move === undefined) throw new Error(`Capacité de Pension absente du catalogue : ${internalName}.`);
    moves = [...moves.slice(1), { internalName, pp: move.pp, maxPp: move.pp }];
  }
  const skipped = new Set(result.skippedMoves);
  const pendingMoves = (result.pokemon.pendingMoves ?? []).filter((move) => !skipped.has(move));
  const { pendingMoves: _ignored, ...withoutPendingMoves } = result.pokemon;
  return { ...withoutPendingMoves, moves, ...(pendingMoves.length === 0 ? {} : { pendingMoves }) };
}

export function advanceSourceDayCare(dayCare: SourceDayCareState, steps: number,
  catalog: PlayerCreationCatalog, options: SourceDayCareAdvanceOptions = {}): SourceDayCareState {
  if (!Number.isSafeInteger(steps) || steps < 0) throw new Error("Nombre de pas de Pension invalide.");
  let state = dayCare;
  for (let step = 0; step < steps; step += 1) {
    let slots = state.slots;
    if (slots[0] !== null && slots[1] !== null && !state.eggReady) {
      const eggCycleSteps = state.eggCycleSteps + 1;
      if (eggCycleSteps >= SOURCE_DAY_CARE_EGG_CYCLE_STEPS) {
        const rng = new DayCareRandom(state.rngState); const roll = rng.nextInt(100);
        const compatibility = sourceDayCareCompatibility(state, catalog, (options.inventory?.OVALCHARM ?? 0) > 0);
        state = { ...state, eggCycleSteps: 0, rngState: rng.snapshot() };
        if (roll < compatibility.chancePercent) {
          const generated = generateSourceDayCareEgg(state, catalog, options);
          state = { ...state, eggReady: true, pendingEgg: generated.egg, rngState: generated.rngState };
        }
      } else state = { ...state, eggCycleSteps };
    }
    slots = state.slots.map((stored) => stored === null ? null
      : { ...stored, pokemon: advanceDayCarePokemon(stored.pokemon, catalog) }) as
      [SourceDayCareOccupant | null, SourceDayCareOccupant | null];
    state = { ...state, slots };
  }
  return state;
}
