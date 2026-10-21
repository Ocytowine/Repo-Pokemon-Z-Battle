import { statDropProtectionAbility } from "./ability-protection.js";
import { applyOpposingStatDropReaction } from "./ability-stat-reactions.js";
import { typeEffectiveness } from "./type-chart.js";
import type { BattleEvent, BattleSide, BattleStat, BattleTrace, BattlerState, RandomSource } from "./types.js";

export interface EntryOpponent {
  readonly side: BattleSide;
  readonly battler: BattlerState;
}

const TRACE_EXCLUSIONS = new Set(["TRACE", "MULTITYPE", "ILLUSION", "DISGUISE", "FLOWERGIFT", "IMPOSTER", "STANCECHANGE"]);
const FOREWARN_160 = new Set(["070"]);
const FOREWARN_150 = new Set(["08B"]);
const FOREWARN_120 = new Set(["071", "072", "073"]);
const FOREWARN_80 = new Set(["06A", "06B", "06D", "06E", "06F", "089", "08A", "08C", "08D", "090", "096", "097", "098", "09A"]);

function draw(rng: RandomSource, trace: BattleTrace[], maxExclusive: number): number {
  const value = rng.nextInt(maxExclusive);
  trace.push({ type: "rng", purpose: "ability", maxExclusive, value });
  return value;
}

function forewarnPower(move: BattlerState["moves"][number]["move"]): number {
  const code = move.functionCode as string;
  return FOREWARN_160.has(code) ? 160 : FOREWARN_150.has(code) ? 150 : FOREWARN_120.has(code) ? 120
    : FOREWARN_80.has(code) ? 80 : move.power;
}

function entryVolatile(battler: BattlerState): NonNullable<BattlerState["volatile"]> {
  return { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
    ...(battler.volatile ?? {}), entryAbilityResolved: true };
}

