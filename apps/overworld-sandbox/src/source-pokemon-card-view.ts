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
    ? ` type="button" data-pokemon-id="${escapeHtml(entry.pokemon.id)}" aria-haspopup="dialog" aria-expanded="${options.selected === true}"` : "";
  const types = entry.types.map((type) => `<span><img src="${escapeHtml(pokemonTypeIconUrl(type))}" alt=""><b>${escapeHtml(sourcePokemonTypeLabel(type))}</b></span>`).join("");
  const moves = Array.from({ length: 4 }, (_, index) => {
    const move = entry.moves[index];
    if (move === undefined) return '<span class="source-pokemon-move empty"><b>—</b></span>';
    return `<span class="source-pokemon-move" title="${escapeHtml(`${move.name} · ${move.pp}/${move.maxPp} PP`)}"><img src="${escapeHtml(pokemonTypeIconUrl(move.type))}" alt="${escapeHtml(sourcePokemonTypeLabel(move.type))}"><b>${escapeHtml(move.name)}</b></span>`;
  }).join("");
  const hpPercent = Math.max(0, Math.min(100, Math.round((entry.pokemon.hp / entry.pokemon.stats.maxHp) * 100)));
  return `<${element}${attributes} class="source-pokemon-card${selected}${active}">
    <span class="source-pokemon-icon" style="background-image:url('${entry.iconUrl}')" aria-hidden="true"></span>
    <span class="source-pokemon-card-copy"><small>#${String(entry.number).padStart(3, "0")} · ${entry.location === "team" ? "ÉQUIPE" : "RANCH"}</small><strong>${escapeHtml(entry.displayName)} <em>N.${entry.pokemon.level}</em></strong><span class="source-pokemon-types">${types}</span><span class="source-pokemon-vitals"><i><b style="width:${hpPercent}%"></b></i><em>${entry.pokemon.hp}/${entry.pokemon.stats.maxHp} PV</em></span></span>
    <span class="source-pokemon-moves" aria-label="Capacités de ${escapeHtml(entry.displayName)}">${moves}</span>
  </${element}>`;
}
