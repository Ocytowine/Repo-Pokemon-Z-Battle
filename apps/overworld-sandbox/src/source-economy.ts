import type { SourceEventState } from "./source-event-state.js";
import type { SourceBattleExperiencePolicy } from "@pokemon-z-battle/multiplayer-protocol";
import { SOURCE_MAX_MONEY } from "./source-event-state.js";

export const SOURCE_BAG_SLOT_LIMIT = 999;
export const SOURCE_NO_MONEY_LOSS_SWITCH = 33;
export const SOURCE_BADGE_SWITCHES = [88, 97, 150, 211, 326, 502, 503, 504] as const;
const SOURCE_EXPERIENCE_CAPS = [{ switchId: null, level: 17 }, { switchId: 88, level: 27 },
  { switchId: 97, level: 36 }, { switchId: 150, level: 42 }, { switchId: 211, level: 50 },
  { switchId: 326, level: 56 }, { switchId: 502, level: 70 }, { switchId: 503, level: 75 },
  { switchId: 504, level: 80 }, { switchId: 505, level: 85 }, { switchId: 506, level: 94 },
  { switchId: 744, level: 100 }] as const;
const DEFEAT_MULTIPLIERS = [8, 16, 24, 36, 48, 60, 80, 100, 120] as const;

export interface SourceShopItem {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly description: string;
  readonly pocket: number;
  readonly price: number;
}

export type SourcePurchaseResult =
  | { readonly ok: true; readonly state: SourceEventState; readonly cost: number }
  | { readonly ok: false; readonly state: SourceEventState; readonly reason: "invalid-quantity" | "insufficient-funds" | "bag-full" };

export function purchaseSourceItem(state: SourceEventState, item: SourceShopItem, quantity: number): SourcePurchaseResult {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(item.price) || item.price < 0) {
    return { ok: false, state, reason: "invalid-quantity" };
  }
  const owned = state.inventory[item.internalName] ?? 0;
  if (owned + quantity > SOURCE_BAG_SLOT_LIMIT) return { ok: false, state, reason: "bag-full" };
  const cost = item.price * quantity;
  if (!Number.isSafeInteger(cost) || cost > state.money) return { ok: false, state, reason: "insufficient-funds" };
  return { ok: true, cost, state: { ...state, money: state.money - cost,
    inventory: { ...state.inventory, [item.internalName]: owned + quantity } } };
}

export function sourceTrainerReward(opponentLevels: readonly number[], baseMoney: number): number {
  const maximumLevel = Math.max(0, ...opponentLevels.filter((level) => Number.isSafeInteger(level) && level > 0));
  if (!Number.isSafeInteger(baseMoney) || baseMoney < 0) return 0;
  return Math.min(SOURCE_MAX_MONEY, maximumLevel * baseMoney);
}

export function sourceBadgeCount(state: SourceEventState): number {
  return SOURCE_BADGE_SWITCHES.filter((id) => state.switches[String(id)] === true).length;
}

export function sourceDefeatLoss(state: SourceEventState): number {
  if (state.switches[String(SOURCE_NO_MONEY_LOSS_SWITCH)] === true) return 0;
  const maximumLevel = Math.max(0, ...state.party.members.map((member) => member.level));
  const multiplier = DEFEAT_MULTIPLIERS[Math.min(DEFEAT_MULTIPLIERS.length - 1, sourceBadgeCount(state))] ?? 0;
  return Math.min(state.money, maximumLevel * multiplier);
}

/** Translates Pokemon Z story switches without exposing the whole save to the room. */
export function sourceBattleExperiencePolicy(state: SourceEventState): SourceBattleExperiencePolicy {
  let levelCap: number = SOURCE_EXPERIENCE_CAPS[0].level;
  for (const entry of SOURCE_EXPERIENCE_CAPS.slice(1)) {
    if (entry.switchId !== null && state.switches[String(entry.switchId)] === true) levelCap = entry.level;
  }
  return { levelCap, experienceDisabled: state.switches["661"] === true,
    boostTenPercent: state.switches["252"] === true, boostTwentyPercent: state.switches["624"] === true };
}

export function addSourceMoney(state: SourceEventState, amount: number): SourceEventState {
  if (!Number.isSafeInteger(amount) || amount <= 0) return state;
  return { ...state, money: Math.min(SOURCE_MAX_MONEY, state.money + amount) };
}
