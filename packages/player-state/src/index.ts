import { isHeldItemSupported, type BattleAbility, type BattleMove, type BattleSide, type BattleStats,
  type BattleTeam, type BattlerState, type HeldItem,
  MajorStatusState, SharedBattleOwnerSettlement, SharedBattleParticipation, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import type { AbilityDefinition, MoveDefinition, PokemonDefinition } from "@pokemon-z-battle/game-data";
import type { PlayerPronouns } from "./profile.js";

export { createDefaultPlayerProfile, parsePlayerProfile, PLAYER_PROFILE_SCHEMA_VERSION,
  type PlayerProfile, type PlayerPronouns } from "./profile.js";
export { createDefaultPlayerAvatarSelection, loadPlayerAvatarSelection, parsePlayerAvatarSelection,
  loadSessionPlayerAvatarSelection, persistPlayerAvatarSelection, persistSessionPlayerAvatarSelection,
  createPlayerTrainerIdentity, parsePlayerTrainerIdentity, PLAYER_TRAINER_IDENTITY_SCHEMA_VERSION,
  PLAYER_AVATAR_ACTIVE_STORAGE_KEY, PLAYER_AVATAR_DRAFT_STORAGE_KEY,
  PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY,
  PLAYER_AVATAR_SELECTION_SCHEMA_VERSION, type PlayerAvatarSelection, type PlayerTrainerIdentity } from "./avatar-selection.js";
export { isPokemonItemUseSupported, isPokemonItemUsableInField, pokemonItemTargetMode,
  usePokemonItem, type PlayerInventory, type PokemonItemUseContext,
  type PokemonItemUseEffect, type PokemonItemUseFailure, type PokemonItemUsePolicy,
  type PokemonItemUseResult } from "./item-use.js";
export { equipPokemonHeldItem, removePokemonHeldItem, type HeldItemChangeFailure,
  type HeldItemChangeResult } from "./held-item.js";
export { isHeldItemSupported, SUPPORTED_HELD_ITEMS } from "@pokemon-z-battle/battle-engine";

export const PLAYER_PARTY_SCHEMA_VERSION = 1 as const;
export const PLAYER_POKEMON_STORAGE_SCHEMA_VERSION = 1 as const;
export const PERSISTENT_POKEMON_METADATA_SCHEMA_VERSION = 1 as const;
export const MAX_PARTY_SIZE = 6;

export const POKEMON_NATURES = ["HARDY", "LONELY", "BRAVE", "ADAMANT", "NAUGHTY",
  "BOLD", "DOCILE", "RELAXED", "IMPISH", "LAX", "TIMID", "HASTY", "SERIOUS",
  "JOLLY", "NAIVE", "MODEST", "MILD", "QUIET", "BASHFUL", "RASH", "CALM",
  "GENTLE", "SASSY", "CAREFUL", "QUIRKY"] as const;

export type PokemonNature = typeof POKEMON_NATURES[number];
export type PokemonGender = "male" | "female" | "genderless";
export type PokemonObtainMethod = "encounter" | "egg" | "trade" | "gift" | "fateful" | "unknown";

export interface PokemonTrainingValues {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
}

export interface PersistentPokemonOwner {
  readonly trainerId: number | null;
  readonly publicId: number | null;
  readonly name: string | null;
  readonly pronouns: PlayerPronouns | null;
}

export interface PersistentPokemonOrigin {
  readonly method: PokemonObtainMethod;
  readonly mapId: number | null;
  readonly level: number;
  readonly receivedAt: string | null;
  readonly hatchedMapId: number | null;
  readonly hatchedAt: string | null;
  readonly ball: string | null;
}

export interface PersistentPokemonPokerus {
  readonly strain: number;
  readonly daysRemaining: number;
  readonly cured: boolean;
}

/** Source-compatible personal data. Null means that a legacy save cannot honestly reconstruct the value yet. */
export interface PersistentPokemonMetadata {
  readonly schemaVersion: typeof PERSISTENT_POKEMON_METADATA_SCHEMA_VERSION;
  readonly personalId: number;
  readonly ivs: PokemonTrainingValues;
  readonly evs: PokemonTrainingValues;
  readonly nature: PokemonNature;
  readonly gender: PokemonGender | null;
  readonly happiness: number | null;
  readonly shiny: boolean;
  readonly form: number;
  readonly owner: PersistentPokemonOwner;
  readonly origin: PersistentPokemonOrigin;
  readonly markings: number;
  readonly ribbons: readonly string[];
  readonly pokerus: PersistentPokemonPokerus | null;
  readonly eggSteps: number;
}

export interface PersistentMoveSlot {
  readonly internalName: string;
  readonly pp: number;
  readonly maxPp: number;
}

export interface PersistentPokemon {
  readonly id: string;
  readonly species: string;
  readonly nickname: string | null;
  readonly level: number;
  readonly experience: number;
  readonly stats: BattleStats;
  readonly hp: number;
  readonly majorStatus: MajorStatusState | null;
  readonly ability: string | null;
  readonly heldItem: string | null;
  readonly moves: readonly PersistentMoveSlot[];
  readonly metadata: PersistentPokemonMetadata;
}

/** Safe identity projection for future trade/Coop presentation; never includes private Trainer ID, IV or EV. */
export interface PublicPokemonIdentity {
  readonly species: string;
  readonly nickname: string | null;
  readonly level: number;
  readonly gender: PokemonGender | null;
  readonly shiny: boolean;
  readonly form: number;
  readonly originalTrainer: {
    readonly publicId: number | null;
    readonly name: string | null;
    readonly pronouns: PlayerPronouns | null;
  };
}

export interface PlayerPartyState {
  readonly schemaVersion: typeof PLAYER_PARTY_SCHEMA_VERSION;
  readonly activeIndex: number | null;
  readonly members: readonly PersistentPokemon[];
}

export interface PlayerPokemonStorageState {
  readonly schemaVersion: typeof PLAYER_POKEMON_STORAGE_SCHEMA_VERSION;
  readonly members: readonly PersistentPokemon[];
}

export interface PlayerPokemonCollectionState {
  readonly party: PlayerPartyState;
  readonly storage: PlayerPokemonStorageState;
}

export interface PlayerBattleCatalog {
  readonly pokemon: readonly (Pick<PokemonDefinition, "internalName" | "name" | "types">
    & { readonly captureRate?: number; readonly weight?: number;
      readonly baseStats?: Pick<PokemonDefinition["baseStats"], "speed"> })[];
  readonly moves: readonly (Pick<MoveDefinition, "id" | "internalName" | "name" | "functionCode" | "power" | "type" | "category" | "accuracy" | "pp" | "priority" | "effectChance">
    & { readonly flags?: string; readonly targetCode?: string })[];
}

export interface PlayerCreationCatalog extends PlayerBattleCatalog {
  readonly pokemon: readonly (Pick<PokemonDefinition, "internalName" | "name" | "types" | "baseStats" | "abilities" | "levelUpMoves" | "growthRate" | "baseExperience" | "genderRate" | "happiness">
    & { readonly id?: number; readonly captureRate?: number; readonly weight?: number })[];
}

/** Runtime catalog required by the detailed Pokemon summary; battle-only callers may keep the smaller contracts above. */
export interface PlayerDetailsCatalog extends PlayerCreationCatalog {
  readonly pokemon: readonly (PlayerCreationCatalog["pokemon"][number]
    & Pick<PokemonDefinition, "id" | "kind" | "pokedexEntry" | "effortPoints" | "hiddenAbilities" | "formNames"
      | "stepsToHatch" | "height" | "weight">)[];
  readonly moves: readonly (PlayerBattleCatalog["moves"][number]
    & Pick<MoveDefinition, "targetCode" | "description">)[];
  readonly abilities: readonly Pick<AbilityDefinition, "id" | "internalName" | "name" | "description">[];
}

export interface PokemonCreationContext {
  readonly owner?: {
    readonly trainerId: number;
    readonly name: string;
    readonly pronouns: PlayerPronouns;
  };
  readonly origin?: {
    readonly method: PokemonObtainMethod;
    readonly mapId: number | null;
    readonly receivedAt: string;
    readonly ball: string | null;
  };
}

export interface ExperienceResult {
  readonly pokemon: PersistentPokemon;
  readonly gained: number;
  readonly levelsGained: number;
  readonly learnedMoves: readonly string[];
  readonly skippedMoves: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function parseStats(value: unknown): BattleStats {
  if (!isRecord(value) || !integer(value.maxHp, 1) || !integer(value.attack, 1) || !integer(value.defense, 1)
    || !integer(value.specialAttack, 1) || !integer(value.specialDefense, 1) || !integer(value.speed, 1)) {
    throw new Error("Statistiques de Pokémon invalides.");
  }
  return { maxHp: value.maxHp, attack: value.attack, defense: value.defense, specialAttack: value.specialAttack,
    specialDefense: value.specialDefense, speed: value.speed };
}

function parseStatus(value: unknown): MajorStatusState | null {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.kind !== "string") throw new Error("Statut majeur invalide.");
  if (["burn", "paralysis", "frozen", "caduco", "hemorrhage"].includes(value.kind)) return { kind: value.kind } as MajorStatusState;
  if (value.kind === "sleep" && integer(value.turnsRemaining, 0, 10)) return { kind: "sleep", turnsRemaining: value.turnsRemaining };
  if (value.kind === "poison" && (value.toxicCounter === null || integer(value.toxicCounter, 0, 15))) {
    return { kind: "poison", toxicCounter: value.toxicCounter as number | null };
  }
  throw new Error("Statut majeur invalide.");
}

/** Story switches are translated into this save-agnostic policy by the solo or Coop adapter. */
export interface PokemonZExperiencePolicy {
  readonly trainerBattle: boolean;
  readonly levelCap: number;
  readonly noSplitExperience?: boolean;
  readonly experienceDisabled?: boolean;
  readonly boostTenPercent?: boolean;
  readonly boostTwentyPercent?: boolean;
}

export interface SharedBattleExperienceGain {
  readonly turn: number;
  readonly defeatedMemberId: string;
  readonly recipientMemberId: string;
  readonly calculated: number;
  readonly gained: number;
  readonly previousLevel: number;
  readonly nextLevel: number;
  readonly learnedMoves: readonly string[];
  readonly skippedMoves: readonly string[];
}

export interface SharedBattleExperienceSettlement {
  readonly party: PlayerPartyState;
  readonly gains: readonly SharedBattleExperienceGain[];
}

function stableUint32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function generatedTrainingValues(id: string, species: string): PokemonTrainingValues {
  const value = (stat: keyof PokemonTrainingValues) => stableUint32(`pokemon-z:${id}:${species}:${stat}`) % 32;
  return { hp: value("hp"), attack: value("attack"), defense: value("defense"),
    specialAttack: value("specialAttack"), specialDefense: value("specialDefense"), speed: value("speed") };
}

/** Deterministic legacy fallback: loading the same old save never rerolls personal data. */
export function createPersistentPokemonMetadata(id: string, species: string, level: number): PersistentPokemonMetadata {
  const personalId = stableUint32(`pokemon-z:${id}:${species}:personal-id`);
  return {
    schemaVersion: PERSISTENT_POKEMON_METADATA_SCHEMA_VERSION,
    personalId,
    ivs: generatedTrainingValues(id, species),
    evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    nature: POKEMON_NATURES[personalId % POKEMON_NATURES.length]!,
    gender: null,
    happiness: null,
    shiny: false,
    form: 0,
    owner: { trainerId: null, publicId: null, name: null, pronouns: null },
    origin: { method: "unknown", mapId: null, level, receivedAt: null, hatchedMapId: null, hatchedAt: null, ball: null },
    markings: 0,
    ribbons: [],
    pokerus: null,
    eggSteps: 0,
  };
}

function parseTrainingValues(value: unknown, kind: "IV" | "EV"): PokemonTrainingValues {
  const maximum = kind === "IV" ? 31 : 252;
  if (!isRecord(value) || !integer(value.hp, 0, maximum) || !integer(value.attack, 0, maximum)
    || !integer(value.defense, 0, maximum) || !integer(value.specialAttack, 0, maximum)
    || !integer(value.specialDefense, 0, maximum) || !integer(value.speed, 0, maximum)) {
    throw new Error(`${kind} sauvegardés invalides.`);
  }
  const result = { hp: value.hp, attack: value.attack, defense: value.defense,
    specialAttack: value.specialAttack, specialDefense: value.specialDefense, speed: value.speed };
  if (kind === "EV" && Object.values(result).reduce((total, current) => total + current, 0) > 510) {
    throw new Error("Total des EV sauvegardés invalide.");
  }
  return result;
}

function nullableString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value !== "");
}

