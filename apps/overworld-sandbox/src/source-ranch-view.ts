import type { PlayerCreationCatalog, PlayerPartyState, PlayerPokemonStorageState }
  from "@pokemon-z-battle/player-state";
import type { PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import { createSourcePokemonCollection, filterSourcePokemonCollection, sourcePokemonTypeLabel,
  sourcePokemonTypes, SOURCE_POKEMON_POWER_TIERS, type SourcePokemonFilters, type SourcePokemonPowerTier,
  type SourcePokemonQualityTier, type SourcePokemonSort } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml } from "./source-pokemon-card-view.js";
import { sourceGridPageLayout, type SourceGridPageLayout } from "./source-grid-pagination.js";
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

export function sourceRanchPageSize(teamExpanded: boolean): number {
  return teamExpanded ? 9 : 16;
}

export function sourceRanchPageCount(resultCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, resultCount) / Math.max(1, pageSize)));
}

export class SourceRanchView {
  private filters: SourcePokemonFilters = { query: "", firstType: null, secondType: null,
    potentialTier: "all", minimumIvStars: "all", minimumEvStars: "all",
    sort: "number" };
  private selectedPokemonId: string | null = null;
  private heldItemPokemonId: string | null = null;
  private heldItemPocket: number | null = null;
  private heldItemFamilyId: string | null = null;
  private heldItemPage = 0;
  private releasePokemonId: string | null = null;
  private teamExpanded = true;
  private toolsPanel: "filters" | "sort" | null = null;
  private draftFilters: SourcePokemonFilters | null = null;
  private wasOpen = false;
  private ranchPage = 0;
  private ranchLayout: SourceGridPageLayout = { columns: 3, rows: 3, pageSize: 9 };
  private resizeObserver: ResizeObserver | null = null;
  private currentModel: SourceRanchViewModel | null = null;

  public cancel(): boolean {
    if (this.toolsPanel === null) return false;
    this.toolsPanel = null;
    this.draftFilters = null;
    if (this.currentModel !== null) this.render(this.currentModel);
    return true;
  }

  private applyTools(): void {
    if (this.toolsPanel === null || this.draftFilters === null) return;
    const changed = Object.keys(this.filters).some((key) =>
      this.filters[key as keyof SourcePokemonFilters] !== this.draftFilters?.[key as keyof SourcePokemonFilters]);
    this.filters = this.draftFilters;
    this.draftFilters = null;
    this.toolsPanel = null;
    if (changed) {
      this.ranchPage = 0;
      this.selectedPokemonId = null;
    }
    if (this.currentModel !== null) this.render(this.currentModel);
  }

  public constructor(private readonly onClose: () => void,
    private readonly onTransfer: (pokemonId: string, destination: SourceRanchTransferDestination) => void,
    private readonly onLead: (pokemonId: string) => void,
    private readonly onDetails: (pokemonId: string) => void,
    private readonly onHeldItem: (pokemonId: string, itemId: string | null) => void,
    private readonly onRelease: (pokemonId: string) => void) {}

