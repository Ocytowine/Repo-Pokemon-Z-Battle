import { resolveBattlePassiveEndOfTurn, resolveBattleVolatileEndOfTurn, resolveSelectedMoves } from "./resolve-turn.js";
import { applyPokemonItemEffect, type PokemonItemUsePolicy } from "./pokemon-item.js";
import { attemptPokemonCapture } from "./pokemon-capture.js";
import { initializeMegaEvolutionState, resolveMegaEvolutionIntents } from "./mega-evolution.js";
import type {
  BattleEvent, BattlePosition, BattleSide, BattleState, BattleTeam, BattlerState, DoubleBattleEvent,
  DoubleTurnResult, PositionedTeamBattleAction, RandomSource, TeamBattleAction, TeamBattleState,
} from "./types.js";

const SIDES = ["player", "opponent"] as const;

function otherSide(side: BattleSide): BattleSide { return side === "player" ? "opponent" : "player"; }

export function createDoubleTeamBattleState(members: Readonly<Record<BattleSide, readonly BattlerState[]>>,
  requested: Readonly<Partial<Record<BattleSide, readonly number[]>>> = {}): TeamBattleState {
  const teams = Object.fromEntries(SIDES.map((side) => {
    if (members[side].length < 1 || members[side].length > 6) throw new Error(`Composition double invalide pour ${side}.`);
    const conscious = members[side].map((member, index) => ({ member, index })).filter(({ member }) => member.hp > 0);
    if (conscious.length < 1) throw new Error(`Aucun Pokemon apte au combat pour ${side}.`);
    const indices = requested[side] === undefined ? conscious.slice(0, 2).map(({ index }) => index) : [...requested[side]!];
    if (indices.length < 1 || indices.length > 2 || new Set(indices).size !== indices.length
      || indices.some((index) => members[side][index] === undefined || members[side][index]!.hp <= 0)) {
      throw new Error(`Emplacements actifs doubles invalides pour ${side}.`);
    }
    return [side, { activeIndex: indices[0]!, activeIndices: indices,
      members: members[side].map((member) => ({ ...member, stages: { ...member.stages },
        moves: member.moves.map((slot) => ({ ...slot, move: { ...slot.move } })) })) }];
  })) as unknown as Record<BattleSide, BattleTeam>;
  for (const side of SIDES) for (const index of activeTeamIndices(teams[side])) {
    if (teams[side].members[index]!.ability !== "INTIMIDATE") continue;
    const other = otherSide(side);
    const opposing = new Set(activeTeamIndices(teams[other]));
    teams[other] = { ...teams[other], members: teams[other].members.map((member, memberIndex) => {
      if (!opposing.has(memberIndex)) return member;
      const delta = member.ability === "SIMPLE" ? -2 : -1;
      return { ...member, stages: { ...member.stages, attack: Math.max(-6, member.stages.attack + delta) } };
    }) };
  }
  return initializeMegaEvolutionState({ turn: 1, status: "active", winner: null, format: "double", teams,
    replacementRequired: [], slotReplacements: [] });
}

export function activeTeamIndices(team: BattleTeam): readonly number[] {
  return team.activeIndices ?? [team.activeIndex];
}

export function activeBattlePositions(state: TeamBattleState): readonly BattlePosition[] {
  return SIDES.flatMap((side) => activeTeamIndices(state.teams[side]).map((_, slot) => ({ side, slot })));
}

export function battlerAtPosition(state: TeamBattleState, position: BattlePosition): BattlerState | undefined {
  const index = activeTeamIndices(state.teams[position.side])[position.slot];
  return index === undefined ? undefined : state.teams[position.side].members[index];
}

function cloneTeam(team: BattleTeam): BattleTeam {
  const indices = [...activeTeamIndices(team)];
  return { ...team, activeIndex: indices[0]!, activeIndices: indices,
    members: team.members.map((member) => ({ ...member, stages: { ...member.stages },
      majorStatus: member.majorStatus === null ? null : { ...member.majorStatus },
      ...(member.volatile === undefined ? {} : { volatile: { ...member.volatile } }),
      moves: member.moves.map((entry) => ({ ...entry, move: { ...entry.move } })) })) };
}

function key(position: BattlePosition): string { return `${position.side}:${position.slot}`; }

