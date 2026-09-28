import { createTeamBattleState, replaceFaintedPokemon, resolveTeamTurn,
  type RandomSource, type TeamBattleState, type TeamTurnResult } from "@pokemon-z-battle/battle-engine";
import { addPokemonToParty, createEmptyPlayerParty, createPersistentPokemon, healPlayerParty, playerPartyToBattleTeam, storeBattleTeam,
  type PlayerCreationCatalog, type PlayerPartyState } from "@pokemon-z-battle/player-state";

export interface SourceEncounterRequest {
  readonly species: string;
  readonly level: number;
}

export function createSourceEncounterBattle(party: PlayerPartyState, encounter: SourceEncounterRequest,
  catalog: PlayerCreationCatalog, opponentId: string): TeamBattleState {
  const player = playerPartyToBattleTeam(party, catalog);
  const opponentParty = addPokemonToParty(createEmptyPlayerParty(),
    createPersistentPokemon(opponentId, encounter.species, encounter.level, catalog));
  const opponent = playerPartyToBattleTeam(opponentParty, catalog);
  return createTeamBattleState({ player: player.members, opponent: opponent.members },
    { player: player.activeIndex, opponent: opponent.activeIndex });
}

export function resolveSourceEncounterTurn(state: TeamBattleState, playerMoveIndex: number,
  rng: RandomSource): TeamTurnResult {
  const player = state.teams.player.members[state.teams.player.activeIndex];
  const opponent = state.teams.opponent.members[state.teams.opponent.activeIndex];
  const playerMove = player?.moves[playerMoveIndex];
  if (playerMove === undefined || playerMove.pp <= 0) throw new Error("Cette capacité n'est pas disponible.");
  const opponentMoves = opponent?.moves.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.pp > 0) ?? [];
  if (opponentMoves.length === 0) throw new Error("L'adversaire n'a plus de capacité disponible.");
  const opponentMove = opponentMoves[rng.nextInt(opponentMoves.length)];
  if (opponentMove === undefined) throw new Error("Choix de capacité adverse impossible.");
  return resolveTeamTurn(state, {
    player: { kind: "move", moveIndex: playerMoveIndex },
    opponent: { kind: "move", moveIndex: opponentMove.index },
  }, rng);
}

export function applyAutomaticReplacements(state: TeamBattleState): TeamBattleState {
  if (state.status === "finished" || state.replacementRequired.length === 0) return state;
  const replacements: Partial<Record<"player" | "opponent", number>> = {};
  for (const side of state.replacementRequired) {
    const team = state.teams[side];
    const replacement = team.members.findIndex((member, index) => index !== team.activeIndex && member.hp > 0);
    if (replacement < 0) throw new Error(`Aucun remplaçant valide pour ${side}.`);
    replacements[side] = replacement;
  }
  return replaceFaintedPokemon(state, replacements).state;
}

export function storeSourceEncounterParty(party: PlayerPartyState, state: TeamBattleState): PlayerPartyState {
  return storeBattleTeam(party, state.teams.player);
}

export interface SourceEncounterSettlement {
  readonly party: PlayerPartyState;
  readonly completed: boolean;
}

export function settleSourceEncounter(party: PlayerPartyState, state: TeamBattleState): SourceEncounterSettlement {
  if (state.status !== "finished" || state.winner === null) throw new Error("Le combat source n'est pas terminé.");
  const stored = storeSourceEncounterParty(party, state);
  return state.winner === "player" ? { party: stored, completed: true }
    : { party: healPlayerParty(stored), completed: false };
}
