import type { TeamBattleState } from "./types.js";

export type SharedBattleOrigin = "source-wild" | "source-trainer" | "player-duel" | "room-encounter";
export type SharedBattleLifecycle = "join-window" | "active" | "settling" | "closed";

/**
 * Platform-neutral lifecycle used by the solo adapter and, later, by the authoritative room.
 * Closing a session deliberately keeps its settlement id so reconnecting clients can acknowledge it safely.
 */
export interface SharedBattleSession {
  readonly battleId: string;
  readonly origin: SharedBattleOrigin;
  readonly narrativeOwnerId: string;
  readonly lifecycle: SharedBattleLifecycle;
  readonly settlementId: string | null;
}

function identifier(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized === "") throw new Error(`${label} doit posséder un identifiant.`);
  return normalized;
}

export function createSharedBattleSession(input: {
  readonly battleId: string;
  readonly origin: SharedBattleOrigin;
  readonly narrativeOwnerId: string;
  readonly allowJoin: boolean;
}): SharedBattleSession {
  return { battleId: identifier(input.battleId, "Le combat"), origin: input.origin,
    narrativeOwnerId: identifier(input.narrativeOwnerId, "Le propriétaire narratif"),
    lifecycle: input.allowJoin ? "join-window" : "active", settlementId: null };
}

/** Closes the optional join window. This transition is irreversible for a given battle id. */
export function activateSharedBattleSession(session: SharedBattleSession): SharedBattleSession {
  if (session.lifecycle === "active") return session;
  if (session.lifecycle !== "join-window") throw new Error("La fenêtre de participation de ce combat est déjà fermée.");
  return { ...session, lifecycle: "active" };
}

/** Freezes a stable settlement id only once the authoritative tactical battle is finished. */
export function settleSharedBattleSession(session: SharedBattleSession, state: TeamBattleState): SharedBattleSession {
  if (session.lifecycle === "settling") return session;
  if (session.lifecycle !== "active") throw new Error("Seul un combat actif peut entrer en règlement.");
  if (state.status !== "finished" || state.winner === null) throw new Error("Le combat tactique doit être terminé avant son règlement.");
  return { ...session, lifecycle: "settling", settlementId: `${session.battleId}:settlement` };
}

/** Escape is a valid source-wild settlement even though the tactical state has no winner. */
export function settleEscapedSharedBattleSession(session: SharedBattleSession): SharedBattleSession {
  if (session.lifecycle === "settling") return session;
  if (session.lifecycle !== "active" || session.origin !== "source-wild") {
    throw new Error("Seul un combat sauvage actif peut être réglé par une fuite.");
  }
  return { ...session, lifecycle: "settling", settlementId: `${session.battleId}:settlement` };
}

export function closeSharedBattleSession(session: SharedBattleSession): SharedBattleSession {
  if (session.lifecycle === "closed") return session;
  if (session.lifecycle !== "settling" || session.settlementId === null) {
    throw new Error("Le règlement doit être créé avant de fermer le combat.");
  }
  return { ...session, lifecycle: "closed" };
}