  public render(model: SourceRanchViewModel): void {
    const root = document.querySelector<HTMLElement>("#source-ranch");
    if (root === null) return;
    const teamScrollTop = this.wasOpen ? root.querySelector<HTMLElement>(".source-ranch-team-list")?.scrollTop ?? 0 : 0;
    root.hidden = !model.open;
    if (!model.open) { this.wasOpen = false; this.currentModel = null;
      this.resizeObserver?.disconnect(); this.resizeObserver = null; return; }
    this.currentModel = model;
    if (typeof ResizeObserver !== "undefined" && this.resizeObserver === null) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.currentModel !== null && root.isConnected && !root.hidden) this.render(this.currentModel);
      });
      this.resizeObserver.observe(root);
    }
    if (!this.wasOpen) {
      this.toolsPanel = null;
      this.draftFilters = null;
      this.teamExpanded = true;
      this.ranchPage = 0;
      this.releasePokemonId = null;
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.filters = { query: "", firstType: null, secondType: null, potentialTier: "all",
        minimumIvStars: "all", minimumEvStars: "all", sort: "number" };
    }
    this.wasOpen = true;
    const collection = createSourcePokemonCollection(model.party, model.ranch, model.catalog, model.assets);
    const teamEntries = collection.filter((entry) => entry.location === "team");
    const ranchEntries = collection.filter((entry) => entry.location === "ranch");
    const filtered = filterSourcePokemonCollection(ranchEntries, this.filters);
    const toolFilters = this.draftFilters ?? this.filters;
    const previewCount = this.toolsPanel === "filters"
      ? filterSourcePokemonCollection(ranchEntries, toolFilters).length : filtered.length;
    const pageSize = Math.min(sourceRanchPageSize(this.teamExpanded), this.ranchLayout.pageSize);
    const pageCount = sourceRanchPageCount(filtered.length, pageSize);
    this.ranchPage = Math.min(this.ranchPage, pageCount - 1);
    const visibleRanchEntries = filtered.slice(this.ranchPage * pageSize, (this.ranchPage + 1) * pageSize);
    const types = sourcePokemonTypes(model.catalog);
    if (this.selectedPokemonId !== null && !collection.some((entry) => entry.pokemon.id === this.selectedPokemonId)) {
      this.selectedPokemonId = null;
    }
    const selected = collection.find((entry) => entry.pokemon.id === this.selectedPokemonId) ?? null;
    const heldItemTarget = collection.find((entry) => entry.pokemon.id === this.heldItemPokemonId) ?? null;
    const releaseTarget = collection.find((entry) => entry.location === "ranch"
      && entry.pokemon.id === this.releasePokemonId) ?? null;
    if (this.releasePokemonId !== null && releaseTarget === null) this.releasePokemonId = null;
    const activePokemonId = model.party.activeIndex === null ? null : model.party.members[model.party.activeIndex]?.id ?? null;
    const wheel = selected === null ? "" : sourcePokemonActionWheelHtml(selected,
      sourcePokemonActions("ranch", selected, { partySize: model.party.members.length,
        partyFull: model.party.members.length >= 6, activePokemonId,
        heldItemManagementAvailable: canManageSourceHeldItem(model.inventory, selected.pokemon.heldItem, model.items) }));
    const heldItemPanel = heldItemTarget === null ? "" : sourceHeldItemManagerHtml(heldItemTarget.displayName,
      heldItemTarget.pokemon.heldItem, model.inventory, model.items,
      { pocket: this.heldItemPocket, familyId: this.heldItemFamilyId, page: this.heldItemPage });
    const releasePanel = releaseTarget === null ? "" : `<div class="source-ranch-release-backdrop">
      <section class="source-ranch-release" role="alertdialog" aria-modal="true" aria-label="Relâcher ${escapeAttribute(releaseTarget.displayName)}">
        <small>CONFIRMATION</small><strong>Relâcher ${escapeAttribute(releaseTarget.displayName)} ?</strong>
        <p>Cette action est définitive.${releaseTarget.pokemon.heldItem === null ? "" : ` L'objet ${escapeAttribute(model.items.get(releaseTarget.pokemon.heldItem)?.name ?? releaseTarget.pokemon.heldItem)} retournera dans le Sac.`}</p>
        <footer><button type="button" data-source-release-cancel>Annuler</button><button type="button" class="danger" data-source-release-confirm>Relâcher</button></footer>
      </section></div>`;
    const card = (entry: (typeof collection)[number], options: Parameters<typeof sourcePokemonCardHtml>[1] = {}): string =>
      sourcePokemonCardHtml(entry, { ...options, heldItemName: entry.pokemon.heldItem === null ? null
        : model.items.get(entry.pokemon.heldItem)?.name ?? entry.pokemon.heldItem });
    const teamCards = Array.from({ length: 6 }, (_, index) => {
      const member = teamEntries[index] ?? null;
      return member === null
      ? `<article class="source-ranch-team-empty"><span>${index + 1}</span><strong>Place libre</strong></article>`
      : card(member, { compact: true, teamLayout: true, showGender: true,
        selected: member.pokemon.id === this.selectedPokemonId,
        active: member.teamIndex === model.party.activeIndex });
    }).join("");
    const toolsPanel = this.toolsPanel === "filters" ? `<form class="source-ranch-filters" id="source-ranch-filters">
          <label class="source-ranch-search"><span>Nom ou numéro</span><input name="query" type="search" value="${escapeAttribute(toolFilters.query)}" placeholder="Ex. Pikachu ou 25"></label>
          <label><span>Type 1</span><select name="firstType">${typeOptions(types, toolFilters.firstType, "Tous")}</select></label>
          <label><span>Type 2</span><select name="secondType">${typeOptions(types, toolFilters.secondType, "Indifférent")}</select></label>
          <label><span>Potentiel</span><select name="potentialTier">${powerOptions(toolFilters.potentialTier)}</select></label>
          <label><span>Qualité IV</span><select name="minimumIvStars">${qualityOptions(toolFilters.minimumIvStars)}</select></label>
          <label><span>Entraînement EV</span><select name="minimumEvStars">${qualityOptions(toolFilters.minimumEvStars)}</select></label>
          <button type="button" id="reset-source-ranch-filters">Réinitialiser les filtres</button>
        </form>` : this.toolsPanel === "sort" ? `<section class="source-ranch-sort" aria-label="Trier les Pokémon"><div>${sortButtons(toolFilters.sort)}</div></section>` : "";
    const toolsDialog = this.toolsPanel === null ? "" : `<div class="source-ranch-tools-backdrop" data-source-ranch-tools-dismiss>
      <section class="source-ranch-tools-dialog" role="dialog" aria-modal="true" aria-label="${this.toolsPanel === "filters" ? "Filtrer les Pokémon du Ranch" : "Trier les Pokémon du Ranch"}">
        <header><div><small>RANCH POKÉMON</small><strong>${this.toolsPanel === "filters" ? "Filtrer" : "Trier"}</strong></div><button type="button" data-source-ranch-tools-close aria-label="Retour au Ranch">← Retour</button></header>
        ${toolsPanel}
        <footer><span>${previewCount} Pokémon${this.toolsPanel === "filters" ? " correspondent" : " au Ranch"}</span><button type="button" data-source-ranch-tools-apply>Appliquer</button></footer>
      </section></div>`;
    root.innerHTML = `<header class="source-ranch-header"><div><strong>Ranch Pokémon</strong><span>${teamEntries.length} dans l'équipe · ${ranchEntries.length} au Ranch</span></div><button id="close-source-ranch" type="button" aria-label="Fermer le Ranch">×</button></header>
      <div class="source-ranch-workspace" data-team-expanded="${this.teamExpanded}">
        <div class="source-ranch-toolbar">
          <section class="source-ranch-team-heading"><div><small>ÉQUIPE</small><strong>Vos compagnons</strong></div><button type="button" data-source-ranch-team-toggle aria-expanded="${this.teamExpanded}" aria-label="${this.teamExpanded ? "Replier" : "Dérouler"} l'équipe"><i aria-hidden="true"></i><span>${teamEntries.length}/6</span></button></section>
          <section class="source-ranch-storage-heading"><div><small>STOCKAGE</small><strong>Pokémon du Ranch</strong></div><nav><button type="button" data-source-ranch-tools="filters" class="${this.toolsPanel === "filters" ? "active" : ""}" aria-expanded="${this.toolsPanel === "filters"}">Filtre</button><button type="button" data-source-ranch-tools="sort" class="${this.toolsPanel === "sort" ? "active" : ""}" aria-expanded="${this.toolsPanel === "sort"}">Tri</button></nav><span>${ranchEntries.length}</span></section>
        </div>
        <div class="source-ranch-content">
          <aside class="source-ranch-team" aria-label="Équipe Pokémon"${this.teamExpanded ? "" : " hidden"}><div class="source-ranch-team-list">${teamCards}</div></aside>
           <section class="source-ranch-storage" aria-label="Pokémon du Ranch"><div class="source-pokemon-grid" style="--source-ranch-columns:${this.ranchLayout.columns};--source-ranch-rows:${this.ranchLayout.rows}">${filtered.length === 0
              ? `<div class="source-ranch-empty"><strong>${ranchEntries.length === 0 ? "Ranch vide" : "Aucun Pokémon correspondant"}</strong><small>${ranchEntries.length === 0 ? "Déposez un Pokémon depuis l'équipe." : "Élargissez un ou plusieurs filtres."}</small></div>`
              : visibleRanchEntries.map((entry) => card(entry, { compact: true,
                selected: entry.pokemon.id === this.selectedPokemonId,
                highlightPotential: this.filters.potentialTier !== "all",
                highlightTraining: this.filters.minimumIvStars !== "all" || this.filters.minimumEvStars !== "all" })).join("")}</div>
            <nav class="source-ranch-pages" aria-label="Pages du Ranch"${pageCount <= 1 ? " hidden" : ""}><button type="button" data-source-ranch-page="previous"${this.ranchPage === 0 ? " disabled" : ""}>‹ Précédente</button><span>Page ${this.ranchPage + 1}/${pageCount}</span><button type="button" data-source-ranch-page="next"${this.ranchPage >= pageCount - 1 ? " disabled" : ""}>Suivante ›</button></nav></section>
        </div>
       </div>${toolsDialog}${wheel}${heldItemPanel}${releasePanel}`;
    root.querySelector<HTMLElement>(".source-ranch-team-list")!.scrollTop = teamScrollTop;
    const grid = root.querySelector<HTMLElement>(".source-ranch-storage .source-pokemon-grid");
    if (grid !== null && grid.clientWidth > 0 && grid.clientHeight > 0) {
      const minHeight = this.filters.potentialTier !== "all" || this.filters.minimumIvStars !== "all"
        || this.filters.minimumEvStars !== "all" ? 76 : 62;
      const layout = sourceGridPageLayout(grid.clientWidth, grid.clientHeight, 140, minHeight,
        this.teamExpanded ? 3 : 4, this.teamExpanded ? 3 : 4, 6);
      if (layout.pageSize !== this.ranchLayout.pageSize || layout.columns !== this.ranchLayout.columns) {
        this.ranchPage = Math.floor(this.ranchPage * pageSize / layout.pageSize);
        this.ranchLayout = layout;
        this.render(model);
        return;
      }
    }
    bindSourceHeldItemIconFallback(root);
    root.querySelector<HTMLButtonElement>("#close-source-ranch")?.addEventListener("click", this.onClose);
    root.querySelectorAll<HTMLButtonElement>("[data-source-ranch-tools-close]").forEach((button) =>
      button.addEventListener("click", () => this.cancel()));
    root.querySelector<HTMLButtonElement>("[data-source-ranch-tools-apply]")?.addEventListener("click", () => this.applyTools());
    root.querySelector<HTMLElement>("[data-source-ranch-tools-dismiss]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) this.cancel();
    });
    root.querySelector<HTMLButtonElement>("[data-source-ranch-team-toggle]")?.addEventListener("click", () => {
      const firstVisibleIndex = this.ranchPage * pageSize;
      this.teamExpanded = !this.teamExpanded;
      this.ranchPage = Math.floor(firstVisibleIndex / Math.min(sourceRanchPageSize(this.teamExpanded),
        this.ranchLayout.pageSize));
      this.render(model);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-source-ranch-tools]").forEach((button) =>
      button.addEventListener("click", () => {
        const panel = button.dataset.sourceRanchTools === "sort" ? "sort" : "filters";
        if (this.toolsPanel === panel) { this.cancel(); return; }
        this.toolsPanel = panel;
        this.draftFilters = { ...this.filters };
        this.render(model);
      }));
    root.querySelectorAll<HTMLButtonElement>("[data-source-ranch-sort]").forEach((button) =>
      button.addEventListener("click", () => {
        this.draftFilters = { ...(this.draftFilters ?? this.filters), sort: sourceSort(button.dataset.sourceRanchSort ?? null) };
        this.render(model);
      }));
    root.querySelectorAll<HTMLButtonElement>("[data-source-ranch-page]").forEach((button) =>
      button.addEventListener("click", () => {
        this.ranchPage += button.dataset.sourceRanchPage === "previous" ? -1 : 1;
        this.ranchPage = Math.max(0, Math.min(pageCount - 1, this.ranchPage));
        this.selectedPokemonId = null;
        this.render(model);
      }));
    root.querySelector<HTMLButtonElement>("#reset-source-ranch-filters")?.addEventListener("click", () => {
      this.draftFilters = { query: "", firstType: null, secondType: null, potentialTier: "all",
        minimumIvStars: "all", minimumEvStars: "all", sort: toolFilters.sort };
      this.render(model);
    });
    const filterForm = root.querySelector<HTMLFormElement>("#source-ranch-filters");
    const updateFilters = (restoreSearchFocus: boolean): void => {
      if (filterForm === null) return;
      const search = filterForm.elements.namedItem("query") as HTMLInputElement | null;
      const selection = search?.selectionStart ?? null;
      const form = filterForm;
      const data = new FormData(form);
      this.draftFilters = { query: String(data.get("query") ?? ""), firstType: nullableText(data.get("firstType")),
        secondType: nullableText(data.get("secondType")), potentialTier: sourcePowerTier(data.get("potentialTier")),
        minimumIvStars: sourceQualityTier(data.get("minimumIvStars")),
        minimumEvStars: sourceQualityTier(data.get("minimumEvStars")), sort: toolFilters.sort };
      this.render(model);
      if (restoreSearchFocus) {
        const nextSearch = root.querySelector<HTMLInputElement>('input[name="query"]');
        nextSearch?.focus();
        if (selection !== null) nextSearch?.setSelectionRange(selection, selection);
      }
    };
    filterForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      updateFilters(false);
      this.applyTools();
    });
    filterForm?.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "query") updateFilters(true);
    });
    filterForm?.addEventListener("change", () => updateFilters(false));
    root.querySelectorAll<HTMLButtonElement>("[data-pokemon-id]").forEach((button) => button.addEventListener("click", () => {
      this.selectedPokemonId = button.dataset.pokemonId ?? null;
      this.render(model);
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-source-wheel-close]").forEach((button) => button.addEventListener("click", () => {
      if (heldItemTarget !== null) {
        this.heldItemPokemonId = null;
        this.heldItemPocket = null;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
        this.render(model);
        return;
      }
      this.selectedPokemonId = null;
      this.render(model);
    }));
    root.querySelectorAll<HTMLElement>("[data-source-wheel-dismiss]").forEach((backdrop) => backdrop.addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      if (heldItemTarget !== null) {
        this.heldItemPokemonId = null;
        this.heldItemPocket = null;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
      }
      this.selectedPokemonId = null;
      this.render(model);
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-source-wheel-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (selected === null) return;
        if (button.dataset.sourceWheelAction === "deposit" || button.dataset.sourceWheelAction === "withdraw") {
          const destination = button.dataset.sourceWheelAction === "deposit" ? "ranch" : "team";
          this.selectedPokemonId = null;
          this.heldItemPokemonId = null;
          this.onTransfer(selected.pokemon.id, destination);
        }
        else if (button.dataset.sourceWheelAction === "make-lead") this.onLead(selected.pokemon.id);
        else if (button.dataset.sourceWheelAction === "details") this.onDetails(selected.pokemon.id);
        else if (button.dataset.sourceWheelAction === "give-item") {
          this.heldItemPokemonId = selected.pokemon.id;
          this.heldItemPocket = null;
          this.heldItemFamilyId = null;
          this.heldItemPage = 0;
          this.render(model);
        }
        else if (button.dataset.sourceWheelAction === "release" && selected.location === "ranch") {
          this.selectedPokemonId = null;
          this.heldItemPokemonId = null;
          this.releasePokemonId = selected.pokemon.id;
          this.render(model);
        }
      });
    });
    root.querySelector<HTMLButtonElement>("[data-source-release-cancel]")?.addEventListener("click", () => {
      this.releasePokemonId = null;
      this.render(model);
    });
    root.querySelector<HTMLButtonElement>("[data-source-release-confirm]")?.addEventListener("click", () => {
      if (releaseTarget === null) return;
      this.releasePokemonId = null;
      this.onRelease(releaseTarget.pokemon.id);
    });
    root.querySelector<HTMLButtonElement>("[data-held-item-close]")?.addEventListener("click", () => {
      this.heldItemPokemonId = null;
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.render(model);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-source-wheel-action^="held-pocket:"]').forEach((button) =>
      button.addEventListener("click", () => {
        const pocket = Number(button.dataset.sourceWheelAction?.split(":")[1]);
        if (!Number.isInteger(pocket)) return;
        this.heldItemPocket = pocket;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
        this.render(model);
      }));
    root.querySelector<HTMLButtonElement>("[data-held-item-pocket-back]")?.addEventListener("click", () => {
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.render(model);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-held-item-family]").forEach((button) =>
      button.addEventListener("click", () => {
        this.heldItemFamilyId = button.dataset.heldItemFamily ?? null;
        this.heldItemPage = 0;
        this.render(model);
      }));
    root.querySelector<HTMLButtonElement>("[data-held-item-family-back]")?.addEventListener("click", () => {
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.render(model);
    });
    root.querySelectorAll<HTMLButtonElement>(".source-held-item-browser [data-source-inventory-page]").forEach((button) =>
      button.addEventListener("click", () => {
        const page = Number(button.dataset.sourceInventoryPage);
        if (!Number.isInteger(page)) return;
        this.heldItemPage = page;
        this.render(model);
      }));
    root.querySelector<HTMLButtonElement>("[data-held-item-remove]")?.addEventListener("click", () => {
      if (heldItemTarget === null) return;
      this.heldItemPokemonId = null;
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.onHeldItem(heldItemTarget.pokemon.id, null);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-held-item-equip]").forEach((button) =>
      button.addEventListener("click", () => {
        if (heldItemTarget === null || button.dataset.heldItemEquip === undefined) return;
        this.heldItemPokemonId = null;
        this.heldItemPocket = null;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
        this.onHeldItem(heldItemTarget.pokemon.id, button.dataset.heldItemEquip);
      }));
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function typeOptions(types: readonly string[], selected: string | null, emptyLabel: string): string {
  return `<option value="">${emptyLabel}</option>${types.map((type) =>
    `<option value="${escapeAttribute(type)}"${type === selected ? " selected" : ""}>${escapeAttribute(sourcePokemonTypeLabel(type))}</option>`).join("")}`;
}

const SOURCE_RANCH_SORTS: readonly [SourcePokemonSort, string][] = [["number", "Numéro"], ["name", "Nom"],
  ["level", "Niveau"], ["type", "Type principal"], ["potential-power", "Potentiel"],
  ["iv-quality", "Qualité IV"], ["ev-training", "Entraînement EV"]];

function sortButtons(selected: SourcePokemonSort): string {
  return SOURCE_RANCH_SORTS.map(([value, label]) => `<button type="button" data-source-ranch-sort="${value}" class="${value === selected ? "active" : ""}">${label}</button>`).join("");
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
  return typeof value === "string" && SOURCE_RANCH_SORTS.some(([candidate]) => candidate === value)
    ? value as SourcePokemonSort : "number";
}
