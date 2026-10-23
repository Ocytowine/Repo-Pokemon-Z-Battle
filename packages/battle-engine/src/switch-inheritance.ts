import type { BattlerState } from "./types.js";
import { volatileOf } from "./resolve-turn.js";

/** Effects carried by the outgoing battler into its selected replacement. */
export function inheritSwitchEffects(outgoing: BattlerState, incoming: BattlerState): BattlerState {
  const wish = outgoing.volatile?.wishTurns && outgoing.volatile.wishTurns > 0
    ? { wishTurns: outgoing.volatile.wishTurns, wishAmount: outgoing.volatile.wishAmount ?? 0,
      wishMaker: outgoing.volatile.wishMaker ?? null } : {};
  if (outgoing.volatile?.healingWish || outgoing.volatile?.lunarDance) {
    return { ...incoming, hp: incoming.stats.maxHp, majorStatus: null,
      moves: outgoing.volatile.lunarDance
        ? incoming.moves.map((slot) => ({ ...slot, pp: slot.move.pp })) : incoming.moves,
      ...(Object.keys(wish).length === 0 ? {} : { volatile: { ...volatileOf(incoming), ...wish } }) };
  }
  if (outgoing.volatile?.batonPass) {
    return { ...incoming, stages: { ...outgoing.stages }, volatile: {
      ...volatileOf(incoming), ...Object.fromEntries(Object.entries(outgoing.volatile)
        .filter(([key]) => ["confusionTurns", "substituteHp", "leechSeededBy", "leechSeededBySlot",
          "meanLookBy", "perishTurns", "perishSource", "cursed", "aquaRing", "ingrain"].includes(key))),
      ...wish,
      batonPass: false } };
  }
  return Object.keys(wish).length === 0 ? incoming
    : { ...incoming, volatile: { ...volatileOf(incoming), ...wish } };
}

export function releaseSwitchTraps(outgoing: BattlerState, opponent: BattlerState): BattlerState {
  if (opponent.volatile?.meanLookBy !== outgoing.id) return opponent;
  return { ...opponent, volatile: { ...opponent.volatile, meanLookBy: null } };
}
