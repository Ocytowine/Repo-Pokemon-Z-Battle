import { calculateDamage } from "./damage.js";
import { isKnownType } from "./type-chart.js";
import type { BattleAction, BattleEvent, BattleSide, BattleState, BattleTrace, BattlerState, RandomSource, TurnActions, TurnResult } from "./types.js";

const SIDES = ["player", "opponent"] as const;

function opponentOf(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function cloneBattler(battler: BattlerState): BattlerState {
  return { ...battler, types: [...battler.types], stats: { ...battler.stats }, stages: { ...battler.stages }, moves: battler.moves.map((slot) => ({ ...slot, move: { ...slot.move } })) };
}

function effectiveSpeed(battler: BattlerState): number {
  const stage = battler.stages.speed;
  return stage >= 0
    ? Math.floor((battler.stats.speed * (2 + stage)) / 2)
    : Math.floor((battler.stats.speed * 2) / (2 - stage));
}

function draw(rng: RandomSource, trace: BattleTrace[], purpose: "speed-tie" | "accuracy", maxExclusive: number): number {
  const value = rng.nextInt(maxExclusive);
  trace.push({ type: "rng", purpose, maxExclusive, value });
  return value;
}

function accuracyFactor(stage: number): number {
  return stage >= 0 ? (stage + 3) / 3 : 3 / (3 - stage);
}

function validateState(state: BattleState, actions: TurnActions): void {
  if (state.status !== "active") throw new Error("Cannot resolve a finished battle.");
  for (const side of SIDES) {
    const battler = state.battlers[side];
    if (battler.hp <= 0 || battler.hp > battler.stats.maxHp) throw new Error(`Invalid HP for ${side}.`);
    if (battler.level < 1 || battler.level > 100) throw new Error(`Invalid level for ${side}.`);
    for (const type of battler.types) if (!isKnownType(type)) throw new Error(`Unknown Pokemon Z type: ${type}`);
    const action = actions[side];
    if (!Number.isInteger(action.moveIndex) || action.moveIndex < 0 || action.moveIndex >= battler.moves.length) {
      throw new RangeError(`Invalid move index for ${side}.`);
    }
  }
}

function orderedSides(state: BattleState, actions: TurnActions, rng: RandomSource, trace: BattleTrace[]): BattleSide[] {
  const decorated = SIDES.map((side) => {
    const battler = state.battlers[side];
    const slot = battler.moves[actions[side].moveIndex];
    if (slot === undefined) throw new RangeError(`Invalid move index for ${side}.`);
    const speed = effectiveSpeed(battler);
    trace.push({ type: "order", side, priority: slot.move.priority, speed });
    return { side, priority: slot.move.priority, speed };
  });
  const [player, opponent] = decorated;
  if (player === undefined || opponent === undefined) throw new Error("Battle requires two sides.");
  if (player.priority !== opponent.priority) return player.priority > opponent.priority ? [player.side, opponent.side] : [opponent.side, player.side];
  if (player.speed !== opponent.speed) return player.speed > opponent.speed ? [player.side, opponent.side] : [opponent.side, player.side];
  return draw(rng, trace, "speed-tie", 2) === 0 ? [opponent.side, player.side] : [player.side, opponent.side];
}

function accuracyCheck(side: BattleSide, attacker: BattlerState, defender: BattlerState, accuracy: number, rng: RandomSource, trace: BattleTrace[]): boolean {
  if (accuracy === 0) {
    trace.push({ type: "accuracy", side, base: 0, accuracyStage: attacker.stages.accuracy, evasionStage: defender.stages.evasion, threshold: Number.POSITIVE_INFINITY, hit: true });
    return true;
  }
  const threshold = accuracy * accuracyFactor(attacker.stages.accuracy) / accuracyFactor(defender.stages.evasion);
  const roll = draw(rng, trace, "accuracy", 100);
  const hit = roll < threshold;
  trace.push({ type: "accuracy", side, base: accuracy, accuracyStage: attacker.stages.accuracy, evasionStage: defender.stages.evasion, threshold, hit });
  return hit;
}

export function resolveTurn(state: BattleState, actions: TurnActions, rng: RandomSource): TurnResult {
  validateState(state, actions);
  const battlers: Record<BattleSide, BattlerState> = {
    player: cloneBattler(state.battlers.player),
    opponent: cloneBattler(state.battlers.opponent),
  };
  const events: BattleEvent[] = [{ type: "turnStarted", turn: state.turn }];
  const trace: BattleTrace[] = [];
  const order = orderedSides({ ...state, battlers }, actions, rng, trace);
  events.push({ type: "actionOrdered", order });
  let winner: BattleSide | null = null;

  for (const side of order) {
    const targetSide = opponentOf(side);
    const attacker = battlers[side];
    const defender = battlers[targetSide];
    if (attacker.hp === 0) {
      events.push({ type: "actionSkipped", side, reason: "fainted" });
      continue;
    }
    const action: BattleAction = actions[side];
    const slot = attacker.moves[action.moveIndex];
    if (slot === undefined) throw new RangeError(`Invalid move index for ${side}.`);
    if (slot.pp === 0) {
      events.push({ type: "actionSkipped", side, reason: "no-pp" });
      continue;
    }
    const nextMoves = attacker.moves.map((candidate, index) => index === action.moveIndex ? { ...candidate, pp: candidate.pp - 1 } : candidate);
    battlers[side] = { ...attacker, moves: nextMoves };
    events.push({ type: "moveUsed", side, move: slot.move.internalName });
    events.push({ type: "ppChanged", side, move: slot.move.internalName, pp: slot.pp - 1 });
    if (!accuracyCheck(side, battlers[side], defender, slot.move.accuracy, rng, trace)) {
      events.push({ type: "moveMissed", side, move: slot.move.internalName });
      continue;
    }
    const damage = calculateDamage(side, battlers[side], defender, slot.move, rng, trace);
    const hp = Math.max(0, defender.hp - damage);
    battlers[targetSide] = { ...defender, hp };
    events.push({ type: "damageApplied", source: side, target: targetSide, amount: Math.min(damage, defender.hp), hp });
    if (hp === 0) {
      winner = side;
      events.push({ type: "fainted", side: targetSide });
      events.push({ type: "battleEnded", winner: side });
    }
  }

  events.push({ type: "turnEnded", turn: state.turn });
  return {
    state: { turn: state.turn + 1, status: winner === null ? "active" : "finished", winner, battlers },
    events,
    trace,
  };
}
