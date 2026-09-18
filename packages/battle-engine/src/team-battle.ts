import { resolveSelectedMoves } from "./resolve-turn.js";
import type {
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
    moves: battler.moves.map((slot) => ({ ...slot, move: { ...slot.move } })),
  };
}

function cloneTeam(team: BattleTeam): BattleTeam {
  return { activeIndex: team.activeIndex, members: team.members.map(cloneBattler) };
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
      if (active.hp !== 0 || !livingReserve(state.teams[side])) throw new Error(`Invalid replacement state for ${side}.`);
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
  reason: "voluntary" | "replacement",
): TeamBattleEvent {
  const team = teams[side];
  validateSwitch(team, toIndex, side);
  const fromIndex = team.activeIndex;
  const from = activePokemon(team);
  const to = team.members[toIndex];
  if (to === undefined) throw new RangeError(`Invalid switch index for ${side}.`);
  const members = team.members.map((member, index) =>
    index === fromIndex
      ? {
          ...member,
          stages: { ...ZERO_STAGES },
          majorStatus: member.majorStatus?.kind === "poison" && member.majorStatus.toxicCounter !== null
            ? { kind: "poison" as const, toxicCounter: 0 }
            : member.majorStatus,
        }
      : member,
  );
  teams[side] = { activeIndex: toIndex, members };
  return { type: "pokemonSwitched", side, fromIndex, toIndex, from: from.id, to: to.id, reason };
}

function duelState(state: TeamBattleState, teams: Record<BattleSide, BattleTeam>): BattleState {
  return {
    turn: state.turn,
    status: "active",
    winner: null,
    battlers: { player: activePokemon(teams.player), opponent: activePokemon(teams.opponent) },
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
  const state: TeamBattleState = {
    turn: 1,
    status: "active",
    winner: null,
    replacementRequired: [],
    teams: {
      player: { activeIndex: activeIndices.player ?? 0, members: members.player.map(cloneBattler) },
      opponent: { activeIndex: activeIndices.opponent ?? 0, members: members.opponent.map(cloneBattler) },
    },
  };
  validateState(state);
  return state;
}

export function activeBattlers(state: TeamBattleState): Readonly<Record<BattleSide, BattlerState>> {
  return {
    player: activePokemon(state.teams.player),
    opponent: activePokemon(state.teams.opponent),
  };
}

export function resolveTeamTurn(state: TeamBattleState, actions: TeamTurnActions, rng: RandomSource): TeamTurnResult {
  validateState(state);
  if (state.replacementRequired.length > 0) throw new Error("Resolve required replacements before the next turn.");
  const teams = cloneTeams(state);
  const switchEvents: TeamBattleEvent[] = [];
  const moveActions: Partial<Record<BattleSide, MoveAction>> = {};
  const switchOrder = SIDES.filter((side) => actions[side].kind === "switch");

  for (const side of switchOrder) {
    const action = actions[side];
    if (action.kind !== "switch") continue;
    switchEvents.push(switchPokemon(teams, side, action.teamIndex, "voluntary"));
  }
  for (const side of SIDES) {
    const action = actions[side];
    if (action.kind === "move") moveActions[side] = action;
  }

  const result = resolveSelectedMoves(duelState(state, teams), moveActions, rng);
  storeActiveBattlers(teams, result.state);
  const moveEvents: BattleEvent[] = withoutTurnEnvelope(result.events);
  const trace: TeamTurnResult["trace"] = result.trace;
  const nextTurn = result.state.turn;
  const orderEvent = result.events.find((event) => event.type === "actionOrdered");
  const moveOrder: readonly BattleSide[] = orderEvent?.order ?? [];

  const replacementRequired: BattleSide[] = [];
  let winner: BattleSide | null = null;
  for (const side of SIDES) {
    if (activePokemon(teams[side]).hp !== 0) continue;
    if (livingReserve(teams[side])) replacementRequired.push(side);
    else winner = opponentOf(side);
  }

  const orderedActions = [
    ...switchOrder.map((side) => ({ side, kind: "switch" as const })),
    ...moveOrder.map((side) => ({ side, kind: "move" as const })),
  ];
  const events: TeamBattleEvent[] = [
    { type: "turnStarted", turn: state.turn },
    { type: "teamActionOrdered", order: orderedActions },
    ...switchEvents,
    ...moveEvents,
    ...replacementRequired.map((side): TeamBattleEvent => ({ type: "replacementRequired", side })),
  ];
  if (winner !== null) events.push({ type: "battleEnded", winner });
  events.push({ type: "turnEnded", turn: state.turn });

  return {
    state: {
      turn: nextTurn,
      status: winner === null ? "active" : "finished",
      winner,
      teams,
      replacementRequired: winner === null ? replacementRequired : [],
    },
    events,
    trace,
  };
}

export function replaceFaintedPokemon(
  state: TeamBattleState,
  replacements: Readonly<Partial<Record<BattleSide, number>>>,
): TeamReplacementResult {
  validateState(state);
  if (state.replacementRequired.length === 0) throw new Error("No replacement is required.");
  for (const side of SIDES) {
    if (!state.replacementRequired.includes(side) && replacements[side] !== undefined) {
      throw new Error(`Replacement was not requested for ${side}.`);
    }
  }
  const teams = cloneTeams(state);
  const events: TeamBattleEvent[] = [];
  for (const side of state.replacementRequired) {
    const teamIndex = replacements[side];
    if (teamIndex === undefined) throw new Error(`Missing replacement for ${side}.`);
    events.push(switchPokemon(teams, side, teamIndex, "replacement"));
  }
  return {
    state: { ...state, teams, replacementRequired: [] },
    events,
    trace: [],
  };
}
