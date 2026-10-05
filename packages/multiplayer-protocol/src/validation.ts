import { MAX_CLIENT_MESSAGE_BYTES, PROTOCOL_VERSION, type ClientMessage } from "./types.js";
import { parseNetworkPlayerProfile } from "./player-profile.js";
import { parseSourceWorldHostState } from "./source-world.js";
import { parseSourceSceneSnapshot } from "./source-scene.js";
import { parseSourceBattleContext } from "./source-battle.js";
import type { BattleTeam } from "@pokemon-z-battle/battle-engine";

const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/u;
const ROOM_CODE = /^[A-Z2-9]{6}$/u;

export class ProtocolValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProtocolValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isSafePositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isSourceAvatar(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["x", "y", "direction"])
    && Number.isSafeInteger(value.x) && Number(value.x) >= 0
    && Number.isSafeInteger(value.y) && Number(value.y) >= 0
    && ["up", "down", "left", "right"].includes(String(value.direction));
}

function isBattleAction(value: unknown): boolean {
  const move = isRecord(value)
    && hasExactKeys(value, ["kind", "moveIndex"])
    && value.kind === "move"
    && Number.isInteger(value.moveIndex)
    && Number(value.moveIndex) >= 0
    && Number(value.moveIndex) <= 3;
  const switching = isRecord(value)
    && hasExactKeys(value, ["kind", "teamIndex"])
    && value.kind === "switch"
    && Number.isInteger(value.teamIndex)
    && Number(value.teamIndex) >= 0
    && Number(value.teamIndex) <= 5;
  return move || switching;
}

const BATTLE_STATS = ["maxHp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
const BATTLE_STAGES = ["attack", "defense", "specialAttack", "specialDefense", "speed", "accuracy", "evasion"] as const;
const MOVE_FUNCTIONS = new Set(["000", "003", "005", "006", "007", "00A", "00C", "01C", "01D", "01F", "020",
  "042", "043", "044", "045", "046", "047", "06F", "0A5", "0D8", "0DD", "159", "906"]);
const BATTLE_ABILITIES = new Set(["BIGPECKS", "BLAZE", "CHLOROPHYLL", "GUTS", "HUGEPOWER", "MAGICGUARD", "OVERGROW",
  "PUREPOWER", "QUICKFEET", "SHIELDDUST", "SIMPLE", "STATIC", "TORRENT"]);
const HELD_ITEMS = new Set(["ASSAULTVEST", "BLACKSLUDGE", "LEFTOVERS", "MUSCLEBAND", "SCOPELENS", "WISEGLASSES"]);

function boundedString(value: unknown, max = 64): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function safeInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isMajorStatus(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "sleep") return hasExactKeys(value, ["kind", "turnsRemaining"])
    && safeInteger(value.turnsRemaining, 0, 10);
  if (value.kind === "poison") return hasExactKeys(value, ["kind", "toxicCounter"])
    && (value.toxicCounter === null || safeInteger(value.toxicCounter, 0, 20));
  return ["burn", "paralysis", "frozen", "caduco", "hemorrhage"].includes(value.kind)
    && hasExactKeys(value, ["kind"]);
}

function isBattleTeam(value: unknown): value is BattleTeam {
  if (!isRecord(value) || !hasExactKeys(value, ["activeIndex", "members"])
    || !Array.isArray(value.members) || value.members.length < 1 || value.members.length > 6
    || !safeInteger(value.activeIndex, 0, value.members.length - 1)) return false;
  const valid = value.members.every((member) => {
    const memberKeys = ["id", "species", "name", "level", "types", "stats", "stages", "hp", "majorStatus", "ability", "heldItem", "moves"];
    if (!isRecord(member) || !memberKeys.every((key) => key in member)
      || !Object.keys(member).every((key) => [...memberKeys, "appearance"].includes(key))
      || !boundedString(member.id) || !boundedString(member.species) || !boundedString(member.name, 128)
      || !safeInteger(member.level, 1, 100) || !Array.isArray(member.types) || member.types.length < 1
      || member.types.length > 2 || !member.types.every((type) => boundedString(type))
      || !isRecord(member.stats) || !isRecord(member.stages)
      || !Array.isArray(member.moves) || member.moves.length < 1 || member.moves.length > 4) return false;
    if (member.appearance !== undefined && (!isRecord(member.appearance)
      || !hasExactKeys(member.appearance, ["form", "shiny", "gender"])
      || !safeInteger(member.appearance.form, 0, 999) || typeof member.appearance.shiny !== "boolean"
      || member.appearance.gender !== null && !["male", "female", "genderless"].includes(String(member.appearance.gender)))) return false;
    const stats = member.stats;
    const stages = member.stages;
    if (!hasExactKeys(stats, BATTLE_STATS) || !BATTLE_STATS.every((stat) => safeInteger(stats[stat], 1, 999_999))
      || !hasExactKeys(stages, BATTLE_STAGES) || !BATTLE_STAGES.every((stat) => safeInteger(stages[stat], -6, 6))
      || !safeInteger(member.hp, 0, Number(stats.maxHp)) || !isMajorStatus(member.majorStatus)
      || member.ability !== null && !BATTLE_ABILITIES.has(String(member.ability))
      || member.heldItem !== null && !HELD_ITEMS.has(String(member.heldItem))
    ) return false;
    return member.moves.every((slot) => {
      if (!isRecord(slot) || !hasExactKeys(slot, ["move", "pp"]) || !isRecord(slot.move)) return false;
      const move = slot.move;
      return ["id", "internalName", "name", "functionCode", "power", "type", "category", "accuracy", "pp", "priority", "effectChance"]
        .every((key) => key in move)
        && Object.keys(move).every((key) => ["id", "internalName", "name", "functionCode", "power", "type", "category", "accuracy", "pp", "priority", "effectChance", "flags"].includes(key))
        && safeInteger(move.id, 0, 999_999) && boundedString(move.internalName) && boundedString(move.name, 128)
        && MOVE_FUNCTIONS.has(String(move.functionCode)) && safeInteger(move.power, 0, 999)
        && boundedString(move.type) && ["Physical", "Special", "Status"].includes(String(move.category))
        && safeInteger(move.accuracy, 0, 100) && safeInteger(move.pp, 1, 99)
        && safeInteger(move.priority, -10, 10) && safeInteger(move.effectChance, 0, 100)
        && (move.flags === undefined || typeof move.flags === "string")
        && safeInteger(slot.pp, 0, Number(move.pp));
    });
  });
  return valid && Number((value.members[value.activeIndex] as Record<string, unknown>).hp) > 0;
}

