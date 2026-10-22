import { resolveSelectedMoves } from "./resolve-turn.js";
import { cureStatusBlockedByAbility } from "./ability-protection.js";
import { resolveEntryAbility } from "./ability-entry.js";
import { applyEntryFieldAbility } from "./ability-field-entry.js";
import { activateWindAbility } from "./ability-wind.js";
import { applyEntryWeatherAbility, effectiveBattleWeather, hasWeatherSuppressor, reconcileExtremeWeather } from "./ability-weather.js";
import { applyPokemonItemEffect, type PokemonItemUsePolicy } from "./pokemon-item.js";
import { attemptPokemonCapture } from "./pokemon-capture.js";
import { initializeMegaEvolutionState, resolveMegaEvolutionIntents } from "./mega-evolution.js";
import { restoreMimickedMoves, restoreMoveModifiedStats, restoreTransformedBattler,
  transformBattler } from "./battle-transform.js";
import { markEnteredMidTurn } from "./ability-end-turn.js";
import { assertVoluntarySwitchAllowed } from "./ability-switch-trap.js";
import { reconcileAbilityForm, restoreAbilityForm } from "./ability-form.js";
import { applyIllusion } from "./ability-illusion.js";
import type {
  BattleResolutionRules,
  BattleEvent,
  BattleSide,
  BattleState,
  BattleTeam,
  BattlerState,
  MoveAction,
  RandomSource,
  StatStages,
  TeamBattleEvent,
  TeamBattleState,
  TeamReplacementResult,
  TeamTurnActions,
  TeamTurnResult,
} from "./types.js";

const SIDES = ["player", "opponent"] as const;
export const MAX_TEAM_SIZE = 6;

const ZERO_STAGES: StatStages = {
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
  accuracy: 0,
  evasion: 0,
};

function opponentOf(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function cloneBattler(battler: BattlerState): BattlerState {
  return {
    ...battler,
    types: [...battler.types],
    stats: { ...battler.stats },
    stages: { ...battler.stages },
    majorStatus: battler.majorStatus === null ? null : { ...battler.majorStatus },
    ...(battler.volatile === undefined ? {} : { volatile: { ...battler.volatile } }),
    ...(battler.transformOriginal === undefined ? {} : {
      transformOriginal: {
        ...battler.transformOriginal,
        types: [...battler.transformOriginal.types],
        stats: { ...battler.transformOriginal.stats },
        moves: battler.transformOriginal.moves.map((slot) => ({ ...slot, move: { ...slot.move } })),
      },
    }),
    ...(battler.sketchedMoveSlots === undefined ? {} : { sketchedMoveSlots: battler.sketchedMoveSlots.map((entry) => ({
      index: entry.index, move: { ...entry.move },
    })) }),
    moves: battler.moves.map((slot) => ({ ...slot, move: { ...slot.move } })),
  };
}

function cloneTeam(team: BattleTeam): BattleTeam {
  return { activeIndex: team.activeIndex,
    ...(team.activeIndices === undefined ? {} : { activeIndices: [...team.activeIndices] }),
    ...(team.items === undefined ? {} : { items: [...team.items] }),
    members: team.members.map(cloneBattler) };
}

function consumeTrainerItem(team: BattleTeam, itemId: string): BattleTeam {
  if (team.items === undefined) return team;
  const index = team.items.indexOf(itemId);
  if (index < 0) return team;
  return { ...team, items: team.items.filter((_, candidate) => candidate !== index) };
}

function cloneTeams(state: TeamBattleState): Record<BattleSide, BattleTeam> {
  return { player: cloneTeam(state.teams.player), opponent: cloneTeam(state.teams.opponent) };
}

function validateTeam(team: BattleTeam, side: BattleSide): void {
  if (team.members.length < 1 || team.members.length > MAX_TEAM_SIZE) {
    throw new RangeError(`${side} team must contain between 1 and ${MAX_TEAM_SIZE} Pokemon.`);
  }
  if (!Number.isInteger(team.activeIndex) || team.activeIndex < 0 || team.activeIndex >= team.members.length) {
    throw new RangeError(`Invalid active Pokemon index for ${side}.`);
  }
  if (team.activeIndices !== undefined && (team.activeIndices.length < 1 || team.activeIndices.length > 2
    || new Set(team.activeIndices).size !== team.activeIndices.length
    || team.activeIndices[0] !== team.activeIndex
    || team.activeIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= team.members.length))) {
    throw new RangeError(`Invalid active Pokemon indices for ${side}.`);
  }
  const ids = new Set<string>();
  for (const member of team.members) {
    if (ids.has(member.id)) throw new Error(`Duplicate Pokemon id in ${side} team: ${member.id}.`);
    ids.add(member.id);
    if (member.hp < 0 || member.hp > member.stats.maxHp) throw new RangeError(`Invalid HP for ${member.id}.`);
  }
}