export function resolveEntryAbility(side: BattleSide, battler: BattlerState, opponents: readonly EntryOpponent[],
  rng: RandomSource, trace: BattleTrace[], informationEnabled = side === "player",
): { readonly battler: BattlerState; readonly opponents: readonly EntryOpponent[]; readonly events: readonly BattleEvent[] } {
  if (battler.hp <= 0 || battler.volatile?.entryAbilityResolved === true) return { battler, opponents, events: [] };
  let actor: BattlerState = { ...battler, volatile: entryVolatile(battler) };
  let targets = opponents.map((entry) => ({ ...entry }));
  const events: BattleEvent[] = [];

  if (actor.ability === "PRESSURE") {
    events.push({ type: "abilityActivated", side, ability: "PRESSURE", effect: "pressure" });
  }

  if (actor.ability === "TRACE") {
    const candidates = targets.filter(({ battler: target }) => target.hp > 0 && target.ability !== null
      && !TRACE_EXCLUSIONS.has(target.ability));
    if (candidates.length > 0) {
      const selected = candidates[draw(rng, trace, candidates.length)]!;
      actor = { ...actor, ability: selected.battler.ability,
        volatile: { ...actor.volatile!, traceOriginalAbility: "TRACE" } };
      events.push({ type: "abilityObserved", side, ability: "TRACE", observation: {
        kind: "copied-ability", targetId: selected.battler.id, ability: selected.battler.ability!,
      } });
    }
  }

  if (actor.ability === "DOWNLOAD") {
    const livingTargets = targets.filter(({ battler: target }) => target.hp > 0);
    const defense = livingTargets.reduce((total, { battler: target }) => total + target.stats.defense, 0);
    // Pokemon Z relit par erreur la Défense Spéciale du premier adversaire en double ; preserve this source quirk.
    const specialDefense = livingTargets.length > 1
      ? livingTargets[0]!.battler.stats.specialDefense * livingTargets.length
      : livingTargets.reduce((total, { battler: target }) => total + target.stats.specialDefense, 0);
    const stat = specialDefense > defense ? "attack" as const : "specialAttack" as const;
    const stage = Math.min(6, actor.stages[stat] + 1);
    if (stage !== actor.stages[stat]) {
      actor = { ...actor, stages: { ...actor.stages, [stat]: stage } };
      events.push({ type: "abilityActivated", side, ability: "DOWNLOAD", effect: "raise-stat" },
        { type: "statStageChanged", source: side, target: side, stat, delta: 1, stage });
    }
  } else if (actor.ability === "INTIMIDATE" || actor.ability === "ESPANTO" || actor.ability === "ILLUMINATE") {
    const ability = actor.ability as "INTIMIDATE" | "ESPANTO" | "ILLUMINATE";
    const stat: BattleStat = ability === "INTIMIDATE" ? "attack"
      : ability === "ESPANTO" ? "specialAttack" : "accuracy";
    const effect = ability === "INTIMIDATE" ? "lower-attack" as const
      : ability === "ESPANTO" ? "lower-special-attack" as const : "lower-accuracy" as const;
    events.push({ type: "abilityActivated", side, ability, effect });
    targets = targets.map((entry) => {
      if (entry.battler.hp <= 0) return entry;
      const protection = statDropProtectionAbility(entry.battler, stat);
      if (protection !== null) {
        events.push({ type: "abilityActivated", side: entry.side, ability: protection, effect: "prevent-stat-drop" });
        return entry;
      }
      const delta = entry.battler.ability === "SIMPLE" ? -2 : -1;
      const stage = Math.max(-6, entry.battler.stages[stat] + delta);
      if (stage === entry.battler.stages[stat]) return entry;
      let updated = { ...entry.battler, stages: { ...entry.battler.stages, [stat]: stage } };
      events.push({ type: "statStageChanged", source: side, target: entry.side, stat,
        delta: stage - entry.battler.stages[stat], stage });
      const reaction = applyOpposingStatDropReaction(updated);
      if (reaction !== null) {
        updated = reaction.battler;
        events.push({ type: "abilityActivated", side: entry.side, ability: reaction.ability, effect: "raise-stat" },
          { type: "statStageChanged", source: entry.side, target: entry.side, stat: reaction.change.stat,
            delta: reaction.change.delta, stage: reaction.change.stage });
      }
      return { ...entry, battler: updated };
    });
  }

  if (informationEnabled && actor.ability === "FRISK") {
    for (const { battler: target } of targets) if (target.hp > 0 && target.heldItem !== null) {
      events.push({ type: "abilityObserved", side, ability: "FRISK", observation: {
        kind: "held-item", targetId: target.id, item: target.heldItem,
      } });
    }
  } else if (informationEnabled && actor.ability === "ANTICIPATION") {
    const dangerous = targets.some(({ battler: target }) => target.hp > 0 && target.moves.some(({ move }) => {
      const effectiveness = typeEffectiveness(move.type, actor.types);
      return (move.power > 0 && effectiveness > 1) || (move.functionCode as string) === "070" && effectiveness > 0;
    }));
    if (dangerous) events.push({ type: "abilityObserved", side, ability: "ANTICIPATION", observation: { kind: "danger" } });
  } else if (informationEnabled && actor.ability === "FOREWARN") {
    const moves = targets.flatMap(({ battler: target }) => target.hp > 0
      ? target.moves.map(({ move }) => ({ targetId: target.id, move })) : []);
    if (moves.length > 0) {
      const maximum = Math.max(...moves.map(({ move }) => forewarnPower(move)));
      const candidates = moves.filter(({ move }) => forewarnPower(move) === maximum);
      const selected = candidates[draw(rng, trace, candidates.length)]!;
      events.push({ type: "abilityObserved", side, ability: "FOREWARN", observation: {
        kind: "move", targetId: selected.targetId, move: selected.move.internalName,
      } });
    }
  }
  return { battler: actor, opponents: targets, events };
}