function nullableMapId(value: unknown): value is number | null {
  return value === null || integer(value, 1);
}

function parsePokemonMetadata(value: unknown, id: string, species: string, level: number): PersistentPokemonMetadata {
  if (value === undefined) return createPersistentPokemonMetadata(id, species, level);
  if (!isRecord(value) || value.schemaVersion !== PERSISTENT_POKEMON_METADATA_SCHEMA_VERSION
    || !integer(value.personalId, 0, 0xffffffff) || !POKEMON_NATURES.includes(value.nature as PokemonNature)
    || (value.gender !== null && !["male", "female", "genderless"].includes(value.gender as string))
    || (value.happiness !== null && !integer(value.happiness, 0, 255)) || typeof value.shiny !== "boolean"
    || !integer(value.form, 0) || !integer(value.markings, 0, 255) || !integer(value.eggSteps, 0)
    || !Array.isArray(value.ribbons) || value.ribbons.some((ribbon) => typeof ribbon !== "string" || ribbon === "")
    || new Set(value.ribbons).size !== value.ribbons.length || !isRecord(value.owner) || !isRecord(value.origin)) {
    throw new Error("Métadonnées du Pokémon sauvegardé invalides.");
  }
  const owner = value.owner;
  const ownerPronouns = owner.pronouns === undefined ? null : owner.pronouns;
  if ((owner.trainerId !== null && !integer(owner.trainerId, 0, 0xffffffff))
    || (owner.publicId !== null && !integer(owner.publicId, 0, 65535))
    || (owner.trainerId !== null && owner.publicId !== (owner.trainerId & 0xffff))
    || !nullableString(owner.name)
    || (ownerPronouns !== null && !["masculine", "feminine", "neutral"].includes(ownerPronouns as string))) {
    throw new Error("Dresseur d'origine sauvegardé invalide.");
  }
  const origin = value.origin;
  if (!["encounter", "egg", "trade", "gift", "fateful", "unknown"].includes(origin.method as string)
    || !nullableMapId(origin.mapId) || !integer(origin.level, 1, 100) || !nullableString(origin.receivedAt)
    || !nullableMapId(origin.hatchedMapId) || !nullableString(origin.hatchedAt) || !nullableString(origin.ball)) {
    throw new Error("Origine du Pokémon sauvegardé invalide.");
  }
  let pokerus: PersistentPokemonPokerus | null = null;
  if (value.pokerus !== null) {
    if (!isRecord(value.pokerus) || !integer(value.pokerus.strain, 1, 15)
      || !integer(value.pokerus.daysRemaining, 0, 4) || typeof value.pokerus.cured !== "boolean") {
      throw new Error("Pokérus sauvegardé invalide.");
    }
    pokerus = { strain: value.pokerus.strain, daysRemaining: value.pokerus.daysRemaining, cured: value.pokerus.cured };
  }
  return {
    schemaVersion: PERSISTENT_POKEMON_METADATA_SCHEMA_VERSION,
    personalId: value.personalId,
    ivs: parseTrainingValues(value.ivs, "IV"),
    evs: parseTrainingValues(value.evs, "EV"),
    nature: value.nature as PokemonNature,
    gender: value.gender as PokemonGender | null,
    happiness: value.happiness as number | null,
    shiny: value.shiny,
    form: value.form,
    owner: { trainerId: owner.trainerId as number | null, publicId: owner.publicId as number | null,
      name: owner.name as string | null, pronouns: ownerPronouns as PlayerPronouns | null },
    origin: { method: origin.method as PokemonObtainMethod, mapId: origin.mapId as number | null, level: origin.level,
      receivedAt: origin.receivedAt as string | null, hatchedMapId: origin.hatchedMapId as number | null,
      hatchedAt: origin.hatchedAt as string | null, ball: origin.ball as string | null },
    markings: value.markings,
    ribbons: [...value.ribbons] as string[],
    pokerus,
    eggSteps: value.eggSteps,
  };
}

