import { calculateDamage } from "./damage.js";
import { isKnownType } from "./type-chart.js";
import type { BattleEvent, BattleMove, BattleSide, BattleState, BattleStat, BattleTrace, BattlerState, MajorStatusState, MoveAction, RandomSource, TurnActions, TurnResult } from "./types.js";

const SIDES = ["player", "opponent"] as const;

function opponentOf(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function cloneBattler(battler: BattlerState): BattlerState {
  return { ...battler, types: [...battler.types], stats: { ...battler.stats }, stages: { ...battler.stages }, majorStatus: battler.majorStatus === null ? null : { ...battler.majorStatus }, moves: battler.moves.map((slot) => ({ ...slot, move: { ...slot.move } })) };
}

function effectiveSpeed(battler: BattlerState): number {
  const stage = battler.stages.speed;
  const staged = stage >= 0
    ? Math.floor((battler.stats.speed * (2 + stage)) / 2)
    : Math.floor((battler.stats.speed * 2) / (2 - stage));
  if (battler.ability === "QUICKFEET" && battler.majorStatus !== null) return Math.max(1, Math.round(staged * 1.5));
  return battler.majorStatus?.kind === "paralysis" ? Math.max(1, Math.round(staged / 4)) : staged;
}

type RngPurpose = Extract<BattleTrace, { readonly type: "rng" }>["purpose"];

function draw(rng: RandomSource, trace: BattleTrace[], purpose: RngPurpose, maxExclusive: number): number {
  const value = rng.nextInt(maxExclusive);
  trace.push({ type: "rng", purpose, maxExclusive, value });
  return value;
}

function accuracyFactor(stage: number): number {
  return stage >= 0 ? (stage + 3) / 3 : 3 / (3 - stage);
}

type SelectedMoveActions = Readonly<Partial<Record<BattleSide, MoveAction>>>;

function statusKind(move: BattleMove): MajorStatusState["kind"] | null {
  if (move.functionCode === "003") return "sleep";
  if (move.functionCode === "005" || move.functionCode === "006") return "poison";
  if (move.functionCode === "007") return "paralysis";
  if (move.functionCode === "00A") return "burn";
  if (move.functionCode === "00C") return "frozen";
  if (move.functionCode === "159") return "caduco";
  if (move.functionCode === "906") return "hemorrhage";
  return null;
}

interface StatChangeEffect {
  readonly target: "self" | "opponent";
  readonly stat: BattleStat;
  readonly delta: -1 | 1;
}

function statChangeEffect(move: BattleMove): StatChangeEffect | null {
  switch (move.functionCode) {
    case "01C": return { target: "self", stat: "attack", delta: 1 };
    case "01D": return { target: "self", stat: "defense", delta: 1 };
    case "01F": return { target: "self", stat: "speed", delta: 1 };
    case "020": return { target: "self", stat: "specialAttack", delta: 1 };
    case "042": return { target: "opponent", stat: "attack", delta: -1 };
    case "043": return { target: "opponent", stat: "defense", delta: -1 };
    case "044": return { target: "opponent", stat: "speed", delta: -1 };
    case "045": return { target: "opponent", stat: "specialAttack", delta: -1 };
    case "046": return { target: "opponent", stat: "specialDefense", delta: -1 };
    case "047": return { target: "opponent", stat: "accuracy", delta: -1 };
    default: return null;
  }
}

function applyStatChange(
  source: BattleSide,
  opponent: BattleSide,
  effect: StatChangeEffect,
  battlers: Record<BattleSide, BattlerState>,
  events: BattleEvent[],
): void {
  const target = effect.target === "self" ? source : opponent;
  const battler = battlers[target];
  const current = battler.stages[effect.stat];
  const delta = battler.ability === "SIMPLE" ? effect.delta * 2 : effect.delta;
  const stage = Math.max(-6, Math.min(6, current + delta));
  if (stage === current) {
    events.push({ type: "statStageChangeFailed", source, target, stat: effect.stat, reason: "limit" });
    return;
  }
  battlers[target] = { ...battler, stages: { ...battler.stages, [effect.stat]: stage } };
  events.push({ type: "statStageChanged", source, target, stat: effect.stat, delta: stage - current, stage });
}

function applyMoveEffect(
  source: BattleSide,
  target: BattleSide,
  move: BattleMove,
  battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource,
  events: BattleEvent[],
  trace: BattleTrace[],
): void {
  const change = statChangeEffect(move);
  if (change !== null) {
    applyStatChange(source, target, change, battlers, events);
    return;
  }
  if (statusKind(move) !== null) {
    applyStatusMove(source, target, move, battlers, rng, events, trace);
    return;
  }
  throw new Error(`Unsupported move function: ${move.functionCode}.`);
}

function typePreventsStatus(battler: BattlerState, status: MajorStatusState["kind"]): boolean {
  if (status === "poison") return battler.types.includes("POISON") || battler.types.includes("STEEL");
  if (status === "burn") return battler.types.includes("FIRE");
  if (status === "paralysis") return battler.types.includes("ELECTRIC");
  if (status === "frozen") return battler.types.includes("ICE");
  if (status === "caduco" || status === "hemorrhage") return battler.types.includes("FIRE");
  return false;
}

function applyStatusMove(
  source: BattleSide,
  target: BattleSide,
  move: BattleMove,
  battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource,
  events: BattleEvent[],
  trace: BattleTrace[],
): void {
  const kind = statusKind(move);
  if (kind === null) throw new Error(`Unsupported status move function: ${move.functionCode}.`);
  const defender = battlers[target];
  if (defender.majorStatus !== null) {
    events.push({ type: "statusApplicationFailed", source, target, status: kind, reason: "already-status" });
    return;
  }
  if (typePreventsStatus(defender, kind)) {
    events.push({ type: "statusApplicationFailed", source, target, status: kind, reason: "type-immune" });
    return;
  }
  const majorStatus: MajorStatusState = kind === "sleep"
    ? { kind, turnsRemaining: 2 + draw(rng, trace, "sleep-duration", 3) }
    : kind === "poison"
      ? { kind, toxicCounter: move.functionCode === "006" ? 0 : null }
      : { kind };
  battlers[target] = { ...defender, majorStatus };
  events.push({ type: "statusApplied", source, target, status: kind });
}

function canAct(
  side: BattleSide,
  battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource,
  events: BattleEvent[],
  trace: BattleTrace[],
): boolean {
  const battler = battlers[side];
  const status = battler.majorStatus;
  if (status?.kind === "sleep") {
    const turnsRemaining = status.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      battlers[side] = { ...battler, majorStatus: null };
      events.push({ type: "statusCured", side, status: "sleep" });
      return true;
    }
    battlers[side] = { ...battler, majorStatus: { kind: "sleep", turnsRemaining } };
    events.push({ type: "statusContinued", side, status: "sleep" });
    events.push({ type: "actionSkipped", side, reason: "sleep" });
    return false;
  }
  if (status?.kind === "paralysis" && draw(rng, trace, "paralysis", 4) === 0) {
    events.push({ type: "statusContinued", side, status: "paralysis" });
    events.push({ type: "actionSkipped", side, reason: "paralysis" });
    return false;
  }
  return true;
}