function activePokemon(team: BattleTeam): BattlerState {
  const active = team.members[team.activeIndex];
  if (active === undefined) throw new RangeError("Active Pokemon is missing from its team.");
  return active;
}

function livingReserve(team: BattleTeam): boolean {
  return team.members.some((member, index) => index !== team.activeIndex && member.hp > 0);
}

function validateState(state: TeamBattleState): void {
  validateTeam(state.teams.player, "player");
  validateTeam(state.teams.opponent, "opponent");
  if (state.status !== "active") throw new Error("Cannot resolve a finished team battle.");
  const required = new Set(state.replacementRequired);
  if (required.size !== state.replacementRequired.length) throw new Error("Duplicate replacement requirement.");
  for (const side of SIDES) {
    const active = activePokemon(state.teams[side]);
    if (required.has(side)) {
      const pivot = state.pivotRequired?.includes(side) === true;
      if ((!pivot && active.hp !== 0) || (pivot && active.hp <= 0) || !livingReserve(state.teams[side])) {
        throw new Error(`Invalid replacement state for ${side}.`);
      }
    } else if (active.hp === 0) {
      throw new Error(`Fainted active Pokemon requires replacement for ${side}.`);
    }
  }
}

function validateSwitch(team: BattleTeam, teamIndex: number, side: BattleSide): void {
  if (!Number.isInteger(teamIndex) || teamIndex < 0 || teamIndex >= team.members.length) {
    throw new RangeError(`Invalid switch index for ${side}.`);
  }
  if (teamIndex === team.activeIndex) throw new Error(`The active Pokemon is already selected for ${side}.`);
  if (team.members[teamIndex]?.hp === 0) throw new Error(`Cannot switch ${side} to a fainted Pokemon.`);
}

