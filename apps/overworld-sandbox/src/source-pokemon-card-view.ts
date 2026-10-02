import { pokemonTypeIconUrl } from "@pokemon-z-battle/game-assets";
import type { SourcePokemonCollectionEntry } from "./source-pokemon-collection.js";
import { sourcePokemonTypeLabel } from "./source-pokemon-collection.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export interface SourcePokemonCardOptions {
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly interactive?: boolean;
}

/** Présentation commune destinée à l'équipe, au Ranch et aux sélections de combat. */
export function sourcePokemonCardHtml(entry: SourcePokemonCollectionEntry,
  options: SourcePokemonCardOptions = {}): string {
  const element = options.interactive === false ? "article" : "button";
  const selected = options.selected === true ? " selected" : "";
  const active = options.active === true ? " active" : "";
  const attributes = element === "button"
    ? ` type="button" data-pokemon-id="${escapeHtml(entry.pokemon.id)}"` : "";
  const types = entry.types.map((type) => `<span><img src="${escapeHtml(pokemonTypeIconUrl(type))}" alt=""><b>${escapeHtml(sourcePokemonTypeLabel(type))}</b></span>`).join("");
  return `<${element}${attributes} class="source-pokemon-card${selected}${active}">
    <span class="source-pokemon-icon" style="background-image:url('${entry.iconUrl}')" aria-hidden="true"></span>
    <span class="source-pokemon-card-copy"><small>#${String(entry.number).padStart(3, "0")} · ${entry.location === "team" ? "ÉQUIPE" : "RANCH"}</small><strong>${escapeHtml(entry.displayName)} <em>N.${entry.pokemon.level}</em></strong><span class="source-pokemon-types">${types}</span></span>
    <span class="source-pokemon-power"><small>ACTUEL</small><strong>${entry.currentPower}</strong><small>POTENTIEL</small><strong>${entry.potentialPower}</strong></span>
  </${element}>`;
}
