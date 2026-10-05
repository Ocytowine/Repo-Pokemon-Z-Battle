import type { SharedBattleOwnerSettlement, SharedBattleParticipation, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import type { SourceBattleExperiencePolicy } from "./source-battle.js";

export type SourceBattleSettlementOutcome = "won" | "lost" | "escaped";

export type SourceBattleMoneySettlement =
  | { readonly kind: "none" }
  | { readonly kind: "fixed"; readonly amount: number }
  | { readonly kind: "source-defeat" };

export interface SourceBattleItemSettlement {
  readonly itemId: string;
  readonly quantity: number;
}

export interface SourceBattleSettlementExperiencePolicy extends SourceBattleExperiencePolicy {
  readonly trainerBattle: boolean;
}

/**
 * Immutable, owner-scoped result of a shared source battle.
 *
 * The authoritative room snapshots the final tactical state so a disconnected
 * participant can settle their own save even after the public battle is closed.
 * Persistent Pokemon are never reconstructed from this payload: the client
 * merges only the owned resources into its existing party.
 */
export interface SourceBattleSettlement {
  readonly settlementId: string;
  readonly battleId: string;
  readonly ownerId: string;
  readonly narrativeOwnerId: string;
  readonly outcome: SourceBattleSettlementOutcome;
  readonly tactical: SharedBattleOwnerSettlement;
  readonly participation: SharedBattleParticipation;
  readonly state: TeamBattleState;
  readonly experience: SourceBattleSettlementExperiencePolicy;
  readonly money: SourceBattleMoneySettlement;
  readonly items: readonly SourceBattleItemSettlement[];
  readonly healParty: boolean;
}
