import type { ImportedAvatar, ImportedMapAssets } from "./imported-map.js";
import { SOURCE_BAG_PAGE_SIZE, SOURCE_BAG_POCKETS, sourceBagEntries, sourceBagFamilyEntries, sourceBagNodes,
  sourceBagEntryMatches, sourceBagPage, sourceBagPocketCounts, sourceBagSubfamily, sourceItemIconUrl,
  sourceItemIconFallbackUrl, sourcePocketIconUrl } from "./source-bag.js";
import { sourceBagGridHtml, sourceBagPaginationHtml } from "./source-bag-grid.js";
import type { SourceEventState, SourceFishingRod } from "./source-event-state.js";
import type { SourceMenuTab } from "./source-scene-coordinator.js";
import type { SourceShopItem } from "./source-economy.js";
import type { SourceWorldSave } from "./source-world-save.js";
import type { PlayerConnectionState, SourceMovementMode } from "@pokemon-z-battle/multiplayer-protocol";
import { sourceMovementCapabilityLabel, type SourceMovementCapability,
  type SourceMovementUnlocks } from "./source-player-movement.js";
import type { SourceFieldShortcutId } from "./source-field-shortcuts.js";
import { createSourcePokemonCollection, sourcePokemonTypeLabel } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml, sourcePokemonIconHtml } from "./source-pokemon-card-view.js";
import { sourcePokemonActions, sourcePokemonActionWheelHtml } from "./source-pokemon-actions.js";
import { isPokemonPartyItemUsableInField, pokemonItemTargetMode } from "@pokemon-z-battle/player-state";
import { bindSourceHeldItemIconFallback, canManageSourceHeldItem, sourceHeldItemManagerHtml }
  from "./source-held-item-view.js";
import { sourceActionWheelHtml } from "./source-action-wheel.js";
import { sourceItemActions, sourceItemDisplayName } from "./source-item-actions.js";
import { persistSourceAudioChannel, sourceAudioSettings, type SourceAudioChannel,
  type SourceAudioSettings } from "./source-audio-settings.js";
import { SourcePokedexView } from "./source-pokedex-view.js";
import { sourceAlchemyCraftLimit } from "./source-alchemy.js";
import { sourceRegionForMap, sourceRegionImageUrl, sourceVisibleRegionPoints,
  type SourceRegionDestination, type SourceRegionPoint } from "./source-region-map.js";
import { bindSourceAspectFrame } from "./source-aspect-frame.js";
import { sourcePokeVialStatus } from "./source-poke-vial.js";
import { pokemonTypeIconUrl } from "@pokemon-z-battle/game-assets";
import { createSourceDevPokemonEntries, filterSourceDevPokemonEntries, SOURCE_DEV_POKEMON_PAGE_SIZE,
  sourceDevPokemonGenderOptions, sourceDevPokemonTypes, type SourceDevPokemonGender,
  type SourceDevPokemonSort } from "./source-dev-pokemon-picker.js";
import { isSourceFieldItem } from "./source-field-item.js";
import { SOURCE_CHARACTER_GUIDE, sourceCharacterGuideImageUrls, sourceCharacterGuideLevel,
  unlockedSourceCharacterGuideEntries } from "./source-character-guide.js";

export function escapeSourceHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function sourceQuantitySelectorHtml(label: string, value: number, maximum: number): string {
  const max = Math.max(1, Math.floor(maximum));
  const current = Math.max(1, Math.min(max, Math.floor(value)));
  const button = (delta: number, text: string): string => `<button type="button" data-source-quantity-delta="${delta}"${current + delta < 1 || current + delta > max ? " disabled" : ""} aria-label="${delta > 0 ? "Ajouter" : "Retirer"} ${Math.abs(delta)}">${text}</button>`;
  return `<div class="source-quantity-picker" role="group" aria-label="${escapeSourceHtml(label)}"><span>${escapeSourceHtml(label)}</span><div>${button(-10, "−10")}${button(-1, "−")}<output aria-live="polite" data-source-quantity-value>${current}</output>${button(1, "+")}${button(10, "+10")}</div><button type="button" data-source-quantity-max${current === max ? " disabled" : ""}>Max · ${max}</button></div>`;
}

function sourceAlchemyQuantitySelectorHtml(value: number, maximum: number): string {
  const max = Math.max(1, Math.floor(maximum));
  const current = Math.max(1, Math.min(max, Math.floor(value)));
  const button = (delta: number, text: string): string => `<button type="button" data-source-quantity-delta="${delta}"${current + delta < 1 || current + delta > max ? " disabled" : ""} aria-label="${delta > 0 ? "Ajouter" : "Retirer"} ${Math.abs(delta)}">${text}</button>`;
  return `<section class="source-alchemy-quantity" aria-label="Quantité à fabriquer"><header><span>FABRICATIONS</span><button type="button" data-source-quantity-max${current === max ? " disabled" : ""}>MAX · ${max}</button></header><div>${button(-10, "−10")}${button(-1, "−")}<output aria-live="polite" data-source-quantity-value>${current}</output>${button(1, "+")}${button(10, "+10")}</div></section>`;
}

const SOURCE_ALCHEMY_RECIPES_PER_PAGE = 5;

function bindSourceItemIconFallback(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("[data-source-item-icon]").forEach((image) => {
    image.addEventListener("error", () => { image.src = sourceItemIconFallbackUrl(image.src); }, { once: true });
  });
}

export interface SourceMenuViewModel {
  readonly open: boolean;
  readonly tab: SourceMenuTab;
  readonly assets: ImportedMapAssets;
  readonly eventState: SourceEventState;
  readonly avatar: ImportedAvatar;
  readonly worldSave: SourceWorldSave | null;
  readonly personalProgressSaveOnly: boolean;
  readonly coop: SourceMenuCoopModel;
  readonly movement: SourceMenuMovementModel;
  readonly dev: SourceMenuDevModel;
  readonly alchemyUnlockLevel: number;
  readonly fieldShortcuts: readonly SourceFieldShortcutId[];
  /** Morphologie strictement locale, utilisée uniquement pour les variantes visuelles du menu source. */
  readonly profileBodyModel: string;
}

export interface SourceMenuDevModel {
  readonly storyLevelCap: number;
  readonly effectiveLevelCap: number;
  readonly levelCapOverride: number | null;
}

export interface SourceMenuMovementModel {
  readonly mode: SourceMovementMode;
  readonly unlocks: SourceMovementUnlocks;
  readonly canDiveHere: boolean;
  readonly canSurfaceHere: boolean;
  readonly canFlyHere: boolean;
}

export interface SourceMenuCoopModel {
  readonly active: boolean;
  readonly state: string;
  readonly notice: string;
  readonly serverUrl: string;
  readonly roomCode: string;
  readonly profileName: string;
  readonly players: readonly { readonly side: "player" | "opponent"; readonly name: string;
    readonly connected: boolean; readonly connectionState: PlayerConnectionState;
    readonly bodyModel: string; readonly mapId: number | null }[];
}

export interface SourceMenuViewCallbacks {
  readonly onSave: () => void;
  readonly onDeleteSave: () => void;
  readonly onAudioSettingsChange: (settings: SourceAudioSettings) => void;
  readonly onCreateRoom: (serverUrl: string) => void;
  readonly onJoinRoom: (serverUrl: string, roomCode: string) => void;
  readonly onDisconnectRoom: () => void;
  readonly onEditProfile: () => void;
  readonly onMovementMode: (mode: "walk" | "mount") => void;
  readonly onMovementTestOverride: (enabled: boolean) => void;
  readonly onGrantTestItems: (pocket: number, itemId: string | null, quantity: number) => void;
  readonly onResetTestItemPocket: (pocket: number) => void;
  readonly onDevLevelCap: (levelCap: number | null) => void;
  readonly onGrantTestPokemon: (species: string, level: number, gender: SourceDevPokemonGender) => void;
  readonly onTeleportToTestDayCare: () => void;
  readonly onTeleportToTestDoubleJoin: () => void;
  readonly onTeleportToTestFurfrouNest: () => void;
  readonly onTeleportToTestInsectNest: () => void;
  readonly onOpenTestDayCare: () => void;
  readonly onOpenTestMining: () => void;
  readonly onAccelerateTestEggs: () => void;
  readonly onOpenIncubator: () => void;
  readonly onUseTruthLens: () => void;
  readonly onFieldShortcut: (id: SourceFieldShortcutId, selected: boolean) => void;
  readonly onFish: (rod: SourceFishingRod) => void;
  readonly onPreferredFishingRod: (rod: SourceFishingRod) => void;
  readonly onDive: () => void;
  readonly onFly: (destination: SourceRegionDestination) => void;
  readonly onPokemonLead: (pokemonId: string) => void;
  readonly onPokemonDetails: (pokemonId: string) => void;
  readonly onPokemonHeldItem: (pokemonId: string, itemId: string | null) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onUsePokeVial: () => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onDiscardItem: (itemId: string, quantity: number) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onTeachMachineMove: (itemId: string, pokemonId: string, replacementIndex?: number) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onUsePokemonItem: (itemId: string, pokemonId: string, moveIndex?: number) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onUseRareCandy: (pokemonId: string, quantity: number) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onUsePokemonPartyItem: (itemId: string) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onUseFieldItem: (itemId: string) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
  readonly onCraftAlchemy: (itemId: string, quantity: number) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
}

export class SourceMenuView {
  private readonly pokedexView = new SourcePokedexView();
  private selectedPocket = 1;
  private selectedTeamPokemonId: string | null = null;
  private selectedBagItemId: string | null = null;
  private selectedBagFamilyId: string | null = null;
  private bagPage = 0;
  private bagQuery = "";
  private selectedBagPokemonId: string | null = null;
  private bagAction: "wheel" | "use" | "use-party-confirm" | "rare-candy-confirm" | "give" | "discard" | "teach" | "teach-replace" | "teach-confirm" | null = null;
  private discardQuantity = 1;
  private rareCandyQuantity = 1;
  private selectedBagReplacementIndex: number | null = null;
  private bagResult: { readonly message: string; readonly itemId: string; readonly repeatAction: "use" | "give" | null } | null = null;
  private heldItemPokemonId: string | null = null;
  private heldItemPocket: number | null = null;
  private heldItemFamilyId: string | null = null;
  private heldItemPage = 0;
  private bagNotice: string | null = null;
  private selectedDevPocket = 2;
  private selectedDevItemId: string | null = null;
  private devItemQuery = "";
  private devItemQuantity = 99;
  private selectedDevPokemonId: string | null = null;
  private devPokemonQuery = "";
  private devPokemonType: string | null = null;
  private devPokemonSort: SourceDevPokemonSort = "number";
  private devPokemonPage = 0;
  private devPokemonLevel = 5;
  private devPokemonGender: SourceDevPokemonGender = "auto";
  private openDevSection: "movement" | "unlocks" | "bag" | "pokemon" | "services" | "narrative-battles" | "minigames" = "movement";
  private selectedAlchemyRecipeId: string | null = null;
  private alchemyQuantity = 1;
  private alchemyNotice: string | null = null;
  private alchemyPage = 0;
  private alchemyPageTurn: "forward" | "backward" | null = null;
  private selectedRegionPointKey: string | null = null;
  private regionMapMode: "consult" | "fly" = "consult";
  private stopRegionMapLayout: (() => void) | null = null;
  private pokeVialConfirming = false;
  private characterGuideOpen = false;
  private selectedCharacterGuideId = "olivier";

  public constructor(private readonly storage: Storage, private readonly callbacks: SourceMenuViewCallbacks) {}