function switchPokemon(
  teams: Record<BattleSide, BattleTeam>,
  side: BattleSide,
  toIndex: number,
  reason: "voluntary" | "replacement" | "forced",
  rng: RandomSource,
  trace: TeamTurnResult["trace"][number][],
  effects: TeamBattleState["effects"],
): readonly TeamBattleEvent[] {
  const team = teams[side];
  validateSwitch(team, toIndex, side);
  const fromIndex = team.activeIndex;
  const from = activePokemon(team);
  const to = team.members[toIndex];
  if (to === undefined) throw new RangeError(`Invalid switch index for ${side}.`);
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
    const curedStatus = outgoingAbility === "NATURALCURE" ? null
      : member.majorStatus?.kind === "poison" && member.majorStatus.toxicCounter !== null
        ? { kind: "poison" as const, toxicCounter: 0 } : member.majorStatus;
    return {
          ...persistent,
          ability,
          types: originalTypes ?? member.types,
          hp,
          stages: { ...ZERO_STAGES },
          majorStatus: curedStatus,
        };
  });
  const gasSuppressesIllusion = to.ability !== "NEUTRALIZINGGAS"
    && activePokemon(teams[opponentOf(side)]).hp > 0
    && activePokemon(teams[opponentOf(side)]).ability === "NEUTRALIZINGGAS";
  teams[side] = applyIllusion({ activeIndex: toIndex, members }, toIndex, gasSuppressesIllusion);
  const events: TeamBattleEvent[] = [];
  if (healed > 0) {
    events.push({ type: "abilityActivated", side, ability: "REGENERATOR", effect: "heal-on-switch" },
      { type: "hpRestored", side, source: "move", move: "REGENERATOR", amount: healed, hp: from.hp + healed });
  }
  if (from.ability === "NATURALCURE" && from.majorStatus !== null) {
    events.push({ type: "abilityActivated", side, ability: "NATURALCURE", effect: "cure-on-switch" },
      { type: "statusCured", side, status: from.majorStatus.kind });
  }
  events.push({ type: "pokemonSwitched", side, fromIndex, toIndex, from: from.id, to: to.id, reason });
  const cured = cureStatusBlockedByAbility(activePokemon(teams[side]));
  if (cured !== null) {
    teams[side] = { ...teams[side], members: teams[side].members.map((member, index) =>
      index === toIndex ? cured.battler : member) };
    events.push({ type: "abilityActivated", side, ability: cured.ability, effect: "prevent-status" },
      { type: "statusCured", side, status: cured.status });
  }
  const other = opponentOf(side);
  const entry = resolveEntryAbility(side, activePokemon(teams[side]),
    [{ side: other, battler: activePokemon(teams[other]) }], rng, trace, side === "player", false, effects);
  teams[side] = { ...teams[side], members: teams[side].members.map((member, index) =>
    index === teams[side].activeIndex ? entry.battler : member) };
  teams[other] = { ...teams[other], members: teams[other].members.map((member, index) =>
    index === teams[other].activeIndex ? entry.opponents[0]!.battler : member) };
  if (reason === "voluntary") {
    teams[side] = { ...teams[side], members: teams[side].members.map((member, index) =>
      index === teams[side].activeIndex ? markEnteredMidTurn(member) : member) };
  }
  events.push(...entry.events);
  return events;
}

function reconcileForms(teams: Record<BattleSide, BattleTeam>, effects: TeamBattleState["effects"]): TeamBattleEvent[] {
  const active = [activePokemon(teams.player), activePokemon(teams.opponent)];
  const gasActive = active.some((battler) => battler.hp > 0 && battler.ability === "NEUTRALIZINGGAS");
  const weather = effectiveBattleWeather(effects?.weather, active, hasWeatherSuppressor(active));
  const events: TeamBattleEvent[] = [];
  for (const side of SIDES) {
    const team = teams[side];
    const battler = activePokemon(team);
    const result = reconcileAbilityForm(battler, side, weather,
      gasActive && battler.ability !== "NEUTRALIZINGGAS");
    teams[side] = { ...team, members: team.members.map((member, index) =>
      index === team.activeIndex ? result.battler : member) };
    events.push(...result.events);
  }
  return events;
}

function applyEntryAbilities(teams: Record<BattleSide, BattleTeam>, side: BattleSide,
  effects: TeamBattleState["effects"]): { readonly events: readonly TeamBattleEvent[];
    readonly effects: TeamBattleState["effects"] } {
  const active = activePokemon(teams[side]);
  const events: TeamBattleEvent[] = [];
  if (active.ability === "IMPOSTER") {
    const transformed = transformBattler(active, activePokemon(teams[opponentOf(side)]));
    if (transformed !== null) {
      const team = teams[side];
      teams[side] = { ...team, members: team.members.map((member, index) =>
        index === team.activeIndex ? transformed : member) };
      events.push({ type: "abilityActivated", side, ability: "IMPOSTER", effect: "transform" });
    }
  }
  const field = applyEntryFieldAbility(active, side, effects);
  effects = field.effects;
  events.push(...field.events);
  const weather = applyEntryWeatherAbility(active, side, effects);
  effects = weather.effects;
  events.push(...weather.events);
  const entered = activePokemon(teams[side]);
  if (entered.ability === "WINDRIDER" && (effects?.sides[side].tailwindTurns ?? 0) > 0) {
    const wind = activateWindAbility(entered, side);
    const team = teams[side];
    teams[side] = { ...team, members: team.members.map((member, index) =>
      index === team.activeIndex ? wind.battler : member) };
    events.push(...wind.events);
  }
  return { events, effects };
}

