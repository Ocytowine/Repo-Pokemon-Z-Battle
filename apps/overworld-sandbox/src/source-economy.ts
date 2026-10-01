import type { SourceEventState } from "./source-event-state.js";
import { SOURCE_MAX_MONEY } from "./source-event-state.js";

export const SOURCE_BAG_SLOT_LIMIT = 999;
export const SOURCE_NO_MONEY_LOSS_SWITCH = 33;
export const SOURCE_BADGE_SWITCHES = [88, 97, 150, 211, 326, 502, 503, 504] as const;
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

export function addSourceMoney(state: SourceEventState, amount: number): SourceEventState {
  if (!Number.isSafeInteger(amount) || amount <= 0) return state;
  return { ...state, money: Math.min(SOURCE_MAX_MONEY, state.money + amount) };
}