function parsePokemon(value: unknown): PersistentPokemon {
  if (!isRecord(value) || typeof value.id !== "string" || value.id === "" || typeof value.species !== "string" || value.species === ""
    || (value.nickname !== null && typeof value.nickname !== "string") || !integer(value.level, 1, 100)
    || !integer(value.experience, 0) || !integer(value.hp, 0) || !Array.isArray(value.moves)
    || (value.ability !== null && typeof value.ability !== "string") || (value.heldItem !== null && typeof value.heldItem !== "string")) {
    throw new Error("Pokémon sauvegardé invalide.");
  }
  const stats = parseStats(value.stats);
  if (value.hp > stats.maxHp || value.moves.length < 1 || value.moves.length > 4) throw new Error("PV ou capacités sauvegardés invalides.");
  const moves = value.moves.map((slot) => {
    if (!isRecord(slot) || typeof slot.internalName !== "string" || slot.internalName === ""
      || !integer(slot.pp, 0) || !integer(slot.maxPp, 1) || slot.pp > slot.maxPp) throw new Error("Capacité sauvegardée invalide.");
    return { internalName: slot.internalName, pp: slot.pp, maxPp: slot.maxPp };
  });
  return { id: value.id, species: value.species, nickname: value.nickname, level: value.level, experience: value.experience,
    stats, hp: value.hp, majorStatus: parseStatus(value.majorStatus), ability: value.ability, heldItem: value.heldItem, moves,
    metadata: parsePokemonMetadata(value.metadata, value.id, value.species, value.level) };
}

export function createEmptyPlayerParty(): PlayerPartyState {
  return { schemaVersion: PLAYER_PARTY_SCHEMA_VERSION, activeIndex: null, members: [] };
}

export function publicPokemonIdentity(pokemon: PersistentPokemon): PublicPokemonIdentity {
  return { species: pokemon.species, nickname: pokemon.nickname, level: pokemon.level,
    gender: pokemon.metadata.gender, shiny: pokemon.metadata.shiny, form: pokemon.metadata.form,
    originalTrainer: { publicId: pokemon.metadata.owner.publicId, name: pokemon.metadata.owner.name,
      pronouns: pokemon.metadata.owner.pronouns } };
}