function duelState(state: TeamBattleState, teams: Record<BattleSide, BattleTeam>): BattleState {
  return {
    turn: state.turn,
    status: "active",
    winner: null,
    battlers: { player: activePokemon(teams.player), opponent: activePokemon(teams.opponent) },
    ...(state.effects === undefined ? {} : { effects: state.effects }),
  };
}

function storeActiveBattlers(teams: Record<BattleSide, BattleTeam>, battle: BattleState): void {
  for (const side of SIDES) {
    const team = teams[side];
    teams[side] = {
      ...team,
      members: team.members.map((member, index) => index === team.activeIndex ? battle.battlers[side] : member),
    };
  }
}

function withoutTurnEnvelope(events: readonly BattleEvent[]): BattleEvent[] {
  return events.filter((event) =>
    event.type !== "turnStarted"
    && event.type !== "actionOrdered"
    && event.type !== "turnEnded"
    && event.type !== "battleEnded",
  );
}

export function createTeamBattleState(
  members: Readonly<Record<BattleSide, readonly BattlerState[]>>,
  activeIndices: Readonly<Partial<Record<BattleSide, number>>> = {},
): TeamBattleState {
  let state: TeamBattleState = {
    turn: 1,
    status: "active",
    winner: null,
    replacementRequired: [],
    teams: {
      player: { activeIndex: activeIndices.player ?? 0, members: members.player.map(cloneBattler) },
      opponent: { activeIndex: activeIndices.opponent ?? 0, members: members.opponent.map(cloneBattler) },
    },
  };
  for (const side of SIDES) {
    if (!["INTIMIDATE", "ESPANTO", "ILLUMINATE"].includes(activePokemon(state.teams[side]).ability ?? "")) continue;
    const other = opponentOf(side);
    const entry = resolveEntryAbility(side, activePokemon(state.teams[side]),
      [{ side: other, battler: activePokemon(state.teams[other]) }], { nextInt: () => 0 }, []);
    const ownTeam = state.teams[side];
    const otherTeam = state.teams[other];
    state = { ...state, teams: { ...state.teams,
      [side]: { ...ownTeam, members: ownTeam.members.map((member, index) =>
        index === ownTeam.activeIndex ? entry.battler : member) },
      [other]: { ...otherTeam, members: otherTeam.members.map((member, index) =>
        index === otherTeam.activeIndex ? entry.opponents[0]!.battler : member) } } };
  }
  for (const side of SIDES) {
    const other = opponentOf(side);
    const active = activePokemon(state.teams[side]);
    if (active.ability === "IMPOSTER") {
      const transformed = transformBattler(active, activePokemon(state.teams[other]));
      if (transformed !== null) state = { ...state, teams: { ...state.teams,
        [side]: { ...state.teams[side], members: state.teams[side].members.map((member, index) =>
          index === state.teams[side].activeIndex ? transformed : member) } } };
    }
    const field = applyEntryFieldAbility(active, side, state.effects);
    if (field.effects !== undefined) state = { ...state, effects: field.effects };
    const weather = applyEntryWeatherAbility(active, side, state.effects);
    if (weather.effects !== undefined) state = { ...state, effects: weather.effects };
  }
  state = initializeMegaEvolutionState(state);
  const gasActive = SIDES.some((side) => {
    const battler = activePokemon(state.teams[side]);
    return battler.hp > 0 && battler.ability === "NEUTRALIZINGGAS";
  });
  state = { ...state, teams: {
    player: applyIllusion(state.teams.player, state.teams.player.activeIndex,
      gasActive && activePokemon(state.teams.player).ability !== "NEUTRALIZINGGAS"),
    opponent: applyIllusion(state.teams.opponent, state.teams.opponent.activeIndex,
      gasActive && activePokemon(state.teams.opponent).ability !== "NEUTRALIZINGGAS"),
  } };
  const teams = cloneTeams(state);
  reconcileForms(teams, state.effects);
  state = { ...state, teams };
  validateState(state);
  return state;
}

