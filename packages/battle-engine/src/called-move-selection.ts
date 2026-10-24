import { isMoveFunctionSupported } from "./move-function-support.js";
import type { BattleMove, BattleTrace, BattlerState, RandomSource } from "./types.js";

const TWO_TURN = ["0C3", "0C4", "0C5", "0C6", "0C7", "0C8", "0C9", "0CA", "0CB", "0CC", "0CD", "0CE", "14D", "14E"];
const SLEEP_TALK_EXCLUDED = new Set([
  "002", "014", "05C", "05D", "0AE", "0AF", "0B0", "0B3", "0B4", "0B5", "0B6", "0D1", "0D4", "115",
  ...TWO_TURN,
]);
const ASSIST_EXCLUDED = new Set([
  "002", "014", "05C", "05D", "069", "071", "072", "073", "09C", "0AA", "0AD", "0AE", "0AF",
  "0B0", "0B2", "0B3", "0B4", "0B5", "0B6", "0CD", "0E7", "0E8", "0EB", "0EC", "0F1", "0F2",
  "0F3", "115", "117", "149", "14B", "14C", "14D", "158", ...TWO_TURN,
]);

function choose(candidates: readonly BattleMove[], rng: RandomSource, trace: BattleTrace[]): BattleMove | null {
  if (candidates.length === 0) return null;
  const value = rng.nextInt(candidates.length);
  trace.push({ type: "rng", purpose: "called-move", maxExclusive: candidates.length, value });
  return candidates[value] ?? null;
}

/** Only battle-ready moves may be called; the admission pipeline rejects unported party moves. */
export function sleepTalkMoveFrom(user: BattlerState, rng: RandomSource, trace: BattleTrace[]): BattleMove | null {
  if (user.majorStatus?.kind !== "sleep") return null;
  return choose(user.moves.filter((slot) => slot.pp > 0
    && !SLEEP_TALK_EXCLUDED.has(slot.move.functionCode)
    && isMoveFunctionSupported(slot.move.functionCode)
    && !(user.volatile?.disableTurns && user.volatile.disabledMove === slot.move.internalName))
    .map((slot) => slot.move), rng, trace);
}

export function assistMoveFrom(user: BattlerState, party: readonly BattlerState[], rng: RandomSource,
  trace: BattleTrace[]): BattleMove | null {
  return choose(party.filter((member) => member.id !== user.id)
    .flatMap((member) => member.moves.map((slot) => slot.move))
    .filter((move) => move.type !== "SHADOW" && !ASSIST_EXCLUDED.has(move.functionCode)
      && isMoveFunctionSupported(move.functionCode)), rng, trace);
}