export function createEmptyPlayerPokemonStorage(): PlayerPokemonStorageState {
  return { schemaVersion: PLAYER_POKEMON_STORAGE_SCHEMA_VERSION, members: [] };
}

export function parsePlayerParty(value: unknown): PlayerPartyState {
  if (!isRecord(value) || value.schemaVersion !== PLAYER_PARTY_SCHEMA_VERSION || !Array.isArray(value.members)
    || value.members.length > MAX_PARTY_SIZE) throw new Error("Sauvegarde d'équipe invalide.");
  const members = value.members.map(parsePokemon);
  if (new Set(members.map((member) => member.id)).size !== members.length) throw new Error("Identifiants de Pokémon dupliqués.");
  const activeIndex = value.activeIndex;
  if (members.length === 0 ? activeIndex !== null : !integer(activeIndex, 0, members.length - 1)) {
    throw new Error("Pokémon actif invalide.");
  }
  return { schemaVersion: PLAYER_PARTY_SCHEMA_VERSION, activeIndex: activeIndex as number | null, members };
}

export function parsePlayerPokemonStorage(value: unknown): PlayerPokemonStorageState {
  if (!isRecord(value) || value.schemaVersion !== PLAYER_POKEMON_STORAGE_SCHEMA_VERSION || !Array.isArray(value.members)) {
    throw new Error("Stockage Pokémon invalide.");
  }
  const members = value.members.map(parsePokemon);
  if (new Set(members.map((member) => member.id)).size !== members.length) {
    throw new Error("Identifiants de Pokémon stockés dupliqués.");
  }
  return { schemaVersion: PLAYER_POKEMON_STORAGE_SCHEMA_VERSION, members };
}

export function addPokemonToStorage(storage: PlayerPokemonStorageState,
  pokemon: PersistentPokemon): PlayerPokemonStorageState {
  if (storage.members.some((member) => member.id === pokemon.id)) {
    throw new Error(`Identifiant de Pokémon déjà stocké : ${pokemon.id}.`);
  }
  return { ...storage, members: [...storage.members, pokemon] };
}

/** Moves one personal Pokemon without duplicating it between the party and storage. */
export function transferPokemonToStorage(party: PlayerPartyState, storage: PlayerPokemonStorageState,
  pokemonId: string): PlayerPokemonCollectionState {
  if (party.members.length <= 1) throw new Error("L'équipe doit conserver au moins un Pokémon.");
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) throw new Error("Pokémon absent de l'équipe.");
  if (storage.members.some((pokemon) => pokemon.id === pokemonId)) throw new Error("Pokémon déjà présent dans le Ranch.");
  const pokemon = party.members[index]!;
  const members = party.members.filter((_, memberIndex) => memberIndex !== index);
  const activeIndex = party.activeIndex === null ? 0
    : index < party.activeIndex ? party.activeIndex - 1
      : index === party.activeIndex ? Math.min(index, members.length - 1) : party.activeIndex;
  return { party: { ...party, activeIndex, members }, storage: { ...storage, members: [...storage.members, pokemon] } };
}

/** Withdraws one personal Pokemon while enforcing the canonical six-member limit. */
export function transferPokemonToParty(party: PlayerPartyState, storage: PlayerPokemonStorageState,
  pokemonId: string): PlayerPokemonCollectionState {
  if (party.members.length >= MAX_PARTY_SIZE) throw new Error("L'équipe contient déjà six Pokémon.");
  const index = storage.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) throw new Error("Pokémon absent du Ranch.");
  if (party.members.some((pokemon) => pokemon.id === pokemonId)) throw new Error("Pokémon déjà présent dans l'équipe.");
  const pokemon = storage.members[index]!;
  return { party: { ...party, activeIndex: party.activeIndex ?? 0, members: [...party.members, pokemon] },
    storage: { ...storage, members: storage.members.filter((_, memberIndex) => memberIndex !== index) } };
}

/** Places one personal Pokemon at the head of the party and makes it the active member. */
export function movePokemonToPartyFront(party: PlayerPartyState, pokemonId: string): PlayerPartyState {
  const index = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (index < 0) throw new Error("Pokémon absent de l'équipe.");
  const pokemon = party.members[index]!;
  return { ...party, activeIndex: 0,
    members: index === 0 ? [...party.members] : [pokemon, ...party.members.filter((_, memberIndex) => memberIndex !== index)] };
}

function pokemonWithReorderedMoves(pokemon: PersistentPokemon, fromIndex: number, toIndex: number): PersistentPokemon {
  if (!integer(fromIndex, 0, pokemon.moves.length - 1) || !integer(toIndex, 0, pokemon.moves.length - 1)) {
    throw new Error("Position de capacité invalide.");
  }
  if (fromIndex === toIndex) return pokemon;
  const moves = [...pokemon.moves];
  [moves[fromIndex], moves[toIndex]] = [moves[toIndex]!, moves[fromIndex]!];
  return { ...pokemon, moves };
}

/** Swaps two move slots in the owner's canonical party/storage state. Battles consume this same order. */
export function reorderPokemonMoves(party: PlayerPartyState, storage: PlayerPokemonStorageState,
  pokemonId: string, fromIndex: number, toIndex: number): PlayerPokemonCollectionState {
  const partyIndex = party.members.findIndex((pokemon) => pokemon.id === pokemonId);
  const storageIndex = storage.members.findIndex((pokemon) => pokemon.id === pokemonId);
  if (partyIndex >= 0 && storageIndex >= 0) throw new Error("Pokémon dupliqué entre l'équipe et le Ranch.");
  if (partyIndex < 0 && storageIndex < 0) throw new Error("Pokémon absent de la collection.");
  if (partyIndex >= 0) return { party: { ...party, members: party.members.map((pokemon, index) =>
    index === partyIndex ? pokemonWithReorderedMoves(pokemon, fromIndex, toIndex) : pokemon) }, storage };
  return { party, storage: { ...storage, members: storage.members.map((pokemon, index) =>
    index === storageIndex ? pokemonWithReorderedMoves(pokemon, fromIndex, toIndex) : pokemon) } };
}

