import type { PlayerCreationCatalog, PlayerPartyState, PlayerPokemonStorageState }
  from "@pokemon-z-battle/player-state";
import type { PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import { createSourcePokemonCollection, filterSourcePokemonCollection, sourcePokemonTypeLabel,
  sourcePokemonTypes, SOURCE_POKEMON_POWER_TIERS, type SourcePokemonFilters, type SourcePokemonPowerTier,
  type SourcePokemonQualityTier, type SourcePokemonSort } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml } from "./source-pokemon-card-view.js";
import { sourcePokemonActions, sourcePokemonActionWheelHtml } from "./source-pokemon-actions.js";
import type { PlayerInventory } from "@pokemon-z-battle/player-state";
import type { SourceShopItem } from "./source-economy.js";
import { bindSourceHeldItemIconFallback, canManageSourceHeldItem, sourceHeldItemManagerHtml }
  from "./source-held-item-view.js";

export interface SourceRanchViewModel {
  readonly open: boolean;
  readonly party: PlayerPartyState;
  readonly ranch: PlayerPokemonStorageState;
  readonly catalog: PlayerCreationCatalog;
  readonly assets: PokemonAssetsManifest;
  readonly inventory: PlayerInventory;
  readonly items: ReadonlyMap<string, SourceShopItem>;
}

export type SourceRanchTransferDestination = "team" | "ranch";

export class SourceRanchView {
  private filters: SourcePokemonFilters = { query: "", firstType: null, secondType: null,
    potentialTier: "all", minimumIvStars: "all", minimumEvStars: "all",
    sort: "number" };
  private selectedPokemonId: string | null = null;
  private heldItemPokemonId: string | null = null;

  public constructor(private readonly onClose: () => void,
    private readonly onTransfer: (pokemonId: string, destination: SourceRanchTransferDestination) => void,
    private readonly onLead: (pokemonId: string) => void,
    private readonly onDetails: (pokemonId: string) => void,
    private readonly onHeldItem: (pokemonId: string, itemId: string | null) => void) {}