function applyResidualStatus(
  battlers: Record<BattleSide, BattlerState>,
  events: BattleEvent[],
): BattleSide | null {
  for (const side of SIDES) {
    const battler = battlers[side];
    const status = battler.majorStatus;
    if (battler.hp === 0) continue;
    if (status?.kind !== "poison" && status?.kind !== "burn" && status?.kind !== "frozen") {
      if (status?.kind === "hemorrhage" || (status?.kind === "caduco" && battler.hp <= Math.floor(battler.stats.maxHp / 2))) {
        events.push({ type: "statusContinued", side, status: status.kind });
      }
      continue;
    }
    if (battler.ability === "MAGICGUARD") {
      events.push({ type: "statusContinued", side, status: status.kind });
      continue;
    }
    const nextStatus = status.kind === "poison" && status.toxicCounter !== null
      ? { kind: "poison" as const, toxicCounter: Math.min(15, status.toxicCounter + 1) }
      : status;
    const rawDamage = nextStatus.kind === "burn" || nextStatus.kind === "frozen"
      ? Math.floor(battler.stats.maxHp / 16)
      : nextStatus.toxicCounter === null
        ? Math.floor(battler.stats.maxHp / 12)
        : Math.floor((battler.stats.maxHp * nextStatus.toxicCounter) / 16);
    const amount = Math.min(battler.hp, Math.max(1, rawDamage));
    const hp = battler.hp - amount;
    battlers[side] = { ...battler, hp, majorStatus: nextStatus };
    events.push({ type: "statusDamage", side, status: nextStatus.kind, amount, hp });
    if (hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side });
      events.push({ type: "battleEnded", winner });
      return winner;
    }
  }
  return null;
}

