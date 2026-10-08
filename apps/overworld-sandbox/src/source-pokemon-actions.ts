import type { SourcePokemonCollectionEntry } from "./source-pokemon-collection.js";
import { sourcePokemonIconHtml } from "./source-pokemon-card-view.js";
import { sourceActionWheelHtml, type SourceActionWheelAction } from "./source-action-wheel.js";

export type SourcePokemonActionContext = "team" | "ranch" | "battle";
export type SourcePokemonActionId = "details" | "make-lead" | "give-item" | "deposit" | "withdraw"
  | "mark" | "release" | "switch";

export type SourcePokemonAction = SourceActionWheelAction<SourcePokemonActionId>;

export interface SourcePokemonActionOptions {
  readonly partySize: number;
  readonly partyFull: boolean;
  readonly activePokemonId: string | null;
  readonly heldItemManagementAvailable?: boolean;
}

const future = (id: SourcePokemonActionId, label: string, symbol: string): SourcePokemonAction =>
  ({ id, label, symbol, enabled: false, hint: "À raccorder" });

/** Contextual action contract shared by team, Ranch and future battle selections. */
export function sourcePokemonActions(context: SourcePokemonActionContext, entry: SourcePokemonCollectionEntry,
  options: SourcePokemonActionOptions): readonly SourcePokemonAction[] {
  const details: SourcePokemonAction = { id: "details", label: "Détails", symbol: "i", enabled: true,
    hint: "Ouvrir le résumé" };
  const canOpenHeldItemManager = context !== "battle";
  const item: SourcePokemonAction = { id: "give-item",
    label: entry.pokemon.heldItem === null ? "Donner objet" : "Gérer objet", symbol: "◇",
    enabled: canOpenHeldItemManager,
    hint: !canOpenHeldItemManager ? "Indisponible pendant le combat"
      : options.heldItemManagementAvailable === true ? "Choisir un objet tenu"
        : "Ouvrir le Sac · aucun objet compatible actuellement" };
  const alreadyLead = entry.teamIndex === 0 && entry.pokemon.id === options.activePokemonId;
  const makeLead: SourcePokemonAction = { id: "make-lead", label: "Placer en tête", symbol: "1", enabled: !alreadyLead,
    hint: alreadyLead ? "Déjà en tête" : "Premier de l'équipe" };
  if (context === "battle") return [details, future("switch", "Envoyer", "⇄"), item];
  if (context === "team") {
    return [details, makeLead, item];
  }
  if (entry.location === "team") {
    return [details, item,
    { id: "deposit", label: "Déposer", symbol: "↓", enabled: options.partySize > 1,
      hint: options.partySize > 1 ? "Vers le Ranch" : "Dernier Pokémon" }];
  }
  return [details, { id: "withdraw", label: "Retirer", symbol: "↑", enabled: !options.partyFull,
    hint: options.partyFull ? "Équipe complète" : "Vers l'équipe" }, item,
  future("mark", "Marquer", "●"), future("release", "Relâcher", "×")];
}

export function sourcePokemonActionWheelHtml(entry: SourcePokemonCollectionEntry,
  actions: readonly SourcePokemonAction[]): string {
  return sourceActionWheelHtml({ label: `Actions pour ${entry.displayName}`, actions,
    centerHtml: `${sourcePokemonIconHtml(entry)}<strong>${entry.displayName.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</strong>` });
}