function effectiveSpeed(battler: BattlerState): number {
  const stage = battler.stages.speed;
  const staged = stage >= 0 ? Math.floor((battler.stats.speed * (2 + stage)) / 2)
    : Math.floor((battler.stats.speed * 2) / (2 - stage));
  if (battler.ability === "QUICKFEET" && battler.majorStatus !== null) return Math.max(1, Math.round(staged * 1.5));
  if (battler.ability === "ACOMETIDA" && (battler.volatile?.activeTurns ?? 0) === 0) return Math.max(1, Math.round(staged * 1.5));
  return battler.majorStatus?.kind === "paralysis" ? Math.max(1, Math.round(staged / 4)) : staged;
}

function validPosition(state: TeamBattleState, position: BattlePosition): boolean {
  return position.slot >= 0 && position.slot < activeTeamIndices(state.teams[position.side]).length;
}

function moveTargets(state: TeamBattleState, actor: BattlePosition, action: Extract<TeamBattleAction, { kind: "move" }>,
  rng: RandomSource): readonly BattlePosition[] {
  const user = battlerAtPosition(state, actor);
  const move = user?.moves[action.moveIndex]?.move;
  if (user === undefined || move === undefined) throw new Error("Capacite ou combattant double invalide.");
  const enemies = activeTeamIndices(state.teams[otherSide(actor.side)]).map((_, slot) => ({ side: otherSide(actor.side), slot }))
    .filter((position) => (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const allies = activeTeamIndices(state.teams[actor.side]).map((_, slot) => ({ side: actor.side, slot }))
    .filter((position) => position.slot !== actor.slot && (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const code = (move.targetCode ?? "00").toUpperCase().replace(/^0X/u, "");
  if (code === "04") return enemies;
  if (code === "08") return [...enemies, ...allies];
  if (["01", "10", "20", "40", "80"].includes(code)) return [actor];
  if (code === "100") return allies.slice(0, 1);
  if (code === "200") {
    if (action.target?.side === actor.side && validPosition(state, action.target)) return [action.target];
    return [actor];
  }
  if (code === "02") return enemies.length === 0 ? [] : [enemies[rng.nextInt(enemies.length)]!];
  if (code === "800") return enemies.filter((position) => position.slot === actor.slot).slice(0, 1).length > 0
    ? enemies.filter((position) => position.slot === actor.slot).slice(0, 1) : enemies.slice(0, 1);
  if (action.target !== undefined && action.target.side === otherSide(actor.side)
    && validPosition(state, action.target) && (battlerAtPosition(state, action.target)?.hp ?? 0) > 0) return [action.target];
  return enemies.slice(0, 1);
}

function storeBattler(teams: Record<BattleSide, BattleTeam>, position: BattlePosition, battler: BattlerState): void {
  const team = teams[position.side];
  const index = activeTeamIndices(team)[position.slot];
  if (index === undefined) throw new Error("Emplacement actif double invalide.");
  teams[position.side] = { ...team, members: team.members.map((member, candidate) => candidate === index ? battler : member) };
}

function executeMove(state: TeamBattleState, teams: Record<BattleSide, BattleTeam>, actor: BattlePosition,
  action: Extract<TeamBattleAction, { kind: "move" }>, targets: readonly BattlePosition[], rng: RandomSource,
  submitted: readonly PositionedTeamBattleAction[], effects: TeamBattleState["effects"],
): { readonly events: readonly BattleEvent[]; readonly trace: DoubleTurnResult["trace"];
  readonly effects: TeamBattleState["effects"] } {
  const events: BattleEvent[] = [];
  const trace: DoubleTurnResult["trace"][number][] = [];
  let first = true;
  for (const [targetIndex, target] of targets.entries()) {
    const attacker = teams[actor.side].members[activeTeamIndices(teams[actor.side])[actor.slot]!]!;
    const defender = teams[target.side].members[activeTeamIndices(teams[target.side])[target.slot]!]!;
    if (attacker.hp <= 0 || defender.hp <= 0) continue;
    const miniSide = actor.side;
    const miniTarget = otherSide(miniSide);
    const mini: BattleState = { turn: state.turn, status: "active", winner: null,
      battlers: { [miniSide]: attacker, [miniTarget]: defender } as Readonly<Record<BattleSide, BattlerState>>,
      ...(effects === undefined ? {} : { effects }) };
    const targetEntry = submitted.find((entry) => key(entry.actor) === key(target));
    const targetAction = targetEntry?.action.kind === "move" ? targetEntry.action : undefined;
    const result = resolveSelectedMoves(mini, { [miniSide]: action }, rng,
      { endOfTurn: false, damageMultiplier: targets.length > 1 ? 0.75 : 1,
        attackerHeldItemAfterDamage: targetIndex === targets.length - 1,
        switchingTarget: targetEntry?.action.kind === "switch" ? target.side : null,
        ...(targetAction === undefined ? {} : { targetPlannedAction: targetAction }) });
    effects = result.state.effects;
    let nextAttacker = result.state.battlers[miniSide];
    if (!first) {
      nextAttacker = { ...nextAttacker, moves: nextAttacker.moves.map((slot, index) => index === action.moveIndex
        ? attacker.moves[index]! : slot) };
    }
    storeBattler(teams, actor, nextAttacker);
    if (key(target) !== key(actor)) storeBattler(teams, target, result.state.battlers[miniTarget]);
    events.push(...result.events.filter((event) => !["turnStarted", "actionOrdered", "turnEnded", "battleEnded"].includes(event.type)));
    trace.push(...result.trace);
    first = false;
  }
  return { events, trace, effects };
}

function switchAt(teams: Record<BattleSide, BattleTeam>, actor: BattlePosition, teamIndex: number): readonly DoubleBattleEvent[] {
  const team = teams[actor.side];
  const indices = [...activeTeamIndices(team)];
  const fromIndex = indices[actor.slot];
  if (fromIndex === undefined || teamIndex < 0 || teamIndex >= team.members.length
    || indices.includes(teamIndex) || team.members[teamIndex]!.hp <= 0) throw new Error("Remplacement double invalide.");
  indices[actor.slot] = teamIndex;
  let healed = 0;
  const members = team.members.map((member, index) => {
    if (index !== fromIndex) return member;
    const { volatile: _volatile, ...persistent } = member;
    const hp = member.ability === "REGENERATOR" && member.hp > 0
      ? Math.min(member.stats.maxHp, member.hp + Math.max(1, Math.floor(member.stats.maxHp / 3))) : member.hp;
    healed = hp - member.hp;
    return { ...persistent, stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp, majorStatus: member.majorStatus?.kind === "poison"
      && member.majorStatus.toxicCounter !== null ? { kind: "poison" as const, toxicCounter: 0 } : member.majorStatus };
  });
  teams[actor.side] = { ...team, activeIndex: indices[0]!, activeIndices: indices };
  teams[actor.side] = { ...teams[actor.side], members };
  const output: DoubleBattleEvent[] = [];
  if (healed > 0) output.push({ type: "abilityActivated", side: actor.side,
    ability: "REGENERATOR", effect: "heal-on-switch" }, { type: "hpRestored", side: actor.side,
    source: "move", move: "REGENERATOR", amount: healed, hp: team.members[fromIndex]!.hp + healed });
  output.push({ type: "pokemonSwitched", side: actor.side, fromIndex, toIndex: teamIndex,
    from: team.members[fromIndex]!.id, to: team.members[teamIndex]!.id, reason: "voluntary" });
  const entering = teams[actor.side].members[teamIndex]!;
  if (entering.ability === "INTIMIDATE") {
    const other = otherSide(actor.side);
    const opposing = new Set(activeTeamIndices(teams[other]));
    teams[other] = { ...teams[other], members: teams[other].members.map((member, index) => {
      if (!opposing.has(index)) return member;
      const delta = member.ability === "SIMPLE" ? -2 : -1;
      const stage = Math.max(-6, member.stages.attack + delta);
      if (stage !== member.stages.attack) output.push({ type: "statStageChanged", source: actor.side,
        target: other, stat: "attack", delta: stage - member.stages.attack, stage });
      return { ...member, stages: { ...member.stages, attack: stage } };
    }) };
    output.unshift({ type: "abilityActivated", side: actor.side, ability: "INTIMIDATE", effect: "lower-attack" });
  }
  return output;
}

function applyDoubleEndOfTurn(state: TeamBattleState, teams: Record<BattleSide, BattleTeam>,
  rng: RandomSource, trace: DoubleTurnResult["trace"][number][]): DoubleBattleEvent[] {
  const output: DoubleBattleEvent[] = [];
  for (const position of activeBattlePositions({ ...state, teams })) {
    const index = activeTeamIndices(teams[position.side])[position.slot]!;
    let battler = teams[position.side].members[index]!;
    if (battler.hp <= 0) continue;
    const inner: BattleEvent[] = [];
    const status = battler.majorStatus;
    if ((status?.kind === "poison" || status?.kind === "burn" || status?.kind === "frozen")
      && battler.ability !== "MAGICGUARD") {
      const nextStatus = status.kind === "poison" && status.toxicCounter !== null
        ? { kind: "poison" as const, toxicCounter: Math.min(15, status.toxicCounter + 1) } : status;
      const raw = nextStatus.kind === "burn" || nextStatus.kind === "frozen"
        ? Math.floor(battler.stats.maxHp / 16) : nextStatus.toxicCounter === null
          ? Math.floor(battler.stats.maxHp / 12) : Math.floor((battler.stats.maxHp * nextStatus.toxicCounter) / 16);
      const amount = Math.min(battler.hp, Math.max(1, raw));
      battler = { ...battler, hp: battler.hp - amount, majorStatus: nextStatus };
      inner.push({ type: "statusDamage", side: position.side, status: nextStatus.kind, amount, hp: battler.hp });
    } else if (status?.kind === "hemorrhage" || status?.kind === "caduco" && battler.hp <= Math.floor(battler.stats.maxHp / 2)) {
      inner.push({ type: "statusContinued", side: position.side, status: status.kind });
    }
    if (battler.hp > 0) {
      const volatile = resolveBattleVolatileEndOfTurn(battler, position.side);
      battler = volatile.battler;
      inner.push(...volatile.events);
    }
    if (battler.hp > 0) {
      const passive = resolveBattlePassiveEndOfTurn(battler, position.side, rng, trace);
      battler = passive.battler;
      inner.push(...passive.events);
    }
    if (battler.hp === 0) inner.push({ type: "fainted", side: position.side });
    storeBattler(teams, position, battler);
    if (inner.length > 0) output.push({ type: "positionedActionResolved", actor: position, targets: [position], events: inner });
  }
  return output;
}

/** Resolves every active slot in one global priority/speed order. Singles keep using resolveTeamTurn. */
export function resolveDoubleTeamTurn(state: TeamBattleState, submitted: readonly PositionedTeamBattleAction[],
  rng: RandomSource, itemPolicy: PokemonItemUsePolicy = { context: "battle", revivalAllowed: true }): DoubleTurnResult {
  if (state.status !== "active" || state.format !== "double") throw new Error("Combat double actif attendu.");
  if ((state.slotReplacements?.length ?? 0) > 0) throw new Error("Les remplacements doubles doivent etre resolus avant le tour.");
  state = initializeMegaEvolutionState(state);
  let teams: Record<BattleSide, BattleTeam> = { player: cloneTeam(state.teams.player), opponent: cloneTeam(state.teams.opponent) };
  const required = activeBattlePositions(state).filter((position) => (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const effectiveSubmitted = submitted.map((entry): PositionedTeamBattleAction => {
    if (entry.action.kind !== "move") return entry;
    const battler = battlerAtPosition(state, entry.actor);
    const encore = battler?.volatile;
    if (battler === undefined || !encore || encore.encoreTurns <= 0 || encore.encoreMove === null) return entry;
    const moveIndex = battler.moves.findIndex((slot) => slot.move.internalName === encore.encoreMove && slot.pp > 0);
    return moveIndex < 0 ? entry : { ...entry, action: { ...entry.action, moveIndex } };
  });
  const byActor = new Map(effectiveSubmitted.map((entry) => [key(entry.actor), entry]));
  if (byActor.size !== effectiveSubmitted.length || required.some((position) => !byActor.has(key(position)))) {
    throw new Error("Chaque Pokemon actif doit choisir exactement une action.");
  }
  const megaResult = resolveMegaEvolutionIntents({ ...state, teams }, effectiveSubmitted.flatMap((entry) => {
    if (entry.action.kind !== "move" || entry.action.megaEvolution !== true) return [];
    const teamIndex = activeTeamIndices(teams[entry.actor.side])[entry.actor.slot];
    return teamIndex === undefined ? [] : [{ side: entry.actor.side, teamIndex }];
  }));
  state = megaResult.state;
  teams = { player: cloneTeam(state.teams.player), opponent: cloneTeam(state.teams.opponent) };
  const switchEntries = effectiveSubmitted.filter((entry) => entry.action.kind === "switch");
  const itemEntries = effectiveSubmitted.filter((entry) => entry.action.kind === "item");
  const captureEntries = effectiveSubmitted.filter((entry) => entry.action.kind === "capture");
  const events: DoubleBattleEvent[] = [{ type: "turnStarted", turn: state.turn }, ...megaResult.events];
  const trace: DoubleTurnResult["trace"][number][] = [];
  let effects = state.effects;
  const pursuitKeys = new Set<string>();
  for (const entry of effectiveSubmitted) {
    if (entry.action.kind !== "move") continue;
    const attacker = battlerAtPosition({ ...state, teams }, entry.actor);
    if (attacker?.moves[entry.action.moveIndex]?.move.functionCode !== "088") continue;
    const target = moveTargets({ ...state, teams }, entry.actor, entry.action, rng)
      .find((candidate) => effectiveSubmitted.some((submitted) => key(submitted.actor) === key(candidate)
        && submitted.action.kind === "switch"));
    if (target === undefined) continue;
    const result = executeMove(state, teams, entry.actor, entry.action, [target], rng, effectiveSubmitted, effects);
    effects = result.effects;
    events.push({ type: "positionedActionResolved", actor: entry.actor, targets: [target], events: result.events });
    trace.push(...result.trace);
    pursuitKeys.add(key(entry.actor));
  }
  for (const entry of switchEntries) events.push(...switchAt(teams, entry.actor, (entry.action as Extract<TeamBattleAction, {kind:"switch"}>).teamIndex));
  for (const entry of itemEntries) {
    const action = entry.action as Extract<TeamBattleAction, { kind: "item" }>;
    const team = teams[entry.actor.side];
    const target = team.members[action.targetTeamIndex];
    if (target === undefined) throw new Error("Cible d'objet double invalide.");
    const applied = applyPokemonItemEffect(target, action.itemId, itemPolicy, action.targetMoveIndex);
    if (typeof applied === "string") throw new Error(`Objet ${action.itemId} inutilisable : ${applied}.`);
    teams[entry.actor.side] = { ...team, members: team.members.map((member, index) =>
      index === action.targetTeamIndex ? applied.pokemon : member) };
    if (team.items !== undefined) {
      const consumedIndex = team.items.indexOf(action.itemId);
      if (consumedIndex >= 0) teams[entry.actor.side] = { ...teams[entry.actor.side],
        items: team.items.filter((_, index) => index !== consumedIndex) };
    }
    events.push({ type: "trainerItemUsed", side: entry.actor.side, itemId: action.itemId,
      targetIndex: action.targetTeamIndex, target: target.id, ...applied.effect });
  }
  const moves = effectiveSubmitted.filter((entry): entry is PositionedTeamBattleAction & { action: Extract<TeamBattleAction, {kind:"move"}> } =>
    entry.action.kind === "move" && !pursuitKeys.has(key(entry.actor)))
    .map((entry) => { const battler = battlerAtPosition({ ...state, teams }, entry.actor)!;
      const move = battler.moves[entry.action.moveIndex]?.move;
      if (move === undefined) throw new Error("Capacite double invalide.");
      return { ...entry, priority: move.priority, speed: effectiveSpeed(battler), tie: rng.nextInt(1_000_000) }; })
    .sort((left, right) => right.priority - left.priority || right.speed - left.speed || left.tie - right.tie);
  events.push({ type: "teamActionOrdered", order: [
    ...switchEntries.map((entry) => ({ side: entry.actor.side, kind: "switch" as const })),
    ...itemEntries.map((entry) => ({ side: entry.actor.side, kind: "item" as const })),
    ...captureEntries.map((entry) => ({ side: entry.actor.side, kind: "capture" as const })),
    ...effectiveSubmitted.filter((entry) => entry.action.kind === "wait").map((entry) => ({ side: entry.actor.side, kind: "wait" as const })),
    ...moves.map((entry) => ({ side: entry.actor.side, kind: "move" as const })),
  ] });
  for (const entry of captureEntries) {
    const action = entry.action as Extract<TeamBattleAction, { kind: "capture" }>;
    const enemies = activeTeamIndices(teams[otherSide(entry.actor.side)]).map((_, slot) =>
      ({ side: otherSide(entry.actor.side), slot })).filter((position) =>
      (battlerAtPosition({ ...state, teams }, position)?.hp ?? 0) > 0);
    const targetPosition = action.target !== undefined && enemies.some((candidate) => key(candidate) === key(action.target!))
      ? action.target : enemies[0];
    if (targetPosition === undefined) throw new Error("Cible de capture double invalide.");
    const target = battlerAtPosition({ ...state, teams }, targetPosition);
    const actor = battlerAtPosition({ ...state, teams }, entry.actor);
    if (target === undefined || actor === undefined) throw new Error("Cible de capture double invalide.");
    const actorLevels = activeTeamIndices(teams[entry.actor.side]).map((index) => teams[entry.actor.side].members[index]!.level);
    const capture = attemptPokemonCapture(action.ballId, target, { turn: state.turn, actorLevels,
      sameSpeciesOppositeGender: actor.species === target.species
        && actor.appearance?.gender !== null && target.appearance?.gender !== null
        && actor.appearance?.gender !== target.appearance?.gender }, rng);
    const captureEvent = { type: "captureAttempted" as const, side: entry.actor.side,
      ballId: action.ballId, target: target.id, ...capture };
    events.push({ type: "positionedActionResolved", actor: entry.actor, targets: [targetPosition], events: [captureEvent] });
    if (capture.success) {
      events.push({ type: "battleEnded", winner: entry.actor.side }, { type: "turnEnded", turn: state.turn });
      return { state: { ...state, turn: state.turn + 1, teams, winner: entry.actor.side,
        status: "finished", replacementRequired: [], slotReplacements: [] }, events, trace };
    }
  }
  for (const entry of moves) {
    const liveState: TeamBattleState = { ...state, teams };
    if ((battlerAtPosition(liveState, entry.actor)?.hp ?? 0) <= 0) continue;
    const targets = moveTargets(liveState, entry.actor, entry.action, rng);
    const result = executeMove(state, teams, entry.actor, entry.action, targets, rng, effectiveSubmitted, effects);
    effects = result.effects;
    events.push({ type: "positionedActionResolved", actor: entry.actor, targets, events: result.events });
    trace.push(...result.trace);
  }
  events.push(...applyDoubleEndOfTurn(state, teams, rng, trace));
  const slotReplacements: BattlePosition[] = [];
  let winner: BattleSide | null = null;
  for (const side of SIDES) {
    const active = activeTeamIndices(teams[side]);
    const reserves = teams[side].members.map((member, index) => ({ member, index }))
      .filter(({ member, index }) => member.hp > 0 && !active.includes(index));
    active.forEach((index, slot) => {
      if (teams[side].members[index]!.hp <= 0 && reserves.length > slotReplacements.filter((position) => position.side === side).length) {
        slotReplacements.push({ side, slot });
      }
    });
    if (!teams[side].members.some((member) => member.hp > 0)) winner = otherSide(side);
  }
  if (winner !== null) events.push({ type: "battleEnded", winner });
  events.push({ type: "turnEnded", turn: state.turn });
  if (effects !== undefined) effects = { sides: {
    player: { reflectTurns: Math.max(0, effects.sides.player.reflectTurns - 1),
      luckyChantTurns: Math.max(0, effects.sides.player.luckyChantTurns - 1) },
    opponent: { reflectTurns: Math.max(0, effects.sides.opponent.reflectTurns - 1),
      luckyChantTurns: Math.max(0, effects.sides.opponent.luckyChantTurns - 1) },
  }, waterSportTurns: Math.max(0, effects.waterSportTurns - 1) };
  return { state: { ...state, turn: state.turn + 1, teams, winner,
    status: winner === null ? "active" : "finished", replacementRequired: [],
    slotReplacements: winner === null ? slotReplacements : [], ...(effects === undefined ? {} : { effects }) }, events, trace };
}

export function replaceFaintedDoublePokemon(state: TeamBattleState, position: BattlePosition,
  teamIndex: number): TeamBattleState {
  if (state.format !== "double" || !state.slotReplacements?.some((entry) => key(entry) === key(position))) {
    throw new Error("Aucun remplacement n'est requis a cet emplacement.");
  }
  const teams: Record<BattleSide, BattleTeam> = { player: cloneTeam(state.teams.player), opponent: cloneTeam(state.teams.opponent) };
  switchAt(teams, position, teamIndex);
  return { ...state, teams, slotReplacements: state.slotReplacements.filter((entry) => key(entry) !== key(position)) };
}
