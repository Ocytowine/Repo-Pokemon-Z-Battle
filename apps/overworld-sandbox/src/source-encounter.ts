import { createTeamBattleState, replaceFaintedPokemon, resolveTeamTurn,
  type RandomSource, type TeamBattleState, type TeamTurnResult } from "@pokemon-z-battle/battle-engine";
import { addPokemonToParty, createEmptyPlayerParty, createPersistentPokemon, grantPokemonExperience, healPlayerParty, playerPartyToBattleTeam, storeBattleTeam,
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

export type SourceEscapeResult = { readonly escaped: true } | { readonly escaped: false; readonly turn: TeamTurnResult };

export function attemptSourceEncounterEscape(state: TeamBattleState, attempts: number,
  rng: RandomSource): SourceEscapeResult {
  if (!Number.isSafeInteger(attempts) || attempts < 0) throw new Error("Nombre de tentatives de fuite invalide.");
  const player = state.teams.player.members[state.teams.player.activeIndex];
  const opponent = state.teams.opponent.members[state.teams.opponent.activeIndex];
  if (player === undefined || opponent === undefined) throw new Error("Combattant actif introuvable.");
  const rate = player.stats.speed > opponent.stats.speed ? 256
    : (Math.floor((player.stats.speed * 128) / Math.max(1, opponent.stats.speed)) + attempts * 30) & 0xff;
  if (rate === 256 || rng.nextInt(256) < rate) return { escaped: true };
  const opponentMoves = opponent.moves.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.pp > 0);
  const opponentMove = opponentMoves[rng.nextInt(opponentMoves.length)];
  if (opponentMove === undefined) throw new Error("Choix de capacité adverse impossible.");
  return { escaped: false, turn: resolveTeamTurn(state,
    { player: { kind: "wait" }, opponent: { kind: "move", moveIndex: opponentMove.index } }, rng) };
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
  readonly experience: { readonly amount: number; readonly pokemonId: string; readonly levelsGained: number;
    readonly learnedMoves: readonly string[]; readonly skippedMoves: readonly string[] } | null;
}

export function scaledWildExperience(defeatedLevel: number, baseExperience: number, recipientLevel: number): number {
  if (![defeatedLevel, baseExperience, recipientLevel].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("Paramètres de gain d'expérience invalides.");
  }
  let experience = Math.floor((defeatedLevel * baseExperience) / 5);
  const levelAdjustment = ((2 * defeatedLevel + 10) / (defeatedLevel + recipientLevel + 10)) ** 2.5;
  experience = Math.floor(experience * levelAdjustment);
  return experience + 1;
}

export function settleSourceEncounter(party: PlayerPartyState, state: TeamBattleState,
  catalog?: PlayerCreationCatalog): SourceEncounterSettlement {
  if (state.status !== "finished" || state.winner === null) throw new Error("Le combat source n'est pas terminé.");
  const stored = storeSourceEncounterParty(party, state);
  if (state.winner !== "player") return { party: healPlayerParty(stored), completed: false, experience: null };
  const activeIndex = stored.activeIndex;
  const defeated = state.teams.opponent.members[state.teams.opponent.activeIndex];
  const recipient = activeIndex === null ? undefined : stored.members[activeIndex];
  if (catalog === undefined || defeated === undefined || recipient === undefined || recipient.hp <= 0) {
    return { party: stored, completed: true, experience: null };
  }
  const definition = catalog.pokemon.find((candidate) => candidate.internalName === defeated.species);
  if (definition === undefined) throw new Error(`Espèce vaincue absente du catalogue : ${defeated.species}.`);
  const reward = grantPokemonExperience(recipient,
    scaledWildExperience(defeated.level, definition.baseExperience, recipient.level), catalog);
  const members = stored.members.map((member, index) => index === activeIndex ? reward.pokemon : member);
  return { party: { ...stored, members }, completed: true, experience: { amount: reward.gained, pokemonId: recipient.id,
    levelsGained: reward.levelsGained, learnedMoves: reward.learnedMoves, skippedMoves: reward.skippedMoves } };
}