export function healPlayerParty(party: PlayerPartyState): PlayerPartyState {
  return { ...party, members: party.members.map((member) => ({ ...member, hp: member.stats.maxHp, majorStatus: null,
    moves: member.moves.map((slot) => ({ ...slot, pp: slot.maxPp })) })) };
}

export function experienceAtLevel(level: number, growthRate: string): number {
  if (!integer(level, 1, 100)) throw new Error(`Niveau invalide pour l'expérience : ${level}.`);
  const cube = level ** 3;
  switch (growthRate) {
    case "Medium": case "MediumFast": return cube;
    case "Parabolic": case "MediumSlow": return Math.max(0, Math.floor((6 * cube) / 5 - 15 * level ** 2 + 100 * level - 140));
    case "Fast": return Math.floor((4 * cube) / 5);
    case "Slow": return Math.floor((5 * cube) / 4);
    case "Erratic":
      if (level <= 50) return Math.floor((cube * (100 - level)) / 50);
      if (level <= 68) return Math.floor((cube * (150 - level)) / 100);
      if (level <= 98) return Math.floor(cube * (1.274 - (1 / 50) * Math.floor(level / 3) - [0, 0.008, 0.014][level % 3]!));
      return Math.floor((cube * (160 - level)) / 100);
    case "Fluctuating":
      if (level <= 15) return Math.floor(cube * ((24 + Math.floor((level + 1) / 3)) / 50));
      if (level <= 35) return Math.floor(cube * ((14 + level) / 50));
      return Math.floor(cube * ((32 + Math.floor(level / 2)) / 50));
    default: throw new Error(`Courbe d'expérience non prise en charge : ${growthRate}.`);
  }
}

function levelForExperience(experience: number, growthRate: string): number {
  for (let level = 100; level >= 1; level -= 1) {
    if (experience >= experienceAtLevel(level, growthRate)) return level;
  }
  return 1;
}

const NATURE_STAT_ORDER = ["attack", "defense", "speed", "specialAttack", "specialDefense"] as const;

function naturePercent(nature: PokemonNature, stat: typeof NATURE_STAT_ORDER[number]): number {
  const natureIndex = POKEMON_NATURES.indexOf(nature);
  const increased = Math.floor(natureIndex / 5);
  const decreased = natureIndex % 5;
  const statIndex = NATURE_STAT_ORDER.indexOf(stat);
  if (increased === decreased || statIndex < 0) return 100;
  if (statIndex === increased) return 110;
  if (statIndex === decreased) return 90;
  return 100;
}

function calculatedStat(base: number, level: number, iv: number, ev: number, percent: number): number {
  const beforeNature = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  return Math.floor((beforeNature * percent) / 100);
}

/** Exact integer formulas and nature order used by PokeBattle_Pokemon#calcStats in Pokemon Z 2.12 FR. */
export function calculatePokemonStats(definition: Pick<PokemonDefinition, "baseStats">, level: number,
  metadata: Pick<PersistentPokemonMetadata, "ivs" | "evs" | "nature">): BattleStats {
  if (!integer(level, 1, 100)) throw new Error("Niveau invalide pour le calcul des statistiques.");
  const base = definition.baseStats;
  const hp = base.hp === 1 ? 1
    : Math.floor(((2 * base.hp + metadata.ivs.hp + Math.floor(metadata.evs.hp / 4)) * level) / 100) + level + 10;
  return {
    maxHp: hp,
    attack: calculatedStat(base.attack, level, metadata.ivs.attack, metadata.evs.attack,
      naturePercent(metadata.nature, "attack")),
    defense: calculatedStat(base.defense, level, metadata.ivs.defense, metadata.evs.defense,
      naturePercent(metadata.nature, "defense")),
    speed: calculatedStat(base.speed, level, metadata.ivs.speed, metadata.evs.speed,
      naturePercent(metadata.nature, "speed")),
    specialAttack: calculatedStat(base.specialAttack, level, metadata.ivs.specialAttack, metadata.evs.specialAttack,
      naturePercent(metadata.nature, "specialAttack")),
    specialDefense: calculatedStat(base.specialDefense, level, metadata.ivs.specialDefense, metadata.evs.specialDefense,
      naturePercent(metadata.nature, "specialDefense")),
  };
}

function sameStats(left: BattleStats, right: BattleStats): boolean {
  return left.maxHp === right.maxHp && left.attack === right.attack && left.defense === right.defense
    && left.speed === right.speed && left.specialAttack === right.specialAttack
    && left.specialDefense === right.specialDefense;
}

function hpWithPreservedDamage(pokemon: PersistentPokemon, nextMaxHp: number, protectLivingPokemon: boolean): number {
  if (pokemon.hp === 0 && protectLivingPokemon) return 0;
  const nextHp = nextMaxHp - (pokemon.stats.maxHp - pokemon.hp);
  if (protectLivingPokemon && pokemon.hp > 0) return Math.max(1, Math.min(nextMaxHp, nextHp));
  return Math.max(0, Math.min(nextMaxHp, nextHp));
}

/** Reconciles legacy stored stats once a species catalog is available, preserving damage and explicit K.O. state. */
export function recalculatePersistentPokemonStats(pokemon: PersistentPokemon,
  catalog: PlayerCreationCatalog, protectLivingPokemon = true): PersistentPokemon {
  const definition = catalog.pokemon.find((candidate) => candidate.internalName === pokemon.species);
  if (definition === undefined) throw new Error(`Espèce absente du catalogue : ${pokemon.species}.`);
  const stats = calculatePokemonStats(definition, pokemon.level, pokemon.metadata);
  const hp = hpWithPreservedDamage(pokemon, stats.maxHp, protectLivingPokemon);
  return sameStats(stats, pokemon.stats) && hp === pokemon.hp ? pokemon : { ...pokemon, stats, hp };
}

export function recalculatePlayerPokemonCollection(party: PlayerPartyState, storage: PlayerPokemonStorageState,
  catalog: PlayerCreationCatalog): PlayerPokemonCollectionState {
  const partyMembers = party.members.map((pokemon) => recalculatePersistentPokemonStats(pokemon, catalog));
  const storageMembers = storage.members.map((pokemon) => recalculatePersistentPokemonStats(pokemon, catalog));
  return {
    party: partyMembers.every((pokemon, index) => pokemon === party.members[index]) ? party : { ...party, members: partyMembers },
    storage: storageMembers.every((pokemon, index) => pokemon === storage.members[index]) ? storage : { ...storage, members: storageMembers },
  };
}