export function activeBattlers(state: TeamBattleState): Readonly<Record<BattleSide, BattlerState>> {
  return {
    player: activePokemon(state.teams.player),
    opponent: activePokemon(state.teams.opponent),
  };
}

export function resolveTeamTurn(state: TeamBattleState, actions: TeamTurnActions, rng: RandomSource,
  itemPolicy: PokemonItemUsePolicy = { context: "battle", revivalAllowed: true },
  rules: BattleResolutionRules = { opponentItemTheft: true }): TeamTurnResult {
  validateState(state);
  if (state.replacementRequired.length > 0) throw new Error("Resolve required replacements before the next turn.");
  const megaResult = resolveMegaEvolutionIntents(state, SIDES.flatMap((side) => {
    const action = actions[side];
    return action.kind === "move" && action.megaEvolution === true
      ? [{ side, teamIndex: state.teams[side].activeIndex }] : [];
  }));
  state = megaResult.state;
  const teams = cloneTeams(state);
  const entryEvents: TeamBattleEvent[] = [];
  const entryTrace: TeamTurnResult["trace"][number][] = [];
  for (const side of SIDES) {
    const other = opponentOf(side);
    const entry = resolveEntryAbility(side, activePokemon(teams[side]),
      [{ side: other, battler: activePokemon(teams[other]) }], rng, entryTrace,
      side === "player", false, state.effects);
    teams[side] = { ...teams[side], members: teams[side].members.map((member, index) =>
      index === teams[side].activeIndex ? entry.battler : member) };
    teams[other] = { ...teams[other], members: teams[other].members.map((member, index) =>
      index === teams[other].activeIndex ? entry.opponents[0]!.battler : member) };
    entryEvents.push(...entry.events);
  }
  const switchEvents: TeamBattleEvent[] = [];
  const itemEvents: TeamBattleEvent[] = [];
  const captureEvents: TeamBattleEvent[] = [];
  const moveActions: Partial<Record<BattleSide, MoveAction>> = {};
  const switchOrder = SIDES.filter((side) => actions[side].kind === "switch");
  const waitOrder = SIDES.filter((side) => actions[side].kind === "wait");
  const itemOrder = SIDES.filter((side) => actions[side].kind === "item");
  const captureOrder = SIDES.filter((side) => actions[side].kind === "capture");

  for (const side of SIDES) {
    const action = actions[side];
    if (action.kind === "move") moveActions[side] = action;
  }
  const pursuitEvents: BattleEvent[] = [];
  const pursuitTrace: TeamTurnResult["trace"][number][] = [];
  let effects = state.effects;
  for (const side of switchOrder) {
    assertVoluntarySwitchAllowed(activePokemon(teams[side]), [activePokemon(teams[opponentOf(side)])]);
  }
  const pursuitSides = SIDES.filter((side) => {
    const action = moveActions[side];
    const slot = action === undefined ? undefined : activePokemon(teams[side]).moves[action.moveIndex];
    return slot?.move.functionCode === "088" && actions[opponentOf(side)].kind === "switch";
  });
  for (const side of pursuitSides) {
    const action = moveActions[side]!;
    const target = opponentOf(side);
    const intercepted = resolveSelectedMoves({ ...duelState(state, teams), ...(effects === undefined ? {} : { effects }) },
      { [side]: action }, rng, { endOfTurn: false, switchingTarget: target,
        opponentItemTheft: rules.opponentItemTheft });
    storeActiveBattlers(teams, intercepted.state);
    pursuitEvents.push(...withoutTurnEnvelope(intercepted.events));
    pursuitTrace.push(...intercepted.trace);
    effects = intercepted.state.effects;
    delete moveActions[side];
  }
  for (const side of switchOrder) {
    const action = actions[side];
    if (action.kind !== "switch") continue;
    switchEvents.push(...switchPokemon(teams, side, action.teamIndex, "voluntary", rng, entryTrace, effects));
    const entered = applyEntryAbilities(teams, side, effects);
    effects = entered.effects;
    switchEvents.push(...entered.events);
  }
  effects = reconcileExtremeWeather(effects, [activePokemon(teams.player), activePokemon(teams.opponent)]);
  for (const side of itemOrder) {
    const action = actions[side];
    if (action.kind !== "item") continue;
    const team = teams[side];
    const target = team.members[action.targetTeamIndex];
    if (target === undefined) throw new Error(`Invalid item target for ${side}.`);
    if ((target.volatile?.embargoTurns ?? 0) > 0) throw new Error(`Item ${action.itemId} cannot be used: embargo.`);
    const applied = applyPokemonItemEffect(target, action.itemId, itemPolicy, action.targetMoveIndex);
    if (typeof applied === "string") throw new Error(`Item ${action.itemId} cannot be used: ${applied}.`);
    teams[side] = { ...team, members: team.members.map((member, index) =>
      index === action.targetTeamIndex ? applied.pokemon : member) };
    teams[side] = consumeTrainerItem(teams[side], action.itemId);
    itemEvents.push({ type: "trainerItemUsed", side, itemId: action.itemId,
      targetIndex: action.targetTeamIndex, target: target.id, ...applied.effect });
  }

  for (const side of captureOrder) {
    const action = actions[side];
    if (action.kind !== "capture") continue;
    const target = activePokemon(teams[opponentOf(side)]);
    const actorTeam = teams[side];
    const actor = activePokemon(actorTeam);
    const capture = attemptPokemonCapture(action.ballId, target, {
      turn: state.turn,
      actorLevels: [actor.level],
      sameSpeciesOppositeGender: actor.species === target.species
        && actor.appearance?.gender !== null && target.appearance?.gender !== null
        && actor.appearance?.gender !== target.appearance?.gender,
    }, rng);
    captureEvents.push({ type: "captureAttempted", side, ballId: action.ballId, target: target.id, ...capture });
    if (capture.success) {
      const events: TeamBattleEvent[] = [{ type: "turnStarted", turn: state.turn },
        { type: "teamActionOrdered", order: [{ side, kind: "capture" }] },
        ...captureEvents, { type: "battleEnded", winner: side }, { type: "turnEnded", turn: state.turn }];
      return { state: { ...state, turn: state.turn + 1, status: "finished", winner: side, teams,
        replacementRequired: [] }, events, trace: [] };
    }
  }

  const result = resolveSelectedMoves({ ...duelState(state, teams), ...(effects === undefined ? {} : { effects }) }, moveActions, rng,
    { switchingTarget: switchOrder[0] ?? null, opponentItemTheft: rules.opponentItemTheft,
      attackerCanSwitch: Object.fromEntries(SIDES.map((side) => [side, livingReserve(teams[side])])) });
  storeActiveBattlers(teams, result.state);
  const moveEvents: BattleEvent[] = withoutTurnEnvelope(result.events);
  const trace: TeamTurnResult["trace"] = [...entryTrace, ...pursuitTrace, ...result.trace];
  const nextTurn = result.state.turn;
  const orderEvent = result.events.find((event) => event.type === "actionOrdered");
  const moveOrder: readonly BattleSide[] = orderEvent?.order ?? [];

  const pivotRequired = SIDES.filter((side) => result.events.some((event) =>
    event.type === "forcedSwitchRequested" && event.side === side) && activePokemon(teams[side]).hp > 0
    && livingReserve(teams[side]));
  const replacementRequired: BattleSide[] = [...pivotRequired];
  let winner: BattleSide | null = null;
  const livingSides = SIDES.filter((side) => teams[side].members.some((member) => member.hp > 0));
  for (const side of SIDES) {
    if (activePokemon(teams[side]).hp !== 0) continue;
    if (livingReserve(teams[side]) && !replacementRequired.includes(side)) replacementRequired.push(side);
    else winner = opponentOf(side);
  }
  const draw = livingSides.length === 0;
  if (draw) winner = null;

  const orderedActions = [
    ...pursuitSides.map((side) => ({ side, kind: "move" as const })),
    ...switchOrder.map((side) => ({ side, kind: "switch" as const })),
    ...itemOrder.map((side) => ({ side, kind: "item" as const })),
    ...captureOrder.map((side) => ({ side, kind: "capture" as const })),
    ...waitOrder.map((side) => ({ side, kind: "wait" as const })),
    ...moveOrder.map((side) => ({ side, kind: "move" as const })),
  ];
  const events: TeamBattleEvent[] = [
    { type: "turnStarted", turn: state.turn },
    { type: "teamActionOrdered", order: orderedActions },
    ...entryEvents,
    ...megaResult.events,
    ...pursuitEvents,
    ...switchEvents,
    ...itemEvents,
    ...captureEvents,
    ...moveEvents,
    ...replacementRequired.map((side): TeamBattleEvent => ({ type: "replacementRequired", side })),
  ];
  if (draw) events.push({ type: "battleEnded", winner: null });
  else if (winner !== null) events.push({ type: "battleEnded", winner });

  const reconciledEffects = reconcileExtremeWeather(result.state.effects,
    [activePokemon(teams.player), activePokemon(teams.opponent)]);
  events.push(...reconcileForms(teams, reconciledEffects));
  events.push({ type: "turnEnded", turn: state.turn });
  return {
    state: {
      turn: nextTurn,
      status: winner === null && !draw ? "active" : "finished",
      winner,
      teams,
      replacementRequired: winner === null ? replacementRequired : [],
      pivotRequired: winner === null ? pivotRequired : [],
      ...(state.megaEvolution === undefined ? {} : { megaEvolution: state.megaEvolution }),
      ...(reconciledEffects === undefined ? {} : { effects: reconciledEffects }),
    },
    events,
    trace,
  };
}