function invalid(reason: string): never {
  throw new ProtocolValidationError(`Message client invalide : ${reason}.`);
}

export function normalizeRoomCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!ROOM_CODE.test(normalized)) {
    throw new ProtocolValidationError("Code de room invalide : 6 caractères parmi A-Z et 2-9 attendus.");
  }
  return normalized;
}

export function parseClientMessage(payload: string): ClientMessage {
  if (new TextEncoder().encode(payload).byteLength > MAX_CLIENT_MESSAGE_BYTES) invalid("taille maximale dépassée");
  let value: unknown;
  try {
    value = JSON.parse(payload) as unknown;
  } catch {
    return invalid("JSON illisible");
  }
  if (!isRecord(value) || typeof value.type !== "string") return invalid("objet typé attendu");
  if (value.version !== PROTOCOL_VERSION) return invalid("version de protocole non supportée");

  switch (value.type) {
    case "setReady":
      if (!hasExactKeys(value, ["type", "version", "requestId", "ready"]) || !isIdentifier(value.requestId) || typeof value.ready !== "boolean") {
        return invalid("setReady mal formé");
      }
      return value as unknown as ClientMessage;
    case "submitAction":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId", "turn", "action"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId)
        || !isSafePositiveInteger(value.turn) || !isBattleAction(value.action)) {
        return invalid("submitAction mal formé");
      }
      return value as unknown as ClientMessage;
    case "submitReplacement":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId", "turn", "teamIndex"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId)
        || !isSafePositiveInteger(value.turn) || !Number.isInteger(value.teamIndex)
        || Number(value.teamIndex) < 0 || Number(value.teamIndex) > 5) {
        return invalid("submitReplacement mal formé");
      }
      return value as unknown as ClientMessage;
    case "requestSnapshot":
      if (!hasExactKeys(value, ["type", "version", "requestId"]) || !isIdentifier(value.requestId)) {
        return invalid("requestSnapshot mal formé");
      }
      return value as unknown as ClientMessage;
    case "moveAvatar":
      if (!["type", "version", "requestId", "direction", "sequence"].every((key) => key in value)
        || Object.keys(value).some((key) => !["type", "version", "requestId", "direction", "sequence", "mode", "waterfall"].includes(key))
        || !isIdentifier(value.requestId)
        || !["up", "down", "left", "right"].includes(String(value.direction))
        || value.mode !== undefined && !["walk", "run", "mount", "surf", "dive"].includes(String(value.mode))
        || value.waterfall !== undefined && typeof value.waterfall !== "boolean"
        || !isSafePositiveInteger(value.sequence)) {
        return invalid("moveAvatar mal formé");
      }
      return value as unknown as ClientMessage;
    case "interact":
      if (!hasExactKeys(value, ["type", "version", "requestId"]) || !isIdentifier(value.requestId)) {
        return invalid("interact mal formé");
      }
      return value as unknown as ClientMessage;
    case "setProfile":
      if (!hasExactKeys(value, ["type", "version", "requestId", "profile"]) || !isIdentifier(value.requestId)) {
        return invalid("setProfile mal formé");
      }
      try {
        return { ...value, profile: parseNetworkPlayerProfile(value.profile) } as unknown as ClientMessage;
      } catch {
        return invalid("setProfile mal formé");
      }
    case "setSourceWorld":
      if (!hasExactKeys(value, ["type", "version", "requestId", "world"]) || !isIdentifier(value.requestId)) {
        return invalid("setSourceWorld mal formé");
      }
      try {
        return { ...value, world: parseSourceWorldHostState(value.world) } as unknown as ClientMessage;
      } catch {
        return invalid("setSourceWorld mal formé");
      }
    case "setSourceFollower":
      if (Object.keys(value).some((key) => !["type", "version", "requestId", "species", "appearance"].includes(key))
        || !["type", "version", "requestId", "species"].every((key) => key in value)
        || !isIdentifier(value.requestId)
        || value.species !== null && (typeof value.species !== "string" || !/^[A-Z0-9_]{1,64}$/u.test(value.species))
        || value.appearance !== undefined && (!isRecord(value.appearance)
          || !hasExactKeys(value.appearance, ["form", "shiny", "gender"])
          || !Number.isInteger(value.appearance.form) || Number(value.appearance.form) < 0
          || Number(value.appearance.form) > 999 || typeof value.appearance.shiny !== "boolean"
          || value.appearance.gender !== null
            && !["male", "female", "genderless"].includes(String(value.appearance.gender)))) {
        return invalid("setSourceFollower mal formé");
      }
      return value as unknown as ClientMessage;
    case "challengePlayer":
      if (!hasExactKeys(value, ["type", "version", "requestId", "team"]) || !isIdentifier(value.requestId)
        || !isBattleTeam(value.team)) return invalid("challengePlayer mal forme");
      return value as unknown as ClientMessage;
    case "respondPlayerChallenge":
      if (!hasExactKeys(value, ["type", "version", "requestId", "accept", "team"])
        || !isIdentifier(value.requestId) || typeof value.accept !== "boolean"
        || value.accept && !isBattleTeam(value.team) || !value.accept && value.team !== null) {
        return invalid("respondPlayerChallenge mal forme");
      }
      return value as unknown as ClientMessage;
    case "attemptBattleEscape":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId", "turn"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId) || !isSafePositiveInteger(value.turn)) {
        return invalid("attemptBattleEscape mal formé");
      }
      return value as unknown as ClientMessage;
    case "proposeBattleJoin":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId", "side", "team", "finalMemberIds"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId)
        || !["player", "opponent"].includes(String(value.side)) || !isBattleTeam(value.team)
        || !Array.isArray(value.finalMemberIds) || value.finalMemberIds.length < 1 || value.finalMemberIds.length > 6
        || !value.finalMemberIds.every(isIdentifier)) return invalid("proposeBattleJoin mal forme");
      return value as unknown as ClientMessage;
    case "respondBattleJoin":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId", "accept"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId) || typeof value.accept !== "boolean") {
        return invalid("respondBattleJoin mal forme");
      }
      return value as unknown as ClientMessage;
    case "observeBattle":
    case "closeBattleJoinWindow":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId)) {
        return invalid(`${value.type} mal forme`);
      }
      return value as unknown as ClientMessage;
    case "leaveBattle":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId)) return invalid("leaveBattle mal forme");
      return value as unknown as ClientMessage;
    case "setSourcePresence":
      if (!hasExactKeys(value, ["type", "version", "requestId", "attached", "avatar"])
        || !isIdentifier(value.requestId) || typeof value.attached !== "boolean"
        || value.attached && !isSourceAvatar(value.avatar)
        || !value.attached && value.avatar !== null) {
        return invalid("setSourcePresence mal forme");
      }
      return value as unknown as ClientMessage;
    case "setSourceScene":
      if (!hasExactKeys(value, ["type", "version", "requestId", "scene"]) || !isIdentifier(value.requestId)) {
        return invalid("setSourceScene mal forme");
      }
      try {
        return { ...value, scene: parseSourceSceneSnapshot(value.scene) } as unknown as ClientMessage;
      } catch {
        return invalid("setSourceScene mal forme");
      }
    case "openSourceBattle":
      if (!hasExactKeys(value, ["type", "version", "requestId", "context", "playerTeam", "opponentTeam"])
        || !isIdentifier(value.requestId) || !isBattleTeam(value.playerTeam) || !isBattleTeam(value.opponentTeam)) {
        return invalid("openSourceBattle mal forme");
      }
      try {
        return { ...value, context: parseSourceBattleContext(value.context) } as unknown as ClientMessage;
      } catch {
        return invalid("openSourceBattle mal forme");
      }
    case "ackBattleSettlement":
      if (!hasExactKeys(value, ["type", "version", "requestId", "settlementId"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.settlementId)) {
        return invalid("ackBattleSettlement mal forme");
      }
      return value as unknown as ClientMessage;
    case "closeSourceBattle":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId)) {
        return invalid("closeSourceBattle mal forme");
      }
      return value as unknown as ClientMessage;
    case "ping":
      if (!hasExactKeys(value, ["type", "version", "nonce"]) || !isIdentifier(value.nonce)) return invalid("ping mal formé");
      return value as unknown as ClientMessage;
    default:
      return invalid(`type inconnu ${value.type}`);
  }
}

export function serializeMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}
