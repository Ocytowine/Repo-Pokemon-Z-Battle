import { attemptSourceBattleEscape, chooseSourceBattleAction, createDoubleTeamBattleState, createTeamBattleState, replaceFaintedPokemon, resolveTeamTurn,
  sharedBattleOwnerSettlement,
  type PokemonItemUsePolicy,
  type RandomSource, type SharedBattleLedger, type SharedBattleParticipation, type TeamBattleAction,
  type TeamBattleState, type TeamReplacementResult, type TeamTurnActions, type TeamTurnResult } from "@pokemon-z-battle/battle-engine";
import { addPokemonToParty, applySharedBattleExperience, createEmptyPlayerParty, createPersistentPokemon,
  grantPokemonExperience, healPlayerParty, playerPartyToBattleTeam, pokemonLevelEvolutionCandidates,
  storeOwnedBattleResults, storeProjectedBattleTeam, type PlayerCreationCatalog, type PlayerPartyState,
  type PokemonZExperiencePolicy, type SharedBattleExperienceGain } from "@pokemon-z-battle/player-state";
import { prepareSourcePlayerBattleTeam } from "./source-battle-team-preparation.js";

export interface SourceEncounterRequest {
  readonly species: string;
  readonly level: number;
}

export interface SourceTrainerDefinition {
  readonly trainerType: string;
  readonly name: string;
  readonly version: number;
  readonly items?: readonly string[];
  readonly pokemon: readonly { readonly species: string; readonly level: number;
    readonly heldItem?: string | null; readonly moves: readonly (string | null)[];
    readonly abilityIndex?: number | null }[];
}

function sourcePlayerBattleTeam(party: PlayerPartyState, catalog: PlayerCreationCatalog) {
  const preparation = prepareSourcePlayerBattleTeam(party, catalog);
  if (preparation.team === null) {
    throw new Error(preparation.unavailableReason ?? "L'équipe ne peut pas participer à ce combat.");
  }
  return preparation.team;
}

export function createSourceEncounterBattle(party: PlayerPartyState, encounter: SourceEncounterRequest,
  catalog: PlayerCreationCatalog, opponentId: string): TeamBattleState {
  const player = sourcePlayerBattleTeam(party, catalog);
  const opponentParty = addPokemonToParty(createEmptyPlayerParty(),
    createPersistentPokemon(opponentId, encounter.species, encounter.level, catalog));
  const opponent = playerPartyToBattleTeam(opponentParty, catalog);
  return createTeamBattleState({ player: player.members, opponent: opponent.members },
    { player: player.activeIndex, opponent: opponent.activeIndex });
}