function applyHeldItems(
  battlers: Record<BattleSide, BattlerState>,
  events: BattleEvent[],
): BattleSide | null {
  for (const side of SIDES) {
    const battler = battlers[side];
    if (battler.hp === 0) continue;
    const heals = battler.heldItem === "LEFTOVERS"
      || (battler.heldItem === "BLACKSLUDGE" && battler.types.includes("POISON"));
    if (heals && battler.hp < battler.stats.maxHp) {
      const amount = Math.min(battler.stats.maxHp - battler.hp, Math.max(1, Math.floor(battler.stats.maxHp / 16)));
      const hp = battler.hp + amount;
      battlers[side] = { ...battler, hp };
      events.push({ type: "itemActivated", side, item: battler.heldItem as "LEFTOVERS" | "BLACKSLUDGE", effect: "heal", amount, hp });
    } else if (battler.heldItem === "BLACKSLUDGE" && battler.ability !== "MAGICGUARD") {
      const amount = Math.min(battler.hp, Math.max(1, Math.floor(battler.stats.maxHp / 8)));
      const hp = battler.hp - amount;
      battlers[side] = { ...battler, hp };
      events.push({ type: "itemActivated", side, item: "BLACKSLUDGE", effect: "damage", amount, hp });
      if (hp === 0) {
        const winner = opponentOf(side);
        events.push({ type: "fainted", side });
        events.push({ type: "battleEnded", winner });
        return winner;
      }
    }
  }
  return null;
}

function validateState(state: BattleState, actions: SelectedMoveActions): void {
  if (state.status !== "active") throw new Error("Cannot resolve a finished battle.");
  for (const side of SIDES) {
    const battler = state.battlers[side];
    if (battler.hp <= 0 || battler.hp > battler.stats.maxHp) throw new Error(`Invalid HP for ${side}.`);
    if (battler.level < 1 || battler.level > 100) throw new Error(`Invalid level for ${side}.`);
    if (battler.majorStatus?.kind === "sleep" && (!Number.isInteger(battler.majorStatus.turnsRemaining) || battler.majorStatus.turnsRemaining < 1)) {
      throw new Error(`Invalid sleep duration for ${side}.`);
    }
    if (battler.majorStatus?.kind === "poison" && battler.majorStatus.toxicCounter !== null
      && (!Number.isInteger(battler.majorStatus.toxicCounter) || battler.majorStatus.toxicCounter < 0 || battler.majorStatus.toxicCounter > 15)) {
      throw new Error(`Invalid toxic counter for ${side}.`);
    }
    for (const type of battler.types) if (!isKnownType(type)) throw new Error(`Unknown Pokemon Z type: ${type}`);
    const action = actions[side];
    if (action !== undefined && (!Number.isInteger(action.moveIndex) || action.moveIndex < 0 || action.moveIndex >= battler.moves.length)) {
      throw new RangeError(`Invalid move index for ${side}.`);
    }
  }
}

