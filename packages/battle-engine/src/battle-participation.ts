import type { BattleSide, BattlerState } from "./types.js";
import { MAX_TEAM_SIZE } from "./team-battle.js";

export type SharedBattleFormat = "single" | "double";

export interface OwnedBattleMember {
  readonly ownerId: string | null;
  readonly battler: BattlerState;
}

export interface SharedBattleCamp {
  readonly trainerIds: readonly string[];
  readonly members: readonly OwnedBattleMember[];
  readonly activeMemberId: string;
}

export interface SharedBattleParticipation {
  readonly battleOwnerId: string;
  readonly format: SharedBattleFormat;
  readonly camps: Readonly<Record<BattleSide, SharedBattleCamp>>;
}

export interface BattleJoinProposal {
  readonly joinerId: string;
  readonly side: BattleSide;
  readonly members: readonly OwnedBattleMember[];
  readonly finalMemberIds: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly approvals: readonly string[];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export function proposeBattleJoin(state: SharedBattleParticipation, input: {
  readonly joinerId: string;
  readonly side: BattleSide;
  readonly members: readonly BattlerState[];
  readonly finalMemberIds: readonly string[];
}): BattleJoinProposal {
  if (state.format === "double") throw new Error("Un combat double n'accepte pas de participant supplémentaire.");
  if (Object.values(state.camps).some((camp) => camp.trainerIds.includes(input.joinerId))) {
    throw new Error("Ce Dresseur participe déjà au combat.");
  }
  const camp = state.camps[input.side];
  if (camp.trainerIds.length >= 2) throw new Error("Ce camp possède déjà deux Dresseurs.");
  if (input.members.length === 0 || input.members.length > MAX_TEAM_SIZE) {
    throw new Error("La contribution doit contenir entre un et six Pokémon.");
  }
  const candidates = [...camp.members, ...input.members.map((battler) => ({ ownerId: input.joinerId, battler }))];
  const candidateIds = new Set(candidates.map((member) => member.battler.id));
  if (candidateIds.size !== candidates.length) throw new Error("Les identifiants des Pokémon proposés doivent être uniques.");
  const finalIds = unique(input.finalMemberIds);
  if (finalIds.length === 0 || finalIds.length > MAX_TEAM_SIZE || finalIds.length !== input.finalMemberIds.length
    || finalIds.some((id) => !candidateIds.has(id))) {
    throw new Error("La composition finale doit contenir un à six Pokémon proposés, sans doublon.");
  }
  if (!candidates.some((member) => member.ownerId === input.joinerId && finalIds.includes(member.battler.id))) {
    throw new Error("La composition finale doit conserver au moins un Pokémon de l'invité.");
  }
  const requiredApprovals = unique([state.battleOwnerId, ...camp.trainerIds, input.joinerId]);
  return { joinerId: input.joinerId, side: input.side, members: candidates.filter((member) => finalIds.includes(member.battler.id)),
    finalMemberIds: finalIds, requiredApprovals, approvals: [input.joinerId] };
}

export function approveBattleJoin(proposal: BattleJoinProposal, trainerId: string): BattleJoinProposal {
  if (!proposal.requiredApprovals.includes(trainerId)) throw new Error("Ce Dresseur ne peut pas valider cette composition.");
  return { ...proposal, approvals: unique([...proposal.approvals, trainerId]) };
}

export function battleJoinApproved(proposal: BattleJoinProposal): boolean {
  return proposal.requiredApprovals.every((trainerId) => proposal.approvals.includes(trainerId));
}

export function applyBattleJoin(state: SharedBattleParticipation, proposal: BattleJoinProposal): SharedBattleParticipation {
  if (!battleJoinApproved(proposal)) throw new Error("La composition n'a pas encore été acceptée par tous les Dresseurs concernés.");
  const camp = state.camps[proposal.side];
  const members = proposal.finalMemberIds.map((id) => proposal.members.find((member) => member.battler.id === id)!);
  const activeMemberId = members.some((member) => member.battler.id === camp.activeMemberId)
    ? camp.activeMemberId : members[0]!.battler.id;
  return { ...state, camps: { ...state.camps, [proposal.side]: {
    trainerIds: [...camp.trainerIds, proposal.joinerId], members, activeMemberId,
  } } };
}

export function activeBattleController(state: SharedBattleParticipation, side: BattleSide): string | null {
  const camp = state.camps[side];
  return camp.members.find((member) => member.battler.id === camp.activeMemberId)?.ownerId ?? null;
}
