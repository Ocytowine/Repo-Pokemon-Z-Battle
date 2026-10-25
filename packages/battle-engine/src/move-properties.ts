import type { BattleEffects, BattleMove, BattlerState, MoveCategory } from "./types.js";
import { heldItemIsActive } from "./ability-item-control.js";
import { DRIVE_TYPES, PLATE_TYPES } from "./held-item-types.js";
import { naturalGiftProfile } from "./natural-gift.js";

const RECOIL_DIVISORS: Readonly<Partial<Record<BattleMove["functionCode"], number>>> = {
  "0FA": 4,
  "0FB": 3,
  "0FC": 2,
  "0FD": 3,
  "0FE": 3,
};

export function recoilDivisor(move: BattleMove): number | null {
  return RECOIL_DIVISORS[move.functionCode] ?? null;
}

export function isRecklessBoostedMove(move: BattleMove): boolean {
  return recoilDivisor(move) !== null || move.functionCode === "10B";
}

/** Pokemon Z PBTargets codes whose only target is the user. */
export function moveTargetsUser(move: BattleMove): boolean {
  const code = (move.targetCode ?? "00").toUpperCase().replace(/^0X/u, "");
  return ["01", "10", "20", "40", "80"].includes(code);
}

/** Mirror Move copies only the target's last move with the source `e` flag. */
export function mirrorMoveFrom(target: BattlerState | undefined): BattleMove | null {
  const move = target?.volatile?.lastUsedMove;
  return move?.flags?.includes("e") === true && move.functionCode !== "0AE" ? move : null;
}

const COPYCAT_EXCLUDED = new Set([
  "069", "071", "072", "073", "09C", "0AA", "0AD", "0B2", "0E7", "0E8", "0EB", "0EC",
  "0F1", "0F2", "0F3", "115", "117", "158", "0C3", "0C4", "0C5", "0C6", "0C7",
  "0C8", "0C9", "0CA", "0CB", "0CC", "0CD", "0CE", "14D", "14E",
]);

export function copycatMoveFrom(effects: BattleEffects | undefined): BattleMove | null {
  const move = effects?.lastMoveUsed;
  return move !== undefined && move !== null && !COPYCAT_EXCLUDED.has(move.functionCode) ? move : null;
}

const ME_FIRST_EXCLUDED = new Set(["002", "014", "071", "072", "073", "0B0", "0F1", "115", "158"]);

export function meFirstMoveFrom(move: BattleMove | undefined, alreadyMoved: boolean): BattleMove | null {
  return move !== undefined && !alreadyMoved && move.category !== "Status"
    && !ME_FIRST_EXCLUDED.has(move.functionCode) ? move : null;
}

/** Exact Pokemon Z `isCuttingMove?` catalogue. Kept in the shared move-property layer. */
const CUTTING_MOVES = new Set([
  "AIRCUTTER", "RAZORSHELL", "CUT", "FURYCUTTER", "SOLARBLADE", "SLASH", "SHADOWCLAW",
  "SACREDSWORD", "AERIALACE", "RAZORLEAF", "LEAFBLADE", "PSYCHOCUT", "TAJOACUATICO",
  "AIRSLASH", "XSCISSOR", "ESPADASEDOSA", "CROSSPOISON", "SABLEARDIENTE", "TACHYONCUTTER",
  "SECRETSWORD", "KOWTOWCLEAVE",
]);

export function isCuttingMove(move: BattleMove): boolean {
  return CUTTING_MOVES.has(move.internalName);
}

/** Exact Pokemon Z `isKickingMove?` catalogue, shared by damage and audit tests. */
const KICKING_MOVES = new Set([
  "MEGAKICK", "LOWKICK", "ROLLINGKICK", "JUMPKICK", "HIJUMPKICK", "DOUBLEKICK",
  "TRIPLEKICK", "BLAZEKICK", "TROPKICK", "TRIPLEAXEL",
]);

export function isKickingMove(move: BattleMove): boolean {
  return KICKING_MOVES.has(move.internalName);
}

/** Pokemon Z move flags: h = high critical rate, k = sound, n = bomb/projectile. */
export function hasHighCriticalRate(move: BattleMove): boolean {
  return hasMoveFlag(move, "h");
}

export function isSoundMove(move: BattleMove): boolean {
  return hasMoveFlag(move, "k");
}

export function isBombMove(move: BattleMove): boolean {
  return hasMoveFlag(move, "n");
}

/** Exact Pokemon Z `isWindMove?` catalogue, shared by Wind Rider and Wind Power. */
const WIND_MOVES = new Set([
  "AIRCUTTER", "TWISTER", "HEATWAVE", "SANDSTORM", "PETALBLIZZARD", "GUST", "HURRICANE",
  "BLIZZARD", "TAILWIND", "FAIRYWIND", "ICYWIND", "SILVERWIND", "OMINOUSWIND", "AIRSLASH",
  "AEROBLAST", "LEAFTORNADO",
]);

export function isWindMove(move: BattleMove): boolean {
  return WIND_MOVES.has(move.internalName);
}

