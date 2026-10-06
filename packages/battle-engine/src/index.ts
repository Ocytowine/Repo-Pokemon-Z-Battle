export { MINIMAL_MOVE_CATALOG } from "./catalog.js";
export { activeBattleController, activeBattleControllerAt, applyBattleJoin, approveBattleJoin, assertSharedBattleParticipation,
  battleMemberIndicesOwnedBy, canCaptureSharedBattleTarget, replacementBattleController,
  battleJoinApproved, createSharedBattleLedger, proposeBattleJoin, recordSharedBattleTurn,
  restoreSharedBattleLedger, sharedBattleOwnerEscapeSettlement, sharedBattleOwnerSettlement } from "./battle-participation.js";
export { calculateDamage } from "./damage.js";
export { activeBattlePositions, activeTeamIndices, battlerAtPosition, createDoubleTeamBattleState, replaceFaintedDoublePokemon,
  resolveDoubleTeamTurn } from "./double-team-battle.js";
export { applySourceBattleReplacements, attemptSourceBattleEscape, canEscapeSourceBattle, chooseSourceBattleAction,
  chooseSourceBattleReplacement } from "./battle-tactics.js";
export { resolveTurn } from "./resolve-turn.js";
export { SeededRandom } from "./rng.js";
export { activateSharedBattleSession, closeSharedBattleSession, createSharedBattleSession,
  settleEscapedSharedBattleSession, settleSharedBattleSession } from "./shared-battle-session.js";
export { MAX_TEAM_SIZE, activeBattlers, createTeamBattleState, replaceFaintedPokemon, resolveTeamTurn } from "./team-battle.js";
export { isKnownType, typeEffectiveness } from "./type-chart.js";
export type {
  BattleAction,
  BattleAbility,
  BattleEvent,
  BattleMove,
  BattlePosition,
  BattleSide,
  BattleState,
  BattleStat,
  BattleStats,
  BattleStatus,
  BattleTeam,
  BattleTrace,
  BattlerState,
  HeldItem,
  MajorStatusState,
  MoveAction,
  MoveCategory,
  MoveSlot,
  RandomSource,
  StatefulRandomSource,
  StatStages,
  SwitchAction,
  TeamBattleAction,
  TeamBattleEvent,
  TeamBattleState,
  TeamReplacementResult,
  TeamTurnActions,
  TeamTurnResult,
  TurnActions,
  TurnResult,
  WaitAction,
  DoubleBattleEvent,
  DoubleTurnResult,
  PositionedTeamBattleAction,
} from "./types.js";
export type { BattleJoinProposal, OwnedBattleMember, SharedBattleCamp, SharedBattleDefeatCredit,
  SharedBattleEngagement, SharedBattleFormat, SharedBattleLedger, SharedBattleOwnerDefeatCredit,
  SharedBattleOwnerSettlement, SharedBattleParticipation } from "./battle-participation.js";
export type { SharedBattleLifecycle, SharedBattleOrigin, SharedBattleSession } from "./shared-battle-session.js";
export type { BattleEscapeResult } from "./battle-tactics.js";