  public render(model: SourceMenuViewModel): void {
    this.stopRegionMapLayout?.();
    this.stopRegionMapLayout = null;
    const menu = document.querySelector<HTMLElement>("#source-menu");
    const content = document.querySelector<HTMLElement>("#source-menu-content");
    if (menu === null || content === null) return;
    menu.hidden = !model.open;
    if (!model.open) { this.pokeVialConfirming = false; this.characterGuideOpen = false; return; }
    if (model.tab !== "bag") this.characterGuideOpen = false;
    content.classList.toggle("source-menu-content-bag", model.tab === "bag");
    content.classList.toggle("source-menu-content-pokedex", model.tab === "pokedex");
    content.classList.toggle("source-menu-content-alchemy", model.tab === "alchemy");
    content.classList.toggle("source-menu-content-map", model.tab === "map");
    const header = model.tab === "team"
      ? { context: "COMPAGNONS", title: "Équipe Pokémon", meta: `${model.eventState.party.members.length}/6` }
      : model.tab === "pokedex"
        ? { context: "ENCYCLOPÉDIE", title: "Pokédex", meta: `${model.eventState.pokedex.caughtSpecies.length} OBTENUS` }
      : model.tab === "movement"
        ? { context: "OUTILS LOCAUX", title: "Test dev", meta: "PERSONNEL" }
        : model.tab === "alchemy"
          ? { context: "ATELIER", title: "Alchimie Pokémon", meta: `RECETTES ${model.alchemyUnlockLevel + 1}` }
        : model.tab === "map"
          ? { context: "KALOS", title: "Carte régionale", meta: model.assets.map.name }
        : model.tab === "save"
          ? { context: "PROGRESSION", title: "Sauvegarde", meta: model.worldSave === null ? "VIDE" : "MANUELLE" }
          : model.tab === "coop"
            ? { context: "AVENTURE PARTAGÉE", title: "Coopération", meta: model.coop.state }
            : model.tab === "options"
              ? { context: "PRÉFÉRENCES", title: "Options", meta: "LOCAL" }
              : { context: "SAC", title: "Inventaire", meta: `${model.eventState.money.toLocaleString("fr-FR")} ₽` };
    this.setMenuHeader(header.context, header.title, header.meta);
    this.renderPokeVialHeader(content, model);
    document.querySelectorAll<HTMLButtonElement>("[data-source-menu-tab]").forEach((button) => {
      const active = button.dataset.sourceMenuTab === model.tab;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
      const icon = button.querySelector<HTMLImageElement>("[data-source-menu-icon]");
      if (icon !== null) {
        const gendered = model.profileBodyModel.includes("feminine") ? icon.dataset.iconActiveFeminine
          : icon.dataset.iconActiveMasculine;
        const name = active ? gendered ?? icon.dataset.iconActive : icon.dataset.iconInactive;
        if (name !== undefined) icon.src = sourcePauseMenuIconUrl(name);
      }
      if (button.dataset.sourceMenuTab === "pokedex") {
        button.disabled = !model.eventState.pokedexEnabled;
        button.title = model.eventState.pokedexEnabled ? "" : "Le Pokédex n'est pas encore débloqué dans l'histoire.";
      }
    });
    if (model.tab === "team") this.renderTeam(content, model);
    else if (model.tab === "pokedex") this.pokedexView.render(content, { history: model.eventState.pokedex,
      party: model.eventState.party, ranch: model.eventState.ranch,
      catalog: model.assets.battleCatalog, assets: model.assets.pokemonAssets, regionMap: model.assets.regionMap,
      itemNames: model.assets.itemNames });
    else if (model.tab === "bag") this.renderBag(content, model);
    else if (model.tab === "map") this.renderRegionMap(content, model);
    else if (model.tab === "alchemy") this.renderAlchemy(content, model);
    else if (model.tab === "movement") this.renderDevTools(content, model);
    else if (model.tab === "save") this.renderSave(content, model);
    else if (model.tab === "coop") this.renderCoop(content, model.coop);
    else this.renderOptions(content, model);
  }

  private renderRegionMap(content: HTMLElement, model: SourceMenuViewModel): void {
    this.stopRegionMapLayout?.();
    this.stopRegionMapLayout = null;
    const region = sourceRegionForMap(model.assets.regionMap, model.assets.map.id)
      ?? model.assets.regionMap.regions[0] ?? null;
    if (region === null) {
      content.innerHTML = '<div class="source-menu-empty"><strong>Carte indisponible</strong><small>Aucune région ne correspond à cette zone.</small></div>';
      return;
    }
    const points = sourceVisibleRegionPoints(region, model.eventState.switches);
    if (!model.movement.unlocks.fly || !model.movement.canFlyHere) this.regionMapMode = "consult";
    const pointGroups = new Map<string, SourceRegionPoint[]>();
    for (const point of points) {
      if (point.name === "") continue;
      const key = `${point.x}:${point.y}`;
      pointGroups.set(key, [...pointGroups.get(key) ?? [], point]);
    }
    const current = model.assets.regionMap.mapPositions.get(model.assets.map.id) ?? null;
    const fallbackKey = current === null ? pointGroups.keys().next().value as string | undefined
      : `${current.x}:${current.y}`;
    if (this.selectedRegionPointKey === null || !pointGroups.has(this.selectedRegionPointKey)) {
      this.selectedRegionPointKey = fallbackKey !== undefined && pointGroups.has(fallbackKey)
        ? fallbackKey : pointGroups.keys().next().value as string | null ?? null;
    }
    const selected = this.selectedRegionPointKey === null ? [] : pointGroups.get(this.selectedRegionPointKey) ?? [];
    const markers = [...pointGroups].map(([key, group]) => {
      const point = group[0]!;
      const label = [...new Set(group.map((entry) => entry.name))].join(" / ");
      const flyable = group.some((entry) => entry.destination !== null);
      return `<button type="button" class="source-region-hit${key === this.selectedRegionPointKey ? " selected" : ""}${flyable ? " flyable" : ""}" data-source-region-point="${key}" style="--map-x:${point.x};--map-y:${point.y}" aria-label="${escapeSourceHtml(label)}"${this.regionMapMode === "fly" && !flyable ? " disabled" : ""}></button>`;
    }).join("");
    const selectedNames = [...new Set(selected.map((point) => point.name))].join(" · ");
    const selectedDescriptions = [...new Set(selected.map((point) => point.description).filter(Boolean))].join(" · ");
    const regionalPlayers = model.coop.active && model.coop.players.length > 0 ? model.coop.players : [{ side: "player" as const,
      name: "Vous", connected: true, connectionState: "connected" as const,
      bodyModel: model.profileBodyModel, mapId: model.assets.map.id }];
    const playerMarkers = regionalPlayers.filter((player) => player.connected && player.mapId !== null)
      .map((player) => ({ player, position: model.assets.regionMap.mapPositions.get(player.mapId!) }))
      .filter((entry) => entry.position?.region === region.id)
      .map(({ player, position }) => {
        const playerMarker = player.bodyModel.includes("feminine") ? "mapPlayer001.png" : "mapPlayer000.png";
        const role = player.side === "player" ? "host" : "guest";
        return `<span class="source-region-player ${role}" style="--map-x:${position!.x};--map-y:${position!.y};--map-player:url('/__pokemon-z/source/Graphics/Pictures/${playerMarker}')" aria-label="${role === "host" ? "Hôte" : "Invité"} : ${escapeSourceHtml(player.name)}"><i>${role === "host" ? "H" : "I"}</i></span>`;
      }).join("");
    const flyEnabled = model.movement.unlocks.fly && model.movement.canFlyHere;
    const modeControls = `<div class="source-region-modes" role="group" aria-label="Mode de la carte"><button type="button" data-region-mode="consult" class="${this.regionMapMode === "consult" ? "active" : ""}">Consultation</button><button type="button" data-region-mode="fly" class="${this.regionMapMode === "fly" ? "active" : ""}"${flyEnabled ? "" : " disabled"}>Vol</button></div>`;
    const coopLegend = model.coop.active ? `<div class="source-region-presence">${regionalPlayers.filter((player) => player.connected).map((player) => `<span class="${player.side === "player" ? "host" : "guest"}"><i></i>${player.side === "player" ? "Hôte" : "Invité"} · ${escapeSourceHtml(player.name)}</span>`).join("")}</div>` : "";
    const modeHint = this.regionMapMode === "fly" ? "Choisissez une destination marquée pour décoller."
      : !model.movement.unlocks.fly ? "Le Vol peut être activé dans Test dev."
        : !model.movement.canFlyHere ? "Le Vol doit être lancé depuis une zone extérieure." : "Explorez les lieux et leurs descriptions.";
    this.setMenuHeader(region.name.toLocaleUpperCase("fr-FR"), "Carte régionale", selectedNames || "Zone inconnue");
    content.innerHTML = `<div class="source-menu-title source-region-title"><div><small>CARTE DU MONDE</small><h3>${escapeSourceHtml(region.name)}</h3></div><span>${points.length} REPÈRES</span></div>
      <div class="source-region-layout"><section class="source-region-map ${this.regionMapMode === "fly" ? "fly-mode" : "consult-mode"}" aria-label="Carte de ${escapeSourceHtml(region.name)}"><div class="source-region-canvas"><img src="${sourceRegionImageUrl(region.filename)}" alt="Carte de ${escapeSourceHtml(region.name)}"><div class="source-region-overlay">${markers}${playerMarkers}</div>${coopLegend}</div></section>
      <aside class="source-region-details"><div><small>${this.regionMapMode === "fly" ? "DESTINATION" : "LIEU SÉLECTIONNÉ"}</small><h4>${escapeSourceHtml(selectedNames || "Zone inconnue")}</h4>${selectedDescriptions === "" ? "" : `<p>${escapeSourceHtml(selectedDescriptions)}</p>`}<em>${escapeSourceHtml(modeHint)}</em></div>${modeControls}</aside></div>`;
    const mapContainer = content.querySelector<HTMLElement>(".source-region-map");
    const mapFrame = content.querySelector<HTMLElement>(".source-region-canvas");
    if (mapContainer !== null && mapFrame !== null) {
      this.stopRegionMapLayout = bindSourceAspectFrame(mapContainer, mapFrame, 3 / 2);
    }
    content.querySelectorAll<HTMLButtonElement>("[data-region-mode]").forEach((button) => button.addEventListener("click", () => {
      this.regionMapMode = button.dataset.regionMode === "fly" ? "fly" : "consult";
      this.renderRegionMap(content, model);
    }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-region-point]").forEach((button) =>
      button.addEventListener("click", () => {
        const pointKey = button.dataset.sourceRegionPoint ?? null;
        this.selectedRegionPointKey = pointKey;
        if (this.regionMapMode === "fly") {
          const destination = pointKey === null ? null
            : pointGroups.get(pointKey)?.find((point) => point.destination !== null)?.destination;
          if (destination !== null && destination !== undefined) { this.regionMapMode = "consult"; this.callbacks.onFly(destination); }
          return;
        }
        this.renderRegionMap(content, model);
      }));
  }

