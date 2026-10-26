import { ReactiveHeldSwitchChoiceRequired, type ReactiveHeldSwitchRequest } from "./reactive-held-switch.js";
import type { RandomSource } from "./types.js";

export interface RecordedBattleRoll {
  readonly maxExclusive: number;
  readonly value: number;
}

export type ReactiveTurnAttempt<T> =
  | { readonly kind: "resolved"; readonly result: T; readonly rolls: readonly RecordedBattleRoll[] }
  | { readonly kind: "choice-required"; readonly request: ReactiveHeldSwitchRequest;
      readonly rolls: readonly RecordedBattleRoll[] };

/** Replay prior draws exactly while the underlying RNG continues after the recorded prefix. */
export function attemptReactiveTurn<T>(source: RandomSource,
  recorded: readonly RecordedBattleRoll[], resolve: (rng: RandomSource) => T): ReactiveTurnAttempt<T> {
  const rolls = [...recorded];
  let cursor = 0;
  const replay: RandomSource = { nextInt(maxExclusive) {
    const prior = rolls[cursor];
    cursor += 1;
    if (prior !== undefined) {
      if (prior.maxExclusive !== maxExclusive) throw new Error("Reactive turn replay diverged.");
      return prior.value;
    }
    const value = source.nextInt(maxExclusive);
    rolls.push({ maxExclusive, value });
    return value;
  } };
  try {
    return { kind: "resolved", result: resolve(replay), rolls };
  } catch (error) {
    if (error instanceof ReactiveHeldSwitchChoiceRequired) return {
      kind: "choice-required", request: error.request, rolls,
    };
    throw error;
  }
}
