import { pokemonTypeIconUrl } from "@pokemon-z-battle/game-assets";
import type { SourcePokemonCollectionEntry } from "./source-pokemon-collection.js";
import { sourcePokemonPowerTier, sourcePokemonStarText, sourcePokemonTypeLabel } from "./source-pokemon-collection.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export interface SourcePokemonCardOptions {
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly interactive?: boolean;
  readonly highlightPotential?: boolean;
  readonly highlightTraining?: boolean;
  readonly heldItemName?: string | null;
  readonly compact?: boolean;
  readonly showGender?: boolean;
}

function pokemonIconCycleDuration(entry: SourcePokemonCollectionEntry): number | null {
  if (entry.pokemon.hp <= 0) return null;
  const healthRatio = entry.pokemon.hp / entry.pokemon.stats.maxHp;
  if (healthRatio <= 0.25) return 1_000;
  if (healthRatio <= 0.5) return 500;
  return 250;
}

function pokemonStatusLabel(entry: SourcePokemonCollectionEntry): string | null {
  if (entry.pokemon.hp <= 0) return "K.O.";
  const kind = entry.pokemon.majorStatus?.kind;
  if (kind === "burn") return "Brûlure";
  if (kind === "poison") return "Poison";
  if (kind === "paralysis") return "Paralysie";
  if (kind === "sleep") return "Sommeil";
  if (kind === "frozen") return "Gel";
  if (kind === "hemorrhage") return "Hémorragie";
  if (kind === "caduco") return "Caduco";
  return kind ?? null;
}

/** Two-frame source icon shared by collection cards and their contextual action wheel. */
export function sourcePokemonIconHtml(entry: SourcePokemonCollectionEntry): string {
  const duration = pokemonIconCycleDuration(entry);
  const animated = duration === null ? "" : " animated";
  const timing = duration === null ? "" : `;--pokemon-icon-cycle:${duration}ms`;
  return `<span class="source-pokemon-icon${animated}" style="background-image:url('${escapeHtml(entry.iconUrl)}')${timing}" aria-hidden="true"></span>`;
}

/** Présentation commune destinée à l'équipe, au Ranch et aux sélections de combat. */
export function sourcePokemonCardHtml(entry: SourcePokemonCollectionEntry,
  options: SourcePokemonCardOptions = {}): string {
  const element = options.interactive === false ? "article" : "button";
  const selected = options.selected === true ? " selected" : "";
  const active = options.active === true ? " active" : "";
  const compact = options.compact === true ? " compact" : "";
  const attributes = element === "button"
    ? ` type="button" data-pokemon-id="${escapeHtml(entry.pokemon.id)}" aria-haspopup="dialog" aria-expanded="${options.selected === true}"` : "";
  const types = entry.types.map((type) => {
    const label = sourcePokemonTypeLabel(type);
    return `<span title="Type ${escapeHtml(label)}" aria-label="Type ${escapeHtml(label)}"><img src="${escapeHtml(pokemonTypeIconUrl(type))}" alt=""><b>${escapeHtml(label)}</b></span>`;
  }).join("");
  const moves = Array.from({ length: 4 }, (_, index) => {
    const move = entry.moves[index];
    if (move === undefined) return '<span class="source-pokemon-move empty"><b>—</b></span>';
    return `<span class="source-pokemon-move" title="${escapeHtml(`${move.name} · ${move.pp}/${move.maxPp} PP`)}"><img src="${escapeHtml(pokemonTypeIconUrl(move.type))}" alt="${escapeHtml(sourcePokemonTypeLabel(move.type))}"><b>${escapeHtml(move.name)}</b></span>`;
  }).join("");
  const hpPercent = Math.max(0, Math.min(100, Math.round((entry.pokemon.hp / entry.pokemon.stats.maxHp) * 100)));
  const heldItem = entry.pokemon.heldItem === null ? ""
    : `<span class="source-pokemon-held-item" title="Objet tenu : ${escapeHtml(options.heldItemName ?? entry.pokemon.heldItem)}"><i aria-hidden="true">◆</i><b>${escapeHtml(options.heldItemName ?? entry.pokemon.heldItem)}</b></span>`;
  const statusLabel = pokemonStatusLabel(entry);
  const gender = options.showGender !== true ? "" : entry.pokemon.metadata.gender === "male"
    ? '<span class="source-pokemon-gender" data-gender="male" title="Mâle">♂</span>'
    : entry.pokemon.metadata.gender === "female"
      ? '<span class="source-pokemon-gender" data-gender="female" title="Femelle">♀</span>'
      : '<span class="source-pokemon-gender" data-gender="genderless" title="Sans genre">◇</span>';
  const status = statusLabel === null ? ""
    : `<span class="source-pokemon-card-status">${escapeHtml(statusLabel)}</span>`;
  const vitals = options.compact === true && entry.location === "ranch" ? ""
    : `<span class="source-pokemon-vitals"><i><b style="width:${hpPercent}%"></b></i><em>${entry.pokemon.hp}/${entry.pokemon.stats.maxHp} PV</em></span>`;
  const collectionContext = options.compact === true ? ""
    : `<small>#${String(entry.number).padStart(3, "0")} · ${entry.location === "team" ? "ÉQUIPE" : "RANCH"}</small>`;
  const metrics = options.highlightPotential !== true && options.highlightTraining !== true ? ""
    : `<span class="source-pokemon-card-metrics">${options.highlightPotential === true
      ? `<b>Potentiel ${entry.potentialPower} · ${escapeHtml(sourcePokemonPowerTier(entry.potentialPower).label)}</b>` : ""}${options.highlightTraining === true
      ? `<b>IV ${sourcePokemonStarText(entry.ivStars)} · EV ${sourcePokemonStarText(entry.evStars)}</b>` : ""}</span>`;
  return `<${element}${attributes} class="source-pokemon-card${selected}${active}${compact}">
    ${sourcePokemonIconHtml(entry)}
    <span class="source-pokemon-card-copy">${collectionContext}<strong>${escapeHtml(entry.displayName)} ${gender} <em>N.${entry.pokemon.level}</em></strong><span class="source-pokemon-types">${types}</span>${heldItem}${status}${vitals}</span>
    <span class="source-pokemon-moves" aria-label="Capacités de ${escapeHtml(entry.displayName)}">${moves}</span>${metrics}
  </${element}>`;
}