const SOURCE_GENDER_THRESHOLDS: Readonly<Record<string, number>> = {
  FemaleOneEighth: 31,
  Female25Percent: 63,
  Female50Percent: 127,
  Female75Percent: 191,
};

function pokemonGender(genderRate: string, personalId: number): PokemonGender {
  if (genderRate === "Genderless") return "genderless";
  if (genderRate === "AlwaysFemale") return "female";
  if (genderRate === "AlwaysMale") return "male";
  const threshold = SOURCE_GENDER_THRESHOLDS[genderRate];
  if (threshold === undefined) throw new Error(`Taux de genre Pokémon inconnu : ${genderRate}.`);
  return (personalId & 0xff) <= threshold ? "female" : "male";
}

function sourceShiny(personalId: number, trainerId: number): boolean {
  const mixed = (personalId ^ trainerId) >>> 0;
  return ((mixed & 0xffff) ^ (mixed >>> 16)) < 100;
}

function createdPokemonMetadata(instanceId: string, species: string, level: number,
  definition: PlayerCreationCatalog["pokemon"][number], context: PokemonCreationContext | undefined): PersistentPokemonMetadata {
  const metadata = createPersistentPokemonMetadata(instanceId, species, level);
  const owner = context?.owner;
  const origin = context?.origin;
  if (!integer(definition.happiness, 0, 255)) throw new Error(`Bonheur initial invalide pour ${species}.`);
  if (owner !== undefined && (!integer(owner.trainerId, 0, 0xffffffff) || owner.name.trim() === ""
    || owner.name.length > 12 || !["masculine", "feminine", "neutral"].includes(owner.pronouns))) {
    throw new Error("Dresseur d'origine invalide.");
  }
  if (origin !== undefined && (origin.receivedAt === "" || Number.isNaN(Date.parse(origin.receivedAt))
    || !nullableMapId(origin.mapId) || !["encounter", "egg", "trade", "gift", "fateful", "unknown"].includes(origin.method)
    || !nullableString(origin.ball))) throw new Error("Contexte d'obtention du Pokémon invalide.");
  return { ...metadata,
    gender: pokemonGender(definition.genderRate, metadata.personalId),
    happiness: definition.happiness,
    shiny: owner === undefined ? false : sourceShiny(metadata.personalId, owner.trainerId),
    owner: owner === undefined ? metadata.owner : { trainerId: owner.trainerId,
      publicId: owner.trainerId & 0xffff, name: owner.name.trim(), pronouns: owner.pronouns },
    origin: origin === undefined ? metadata.origin : { ...metadata.origin, method: origin.method,
      mapId: origin.mapId, receivedAt: origin.receivedAt, ball: origin.ball },
  };
}

export function createPersistentPokemon(instanceId: string, species: string, level: number,
  catalog: PlayerCreationCatalog, context?: PokemonCreationContext): PersistentPokemon {
  if (instanceId === "" || !integer(level, 1, 100)) throw new Error("Paramètres de création du Pokémon invalides.");
  const definition = catalog.pokemon.find((candidate) => candidate.internalName === species);
  if (definition === undefined) throw new Error(`Espèce absente du catalogue : ${species}.`);
  const learned = definition.levelUpMoves.filter((entry) => entry.level <= level)
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.move === entry.move) === index).slice(-4);
  if (learned.length === 0) throw new Error(`Aucune capacité disponible pour ${species} au niveau ${level}.`);
  const moves = learned.map((entry) => {
    const move = catalog.moves.find((candidate) => candidate.internalName === entry.move);
    if (move === undefined) throw new Error(`Capacité absente du catalogue : ${entry.move}.`);
    return { internalName: move.internalName, pp: move.pp, maxPp: move.pp };
  });
  const metadata = createdPokemonMetadata(instanceId, species, level, definition, context);
  const stats = calculatePokemonStats(definition, level, metadata);
  return { id: instanceId, species, nickname: null, level, experience: experienceAtLevel(level, definition.growthRate), stats, hp: stats.maxHp, majorStatus: null,
    ability: definition.abilities[0] ?? null, heldItem: null, moves,
    metadata };
}

export function grantPokemonExperience(pokemon: PersistentPokemon, amount: number,
  catalog: PlayerCreationCatalog): ExperienceResult {
  if (!integer(amount, 0)) throw new Error("Gain d'expérience invalide.");
  const definition = catalog.pokemon.find((candidate) => candidate.internalName === pokemon.species);
  if (definition === undefined) throw new Error(`Espèce absente du catalogue : ${pokemon.species}.`);
  const currentExperience = Math.max(pokemon.experience, experienceAtLevel(pokemon.level, definition.growthRate));
  const nextExperience = Math.min(experienceAtLevel(100, definition.growthRate), currentExperience + amount);
  const nextLevel = Math.max(pokemon.level, levelForExperience(nextExperience, definition.growthRate));
  const learnedMoves: string[] = [];
  const skippedMoves: string[] = [];
  let moves = pokemon.moves.map((slot) => ({ ...slot }));
  for (const entry of definition.levelUpMoves.filter((move) => move.level > pokemon.level && move.level <= nextLevel)) {
    if (moves.some((slot) => slot.internalName === entry.move)) continue;
    const move = catalog.moves.find((candidate) => candidate.internalName === entry.move);
    if (move === undefined) throw new Error(`Capacité absente du catalogue : ${entry.move}.`);
    if (moves.length >= 4) { skippedMoves.push(entry.move); continue; }
    moves = [...moves, { internalName: move.internalName, pp: move.pp, maxPp: move.pp }];
    learnedMoves.push(entry.move);
  }
  const stats = calculatePokemonStats(definition, nextLevel, pokemon.metadata);
  const hp = hpWithPreservedDamage(pokemon, stats.maxHp, false);
  return { pokemon: { ...pokemon, level: nextLevel, experience: nextExperience, stats, hp, moves },
    gained: nextExperience - currentExperience, levelsGained: nextLevel - pokemon.level, learnedMoves, skippedMoves };
}

