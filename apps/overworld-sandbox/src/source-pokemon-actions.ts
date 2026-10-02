import type { SourcePokemonCollectionEntry } from "./source-pokemon-collection.js";

export type SourcePokemonActionContext = "team" | "ranch" | "battle";
export type SourcePokemonActionId = "details" | "make-lead" | "give-item" | "deposit" | "withdraw"
  | "mark" | "release" | "switch";

export interface SourcePokemonAction {
  readonly id: SourcePokemonActionId;
  readonly label: string;
  readonly symbol: string;
  readonly enabled: boolean;
  readonly hint: string;
}

export interface SourcePokemonActionOptions {
  readonly partySize: number;
  readonly partyFull: boolean;
  readonly activePokemonId: string | null;
}

const future = (id: SourcePokemonActionId, label: string, symbol: string): SourcePokemonAction =>
  ({ id, label, symbol, enabled: false, hint: "À raccorder" });

/** Contextual action contract shared by team, Ranch and future battle selections. */
export function sourcePokemonActions(context: SourcePokemonActionContext, entry: SourcePokemonCollectionEntry,
  options: SourcePokemonActionOptions): readonly SourcePokemonAction[] {
  const details = future("details", "Détails", "i");
  const item = future("give-item", entry.pokemon.heldItem === null ? "Donner objet" : "Gérer objet", "◇");
  const alreadyLead = entry.teamIndex === 0 && entry.pokemon.id === options.activePokemonId;
  const makeLead: SourcePokemonAction = { id: "make-lead", label: "Placer en tête", symbol: "1", enabled: !alreadyLead,
    hint: alreadyLead ? "Déjà en tête" : "Premier de l'équipe" };
  if (context === "battle") return [details, future("switch", "Envoyer", "⇄"), item];
  if (context === "team") {
    return [details, makeLead, item];
  }
  if (entry.location === "team") {
    return [details, makeLead, item,
    { id: "deposit", label: "Déposer", symbol: "↓", enabled: options.partySize > 1,
      hint: options.partySize > 1 ? "Vers le Ranch" : "Dernier Pokémon" }];
  }
  return [details, { id: "withdraw", label: "Retirer", symbol: "↑", enabled: !options.partyFull,
    hint: options.partyFull ? "Équipe complète" : "Vers l'équipe" }, item,
  future("mark", "Marquer", "●"), future("release", "Relâcher", "×")];
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function sourcePokemonActionWheelHtml(entry: SourcePokemonCollectionEntry,
  actions: readonly SourcePokemonAction[]): string {
  const actionButtons = actions.map((action, index) => {
    const angle = -90 + (360 / actions.length) * index;
    return `<button type="button" class="source-pokemon-wheel-action" style="--action-angle:${angle}deg;--action-counter-angle:${-angle}deg" data-pokemon-action="${action.id}"${action.enabled ? "" : " disabled"} title="${escapeHtml(action.hint)}"><b>${escapeHtml(action.symbol)}</b><span>${escapeHtml(action.label)}</span><small>${escapeHtml(action.hint)}</small></button>`;
  }).join("");
  return `<div class="source-pokemon-wheel-backdrop" data-pokemon-wheel-dismiss>
    <section class="source-pokemon-wheel" role="dialog" aria-modal="true" aria-label="Actions pour ${escapeHtml(entry.displayName)}">
      ${actionButtons}<button type="button" class="source-pokemon-wheel-center" data-pokemon-wheel-close aria-label="Fermer les actions"><span class="source-pokemon-icon" style="background-image:url('${entry.iconUrl}')" aria-hidden="true"></span><strong>${escapeHtml(entry.displayName)}</strong><small>Fermer</small></button>
    </section>
  </div>`;
}
