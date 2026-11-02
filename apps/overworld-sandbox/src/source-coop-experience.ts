import { applyPokemonZExperienceCredits, type PlayerCreationCatalog, type PokemonZExperienceCredit,
  type PokemonZExperiencePolicy, type SharedBattleExperienceGain } from "@pokemon-z-battle/player-state";
import type { PlayerPartyState } from "@pokemon-z-battle/player-state";
import type { SourceEventState } from "./source-event-state.js";

export interface SourceDeferredCoopExperience {
  readonly settlementId: string;
  readonly credits: readonly PokemonZExperienceCredit[];
  readonly policy: PokemonZExperiencePolicy;
}

const MAX_ENTRIES = 2048;
const MAX_CREDITS = 24;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

/** Legacy saves have no journal; malformed journals must never be silently dropped. */
export function parseSourceDeferredCoopExperience(value: unknown): readonly SourceDeferredCoopExperience[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ENTRIES) throw new Error("Journal d'EXP Coop invalide.");
  const entries = value.map((item: unknown) => {
    if (!record(item) || !identifier(item.settlementId) || !Array.isArray(item.credits)
      || item.credits.length > MAX_CREDITS || !record(item.policy)) throw new Error("Journal d'EXP Coop invalide.");
    const policy = item.policy;
    if (!integer(policy.levelCap, 1, 100) || typeof policy.trainerBattle !== "boolean"
      || ["experienceDisabled", "boostTenPercent", "boostTwentyPercent", "noSplitExperience"]
        .some((key) => policy[key] !== undefined && typeof policy[key] !== "boolean")) {
      throw new Error("Politique d'EXP Coop invalide.");
    }
    const credits = item.credits.map((candidate: unknown) => {
      if (!record(candidate) || !integer(candidate.turn, 0, 1_000_000)
        || !identifier(candidate.defeatedMemberId) || !identifier(candidate.defeatedSpecies)
        || !integer(candidate.defeatedLevel, 1, 100) || !integer(candidate.participantCount, 1, 6)
        || !Array.isArray(candidate.recipientMemberIds)
        || candidate.recipientMemberIds.length > candidate.participantCount
        || !candidate.recipientMemberIds.every(identifier)) throw new Error("Crédit d'EXP Coop invalide.");
      return { turn: candidate.turn, defeatedMemberId: candidate.defeatedMemberId,
        defeatedSpecies: candidate.defeatedSpecies, defeatedLevel: candidate.defeatedLevel,
        participantCount: candidate.participantCount,
        recipientMemberIds: [...candidate.recipientMemberIds] } as PokemonZExperienceCredit;
    });
    return { settlementId: item.settlementId, credits, policy: {
      levelCap: policy.levelCap, trainerBattle: policy.trainerBattle,
      ...(policy.experienceDisabled === undefined ? {} : { experienceDisabled: policy.experienceDisabled as boolean }),
      ...(policy.boostTenPercent === undefined ? {} : { boostTenPercent: policy.boostTenPercent as boolean }),
      ...(policy.boostTwentyPercent === undefined ? {} : { boostTwentyPercent: policy.boostTwentyPercent as boolean }),
      ...(policy.noSplitExperience === undefined ? {} : { noSplitExperience: policy.noSplitExperience as boolean }),
    } } as SourceDeferredCoopExperience;
  });
  if (new Set(entries.map((entry) => entry.settlementId)).size !== entries.length) {
    throw new Error("Journal d'EXP Coop dupliqué.");
  }
  return entries;
}

export function queueSourceDeferredCoopExperience(state: SourceEventState,
  entry: SourceDeferredCoopExperience): SourceEventState {
  if (state.deferredCoopExperience.some((existing) => existing.settlementId === entry.settlementId)) return state;
  if (state.deferredCoopExperience.length >= MAX_ENTRIES) throw new Error("Journal d'EXP Coop plein.");
  return { ...state, deferredCoopExperience: [...state.deferredCoopExperience, entry] };
}

/** Replays all credits against permanent levels in one save-state transaction. */
export function replaySourceDeferredCoopExperience(state: SourceEventState, catalog: PlayerCreationCatalog,
  hour?: number): { readonly state: SourceEventState; readonly gains: readonly SharedBattleExperienceGain[] } {
  if (state.deferredCoopExperience.length === 0) return { state, gains: [] };
  const allMembers = [...state.party.members, ...state.ranch.members,
    ...state.dayCare.slots.flatMap((slot) => slot === null ? [] : [slot.pokemon]),
    ...state.incubator.slots.flatMap((slot) => slot === null ? [] : [slot])];
  if (new Set(allMembers.map((member) => member.id)).size !== allMembers.length) {
    throw new Error("Collection Pokémon dupliquée avant le règlement Coop.");
  }
  let party: PlayerPartyState = { ...state.party, members: allMembers };
  const activePartyIds = new Set(state.party.members.map((member) => member.id));
  const gains: SharedBattleExperienceGain[] = [];
  for (const entry of state.deferredCoopExperience) {
    const result = applyPokemonZExperienceCredits(party, entry.credits, catalog, entry.policy,
      hour === undefined ? {} : { hour }, activePartyIds);
    party = result.party;
    gains.push(...result.gains);
  }
  const updated = new Map(party.members.map((member) => [member.id, member]));
  const member = <T extends typeof allMembers[number]>(pokemon: T): T => updated.get(pokemon.id) as T;
  const dayCareSlot = (index: 0 | 1) => {
    const slot = state.dayCare.slots[index];
    return slot === null ? null : { ...slot, pokemon: member(slot.pokemon) };
  };
  const incubatorSlot = (index: 0 | 1 | 2 | 3 | 4 | 5) => {
    const slot = state.incubator.slots[index];
    return slot === null ? null : member(slot);
  };
  const dayCare = { ...state.dayCare, slots: [dayCareSlot(0), dayCareSlot(1)] as const };
  const incubator = { ...state.incubator,
    slots: [incubatorSlot(0), incubatorSlot(1), incubatorSlot(2), incubatorSlot(3),
      incubatorSlot(4), incubatorSlot(5)] as const };
  return { state: { ...state,
    party: { ...state.party, members: state.party.members.map(member) },
    ranch: { ...state.ranch, members: state.ranch.members.map(member) },
    dayCare, incubator, deferredCoopExperience: [] }, gains };
}