function orderedSides(state: BattleState, actions: SelectedMoveActions, rng: RandomSource, trace: BattleTrace[]): BattleSide[] {
  const decorated = SIDES.filter((side) => actions[side] !== undefined).map((side) => {
    const battler = state.battlers[side];
    const action = actions[side];
    if (action === undefined) throw new Error(`Missing selected action for ${side}.`);
    const slot = battler.moves[action.moveIndex];
    if (slot === undefined) throw new RangeError(`Invalid move index for ${side}.`);
    const speed = effectiveSpeed(battler);
    trace.push({ type: "order", side, priority: slot.move.priority, speed });
    return { side, priority: slot.move.priority, speed };
  });
  if (decorated.length === 0) return [];
  const only = decorated[0];
  if (decorated.length === 1 && only !== undefined) return [only.side];
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

export function resolveSelectedMoves(state: BattleState, actions: SelectedMoveActions, rng: RandomSource): TurnResult {
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
    let attacker = battlers[side];
    const defender = battlers[targetSide];
    if (attacker.hp === 0) {
      events.push({ type: "actionSkipped", side, reason: "fainted" });
      continue;
    }
    if (!canAct(side, battlers, rng, events, trace)) continue;
    attacker = battlers[side];
    const action = actions[side];
    if (action === undefined) throw new Error(`Missing selected action for ${side}.`);
    const slot = attacker.moves[action.moveIndex];
    if (slot === undefined) throw new RangeError(`Invalid move index for ${side}.`);
    if (slot.pp === 0) {
      events.push({ type: "actionSkipped", side, reason: "no-pp" });
      continue;
    }
    if (attacker.heldItem === "ASSAULTVEST" && slot.move.category === "Status") {
      events.push({ type: "actionSkipped", side, reason: "item-blocked" });
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
    if (slot.move.category === "Status") {
      applyMoveEffect(side, targetSide, slot.move, battlers, rng, events, trace);
      continue;
    }
    const traceStart = trace.length;
    const damage = calculateDamage(side, battlers[side], defender, slot.move, rng, trace);
    const damageTrace = trace.slice(traceStart).find((entry) => entry.type === "damage");
    if (damageTrace === undefined) throw new Error("Damage calculation did not emit its trace.");
    const hp = Math.max(0, defender.hp - damage);
    battlers[targetSide] = { ...defender, hp };
    events.push({
      type: "damageApplied", source: side, target: targetSide,
      amount: Math.min(damage, defender.hp), hp,
      critical: damageTrace.critical, effectiveness: damageTrace.effectiveness,
    });
    if (hp > 0 && slot.move.effectChance > 0
      && draw(rng, trace, "additional-effect", 100) < slot.move.effectChance) {
      applyMoveEffect(side, targetSide, slot.move, battlers, rng, events, trace);
    }
    if (hp === 0) {
      winner = side;
      events.push({ type: "fainted", side: targetSide });
      events.push({ type: "battleEnded", winner: side });
    }
  }

  if (winner === null) winner = applyResidualStatus(battlers, events);
  if (winner === null) winner = applyHeldItems(battlers, events);

  events.push({ type: "turnEnded", turn: state.turn });
  return {
    state: { turn: state.turn + 1, status: winner === null ? "active" : "finished", winner, battlers },
    events,
    trace,
  };
}

export function resolveTurn(state: BattleState, actions: TurnActions, rng: RandomSource): TurnResult {
  if (actions.player === undefined || actions.opponent === undefined) {
    throw new Error("Both sides must select a move action.");
  }
  return resolveSelectedMoves(state, actions, rng);
}
