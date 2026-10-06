import { attemptSourceBattleEscape, chooseSourceBattleAction, createDoubleTeamBattleState, createTeamBattleState, replaceFaintedPokemon, resolveTeamTurn,
  type RandomSource, type TeamBattleAction, type TeamBattleState, type TeamReplacementResult,
  type TeamTurnResult } from "@pokemon-z-battle/battle-engine";
import { addPokemonToParty, createEmptyPlayerParty, createPersistentPokemon, grantPokemonExperience, healPlayerParty, playerPartyToBattleTeam, storeBattleTeam,
  type PlayerCreationCatalog, type PlayerPartyState } from "@pokemon-z-battle/player-state";

export interface SourceEncounterRequest {
  readonly species: string;
  readonly level: number;
}

export interface SourceTrainerDefinition {
  readonly trainerType: string;
  readonly name: string;
  readonly version: number;
  readonly pokemon: readonly { readonly species: string; readonly level: number;
    readonly moves: readonly (string | null)[] }[];
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

export function createSourceTrainerBattle(party: PlayerPartyState, trainer: SourceTrainerDefinition,
  catalog: PlayerCreationCatalog, format: "single" | "double" = "single"): TeamBattleState {
  const player = playerPartyToBattleTeam(party, catalog);
  let opponentParty = createEmptyPlayerParty();
  trainer.pokemon.forEach((member, index) => {
    let pokemon = createPersistentPokemon(`trainer-${trainer.trainerType.toLowerCase()}-${trainer.version}-${index}`,
      member.species, member.level, catalog);
    const explicitMoves = member.moves.filter((move): move is string => move !== null && move !== "");
    if (explicitMoves.length > 0) {
      pokemon = { ...pokemon, moves: explicitMoves.map((internalName) => {
        const move = catalog.moves.find((candidate) => candidate.internalName === internalName);
        if (move === undefined) throw new Error(`Capacité de Dresseur absente du catalogue : ${internalName}.`);
        return { internalName, pp: move.pp, maxPp: move.pp };
      }) };
    }
    opponentParty = addPokemonToParty(opponentParty, pokemon);
  });
  const opponent = playerPartyToBattleTeam(opponentParty, catalog);
  return format === "double"
    ? createDoubleTeamBattleState({ player: player.members, opponent: opponent.members })
    : createTeamBattleState({ player: player.members, opponent: opponent.members },
      { player: player.activeIndex, opponent: opponent.activeIndex });
}

export function resolveSourceEncounterAction(state: TeamBattleState, playerAction: TeamBattleAction,
  rng: RandomSource): TeamTurnResult {
  const player = state.teams.player.members[state.teams.player.activeIndex];
  if (player === undefined) throw new Error("Combattant actif introuvable.");
  if (playerAction.kind === "move") {
    const playerMove = player.moves[playerAction.moveIndex];
    if (playerMove === undefined || playerMove.pp <= 0) throw new Error("Cette capacité n'est pas disponible.");
  }
  return resolveTeamTurn(state, {
    player: playerAction,
    opponent: chooseSourceBattleAction(state, "opponent", rng),
  }, rng);
}

export function resolveSourceEncounterTurn(state: TeamBattleState, playerMoveIndex: number,
  rng: RandomSource): TeamTurnResult {
  return resolveSourceEncounterAction(state, { kind: "move", moveIndex: playerMoveIndex }, rng);
}

export type SourceEscapeResult = { readonly escaped: true } | { readonly escaped: false; readonly turn: TeamTurnResult };

export function attemptSourceEncounterEscape(state: TeamBattleState, attempts: number,
  rng: RandomSource): SourceEscapeResult {
  return attemptSourceBattleEscape(state, attempts, rng);
}

export function resolveAutomaticReplacements(state: TeamBattleState): TeamReplacementResult {
  if (state.status === "finished" || state.replacementRequired.length === 0) {
    return { state, events: [], trace: [] };
  }
  const replacements: Partial<Record<"player" | "opponent", number>> = {};
  for (const side of state.replacementRequired) {
    const team = state.teams[side];
    const replacement = team.members.findIndex((member, index) => index !== team.activeIndex && member.hp > 0);
    if (replacement < 0) throw new Error(`Aucun remplaçant valide pour ${side}.`);
    replacements[side] = replacement;
  }
  return replaceFaintedPokemon(state, replacements);
}

export function applyAutomaticReplacements(state: TeamBattleState): TeamBattleState {
  return resolveAutomaticReplacements(state).state;
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