export function addPokemonToParty(party: PlayerPartyState, pokemon: PersistentPokemon): PlayerPartyState {
  if (party.members.length >= MAX_PARTY_SIZE) throw new Error("L'équipe contient déjà six Pokémon.");
  if (party.members.some((member) => member.id === pokemon.id)) throw new Error(`Identifiant de Pokémon déjà utilisé : ${pokemon.id}.`);
  return { ...party, activeIndex: party.activeIndex ?? 0, members: [...party.members, pokemon] };
}

const FUNCTIONS = new Set<BattleMove["functionCode"]>(["000", "003", "005", "006", "007", "00A", "00C", "01C", "01D", "01F", "020", "042", "043", "044", "045", "046", "047", "06F", "0A5", "0D8", "0DD", "159", "906"]);

function supportedAbility(value: string | null): BattleAbility | null {
  if (value === null) return null;
  if (!/^[A-Z][A-Z0-9_]{0,63}$/u.test(value)) throw new Error(`Identifiant de talent invalide : ${value}.`);
  return value as BattleAbility;
}

function supportedItem(value: string | null): HeldItem | null {
  if (value === null) return null;
  if (!isHeldItemSupported(value)) throw new Error(`Objet tenu non supporté par le moteur : ${value}.`);
  return value as HeldItem;
}

function battleMove(slot: PersistentMoveSlot, catalog: PlayerBattleCatalog): BattleMove {
  const definition = catalog.moves.find((candidate) => candidate.internalName === slot.internalName);
  if (definition === undefined) throw new Error(`Capacité absente du catalogue : ${slot.internalName}.`);
  if (!FUNCTIONS.has(definition.functionCode as BattleMove["functionCode"])) {
    throw new Error(`Fonction de capacité non supportée : ${definition.internalName} (${definition.functionCode}).`);
  }
  // Le catalogue détaillé contient aussi description/targetCode. Ces données
  // d'interface ne font pas partie de l'état de combat public et le protocole
  // réseau rejette volontairement tout champ supplémentaire.
  const targetAliases: Readonly<Record<string, string>> = { SingleNonUser: "00", NoTarget: "01",
    RandomOpposing: "02", AllOpposing: "04", AllNonUsers: "08", User: "10", UserSide: "20",
    BothSides: "40", OpposingSide: "80", Partner: "100", UserOrPartner: "200",
    SingleOpposing: "400", OppositeOpposing: "800" };
  const rawTarget = definition.targetCode ?? "00";
  const targetCode = targetAliases[rawTarget] ?? rawTarget.toUpperCase().replace(/^0X/u, "");
  return { id: definition.id, internalName: definition.internalName, name: definition.name,
    functionCode: definition.functionCode as BattleMove["functionCode"], power: definition.power,
    type: definition.type, category: definition.category, accuracy: definition.accuracy,
    pp: slot.maxPp, priority: definition.priority, effectChance: definition.effectChance,
    ...(definition.flags === undefined ? {} : { flags: definition.flags }), targetCode };
}

function battler(member: PersistentPokemon, catalog: PlayerBattleCatalog): BattlerState {
  const definition = catalog.pokemon.find((candidate) => candidate.internalName === member.species);
  if (definition === undefined) throw new Error(`Espèce absente du catalogue : ${member.species}.`);
  return { id: member.id, species: member.species, name: member.nickname ?? definition.name, level: member.level,
    types: [...definition.types], stats: { ...member.stats },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: member.hp, majorStatus: member.majorStatus === null ? null : { ...member.majorStatus },
    ability: supportedAbility(member.ability), heldItem: supportedItem(member.heldItem),
    moves: member.moves.map((slot) => ({ move: battleMove(slot, catalog), pp: slot.pp })),
    // PBS exposes kilograms with one decimal (6.9), while Pokemon Z's compiled
    // battler API returns hectograms (69). Keep the battle/network contract in
    // the source integer unit used by Heavy Ball's 2048/3072/4096 thresholds.
    ...(definition.captureRate === undefined ? {} : { capture: { rate: definition.captureRate,
      baseSpeed: definition.baseStats?.speed ?? 1, weight: Math.round((definition.weight ?? 0) * 10) } }),
    appearance: { form: member.metadata.form, shiny: member.metadata.shiny, gender: member.metadata.gender } };
}

/** Exact participant branch of the final Pokemon Z `repexp.rb` override, including its rounding order. */
export function pokemonZParticipantExperience(input: {
  readonly defeatedLevel: number;
  readonly defeatedBaseExperience: number;
  readonly recipientLevel: number;
  readonly participantCount: number;
  readonly luckyEgg: boolean;
}, policy: PokemonZExperiencePolicy): number {
  if (!integer(input.defeatedLevel, 1, 100) || !integer(input.defeatedBaseExperience, 1)
    || !integer(input.recipientLevel, 1, 100) || !integer(input.participantCount, 1)) {
    throw new Error("Données de calcul d'expérience invalides.");
  }
  if (!integer(policy.levelCap, 1, 100)) throw new Error("Plafond de niveau invalide.");
  let experience = Math.floor(input.defeatedLevel * input.defeatedBaseExperience
    / (policy.noSplitExperience === true ? 1 : input.participantCount));
  if (policy.trainerBattle) experience = Math.floor(experience * 3 / 2);
  experience = Math.floor(experience / 5);
  const denominator = input.defeatedLevel + input.recipientLevel + 10;
  let adjustment: number;
  if (input.defeatedLevel + 5 <= input.recipientLevel) {
    adjustment = (input.defeatedLevel + 10) / denominator;
  } else if (input.defeatedLevel < input.recipientLevel) {
    adjustment = (1.5 * input.defeatedLevel + 10) / denominator;
  } else if (input.recipientLevel <= input.defeatedLevel - 2) {
    adjustment = (2.2 * input.defeatedLevel + 10) / denominator;
  } else if (input.recipientLevel <= input.defeatedLevel - 5) {
    adjustment = (2.5 * input.defeatedLevel + 10) / denominator;
  } else if (input.recipientLevel <= input.defeatedLevel - 10) {
    adjustment = (3 * input.defeatedLevel + 10) / denominator;
  } else {
    adjustment = (2 * input.defeatedLevel + 10) / denominator;
  }
  experience = Math.floor(experience * Math.sqrt(adjustment ** 5)) + 1;
  if (policy.experienceDisabled === true) experience = 0;
  if (policy.boostTenPercent === true) experience = Math.floor(experience * 1.1);
  if (policy.boostTwentyPercent === true) experience = Math.floor(experience * 1.2);
  if (input.luckyEgg) experience = Math.floor(experience * 3 / 2);
  // Pokemon Z applies this after switch 661, so an over-cap participant still receives exactly one point.
  if (input.recipientLevel > policy.levelCap) experience = 1;
  return experience;
}

