import { calculatePokemonStats, isHeldItemSupported, playerPartyToBattleTeam, type PersistentPokemon, type PlayerBattleCatalog,
  type PlayerPartyState } from "@pokemon-z-battle/player-state";
import type { BattleTeam, BattlerState } from "@pokemon-z-battle/battle-engine";
import { sourceMegaEvolutionForPokemon, type SourceMegaEvolutionCatalog } from "./source-mega-evolution.js";

export interface SourceBattleTeamPreparation {
  readonly team: BattleTeam | null;
  readonly unavailableReason: string | null;
  readonly requiresHealing: boolean;
  readonly notice: string | null;
}

function withMoveFormStats(battler: BattlerState, member: PersistentPokemon,
  catalog: PlayerBattleCatalog): BattlerState {
  if (member.species !== "CONSTELLAR") return battler;
  const definition = catalog.pokemon.find((entry) => entry.internalName === member.species);
  if (definition?.baseStats === undefined) return battler;
  const base: Partial<Parameters<typeof calculatePokemonStats>[0]["baseStats"]> = definition.baseStats;
  if (base.hp === undefined || base.speed === undefined || base.attack === undefined || base.defense === undefined
    || base.specialAttack === undefined || base.specialDefense === undefined) return battler;
  const alternate = { hp: base.hp, speed: base.speed,
    attack: base.specialAttack, defense: base.specialDefense,
    specialAttack: base.attack, specialDefense: base.defense };
  const formZero = calculatePokemonStats({ baseStats: base as Required<typeof base> },
    member.level, member.metadata);
  const formOne = calculatePokemonStats({ baseStats: alternate }, member.level, member.metadata);
  return { ...battler, moveFormStats: { 0: formZero, 1: formOne } };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : "Mécanique de combat non prise en charge.";
}

function projectJoinMember(party: PlayerPartyState, member: PersistentPokemon,
  catalog: PlayerBattleCatalog, megaCatalog?: SourceMegaEvolutionCatalog,
  megaActivationAvailable = false): { readonly battler: BattlerState; readonly omittedMoves: number;
    readonly omittedHeldItem: boolean } {
  const megaEvolution = sourceMegaEvolutionForPokemon(megaCatalog, member.species, member.heldItem);
  const project = (candidate: PersistentPokemon): BattlerState => {
    const conscious = candidate.hp > 0 ? candidate : { ...candidate, hp: 1 };
    const battler = playerPartyToBattleTeam(
      { ...party, activeIndex: 0, members: [conscious] }, catalog).members[0]!;
    return { ...withMoveFormStats(battler, candidate, catalog), hp: candidate.hp,
      ...(megaEvolution === undefined ? {} : { megaEvolution: {
        heldItem: megaEvolution.heldItem, form: megaEvolution.form,
        stats: calculatePokemonStats({ baseStats: megaEvolution.baseStats }, member.level, member.metadata),
        types: [...megaEvolution.types], ability: megaEvolution.ability, activationAvailable: megaActivationAvailable } }) };
  };
  const omittedHeldItem = member.heldItem !== null && !isHeldItemSupported(member.heldItem)
    && megaEvolution === undefined;
  const compatibleMember = omittedHeldItem ? { ...member, heldItem: null } : member;
  const battleMember = megaEvolution === undefined ? compatibleMember : { ...compatibleMember, heldItem: null };
  try {
    return { battler: project(battleMember), omittedMoves: 0, omittedHeldItem };
  } catch (originalError) {
    const compatibleMoves = battleMember.moves.filter((move) => {
      try {
        project({ ...battleMember, moves: [move] });
        return true;
      } catch {
        return false;
      }
    });
    if (compatibleMoves.length === 0) throw originalError;
    return { battler: project({ ...battleMember, moves: compatibleMoves }),
      omittedMoves: member.moves.length - compatibleMoves.length, omittedHeldItem };
  }
}

/**
 * Builds the personal team sent with a Coop join intent. One unsupported reserve must not
 * disguise a healthy party as fainted or prevent compatible conscious members from joining.
 */
export function prepareSourcePlayerBattleTeam(party: PlayerPartyState,
  catalog: PlayerBattleCatalog, megaCatalog?: SourceMegaEvolutionCatalog,
  megaActivationAvailable = false): SourceBattleTeamPreparation {
  if (party.members.length === 0) return { team: null,
    unavailableReason: "Votre équipe est vide.", requiresHealing: false, notice: null };
  if (party.members.every((member) => member.hp <= 0)) return { team: null,
    unavailableReason: "Aucun Pokémon conscient n'est disponible pour participer à ce combat.",
    requiresHealing: true, notice: null };

  try {
    const team = playerPartyToBattleTeam(party, catalog);
    return { team: { ...team, members: team.members.map((battler, index) => {
      const member = party.members[index]!;
      const megaEvolution = sourceMegaEvolutionForPokemon(megaCatalog, member.species, member.heldItem);
      const moveForm = withMoveFormStats(battler, member, catalog);
      return megaEvolution === undefined ? moveForm : { ...moveForm,
        megaEvolution: { heldItem: megaEvolution.heldItem, form: megaEvolution.form,
          stats: calculatePokemonStats({ baseStats: megaEvolution.baseStats }, member.level, member.metadata),
          types: [...megaEvolution.types], ability: megaEvolution.ability, activationAvailable: megaActivationAvailable } };
    }) }, unavailableReason: null,
      requiresHealing: false, notice: null };
  } catch (wholeTeamError) {
    const compatible: BattleTeam["members"][number][] = [];
    const failures: string[] = [];
    let omittedMoves = 0;
    let omittedHeldItems = 0;
    for (const member of party.members) {
      try {
        const projected = projectJoinMember(party, member, catalog, megaCatalog, megaActivationAvailable);
        compatible.push(projected.battler);
        omittedMoves += projected.omittedMoves;
        omittedHeldItems += Number(projected.omittedHeldItem);
      } catch (error) {
        failures.push(`${member.nickname ?? member.species} : ${errorMessage(error)}`);
      }
    }
    if (compatible.length === 0) return { team: null,
      unavailableReason: `L'équipe est en forme, mais aucune composition compatible ne peut être construite. ${failures[0] ?? errorMessage(wholeTeamError)}`,
      requiresHealing: false, notice: null };
    const notices = [
      failures.length === 0 ? null
        : `${failures.length} Pokémon ${failures.length > 1 ? "ont été écartés" : "a été écarté"}`,
      omittedMoves === 0 ? null
        : `${omittedMoves} capacité${omittedMoves > 1 ? "s non prises" : " non prise"} en charge ${omittedMoves > 1 ? "ont été retirées" : "a été retirée"}`,
      omittedHeldItems === 0 ? null
        : `${omittedHeldItems} objet${omittedHeldItems > 1 ? "s tenus ont" : " tenu a"} été neutralisé${omittedHeldItems > 1 ? "s" : ""}`,
    ].filter((notice): notice is string => notice !== null);
    const activeIndex = compatible.findIndex((member) => member.hp > 0);
    return { team: { activeIndex, members: compatible }, unavailableReason: null,
      requiresHealing: false, notice: notices.length === 0 ? null
        : `${notices.join(" et ")} pour ce combat. Les données personnelles restent inchangées.` };
  }
}

export const prepareSourceBattleJoinTeam = prepareSourcePlayerBattleTeam;
