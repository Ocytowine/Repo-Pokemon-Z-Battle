import { applyPerishSongToBattler, clearAirborneEffects, resolveBattlePassiveEndOfTurn,
  resolveBattleVolatileEndOfTurn, resolveSelectedMoves } from "./resolve-turn.js";
import { assistMoveFrom, sleepTalkMoveFrom } from "./called-move-selection.js";
import { applyEntryHazards } from "./entry-hazards.js";
import { curePartyStatuses } from "./party-status-cure.js";
import { recordSideFaints } from "./side-faint-history.js";
import { cureStatusBlockedByAbility } from "./ability-protection.js";
import { resolveEntryAbility } from "./ability-entry.js";
import { applyEntryFieldAbility, resolveGrassyTerrainHealing } from "./ability-field-entry.js";
import { activateWindAbility } from "./ability-wind.js";
import { applyEntryWeatherAbility, effectiveBattleWeather, hasWeatherSuppressor, reconcileExtremeWeather,
  resolveWeatherEndOfTurn, weatherSpeedMultiplier } from "./ability-weather.js";
import { applyPokemonItemEffect, type PokemonItemUsePolicy } from "./pokemon-item.js";
import { attemptPokemonCapture } from "./pokemon-capture.js";
import { initializeMegaEvolutionState, resolveMegaEvolutionIntents } from "./mega-evolution.js";
import { restoreMimickedMoves, restoreMoveModifiedStats, restoreTransformedBattler,
  transformBattler } from "./battle-transform.js";
import { markEnteredMidTurn, resolveHealer, resolveHydration, resolveLateEndOfTurnAbilities,
  resolvePoisonHeal } from "./ability-end-turn.js";
import { assertVoluntarySwitchAllowed } from "./ability-switch-trap.js";
import { reconcileAbilityForm, restoreAbilityForm } from "./ability-form.js";
import { applyIllusion } from "./ability-illusion.js";
import { inheritSwitchEffects, releaseSwitchTraps } from "./switch-inheritance.js";
import { clearStatStages } from "./ability-stat-reactions.js";
import { berriesBlockedBy, consumeHeldItem, isSupportedBerry, moveCanTriggerPressure } from "./ability-item-control.js";
import { custapBerryReady } from "./battle-berries.js";
import { copycatMoveFrom, effectiveMovePriority, effectiveMoveType, hasMoveFlag, meFirstMoveFrom,
  mirrorMoveFrom, moveTargetsUser } from "./move-properties.js";
import type {
  BattleEvent, BattleMove, BattlePosition, BattleResolutionRules, BattleSide, BattleState, BattleTeam, BattleTrace, BattlerState, DoubleBattleEvent,
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
    const entering = teams[side].members[index]!;
    if (!["INTIMIDATE", "ESPANTO", "ILLUMINATE"].includes(entering.ability ?? "")) continue;
    const other = otherSide(side);
    const opponentIndices = activeTeamIndices(teams[other]);
    const entry = resolveEntryAbility(side, entering,
      opponentIndices.map((opponentIndex) => ({ side: other, battler: teams[other].members[opponentIndex]! })),
      { nextInt: () => 0 }, [], side === "player", entering.ability !== "NEUTRALIZINGGAS"
        && activeBattlerList({ turn: 1, status: "active", winner: null, format: "double", teams,
          replacementRequired: [], slotReplacements: [] }).some((active) =>
            active.hp > 0 && active.ability === "NEUTRALIZINGGAS"));
    teams[side] = { ...teams[side], members: teams[side].members.map((member, memberIndex) =>
      memberIndex === index ? entry.battler : member) };
    const updates = new Map(opponentIndices.map((opponentIndex, position) =>
      [opponentIndex, entry.opponents[position]!.battler]));
    teams[other] = { ...teams[other], members: teams[other].members.map((member, memberIndex) =>
      updates.get(memberIndex) ?? member) };
  }
  let state: TeamBattleState = { turn: 1, status: "active", winner: null, format: "double", teams,
    replacementRequired: [], slotReplacements: [] };
  for (const side of SIDES) for (const [slot, index] of activeTeamIndices(teams[side]).entries()) {
    const active = teams[side].members[index]!;
    if (active.ability === "IMPOSTER") {
      const targets = activeTeamIndices(teams[otherSide(side)]);
      const targetIndex = targets[slot] ?? targets[0];
      const target = targetIndex === undefined ? undefined : teams[otherSide(side)].members[targetIndex];
      const transformed = target === undefined ? null : transformBattler(active, target);
      if (transformed !== null) teams[side] = { ...teams[side], members: teams[side].members.map((member, candidate) =>
        candidate === index ? transformed : member) };
    }
    const field = applyEntryFieldAbility(active, side, state.effects);
    if (field.effects !== undefined) state = { ...state, effects: field.effects };
    const weather = applyEntryWeatherAbility(active, side, state.effects);
    if (weather.effects !== undefined) state = { ...state, effects: weather.effects };
  }
  state = { ...state, teams };
  const gasActive = activeBattlerList(state, teams).some((active) =>
    active.hp > 0 && active.ability === "NEUTRALIZINGGAS");
  for (const side of SIDES) for (const index of activeTeamIndices(teams[side])) {
    teams[side] = applyIllusion(teams[side], index,
      gasActive && teams[side].members[index]!.ability !== "NEUTRALIZINGGAS");
  }
  state = { ...state, teams };
  reconcileDoubleForms(state, teams, state.effects);
  state = { ...state, teams };
  return initializeMegaEvolutionState(state);
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

function effectiveSpeed(battler: BattlerState, effects: TeamBattleState["effects"], weatherSuppressed = false,
  side?: BattleSide): number {
  const stage = battler.stages.speed;
  const staged = stage >= 0 ? Math.floor((battler.stats.speed * (2 + stage)) / 2)
    : Math.floor((battler.stats.speed * 2) / (2 - stage));
  let speed = battler.ability === "QUICKFEET" && battler.majorStatus !== null ? Math.max(1, Math.round(staged * 1.5))
    : battler.ability === "ACOMETIDA" && (battler.volatile?.activeTurns ?? 0) === 0
      ? Math.max(1, Math.round(staged * 1.5))
      : battler.majorStatus?.kind === "paralysis" ? Math.max(1, Math.round(staged / 4)) : staged;
  if (battler.ability === "UNBURDEN" && battler.heldItem === null && battler.volatile?.unburdened === true) speed *= 2;
  if (side !== undefined && (effects?.sides[side].tailwindTurns ?? 0) > 0) speed *= 2;
  if (battler.ability === "SURGESURFER" && effects?.terrain === "electric") speed *= 2;
  if (battler.ability === "SILVANO" && effects?.terrain === "grassy") speed = Math.max(1, Math.round(speed * 1.3));
  if (battler.ability === "SLOWSTART" && (battler.volatile?.activeTurns ?? 0) <= 5) {
    speed = Math.max(1, Math.round(speed * 0.5));
  }
  speed *= weatherSpeedMultiplier(battler, weatherSuppressed ? null : effects?.weather);
  return speed;
}

function activeBattlerList(state: TeamBattleState, teams = state.teams): BattlerState[] {
  return SIDES.flatMap((side) => activeTeamIndices(teams[side]).map((index) => teams[side].members[index]!));
}

function reconcileDoubleForms(state: TeamBattleState, teams: Record<BattleSide, BattleTeam>,
  effects: TeamBattleState["effects"]): DoubleBattleEvent[] {
  const active = activeBattlerList(state, teams);
  const gasActive = active.some((battler) => battler.hp > 0 && battler.ability === "NEUTRALIZINGGAS");
  const weather = effectiveBattleWeather(effects?.weather, active, hasWeatherSuppressor(active));
  const events: DoubleBattleEvent[] = [];
  for (const position of activeBattlePositions({ ...state, teams })) {
    const battler = battlerAtPosition({ ...state, teams }, position);
    if (battler === undefined) continue;
    const result = reconcileAbilityForm(battler, position.side, weather,
      gasActive && battler.ability !== "NEUTRALIZINGGAS");
    storeBattler(teams, position, result.battler);
    if (result.events.length > 0) events.push({ type: "positionedActionResolved", actor: position,
      targets: [position], events: result.events });
  }
  return events;
}

function validPosition(state: TeamBattleState, position: BattlePosition): boolean {
  return position.slot >= 0 && position.slot < activeTeamIndices(state.teams[position.side]).length;
}

function redirectedElementalTarget(state: TeamBattleState, actor: BattlePosition, intended: BattlePosition,
  moveType: string): BattlePosition {
  const abilities = moveType === "WATER" ? ["DESPIERTALLAMA", "STORMDRAIN"] as const
    : moveType === "ELECTRIC" ? ["LIGHTNINGROD"] as const : [];
  if (abilities.length === 0) return intended;
  for (const ability of abilities) {
    const candidates = (["player", "opponent"] as const).flatMap((side) =>
      activeTeamIndices(state.teams[side]).map((_, slot) => ({ side, slot })))
      .filter((position) => key(position) !== key(actor))
      .filter((position) => {
        const battler = battlerAtPosition(state, position);
        return (battler?.hp ?? 0) > 0 && battler?.ability === ability;
      })
      .sort((left, right) => effectiveSpeed(battlerAtPosition(state, right)!, state.effects,
        hasWeatherSuppressor(activeBattlerList(state)), right.side)
        - effectiveSpeed(battlerAtPosition(state, left)!, state.effects,
          hasWeatherSuppressor(activeBattlerList(state)), left.side));
    if (candidates.length === 0) continue;
    if (battlerAtPosition(state, intended)?.ability === ability) return intended;
    return candidates[0]!;
  }
  return intended;
}