  public render(model: SourceRanchViewModel): void {
    const root = document.querySelector<HTMLElement>("#source-ranch");
    if (root === null) return;
    root.hidden = !model.open;
    if (!model.open) return;
    const collection = createSourcePokemonCollection(model.party, model.ranch, model.catalog, model.assets);
    const filtered = filterSourcePokemonCollection(collection, this.filters);
    const types = sourcePokemonTypes(model.catalog);
    if (this.selectedPokemonId !== null && !collection.some((entry) => entry.pokemon.id === this.selectedPokemonId)) {
      this.selectedPokemonId = null;
    }
    const selected = collection.find((entry) => entry.pokemon.id === this.selectedPokemonId) ?? null;
    const heldItemTarget = collection.find((entry) => entry.pokemon.id === this.heldItemPokemonId) ?? null;
    const activePokemonId = model.party.activeIndex === null ? null : model.party.members[model.party.activeIndex]?.id ?? null;
    const wheel = selected === null ? "" : sourcePokemonActionWheelHtml(selected,
      sourcePokemonActions("ranch", selected, { partySize: model.party.members.length,
        partyFull: model.party.members.length >= 6, activePokemonId,
        heldItemManagementAvailable: canManageSourceHeldItem(model.inventory, selected.pokemon.heldItem) }));
    const heldItemPanel = heldItemTarget === null ? "" : sourceHeldItemManagerHtml(heldItemTarget.displayName,
      heldItemTarget.pokemon.heldItem, model.inventory, model.items);
    root.innerHTML = `<header class="source-ranch-header"><div><small>PC DE LÉO</small><strong>Ranch Pokémon</strong><span>${collection.length} Pokémon capturé${collection.length > 1 ? "s" : ""}</span></div><button id="close-source-ranch" type="button" aria-label="Fermer le Ranch">×</button></header>
      <form class="source-ranch-filters" id="source-ranch-filters">
        <label class="source-ranch-search"><span>Nom ou numéro</span><input name="query" type="search" value="${escapeAttribute(this.filters.query)}" placeholder="Ex. Pikachu ou 25"></label>
        <label><span>Type 1</span><select name="firstType">${typeOptions(types, this.filters.firstType, "Tous")}</select></label>
        <label><span>Type 2</span><select name="secondType">${typeOptions(types, this.filters.secondType, "Indifférent")}</select></label>
        <label><span>Potentiel de l'espèce</span><select name="potentialTier">${powerOptions(this.filters.potentialTier)}</select></label>
        <label><span>Qualité IV moyenne</span><select name="minimumIvStars">${qualityOptions(this.filters.minimumIvStars)}</select></label>
        <label><span>Entraînement EV moyen</span><select name="minimumEvStars">${qualityOptions(this.filters.minimumEvStars)}</select></label>
        <label><span>Trier par</span><select name="sort">${sortOptions(this.filters.sort)}</select></label>
        <button type="button" id="reset-source-ranch-filters">Réinitialiser</button>
      </form>
      <div class="source-ranch-result"><strong>${filtered.length}</strong> résultat${filtered.length > 1 ? "s" : ""}<small>Les filtres sont cumulés.</small></div>
      <div class="source-pokemon-grid">${filtered.length === 0
        ? '<div class="source-ranch-empty"><strong>Aucun Pokémon correspondant</strong><small>Élargissez un ou plusieurs filtres.</small></div>'
        : filtered.map((entry) => sourcePokemonCardHtml(entry, { selected: entry.pokemon.id === this.selectedPokemonId,
          highlightPotential: this.filters.potentialTier !== "all",
          highlightTraining: this.filters.minimumIvStars !== "all" || this.filters.minimumEvStars !== "all" })).join("")}</div>
      <footer class="source-ranch-footer">${actionFooter(selected)}</footer>${wheel}${heldItemPanel}`;
    bindSourceHeldItemIconFallback(root);
    root.querySelector<HTMLButtonElement>("#close-source-ranch")?.addEventListener("click", this.onClose);
    root.querySelector<HTMLButtonElement>("#reset-source-ranch-filters")?.addEventListener("click", () => {
      this.filters = { query: "", firstType: null, secondType: null, potentialTier: "all",
        minimumIvStars: "all", minimumEvStars: "all", sort: "number" };
      this.render(model);
    });
    const filterForm = root.querySelector<HTMLFormElement>("#source-ranch-filters");
    const updateFilters = (restoreSearchFocus: boolean): void => {
      if (filterForm === null) return;
      const search = filterForm.elements.namedItem("query") as HTMLInputElement | null;
      const selection = search?.selectionStart ?? null;
      const form = filterForm;
      const data = new FormData(form);
      this.filters = { query: String(data.get("query") ?? ""), firstType: nullableText(data.get("firstType")),
        secondType: nullableText(data.get("secondType")), potentialTier: sourcePowerTier(data.get("potentialTier")),
        minimumIvStars: sourceQualityTier(data.get("minimumIvStars")),
        minimumEvStars: sourceQualityTier(data.get("minimumEvStars")), sort: sourceSort(data.get("sort")) };
      this.render(model);
      if (restoreSearchFocus) {
        const nextSearch = root.querySelector<HTMLInputElement>('input[name="query"]');
        nextSearch?.focus();
        if (selection !== null) nextSearch?.setSelectionRange(selection, selection);
      }
    };
    filterForm?.addEventListener("submit", (event) => event.preventDefault());
    filterForm?.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "query") updateFilters(true);
    });
    filterForm?.addEventListener("change", () => updateFilters(false));
    root.querySelectorAll<HTMLButtonElement>("[data-pokemon-id]").forEach((button) => button.addEventListener("click", () => {
      this.selectedPokemonId = button.dataset.pokemonId ?? null;
      this.render(model);
    }));
    root.querySelector<HTMLButtonElement>("[data-source-wheel-close]")?.addEventListener("click", () => {
      this.selectedPokemonId = null;
      this.render(model);
    });
    root.querySelector<HTMLElement>("[data-source-wheel-dismiss]")?.addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      this.selectedPokemonId = null;
      this.render(model);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-source-wheel-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (selected === null) return;
        if (button.dataset.sourceWheelAction === "deposit") this.onTransfer(selected.pokemon.id, "ranch");
        else if (button.dataset.sourceWheelAction === "withdraw") this.onTransfer(selected.pokemon.id, "team");
        else if (button.dataset.sourceWheelAction === "make-lead") this.onLead(selected.pokemon.id);
        else if (button.dataset.sourceWheelAction === "details") this.onDetails(selected.pokemon.id);
        else if (button.dataset.sourceWheelAction === "give-item") {
          this.heldItemPokemonId = selected.pokemon.id;
          this.render(model);
        }
      });
    });
    root.querySelector<HTMLButtonElement>("[data-held-item-close]")?.addEventListener("click", () => {
      this.heldItemPokemonId = null;
      this.render(model);
    });
    root.querySelector<HTMLButtonElement>("[data-held-item-remove]")?.addEventListener("click", () => {
      if (heldItemTarget === null) return;
      this.heldItemPokemonId = null;
      this.onHeldItem(heldItemTarget.pokemon.id, null);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-held-item-equip]").forEach((button) =>
      button.addEventListener("click", () => {
        if (heldItemTarget === null || button.dataset.heldItemEquip === undefined) return;
        this.heldItemPokemonId = null;
        this.onHeldItem(heldItemTarget.pokemon.id, button.dataset.heldItemEquip);
      }));
  }
}

function actionFooter(selected: ReturnType<typeof createSourcePokemonCollection>[number] | null): string {
  if (selected === null) return "<span>Sélectionnez une carte pour ouvrir ses actions.</span>";
  return `<span><strong>${escapeAttribute(selected.displayName)}</strong> · choisissez une action autour du Pokémon.</span>`;
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
    ["potential-power", "Potentiel"], ["level", "Niveau"]];
  return options.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
}

function nullableText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function powerOptions(selected: SourcePokemonPowerTier): string {
  return `<option value="all"${selected === "all" ? " selected" : ""}>Tous les potentiels</option>${SOURCE_POKEMON_POWER_TIERS.map((tier) =>
    `<option value="${tier.id}"${selected === tier.id ? " selected" : ""}>${tier.label} · ${tier.minimum}${tier.maximum === null ? "+" : `–${tier.maximum}`}</option>`).join("")}`;
}

function qualityOptions(selected: SourcePokemonQualityTier): string {
  const options: readonly [SourcePokemonQualityTier, string][] = [["all", "Tous"], ["one", "★ et plus"],
    ["two", "★★ et plus"], ["three", "★★★ et plus"], ["four", "★★★★ uniquement"]];
  return options.map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
}

function sourcePowerTier(value: FormDataEntryValue | null): SourcePokemonPowerTier {
  return typeof value === "string" && ["very-low", "low", "moderate", "good", "very-powerful", "super-powerful"].includes(value)
    ? value as SourcePokemonPowerTier : "all";
}

function sourceQualityTier(value: FormDataEntryValue | null): SourcePokemonQualityTier {
  return typeof value === "string" && ["one", "two", "three", "four"].includes(value)
    ? value as SourcePokemonQualityTier : "all";
}

function sourceSort(value: FormDataEntryValue | null): SourcePokemonSort {
  return value === "name" || value === "potential-power" || value === "level"
    ? value : "number";
}
