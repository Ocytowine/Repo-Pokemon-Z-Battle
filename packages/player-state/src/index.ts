import type { BattleAbility, BattleMove, BattleStats, BattleTeam, BattlerState, HeldItem, MajorStatusState } from "@pokemon-z-battle/battle-engine";
import type { MoveDefinition, PokemonDefinition } from "@pokemon-z-battle/game-data";

export const PLAYER_PARTY_SCHEMA_VERSION = 1 as const;
export const MAX_PARTY_SIZE = 6;

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
}

export interface PlayerPartyState {
  readonly schemaVersion: typeof PLAYER_PARTY_SCHEMA_VERSION;
  readonly activeIndex: number | null;
  readonly members: readonly PersistentPokemon[];
}

export interface PlayerBattleCatalog {
  readonly pokemon: readonly Pick<PokemonDefinition, "internalName" | "name" | "types">[];
  readonly moves: readonly Pick<MoveDefinition, "id" | "internalName" | "name" | "functionCode" | "power" | "type" | "category" | "accuracy" | "pp" | "priority" | "effectChance">[];
}

export interface PlayerCreationCatalog extends PlayerBattleCatalog {
  readonly pokemon: readonly Pick<PokemonDefinition, "internalName" | "name" | "types" | "baseStats" | "abilities" | "levelUpMoves">[];
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
    stats, hp: value.hp, majorStatus: parseStatus(value.majorStatus), ability: value.ability, heldItem: value.heldItem, moves };
}

export function createEmptyPlayerParty(): PlayerPartyState {
  return { schemaVersion: PLAYER_PARTY_SCHEMA_VERSION, activeIndex: null, members: [] };
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

export function healPlayerParty(party: PlayerPartyState): PlayerPartyState {
  return { ...party, members: party.members.map((member) => ({ ...member, hp: member.stats.maxHp, majorStatus: null,
    moves: member.moves.map((slot) => ({ ...slot, pp: slot.maxPp })) })) };
}

function neutralStat(base: number, level: number): number {
  return Math.floor(((2 * base + 31) * level) / 100) + 5;
}

export function createPersistentPokemon(instanceId: string, species: string, level: number,
  catalog: PlayerCreationCatalog): PersistentPokemon {
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
  const base = definition.baseStats;
  const stats: BattleStats = {
    maxHp: Math.floor(((2 * base.hp + 31) * level) / 100) + level + 10,
    attack: neutralStat(base.attack, level), defense: neutralStat(base.defense, level),
    specialAttack: neutralStat(base.specialAttack, level), specialDefense: neutralStat(base.specialDefense, level),
    speed: neutralStat(base.speed, level),
  };
  return { id: instanceId, species, nickname: null, level, experience: 0, stats, hp: stats.maxHp, majorStatus: null,
    ability: definition.abilities[0] ?? null, heldItem: null, moves };
}

export function addPokemonToParty(party: PlayerPartyState, pokemon: PersistentPokemon): PlayerPartyState {
  if (party.members.length >= MAX_PARTY_SIZE) throw new Error("L'équipe contient déjà six Pokémon.");
  if (party.members.some((member) => member.id === pokemon.id)) throw new Error(`Identifiant de Pokémon déjà utilisé : ${pokemon.id}.`);
  return { ...party, activeIndex: party.activeIndex ?? 0, members: [...party.members, pokemon] };
}

const ABILITIES = new Set<BattleAbility>(["BLAZE", "GUTS", "HUGEPOWER", "MAGICGUARD", "OVERGROW", "PUREPOWER",
  "QUICKFEET", "SIMPLE", "TORRENT"]);
const ITEMS = new Set<HeldItem>(["ASSAULTVEST", "BLACKSLUDGE", "LEFTOVERS", "MUSCLEBAND", "SCOPELENS", "WISEGLASSES"]);
const FUNCTIONS = new Set<BattleMove["functionCode"]>(["000", "003", "005", "006", "007", "00A", "00C", "01C", "01D", "01F", "020", "042", "043", "044", "045", "046", "047", "06F", "0A5", "159", "906"]);

function supportedAbility(value: string | null): BattleAbility | null {
  if (value === null) return null;
  if (!ABILITIES.has(value as BattleAbility)) throw new Error(`Talent non supporté par le moteur : ${value}.`);
  return value as BattleAbility;
}

function supportedItem(value: string | null): HeldItem | null {
  if (value === null) return null;
  if (!ITEMS.has(value as HeldItem)) throw new Error(`Objet tenu non supporté par le moteur : ${value}.`);
  return value as HeldItem;
}

function battleMove(slot: PersistentMoveSlot, catalog: PlayerBattleCatalog): BattleMove {
  const definition = catalog.moves.find((candidate) => candidate.internalName === slot.internalName);
  if (definition === undefined) throw new Error(`Capacité absente du catalogue : ${slot.internalName}.`);
  if (!FUNCTIONS.has(definition.functionCode as BattleMove["functionCode"])) {
    throw new Error(`Fonction de capacité non supportée : ${definition.internalName} (${definition.functionCode}).`);
  }
  return { ...definition, functionCode: definition.functionCode as BattleMove["functionCode"], pp: slot.maxPp };
}

function battler(member: PersistentPokemon, catalog: PlayerBattleCatalog): BattlerState {
  const definition = catalog.pokemon.find((candidate) => candidate.internalName === member.species);
  if (definition === undefined) throw new Error(`Espèce absente du catalogue : ${member.species}.`);
  return { id: member.id, species: member.species, name: member.nickname ?? definition.name, level: member.level,
    types: [...definition.types], stats: { ...member.stats },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: member.hp, majorStatus: member.majorStatus === null ? null : { ...member.majorStatus },
    ability: supportedAbility(member.ability), heldItem: supportedItem(member.heldItem),
    moves: member.moves.map((slot) => ({ move: battleMove(slot, catalog), pp: slot.pp })) };
}

export function playerPartyToBattleTeam(party: PlayerPartyState, catalog: PlayerBattleCatalog): BattleTeam {
  if (party.activeIndex === null || party.members.length === 0) throw new Error("Impossible de combattre avec une équipe vide.");
  return { activeIndex: party.activeIndex, members: party.members.map((member) => battler(member, catalog)) };
}

export function storeBattleTeam(party: PlayerPartyState, team: BattleTeam): PlayerPartyState {
  const byId = new Map(team.members.map((member) => [member.id, member]));
  const members = party.members.map((member) => {
    const result = byId.get(member.id);
    if (result === undefined) throw new Error(`Résultat de combat incomplet pour ${member.id}.`);
    const pp = new Map(result.moves.map((slot) => [slot.move.internalName, slot.pp]));
    return { ...member, hp: result.hp, majorStatus: result.majorStatus === null ? null : { ...result.majorStatus },
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