function mirrorSourceMove(state: TeamBattleState, actor: BattlePosition,
  action: Extract<TeamBattleAction, { kind: "move" }>): BattleMove | null {
  const user = battlerAtPosition(state, actor);
  if (user?.moves[action.moveIndex]?.move.functionCode !== "0AE") return null;
  if (user.volatile?.chargingCalledMove != null
    && user.volatile.chargingMove === user.moves[action.moveIndex]?.move.internalName) {
    return user.volatile.chargingCalledMove;
  }
  const opponents = activeTeamIndices(state.teams[otherSide(actor.side)])
    .map((_, slot) => ({ side: otherSide(actor.side), slot }))
    .filter((position) => (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const source = action.target?.side === otherSide(actor.side)
    && opponents.some((position) => key(position) === key(action.target!)) ? action.target : opponents[0];
  return source === undefined ? null : mirrorMoveFrom(battlerAtPosition(state, source));
}

function calledMoveForAction(state: TeamBattleState, actor: BattlePosition,
  action: Extract<TeamBattleAction, { kind: "move" }>, submitted: readonly PositionedTeamBattleAction[],
  resolved: ReadonlySet<string>, rng: RandomSource, trace: BattleTrace[]): BattleMove | null {
  const user = battlerAtPosition(state, actor);
  const selected = user?.moves[action.moveIndex]?.move;
  if (selected === undefined) return null;
  if (selected.functionCode === "0AE") return mirrorSourceMove(state, actor, action);
  if (selected.functionCode === "0AF") return copycatMoveFrom(state.effects);
  if (selected.functionCode === "0B4") return sleepTalkMoveFrom(user!, rng, trace);
  if (selected.functionCode === "0B5") return assistMoveFrom(user!, state.teams[actor.side].members, rng, trace);
  if (selected.functionCode !== "0B0") return null;
  if (user?.volatile?.chargingMove === selected.internalName
    && user.volatile.chargingCalledMove != null) return user.volatile.chargingCalledMove;
  const opponents = activeTeamIndices(state.teams[otherSide(actor.side)])
    .map((_, slot) => ({ side: otherSide(actor.side), slot }))
    .filter((position) => (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const target = action.target !== undefined && opponents.some((position) => key(position) === key(action.target!))
    ? action.target : opponents[0];
  const chosen = submitted.find((entry) => target !== undefined && key(entry.actor) === key(target));
  const move = chosen?.action.kind === "move"
    ? battlerAtPosition(state, target!)?.moves[chosen.action.moveIndex]?.move : undefined;
  return meFirstMoveFrom(move, target === undefined || resolved.has(key(target)));
}

function moveTargets(state: TeamBattleState, actor: BattlePosition, action: Extract<TeamBattleAction, { kind: "move" }>,
  rng: RandomSource, calledMove?: BattleMove | null): readonly BattlePosition[] {
  const user = battlerAtPosition(state, actor);
  const selectedMove = user?.moves[action.moveIndex]?.move;
  if (user === undefined || selectedMove === undefined) throw new Error("Capacite ou combattant double invalide.");
  const move = calledMove ?? mirrorSourceMove(state, actor, action) ?? selectedMove;
  const enemies = activeTeamIndices(state.teams[otherSide(actor.side)]).map((_, slot) => ({ side: otherSide(actor.side), slot }))
    .filter((position) => (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const allies = activeTeamIndices(state.teams[actor.side]).map((_, slot) => ({ side: actor.side, slot }))
    .filter((position) => position.slot !== actor.slot && (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const code = (move.targetCode ?? "00").toUpperCase().replace(/^0X/u, "");
  const moveType = effectiveMoveType(user, move, state.effects?.weather,
    state.effects?.magicRoomTurns).type;
  if (["071", "072", "073"].includes(move.functionCode)) {
    const retaliation = user.volatile?.retaliation;
    const hit = retaliation?.turn !== state.turn ? undefined
      : move.functionCode === "071" ? retaliation.physical
        : move.functionCode === "072" ? retaliation.special : retaliation.last;
    const source = enemies.find((position) => battlerAtPosition(state, position)?.id === hit?.attackerId);
    if (source !== undefined) return [source];
  }
  if (move.functionCode === "0D4" && (user.volatile?.bideTurns ?? 0) === 1) {
    const source = enemies.find((position) => battlerAtPosition(state, position)?.id
      === user.volatile?.bideTargetId);
    if (source !== undefined) return [source];
  }
  if (move.functionCode === "0CE" && user.volatile?.chargingTargetId != null) {
    const carried = enemies.find((position) => battlerAtPosition(state, position)?.id
      === user.volatile?.chargingTargetId);
    if (carried !== undefined) return [carried];
  }
  if (code === "04" || move.functionCode === "207" && state.effects?.terrain === "psychic") return enemies;
  if (move.functionCode === "140" && move.category === "Status") return enemies;
  if (code === "08") return [...enemies, ...allies];
  if (hasMoveFlag(move, "d")) {
    const snatcher = enemies.filter((position) => battlerAtPosition(state, position)?.volatile?.snatching === true)
      .sort((left, right) => effectiveSpeed(battlerAtPosition(state, right)!, state.effects,
        hasWeatherSuppressor(activeBattlerList(state)), right.side)
        - effectiveSpeed(battlerAtPosition(state, left)!, state.effects,
          hasWeatherSuppressor(activeBattlerList(state)), left.side))[0];
    if (snatcher !== undefined) return [snatcher];
  }
  if (code === "80" && hasMoveFlag(move, "c")) {
    const reflector = enemies.find((position) => {
      const opponent = battlerAtPosition(state, position);
      return opponent?.volatile?.magicCoat === true || opponent?.ability === "MAGICBOUNCE";
    });
    if (reflector !== undefined) return [reflector];
  }
  if (moveTargetsUser(move)) return [actor];
  if (code === "100") {
    const intended = allies[0];
    return intended === undefined ? [] : [redirectedElementalTarget(state, actor, intended, moveType)];
  }
  if (code === "200") {
    if (action.target?.side === actor.side && validPosition(state, action.target)) {
      return key(action.target) === key(actor) ? [actor]
        : [redirectedElementalTarget(state, actor, action.target, moveType)];
    }
    return [actor];
  }
  let intended: BattlePosition | undefined;
  if (code === "02") intended = enemies.length === 0 ? undefined : enemies[rng.nextInt(enemies.length)];
  else if (code === "800") intended = enemies.find((position) => position.slot === actor.slot) ?? enemies[0];
  else if (action.target !== undefined && action.target.side === otherSide(actor.side)
    && validPosition(state, action.target) && (battlerAtPosition(state, action.target)?.hp ?? 0) > 0) intended = action.target;
  else intended = enemies[0];
  return intended === undefined ? [] : [redirectedElementalTarget(state, actor, intended, moveType)];
}

function storeBattler(teams: Record<BattleSide, BattleTeam>, position: BattlePosition, battler: BattlerState): void {
  const team = teams[position.side];
  const index = activeTeamIndices(team)[position.slot];
  if (index === undefined) throw new Error("Emplacement actif double invalide.");
  teams[position.side] = { ...team, members: team.members.map((member, candidate) => candidate === index ? battler : member) };
}

function executeMove(state: TeamBattleState, teams: Record<BattleSide, BattleTeam>, actor: BattlePosition,
  action: Extract<TeamBattleAction, { kind: "move" }>, targets: readonly BattlePosition[], rng: RandomSource,
  submitted: readonly PositionedTeamBattleAction[], effects: TeamBattleState["effects"], rules: BattleResolutionRules,
  context?: {
    readonly damagedPositions: ReadonlySet<string>;
    readonly resolvedPositions: ReadonlySet<string>;
    readonly roundMultiplier: number;
    readonly helpingHandMultiplier: number;
    readonly calledMove?: BattleMove | null;
  },
): { readonly events: readonly BattleEvent[]; readonly trace: DoubleTurnResult["trace"];
  readonly effects: TeamBattleState["effects"]; readonly damagedTargets: ReadonlySet<string> } {
  const events: BattleEvent[] = [];
  const trace: DoubleTurnResult["trace"][number][] = [];
  const damagedTargets = new Set<string>();
  let first = true;
  const selectedMove = context?.calledMove
    ?? teams[actor.side].members[activeTeamIndices(teams[actor.side])[actor.slot]!]
      ?.moves[action.moveIndex]?.move;
  const selfDestruct = selectedMove?.functionCode === "0E0";
  let selfDestructTemplate: BattlerState | null = null;
  let selfDestructReported = false;
  const dampSide = SIDES.find((side) => activeTeamIndices(teams[side])
    .some((index) => teams[side].members[index]!.hp > 0 && teams[side].members[index]!.ability === "DAMP")) ?? null;
  const pressureCost = 1 + (selectedMove !== undefined && moveCanTriggerPressure(selectedMove)
    ? targets.filter((target) => target.side !== actor.side
      && teams[target.side].members[activeTeamIndices(teams[target.side])[target.slot]!]?.ability === "PRESSURE").length : 0);
  let paidMoves: BattlerState["moves"] | null = null;
  for (const [targetIndex, target] of targets.entries()) {
    const storedAttacker = teams[actor.side].members[activeTeamIndices(teams[actor.side])[actor.slot]!]!;
    const attacker: BattlerState = selfDestructTemplate ?? storedAttacker;
    const defender = teams[target.side].members[activeTeamIndices(teams[target.side])[target.slot]!]!;
    if (attacker.hp <= 0 || defender.hp <= 0) continue;
    const resolutionAttacker = first || paidMoves === null ? attacker : {
      ...attacker,
      moves: attacker.moves.map((slot, index) => index === action.moveIndex && slot.pp === 0
        ? { ...slot, pp: 1 } : slot),
    };
    const miniSide = actor.side;
    const miniTarget = otherSide(miniSide);
    const mini: BattleState = { turn: state.turn, status: "active", winner: null,
      battlers: { [miniSide]: resolutionAttacker, [miniTarget]: defender } as Readonly<Record<BattleSide, BattlerState>>,
      ...(effects === undefined ? {} : { effects }) };
    const targetEntry = submitted.find((entry) => key(entry.actor) === key(target));
    const targetAction = targetEntry?.action.kind === "move" ? targetEntry.action : undefined;
    const activePartnerAbility = (position: BattlePosition): BattlerState["ability"] => {
      const partnerIndex = activeTeamIndices(teams[position.side])
        .find((_, slot) => slot !== position.slot);
      const partner = partnerIndex === undefined ? undefined : teams[position.side].members[partnerIndex];
      return partner !== undefined && partner.hp > 0 ? partner.ability : null;
    };
    const result = resolveSelectedMoves(mini, { [miniSide]: action }, rng,
      { endOfTurn: false, damageMultiplier: targets.length > 1 ? 0.75 : 1,
        attackerHeldItemAfterDamage: targetIndex === targets.length - 1,
        switchingTarget: targetEntry?.action.kind === "switch" ? target.side : null,
        opponentItemTheft: rules.opponentItemTheft,
        attackerParty: { [miniSide]: teams[actor.side].members },
        opponentImprisonMoves: activeTeamIndices(teams[otherSide(actor.side)])
          .map((index) => teams[otherSide(actor.side)].members[index]!)
          .filter((member) => member.hp > 0 && member.volatile?.imprisoning === true)
          .flatMap((member) => member.moves.map((slot) => slot.move.internalName)),
        wildBattle: rules.wildBattle === true,
        escapable: rules.escapable !== false,
        targetTookDamageThisTurn: context?.damagedPositions.has(key(target)) ?? false,
        roundMultiplier: context?.roundMultiplier ?? 1,
        helpingHandMultiplier: context?.helpingHandMultiplier ?? 1,
        weatherSuppressed: hasWeatherSuppressor(activeBattlerList(state, teams)),
        effectiveSpeeds: { [miniSide]: effectiveSpeed(resolutionAttacker, effects,
          hasWeatherSuppressor(activeBattlerList(state, teams)), actor.side),
        [miniTarget]: effectiveSpeed(defender, effects,
          hasWeatherSuppressor(activeBattlerList(state, teams)), target.side) },
        defenderBerriesBlocked: berriesBlockedBy(activeTeamIndices(teams[actor.side])
          .map((index) => teams[actor.side].members[index]!) ),
        attackerBerriesBlocked: berriesBlockedBy(activeTeamIndices(teams[actor.side === "player" ? "opponent" : "player"])
          .map((index) => teams[actor.side === "player" ? "opponent" : "player"].members[index]!) ),
        attackerPartnerAbility: activePartnerAbility(actor),
        defenderPartnerAbility: activePartnerAbility(target),
        activeAbilities: activeBattlerList(state, teams)
          .filter((active) => active.hp > 0 && active.ability !== null)
          .map((active) => active.ability as NonNullable<BattlerState["ability"]>),
        targetIsAlly: target.side === actor.side && key(target) !== key(actor),
        targetPresentationSide: target.side,
        targetAlreadyMoved: context?.resolvedPositions.has(key(target)) ?? false,
        dampSide,
        attackerCanSwitch: { [miniSide]: teams[actor.side].members.some((member, index) => member.hp > 0
          && !activeTeamIndices(teams[actor.side]).includes(index)),
          [miniTarget]: teams[target.side].members.some((member, index) => member.hp > 0
            && !activeTeamIndices(teams[target.side]).includes(index)) },
        ppCost: first ? pressureCost : 1,
        ...(targetAction === undefined ? {} : { targetPlannedAction: targetAction }),
        ...(context?.calledMove === undefined ? {} : { calledMove: context.calledMove }) });
    if (result.events.some((event) => event.type === "damageApplied" && event.amount > 0)) {
      damagedTargets.add(key(target));
    }
    effects = result.state.effects;
    let nextAttacker = result.state.battlers[miniSide];
    if (first) paidMoves = nextAttacker.moves;
    else if (paidMoves !== null) nextAttacker = { ...nextAttacker, moves: paidMoves };
    if (selfDestruct && nextAttacker.hp === 0 && selfDestructTemplate === null) {
      selfDestructTemplate = { ...nextAttacker, hp: attacker.hp };
    }
    storeBattler(teams, actor, nextAttacker);
    const partnerWindEvents: BattleEvent[] = [];
    if (first && selectedMove?.functionCode === "05B"
      && result.events.some((event) => event.type === "moveUsed" && event.move === selectedMove.internalName)) {
      for (const index of activeTeamIndices(teams[actor.side])) {
        if (index === activeTeamIndices(teams[actor.side])[actor.slot]) continue;
        const active = teams[actor.side].members[index]!;
        if (active.hp <= 0) continue;
        const wind = activateWindAbility(active, actor.side);
        if (wind.events.length === 0) continue;
        teams[actor.side] = { ...teams[actor.side], members: teams[actor.side].members.map((member, candidate) =>
          candidate === index ? wind.battler : member) };
        partnerWindEvents.push(...wind.events);
      }
    }
    if (key(target) !== key(actor)) {
      let nextTarget = result.state.battlers[miniTarget];
      if (attacker.moves[action.moveIndex]?.move.functionCode === "0DC"
        && nextTarget.volatile?.leechSeededBy !== undefined && nextTarget.volatile.leechSeededBy !== null) {
        nextTarget = { ...nextTarget, volatile: { ...nextTarget.volatile,
          leechSeededBy: actor.side, leechSeededBySlot: actor.slot } };
      }
      storeBattler(teams, target, nextTarget);
    }
    if (result.events.some((event) => event.type === "partyStatusCureRequested")) {
      const blocked = new Set(selectedMove?.type === "GRASS"
        ? activeTeamIndices(teams[actor.side]).map((index) => teams[actor.side].members[index]!)
          .filter((member) => member.id !== nextAttacker.id && member.ability === "SAPSIPPER")
          .map((member) => member.id) : []);
      const cured = curePartyStatuses(teams[actor.side], actor.side, new Set([nextAttacker.id]), blocked);
      teams[actor.side] = cured.team;
      events.push(...cured.events);
    }
    if (result.events.some((event) => event.type === "battleEffectChanged"
      && event.effect === "gravity" && event.turns > 0)) {
      for (const side of SIDES) for (const index of activeTeamIndices(teams[side])) {
        const member = teams[side].members[index]!;
        const grounded = clearAirborneEffects(member, side);
        if (grounded.battler === member) continue;
        teams[side] = { ...teams[side], members: teams[side].members.map((candidate, at) =>
          at === index ? grounded.battler : candidate) };
        events.push(...grounded.events);
      }
    }
    const resolvedEvents = result.events.filter((event) => {
      if (["turnStarted", "actionOrdered", "turnEnded", "battleEnded"].includes(event.type)) return false;
      if (!selfDestructReported) return true;
      if (event.type === "recoilDamage" && event.reason === "self-destruct") return false;
      return !(event.type === "fainted" && event.side === actor.side);
    }).map((event): BattleEvent => selectedMove?.functionCode === "037"
      && target.side === actor.side && key(target) !== key(actor)
      && (event.type === "statStageChanged" || event.type === "statStageChangeFailed")
      ? { ...event, target: target.side } : event);
    const effectIndex = resolvedEvents.findIndex((event) => event.type === "battleEffectChanged"
      && event.effect === "tailwind");
    if (effectIndex < 0) events.push(...resolvedEvents, ...partnerWindEvents);
    else events.push(...resolvedEvents.slice(0, effectIndex), ...partnerWindEvents, ...resolvedEvents.slice(effectIndex));
    if (result.events.some((event) => event.type === "recoilDamage" && event.reason === "self-destruct")) {
      selfDestructReported = true;
    }
    trace.push(...result.trace);
    first = false;
    if (result.events.some((event) => event.type === "battleEscaped")) break;
    if (result.events.some((event) => event.type === "abilityActivated" && event.ability === "DAMP")) break;
  }
  if (selectedMove?.functionCode === "0E5"
    && events.some((event) => event.type === "moveUsed" && event.move === selectedMove.internalName)) {
    const bypass = ["MOLDBREAKER", "TERAVOLT", "TURBOBLAZE"].includes(
      teams[actor.side].members[activeTeamIndices(teams[actor.side])[actor.slot]!]!.ability ?? "");
    for (const side of SIDES) for (const index of activeTeamIndices(teams[side])) {
      const current = teams[side].members[index]!;
      const affected = applyPerishSongToBattler(current, actor.side, bypass);
      if (affected === current) continue;
      teams[side] = { ...teams[side], members: teams[side].members.map((member, candidate) =>
        candidate === index ? affected : member) };
      events.push({ type: "volatileApplied", source: actor.side, target: side,
        effect: "perish-song", turns: 4, move: selectedMove.internalName });
    }
  }
  effects = reconcileExtremeWeather(effects, activeBattlerList(state, teams));
  return { events, trace, effects, damagedTargets };
}

function switchAt(teams: Record<BattleSide, BattleTeam>, actor: BattlePosition, teamIndex: number,
  rng: RandomSource, trace: DoubleTurnResult["trace"][number][], enteredMidTurn = true,
  reason: "voluntary" | "replacement" | "forced" = enteredMidTurn ? "voluntary" : "replacement",
  effects?: TeamBattleState["effects"]):
  { readonly events: readonly DoubleBattleEvent[]; readonly effects: TeamBattleState["effects"] } {
  const team = teams[actor.side];
  const indices = [...activeTeamIndices(team)];
  const fromIndex = indices[actor.slot];
  if (fromIndex === undefined || teamIndex < 0 || teamIndex >= team.members.length
    || indices.includes(teamIndex) || team.members[teamIndex]!.hp <= 0) throw new Error("Remplacement double invalide.");
  indices[actor.slot] = teamIndex;
  let healed = 0;
  const members = team.members.map((member, index) => {
    if (index !== fromIndex) return member;
    const outgoingAbility = member.ability;
    let originalAbility: BattlerState["ability"] | undefined;
    if (member.transformOriginal === undefined) {
      if (member.volatile?.abilityReplacementActive === true) originalAbility = member.volatile.originalAbility ?? null;
      else if (member.volatile?.traceOriginalAbility != null) originalAbility = member.volatile.traceOriginalAbility;
    }
    const originalTypes = member.transformOriginal === undefined ? member.volatile?.originalTypes : undefined;
    member = restoreAbilityForm(restoreTransformedBattler(restoreMimickedMoves(restoreMoveModifiedStats(member))));
    const { volatile: _volatile, illusion: _illusion, ...persistent } = member;
    const ability = originalAbility !== undefined ? originalAbility : member.ability;
    const hp = outgoingAbility === "REGENERATOR" && member.hp > 0
      ? Math.min(member.stats.maxHp, member.hp + Math.max(1, Math.floor(member.stats.maxHp / 3))) : member.hp;
    healed = hp - member.hp;
    return { ...persistent, ability, types: originalTypes ?? member.types,
      stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp, majorStatus: outgoingAbility === "NATURALCURE" ? null
      : member.majorStatus?.kind === "poison" && member.majorStatus.toxicCounter !== null
        ? { kind: "poison" as const, toxicCounter: 0 } : member.majorStatus };
  });
  teams[actor.side] = { ...team, activeIndex: indices[0]!, activeIndices: indices };
  teams[actor.side] = { ...teams[actor.side], members: members.map((member, index) =>
    index === teamIndex ? inheritSwitchEffects(team.members[fromIndex]!, member) : member) };
  const trappedSide = otherSide(actor.side);
  const trappedIndices = activeTeamIndices(teams[trappedSide]);
  teams[trappedSide] = { ...teams[trappedSide], members: teams[trappedSide].members.map((member, index) =>
    trappedIndices.includes(index) ? releaseSwitchTraps(team.members[fromIndex]!, member) : member) };
  const gasSuppressesIllusion = teams[actor.side].members[teamIndex]!.ability !== "NEUTRALIZINGGAS"
    && activeBattlerList({ turn: 1, status: "active", winner: null, format: "double", teams,
      replacementRequired: [], slotReplacements: [] }).some((active) =>
        active.hp > 0 && active.ability === "NEUTRALIZINGGAS");
  teams[actor.side] = applyIllusion(teams[actor.side], teamIndex, gasSuppressesIllusion);
  const output: DoubleBattleEvent[] = [];
  if (healed > 0) output.push({ type: "abilityActivated", side: actor.side,
    ability: "REGENERATOR", effect: "heal-on-switch" }, { type: "hpRestored", side: actor.side,
    source: "move", move: "REGENERATOR", amount: healed, hp: team.members[fromIndex]!.hp + healed });
  if (team.members[fromIndex]!.ability === "NATURALCURE" && team.members[fromIndex]!.majorStatus !== null) {
    output.push({ type: "abilityActivated", side: actor.side, ability: "NATURALCURE", effect: "cure-on-switch" },
      { type: "statusCured", side: actor.side, status: team.members[fromIndex]!.majorStatus!.kind });
  }
  output.push({ type: "pokemonSwitched", side: actor.side, fromIndex, toIndex: teamIndex,
    from: team.members[fromIndex]!.id, to: team.members[teamIndex]!.id, reason });
  const hazard = applyEntryHazards(teams[actor.side].members[teamIndex]!, actor.side, effects);
  teams[actor.side] = { ...teams[actor.side], members: teams[actor.side].members.map((member, index) =>
    index === teamIndex ? hazard.battler : member) };
  effects = hazard.effects;
  output.push(...hazard.events);
  if (hazard.battler.hp <= 0) return { events: output, effects };
  const cured = cureStatusBlockedByAbility(teams[actor.side].members[teamIndex]!);
  if (cured !== null) {
    teams[actor.side] = { ...teams[actor.side], members: teams[actor.side].members.map((member, index) =>
      index === teamIndex ? cured.battler : member) };
    output.push({ type: "abilityActivated", side: actor.side, ability: cured.ability, effect: "prevent-status" },
      { type: "statusCured", side: actor.side, status: cured.status });
  }
  const other = otherSide(actor.side);
  const opponentIndices = activeTeamIndices(teams[other]);
  const entry = resolveEntryAbility(actor.side, teams[actor.side].members[teamIndex]!,
    opponentIndices.map((index) => ({ side: other, battler: teams[other].members[index]! })), rng, trace,
    actor.side === "player", teams[actor.side].members[teamIndex]!.ability !== "NEUTRALIZINGGAS"
      && activeBattlerList({ turn: 1, status: "active", winner: null, format: "double", teams,
        replacementRequired: [], slotReplacements: [] }).some((active) =>
          active.hp > 0 && active.ability === "NEUTRALIZINGGAS"), effects);
  teams[actor.side] = { ...teams[actor.side], members: teams[actor.side].members.map((member, index) =>
    index === teamIndex ? entry.battler : member) };
  const updates = new Map(opponentIndices.map((index, position) => [index, entry.opponents[position]!.battler]));
  teams[other] = { ...teams[other], members: teams[other].members.map((member, index) => updates.get(index) ?? member) };
  if (enteredMidTurn) {
    teams[actor.side] = { ...teams[actor.side], members: teams[actor.side].members.map((member, index) =>
      index === teamIndex ? markEnteredMidTurn(member) : member) };
  }
  output.push(...entry.events);
  return { events: output, effects };
}

function applyEntryAbilities(teams: Record<BattleSide, BattleTeam>, actor: BattlePosition,
  effects: TeamBattleState["effects"]): { readonly events: readonly DoubleBattleEvent[];
    readonly effects: TeamBattleState["effects"] } {
  const index = activeTeamIndices(teams[actor.side])[actor.slot];
  if (index === undefined) return { events: [], effects };
  const active = teams[actor.side].members[index]!;
  if (active.hp <= 0) return { events: [], effects };
  const events: DoubleBattleEvent[] = [];
  if (active.ability === "IMPOSTER") {
    const targets = activeTeamIndices(teams[otherSide(actor.side)]);
    const targetIndex = targets[actor.slot] ?? targets[0];
    const target = targetIndex === undefined ? undefined : teams[otherSide(actor.side)].members[targetIndex];
    const transformed = target === undefined ? null : transformBattler(active, target);
    if (transformed !== null) {
      teams[actor.side] = { ...teams[actor.side], members: teams[actor.side].members.map((member, candidate) =>
        candidate === index ? transformed : member) };
      events.push({ type: "abilityActivated", side: actor.side, ability: "IMPOSTER", effect: "transform" });
    }
  }
  const field = applyEntryFieldAbility(active, actor.side, effects);
  effects = field.effects;
  events.push(...field.events);
  const weather = applyEntryWeatherAbility(active, actor.side, effects);
  effects = weather.effects;
  events.push(...weather.events);
  const entered = teams[actor.side].members[index]!;
  if (entered.ability === "WINDRIDER" && (effects?.sides[actor.side].tailwindTurns ?? 0) > 0) {
    const wind = activateWindAbility(entered, actor.side);
    teams[actor.side] = { ...teams[actor.side], members: teams[actor.side].members.map((member, candidate) =>
      candidate === index ? wind.battler : member) };
    events.push(...wind.events);
  }
  return { events, effects };
}

function applyDoubleEndOfTurn(state: TeamBattleState, teams: Record<BattleSide, BattleTeam>,
  effects: TeamBattleState["effects"],
  rng: RandomSource, trace: DoubleTurnResult["trace"][number][]): {
    readonly events: readonly DoubleBattleEvent[]; readonly effects: TeamBattleState["effects"];
  } {
  const output: DoubleBattleEvent[] = [];
  let nextPickupUse = effects?.nextPickupUse ?? 0;
  const weather = effectiveBattleWeather(effects?.weather, activeBattlerList(state, teams));
  for (const position of activeBattlePositions({ ...state, teams })) {
    const index = activeTeamIndices(teams[position.side])[position.slot]!;
    let battler = teams[position.side].members[index]!;
    if (battler.hp <= 0) continue;
    const inner: BattleEvent[] = [];
    const seededBy = battler.volatile?.leechSeededBy;
    const seededBySlot = battler.volatile?.leechSeededBySlot ?? 0;
    const hydrated = resolveHydration(battler, position.side, weather);
    battler = hydrated.battler;
    inner.push(...hydrated.events);
    const status = battler.majorStatus;
    if ((status?.kind === "poison" || status?.kind === "burn" || status?.kind === "frozen")
      && battler.ability !== "MAGICGUARD") {
      const poisonHeal = resolvePoisonHeal(battler, position.side);
      if (poisonHeal !== null) {
        battler = poisonHeal.battler;
        inner.push(...poisonHeal.events);
      } else {
        const nextStatus = status.kind === "poison" && status.toxicCounter !== null
          ? { kind: "poison" as const, toxicCounter: Math.min(15, status.toxicCounter + 1) } : status;
        let raw = nextStatus.kind === "burn" || nextStatus.kind === "frozen"
          ? Math.floor(battler.stats.maxHp / 16) : nextStatus.toxicCounter === null
            ? Math.floor(battler.stats.maxHp / 12) : Math.floor((battler.stats.maxHp * nextStatus.toxicCounter) / 16);
        if (nextStatus.kind === "poison" && activeTeamIndices(teams[otherSide(position.side)])
          .some((opposingIndex) => teams[otherSide(position.side)].members[opposingIndex]?.ability === "ALQUIMIAVIL")) raw *= 2;
        const amount = Math.min(battler.hp, Math.max(1, raw));
        battler = { ...battler, hp: battler.hp - amount, majorStatus: nextStatus };
        inner.push({ type: "statusDamage", side: position.side, status: nextStatus.kind, amount, hp: battler.hp });
      }
    } else if (status?.kind === "hemorrhage" || status?.kind === "caduco" && battler.hp <= Math.floor(battler.stats.maxHp / 2)) {
      inner.push({ type: "statusContinued", side: position.side, status: status.kind });
    }
    if (battler.hp > 0) {
      const volatile = resolveBattleVolatileEndOfTurn(battler, position.side, effects);
      battler = volatile.battler;
      inner.push(...volatile.events);
      const grassy = resolveGrassyTerrainHealing(battler, position.side, effects);
      battler = grassy.battler;
      inner.push(...grassy.events);
    }
    if (battler.hp > 0) {
      const weatherResult = resolveWeatherEndOfTurn(battler, position.side, weather, effects?.magicRoomTurns ?? 0);
      battler = weatherResult.battler;
      inner.push(...weatherResult.events);
    }
    if (battler.hp > 0) {
      const opposingBattlers = activeTeamIndices(teams[otherSide(position.side)])
        .map((opposingIndex) => teams[otherSide(position.side)].members[opposingIndex]!);
      const passive = resolveBattlePassiveEndOfTurn(battler, position.side, rng, trace,
        berriesBlockedBy(opposingBattlers), nextPickupUse, effects?.magicRoomTurns ?? 0);
      battler = passive.battler;
      nextPickupUse = passive.nextPickupUse;
      inner.push(...passive.events);
    }
    if (battler.hp > 0) {
      const opponents = activeTeamIndices(teams[otherSide(position.side)])
        .map((opposingIndex) => teams[otherSide(position.side)].members[opposingIndex]!);
      const late = resolveLateEndOfTurnAbilities(battler, position.side, opponents, rng, trace);
      battler = late.battler;
      inner.push(...late.events);
    }
    if (battler.hp === 0) inner.push({ type: "fainted", side: position.side });
    storeBattler(teams, position, battler);
    if (inner.length > 0) output.push({ type: "positionedActionResolved", actor: position, targets: [position], events: inner });
    const drained = inner.find((event): event is Extract<BattleEvent, { type: "leechSeedDamage" }> =>
      event.type === "leechSeedDamage");
    if (drained !== undefined && seededBy !== undefined && seededBy !== null) {
      const receiverPosition = { side: seededBy, slot: seededBySlot };
      const receiver = battlerAtPosition({ ...state, teams }, receiverPosition);
      if (receiver !== undefined && receiver.hp > 0 && (receiver.volatile?.healBlockTurns ?? 0) === 0) {
        const amount = Math.min(drained.amount, receiver.stats.maxHp - receiver.hp);
        if (amount > 0) {
          const healed = { ...receiver, hp: receiver.hp + amount };
          storeBattler(teams, receiverPosition, healed);
          output.push({ type: "positionedActionResolved", actor: receiverPosition, targets: [receiverPosition],
            events: [{ type: "hpRestored", side: seededBy, source: "move", move: "LEECHSEED",
              amount, hp: healed.hp }] });
        }
      }
    }
  }
  for (const position of activeBattlePositions({ ...state, teams })) {
    const healer = battlerAtPosition({ ...state, teams }, position);
    if (healer === undefined || healer.hp <= 0 || healer.ability !== "HEALER") continue;
    const partnerPosition = activeBattlePositions({ ...state, teams })
      .find((candidate) => candidate.side === position.side && candidate.slot !== position.slot);
    const partner = partnerPosition === undefined ? undefined
      : battlerAtPosition({ ...state, teams }, partnerPosition);
    const healed = resolveHealer(healer, partner, position.side, rng, trace);
    if (partnerPosition !== undefined && healed.partner !== undefined) {
      storeBattler(teams, partnerPosition, healed.partner);
    }
    if (healed.events.length > 0) output.push({ type: "positionedActionResolved", actor: position,
      targets: partnerPosition === undefined ? [] : [partnerPosition], events: healed.events });
  }
  for (const position of activeBattlePositions({ ...state, teams })) {
    const battler = battlerAtPosition({ ...state, teams }, position);
    if (battler === undefined || battler.hp <= 0 || battler.heldItem !== null) continue;
    let recovered = battler;
    let item: BattlerState["heldItem"] = null;
    let ability: "PICKUP" | "HARVEST" | null = null;
    if (battler.ability === "PICKUP") {
      const candidates = activeBattlePositions({ ...state, teams })
        .filter((candidate) => key(candidate) !== key(position))
        .map((candidate) => ({ position: candidate, battler: battlerAtPosition({ ...state, teams }, candidate)! }))
        .filter((candidate) => candidate.battler.volatile?.pickupItem !== null
          && candidate.battler.volatile?.pickupItem !== undefined)
        .sort((left, right) => (right.battler.volatile?.pickupUse ?? 0) - (left.battler.volatile?.pickupUse ?? 0));
      const source = candidates[0];
      if (source !== undefined && (source.battler.volatile?.pickupUse ?? 0) > 0) {
        item = source.battler.volatile!.pickupItem!;
        ability = "PICKUP";
        recovered = { ...battler, heldItem: item };
        storeBattler(teams, source.position, { ...source.battler,
          ...(source.battler.recyclableItem === item ? { recyclableItem: null } : {}),
          volatile: { ...source.battler.volatile!, pickupItem: null, pickupUse: 0 } });
      }
    } else if (battler.ability === "HARVEST" && isSupportedBerry(battler.recyclableItem ?? null)) {
      const succeeds = weather === "sun" || weather === "harsh-sun" || (() => {
        const value = rng.nextInt(10);
        trace.push({ type: "rng", purpose: "ability", maxExclusive: 10, value });
        return value < 5;
      })();
      if (succeeds) {
        item = battler.recyclableItem!;
        ability = "HARVEST";
        recovered = { ...battler, heldItem: item, recyclableItem: null };
      }
    }
    if (item === null || ability === null) continue;
    storeBattler(teams, position, recovered);
    const inner: BattleEvent[] = [
      { type: "abilityActivated", side: position.side, ability, effect: "recover-item" },
      { type: "heldItemRecovered", side: position.side, item, ability },
    ];
    if (isSupportedBerry(item)) {
      const opposingBattlers = activeTeamIndices(teams[otherSide(position.side)])
        .map((index) => teams[otherSide(position.side)].members[index]!);
      const activated = resolveBattlePassiveEndOfTurn(recovered, position.side, rng, trace,
        berriesBlockedBy(opposingBattlers), nextPickupUse, effects?.magicRoomTurns ?? 0);
      nextPickupUse = activated.nextPickupUse;
      storeBattler(teams, position, activated.battler);
      inner.push(...activated.events);
    }
    output.push({ type: "positionedActionResolved", actor: position, targets: [position], events: inner });
  }
  const baseEffects = effects ?? { sides: {
    player: { reflectTurns: 0, luckyChantTurns: 0 }, opponent: { reflectTurns: 0, luckyChantTurns: 0 },
  }, waterSportTurns: 0 };
  return { events: output, effects: { ...baseEffects, nextPickupUse } };
}

/** Resolves every active slot in one global priority/speed order. Singles keep using resolveTeamTurn. */
export function resolveDoubleTeamTurn(state: TeamBattleState, submitted: readonly PositionedTeamBattleAction[],
  rng: RandomSource, itemPolicy: PokemonItemUsePolicy = { context: "battle", revivalAllowed: true },
  rules: BattleResolutionRules = { opponentItemTheft: true }): DoubleTurnResult {
  if (state.status !== "active" || state.format !== "double") throw new Error("Combat double actif attendu.");
  if ((state.slotReplacements?.length ?? 0) > 0) throw new Error("Les remplacements doubles doivent etre resolus avant le tour.");
  state = initializeMegaEvolutionState(state);
  let teams: Record<BattleSide, BattleTeam> = { player: cloneTeam(state.teams.player), opponent: cloneTeam(state.teams.opponent) };
  const required = activeBattlePositions(state).filter((position) => (battlerAtPosition(state, position)?.hp ?? 0) > 0);
  const effectiveSubmitted = submitted.map((entry): PositionedTeamBattleAction => {
    const battler = battlerAtPosition(state, entry.actor);
    const volatile = battler?.volatile;
    if (battler === undefined || volatile === undefined) return entry;
    if ((volatile.rechargeTurns ?? 0) > 0 || volatile.skyDropCarrierId != null
      || volatile.skyDropLockedTurn === state.turn) return { ...entry,
      action: { kind: "move", moveIndex: 0 } };
    if (volatile.chargingMove != null) {
      const moveIndex = battler.moves.findIndex((slot) => slot.move.internalName === volatile.chargingMove);
      if (moveIndex >= 0) return { ...entry, action: { kind: "move", moveIndex,
        ...(entry.action.kind === "move" && entry.action.target !== undefined
          ? { target: entry.action.target } : {}) } };
    }
    if (entry.action.kind !== "move") return entry;
    const lockedMove = volatile.chargingMove != null ? volatile.chargingMove
      : (volatile.rolloutTurns ?? 0) > 0
      ? battler.moves.find((slot) => slot.move.functionCode === "0D3")?.move.internalName
      : (volatile.outrageTurns ?? 0) > 0
        ? battler.moves.find((slot) => slot.move.functionCode === "0D2")?.move.internalName
      : (volatile.bideTurns ?? 0) > 0
        ? battler.moves.find((slot) => slot.move.functionCode === "0D4")?.move.internalName
      : (volatile.uproarTurns ?? 0) > 0
        ? battler.moves.find((slot) => slot.move.functionCode === "0D1")?.move.internalName
        : volatile.encoreTurns > 0 ? volatile.encoreMove : null;
    if (lockedMove === null || lockedMove === undefined) return entry;
    const moveIndex = battler.moves.findIndex((slot) => slot.move.internalName === lockedMove
      && (slot.pp > 0 || volatile.chargingMove != null || (volatile.bideTurns ?? 0) > 0 || (volatile.outrageTurns ?? 0) > 0));
    return moveIndex < 0 ? entry : { ...entry, action: { ...entry.action, moveIndex } };
  });
  const byActor = new Map(effectiveSubmitted.map((entry) => [key(entry.actor), entry]));
  const requiredKeys = new Set(required.map(key));
  if (byActor.size !== effectiveSubmitted.length || byActor.size !== requiredKeys.size
    || required.some((position) => !byActor.has(key(position)))
    || effectiveSubmitted.some((entry) => !requiredKeys.has(key(entry.actor)))) {
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
  for (const position of activeBattlePositions({ ...state, teams })) {
    const battler = battlerAtPosition({ ...state, teams }, position)!;
    const other = otherSide(position.side);
    const opponentPositions = activeTeamIndices(teams[other]).map((_, slot) => ({ side: other, slot }));
    const entry = resolveEntryAbility(position.side, battler, opponentPositions.map((target) => ({ side: target.side,
      battler: battlerAtPosition({ ...state, teams }, target)! })), rng, trace,
      position.side === "player", battler.ability !== "NEUTRALIZINGGAS"
        && activeBattlerList(state, teams).some((active) =>
          active.hp > 0 && active.ability === "NEUTRALIZINGGAS"), state.effects);
    storeBattler(teams, position, entry.battler);
    entry.opponents.forEach((target, index) => storeBattler(teams, opponentPositions[index]!, target.battler));
    if (entry.events.length > 0) events.push({ type: "positionedActionResolved", actor: position,
      targets: opponentPositions, events: entry.events });
  }
  for (const position of activeBattlePositions({ ...state, teams })) {
    let battler = battlerAtPosition({ ...state, teams }, position)!;
    const inner: BattleEvent[] = [];
    const cured = cureStatusBlockedByAbility(battler);
    if (cured !== null) {
      battler = cured.battler;
      inner.push({ type: "abilityActivated", side: position.side, ability: cured.ability, effect: "prevent-status" },
        { type: "statusCured", side: position.side, status: cured.status });
    }
    if (battler.ability === "OWNTEMPO" && (battler.volatile?.confusionTurns ?? 0) > 0) {
      battler = { ...battler, volatile: { ...battler.volatile!, confusionTurns: 0 } };
      inner.push({ type: "abilityActivated", side: position.side, ability: "OWNTEMPO", effect: "prevent-confusion" },
        { type: "volatileEnded", side: position.side, effect: "confusion" });
    }
    if (inner.length > 0) {
      storeBattler(teams, position, battler);
      events.push({ type: "positionedActionResolved", actor: position, targets: [position], events: inner });
    }
  }
  let effects = state.effects;
  for (const entry of switchEntries) {
    const switching = battlerAtPosition({ ...state, teams }, entry.actor);
    if (switching === undefined) throw new Error("Combattant double absent.");
    const opponents = activeTeamIndices(teams[otherSide(entry.actor.side)])
      .map((index) => teams[otherSide(entry.actor.side)].members[index]!);
    assertVoluntarySwitchAllowed(switching, opponents, effects?.magicRoomTurns ?? 0);
  }
  const pursuitKeys = new Set<string>();
  for (const entry of effectiveSubmitted) {
    if (entry.action.kind !== "move") continue;
    const attacker = battlerAtPosition({ ...state, teams }, entry.actor);
    if (attacker?.moves[entry.action.moveIndex]?.move.functionCode !== "088") continue;
    const target = moveTargets({ ...state, teams }, entry.actor, entry.action, rng)
      .find((candidate) => effectiveSubmitted.some((submitted) => key(submitted.actor) === key(candidate)
        && submitted.action.kind === "switch"));
    if (target === undefined) continue;
    const result = executeMove(state, teams, entry.actor, entry.action, [target], rng, effectiveSubmitted, effects, rules);
    effects = result.effects;
    events.push({ type: "positionedActionResolved", actor: entry.actor, targets: [target], events: result.events });
    trace.push(...result.trace);
    pursuitKeys.add(key(entry.actor));
  }
  for (const entry of switchEntries) {
    const switched = switchAt(teams, entry.actor,
      (entry.action as Extract<TeamBattleAction, {kind:"switch"}>).teamIndex, rng, trace,
      true, "voluntary", effects);
    events.push(...switched.events);
    effects = switched.effects;
    const entered = applyEntryAbilities(teams, entry.actor, effects);
    effects = entered.effects;
    events.push(...entered.events);
  }
  effects = reconcileExtremeWeather(effects, activeBattlerList(state, teams));
  for (const entry of itemEntries) {
    const action = entry.action as Extract<TeamBattleAction, { kind: "item" }>;
    const team = teams[entry.actor.side];
    const target = team.members[action.targetTeamIndex];
    if (target === undefined) throw new Error("Cible d'objet double invalide.");
    if ((effects?.magicRoomTurns ?? 0) > 0) throw new Error(`Item ${action.itemId} cannot be used: Magic Room.`);
    if ((target.volatile?.embargoTurns ?? 0) > 0) throw new Error(`Objet ${action.itemId} inutilisable : embargo.`);
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
  let moves = effectiveSubmitted.filter((entry): entry is PositionedTeamBattleAction & { action: Extract<TeamBattleAction, {kind:"move"}> } =>
    entry.action.kind === "move" && !pursuitKeys.has(key(entry.actor)))
    .map((entry) => { let battler = battlerAtPosition({ ...state, teams }, entry.actor)!;
      const move = battler.moves[entry.action.moveIndex]?.move;
      if (move === undefined) throw new Error("Capacite double invalide.");
      const priority = effectiveMovePriority(battler, move, effects?.terrain);
      const opponents = activeTeamIndices(teams[otherSide(entry.actor.side)])
        .map((index) => teams[otherSide(entry.actor.side)].members[index]!);
      const custap = custapBerryReady(battler, opponents, effects?.magicRoomTurns ?? 0);
      if (custap) {
        const nextPickupUse = (effects?.nextPickupUse ?? 0) + 1;
        battler = consumeHeldItem(battler, "CUSTAPBERRY", nextPickupUse);
        storeBattler(teams, entry.actor, battler);
        effects = { sides: effects?.sides ?? { player: { reflectTurns: 0, luckyChantTurns: 0 },
          opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: effects?.waterSportTurns ?? 0,
          ...effects, nextPickupUse };
        events.push({ type: "positionedActionResolved", actor: entry.actor, targets: [entry.actor], events: [
          { type: "itemActivated", side: entry.actor.side, item: "CUSTAPBERRY", effect: "boost",
            amount: 0, hp: battler.hp },
          { type: "heldItemConsumed", side: entry.actor.side, item: "CUSTAPBERRY", effect: "boost",
            hp: battler.hp },
        ] });
      }
      return { ...entry, priority, custap, lagging: battler.ability === "STALL", speed: effectiveSpeed(battler, effects,
        hasWeatherSuppressor(activeBattlerList(state, teams)), entry.actor.side), tie: rng.nextInt(1_000_000) }; })
    .sort((left, right) => right.priority - left.priority
      || (left.custap !== right.custap ? left.custap ? -1 : 1 : 0)
      || (left.lagging !== right.lagging ? left.lagging ? 1 : -1 : 0)
      || (left.lagging && right.lagging ? left.speed - right.speed
        : (effects?.trickRoomTurns ?? 0) > 0 ? left.speed - right.speed : right.speed - left.speed)
      || left.tie - right.tie);
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
  const damagedPositions = new Set<string>();
  const helpedPositions = new Set<string>();
  const resolvedPositions = new Set<string>();
  const roundUses: Record<BattleSide, number> = { player: 0, opponent: 0 };
  for (let moveIndex = 0; moveIndex < moves.length; moveIndex += 1) {
    const entry = moves[moveIndex]!;
    const liveState: TeamBattleState = { ...state, teams, ...(effects === undefined ? {} : { effects }) };
    if ((battlerAtPosition(liveState, entry.actor)?.hp ?? 0) <= 0) continue;
    const calledMove = calledMoveForAction(liveState, entry.actor, entry.action, effectiveSubmitted,
      resolvedPositions, rng, trace);
    const targets = moveTargets(liveState, entry.actor, entry.action, rng, calledMove);
    const actor = battlerAtPosition(liveState, entry.actor)!;
    const selectedMove = calledMove ?? actor.moves[entry.action.moveIndex]!.move;
    if (selectedMove.functionCode === "09C") {
      const target = targets[0];
      const targetSubmission = target === undefined ? undefined
        : effectiveSubmitted.find((candidate) => key(candidate.actor) === key(target));
      const valid = target !== undefined && target.side === entry.actor.side
        && targetSubmission?.action.kind === "move" && !resolvedPositions.has(key(target));
      const nextActor = { ...actor, moves: actor.moves.map((slot, moveIndex) => moveIndex === entry.action.moveIndex
        ? { ...slot, pp: Math.max(0, slot.pp - 1) } : slot) };
      storeBattler(teams, entry.actor, nextActor);
      const inner: BattleEvent[] = [
        { type: "moveUsed", side: entry.actor.side, move: selectedMove.internalName },
        { type: "ppChanged", side: entry.actor.side, move: selectedMove.internalName,
          pp: nextActor.moves[entry.action.moveIndex]!.pp },
      ];
      if (valid) {
        helpedPositions.add(key(target));
        inner.push({ type: "volatileApplied", source: entry.actor.side, target: entry.actor.side,
          effect: "helping-hand", turns: 1, move: selectedMove.internalName });
      } else inner.push({ type: "moveFailed", side: entry.actor.side, move: selectedMove.internalName,
        reason: "condition" });
      events.push({ type: "positionedActionResolved", actor: entry.actor,
        targets: target === undefined ? [] : [target], events: inner });
      resolvedPositions.add(key(entry.actor));
      continue;
    }
    const result = executeMove(state, teams, entry.actor, entry.action, targets, rng, effectiveSubmitted, effects, rules, {
      damagedPositions,
      resolvedPositions,
      roundMultiplier: selectedMove.functionCode === "083" ? 2 ** roundUses[entry.actor.side] : 1,
      helpingHandMultiplier: helpedPositions.has(key(entry.actor)) ? 1.5 : 1,
      calledMove,
    });
    effects = result.effects;
    const presentedTargets = selectedMove.functionCode === "05B"
      ? activeTeamIndices(teams[entry.actor.side]).map((_, slot) => ({ side: entry.actor.side, slot })) : targets;
    events.push({ type: "positionedActionResolved", actor: entry.actor, targets: presentedTargets, events: result.events });
    if (result.events.some((event) => event.type === "battleEscaped")) {
      trace.push(...result.trace);
      events.push({ type: "turnEnded", turn: state.turn });
      return { state: { ...state, turn: state.turn + 1, teams, status: "finished", winner: null,
        replacementRequired: [], slotReplacements: [] }, events, trace };
    }
    if (selectedMove.functionCode === "074" && targets[0] !== undefined
      && result.events.some((event) => event.type === "damageApplied" && event.amount > 0)) {
      const target = targets[0];
      const partnerSlot = activeTeamIndices(teams[target.side]).findIndex((_, slot) => slot !== target.slot);
      const partnerIndex = activeTeamIndices(teams[target.side])[partnerSlot];
      const partner = partnerIndex === undefined ? undefined : teams[target.side].members[partnerIndex];
      const gasActive = activeBattlerList({ ...state, teams }, teams)
        .some((active) => active.hp > 0 && active.ability === "NEUTRALIZINGGAS");
      if (partner !== undefined && partner.hp > 0 && (partner.ability !== "MAGICGUARD" || gasActive)) {
        const amount = Math.min(partner.hp, Math.max(1, Math.floor(partner.stats.maxHp / 16)));
        storeBattler(teams, { side: target.side, slot: partnerSlot }, { ...partner, hp: partner.hp - amount });
        const partnerPosition = { side: target.side, slot: partnerSlot };
        events.push({ type: "positionedActionResolved", actor: entry.actor, targets: [partnerPosition],
          events: [{ type: "collateralDamage", source: entry.actor.side, target: target.side,
            move: selectedMove.internalName, amount, hp: partner.hp - amount },
          ...(partner.hp === amount ? [{ type: "fainted" as const, side: target.side }] : [])] });
        damagedPositions.add(key(partnerPosition));
      }
    }
    if (selectedMove.functionCode === "051"
      && result.events.some((event) => event.type === "moveUsed" && event.move === selectedMove.internalName)
      && !result.events.some((event) => event.type === "moveFailed")) {
      for (const position of activeBattlePositions({ ...state, teams })) {
        if (key(position) === key(entry.actor)) continue;
        const current = battlerAtPosition({ ...state, teams }, position);
        if (current === undefined || current.hp <= 0) continue;
        const cleared = clearStatStages(current);
        storeBattler(teams, position, cleared.battler);
        if (cleared.changes.length === 0) continue;
        events.push({ type: "positionedActionResolved", actor: entry.actor, targets: [position],
          events: cleared.changes.map((change) => ({ type: "statStageChanged" as const,
            source: entry.actor.side, target: position.side, stat: change.stat, delta: change.delta, stage: 0 })) });
      }
    }
    if (selectedMove.functionCode === "03D"
      && result.events.some((event) => event.type === "damageApplied" && event.amount > 0)) {
      const partnerSlot = activeTeamIndices(teams[entry.actor.side]).findIndex((_, slot) => slot !== entry.actor.slot);
      const partnerIndex = activeTeamIndices(teams[entry.actor.side])[partnerSlot];
      const partner = partnerIndex === undefined ? undefined : teams[entry.actor.side].members[partnerIndex];
      if (partner !== undefined && partner.hp > 0) {
        const amount = Math.min(partner.hp, Math.floor(partner.stats.maxHp / 16));
        if (amount > 0) {
          storeBattler(teams, { side: entry.actor.side, slot: partnerSlot }, { ...partner, hp: partner.hp - amount });
          const partnerPosition = { side: entry.actor.side, slot: partnerSlot };
          events.push({ type: "positionedActionResolved", actor: entry.actor, targets: [partnerPosition],
            events: [{ type: "recoilDamage", side: entry.actor.side, move: selectedMove.internalName,
              reason: "recoil", amount, hp: partner.hp - amount },
              ...(partner.hp === amount ? [{ type: "fainted" as const, side: entry.actor.side }] : [])] });
          damagedPositions.add(`${entry.actor.side}:${partnerSlot}`);
        }
      }
    }
    trace.push(...result.trace);
    for (const targetKey of result.damagedTargets) damagedPositions.add(targetKey);
    if (selectedMove.functionCode === "083"
      && result.events.some((event) => event.type === "damageApplied" && event.amount > 0)) {
      roundUses[entry.actor.side] += 1;
      // Pokemon Z advances the allied Round only after the first one dealt
      // damage; a miss leaves the ally at its normal initiative position.
      const partnerIndex = moves.findIndex((candidate, candidateIndex) => candidateIndex > moveIndex
        && candidate.actor.side === entry.actor.side
        && battlerAtPosition({ ...state, teams }, candidate.actor)
          ?.moves[candidate.action.moveIndex]?.move.functionCode === "083");
      if (partnerIndex > moveIndex + 1) {
        const [partner] = moves.splice(partnerIndex, 1);
        if (partner !== undefined) moves.splice(moveIndex + 1, 0, partner);
      }
    }
    helpedPositions.delete(key(entry.actor));
    resolvedPositions.add(key(entry.actor));
  }
  const activeBeforeEnd = activeBattlePositions({ ...state, teams });
  for (const position of activeBeforeEnd) {
    const current = battlerAtPosition({ ...state, teams }, position)!;
    const carrierId = current.volatile?.skyDropCarrierId;
    if (carrierId == null) continue;
    const carrier = activeBeforeEnd.map((candidate) => battlerAtPosition({ ...state, teams }, candidate)!)
      .find((candidate) => candidate.id === carrierId);
    if (carrier !== undefined && carrier.hp > 0
      && carrier.volatile?.chargingTargetId === current.id) continue;
    storeBattler(teams, position, { ...current, volatile: { ...current.volatile!, skyDropCarrierId: null } });
    events.push({ type: "positionedActionResolved", actor: position, targets: [position], events: [
      { type: "volatileEnded", side: position.side, effect: "sky-drop" }] });
  }
  for (const position of activeBeforeEnd) {
    const current = battlerAtPosition({ ...state, teams }, position)!;
    const targetId = current.volatile?.chargingTargetId;
    if (targetId == null) continue;
    const target = activeBeforeEnd.map((candidate) => battlerAtPosition({ ...state, teams }, candidate)!)
      .find((candidate) => candidate.id === targetId);
    if (target !== undefined && target.hp > 0 && target.volatile?.skyDropCarrierId === current.id) continue;
    storeBattler(teams, position, { ...current, volatile: { ...current.volatile!,
      chargingMove: null, chargingCalledMove: null, chargingTargetId: null } });
  }
  const endOfTurn = applyDoubleEndOfTurn(state, teams, effects, rng, trace);
  events.push(...endOfTurn.events);
  effects = endOfTurn.effects;
  effects = reconcileExtremeWeather(effects, activeBattlerList(state, teams));
  let winner: BattleSide | null = null;
  const livingSides = SIDES.filter((side) => teams[side].members.some((member) => member.hp > 0));
  if (livingSides.length === 1) winner = livingSides[0]!;
  const draw = livingSides.length === 0;
  const slotReplacements: BattlePosition[] = [];
  const requestedPivots = events.flatMap((event) => event.type === "positionedActionResolved"
    ? event.events.flatMap((inner) => inner.type === "forcedSwitchRequested"
      ? [inner.side === event.actor.side ? event.actor
        : event.targets.find((target) => target.side === inner.side)].filter((position): position is BattlePosition =>
          position !== undefined) : []) : [])
    .filter((position, index, all) => all.findIndex((candidate) => key(candidate) === key(position)) === index);
  const viablePivots = requestedPivots.filter((position) => {
    const battler = battlerAtPosition({ ...state, teams }, position);
    const active = activeTeamIndices(teams[position.side]);
    return (battler?.hp ?? 0) > 0 && teams[position.side].members.some((member, index) =>
      member.hp > 0 && !active.includes(index));
  });
  if (winner === null) for (const side of SIDES) {
    const team = teams[side];
    const active = activeTeamIndices(team);
    const reserves = team.members.map((member, index) => ({ member, index }))
      .filter(({ member, index }) => member.hp > 0 && !active.includes(index));
    active.forEach((index, slot) => {
      // Les slots restent stables pendant tout le combat : un K.O. sans réserve
      // demeure un emplacement visuel vide afin que son allié ne change pas de
      // côté. Il n'est toutefois ni jouable, ni proposé comme remplacement.
      const faintedAlreadyQueued = slotReplacements.filter((position) => position.side === side).length;
      if (team.members[index]!.hp <= 0 && reserves.length > faintedAlreadyQueued) {
        slotReplacements.push({ side, slot });
      }
    });
  }
  const slotPivotReplacements: BattlePosition[] = [];
  if (winner === null) for (const position of viablePivots) {
    const team = teams[position.side];
    const active = activeTeamIndices(team);
    const reserveCount = team.members.filter((member, index) => member.hp > 0 && !active.includes(index)).length;
    if (reserveCount <= slotReplacements.filter((candidate) => candidate.side === position.side).length) continue;
    slotReplacements.push(position);
    slotPivotReplacements.push(position);
  }
  if (draw) events.push({ type: "battleEnded", winner: null });
  else if (winner !== null) events.push({ type: "battleEnded", winner });
  if (effects !== undefined) effects = { ...effects, sides: {
    player: { ...effects.sides.player, reflectTurns: Math.max(0, effects.sides.player.reflectTurns - 1),
      lightScreenTurns: Math.max(0, (effects.sides.player.lightScreenTurns ?? 0) - 1),
      luckyChantTurns: Math.max(0, effects.sides.player.luckyChantTurns - 1),
      mistTurns: Math.max(0, (effects.sides.player.mistTurns ?? 0) - 1),
      safeguardTurns: Math.max(0, (effects.sides.player.safeguardTurns ?? 0) - 1),
      tailwindTurns: Math.max(0, (effects.sides.player.tailwindTurns ?? 0) - 1), quickGuard: false, wideGuard: false },
    opponent: { ...effects.sides.opponent, reflectTurns: Math.max(0, effects.sides.opponent.reflectTurns - 1),
      lightScreenTurns: Math.max(0, (effects.sides.opponent.lightScreenTurns ?? 0) - 1),
      luckyChantTurns: Math.max(0, effects.sides.opponent.luckyChantTurns - 1),
      mistTurns: Math.max(0, (effects.sides.opponent.mistTurns ?? 0) - 1),
      safeguardTurns: Math.max(0, (effects.sides.opponent.safeguardTurns ?? 0) - 1),
      tailwindTurns: Math.max(0, (effects.sides.opponent.tailwindTurns ?? 0) - 1), quickGuard: false, wideGuard: false },
  }, fusionBoltTurn: null, fusionFlareTurn: null,
  mudSportTurns: Math.max(0, (effects.mudSportTurns ?? 0) - 1),
  waterSportTurns: Math.max(0, effects.waterSportTurns - 1),
  terrain: (effects.terrainTurns ?? 0) <= 1 ? null : effects.terrain ?? null,
  terrainTurns: Math.max(0, (effects.terrainTurns ?? 0) - 1),
  trickRoomTurns: Math.max(0, (effects.trickRoomTurns ?? 0) - 1),
  magicRoomTurns: Math.max(0, (effects.magicRoomTurns ?? 0) - 1),
  wonderRoomTurns: Math.max(0, (effects.wonderRoomTurns ?? 0) - 1),
  gravityTurns: Math.max(0, (effects.gravityTurns ?? 0) - 1),
  weather: (effects.weatherTurns ?? 0) < 0 ? effects.weather ?? null
    : (effects.weatherTurns ?? 0) <= 1 ? null : effects.weather ?? null,
  weatherTurns: (effects.weatherTurns ?? 0) < 0 ? effects.weatherTurns ?? -1 : Math.max(0, (effects.weatherTurns ?? 0) - 1) };
  if ((state.effects?.gravityTurns ?? 0) === 1) events.push({ type: "battleEffectChanged",
    side: null, effect: "gravity", turns: 0 });
  if ((state.effects?.terrainTurns ?? 0) === 1) events.push({ type: "battleEffectChanged",
    side: null, effect: "terrain", turns: 0 });
  if ((state.effects?.wonderRoomTurns ?? 0) === 1) events.push({ type: "battleEffectChanged",
    side: null, effect: "wonder-room", turns: 0 });
  events.push(...reconcileDoubleForms(state, teams, effects));
  effects = recordSideFaints(effects, state.teams, teams, state.turn);
  events.push({ type: "turnEnded", turn: state.turn });
  return { state: { ...state, turn: state.turn + 1, teams, winner,
    status: winner === null && !draw ? "active" : "finished", replacementRequired: [],
    slotReplacements: winner === null ? slotReplacements : [],
    slotPivotReplacements: winner === null ? slotPivotReplacements : [],
    ...(effects === undefined ? {} : { effects }) }, events, trace };
}

export function replaceFaintedDoublePokemon(state: TeamBattleState, position: BattlePosition,
  teamIndex: number, rng: RandomSource = { nextInt: () => 0 }): TeamBattleState {
  if (state.format !== "double" || !state.slotReplacements?.some((entry) => key(entry) === key(position))) {
    throw new Error("Aucun remplacement n'est requis a cet emplacement.");
  }
  const teams: Record<BattleSide, BattleTeam> = { player: cloneTeam(state.teams.player), opponent: cloneTeam(state.teams.opponent) };
  const switched = switchAt(teams, position, teamIndex, rng, [], false,
    state.slotPivotReplacements?.some((entry) => key(entry) === key(position)) ? "forced" : "replacement",
    state.effects);
  const entered = applyEntryAbilities(teams, position, switched.effects);
  const effects = reconcileExtremeWeather(entered.effects, activeBattlerList(state, teams));
  const formEvents = reconcileDoubleForms(state, teams, effects);
  void formEvents;
  const activeIndex = activeTeamIndices(teams[position.side])[position.slot];
  const fainted = activeIndex !== undefined && teams[position.side].members[activeIndex]!.hp <= 0;
  const reserveAvailable = teams[position.side].members.some((member, index) => member.hp > 0
    && !activeTeamIndices(teams[position.side]).includes(index));
  const awaitingReplacement = fainted && reserveAvailable;
  const defeated = fainted && !reserveAvailable;
  return { ...state, teams, ...(effects === undefined ? {} : { effects }),
    ...(defeated ? { status: "finished" as const, winner: otherSide(position.side) } : {}),
    slotReplacements: awaitingReplacement ? state.slotReplacements
      : state.slotReplacements.filter((entry) => key(entry) !== key(position)),
    slotPivotReplacements: state.slotPivotReplacements?.filter((entry) => key(entry) !== key(position)) ?? [] };
}