  private renderAlchemy(content: HTMLElement, model: SourceMenuViewModel): void {
    const recipes = model.assets.alchemy.recipes.filter((recipe) => recipe.unlockLevel <= model.alchemyUnlockLevel);
    const pageCount = Math.max(1, Math.ceil(recipes.length / SOURCE_ALCHEMY_RECIPES_PER_PAGE));
    this.alchemyPage = Math.max(0, Math.min(pageCount - 1, this.alchemyPage));
    const pageRecipes = recipes.slice(this.alchemyPage * SOURCE_ALCHEMY_RECIPES_PER_PAGE,
      (this.alchemyPage + 1) * SOURCE_ALCHEMY_RECIPES_PER_PAGE);
    const selected = pageRecipes.find((recipe) => recipe.output.itemId === this.selectedAlchemyRecipeId)
      ?? pageRecipes[0] ?? null;
    this.selectedAlchemyRecipeId = selected?.output.itemId ?? null;
    const maximum = selected === null ? 0 : sourceAlchemyCraftLimit(model.eventState.inventory, selected);
    this.alchemyQuantity = Math.max(1, Math.min(Math.max(1, maximum), this.alchemyQuantity));
    const itemName = (itemId: string): string => model.assets.items.get(itemId)?.name ?? itemId;
    const itemDescription = (itemId: string): string => model.assets.items.get(itemId)?.description
      ?? "Aucune description disponible.";
    const itemIcon = (itemId: string): string => {
      const item = model.assets.items.get(itemId);
      return item === undefined ? "" : `<img src="${sourceItemIconUrl(item.id)}" data-source-item-icon alt="">`;
    };
    const cards = pageRecipes.map((recipe) => {
      const craftable = sourceAlchemyCraftLimit(model.eventState.inventory, recipe);
      return `<button type="button" class="source-alchemy-recipe${recipe.output.itemId === selected?.output.itemId ? " selected" : ""}" data-source-alchemy-recipe="${escapeSourceHtml(recipe.output.itemId)}">${itemIcon(recipe.output.itemId)}<span><strong>${escapeSourceHtml(itemName(recipe.output.itemId))}</strong><small>${recipe.ingredients.map((ingredient) => `${escapeSourceHtml(itemName(ingredient.itemId))} ×${ingredient.quantity}`).join(" · ")}</small></span><em>${craftable > 0 ? `×${craftable}` : "Incomplet"}</em></button>`;
    }).join("");
    const details = selected === null ? `<div class="source-menu-empty"><strong>Aucune recette</strong><small>Progressez dans l'histoire pour apprendre l'Alchimie Pokémon.</small></div>`
      : `<section class="source-alchemy-detail"><header>${itemIcon(selected.output.itemId)}<div><small>RÉSULTAT</small><strong>${escapeSourceHtml(itemName(selected.output.itemId))}</strong><span>Vous en possédez ${model.eventState.inventory[selected.output.itemId] ?? 0}.</span></div></header><p class="source-alchemy-description">${escapeSourceHtml(itemDescription(selected.output.itemId))}</p><div class="source-alchemy-ingredients">${selected.ingredients.map((ingredient) => { const owned = model.eventState.inventory[ingredient.itemId] ?? 0; const required = ingredient.quantity * this.alchemyQuantity; return `<article class="${owned >= required ? "ready" : "missing"}">${itemIcon(ingredient.itemId)}<span><strong>${escapeSourceHtml(itemName(ingredient.itemId))}</strong><small>${owned} possédé${owned > 1 ? "s" : ""} / ${required} requis</small></span></article>`; }).join("")}</div>${maximum > 0 ? `${sourceAlchemyQuantitySelectorHtml(this.alchemyQuantity, maximum)}<button type="button" class="source-alchemy-craft" data-source-alchemy-craft>Fabriquer ×${this.alchemyQuantity}</button>` : `<p class="source-alchemy-unavailable">Ingrédients insuffisants ou emplacement de Sac plein.</p>`}${this.alchemyNotice === null ? "" : `<p class="source-alchemy-notice" role="status">${escapeSourceHtml(this.alchemyNotice)}</p>`}</section>`;
    const pagination = pageCount <= 1 ? "" : `<footer class="source-alchemy-pagination" aria-label="Pages du grimoire"><button type="button" data-source-alchemy-page="-1"${this.alchemyPage === 0 ? " disabled" : ""} aria-label="Page précédente">‹</button><span>FEUILLET <b>${this.alchemyPage + 1}</b> / ${pageCount}</span><button type="button" data-source-alchemy-page="1"${this.alchemyPage === pageCount - 1 ? " disabled" : ""} aria-label="Page suivante">›</button></footer>`;
    const turnClass = this.alchemyPageTurn === null ? "" : ` turn-${this.alchemyPageTurn}`;
    this.alchemyPageTurn = null;
    this.setMenuHeader("ATELIER", "Alchimie Pokémon", `${recipes.length}/${model.assets.alchemy.recipes.length} RECETTES`);
    content.innerHTML = `<div class="source-menu-title"><div><small>RECETTES D'OLIVIER</small><h3>Alchimie Pokémon</h3></div><span>NIVEAU ${model.alchemyUnlockLevel}</span></div><div class="source-alchemy-layout"><section class="source-alchemy-page${turnClass}"><nav class="source-alchemy-recipes" aria-label="Recettes disponibles">${cards}</nav>${pagination}</section>${details}</div>`;
    bindSourceItemIconFallback(content);
    content.querySelectorAll<HTMLButtonElement>("[data-source-alchemy-recipe]").forEach((button) =>
      button.addEventListener("click", () => {
        this.selectedAlchemyRecipeId = button.dataset.sourceAlchemyRecipe ?? null;
        this.alchemyQuantity = 1;
        this.alchemyNotice = null;
        this.renderAlchemy(content, model);
      }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-alchemy-page]").forEach((button) =>
      button.addEventListener("click", () => {
        const direction = Number(button.dataset.sourceAlchemyPage);
        if (direction !== -1 && direction !== 1) return;
        this.alchemyPage = Math.max(0, Math.min(pageCount - 1, this.alchemyPage + direction));
        this.alchemyPageTurn = direction > 0 ? "forward" : "backward";
        this.selectedAlchemyRecipeId = null;
        this.alchemyQuantity = 1;
        this.alchemyNotice = null;
        this.renderAlchemy(content, model);
      }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-quantity-delta]").forEach((button) =>
      button.addEventListener("click", () => {
        const delta = Number(button.dataset.sourceQuantityDelta);
        if (!Number.isSafeInteger(delta)) return;
        this.alchemyQuantity = Math.max(1, Math.min(maximum, this.alchemyQuantity + delta));
        this.renderAlchemy(content, model);
      }));
    content.querySelector<HTMLButtonElement>("[data-source-quantity-max]")?.addEventListener("click", () => {
      this.alchemyQuantity = maximum;
      this.renderAlchemy(content, model);
    });
    content.querySelector<HTMLButtonElement>("[data-source-alchemy-craft]")?.addEventListener("click", () => {
      if (selected === null) return;
      const result = this.callbacks.onCraftAlchemy(selected.output.itemId, this.alchemyQuantity);
      this.alchemyNotice = result.message;
      this.alchemyQuantity = 1;
      this.renderAlchemy(content, { ...model, eventState: result.eventState });
    });
  }

