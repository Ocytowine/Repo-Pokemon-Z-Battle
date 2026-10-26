import { heldItemIsActive } from "./ability-item-control.js";
import type { BattleSide, BattlerState } from "./types.js";

/** A held item can request a mid-turn replacement only after real HP damage. */
export interface ReactiveHeldSwitchRequest {
  readonly item: "REDCARD" | "EJECTBUTTON";
  readonly holderSide: BattleSide;
  readonly holderId: string;
  readonly displacedSide: BattleSide;
  readonly displacedId: string;
  /** Red Card draws from legal reserves; Eject Button waits for its owner's choice. */
  readonly selection: "random" | "owner";
}

/** The authoritative adapter pauses and asks this holder's owner for a reserve. */
export class ReactiveHeldSwitchChoiceRequired extends Error {
  public constructor(public readonly request: ReactiveHeldSwitchRequest) {
    super(`A replacement choice is required for ${request.holderId}.`);
    this.name = "ReactiveHeldSwitchChoiceRequired";
  }
}

/** Source pbEffectsAfterHit eligibility, shared by single and positioned double battles. */
export function reactiveHeldSwitchRequest(
  attacker: BattlerState, attackerSide: BattleSide,
  defender: BattlerState, defenderSide: BattleSide,
  actualHpDamage: number,
  options: { readonly attackerCanSwitch: boolean; readonly defenderCanSwitch: boolean;
    readonly additionalEffectsSuppressed: boolean; readonly magicRoomTurns?: number },
): ReactiveHeldSwitchRequest | null {
  if (actualHpDamage <= 0 || attacker.hp <= 0 || defender.hp <= 0
    || options.additionalEffectsSuppressed
    || !heldItemIsActive(defender, options.magicRoomTurns ?? 0)) return null;
  if (defender.heldItem === "REDCARD" && options.attackerCanSwitch) return {
    item: "REDCARD", holderSide: defenderSide, holderId: defender.id,
    displacedSide: attackerSide, displacedId: attacker.id, selection: "random",
  };
  if (defender.heldItem === "EJECTBUTTON" && options.defenderCanSwitch) return {
    item: "EJECTBUTTON", holderSide: defenderSide, holderId: defender.id,
    displacedSide: defenderSide, displacedId: defender.id, selection: "owner",
  };
  return null;
}
