import type { PlayerCreationCatalog, PlayerPartyState, PlayerPokemonStorageState }
  from "@pokemon-z-battle/player-state";
import { createSourcePokemonCollection, filterSourcePokemonCollection, sourcePokemonTypeLabel,
  sourcePokemonTypes, type SourcePokemonFilters, type SourcePokemonSort } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml } from "./source-pokemon-card-view.js";

export interface SourceRanchViewModel {
  readonly open: boolean;
  readonly party: PlayerPartyState;
  readonly ranch: PlayerPokemonStorageState;
  readonly catalog: PlayerCreationCatalog;
}

export type SourceRanchTransferDestination = "team" | "ranch";

export class SourceRanchView {
  private filters: SourcePokemonFilters = { query: "", firstType: null, secondType: null,
    minimumNumber: null, maximumNumber: null, minimumCurrentPower: null, minimumPotentialPower: null,
    sort: "number" };
  private selectedPokemonId: string | null = null;

  public constructor(private readonly onClose: () => void,
    private readonly onTransfer: (pokemonId: string, destination: SourceRanchTransferDestination) => void) {}

  public render(model: SourceRanchViewModel): void {
    const root = document.querySelector<HTMLElement>("#source-ranch");
    if (root === null) return;
    root.hidden = !model.open;
    if (!model.open) return;
    const collection = createSourcePokemonCollection(model.party, model.ranch, model.catalog);
    const filtered = filterSourcePokemonCollection(collection, this.filters);
    const types = sourcePokemonTypes(model.catalog);
    if (this.selectedPokemonId !== null && !collection.some((entry) => entry.pokemon.id === this.selectedPokemonId)) {
      this.selectedPokemonId = null;
    }
    const selected = collection.find((entry) => entry.pokemon.id === this.selectedPokemonId) ?? null;
    root.innerHTML = `<header class="source-ranch-header"><div><small>PC DE LÉO</small><strong>Ranch Pokémon</strong><span>${collection.length} Pokémon capturé${collection.length > 1 ? "s" : ""}</span></div><button id="close-source-ranch" type="button" aria-label="Fermer le Ranch">×</button></header>
      <form class="source-ranch-filters" id="source-ranch-filters">
        <label class="source-ranch-search"><span>Nom ou numéro</span><input name="query" type="search" value="${escapeAttribute(this.filters.query)}" placeholder="Ex. Pikachu ou 25"></label>
        <label><span>Type 1</span><select name="firstType">${typeOptions(types, this.filters.firstType, "Tous")}</select></label>
        <label><span>Type 2</span><select name="secondType">${typeOptions(types, this.filters.secondType, "Indifférent")}</select></label>
        <label><span>N° minimum</span><input name="minimumNumber" type="number" min="1" max="9999" value="${numberValue(this.filters.minimumNumber)}"></label>
        <label><span>N° maximum</span><input name="maximumNumber" type="number" min="1" max="9999" value="${numberValue(this.filters.maximumNumber)}"></label>
        <label><span>Puissance actuelle min.</span><input name="minimumCurrentPower" type="number" min="0" value="${numberValue(this.filters.minimumCurrentPower)}"></label>
        <label><span>Potentiel min.</span><input name="minimumPotentialPower" type="number" min="0" value="${numberValue(this.filters.minimumPotentialPower)}"></label>
        <label><span>Trier par</span><select name="sort">${sortOptions(this.filters.sort)}</select></label>
        <button type="submit" class="source-ranch-apply">Appliquer</button><button type="button" id="reset-source-ranch-filters">Réinitialiser</button>
      </form>
      <div class="source-ranch-result"><strong>${filtered.length}</strong> résultat${filtered.length > 1 ? "s" : ""}<small>Les filtres sont cumulés.</small></div>
      <div class="source-pokemon-grid">${filtered.length === 0
        ? '<div class="source-ranch-empty"><strong>Aucun Pokémon correspondant</strong><small>Élargissez un ou plusieurs filtres.</small></div>'
        : filtered.map((entry) => sourcePokemonCardHtml(entry, { selected: entry.pokemon.id === this.selectedPokemonId })).join("")}</div>
      <footer class="source-ranch-footer">${transferFooter(selected, model.party)}</footer>`;
    root.querySelector<HTMLButtonElement>("#close-source-ranch")?.addEventListener("click", this.onClose);
    root.querySelector<HTMLButtonElement>("#reset-source-ranch-filters")?.addEventListener("click", () => {
      this.filters = { query: "", firstType: null, secondType: null, minimumNumber: null, maximumNumber: null,
        minimumCurrentPower: null, minimumPotentialPower: null, sort: "number" };
      this.render(model);
    });
    root.querySelector<HTMLFormElement>("#source-ranch-filters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      this.filters = { query: String(data.get("query") ?? ""), firstType: nullableText(data.get("firstType")),
        secondType: nullableText(data.get("secondType")), minimumNumber: nullableNumber(data.get("minimumNumber")),
        maximumNumber: nullableNumber(data.get("maximumNumber")), minimumCurrentPower: nullableNumber(data.get("minimumCurrentPower")),
        minimumPotentialPower: nullableNumber(data.get("minimumPotentialPower")), sort: sourceSort(data.get("sort")) };
      this.render(model);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-pokemon-id]").forEach((button) => button.addEventListener("click", () => {
      this.selectedPokemonId = button.dataset.pokemonId ?? null;
      this.render(model);
    }));
    root.querySelector<HTMLButtonElement>("[data-ranch-transfer]")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const pokemonId = button.dataset.pokemonId;
      const destination = button.dataset.ranchTransfer;
      if (pokemonId !== undefined && (destination === "team" || destination === "ranch")) {
        this.onTransfer(pokemonId, destination);
      }
    });
  }
}

