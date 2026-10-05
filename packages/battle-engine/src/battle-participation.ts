import type { BattleSide, BattlerState, TeamBattleEvent, TeamBattleState } from "./types.js";
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

export interface SharedBattleEngagement {
  readonly opponentMemberId: string;
  readonly memberIds: readonly string[];
}

export interface SharedBattleDefeatCredit {
  readonly turn: number;
  readonly defeatedSide: BattleSide;
  readonly defeatedBattler: BattlerState;
  readonly recipientSide: BattleSide;
  readonly eligibleMemberIds: readonly string[];
}

export interface SharedBattleOwnerDefeatCredit {
  readonly turn: number;
  readonly defeatedBattler: BattlerState;
  /** Number of conscious participants across the whole allied camp when this opponent fainted. */
  readonly participantCount: number;
  readonly recipientMemberIds: readonly string[];
}

export interface SharedBattleOwnerSettlement {
  readonly ownerId: string;
  readonly side: BattleSide;
  readonly won: boolean;
  readonly resourceMemberIds: readonly string[];
  readonly defeatCredits: readonly SharedBattleOwnerDefeatCredit[];
}

export interface BattleJoinProposal {
  readonly joinerId: string;
  readonly side: BattleSide;
  readonly members: readonly OwnedBattleMember[];
  readonly finalMemberIds: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly approvals: readonly string[];
}