const NORMAL_TYPE_CONVERSIONS = {
  AERILATE: { type: "FLYING", abilityBoost: 1.2 },
  COLEOPTERO: { type: "BUG", abilityBoost: 1.2 },
  LIQUIDVOICE: { type: "WATER", abilityBoost: 1.2 },
  PIELELECTRICA: { type: "ELECTRIC", abilityBoost: 1.2 },
  PIELHERBACEA: { type: "GRASS", abilityBoost: 1.2 },
  PIELHELADA: { type: "ICE", abilityBoost: 1.2 },
  PIELMALDITA: { type: "GHOST", abilityBoost: 1.2 },
  PIXILATE: { type: "FAIRY", abilityBoost: 1.2 },
  TINTINEO: { type: "PSYCHIC", abilityBoost: 1 },
  VOZVALQUIRIA: { type: "ICE", abilityBoost: 1 },
} as const;

export interface EffectiveMoveType {
  readonly type: string;
  readonly abilityBoost: number;
}

/** Mirrors Pokemon Z's pbModifyType order, including its broad Liquid Voice branch. */
export function effectiveMoveType(attacker: BattlerState, move: BattleMove,
  weather?: BattleEffects["weather"], magicRoomTurns = 0): EffectiveMoveType {
  if (move.functionCode === "002") return { type: "TYPELESS", abilityBoost: 1 };
  if (move.functionCode === "096") return { type: naturalGiftProfile(attacker.heldItem)?.type ?? "NORMAL",
    abilityBoost: 1 };
  // The source move class replaces the base type before ability conversions.
  if (move.functionCode === "09F") {
    const item = heldItemIsActive(attacker, magicRoomTurns) ? attacker.heldItem : null;
    return { type: move.internalName === "JUDGMENT" && item !== "TABLANEUTRA"
      ? PLATE_TYPES[item ?? ""] ?? "NORMAL"
      : move.internalName === "TECHNOBLAST" ? DRIVE_TYPES[item ?? ""] ?? "NORMAL"
        : "NORMAL", abilityBoost: 1 };
  }
  // 090 also overrides pbModifyType without calling Normal-type ability conversions.
  if (move.functionCode === "090") {
    if (attacker.hiddenPowerType === undefined) throw new Error("Hidden Power requires a derived type on the battler.");
    return { type: attacker.hiddenPowerType, abilityBoost: 1 };
  }
  // 087 overrides pbModifyType in Ruby without calling the base ability conversions.
  if (move.functionCode === "087") return { type: weather === "sun" || weather === "harsh-sun" ? "FIRE"
    : weather === "rain" || weather === "heavy-rain" ? "WATER"
      : weather === "sand" ? "ROCK" : weather === "hail" ? "ICE" : "NORMAL", abilityBoost: 1 };
  if (attacker.ability === "NORMALIZE") return { type: "NORMAL", abilityBoost: 1.5 };
  if (move.type !== "NORMAL") return { type: move.type, abilityBoost: 1 };
  const ability = attacker.ability;
  if (ability === null || !(ability in NORMAL_TYPE_CONVERSIONS)) return { type: move.type, abilityBoost: 1 };
  return NORMAL_TYPE_CONVERSIONS[ability as keyof typeof NORMAL_TYPE_CONVERSIONS];
}

/** Pokemon Z 090 compares raw Attack/Sp. Attack plus their stage integers, not staged stats. */
export function effectiveMoveCategory(attacker: BattlerState, move: BattleMove): MoveCategory {
  return move.functionCode === "090" || move.functionCode === "1001"
    ? attacker.stats.attack + attacker.stages.attack > attacker.stats.specialAttack + attacker.stages.specialAttack
      ? "Physical" : "Special"
    : move.category;
}

export function hasMoldBreaker(attacker: BattlerState): boolean {
  return attacker.ability === "MOLDBREAKER" || attacker.ability === "TERAVOLT"
    || attacker.ability === "TURBOBLAZE";
}

/** Shared priority modifiers used by both single and positioned team battles. */
export function effectiveMovePriority(attacker: BattlerState, move: BattleMove,
  terrain?: BattleEffects["terrain"]): number {
  return move.priority
    + (move.functionCode === "211" && terrain === "grassy" ? 1 : 0)
    + (move.functionCode === "208" && terrain === "misty" ? 1 : 0)
    + (attacker.ability === "PRANKSTER" && move.category === "Status" ? 1 : 0)
    + (attacker.ability === "GALEWINGS" && move.type === "FLYING" ? 1 : 0)
    + (attacker.ability === "TRIAGE" && isTriageMove(move) ? 3 : 0);
}

/** Every Pokemon Z move class that overrides `isHealingMove?`. */
const HEALING_FUNCTION_CODES = new Set([
  "0D5", "0D6", "0D7", "0D8", "0D9", "0DA", "0DB", "0DD", "0DE", "0DF",
  "0E3", "0E4", "114", "14F", "902",
]);

/** Triage exclusions hard-coded by Pokemon Z after its generic healing classification. */
const TRIAGE_EXCLUSIONS = new Set([
  "AQUARING", "GRASSYTERRAIN", "INGRAIN", "LEECHSEED", "PAINSPLIT", "PRESENT",
]);

export function isHealingMove(move: BattleMove): boolean {
  return HEALING_FUNCTION_CODES.has(move.functionCode);
}

export function isTriageMove(move: BattleMove): boolean {
  return isHealingMove(move) && !TRIAGE_EXCLUSIONS.has(move.internalName);
}

export function hasMoveFlag(move: BattleMove, flag: string): boolean {
  return move.flags?.includes(flag) === true;
}