function transferFooter(selected: ReturnType<typeof createSourcePokemonCollection>[number] | null,
  party: PlayerPartyState): string {
  if (selected === null) return "<span>Sélectionnez un Pokémon pour le déplacer ou préparer sa future fiche détaillée.</span>";
  const toRanch = selected.location === "team";
  const disabled = toRanch ? party.members.length <= 1 : party.members.length >= 6;
  const reason = disabled
    ? toRanch ? "L'équipe doit conserver au moins un Pokémon." : "L'équipe contient déjà six Pokémon."
    : toRanch ? "Le Pokémon conservera son état actuel au Ranch." : "Le Pokémon rejoindra la fin de l'équipe.";
  return `<span><strong>${escapeAttribute(selected.displayName)}</strong> · ${reason}</span><button type="button" data-ranch-transfer="${toRanch ? "ranch" : "team"}" data-pokemon-id="${escapeAttribute(selected.pokemon.id)}"${disabled ? " disabled" : ""}>${toRanch ? "Déposer au Ranch" : "Ajouter à l'équipe"}</button>`;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function typeOptions(types: readonly string[], selected: string | null, emptyLabel: string): string {
  return `<option value="">${emptyLabel}</option>${types.map((type) =>
    `<option value="${escapeAttribute(type)}"${type === selected ? " selected" : ""}>${escapeAttribute(sourcePokemonTypeLabel(type))}</option>`).join("")}`;
}

function sortOptions(selected: SourcePokemonSort): string {
  const options: readonly [SourcePokemonSort, string][] = [["number", "Numéro"], ["name", "Nom"],
    ["current-power", "Puissance actuelle"], ["potential-power", "Potentiel"], ["level", "Niveau"]];
  return options.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
}

function nullableText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function nullableNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function numberValue(value: number | null): string { return value === null ? "" : String(value); }

function sourceSort(value: FormDataEntryValue | null): SourcePokemonSort {
  return value === "name" || value === "current-power" || value === "potential-power" || value === "level"
    ? value : "number";
}