export interface SharedBattleLedger {
  readonly engagedMemberIds: Readonly<Record<BattleSide, readonly string[]>>;
  readonly defeatedMembers: readonly { readonly side: BattleSide; readonly battler: BattlerState }[];
  readonly engagements: Readonly<Record<BattleSide, readonly SharedBattleEngagement[]>>;
  readonly defeatCredits: readonly SharedBattleDefeatCredit[];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

const BATTLE_SIDES = ["player", "opponent"] as const;

function otherSide(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function requireIdentifier(value: string, label: string): void {
  if (value.trim() === "") throw new Error(`${label} doit posséder un identifiant.`);
}

/** Validates ownership and identity invariants shared by solo and room adapters. */
export function assertSharedBattleParticipation(state: SharedBattleParticipation): void {
  requireIdentifier(state.battleOwnerId, "Le propriétaire narratif");
  if (state.format !== "single" && state.format !== "double") throw new Error("Format de combat partagé invalide.");
  const trainerSides = new Map<string, BattleSide>();
  const memberIds = new Set<string>();
  for (const side of BATTLE_SIDES) {
    const camp = state.camps[side];
    if (camp.trainerIds.length > 2 || unique(camp.trainerIds).length !== camp.trainerIds.length) {
      throw new Error("Un camp doit contenir au maximum deux Dresseurs distincts.");
    }
    for (const trainerId of camp.trainerIds) {
      requireIdentifier(trainerId, "Un Dresseur");
      if (trainerSides.has(trainerId)) throw new Error("Un Dresseur ne peut pas appartenir aux deux camps.");
      trainerSides.set(trainerId, side);
    }
    if (camp.members.length === 0 || camp.members.length > MAX_TEAM_SIZE) {
      throw new Error("Un camp doit contenir entre un et six Pokémon.");
    }
    for (const member of camp.members) {
      requireIdentifier(member.battler.id, "Un Pokémon");
      if (memberIds.has(member.battler.id)) throw new Error("Les identifiants des Pokémon doivent être uniques entre les camps.");
      memberIds.add(member.battler.id);
      if (member.ownerId !== null && !camp.trainerIds.includes(member.ownerId)) {
        throw new Error("Le propriétaire d'un Pokémon doit appartenir à son camp.");
      }
    }
    if (!camp.members.some((member) => member.battler.id === camp.activeMemberId)) {
      throw new Error("Le Pokémon actif doit appartenir à la composition de son camp.");
    }
  }
  if (!trainerSides.has(state.battleOwnerId)) {
    throw new Error("Le propriétaire narratif doit participer à l'un des camps.");
  }
}

export function proposeBattleJoin(state: SharedBattleParticipation, input: {
  readonly joinerId: string;
  readonly side: BattleSide;
  readonly members: readonly BattlerState[];
  readonly finalMemberIds: readonly string[];
}): BattleJoinProposal {
  assertSharedBattleParticipation(state);
  requireIdentifier(input.joinerId, "Le Dresseur invité");
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
  const otherCampIds = new Set(state.camps[otherSide(input.side)].members.map((member) => member.battler.id));
  if (input.members.some((member) => otherCampIds.has(member.id))) {
    throw new Error("Un Pokémon proposé possède déjà un identifiant dans le camp adverse.");
  }
  const finalIds = unique(input.finalMemberIds);
  if (finalIds.length === 0 || finalIds.length > MAX_TEAM_SIZE || finalIds.length !== input.finalMemberIds.length
    || finalIds.some((id) => !candidateIds.has(id))) {
    throw new Error("La composition finale doit contenir un à six Pokémon proposés, sans doublon.");
  }
  if (!candidates.some((member) => member.ownerId === input.joinerId && finalIds.includes(member.battler.id))) {
    throw new Error("La composition finale doit conserver au moins un Pokémon de l'invité.");
  }
  if (camp.trainerIds.includes(state.battleOwnerId)
    && !candidates.some((member) => member.ownerId === state.battleOwnerId && finalIds.includes(member.battler.id))) {
    throw new Error("La composition alliée doit conserver au moins un Pokémon du meneur.");
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
  assertSharedBattleParticipation(state);
  if (!battleJoinApproved(proposal)) throw new Error("La composition n'a pas encore été acceptée par tous les Dresseurs concernés.");
  if (Object.values(state.camps).some((camp) => camp.trainerIds.includes(proposal.joinerId))) {
    throw new Error("Ce Dresseur participe déjà au combat.");
  }
  const camp = state.camps[proposal.side];
  if (camp.trainerIds.length >= 2) throw new Error("Ce camp possède déjà deux Dresseurs.");
  const expectedApprovals = unique([state.battleOwnerId, ...camp.trainerIds, proposal.joinerId]);
  if (proposal.requiredApprovals.length !== expectedApprovals.length
    || expectedApprovals.some((trainerId) => !proposal.requiredApprovals.includes(trainerId))) {
    throw new Error("Les accords requis ne correspondent plus aux participants.");
  }
  const proposalIds = proposal.members.map((member) => member.battler.id);
  if (unique(proposalIds).length !== proposalIds.length || unique(proposal.finalMemberIds).length !== proposal.finalMemberIds.length
    || proposal.finalMemberIds.length === 0 || proposal.finalMemberIds.length > MAX_TEAM_SIZE
    || proposal.finalMemberIds.some((id) => !proposalIds.includes(id))) {
    throw new Error("La composition approuvée est incohérente.");
  }
  const existingById = new Map(camp.members.map((member) => [member.battler.id, member]));
  for (const member of proposal.members) {
    const existing = existingById.get(member.battler.id);
    if (existing !== undefined && (member.ownerId !== existing.ownerId
      || JSON.stringify(member.battler) !== JSON.stringify(existing.battler))) {
      throw new Error("La proposition ne correspond plus à la composition autoritaire.");
    }
    if (existing === undefined && member.ownerId !== proposal.joinerId) {
      throw new Error("Un nouveau Pokémon doit appartenir au Dresseur invité.");
    }
  }
  if (!proposal.members.some((member) => member.ownerId === proposal.joinerId
    && proposal.finalMemberIds.includes(member.battler.id))) {
    throw new Error("La composition finale doit conserver au moins un Pokémon de l'invité.");
  }
  if (camp.trainerIds.includes(state.battleOwnerId)
    && !proposal.members.some((member) => member.ownerId === state.battleOwnerId
      && proposal.finalMemberIds.includes(member.battler.id))) {
    throw new Error("La composition alliée doit conserver au moins un Pokémon du meneur.");
  }
  const members = proposal.finalMemberIds.map((id) => proposal.members.find((member) => member.battler.id === id)!);
  const activeMemberId = members.some((member) => member.battler.id === camp.activeMemberId)
    ? camp.activeMemberId : members[0]!.battler.id;
  const joined = { ...state, camps: { ...state.camps, [proposal.side]: {
    trainerIds: [...camp.trainerIds, proposal.joinerId], members, activeMemberId,
  } } };
  assertSharedBattleParticipation(joined);
  return joined;
}

export function activeBattleController(state: SharedBattleParticipation, side: BattleSide): string | null {
  assertSharedBattleParticipation(state);
  const camp = state.camps[side];
  return camp.members.find((member) => member.battler.id === camp.activeMemberId)?.ownerId ?? null;
}

/**
 * The owner of the fainted active keeps the replacement decision when they have
 * a usable reserve. Otherwise control passes to the first trainer that can
 * actually provide one; an unowned source reserve remains controlled by the AI.
 */
export function replacementBattleController(state: SharedBattleParticipation,
  battle: TeamBattleState, side: BattleSide): string | null {
  assertSharedBattleParticipation(state);
  if (!battle.replacementRequired.includes(side)) throw new Error(`Aucun remplacement n'est requis pour ${side}.`);
  const camp = state.camps[side];
  const team = battle.teams[side];
  const activeId = team.members[team.activeIndex]?.id;
  const activeOwner = camp.members.find((member) => member.battler.id === activeId)?.ownerId ?? null;
  const livingOwners = team.members.flatMap((member, index) => {
    if (index === team.activeIndex || member.hp <= 0) return [];
    return [camp.members.find((owned) => owned.battler.id === member.id)?.ownerId ?? null];
  });
  if (livingOwners.includes(activeOwner)) return activeOwner;
  if (livingOwners.includes(null)) return null;
  return camp.trainerIds.find((trainerId) => livingOwners.includes(trainerId)) ?? null;
}

export function battleMemberIndicesOwnedBy(state: SharedBattleParticipation, battle: TeamBattleState,
  side: BattleSide, ownerId: string | null): readonly number[] {
  assertSharedBattleParticipation(state);
  const owners = new Map(state.camps[side].members.map((member) => [member.battler.id, member.ownerId]));
  return battle.teams[side].members.flatMap((member, index) => owners.get(member.id) === ownerId ? [index] : []);
}

/** Capture is reserved for an unowned target in a source-wild battle. */
export function canCaptureSharedBattleTarget(state: SharedBattleParticipation, battle: TeamBattleState,
  origin: "source-wild" | "source-trainer" | "player-duel" | "room-encounter"): boolean {
  if (origin !== "source-wild" || battle.status !== "active") return false;
  const opponent = battle.teams.opponent.members[battle.teams.opponent.activeIndex];
  return opponent !== undefined
    && state.camps.opponent.members.find((member) => member.battler.id === opponent.id)?.ownerId === null;
}

export function createSharedBattleLedger(state: TeamBattleState): SharedBattleLedger {
  const player = state.teams.player.members[state.teams.player.activeIndex];
  const opponent = state.teams.opponent.members[state.teams.opponent.activeIndex];
  if (player === undefined || opponent === undefined) throw new Error("Combat partagé sans Pokémon actif.");
  return {
    engagedMemberIds: { player: [player.id], opponent: [opponent.id] },
    defeatedMembers: [],
    engagements: {
      player: [{ opponentMemberId: opponent.id, memberIds: [player.id] }],
      opponent: [{ opponentMemberId: player.id, memberIds: [opponent.id] }],
    },
    defeatCredits: [],
  };
}

/** Upgrades persisted protocol-v9 ledgers created before per-defeat credits existed. */
export function restoreSharedBattleLedger(value: Partial<SharedBattleLedger>, state: TeamBattleState): SharedBattleLedger {
  const initial = createSharedBattleLedger(state);
  const engagedMemberIds: Record<BattleSide, readonly string[]> = {
    player: Array.isArray(value.engagedMemberIds?.player)
      ? unique(value.engagedMemberIds.player.filter((id): id is string => typeof id === "string"))
      : initial.engagedMemberIds.player,
    opponent: Array.isArray(value.engagedMemberIds?.opponent)
      ? unique(value.engagedMemberIds.opponent.filter((id): id is string => typeof id === "string"))
      : initial.engagedMemberIds.opponent,
  };
  const engagements = value.engagements === undefined ? {
    player: [{ opponentMemberId: state.teams.opponent.members[state.teams.opponent.activeIndex]!.id,
      memberIds: engagedMemberIds.player }],
    opponent: [{ opponentMemberId: state.teams.player.members[state.teams.player.activeIndex]!.id,
      memberIds: engagedMemberIds.opponent }],
  } : value.engagements;
  return {
    engagedMemberIds,
    defeatedMembers: Array.isArray(value.defeatedMembers) ? value.defeatedMembers : [],
    engagements,
    defeatCredits: Array.isArray(value.defeatCredits) ? value.defeatCredits : [],
  };
}

function addEngagement(engagements: Record<BattleSide, SharedBattleEngagement[]>, recipientSide: BattleSide,
  memberId: string, opponentMemberId: string): void {
  const existingIndex = engagements[recipientSide].findIndex((entry) => entry.opponentMemberId === opponentMemberId);
  if (existingIndex < 0) {
    engagements[recipientSide].push({ opponentMemberId, memberIds: [memberId] });
    return;
  }
  const existing = engagements[recipientSide][existingIndex]!;
  if (!existing.memberIds.includes(memberId)) {
    engagements[recipientSide][existingIndex] = { ...existing, memberIds: [...existing.memberIds, memberId] };
  }
}

function battlerById(state: TeamBattleState, side: BattleSide, id: string): BattlerState | undefined {
  return state.teams[side].members.find((member) => member.id === id);
}

export function recordSharedBattleTurn(ledger: SharedBattleLedger, before: TeamBattleState,
  after: TeamBattleState, events: readonly TeamBattleEvent[]): SharedBattleLedger {
  const engaged: Record<BattleSide, string[]> = {
    player: [...ledger.engagedMemberIds.player], opponent: [...ledger.engagedMemberIds.opponent],
  };
  const engagements: Record<BattleSide, SharedBattleEngagement[]> = {
    player: ledger.engagements.player.map((entry) => ({ ...entry, memberIds: [...entry.memberIds] })),
    opponent: ledger.engagements.opponent.map((entry) => ({ ...entry, memberIds: [...entry.memberIds] })),
  };
  const defeated = [...ledger.defeatedMembers];
  const defeatCredits = [...ledger.defeatCredits];
  const activeIds: Record<BattleSide, string> = {
    player: before.teams.player.members[before.teams.player.activeIndex]!.id,
    opponent: before.teams.opponent.members[before.teams.opponent.activeIndex]!.id,
  };
  const engageActivePair = (): void => {
    addEngagement(engagements, "player", activeIds.player, activeIds.opponent);
    addEngagement(engagements, "opponent", activeIds.opponent, activeIds.player);
    for (const side of BATTLE_SIDES) if (!engaged[side].includes(activeIds[side])) engaged[side].push(activeIds[side]);
  };
  engageActivePair();
  for (const event of events) {
    if (event.type === "pokemonSwitched") {
      activeIds[event.side] = event.to;
      engageActivePair();
      continue;
    }
    if (event.type !== "fainted") continue;
    const defeatedId = activeIds[event.side];
    const battler = battlerById(after, event.side, defeatedId) ?? battlerById(before, event.side, defeatedId);
    if (battler === undefined) continue;
    if (!defeated.some((entry) => entry.side === event.side && entry.battler.id === battler.id)) {
      defeated.push({ side: event.side, battler });
    }
    if (!defeatCredits.some((entry) => entry.defeatedSide === event.side && entry.defeatedBattler.id === battler.id)) {
      const recipientSide = otherSide(event.side);
      const participants = engagements[recipientSide].find((entry) => entry.opponentMemberId === battler.id)?.memberIds ?? [];
      const eligibleMemberIds = participants.filter((id) => (battlerById(after, recipientSide, id)?.hp ?? 0) > 0);
      defeatCredits.push({ turn: before.turn, defeatedSide: event.side, defeatedBattler: battler,
        recipientSide, eligibleMemberIds });
    }
  }
  for (const side of BATTLE_SIDES) {
    const active = after.teams[side].members[after.teams[side].activeIndex];
    if (active !== undefined) activeIds[side] = active.id;
  }
  engageActivePair();
  return { engagedMemberIds: engaged, defeatedMembers: defeated, engagements, defeatCredits };
}

/** Produces the tactical, non-persistent part of one participant's final settlement. */
export function sharedBattleOwnerSettlement(participation: SharedBattleParticipation, state: TeamBattleState,
  ledger: SharedBattleLedger, ownerId: string): SharedBattleOwnerSettlement {
  assertSharedBattleParticipation(participation);
  requireIdentifier(ownerId, "Le propriétaire du règlement");
  if (state.status !== "finished" || state.winner === null) throw new Error("Le combat doit être terminé avant son règlement.");
  const ownerSides = BATTLE_SIDES.filter((side) => participation.camps[side].trainerIds.includes(ownerId));
  if (ownerSides.length !== 1) throw new Error("Le propriétaire du règlement doit appartenir à un seul camp.");
  const side = ownerSides[0]!;
  const ownedIds = participation.camps[side].members
    .filter((member) => member.ownerId === ownerId).map((member) => member.battler.id);
  if (ownedIds.length === 0) throw new Error("Le propriétaire ne possède aucun Pokémon dans ce combat.");
  for (const battleSide of BATTLE_SIDES) {
    const resultIds = new Set(state.teams[battleSide].members.map((member) => member.id));
    if (participation.camps[battleSide].members.some((member) => !resultIds.has(member.battler.id))) {
      throw new Error("Le résultat ne contient plus toute la composition partagée.");
    }
  }
  const campIds = new Set(participation.camps[side].members.map((member) => member.battler.id));
  const defeatCredits = ledger.defeatCredits.filter((credit) => credit.recipientSide === side).map((credit) => {
    if (credit.defeatedSide !== otherSide(side)) throw new Error("Un crédit de K.O. vise le mauvais camp.");
    if (unique(credit.eligibleMemberIds).length !== credit.eligibleMemberIds.length
      || credit.eligibleMemberIds.some((id) => !campIds.has(id))) {
      throw new Error("Un crédit de K.O. contient un participant inconnu.");
    }
    return { turn: credit.turn, defeatedBattler: credit.defeatedBattler,
      participantCount: credit.eligibleMemberIds.length,
      recipientMemberIds: credit.eligibleMemberIds.filter((id) => ownedIds.includes(id)) };
  }).filter((credit) => credit.recipientMemberIds.length > 0);
  return { ownerId, side, won: state.winner === side, resourceMemberIds: ownedIds, defeatCredits };
}