export function replaceFaintedPokemon(
  state: TeamBattleState,
  replacements: Readonly<Partial<Record<BattleSide, number>>>,
  rng: RandomSource = { nextInt: () => 0 },
): TeamReplacementResult {
  state = initializeMegaEvolutionState(state);
  validateState(state);
  if (state.replacementRequired.length === 0) throw new Error("No replacement is required.");
  for (const side of SIDES) {
    if (!state.replacementRequired.includes(side) && replacements[side] !== undefined) {
      throw new Error(`Replacement was not requested for ${side}.`);
    }
  }
  const teams = cloneTeams(state);
  const events: TeamBattleEvent[] = [];
  const trace: TeamTurnResult["trace"][number][] = [];
  let effects = state.effects;
  for (const side of state.replacementRequired) {
    const teamIndex = replacements[side];
    if (teamIndex === undefined) throw new Error(`Missing replacement for ${side}.`);
    events.push(...switchPokemon(teams, side, teamIndex,
      state.pivotRequired?.includes(side) === true ? "forced" : "replacement", rng, trace, effects));
    const entered = applyEntryAbilities(teams, side, effects);
    effects = entered.effects;
    events.push(...entered.events);
  }
  effects = reconcileExtremeWeather(effects, [activePokemon(teams.player), activePokemon(teams.opponent)]);
  events.push(...reconcileForms(teams, effects));
  return {
    state: { ...state, teams, replacementRequired: [], pivotRequired: [],
      ...(effects === undefined ? {} : { effects }) },
    events,
    trace,
  };
}
