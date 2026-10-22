import type { BattleStat, BattlerState, ImplementedBattleAbility, MajorStatusState } from "./types.js";

export type StatusProtectionAbility = "IMMUNITY" | "INSOMNIA" | "LIMBER" | "MAGMAARMOR"
  | "PURIFYINGSALT" | "TERMOCONVERSION" | "VITALSPIRIT" | "WATERBUBBLE" | "WATERVEIL";

export function statusProtectionAbility(battler: BattlerState,
  status: MajorStatusState["kind"]): StatusProtectionAbility | null {
  if (battler.ability === "PURIFYINGSALT") return "PURIFYINGSALT";
  if (status === "poison" && battler.ability === "IMMUNITY") return "IMMUNITY";
  if (status === "burn" && battler.ability === "WATERVEIL") return "WATERVEIL";
  if (status === "burn" && battler.ability === "WATERBUBBLE") return "WATERBUBBLE";
  if (status === "burn" && battler.ability === "TERMOCONVERSION") return "TERMOCONVERSION";
  if (status === "paralysis" && battler.ability === "LIMBER") return "LIMBER";
  if (status === "frozen" && battler.ability === "MAGMAARMOR") return "MAGMAARMOR";
  if (status === "sleep" && battler.ability === "INSOMNIA") return "INSOMNIA";
  if (status === "sleep" && battler.ability === "VITALSPIRIT") return "VITALSPIRIT";
  return null;
}

export function statDropProtectionAbility(battler: BattlerState,
  stat: BattleStat): ImplementedBattleAbility | null {
  if (battler.ability === "CLEARBODY") return "CLEARBODY";
  if (battler.ability === "WHITESMOKE") return "WHITESMOKE";
  if (stat === "attack" && battler.ability === "HYPERCUTTER") return "HYPERCUTTER";
  if (stat === "defense" && battler.ability === "BIGPECKS") return "BIGPECKS";
  if (stat === "accuracy" && battler.ability === "KEENEYE") return "KEENEYE";
  return null;
}

export function preventsCriticalHit(battler: BattlerState): boolean {
  return battler.ability === "BATTLEARMOR" || battler.ability === "SHELLARMOR";
}

export function cureStatusBlockedByAbility(battler: BattlerState): {
  readonly battler: BattlerState;
  readonly ability: StatusProtectionAbility;
  readonly status: MajorStatusState["kind"];
} | null {
  const status = battler.majorStatus?.kind;
  if (status === undefined) return null;
  const ability = statusProtectionAbility(battler, status);
  return ability === null ? null : { battler: { ...battler, majorStatus: null }, ability, status };
}
