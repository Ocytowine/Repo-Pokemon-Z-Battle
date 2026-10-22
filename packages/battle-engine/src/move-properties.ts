import type { BattleMove, BattlerState } from "./types.js";

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
export function effectiveMoveType(attacker: BattlerState, move: BattleMove): EffectiveMoveType {
  if (attacker.ability === "NORMALIZE") return { type: "NORMAL", abilityBoost: 1.5 };
  if (move.type !== "NORMAL") return { type: move.type, abilityBoost: 1 };
  const ability = attacker.ability;
  if (ability === null || !(ability in NORMAL_TYPE_CONVERSIONS)) return { type: move.type, abilityBoost: 1 };
  return NORMAL_TYPE_CONVERSIONS[ability as keyof typeof NORMAL_TYPE_CONVERSIONS];
}

export function hasMoldBreaker(attacker: BattlerState): boolean {
  return attacker.ability === "MOLDBREAKER" || attacker.ability === "TERAVOLT"
    || attacker.ability === "TURBOBLAZE";
}

/** Shared priority modifiers used by both single and positioned team battles. */
export function effectiveMovePriority(attacker: BattlerState, move: BattleMove): number {
  return move.priority
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