/** Applies only one owner's immutable K.O. credits; callers persist the returned party atomically. */
export function applySharedBattleExperience(party: PlayerPartyState, settlement: SharedBattleOwnerSettlement,
  catalog: PlayerCreationCatalog, policy: PokemonZExperiencePolicy): SharedBattleExperienceSettlement {
  let members = [...party.members];
  const gains: SharedBattleExperienceGain[] = [];
  for (const credit of settlement.defeatCredits) {
    if (!integer(credit.participantCount, 1) || credit.recipientMemberIds.length > credit.participantCount) {
      throw new Error("Crédit d'expérience partagé invalide.");
    }
    const defeated = catalog.pokemon.find((candidate) => candidate.internalName === credit.defeatedBattler.species);
    if (defeated === undefined) throw new Error(`Espèce vaincue absente du catalogue : ${credit.defeatedBattler.species}.`);
    for (const recipientId of credit.recipientMemberIds) {
      const memberIndex = members.findIndex((pokemon) => pokemon.id === recipientId);
      if (memberIndex < 0) throw new Error(`Pokémon bénéficiaire absent de l'équipe : ${recipientId}.`);
      const pokemon = members[memberIndex]!;
      const calculated = pokemonZParticipantExperience({ defeatedLevel: credit.defeatedBattler.level,
        defeatedBaseExperience: defeated.baseExperience, recipientLevel: pokemon.level,
        participantCount: credit.participantCount, luckyEgg: pokemon.heldItem === "LUCKYEGG" }, policy);
      const result = grantPokemonExperience(pokemon, calculated, catalog);
      members[memberIndex] = result.pokemon;
      gains.push({ turn: credit.turn, defeatedMemberId: credit.defeatedBattler.id,
        recipientMemberId: recipientId, calculated, gained: result.gained,
        previousLevel: pokemon.level, nextLevel: result.pokemon.level,
        learnedMoves: result.learnedMoves, skippedMoves: result.skippedMoves });
    }
  }
  return { party: { ...party, members }, gains };
}

export function playerPartyToBattleTeam(party: PlayerPartyState, catalog: PlayerBattleCatalog): BattleTeam {
  if (party.activeIndex === null || party.members.length === 0) throw new Error("Impossible de combattre avec une équipe vide.");
  const members = party.members.map((member) => battler(member, catalog));
  const activeIndex = (members[party.activeIndex]?.hp ?? 0) > 0
    ? party.activeIndex : members.findIndex((member) => member.hp > 0);
  if (activeIndex < 0) throw new Error("Impossible de combattre avec une équipe entièrement K.O.");
  return { activeIndex, members };
}

export function storeBattleTeam(party: PlayerPartyState, team: BattleTeam): PlayerPartyState {
  const byId = new Map(team.members.map((member) => [member.id, member]));
  const members = party.members.map((member) => {
    const result = byId.get(member.id);
    if (result === undefined) throw new Error(`Résultat de combat incomplet pour ${member.id}.`);
    const pp = new Map(result.moves.map((slot) => [slot.move.internalName, slot.pp]));
    return { ...member, hp: result.hp, majorStatus: result.majorStatus === null ? null : { ...result.majorStatus },
      heldItem: result.heldItem,
      moves: member.moves.map((slot) => {
        const current = pp.get(slot.internalName);
        if (current === undefined) throw new Error(`Résultat sans la capacité ${slot.internalName}.`);
        return { ...slot, pp: current };
      }) };
  });
  const activeId = team.members[team.activeIndex]?.id;
  const activeIndex = members.findIndex((member) => member.id === activeId);
  if (activeIndex < 0) throw new Error("Pokémon actif du résultat introuvable.");
  return { ...party, activeIndex, members };
}

/** Restores only the Pokémon owned by one participant from a shared camp battle. */
export function storeOwnedBattleResults(party: PlayerPartyState, participation: SharedBattleParticipation,
  state: TeamBattleState, ownerId: string): PlayerPartyState {
  const owned = new Map<string, { readonly side: BattleSide; readonly battler: BattlerState }>();
  for (const side of ["player", "opponent"] as const) {
    const teamById = new Map(state.teams[side].members.map((battler) => [battler.id, battler]));
    for (const member of participation.camps[side].members) {
      if (member.ownerId !== ownerId) continue;
      const battler = teamById.get(member.battler.id);
      if (battler === undefined) throw new Error(`Résultat partagé incomplet pour ${member.battler.id}.`);
      if (owned.has(battler.id)) throw new Error(`Propriété partagée dupliquée pour ${battler.id}.`);
      owned.set(battler.id, { side, battler });
    }
  }
  const members = party.members.map((pokemon) => {
    const result = owned.get(pokemon.id)?.battler;
    if (result === undefined) return pokemon;
    const pp = new Map(result.moves.map((slot) => [slot.move.internalName, slot.pp]));
    return { ...pokemon, hp: result.hp, majorStatus: result.majorStatus === null ? null : { ...result.majorStatus },
      heldItem: result.heldItem,
      moves: pokemon.moves.map((slot) => ({ ...slot, pp: pp.get(slot.internalName) ?? slot.pp })) };
  });
  const activeOwned = (["player", "opponent"] as const).map((side) => state.teams[side].members[state.teams[side].activeIndex])
    .find((battler) => battler !== undefined && owned.has(battler.id));
  const activeIndex = activeOwned === undefined ? party.activeIndex
    : members.findIndex((pokemon) => pokemon.id === activeOwned.id);
  return { ...party, members, activeIndex: activeIndex === null || activeIndex < 0 ? party.activeIndex : activeIndex };
}
