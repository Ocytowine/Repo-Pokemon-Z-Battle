import { playerPartyToBattleTeam, type PersistentPokemon, type PlayerBattleCatalog,
  type PlayerPartyState } from "@pokemon-z-battle/player-state";
import type { BattleTeam, BattlerState } from "@pokemon-z-battle/battle-engine";

export interface SourceBattleTeamPreparation {
  readonly team: BattleTeam | null;
  readonly unavailableReason: string | null;
  readonly requiresHealing: boolean;
  readonly notice: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : "Mécanique de combat non prise en charge.";
}

function projectJoinMember(party: PlayerPartyState, member: PersistentPokemon,
  catalog: PlayerBattleCatalog): { readonly battler: BattlerState; readonly omittedMoves: number } {
  const project = (candidate: PersistentPokemon): BattlerState => playerPartyToBattleTeam(
    { ...party, activeIndex: 0, members: [candidate] }, catalog).members[0]!;
  try {
    return { battler: project(member), omittedMoves: 0 };
  } catch (originalError) {
    const compatibleMoves = member.moves.filter((move) => {
      try {
        project({ ...member, moves: [move] });
        return true;
      } catch {
        return false;
      }
    });
    if (compatibleMoves.length === 0) throw originalError;
    return { battler: project({ ...member, moves: compatibleMoves }),
      omittedMoves: member.moves.length - compatibleMoves.length };
  }
}

/**
 * Builds the personal team sent with a Coop join intent. One unsupported reserve must not
 * disguise a healthy party as fainted or prevent compatible conscious members from joining.
 */
export function prepareSourceBattleJoinTeam(party: PlayerPartyState,
  catalog: PlayerBattleCatalog): SourceBattleTeamPreparation {
  if (party.members.length === 0) return { team: null,
    unavailableReason: "Votre équipe est vide.", requiresHealing: false, notice: null };
  if (party.members.every((member) => member.hp <= 0)) return { team: null,
    unavailableReason: "Aucun Pokémon conscient n'est disponible pour rejoindre ce combat.",
    requiresHealing: true, notice: null };

  try {
    return { team: playerPartyToBattleTeam(party, catalog), unavailableReason: null,
      requiresHealing: false, notice: null };
  } catch (wholeTeamError) {
    const compatible: BattleTeam["members"][number][] = [];
    const failures: string[] = [];
    let omittedMoves = 0;
    for (const member of party.members) {
      if (member.hp <= 0) continue;
      try {
        const projected = projectJoinMember(party, member, catalog);
        compatible.push(projected.battler);
        omittedMoves += projected.omittedMoves;
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
    ].filter((notice): notice is string => notice !== null);
    return { team: { activeIndex: 0, members: compatible }, unavailableReason: null,
      requiresHealing: false, notice: notices.length === 0 ? null
        : `${notices.join(" et ")} pour cette participation. Les données personnelles non engagées restent inchangées.` };
  }
}