export function createSourceTrainerBattle(party: PlayerPartyState, trainer: SourceTrainerDefinition,
  catalog: PlayerCreationCatalog, format: "single" | "double" = "single"): TeamBattleState {
  const player = sourcePlayerBattleTeam(party, catalog);
  let opponentParty = createEmptyPlayerParty();
  trainer.pokemon.forEach((member, index) => {
    let pokemon = createPersistentPokemon(`trainer-${trainer.trainerType.toLowerCase()}-${trainer.version}-${index}`,
      member.species, member.level, catalog);
    const species = catalog.pokemon.find((candidate) => candidate.internalName === member.species);
    if (species === undefined) throw new Error(`Espèce de Dresseur absente du catalogue : ${member.species}.`);
    const abilityIndex = member.abilityIndex ?? null;
    const ability = abilityIndex === null
      ? pokemon.ability
      : abilityIndex < species.abilities.length
        ? species.abilities[abilityIndex] ?? null
        : species.hiddenAbilities?.[abilityIndex - species.abilities.length] ?? null;
    if (abilityIndex !== null && ability === null) {
      throw new Error(`Index de talent invalide pour ${member.species} : ${abilityIndex}.`);
    }
    pokemon = { ...pokemon, ability, heldItem: member.heldItem ?? null };
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
  const state = format === "double"
    ? createDoubleTeamBattleState({ player: player.members, opponent: opponent.members })
    : createTeamBattleState({ player: player.members, opponent: opponent.members },
      { player: player.activeIndex, opponent: opponent.activeIndex });
  return { ...state, teams: { ...state.teams,
    opponent: { ...state.teams.opponent, items: [...(trainer.items ?? [])] } } };
}

export function resolveSourceEncounterAction(state: TeamBattleState, playerAction: TeamBattleAction,
  rng: RandomSource, itemPolicy?: PokemonItemUsePolicy): TeamTurnResult & { readonly actions: TeamTurnActions } {
  const player = state.teams.player.members[state.teams.player.activeIndex];
  if (player === undefined) throw new Error("Combattant actif introuvable.");
  if (playerAction.kind === "move") {
    const playerMove = player.moves[playerAction.moveIndex];
    if (playerMove === undefined || playerMove.pp <= 0) throw new Error("Cette capacité n'est pas disponible.");
  }
  const actions: TeamTurnActions = {
    player: playerAction,
    opponent: chooseSourceBattleAction(state, "opponent", rng),
  };
  return { ...resolveTeamTurn(state, actions, rng, itemPolicy), actions };
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
  return storeProjectedBattleTeam(party, state.teams.player);
}

export interface SourceEncounterSettlement {
  readonly party: PlayerPartyState;
  readonly completed: boolean;
  readonly experience: { readonly amount: number; readonly pokemonId: string; readonly levelsGained: number;
    readonly learnedMoves: readonly string[]; readonly skippedMoves: readonly string[];
    readonly calculation: ScaledWildExperienceCalculation } | null;
}

export interface SourceTrainerBattleSettlement {
  readonly party: PlayerPartyState;
  readonly completed: boolean;
  readonly gains: readonly SharedBattleExperienceGain[];
}

/** Solo adapter over the same ownership, participation and EXP kernel used by an authoritative room. */
export function settleSourceTrainerBattle(party: PlayerPartyState, state: TeamBattleState,
  participation: SharedBattleParticipation, ledger: SharedBattleLedger, catalog: PlayerCreationCatalog,
  policy: Omit<PokemonZExperiencePolicy, "trainerBattle">, evolutionHour?: number,
): SourceTrainerBattleSettlement {
  if (state.status !== "finished" || state.winner === null) {
    throw new Error("Le combat de Dresseur n'est pas termine.");
  }
  const stored = storeOwnedBattleResults(party, participation, state, "local");
  if (state.winner !== "player") return { party: healPlayerParty(stored), completed: false, gains: [] };
  const tactical = sharedBattleOwnerSettlement(participation, state, ledger, "local");
  const experience = applySharedBattleExperience(stored, tactical, catalog,
    { ...policy, trainerBattle: true }, evolutionHour === undefined ? {} : { hour: evolutionHour });
  return { party: experience.party, completed: true, gains: experience.gains };
}

export interface ScaledWildExperienceCalculation {
  readonly formula: "legacy-wild";
  readonly defeatedLevel: number;
  readonly defeatedBaseExperience: number;
  readonly recipientLevel: number;
  readonly multipliedExperience: number;
  readonly afterDivisionByFive: number;
  readonly levelAdjustment: number;
  readonly afterLevelAdjustment: number;
  readonly result: number;
}

export function scaledWildExperience(defeatedLevel: number, baseExperience: number, recipientLevel: number): number {
  return scaledWildExperienceCalculation(defeatedLevel, baseExperience, recipientLevel).result;
}

export function scaledWildExperienceCalculation(defeatedLevel: number, baseExperience: number,
  recipientLevel: number): ScaledWildExperienceCalculation {
  if (![defeatedLevel, baseExperience, recipientLevel].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("Paramètres de gain d'expérience invalides.");
  }
  const multipliedExperience = defeatedLevel * baseExperience;
  const afterDivisionByFive = Math.floor(multipliedExperience / 5);
  const levelAdjustment = ((2 * defeatedLevel + 10) / (defeatedLevel + recipientLevel + 10)) ** 2.5;
  const afterLevelAdjustment = Math.floor(afterDivisionByFive * levelAdjustment);
  return { formula: "legacy-wild", defeatedLevel, defeatedBaseExperience: baseExperience, recipientLevel,
    multipliedExperience, afterDivisionByFive, levelAdjustment, afterLevelAdjustment,
    result: afterLevelAdjustment + 1 };
}

export function settleSourceEncounter(party: PlayerPartyState, state: TeamBattleState,
  catalog?: PlayerCreationCatalog, evolutionHour?: number): SourceEncounterSettlement {
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
  const calculation = scaledWildExperienceCalculation(defeated.level, definition.baseExperience, recipient.level);
  const reward = grantPokemonExperience(recipient, calculation.result, catalog);
  const progressedParty = { ...stored,
    members: stored.members.map((member, index) => index === activeIndex ? reward.pokemon : member) };
  const evolution = reward.levelsGained > 0 && (reward.pokemon.pendingMoves?.length ?? 0) === 0
    ? pokemonLevelEvolutionCandidates(reward.pokemon, catalog, {
      ...(evolutionHour === undefined ? {} : { hour: evolutionHour }), party: progressedParty,
    })[0]
    : undefined;
  const progressedPokemon = evolution === undefined ? reward.pokemon : { ...reward.pokemon, pendingEvolution: evolution };
  const members = progressedParty.members.map((member, index) => index === activeIndex ? progressedPokemon : member);
  return { party: { ...progressedParty, members }, completed: true, experience: { amount: reward.gained, pokemonId: recipient.id,
    levelsGained: reward.levelsGained, learnedMoves: reward.learnedMoves, skippedMoves: reward.skippedMoves,
    calculation } };
}