  private renderTeam(content: HTMLElement, model: SourceMenuViewModel): void {
    const members = model.eventState.party.members;
    const entries = createSourcePokemonCollection(model.eventState.party, model.eventState.ranch,
      model.assets.battleCatalog, model.assets.pokemonAssets).filter((entry) => entry.location === "team");
    if (this.selectedTeamPokemonId !== null && !entries.some((entry) => entry.pokemon.id === this.selectedTeamPokemonId)) {
      this.selectedTeamPokemonId = null;
    }
    const selected = entries.find((entry) => entry.pokemon.id === this.selectedTeamPokemonId) ?? null;
    const heldItemTarget = entries.find((entry) => entry.pokemon.id === this.heldItemPokemonId) ?? null;
    const activePokemonId = model.eventState.party.activeIndex === null ? null
      : model.eventState.party.members[model.eventState.party.activeIndex]?.id ?? null;
    const pokeVial = sourcePokeVialStatus(model.eventState);
    const wheel = selected === null ? "" : sourcePokemonActionWheelHtml(selected,
      sourcePokemonActions("team", selected, { partySize: members.length, partyFull: members.length >= 6,
        activePokemonId, heldItemManagementAvailable: canManageSourceHeldItem(model.eventState.inventory,
          selected.pokemon.heldItem, model.assets.items) }));
    const heldItemPanel = heldItemTarget === null ? "" : sourceHeldItemManagerHtml(heldItemTarget.displayName,
      heldItemTarget.pokemon.heldItem, model.eventState.inventory, model.assets.items,
      { pocket: this.heldItemPocket, familyId: this.heldItemFamilyId, page: this.heldItemPage });
    const occupiedSlots = entries.map((entry) => sourcePokemonCardHtml(entry, {
      active: entry.teamIndex === model.eventState.party.activeIndex,
      selected: entry.pokemon.id === this.selectedTeamPokemonId,
      teamLayout: true,
      heldItemName: entry.pokemon.heldItem === null ? null
        : model.assets.items.get(entry.pokemon.heldItem)?.name ?? entry.pokemon.heldItem,
    })).join("");
    const emptySlots = Array.from({ length: Math.max(0, 6 - entries.length) }, (_, index) =>
      `<article class="source-team-empty-slot" aria-label="Emplacement ${entries.length + index + 1} libre"><span>${entries.length + index + 1}</span><img src="/__pokemon-z/source/Graphics/Pictures/partyBall.PNG" alt=""><strong>Emplacement libre</strong></article>`).join("");
    const pokeVialConfirm = !this.pokeVialConfirming ? "" : `<section class="source-poke-vial-confirm" role="dialog" aria-modal="true" aria-label="Utiliser le Pokévial"><img src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/vial.png" alt=""><div><small>SOIGNER L'ÉQUIPE</small><strong>Utiliser le Pokévial ?</strong><p>Les PV, statuts et PP de toute l'équipe seront restaurés. Il restera ${pokeVial.current - 1}/${pokeVial.maximum} soin${pokeVial.maximum > 1 ? "s" : ""}.</p><nav><button type="button" data-source-poke-vial-cancel>Annuler</button><button type="button" data-source-poke-vial-confirm>Soigner</button></nav></div></section>`;
    content.innerHTML = `<div class="source-menu-title"><div><small>COMPAGNONS</small><h3>Équipe Pokémon</h3></div><span>${members.length}/6</span></div><div class="source-team-grid">${occupiedSlots}${emptySlots}</div>${this.bagNotice === null ? "" : `<p class="source-bag-notice">${escapeSourceHtml(this.bagNotice)}</p>`}${pokeVialConfirm}${wheel}${heldItemPanel}`;
    bindSourceHeldItemIconFallback(content);
    content.querySelectorAll<HTMLButtonElement>(".source-team-grid [data-pokemon-id]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedTeamPokemonId = button.dataset.pokemonId ?? null;
        this.renderTeam(content, model);
      });
    });
    content.querySelector<HTMLButtonElement>("[data-source-poke-vial-cancel]")?.addEventListener("click", () => {
      this.pokeVialConfirming = false;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLButtonElement>("[data-source-poke-vial-confirm]")?.addEventListener("click", () => {
      this.pokeVialConfirming = false;
      const result = this.callbacks.onUsePokeVial();
      this.bagNotice = result.message;
      const nextModel = { ...model, eventState: result.eventState };
      this.renderPokeVialHeader(content, nextModel);
      this.renderTeam(content, nextModel);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-wheel-close]").forEach((button) => button.addEventListener("click", () => {
      if (heldItemTarget !== null) {
        this.heldItemPokemonId = null;
        this.heldItemPocket = null;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
        this.renderTeam(content, model);
        return;
      }
      this.selectedTeamPokemonId = null;
      this.renderTeam(content, model);
    }));
    content.querySelectorAll<HTMLElement>("[data-source-wheel-dismiss]").forEach((backdrop) => backdrop.addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      if (heldItemTarget !== null) {
        this.heldItemPokemonId = null;
        this.heldItemPocket = null;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
      }
      this.selectedTeamPokemonId = null;
      this.renderTeam(content, model);
    }));
    content.querySelector<HTMLButtonElement>('[data-source-wheel-action="make-lead"]')?.addEventListener("click", () => {
      if (selected !== null) this.callbacks.onPokemonLead(selected.pokemon.id);
    });
    content.querySelector<HTMLButtonElement>('[data-source-wheel-action="details"]')?.addEventListener("click", () => {
      if (selected !== null) this.callbacks.onPokemonDetails(selected.pokemon.id);
    });
    content.querySelector<HTMLButtonElement>('[data-source-wheel-action="give-item"]')?.addEventListener("click", () => {
      if (selected === null) return;
      this.heldItemPokemonId = selected.pokemon.id;
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLButtonElement>("[data-held-item-close]")?.addEventListener("click", () => {
      this.heldItemPokemonId = null;
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.renderTeam(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>('[data-source-wheel-action^="held-pocket:"]').forEach((button) =>
      button.addEventListener("click", () => {
        const pocket = Number(button.dataset.sourceWheelAction?.split(":")[1]);
        if (!Number.isInteger(pocket)) return;
        this.heldItemPocket = pocket;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
        this.renderTeam(content, model);
      }));
    content.querySelector<HTMLButtonElement>("[data-held-item-pocket-back]")?.addEventListener("click", () => {
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.renderTeam(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-held-item-family]").forEach((button) =>
      button.addEventListener("click", () => {
        this.heldItemFamilyId = button.dataset.heldItemFamily ?? null;
        this.heldItemPage = 0;
        this.renderTeam(content, model);
      }));
    content.querySelector<HTMLButtonElement>("[data-held-item-family-back]")?.addEventListener("click", () => {
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.renderTeam(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>(".source-held-item-browser [data-source-inventory-page]").forEach((button) =>
      button.addEventListener("click", () => {
        const page = Number(button.dataset.sourceInventoryPage);
        if (!Number.isInteger(page)) return;
        this.heldItemPage = page;
        this.renderTeam(content, model);
      }));
    content.querySelector<HTMLButtonElement>("[data-held-item-remove]")?.addEventListener("click", () => {
      if (heldItemTarget === null) return;
      this.heldItemPokemonId = null;
      this.heldItemPocket = null;
      this.heldItemFamilyId = null;
      this.heldItemPage = 0;
      this.callbacks.onPokemonHeldItem(heldItemTarget.pokemon.id, null);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-held-item-equip]").forEach((button) =>
      button.addEventListener("click", () => {
        if (heldItemTarget === null || button.dataset.heldItemEquip === undefined) return;
        this.heldItemPokemonId = null;
        this.heldItemPocket = null;
        this.heldItemFamilyId = null;
        this.heldItemPage = 0;
        this.callbacks.onPokemonHeldItem(heldItemTarget.pokemon.id, button.dataset.heldItemEquip);
      }));
  }

  private renderPokeVialHeader(content: HTMLElement, model: SourceMenuViewModel): void {
    const button = document.querySelector<HTMLButtonElement>("#source-poke-vial");
    const charges = document.querySelector<HTMLElement>("#source-poke-vial-charges");
    if (button === null || charges === null) return;
    const vial = sourcePokeVialStatus(model.eventState);
    if (model.tab !== "team" || !vial.canUse) this.pokeVialConfirming = false;
    button.hidden = model.tab !== "team" || !vial.owned;
    button.disabled = !vial.canUse;
    button.title = vial.canUse ? "Soigner toute l'équipe"
      : "Le Pokévial est vide. Rechargez-le dans un Centre Pokémon.";
    charges.textContent = `${vial.current}/${vial.maximum} soin${vial.maximum > 1 ? "s" : ""}`;
    button.onclick = button.hidden || !vial.canUse ? null : () => {
      this.pokeVialConfirming = true;
      this.bagNotice = null;
      this.renderTeam(content, model);
    };
  }

  private setMenuHeader(context: string, title: string, meta: string): void {
    const contextElement = document.querySelector<HTMLElement>("#source-menu-context");
    const titleElement = document.querySelector<HTMLElement>("#source-menu-location");
    const metaElement = document.querySelector<HTMLElement>("#source-menu-meta");
    if (contextElement !== null) contextElement.textContent = context;
    if (titleElement !== null) titleElement.textContent = title;
    if (metaElement !== null) {
      metaElement.textContent = meta;
      metaElement.hidden = meta.length === 0;
    }
  }

  private renderBag(content: HTMLElement, model: SourceMenuViewModel): void {
    const counts = sourceBagPocketCounts(model.eventState.inventory, model.assets.items);
    const searching = this.bagQuery.trim().length > 0;
    const pocketEntries = sourceBagEntries(model.eventState.inventory, model.assets.items, this.selectedPocket);
    const entries = searching
      ? SOURCE_BAG_POCKETS.flatMap(({ id }) => sourceBagEntries(model.eventState.inventory, model.assets.items, id))
        .filter((entry) => sourceBagEntryMatches(entry, this.bagQuery,
          entry.item.machineMove === null || entry.item.machineMove === undefined ? undefined
            : model.assets.battleCatalog.moves.find((move) => move.internalName === entry.item.machineMove)?.name))
      : pocketEntries;
    let familyEntries = this.selectedBagFamilyId === null ? []
      : sourceBagFamilyEntries(entries, this.selectedBagFamilyId);
    if (this.selectedBagFamilyId !== null && familyEntries.length === 0) {
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
      familyEntries = [];
    }
    const visibleNodes = searching ? entries.map((entry) => ({ kind: "item" as const, entry }))
      : this.selectedBagFamilyId === null ? sourceBagNodes(entries)
      : familyEntries.map((entry) => ({ kind: "item" as const, entry }));
    const pageSize = window.matchMedia("(max-width: 430px)").matches ? 4 : SOURCE_BAG_PAGE_SIZE;
    const pagedNodes = sourceBagPage(visibleNodes, this.bagPage, pageSize);
    this.bagPage = pagedNodes.page;
    const selectedFamily = searching || familyEntries[0] === undefined ? null : sourceBagSubfamily(familyEntries[0].item);
    if (this.selectedBagItemId !== null
      && !entries.some(({ item }) => item.internalName === this.selectedBagItemId)) this.selectedBagItemId = null;
    const selectedEntry = entries.find(({ item }) => item.internalName === this.selectedBagItemId) ?? null;
    if (selectedEntry === null) this.bagAction = null;
    const targetMode = selectedEntry === null || this.bagAction !== "use"
      ? null : pokemonItemTargetMode(selectedEntry.item.internalName);
    const selectedTarget = model.eventState.party.members.find((pokemon) =>
      pokemon.id === this.selectedBagPokemonId) ?? null;
    const teamEntries = createSourcePokemonCollection(model.eventState.party, model.eventState.ranch,
      model.assets.battleCatalog, model.assets.pokemonAssets).filter((entry) => entry.location === "team");
    const targetChoices = targetMode === "move" && selectedTarget !== null
      ? selectedTarget.moves.map((slot, index) => {
        const move = model.assets.battleCatalog.moves.find((candidate) => candidate.internalName === slot.internalName);
        return `<button type="button" data-source-bag-move="${index}"><strong>${escapeSourceHtml(move?.name ?? slot.internalName)}</strong><small>${slot.pp}/${slot.maxPp} PP</small></button>`;
      }).join("")
      : teamEntries.map((entry) => `<button type="button" class="source-bag-target-card" data-source-bag-target="${escapeSourceHtml(entry.pokemon.id)}">${sourcePokemonIconHtml(entry)}<span><strong>${escapeSourceHtml(entry.displayName)}</strong><small>N.${entry.pokemon.level} · ${entry.pokemon.hp}/${entry.pokemon.stats.maxHp} PV${entry.pokemon.majorStatus === null ? "" : ` · ${escapeSourceHtml(entry.pokemon.majorStatus.kind)}`}</small></span></button>`).join("");
    const pocket = SOURCE_BAG_POCKETS.find((candidate) => candidate.id === this.selectedPocket)
      ?? SOURCE_BAG_POCKETS[0]!;
    const machineMove = selectedEntry?.item.machineMove ?? null;
    const machineSpecies = machineMove === null ? undefined : model.assets.machineCompatibility.get(machineMove);
    const machineMoveName = machineMove === null ? undefined
      : model.assets.battleCatalog.moves.find((move) => move.internalName === machineMove)?.name;
    const selectedItemDisplayName = selectedEntry === null ? null
      : sourceItemDisplayName(selectedEntry.item, machineMoveName);
    const selectedFishingRod = selectedEntry !== null
      && ["OLDROD", "GOODROD", "SUPERROD"].includes(selectedEntry.item.internalName)
      ? selectedEntry.item.internalName as SourceFishingRod : null;
    const fishingActions = selectedFishingRod === null ? [] : [
      { id: "specific:fishing" as const, label: "Pêcher", symbol: "≈", enabled: true,
        hint: "Lancer la ligne face à l’eau" },
      { id: "specific:fishing-favorite" as const,
        label: model.eventState.preferredFishingRod === selectedFishingRod
          && model.fieldShortcuts.includes("fishing") ? "Retirer" : "Raccourci",
        symbol: "★", enabled: true,
        hint: model.eventState.preferredFishingRod === selectedFishingRod
          && model.fieldShortcuts.includes("fishing")
          ? "Retirer le bouton de pêche du terrain" : "Utiliser cette canne avec le bouton de terrain" },
    ];
    const characterGuideEntries = unlockedSourceCharacterGuideEntries(model.eventState.variables);
    const selectedCharacter = characterGuideEntries.find((entry) => entry.id === this.selectedCharacterGuideId)
      ?? characterGuideEntries[0] ?? SOURCE_CHARACTER_GUIDE[0]!;
    const characterGuideImageUrls = sourceCharacterGuideImageUrls(selectedCharacter);
    const characterGuidePanel = !this.characterGuideOpen ? "" : `<div class="source-bag-flow-backdrop"><section class="source-character-guide" role="dialog" aria-modal="true" aria-label="Guide des personnages"><header><div><small>ARCHIVES DE L'AVENTURE</small><strong>Guide des personnages</strong><span>${characterGuideEntries.length}/${SOURCE_CHARACTER_GUIDE.length} fiches</span></div><button type="button" data-source-character-guide-close aria-label="Fermer">×</button></header><div class="source-character-guide-layout"><nav aria-label="Personnages rencontrés">${characterGuideEntries.map((entry) => `<button type="button" data-source-character-guide-entry="${escapeSourceHtml(entry.id)}"${entry.id === selectedCharacter.id ? ' class="active" aria-current="true"' : ""}>${escapeSourceHtml(entry.name)}</button>`).join("")}</nav><article><img src="${characterGuideImageUrls[0]}" data-source-character-guide-image alt="Illustration de ${escapeSourceHtml(selectedCharacter.name)}"><div data-source-character-guide-fallback hidden><strong>${escapeSourceHtml(selectedCharacter.name)}</strong><p>Aucune illustration de ce personnage n’est disponible dans cette installation de Pokémon Z.</p></div></article></div><footer>Progression source : ${sourceCharacterGuideLevel(model.eventState.variables)} · Variable 240</footer></section></div>`;
    const actionWheel = selectedEntry === null || this.bagAction !== "wheel" ? ""
      : sourceActionWheelHtml({ label: `Actions pour ${selectedItemDisplayName}`,
        centerHtml: `<img src="${sourceItemIconUrl(selectedEntry.item.id)}" data-source-item-icon alt=""><strong>${escapeSourceHtml(selectedItemDisplayName!)}</strong>`,
        actions: sourceItemActions(selectedEntry.item, { quantity: selectedEntry.quantity,
          machineCompatibilityAvailable: machineSpecies !== undefined,
          fieldUsable: isSourceFieldItem(selectedEntry.item.internalName),
          specificActions: selectedEntry.item.internalName === "INCUBADORA"
            ? [{ id: "specific:incubator", label: "Ouvrir", symbol: "◉", enabled: true,
                hint: "Gérer les six emplacements" }]
            : selectedEntry.item.internalName === "LENSOFTRUTH"
              ? [{ id: "specific:truth-lens", label: "Observer", symbol: "◉", enabled: true,
                  hint: "Révéler la vérité autour de vous pendant 10 secondes" },
                { id: "specific:truth-lens-shortcut",
                  label: model.fieldShortcuts.includes("truth-lens") ? "Retirer" : "Raccourci",
                  symbol: "★", enabled: true,
                  hint: model.fieldShortcuts.includes("truth-lens")
                    ? "Retirer le Miroir des raccourcis" : "Afficher le Miroir après la Boussole" }]
            : selectedEntry.item.internalName === "PERSONAJES"
              ? [{ id: "specific:character-guide", label: "Consulter", symbol: "i", enabled: true,
                  hint: "Ouvrir les fiches rencontrées" }]
            : selectedEntry.item.internalName === "POKEOBJETIVO"
              ? [{ id: "specific:adventure-objective", label: "Indisponible", symbol: "?", enabled: false,
                  hint: "Cette version source ne contient aucune table d’objectifs" }]
            : fishingActions }) });
    const targetPanel = selectedEntry === null || (this.bagAction !== "use" && this.bagAction !== "give") ? ""
      : `<div class="source-bag-flow-backdrop"><section class="source-bag-targets source-bag-flow"><header><div><small>${this.bagAction === "give" ? "DONNER À UN POKÉMON" : selectedTarget === null ? "CHOISIR UNE CIBLE" : "CHOISIR UNE CAPACITÉ"}</small><strong>${escapeSourceHtml(selectedTarget?.nickname ?? selectedTarget?.species ?? selectedEntry.item.name)}</strong></div><button type="button" data-source-bag-cancel>Retour</button></header>${model.eventState.party.members.length === 0
        ? "<p>Aucun Pokémon dans l'équipe.</p>" : `<div class="source-bag-party-targets">${this.bagAction === "give"
          ? teamEntries.map((entry) => `<button type="button" class="source-bag-target-card" data-source-bag-give-target="${escapeSourceHtml(entry.pokemon.id)}">${sourcePokemonIconHtml(entry)}<span><strong>${escapeSourceHtml(entry.displayName)}</strong><small>${entry.pokemon.heldItem === null ? "Aucun objet tenu" : `Tient ${escapeSourceHtml(entry.pokemon.heldItem)}`}</small></span></button>`).join("")
          : targetChoices}</div>`}</section></div>`;
    const discardPanel = selectedEntry === null || this.bagAction !== "discard" ? ""
      : `<div class="source-bag-flow-backdrop"><section class="source-bag-targets source-bag-flow source-bag-discard"><header><div><small>JETER</small><strong>${escapeSourceHtml(selectedEntry.item.name)}</strong></div><button type="button" data-source-bag-cancel>Retour</button></header>${sourceQuantitySelectorHtml("Quantité", this.discardQuantity, selectedEntry.quantity)}<button type="button" class="danger" data-source-bag-discard-confirm>Jeter</button></section></div>`;
    const partyUsePanel = selectedEntry === null || this.bagAction !== "use-party-confirm" ? ""
      : `<div class="source-bag-flow-backdrop"><section class="source-bag-targets source-bag-flow"><header><div><small>SOIGNER L'ÉQUIPE</small><strong>${escapeSourceHtml(selectedEntry.item.name)}</strong></div><button type="button" data-source-bag-cancel>Retour</button></header><p>Ranimer et soigner complètement tous les Pokémon K.O. de l'équipe ?</p><footer><button type="button" data-source-party-item-confirm>Utiliser</button></footer></section></div>`;
    const rareCandyTarget = this.bagAction === "rare-candy-confirm" ? selectedTarget : null;
    const rareCandyPanel = selectedEntry === null || rareCandyTarget === null ? ""
      : `<div class="source-bag-flow-backdrop"><section class="source-bag-targets source-bag-flow source-bag-discard"><header><div><small>MONTER DE NIVEAU</small><strong>${escapeSourceHtml(rareCandyTarget.nickname ?? rareCandyTarget.species)} · N.${rareCandyTarget.level}</strong></div><button type="button" data-source-bag-cancel>Retour</button></header>${sourceQuantitySelectorHtml("Bonbons", this.rareCandyQuantity, selectedEntry.quantity)}<button type="button" data-source-rare-candy-confirm>Utiliser</button></section></div>`;
    const teachTarget = selectedTarget === null ? null : teamEntries.find((entry) => entry.pokemon.id === selectedTarget.id) ?? null;
    const teachPanel = selectedEntry === null || machineMove === null || machineSpecies === undefined
      || !["teach", "teach-replace", "teach-confirm"].includes(this.bagAction ?? "") ? ""
      : `<div class="source-bag-flow-backdrop"><section class="source-bag-targets source-bag-flow"><header><div><small>${this.bagAction === "teach" ? "CHOISIR UN POKÉMON" : this.bagAction === "teach-replace" ? "OUBLIER UNE CAPACITÉ" : "CONFIRMER L'APPRENTISSAGE"}</small><strong>${escapeSourceHtml(model.assets.battleCatalog.moves.find((move) => move.internalName === machineMove)?.name ?? machineMove)}</strong></div><button type="button" data-source-bag-cancel>Retour</button></header>${this.bagAction === "teach"
        ? `<div class="source-bag-party-targets">${teamEntries.map((entry) => { const compatible = machineSpecies.has(entry.pokemon.species); const known = entry.pokemon.moves.some((slot) => slot.internalName === machineMove); return `<button type="button" class="source-bag-target-card" data-source-machine-target="${escapeSourceHtml(entry.pokemon.id)}"${compatible && !known ? "" : " disabled"}>${sourcePokemonIconHtml(entry)}<span><strong>${escapeSourceHtml(entry.displayName)}</strong><small>${known ? "Capacité déjà connue" : compatible ? "Compatible" : "Incompatible"}</small></span></button>`; }).join("")}</div>`
        : teachTarget === null ? "<p>Cible introuvable.</p>" : this.bagAction === "teach-replace"
          ? `<p>${escapeSourceHtml(teachTarget.displayName)} connaît déjà quatre capacités. Laquelle doit être oubliée ?</p><div>${teachTarget.pokemon.moves.map((slot, index) => { const move = model.assets.battleCatalog.moves.find((candidate) => candidate.internalName === slot.internalName); return `<button type="button" data-source-machine-replace="${index}"><strong>${escapeSourceHtml(move?.name ?? slot.internalName)}</strong><small>${slot.pp}/${slot.maxPp} PP</small></button>`; }).join("")}</div>`
          : `<p><strong>${escapeSourceHtml(teachTarget.displayName)}</strong> va apprendre <strong>${escapeSourceHtml(model.assets.battleCatalog.moves.find((move) => move.internalName === machineMove)?.name ?? machineMove)}</strong>${this.selectedBagReplacementIndex === null ? "." : ` à la place de <strong>${escapeSourceHtml(model.assets.battleCatalog.moves.find((move) => move.internalName === teachTarget.pokemon.moves[this.selectedBagReplacementIndex!]?.internalName)?.name ?? teachTarget.pokemon.moves[this.selectedBagReplacementIndex!]?.internalName ?? "?")}</strong>.`}</p><footer><button type="button" data-source-machine-confirm>Confirmer</button></footer>`}</section></div>`;
    const resultItem = this.bagResult === null ? undefined : model.assets.items.get(this.bagResult.itemId);
    const resultMoveName = resultItem?.machineMove === null || resultItem?.machineMove === undefined ? undefined
      : model.assets.battleCatalog.moves.find((move) => move.internalName === resultItem.machineMove)?.name;
    const resultPanel = this.bagResult === null ? "" : `<div class="source-bag-flow-backdrop"><section class="source-bag-targets source-bag-flow source-bag-result"><header><div><small>RÉSULTAT</small><strong>${escapeSourceHtml(resultItem === undefined ? this.bagResult.itemId : sourceItemDisplayName(resultItem, resultMoveName))}</strong></div></header><p>${escapeSourceHtml(this.bagResult.message)}</p><footer>${this.bagResult.repeatAction !== null && (model.eventState.inventory[this.bagResult.itemId] ?? 0) > 0 ? `<button type="button" data-source-bag-repeat="${this.bagResult.repeatAction}">Recommencer</button>` : ""}<button type="button" data-source-bag-result-close>Continuer</button></footer></section></div>`;
    const inventoryGrid = entries.length === 0
      ? `<div class="source-menu-empty"><img src="${sourcePocketIconUrl(pocket.id)}" alt=""><strong>${searching ? "Aucun résultat" : "Poche vide"}</strong><small>${searching ? `Aucun objet ne correspond à « ${escapeSourceHtml(this.bagQuery.trim())} ».` : `Aucun objet dans la catégorie ${escapeSourceHtml(pocket.name)}.`}</small></div>`
      : sourceBagGridHtml(pagedNodes.entries, { itemAttribute: "data-source-bag-item",
        familyAttribute: "data-source-bag-family", selectedItemId: this.selectedBagItemId,
        displayName: ({ item }) => { const moveName = item.machineMove === null || item.machineMove === undefined
          ? undefined : model.assets.battleCatalog.moves.find((move) => move.internalName === item.machineMove)?.name;
        return sourceItemDisplayName(item, moveName); } });
    this.setMenuHeader("SAC", searching ? "Recherche" : selectedFamily?.name ?? pocket.name,
      `${model.eventState.money.toLocaleString("fr-FR")} ₽`);
    content.innerHTML = `<div class="source-bag-toolbar"><label><span>Rechercher un objet</span><input type="search" data-source-bag-search value="${escapeSourceHtml(this.bagQuery)}" placeholder="Nom, effet, CT/CS…" autocomplete="off" spellcheck="false"></label><button type="button" data-source-bag-search-clear${searching ? "" : " disabled"}>Effacer</button><small>${searching ? `${entries.length} résultat${entries.length > 1 ? "s" : ""} dans tout le Sac` : "Recherche dans toutes les poches"}</small></div><nav class="source-bag-pockets" aria-label="Poches du Sac">${SOURCE_BAG_POCKETS.map((candidate) =>
        `<button type="button" data-source-pocket="${candidate.id}" class="${candidate.id === this.selectedPocket ? "active" : ""}" title="${escapeSourceHtml(candidate.name)}"><img src="${sourcePocketIconUrl(candidate.id)}" alt=""><span>${escapeSourceHtml(candidate.name)}</span><em>${counts.get(candidate.id) ?? 0}</em></button>`).join("")}</nav>
      ${selectedFamily === null ? "" : `<div class="source-inventory-breadcrumb"><button type="button" data-source-bag-family-back>‹ ${escapeSourceHtml(pocket.name)}</button><strong>${escapeSourceHtml(selectedFamily.name)}</strong><span>${familyEntries.reduce((sum, entry) => sum + entry.quantity, 0)} objets</span></div>`}
      <section class="source-inventory-browser"><div class="source-bag-list">${inventoryGrid}</div>${sourceBagPaginationHtml(pagedNodes.page, pagedNodes.pageCount)}</section>${actionWheel}${targetPanel}${discardPanel}${partyUsePanel}${rareCandyPanel}${teachPanel}${resultPanel}${characterGuidePanel}${this.bagNotice === null ? "" : `<p class="source-bag-notice">${escapeSourceHtml(this.bagNotice)}</p>`}`;
    bindSourceItemIconFallback(content);
    const searchInput = content.querySelector<HTMLInputElement>("[data-source-bag-search]");
    searchInput?.addEventListener("input", () => {
      this.bagQuery = searchInput.value;
      this.bagPage = 0;
      this.selectedBagFamilyId = null;
      this.selectedBagItemId = null;
      this.bagAction = null;
      this.renderBag(content, model);
      const nextInput = content.querySelector<HTMLInputElement>("[data-source-bag-search]");
      nextInput?.focus();
      nextInput?.setSelectionRange(this.bagQuery.length, this.bagQuery.length);
    });
    content.querySelector<HTMLButtonElement>("[data-source-bag-search-clear]")?.addEventListener("click", () => {
      this.bagQuery = "";
      this.bagPage = 0;
      this.renderBag(content, model);
      content.querySelector<HTMLInputElement>("[data-source-bag-search]")?.focus();
    });
    const guideImage = content.querySelector<HTMLImageElement>("[data-source-character-guide-image]");
    let guideImageIndex = 0;
    guideImage?.addEventListener("error", () => {
      guideImageIndex += 1;
      const nextUrl = characterGuideImageUrls[guideImageIndex];
      if (nextUrl !== undefined) {
        guideImage.src = nextUrl;
        return;
      }
      guideImage.hidden = true;
      const fallback = content.querySelector<HTMLElement>("[data-source-character-guide-fallback]");
      if (fallback !== null) fallback.hidden = false;
    });
    content.querySelector<HTMLButtonElement>("[data-source-character-guide-close]")?.addEventListener("click", () => {
      this.characterGuideOpen = false;
      this.renderBag(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-character-guide-entry]").forEach((button) =>
      button.addEventListener("click", () => {
        this.selectedCharacterGuideId = button.dataset.sourceCharacterGuideEntry ?? "olivier";
        this.renderBag(content, model);
      }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-quantity-delta]").forEach((button) =>
      button.addEventListener("click", () => {
        if (selectedEntry === null) return;
        const delta = Number(button.dataset.sourceQuantityDelta);
        if (!Number.isSafeInteger(delta)) return;
        if (this.bagAction === "discard") {
          this.discardQuantity = Math.max(1, Math.min(selectedEntry.quantity, this.discardQuantity + delta));
        } else if (this.bagAction === "rare-candy-confirm") {
          this.rareCandyQuantity = Math.max(1, Math.min(selectedEntry.quantity, this.rareCandyQuantity + delta));
        }
        this.renderBag(content, model);
      }));
    content.querySelector<HTMLButtonElement>("[data-source-quantity-max]")?.addEventListener("click", () => {
      if (selectedEntry === null) return;
      if (this.bagAction === "discard") this.discardQuantity = selectedEntry.quantity;
      else if (this.bagAction === "rare-candy-confirm") this.rareCandyQuantity = selectedEntry.quantity;
      this.renderBag(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-pocket]").forEach((button) => button.addEventListener("click", () => {
      const pocketId = Number(button.dataset.sourcePocket);
      if (!Number.isInteger(pocketId) || !SOURCE_BAG_POCKETS.some((candidate) => candidate.id === pocketId)) return;
      this.selectedPocket = pocketId;
      this.bagQuery = "";
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
      this.selectedBagItemId = null;
      this.selectedBagPokemonId = null;
      this.selectedBagReplacementIndex = null;
      this.bagAction = null;
      this.bagResult = null;
      this.bagNotice = null;
      this.render(model);
    }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-bag-family]").forEach((button) => button.addEventListener("click", () => {
      this.selectedBagFamilyId = button.dataset.sourceBagFamily ?? null;
      this.bagPage = 0;
      this.selectedBagItemId = null;
      this.bagAction = null;
      this.renderBag(content, model);
    }));
    content.querySelector<HTMLButtonElement>("[data-source-bag-family-back]")?.addEventListener("click", () => {
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
      this.selectedBagItemId = null;
      this.bagAction = null;
      this.renderBag(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-inventory-page]").forEach((button) =>
      button.addEventListener("click", () => {
        this.bagPage = Number(button.dataset.sourceInventoryPage);
        this.selectedBagItemId = null;
        this.bagAction = null;
        this.renderBag(content, model);
      }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-bag-item]").forEach((button) => button.addEventListener("click", () => {
      this.selectedBagItemId = button.dataset.sourceBagItem ?? null;
      this.selectedBagPokemonId = null;
      this.selectedBagReplacementIndex = null;
      this.bagAction = "wheel";
      this.discardQuantity = 1;
      this.bagResult = null;
      this.bagNotice = null;
      this.renderBag(content, model);
    }));
    content.querySelector<HTMLButtonElement>("[data-source-bag-cancel]")?.addEventListener("click", () => {
      this.selectedBagPokemonId = null;
      this.bagAction = "wheel";
      this.bagNotice = null;
      this.renderBag(content, model);
    });
    content.querySelector<HTMLButtonElement>("[data-source-wheel-close]")?.addEventListener("click", () => {
      this.selectedBagItemId = null;
      this.bagAction = null;
      this.renderBag(content, model);
    });
    content.querySelector<HTMLElement>("[data-source-wheel-dismiss]")?.addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      this.selectedBagItemId = null;
      this.bagAction = null;
      this.renderBag(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-wheel-action]").forEach((button) =>
      button.addEventListener("click", () => {
        const action = button.dataset.sourceWheelAction;
        if (action === "use" || action === "give" || action === "discard" || action === "teach") {
          if (action === "use" && this.selectedBagItemId !== null && isSourceFieldItem(this.selectedBagItemId)) {
            const itemId = this.selectedBagItemId;
            const result = this.callbacks.onUseFieldItem(itemId);
            this.bagNotice = result.message;
            this.bagAction = null;
            this.bagResult = { message: result.message, itemId, repeatAction: null };
            this.renderBag(content, { ...model, eventState: result.eventState });
            return;
          }
          this.bagAction = action === "use" && this.selectedBagItemId !== null
            && isPokemonPartyItemUsableInField(this.selectedBagItemId) ? "use-party-confirm" : action;
          this.selectedBagPokemonId = null;
          this.renderBag(content, model);
        } else if (action === "specific:incubator") this.callbacks.onOpenIncubator();
        else if (action === "specific:truth-lens") this.callbacks.onUseTruthLens();
        else if (action === "specific:character-guide") {
          this.characterGuideOpen = true;
          this.bagAction = null;
          this.renderBag(content, model);
        }
        else if (action === "specific:truth-lens-shortcut") {
          this.callbacks.onFieldShortcut("truth-lens", !model.fieldShortcuts.includes("truth-lens"));
        }
        else if (action === "specific:fishing" && this.selectedBagItemId !== null
          && ["OLDROD", "GOODROD", "SUPERROD"].includes(this.selectedBagItemId)) {
          this.callbacks.onFish(this.selectedBagItemId as SourceFishingRod);
        } else if (action === "specific:fishing-favorite" && this.selectedBagItemId !== null
          && ["OLDROD", "GOODROD", "SUPERROD"].includes(this.selectedBagItemId)) {
          if (model.eventState.preferredFishingRod === this.selectedBagItemId
            && model.fieldShortcuts.includes("fishing")) this.callbacks.onFieldShortcut("fishing", false);
          else this.callbacks.onPreferredFishingRod(this.selectedBagItemId as SourceFishingRod);
        }
      }));
    content.querySelector<HTMLButtonElement>("[data-source-party-item-confirm]")?.addEventListener("click", () => {
      if (this.selectedBagItemId === null) return;
      const itemId = this.selectedBagItemId;
      const result = this.callbacks.onUsePokemonPartyItem(itemId);
      this.bagNotice = result.message;
      this.bagAction = null;
      this.bagResult = { message: result.message, itemId, repeatAction: result.ok ? "use" : null };
      this.renderBag(content, { ...model, eventState: result.eventState });
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-machine-target]").forEach((button) =>
      button.addEventListener("click", () => {
        const pokemonId = button.dataset.sourceMachineTarget;
        const pokemon = model.eventState.party.members.find((member) => member.id === pokemonId);
        if (pokemon === undefined) return;
        this.selectedBagPokemonId = pokemon.id;
        this.selectedBagReplacementIndex = null;
        this.bagAction = pokemon.moves.length >= 4 ? "teach-replace" : "teach-confirm";
        this.renderBag(content, model);
      }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-machine-replace]").forEach((button) =>
      button.addEventListener("click", () => {
        const index = Number(button.dataset.sourceMachineReplace);
        if (!Number.isInteger(index)) return;
        this.selectedBagReplacementIndex = index;
        this.bagAction = "teach-confirm";
        this.renderBag(content, model);
      }));
    content.querySelector<HTMLButtonElement>("[data-source-machine-confirm]")?.addEventListener("click", () => {
      if (this.selectedBagItemId === null || this.selectedBagPokemonId === null) return;
      const itemId = this.selectedBagItemId;
      const result = this.callbacks.onTeachMachineMove(itemId, this.selectedBagPokemonId,
        this.selectedBagReplacementIndex ?? undefined);
      this.bagNotice = result.message;
      this.bagAction = null;
      this.bagResult = { message: result.message, itemId, repeatAction: null };
      this.renderBag(content, { ...model, eventState: result.eventState });
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-bag-give-target]").forEach((button) =>
      button.addEventListener("click", () => {
        if (this.selectedBagItemId === null || button.dataset.sourceBagGiveTarget === undefined) return;
        const itemId = this.selectedBagItemId;
        this.bagAction = null;
        const result = this.callbacks.onPokemonHeldItem(button.dataset.sourceBagGiveTarget, itemId);
        this.bagNotice = result.message;
        this.bagResult = { message: result.message, itemId, repeatAction: result.ok ? "give" : null };
        this.renderBag(content, { ...model, eventState: result.eventState });
      }));
    content.querySelector<HTMLButtonElement>("[data-source-bag-discard-confirm]")?.addEventListener("click", () => {
      if (this.selectedBagItemId === null) return;
      const result = this.callbacks.onDiscardItem(this.selectedBagItemId, this.discardQuantity);
      this.bagNotice = result.message;
      this.bagAction = null;
      this.bagResult = { message: result.message, itemId: this.selectedBagItemId, repeatAction: null };
      this.renderBag(content, { ...model, eventState: result.eventState });
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-bag-target]").forEach((button) => button.addEventListener("click", () => {
      if (this.selectedBagItemId === null || button.dataset.sourceBagTarget === undefined) return;
      if (this.selectedBagItemId === "RARECANDY") {
        this.selectedBagPokemonId = button.dataset.sourceBagTarget;
        this.rareCandyQuantity = 1;
        this.bagAction = "rare-candy-confirm";
        this.renderBag(content, model);
        return;
      }
      if (pokemonItemTargetMode(this.selectedBagItemId) === "move") {
        this.selectedBagPokemonId = button.dataset.sourceBagTarget;
        this.renderBag(content, model);
        return;
      }
      const result = this.callbacks.onUsePokemonItem(this.selectedBagItemId, button.dataset.sourceBagTarget);
      this.bagNotice = result.message;
      const usedItemId = this.selectedBagItemId;
      this.bagAction = null;
      this.selectedBagPokemonId = null;
      this.bagResult = { message: result.message, itemId: usedItemId, repeatAction: result.ok ? "use" : null };
      this.renderBag(content, { ...model, eventState: result.eventState });
    }));
    content.querySelector<HTMLButtonElement>("[data-source-rare-candy-confirm]")?.addEventListener("click", () => {
      if (this.selectedBagPokemonId === null) return;
      const result = this.callbacks.onUseRareCandy(this.selectedBagPokemonId, this.rareCandyQuantity);
      this.bagNotice = result.message;
      this.bagAction = null;
      this.selectedBagPokemonId = null;
      this.bagResult = { message: result.message, itemId: "RARECANDY", repeatAction: result.ok ? "use" : null };
      this.renderBag(content, { ...model, eventState: result.eventState });
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-bag-move]").forEach((button) =>
      button.addEventListener("click", () => {
        if (this.selectedBagItemId === null || this.selectedBagPokemonId === null) return;
        const moveIndex = Number(button.dataset.sourceBagMove);
        if (!Number.isInteger(moveIndex)) return;
        const result = this.callbacks.onUsePokemonItem(this.selectedBagItemId, this.selectedBagPokemonId, moveIndex);
        this.bagNotice = result.message;
        const usedItemId = this.selectedBagItemId;
        this.bagAction = null;
        this.selectedBagPokemonId = null;
        this.bagResult = { message: result.message, itemId: usedItemId, repeatAction: result.ok ? "use" : null };
        this.renderBag(content, { ...model, eventState: result.eventState });
      }));
    content.querySelector<HTMLButtonElement>("[data-source-bag-result-close]")?.addEventListener("click", () => {
      this.selectedBagItemId = null;
      this.selectedBagPokemonId = null;
      this.bagAction = null;
      this.bagResult = null;
      this.bagNotice = null;
      this.renderBag(content, model);
    });
    content.querySelector<HTMLButtonElement>("[data-source-bag-repeat]")?.addEventListener("click", (event) => {
      const action = (event.currentTarget as HTMLButtonElement).dataset.sourceBagRepeat;
      if (action !== "use" && action !== "give") return;
      this.selectedBagItemId = this.bagResult?.itemId ?? null;
      this.selectedBagPokemonId = null;
      this.bagAction = action === "use" && this.selectedBagItemId !== null
        && isPokemonPartyItemUsableInField(this.selectedBagItemId) ? "use-party-confirm" : action;
      this.bagResult = null;
      this.renderBag(content, model);
    });
  }

  private renderSave(content: HTMLElement, model: SourceMenuViewModel): void {
    const savedLabel = model.worldSave === null ? "Aucune position enregistrée"
      : `Map${String(model.worldSave.mapId).padStart(3, "0")} · ${model.worldSave.x},${model.worldSave.y} · ${new Date(model.worldSave.savedAt).toLocaleString("fr-FR")}`;
    const locationLabel = model.personalProgressSaveOnly ? "POSITION COOP TEMPORAIRE" : "POSITION ACTUELLE";
    const saveHelp = model.personalProgressSaveOnly
      ? "L'équipe, le Sac et vos états personnels sont sauvegardés. Votre position de reprise personnelle reste inchangée."
      : "La position, l'équipe, le Sac et la progression narrative sont enregistrés ensemble.";
    const actionLabel = model.personalProgressSaveOnly ? "Sauvegarder ma progression" : "Sauvegarder ici";
    content.innerHTML = `<div class="source-menu-title"><div><small>PROGRESSION</small><h3>Sauvegarde</h3></div><span>${model.worldSave === null ? "VIDE" : "MANUELLE"}</span></div><div class="source-save-card"><div class="source-save-location"><small>${locationLabel}</small><strong>${escapeSourceHtml(model.assets.map.name)}</strong><span>${model.avatar.x}, ${model.avatar.y} · direction ${model.avatar.direction}</span></div><div class="source-save-status"><i></i><div><strong>${escapeSourceHtml(savedLabel)}</strong><small>${saveHelp}</small></div></div><div class="source-save-actions"><button id="save-source-world">${actionLabel}</button>${model.worldSave === null ? "" : '<button id="delete-source-world" class="danger">Effacer la position</button>'}</div></div>`;
    content.querySelector<HTMLButtonElement>("#save-source-world")?.addEventListener("click", this.callbacks.onSave);
    content.querySelector<HTMLButtonElement>("#delete-source-world")?.addEventListener("click", this.callbacks.onDeleteSave);
  }

  private renderOptions(content: HTMLElement, model: SourceMenuViewModel): void {
    const settings = sourceAudioSettings(this.storage);
    const control = (channel: SourceAudioChannel, title: string, description: string, value: number): string =>
      `<label><span><strong>${title}</strong><small>${description}</small></span><output data-audio-output="${channel}">${value}%</output><input data-audio-channel="${channel}" type="range" min="0" max="100" value="${value}"></label>`;
    const shortcut = (id: SourceFieldShortcutId, title: string, description: string, iconUrl: string,
      available: boolean): string => {
      const selected = model.fieldShortcuts.includes(id);
      return `<button type="button" class="source-shortcut-option${selected ? " selected" : ""}" data-source-field-shortcut="${id}" aria-pressed="${selected}"${available || selected ? "" : " disabled"}><img src="${iconUrl}" alt=""><span><strong>${title}</strong><small>${available ? description : "Fonction non débloquée"}</small></span><b>${selected ? "ACTIF" : "AJOUTER"}</b></button>`;
    };
    const truthItem = model.assets.items.get("LENSOFTRUTH");
    const rod = model.eventState.preferredFishingRod
      ?? (["SUPERROD", "GOODROD", "OLDROD"] as const).find((id) => (model.eventState.inventory[id] ?? 0) > 0);
    const rodItem = rod === undefined ? undefined : model.assets.items.get(rod);
    const shortcuts = [
      shortcut("compass", "Boussole", "Afficher les Pokémon de la zone.",
        "/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/radar.png",
        (model.eventState.inventory.DEXNAV ?? 0) > 0),
      shortcut("truth-lens", "Miroir de la Vérité", "Révéler les éléments cachés pendant 10 secondes.",
        sourceItemIconUrl(truthItem?.id ?? 0),
        (model.eventState.inventory.LENSOFTRUTH ?? 0) > 0),
      shortcut("fishing", "Pêche", "Utiliser la canne favorite face à l’eau.",
        sourceItemIconUrl(rodItem?.id ?? 0), rod !== undefined),
      shortcut("mount", "Chevroum", "Basculer rapidement entre la marche et la monture.",
        "/__pokemon-z/source/Graphics/Icons/icon673.png", model.movement.unlocks.mount),
    ].join("");
    content.innerHTML = `<div class="source-menu-title"><div><small>PRÉFÉRENCES</small><h3>Options</h3></div><span>LOCAL</span></div><div class="source-options-list">
      ${control("music", "Musiques", "Musiques de carte, de combat et jingles.", settings.music)}
      ${control("effects", "Effets", "Pas, dialogues, capacités, cris et effets locaux.", settings.effects)}
      ${control("coopEffects", "Effets Coop", "Sons produits par l’autre joueur sur la carte partagée.", settings.coopEffects)}
      <article class="source-shortcut-options"><strong>Raccourcis de terrain</strong><small>Les boutons choisis apparaissent en haut à droite du canvas, après la Boussole.</small><div>${shortcuts}</div></article>
      <article><strong>Commandes</strong><small>Flèches ou ZQSD : déplacement · Espace/Entrée : interaction · Échap/M : menu</small></article></div>`;
    content.querySelectorAll<HTMLInputElement>("[data-audio-channel]").forEach((input) => {
      input.addEventListener("input", () => {
        const channel = input.dataset.audioChannel as SourceAudioChannel;
        const value = persistSourceAudioChannel(this.storage, channel, Number(input.value));
        const output = content.querySelector<HTMLOutputElement>(`[data-audio-output="${channel}"]`);
        if (output !== null) output.value = `${value}%`;
        this.callbacks.onAudioSettingsChange(sourceAudioSettings(this.storage));
      });
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-field-shortcut]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.sourceFieldShortcut as SourceFieldShortcutId;
        this.callbacks.onFieldShortcut(id, button.getAttribute("aria-pressed") !== "true");
      });
    });
  }

  private renderDevPokemonPicker(content: HTMLElement, model: SourceMenuViewModel): void {
    const results = content.querySelector<HTMLElement>("#source-dev-pokemon-results");
    if (results === null) return;
    const entries = createSourceDevPokemonEntries(model.assets.battleCatalog, model.assets.pokemonAssets);
    if (this.selectedDevPokemonId !== null
      && !entries.some((entry) => entry.species === this.selectedDevPokemonId)) this.selectedDevPokemonId = null;
    const filtered = filterSourceDevPokemonEntries(entries,
      { query: this.devPokemonQuery, type: this.devPokemonType, sort: this.devPokemonSort });
    const pages = Math.max(1, Math.ceil(filtered.length / SOURCE_DEV_POKEMON_PAGE_SIZE));
    this.devPokemonPage = Math.max(0, Math.min(this.devPokemonPage, pages - 1));
    const visible = filtered.slice(this.devPokemonPage * SOURCE_DEV_POKEMON_PAGE_SIZE,
      (this.devPokemonPage + 1) * SOURCE_DEV_POKEMON_PAGE_SIZE);
    const selected = entries.find((entry) => entry.species === this.selectedDevPokemonId) ?? null;
    const gender = content.querySelector<HTMLSelectElement>("#source-dev-pokemon-gender");
    if (gender !== null) {
      const options = selected === null ? [] : sourceDevPokemonGenderOptions(selected.genderRate);
      if (!options.some((option) => option.value === this.devPokemonGender)) {
        this.devPokemonGender = options[0]?.value ?? "auto";
      }
      gender.innerHTML = options.length === 0
        ? '<option value="auto">Choisissez une espèce</option>'
        : options.map((option) => `<option value="${option.value}"${option.value === this.devPokemonGender ? " selected" : ""}>${escapeSourceHtml(option.label)}</option>`).join("");
      gender.disabled = selected === null || options.length === 1;
    }
    const typeBadges = (types: readonly string[]): string => types.map((type) =>
      `<span title="${escapeSourceHtml(sourcePokemonTypeLabel(type))}"><img src="${escapeSourceHtml(pokemonTypeIconUrl(type))}" alt="">${escapeSourceHtml(sourcePokemonTypeLabel(type))}</span>`).join("");
    const cards = visible.map((entry) => `<button type="button" class="source-dev-pokemon-card${entry.species === this.selectedDevPokemonId ? " selected" : ""}" data-dev-pokemon-species="${escapeSourceHtml(entry.species)}" aria-pressed="${entry.species === this.selectedDevPokemonId}">
      <span class="source-dev-pokemon-icon" style="background-image:url('${escapeSourceHtml(entry.iconUrl)}')" aria-hidden="true"></span>
      <span><small>N°${String(entry.number).padStart(4, "0")}</small><strong>${escapeSourceHtml(entry.name)}</strong><span class="source-dev-pokemon-types">${typeBadges(entry.types)}</span></span></button>`).join("");
    results.innerHTML = `<div class="source-dev-pokemon-result-head"><strong>${filtered.length.toLocaleString("fr-FR")} résultat${filtered.length > 1 ? "s" : ""}</strong><small>${selected === null ? "Choisissez une espèce" : `Sélection : ${escapeSourceHtml(selected.name)}`}</small></div>
      <div class="source-dev-pokemon-grid">${cards || '<div class="source-dev-pokemon-empty"><strong>Aucun Pokémon trouvé</strong><small>Modifiez le nom ou le type recherché.</small></div>'}</div>
      <div class="source-dev-pokemon-pages"><button type="button" data-dev-pokemon-page="previous"${this.devPokemonPage === 0 ? " disabled" : ""} aria-label="Page précédente">‹</button><span>Page ${this.devPokemonPage + 1} / ${pages}</span><button type="button" data-dev-pokemon-page="next"${this.devPokemonPage >= pages - 1 ? " disabled" : ""} aria-label="Page suivante">›</button></div>`;
    results.querySelectorAll<HTMLButtonElement>("[data-dev-pokemon-species]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedDevPokemonId = button.dataset.devPokemonSpecies ?? null;
        this.renderDevPokemonPicker(content, model);
      });
    });
    results.querySelectorAll<HTMLButtonElement>("[data-dev-pokemon-page]").forEach((button) => {
      button.addEventListener("click", () => {
        this.devPokemonPage += button.dataset.devPokemonPage === "next" ? 1 : -1;
        this.renderDevPokemonPicker(content, model);
      });
    });
    const grant = content.querySelector<HTMLButtonElement>("#source-dev-grant-pokemon");
    if (grant !== null) grant.disabled = selected === null;
  }

  private renderDevTools(content: HTMLElement, model: SourceMenuViewModel): void {
    const movement = model.movement;
    const capabilities = (["sprint", "mount", "climb", "surf", "dive", "waterfall", "fly"] as const)
      .map((capability: SourceMovementCapability) => `<li class="${movement.unlocks[capability] ? "ready" : "locked"}"><i></i><span><strong>${sourceMovementCapabilityLabel(capability)}</strong><small>${movement.unlocks[capability] ? "Disponible" : "Encore verrouillé par la progression"}</small></span></li>`).join("");
    const diveLabel = movement.canSurfaceHere ? "Remonter à la surface" : "Plonger";
    const pockets = SOURCE_BAG_POCKETS.map((pocket) => `<option value="${pocket.id}"${pocket.id === this.selectedDevPocket ? " selected" : ""}>${escapeSourceHtml(pocket.name)}</option>`).join("");
    const searchingItems = this.devItemQuery.trim().length > 0;
    const pocketItems = [...model.assets.items.values()].filter((item) => item.pocket === this.selectedDevPocket)
      .sort((left, right) => left.id - right.id);
    const visibleItems = (searchingItems ? [...model.assets.items.values()] : pocketItems)
      .filter((item) => !searchingItems || sourceBagEntryMatches({ item, quantity: 1 }, this.devItemQuery,
        item.machineMove === null || item.machineMove === undefined ? undefined
          : model.assets.battleCatalog.moves.find((move) => move.internalName === item.machineMove)?.name))
      .sort((left, right) => left.pocket - right.pocket || left.id - right.id);
    if (this.selectedDevItemId !== null && !visibleItems.some((item) => item.internalName === this.selectedDevItemId)) {
      this.selectedDevItemId = null;
    }
    const items = [searchingItems
      ? `<option value=""${this.selectedDevItemId === null ? " selected" : ""}>${visibleItems.length === 0 ? "Aucun objet trouvé" : "Choisir un résultat"}</option>`
      : `<option value=""${this.selectedDevItemId === null ? " selected" : ""}>Toute la catégorie</option>`,
      ...visibleItems.map((item) => `<option value="${escapeSourceHtml(item.internalName)}"${item.internalName === this.selectedDevItemId ? " selected" : ""}>${searchingItems ? `${escapeSourceHtml(SOURCE_BAG_POCKETS.find(({ id }) => id === item.pocket)?.name ?? `Poche ${item.pocket}`)} · ` : ""}${escapeSourceHtml(item.name)} · ${escapeSourceHtml(item.internalName)}</option>`)].join("");
    const quantities = [1, 5, 10, 50, 99, 999].map((quantity) =>
      `<option value="${quantity}"${quantity === this.devItemQuantity ? " selected" : ""}>${quantity}</option>`).join("");
    const levelCaps = [17, 27, 36, 42, 50, 56, 70, 75, 80, 85, 94, 100].map((level) =>
      `<option value="${level}"${model.dev.levelCapOverride === level ? " selected" : ""}>Niveau ${level}</option>`).join("");
    const devPokemonEntries = createSourceDevPokemonEntries(model.assets.battleCatalog, model.assets.pokemonAssets);
    const pokemonTypes = sourceDevPokemonTypes(devPokemonEntries).map((type) =>
      `<option value="${escapeSourceHtml(type)}"${type === this.devPokemonType ? " selected" : ""}>${escapeSourceHtml(sourcePokemonTypeLabel(type))}</option>`).join("");
    const pokemonLevels = Array.from({ length: 100 }, (_, index) => index + 1).map((level) =>
      `<option value="${level}"${level === this.devPokemonLevel ? " selected" : ""}>Niveau ${level}</option>`).join("");
    content.innerHTML = `<div class="source-menu-title"><div><small>OUTILS LOCAUX</small><h3>Test dev</h3></div><span>PERSONNEL</span></div><div class="source-dev-tools">
      <details data-dev-section="movement"${this.openDevSection === "movement" ? " open" : ""}><summary>Déplacements <small>${escapeSourceHtml(movement.mode.toUpperCase())}</small></summary><div class="source-dev-section"><div class="source-movement-actions"><button type="button" data-movement-mode="walk" class="${movement.mode === "walk" || movement.mode === "run" ? "active" : ""}">À pied<small>Maintenez Maj pour sprinter</small></button><button type="button" data-movement-mode="mount" class="${movement.mode === "mount" ? "active" : ""}"${movement.unlocks.mount ? "" : " disabled"}>Chevroum<small>Monture terrestre rapide</small></button><button type="button" id="source-movement-dive"${movement.canDiveHere || movement.canSurfaceHere ? "" : " disabled"}>${diveLabel}<small>Depuis une zone compatible</small></button></div><ul class="source-movement-capabilities">${capabilities}</ul><p class="source-movement-help">Surf : interaction face à l'eau. Corniches, glace, cascades et parois restent pilotées par le terrain source.</p></div></details>
      <details data-dev-section="unlocks"${this.openDevSection === "unlocks" ? " open" : ""}><summary>Déblocages <small>Cap effectif ${model.dev.effectiveLevelCap}</small></summary><div class="source-dev-section"><label class="source-movement-test"><span><strong>Tous les déplacements</strong><small>Ignore localement leurs prérequis sans modifier badges, objets ou histoire.</small></span><input id="source-movement-test" type="checkbox"${movement.unlocks.testOverride ? " checked" : ""}></label><label class="source-dev-field"><span>Cap de niveau</span><select id="source-dev-level-cap"><option value=""${model.dev.levelCapOverride === null ? " selected" : ""}>Progression normale · ${model.dev.storyLevelCap}</option>${levelCaps}</select><small>Le cap simulé sert aux Bonbons Rares et aux combats ouverts par ce navigateur.</small></label></div></details>
      <details data-dev-section="bag"${this.openDevSection === "bag" ? " open" : ""}><summary>Gestion du Sac <small>Par catégorie</small></summary><div class="source-dev-section source-dev-form"><label class="source-dev-item-search"><span>Rechercher dans tous les objets</span><div><input id="source-dev-item-query" type="search" value="${escapeSourceHtml(this.devItemQuery)}" placeholder="Nom, effet, identifiant, CT/CS…" autocomplete="off" spellcheck="false"><button type="button" id="source-dev-item-query-clear"${searchingItems ? "" : " disabled"}>Effacer</button></div><small>${searchingItems ? `${visibleItems.length} résultat${visibleItems.length > 1 ? "s" : ""} dans toutes les catégories` : "Saisissez un nom pour ignorer temporairement la catégorie."}</small></label><label><span>Catégorie</span><select id="source-dev-pocket">${pockets}</select></label><label><span>Objet</span><select id="source-dev-item">${items}</select></label><label><span>Quantité à ajouter</span><select id="source-dev-item-quantity">${quantities}</select></label><div class="source-dev-buttons"><button type="button" id="source-dev-grant-items"${searchingItems && this.selectedDevItemId === null ? " disabled" : ""}>Ajouter au Sac</button><button type="button" id="source-dev-reset-pocket" class="danger">Vider cette catégorie</button></div><small>Le vidage supprime uniquement les objets de la catégorie choisie dans cette sauvegarde.</small></div></details>
      <details data-dev-section="pokemon"${this.openDevSection === "pokemon" ? " open" : ""}><summary>Donner un Pokémon <small>Équipe ou Ranch</small></summary><div class="source-dev-section source-dev-form source-dev-pokemon-picker"><div class="source-dev-pokemon-filters"><label class="source-dev-pokemon-search"><span>Rechercher</span><input id="source-dev-pokemon-query" type="search" value="${escapeSourceHtml(this.devPokemonQuery)}" placeholder="Nom français, numéro…" autocomplete="off"></label><label><span>Type</span><select id="source-dev-pokemon-type"><option value="">Tous les types</option>${pokemonTypes}</select></label><label><span>Classement</span><select id="source-dev-pokemon-sort"><option value="number"${this.devPokemonSort === "number" ? " selected" : ""}>Numéro du Pokédex</option><option value="name"${this.devPokemonSort === "name" ? " selected" : ""}>Nom alphabétique</option></select></label><button type="button" id="source-dev-pokemon-reset">Réinitialiser</button></div><div id="source-dev-pokemon-results" aria-live="polite"></div><div class="source-dev-pokemon-grant"><label><span>Niveau</span><select id="source-dev-pokemon-level">${pokemonLevels}</select></label><label><span>Genre</span><select id="source-dev-pokemon-gender" disabled><option value="auto">Choisissez une espèce</option></select></label><button type="button" id="source-dev-grant-pokemon">Ajouter le Pokémon sélectionné</button></div><small>Le genre proposé respecte l'espèce. Le Pokémon rejoint l'équipe si une place est libre, sinon le Ranch.</small></div></details>
      <details data-dev-section="services"${this.openDevSection === "services" ? " open" : ""}><summary>Services Pokémon <small>Interfaces en développement</small></summary><div class="source-dev-section"><div class="source-dev-buttons"><button type="button" id="source-dev-teleport-day-care">TP devant la Pension</button><button type="button" id="source-dev-open-day-care">Ouvrir l’interface</button><button type="button" class="wide" id="source-dev-accelerate-eggs">Ramener les Œufs à 5 pas</button></div><small>Le TP rejoint la Route 5 sans modifier l’histoire. L’accès direct et l’accélération concernent seulement les données personnelles de test.</small></div></details>
      <details data-dev-section="narrative-battles"${this.openDevSection === "narrative-battles" ? " open" : ""}><summary>Combats narratifs <small>Parcours P0</small></summary><div class="source-dev-section"><div class="source-dev-buttons"><button type="button" id="source-dev-teleport-double-join">TP duo Hector et Zaida</button><button type="button" id="source-dev-teleport-furfrou-nest">TP nid de Couafarel</button><button type="button" id="source-dev-teleport-insect-nest">TP nid insecte</button></div><small>Le test Coop place le joueur devant Hector et Zaida sur la Route 4. Ce duo de deux PNJ déclenche nativement un combat double ; si l’invité rejoint l’hôte, il prend le second poste allié. Ces raccourcis ne modifient aucun switch ni self-switch.</small></div></details>
      <details data-dev-section="minigames"${this.openDevSection === "minigames" ? " open" : ""}><summary>Mini-jeux <small>Fouilles</small></summary><div class="source-dev-section"><div class="source-dev-buttons"><button type="button" class="wide" id="source-dev-open-mining">Tester les fouilles</button></div><small>Lance une paroi neuve avec le marteau et le burin. Les trésors dégagés rejoignent réellement le Sac de cette sauvegarde.</small></div></details>
      </div>`;
    content.querySelectorAll<HTMLDetailsElement>("[data-dev-section]").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (details.open) this.openDevSection = details.dataset.devSection as typeof this.openDevSection;
      });
    });
    content.querySelectorAll<HTMLButtonElement>("[data-movement-mode]").forEach((button) => button.addEventListener("click", () => {
      const mode = button.dataset.movementMode;
      if (mode === "walk" || mode === "mount") this.callbacks.onMovementMode(mode);
    }));
    content.querySelector<HTMLInputElement>("#source-movement-test")?.addEventListener("change", (event) => {
      this.callbacks.onMovementTestOverride((event.currentTarget as HTMLInputElement).checked);
    });
    content.querySelector<HTMLButtonElement>("#source-movement-dive")?.addEventListener("click", this.callbacks.onDive);
    content.querySelector<HTMLSelectElement>("#source-dev-level-cap")?.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      this.callbacks.onDevLevelCap(value === "" ? null : Number(value));
    });
    content.querySelector<HTMLSelectElement>("#source-dev-pocket")?.addEventListener("change", (event) => {
      this.selectedDevPocket = Number((event.currentTarget as HTMLSelectElement).value);
      this.selectedDevItemId = null;
      this.devItemQuery = "";
      this.openDevSection = "bag";
      this.renderDevTools(content, model);
    });
    content.querySelector<HTMLSelectElement>("#source-dev-item")?.addEventListener("change", (event) => {
      this.selectedDevItemId = (event.currentTarget as HTMLSelectElement).value || null;
      const selectedItem = this.selectedDevItemId === null ? undefined : model.assets.items.get(this.selectedDevItemId);
      if (selectedItem !== undefined && selectedItem.pocket !== this.selectedDevPocket) {
        this.selectedDevPocket = selectedItem.pocket;
        this.openDevSection = "bag";
        this.renderDevTools(content, model);
      }
    });
    const devItemQuery = content.querySelector<HTMLInputElement>("#source-dev-item-query");
    devItemQuery?.addEventListener("input", () => {
      this.devItemQuery = devItemQuery.value;
      this.openDevSection = "bag";
      this.renderDevTools(content, model);
      const next = content.querySelector<HTMLInputElement>("#source-dev-item-query");
      next?.focus();
      next?.setSelectionRange(this.devItemQuery.length, this.devItemQuery.length);
    });
    content.querySelector<HTMLButtonElement>("#source-dev-item-query-clear")?.addEventListener("click", () => {
      this.devItemQuery = "";
      this.selectedDevItemId = null;
      this.openDevSection = "bag";
      this.renderDevTools(content, model);
      content.querySelector<HTMLInputElement>("#source-dev-item-query")?.focus();
    });
    content.querySelector<HTMLSelectElement>("#source-dev-item-quantity")?.addEventListener("change", (event) => {
      this.devItemQuantity = Number((event.currentTarget as HTMLSelectElement).value);
    });
    content.querySelector<HTMLButtonElement>("#source-dev-grant-items")?.addEventListener("click", () => {
      this.callbacks.onGrantTestItems(this.selectedDevPocket, this.selectedDevItemId, this.devItemQuantity);
    });
    content.querySelector<HTMLButtonElement>("#source-dev-reset-pocket")?.addEventListener("click", () => {
      if (window.confirm("Vider tous les objets de cette catégorie ?")) this.callbacks.onResetTestItemPocket(this.selectedDevPocket);
    });
    const pokemonQuery = content.querySelector<HTMLInputElement>("#source-dev-pokemon-query");
    pokemonQuery?.addEventListener("input", () => {
      this.devPokemonQuery = pokemonQuery.value;
      this.devPokemonPage = 0;
      this.renderDevPokemonPicker(content, model);
    });
    content.querySelector<HTMLSelectElement>("#source-dev-pokemon-type")?.addEventListener("change", (event) => {
      this.devPokemonType = (event.currentTarget as HTMLSelectElement).value || null;
      this.devPokemonPage = 0;
      this.renderDevPokemonPicker(content, model);
    });
    content.querySelector<HTMLSelectElement>("#source-dev-pokemon-sort")?.addEventListener("change", (event) => {
      this.devPokemonSort = (event.currentTarget as HTMLSelectElement).value === "name" ? "name" : "number";
      this.devPokemonPage = 0;
      this.renderDevPokemonPicker(content, model);
    });
    content.querySelector<HTMLButtonElement>("#source-dev-pokemon-reset")?.addEventListener("click", () => {
      this.devPokemonQuery = "";
      this.devPokemonType = null;
      this.devPokemonSort = "number";
      this.devPokemonPage = 0;
      if (pokemonQuery !== null) pokemonQuery.value = "";
      const type = content.querySelector<HTMLSelectElement>("#source-dev-pokemon-type");
      const sort = content.querySelector<HTMLSelectElement>("#source-dev-pokemon-sort");
      if (type !== null) type.value = "";
      if (sort !== null) sort.value = "number";
      this.renderDevPokemonPicker(content, model);
    });
    content.querySelector<HTMLSelectElement>("#source-dev-pokemon-level")?.addEventListener("change", (event) => {
      this.devPokemonLevel = Number((event.currentTarget as HTMLSelectElement).value);
    });
    content.querySelector<HTMLSelectElement>("#source-dev-pokemon-gender")?.addEventListener("change", (event) => {
      this.devPokemonGender = (event.currentTarget as HTMLSelectElement).value as SourceDevPokemonGender;
    });
    content.querySelector<HTMLButtonElement>("#source-dev-grant-pokemon")?.addEventListener("click", () => {
      if (this.selectedDevPokemonId !== null) this.callbacks.onGrantTestPokemon(this.selectedDevPokemonId,
        this.devPokemonLevel, this.devPokemonGender);
    });
    content.querySelector<HTMLButtonElement>("#source-dev-open-day-care")?.addEventListener("click",
      this.callbacks.onOpenTestDayCare);
    content.querySelector<HTMLButtonElement>("#source-dev-teleport-day-care")?.addEventListener("click",
      this.callbacks.onTeleportToTestDayCare);
    content.querySelector<HTMLButtonElement>("#source-dev-teleport-double-join")?.addEventListener("click",
      this.callbacks.onTeleportToTestDoubleJoin);
    content.querySelector<HTMLButtonElement>("#source-dev-teleport-furfrou-nest")?.addEventListener("click",
      this.callbacks.onTeleportToTestFurfrouNest);
    content.querySelector<HTMLButtonElement>("#source-dev-teleport-insect-nest")?.addEventListener("click",
      this.callbacks.onTeleportToTestInsectNest);
    content.querySelector<HTMLButtonElement>("#source-dev-accelerate-eggs")?.addEventListener("click",
      this.callbacks.onAccelerateTestEggs);
    content.querySelector<HTMLButtonElement>("#source-dev-open-mining")?.addEventListener("click",
      this.callbacks.onOpenTestMining);
    this.renderDevPokemonPicker(content, model);
  }

  private renderCoop(content: HTMLElement, coop: SourceMenuCoopModel): void {
    const players = coop.players.map((player) => `<article class="source-coop-player"><i class="${player.connected ? "online" : ""}"></i><span><strong>${escapeSourceHtml(player.name)}</strong><small>${player.side === "player" ? "HÔTE" : "INVITÉ"}</small></span><em>${player.connectionState === "connected" ? "Connecté" : player.connectionState === "reconnecting" ? "Reconnexion…" : "Parti"}</em></article>`).join("");
    content.innerHTML = `<div class="source-menu-title"><div><small>AVENTURE PARTAGÉE</small><h3>Coopération</h3></div><span>${escapeSourceHtml(coop.state)}</span></div>
      <div class="source-coop-profile"><div><small>PROFIL PUBLIÉ</small><strong>${escapeSourceHtml(coop.profileName)}</strong></div><button type="button" id="source-coop-profile">Personnaliser</button></div>
      ${coop.active
        ? `<div class="source-coop-room"><small>CODE D'INVITATION</small><strong>${escapeSourceHtml(coop.roomCode)}</strong><p>${escapeSourceHtml(coop.notice)}</p></div><div class="source-coop-players">${players}</div><button type="button" id="source-coop-disconnect" class="danger">Quitter la partie coop</button>`
        : `<div class="source-coop-connect"><label><span>Serveur</span><input id="source-coop-server" value="${escapeSourceHtml(coop.serverUrl)}" spellcheck="false"></label><button type="button" id="source-coop-create">Créer une partie</button><div class="source-coop-join"><input id="source-coop-code" maxlength="6" value="${escapeSourceHtml(coop.roomCode)}" placeholder="CODE" aria-label="Code d'invitation"><button type="button" id="source-coop-join">Rejoindre</button></div><p>${escapeSourceHtml(coop.notice)}</p></div>`}`;
    content.querySelector<HTMLButtonElement>("#source-coop-profile")?.addEventListener("click", this.callbacks.onEditProfile);
    content.querySelector<HTMLButtonElement>("#source-coop-disconnect")?.addEventListener("click", this.callbacks.onDisconnectRoom);
    const server = content.querySelector<HTMLInputElement>("#source-coop-server");
    const code = content.querySelector<HTMLInputElement>("#source-coop-code");
    code?.addEventListener("input", () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/gu, ""); });
    content.querySelector<HTMLButtonElement>("#source-coop-create")?.addEventListener("click", () => {
      if (server !== null) this.callbacks.onCreateRoom(server.value);
    });
    content.querySelector<HTMLButtonElement>("#source-coop-join")?.addEventListener("click", () => {
      if (server !== null && code !== null) this.callbacks.onJoinRoom(server.value, code.value);
    });
  }
}

function sourcePauseMenuIconUrl(name: string): string {
  return `/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/${encodeURIComponent(name)}.png`;
}

export interface SourceShopViewModel {
  readonly stock: readonly SourceShopItem[];
  readonly notice: string | null;
}

export interface SourceShopViewCallbacks {
  readonly onBuy: (itemId: string) => void;
  readonly onClose: () => void;
}

export class SourceShopView {
  public constructor(private readonly callbacks: SourceShopViewCallbacks) {}

  public render(shop: SourceShopViewModel | null, eventState: SourceEventState): void {
    const panel = document.querySelector<HTMLElement>("#source-shop");
    if (panel === null) return;
    panel.hidden = shop === null;
    if (shop === null) { panel.innerHTML = ""; return; }
    panel.innerHTML = `<header><div><small>BOUTIQUE POKÉMON</small><strong>Que désirez-vous ?</strong></div><span>${eventState.money.toLocaleString("fr-FR")} ₽</span></header>
      <div class="source-shop-list">${shop.stock.map((item) => {
        const owned = eventState.inventory[item.internalName] ?? 0;
        return `<button type="button" data-shop-item="${escapeSourceHtml(item.internalName)}"${item.price > eventState.money || owned >= 999 ? " disabled" : ""}>
          <img src="${sourceItemIconUrl(item.id)}" data-source-item-icon alt=""><span><strong>${escapeSourceHtml(item.name)}</strong><small>${escapeSourceHtml(item.description)}</small></span><em>${item.price.toLocaleString("fr-FR")} ₽<small>Possédé : ${owned}</small></em></button>`;
      }).join("")}</div><footer><span>${escapeSourceHtml(shop.notice ?? "Sélectionnez un objet pour en acheter un exemplaire.")}</span><button type="button" id="close-source-shop">Quitter</button></footer>`;
    bindSourceItemIconFallback(panel);
    panel.querySelectorAll<HTMLButtonElement>("[data-shop-item]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.shopItem !== undefined) this.callbacks.onBuy(button.dataset.shopItem);
    }));
    panel.querySelector<HTMLButtonElement>("#close-source-shop")?.addEventListener("click", this.callbacks.onClose);
  }
}
