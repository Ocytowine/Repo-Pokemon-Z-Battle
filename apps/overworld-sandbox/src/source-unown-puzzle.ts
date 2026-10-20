import type { PlayerPartyState } from "@pokemon-z-battle/player-state";

/** Exact source spelling for ETERNO: E=4, T=19, E=4, R=17, N=13, O=14. */
export const SOURCE_UNOWN_ETERNO_FORMS = Object.freeze([4, 19, 4, 17, 13, 14] as const);

export function sourcePartySpellsUnownEterno(party: PlayerPartyState): boolean {
  return party.members.length === SOURCE_UNOWN_ETERNO_FORMS.length
    && party.members.every((pokemon, index) => pokemon.species === "UNOWN"
      && pokemon.metadata.form === SOURCE_UNOWN_ETERNO_FORMS[index]);
}
