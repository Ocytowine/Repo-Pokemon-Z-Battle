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
    + (attacker.ability === "GALEWINGS" && move.type === "FLYING" ? 1 : 0);
}

export function hasMoveFlag(move: BattleMove, flag: string): boolean {
  return move.flags?.includes(flag) === true;
}
