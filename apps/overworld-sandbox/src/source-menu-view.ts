import type { ImportedAvatar, ImportedMapAssets } from "./imported-map.js";
import { SOURCE_BAG_PAGE_SIZE, SOURCE_BAG_POCKETS, sourceBagEntries, sourceBagFamilyEntries, sourceBagNodes,
  sourceBagPage, sourceBagPocketCounts, sourceBagSubfamily, sourceItemIconUrl,
  sourceItemIconFallbackUrl, sourcePocketIconUrl } from "./source-bag.js";
import { sourceBagGridHtml, sourceBagPaginationHtml } from "./source-bag-grid.js";
import type { SourceEventState } from "./source-event-state.js";
import type { SourceMenuTab } from "./source-scene-coordinator.js";
import type { SourceShopItem } from "./source-economy.js";
import type { SourceWorldSave } from "./source-world-save.js";
import type { PlayerConnectionState, SourceMovementMode } from "@pokemon-z-battle/multiplayer-protocol";
import { sourceMovementCapabilityLabel, type SourceMovementCapability,
  type SourceMovementUnlocks } from "./source-player-movement.js";
import { createSourcePokemonCollection } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml, sourcePokemonIconHtml } from "./source-pokemon-card-view.js";
import { sourcePokemonActions, sourcePokemonActionWheelHtml } from "./source-pokemon-actions.js";
import { isPokemonPartyItemUsableInField, pokemonItemTargetMode } from "@pokemon-z-battle/player-state";
import { bindSourceHeldItemIconFallback, canManageSourceHeldItem, sourceHeldItemManagerHtml }
  from "./source-held-item-view.js";
import { sourceActionWheelHtml } from "./source-action-wheel.js";
import { sourceItemActions, sourceItemDisplayName } from "./source-item-actions.js";

const SOURCE_VOLUME_KEY = "pokemon-z-battle.options.volume.v1";

export function escapeSourceHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function sourceMenuVolume(storage: Pick<Storage, "getItem">): number {
  const stored = Number(storage.getItem(SOURCE_VOLUME_KEY) ?? 80);
  return Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 80;
}

export function sourceQuantitySelectorHtml(label: string, value: number, maximum: number): string {
  const max = Math.max(1, Math.floor(maximum));
  const current = Math.max(1, Math.min(max, Math.floor(value)));
  const button = (delta: number, text: string): string => `<button type="button" data-source-quantity-delta="${delta}"${current + delta < 1 || current + delta > max ? " disabled" : ""} aria-label="${delta > 0 ? "Ajouter" : "Retirer"} ${Math.abs(delta)}">${text}</button>`;
  return `<div class="source-quantity-picker" role="group" aria-label="${escapeSourceHtml(label)}"><span>${escapeSourceHtml(label)}</span><div>${button(-10, "−10")}${button(-1, "−")}<output aria-live="polite" data-source-quantity-value>${current}</output>${button(1, "+")}${button(10, "+10")}</div><button type="button" data-source-quantity-max${current === max ? " disabled" : ""}>Max · ${max}</button></div>`;
}

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
  readonly coop: SourceMenuCoopModel;
  readonly movement: SourceMenuMovementModel;
  readonly dev: SourceMenuDevModel;
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
}

export interface SourceMenuCoopModel {
  readonly active: boolean;
  readonly state: string;
  readonly notice: string;
  readonly serverUrl: string;
  readonly roomCode: string;
  readonly profileName: string;
  readonly players: readonly { readonly side: "player" | "opponent"; readonly name: string;
    readonly connected: boolean; readonly connectionState: PlayerConnectionState }[];
}

export interface SourceMenuViewCallbacks {
  readonly onSave: () => void;
  readonly onDeleteSave: () => void;
  readonly onVolumeChange: (volume: number) => void;
  readonly onCreateRoom: (serverUrl: string) => void;
  readonly onJoinRoom: (serverUrl: string, roomCode: string) => void;
  readonly onDisconnectRoom: () => void;
  readonly onEditProfile: () => void;
  readonly onMovementMode: (mode: "walk" | "mount") => void;
  readonly onMovementTestOverride: (enabled: boolean) => void;
  readonly onGrantTestItems: (pocket: number, itemId: string | null, quantity: number) => void;
  readonly onResetTestItemPocket: (pocket: number) => void;
  readonly onDevLevelCap: (levelCap: number | null) => void;
  readonly onGrantTestPokemon: (species: string, level: number) => void;
  readonly onDive: () => void;
  readonly onPokemonLead: (pokemonId: string) => void;
  readonly onPokemonDetails: (pokemonId: string) => void;
  readonly onPokemonHeldItem: (pokemonId: string, itemId: string | null) => {
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
}

export class SourceMenuView {
  private selectedPocket = 1;
  private selectedTeamPokemonId: string | null = null;
  private selectedBagItemId: string | null = null;
  private selectedBagFamilyId: string | null = null;
  private bagPage = 0;
  private selectedBagPokemonId: string | null = null;
  private bagAction: "wheel" | "use" | "use-party-confirm" | "rare-candy-confirm" | "give" | "discard" | "teach" | "teach-replace" | "teach-confirm" | null = null;
  private discardQuantity = 1;
  private rareCandyQuantity = 1;
  private selectedBagReplacementIndex: number | null = null;
  private bagResult: { readonly message: string; readonly itemId: string; readonly repeatAction: "use" | "give" | null } | null = null;
  private heldItemPokemonId: string | null = null;
  private bagNotice: string | null = null;
  private selectedDevPocket = 2;
  private selectedDevItemId: string | null = null;
  private openDevSection: "movement" | "unlocks" | "bag" | "pokemon" = "movement";

  public constructor(private readonly storage: Storage, private readonly callbacks: SourceMenuViewCallbacks) {}

  public render(model: SourceMenuViewModel): void {
    const menu = document.querySelector<HTMLElement>("#source-menu");
    const content = document.querySelector<HTMLElement>("#source-menu-content");
    if (menu === null || content === null) return;
    menu.hidden = !model.open;
    if (!model.open) return;
    content.classList.toggle("source-menu-content-bag", model.tab === "bag");
    const header = model.tab === "team"
      ? { context: "COMPAGNONS", title: "Équipe Pokémon", meta: `${model.eventState.party.members.length}/6` }
      : model.tab === "movement"
        ? { context: "OUTILS LOCAUX", title: "Test dev", meta: "PERSONNEL" }
        : model.tab === "save"
          ? { context: "PROGRESSION", title: "Sauvegarde", meta: model.worldSave === null ? "VIDE" : "MANUELLE" }
          : model.tab === "coop"
            ? { context: "AVENTURE PARTAGÉE", title: "Coopération", meta: model.coop.state }
            : model.tab === "options"
              ? { context: "PRÉFÉRENCES", title: "Options", meta: "LOCAL" }
              : { context: "SAC", title: "Inventaire", meta: `${model.eventState.money.toLocaleString("fr-FR")} ₽` };
    this.setMenuHeader(header.context, header.title, header.meta);
    document.querySelectorAll<HTMLButtonElement>("[data-source-menu-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.sourceMenuTab === model.tab);
    });
    if (model.tab === "team") this.renderTeam(content, model);
    else if (model.tab === "bag") this.renderBag(content, model);
    else if (model.tab === "movement") this.renderDevTools(content, model);
    else if (model.tab === "save") this.renderSave(content, model);
    else if (model.tab === "coop") this.renderCoop(content, model.coop);
    else this.renderOptions(content);
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
    const wheel = selected === null ? "" : sourcePokemonActionWheelHtml(selected,
      sourcePokemonActions("team", selected, { partySize: members.length, partyFull: members.length >= 6,
        activePokemonId, heldItemManagementAvailable: canManageSourceHeldItem(model.eventState.inventory,
          selected.pokemon.heldItem) }));
    const heldItemPanel = heldItemTarget === null ? "" : sourceHeldItemManagerHtml(heldItemTarget.displayName,
      heldItemTarget.pokemon.heldItem, model.eventState.inventory, model.assets.items);
    const occupiedSlots = entries.map((entry) => sourcePokemonCardHtml(entry, {
      active: entry.teamIndex === model.eventState.party.activeIndex,
      selected: entry.pokemon.id === this.selectedTeamPokemonId,
    })).join("");
    const emptySlots = Array.from({ length: Math.max(0, 6 - entries.length) }, (_, index) =>
      `<article class="source-team-empty-slot" aria-label="Emplacement ${entries.length + index + 1} libre"><span>${entries.length + index + 1}</span><img src="/__pokemon-z/source/Graphics/Pictures/partyBall.PNG" alt=""><strong>Emplacement libre</strong></article>`).join("");
    content.innerHTML = `<div class="source-menu-title"><div><small>COMPAGNONS</small><h3>Équipe Pokémon</h3></div><span>${members.length}/6</span></div><div class="source-team-grid">${occupiedSlots}${emptySlots}</div>${this.bagNotice === null ? "" : `<p class="source-bag-notice">${escapeSourceHtml(this.bagNotice)}</p>`}${wheel}${heldItemPanel}`;
    bindSourceHeldItemIconFallback(content);
    content.querySelectorAll<HTMLButtonElement>(".source-team-grid [data-pokemon-id]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedTeamPokemonId = button.dataset.pokemonId ?? null;
        this.renderTeam(content, model);
      });
    });
    content.querySelector<HTMLButtonElement>("[data-source-wheel-close]")?.addEventListener("click", () => {
      this.selectedTeamPokemonId = null;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLElement>("[data-source-wheel-dismiss]")?.addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      this.selectedTeamPokemonId = null;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLButtonElement>('[data-source-wheel-action="make-lead"]')?.addEventListener("click", () => {
      if (selected !== null) this.callbacks.onPokemonLead(selected.pokemon.id);
    });
    content.querySelector<HTMLButtonElement>('[data-source-wheel-action="details"]')?.addEventListener("click", () => {
      if (selected !== null) this.callbacks.onPokemonDetails(selected.pokemon.id);
    });
    content.querySelector<HTMLButtonElement>('[data-source-wheel-action="give-item"]')?.addEventListener("click", () => {
      if (selected === null) return;
      this.heldItemPokemonId = selected.pokemon.id;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLButtonElement>("[data-held-item-close]")?.addEventListener("click", () => {
      this.heldItemPokemonId = null;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLButtonElement>("[data-held-item-remove]")?.addEventListener("click", () => {
      if (heldItemTarget === null) return;
      this.heldItemPokemonId = null;
      this.callbacks.onPokemonHeldItem(heldItemTarget.pokemon.id, null);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-held-item-equip]").forEach((button) =>
      button.addEventListener("click", () => {
        if (heldItemTarget === null || button.dataset.heldItemEquip === undefined) return;
        this.heldItemPokemonId = null;
        this.callbacks.onPokemonHeldItem(heldItemTarget.pokemon.id, button.dataset.heldItemEquip);
      }));
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
    const entries = sourceBagEntries(model.eventState.inventory, model.assets.items, this.selectedPocket);
    let familyEntries = this.selectedBagFamilyId === null ? []
      : sourceBagFamilyEntries(entries, this.selectedBagFamilyId);
    if (this.selectedBagFamilyId !== null && familyEntries.length === 0) {
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
      familyEntries = [];
    }
    const visibleNodes = this.selectedBagFamilyId === null ? sourceBagNodes(entries)
      : familyEntries.map((entry) => ({ kind: "item" as const, entry }));
    const pageSize = window.matchMedia("(max-width: 430px)").matches ? 4 : SOURCE_BAG_PAGE_SIZE;
    const pagedNodes = sourceBagPage(visibleNodes, this.bagPage, pageSize);
    this.bagPage = pagedNodes.page;
    const selectedFamily = familyEntries[0] === undefined ? null : sourceBagSubfamily(familyEntries[0].item);
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
    const actionWheel = selectedEntry === null || this.bagAction !== "wheel" ? ""
      : sourceActionWheelHtml({ label: `Actions pour ${selectedItemDisplayName}`,
        centerHtml: `<img src="${sourceItemIconUrl(selectedEntry.item.id)}" data-source-item-icon alt=""><strong>${escapeSourceHtml(selectedItemDisplayName!)}</strong>`,
        actions: sourceItemActions(selectedEntry.item, { quantity: selectedEntry.quantity,
          machineCompatibilityAvailable: machineSpecies !== undefined }) });
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
      ? `<div class="source-menu-empty"><img src="${sourcePocketIconUrl(pocket.id)}" alt=""><strong>Poche vide</strong><small>Aucun objet dans la catégorie ${escapeSourceHtml(pocket.name)}.</small></div>`
      : sourceBagGridHtml(pagedNodes.entries, { itemAttribute: "data-source-bag-item",
        familyAttribute: "data-source-bag-family", selectedItemId: this.selectedBagItemId,
        displayName: ({ item }) => { const moveName = item.machineMove === null || item.machineMove === undefined
          ? undefined : model.assets.battleCatalog.moves.find((move) => move.internalName === item.machineMove)?.name;
        return sourceItemDisplayName(item, moveName); } });
    this.setMenuHeader("SAC", selectedFamily?.name ?? pocket.name,
      `${model.eventState.money.toLocaleString("fr-FR")} ₽`);
    content.innerHTML = `<nav class="source-bag-pockets" aria-label="Poches du Sac">${SOURCE_BAG_POCKETS.map((candidate) =>
        `<button type="button" data-source-pocket="${candidate.id}" class="${candidate.id === this.selectedPocket ? "active" : ""}" title="${escapeSourceHtml(candidate.name)}"><img src="${sourcePocketIconUrl(candidate.id)}" alt=""><span>${escapeSourceHtml(candidate.name)}</span><em>${counts.get(candidate.id) ?? 0}</em></button>`).join("")}</nav>
      ${selectedFamily === null ? "" : `<div class="source-inventory-breadcrumb"><button type="button" data-source-bag-family-back>‹ ${escapeSourceHtml(pocket.name)}</button><strong>${escapeSourceHtml(selectedFamily.name)}</strong><span>${familyEntries.length} sortes · ${familyEntries.reduce((sum, entry) => sum + entry.quantity, 0)} objets</span></div>`}
      <section class="source-inventory-browser"><div class="source-bag-list">${inventoryGrid}</div>${sourceBagPaginationHtml(pagedNodes.page, pagedNodes.pageCount)}</section>${actionWheel}${targetPanel}${discardPanel}${partyUsePanel}${rareCandyPanel}${teachPanel}${resultPanel}${this.bagNotice === null ? "" : `<p class="source-bag-notice">${escapeSourceHtml(this.bagNotice)}</p>`}`;
    bindSourceItemIconFallback(content);
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
          this.bagAction = action === "use" && this.selectedBagItemId !== null
            && isPokemonPartyItemUsableInField(this.selectedBagItemId) ? "use-party-confirm" : action;
          this.selectedBagPokemonId = null;
          this.renderBag(content, model);
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
    content.innerHTML = `<div class="source-menu-title"><div><small>PROGRESSION</small><h3>Sauvegarde</h3></div><span>${model.worldSave === null ? "VIDE" : "MANUELLE"}</span></div><div class="source-save-card"><div class="source-save-location"><small>POSITION ACTUELLE</small><strong>${escapeSourceHtml(model.assets.map.name)}</strong><span>${model.avatar.x}, ${model.avatar.y} · direction ${model.avatar.direction}</span></div><div class="source-save-status"><i></i><div><strong>${escapeSourceHtml(savedLabel)}</strong><small>La position rejoint l'équipe, l'inventaire, les interrupteurs et les variables déjà persistés.</small></div></div><div class="source-save-actions"><button id="save-source-world">Sauvegarder ici</button>${model.worldSave === null ? "" : '<button id="delete-source-world" class="danger">Effacer la position</button>'}</div></div>`;
    content.querySelector<HTMLButtonElement>("#save-source-world")?.addEventListener("click", this.callbacks.onSave);
    content.querySelector<HTMLButtonElement>("#delete-source-world")?.addEventListener("click", this.callbacks.onDeleteSave);
  }

  private renderOptions(content: HTMLElement): void {
    const volume = sourceMenuVolume(this.storage);
    content.innerHTML = `<div class="source-menu-title"><div><small>PRÉFÉRENCES</small><h3>Options</h3></div><span>LOCAL</span></div><div class="source-options-list"><label><span><strong>Volume général</strong><small>Contrôle les musiques et effets des cinématiques.</small></span><output id="source-volume-value">${volume}%</output><input id="source-volume" type="range" min="0" max="100" value="${volume}"></label><article><strong>Commandes</strong><small>Flèches ou ZQSD : déplacement · Espace/Entrée : interaction · Échap/M : menu</small></article></div>`;
    content.querySelector<HTMLInputElement>("#source-volume")?.addEventListener("input", (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.storage.setItem(SOURCE_VOLUME_KEY, input.value);
      this.callbacks.onVolumeChange(Number(input.value));
      const output = content.querySelector<HTMLOutputElement>("#source-volume-value");
      if (output !== null) output.value = `${input.value}%`;
    });
  }

  private renderDevTools(content: HTMLElement, model: SourceMenuViewModel): void {
    const movement = model.movement;
    const capabilities = (["sprint", "mount", "climb", "surf", "dive", "waterfall"] as const)
      .map((capability: SourceMovementCapability) => `<li class="${movement.unlocks[capability] ? "ready" : "locked"}"><i></i><span><strong>${sourceMovementCapabilityLabel(capability)}</strong><small>${movement.unlocks[capability] ? "Disponible" : "Encore verrouillé par la progression"}</small></span></li>`).join("");
    const diveLabel = movement.canSurfaceHere ? "Remonter à la surface" : "Plonger";
    const pockets = SOURCE_BAG_POCKETS.map((pocket) => `<option value="${pocket.id}"${pocket.id === this.selectedDevPocket ? " selected" : ""}>${escapeSourceHtml(pocket.name)}</option>`).join("");
    const pocketItems = [...model.assets.items.values()].filter((item) => item.pocket === this.selectedDevPocket)
      .sort((left, right) => left.id - right.id);
    if (this.selectedDevItemId !== null && !pocketItems.some((item) => item.internalName === this.selectedDevItemId)) {
      this.selectedDevItemId = null;
    }
    const items = [`<option value=""${this.selectedDevItemId === null ? " selected" : ""}>Toute la catégorie</option>`,
      ...pocketItems.map((item) => `<option value="${escapeSourceHtml(item.internalName)}"${item.internalName === this.selectedDevItemId ? " selected" : ""}>${escapeSourceHtml(item.name)} · ${escapeSourceHtml(item.internalName)}</option>`)].join("");
    const quantities = [1, 5, 10, 50, 99, 999].map((quantity) =>
      `<option value="${quantity}"${quantity === 99 ? " selected" : ""}>${quantity}</option>`).join("");
    const levelCaps = [17, 27, 36, 42, 50, 56, 70, 75, 80, 85, 94, 100].map((level) =>
      `<option value="${level}"${model.dev.levelCapOverride === level ? " selected" : ""}>Niveau ${level}</option>`).join("");
    const pokemon = [...model.assets.battleCatalog.pokemon].sort((left, right) => left.name.localeCompare(right.name, "fr"));
    const pokemonOptions = pokemon.map((entry) => `<option value="${escapeSourceHtml(entry.internalName)}">${escapeSourceHtml(entry.name)}</option>`).join("");
    const pokemonLevels = Array.from({ length: 100 }, (_, index) => index + 1).map((level) =>
      `<option value="${level}"${level === 5 ? " selected" : ""}>Niveau ${level}</option>`).join("");
    content.innerHTML = `<div class="source-menu-title"><div><small>OUTILS LOCAUX</small><h3>Test dev</h3></div><span>PERSONNEL</span></div><div class="source-dev-tools">
      <details data-dev-section="movement"${this.openDevSection === "movement" ? " open" : ""}><summary>Déplacements <small>${escapeSourceHtml(movement.mode.toUpperCase())}</small></summary><div class="source-dev-section"><div class="source-movement-actions"><button type="button" data-movement-mode="walk" class="${movement.mode === "walk" || movement.mode === "run" ? "active" : ""}">À pied<small>Maintenez Maj pour sprinter</small></button><button type="button" data-movement-mode="mount" class="${movement.mode === "mount" ? "active" : ""}"${movement.unlocks.mount ? "" : " disabled"}>Chevroum<small>Monture terrestre rapide</small></button><button type="button" id="source-movement-dive"${movement.canDiveHere || movement.canSurfaceHere ? "" : " disabled"}>${diveLabel}<small>Depuis une zone compatible</small></button></div><ul class="source-movement-capabilities">${capabilities}</ul><p class="source-movement-help">Surf : interaction face à l'eau. Corniches, glace, cascades et parois restent pilotées par le terrain source.</p></div></details>
      <details data-dev-section="unlocks"${this.openDevSection === "unlocks" ? " open" : ""}><summary>Déblocages <small>Cap effectif ${model.dev.effectiveLevelCap}</small></summary><div class="source-dev-section"><label class="source-movement-test"><span><strong>Tous les déplacements</strong><small>Ignore localement leurs prérequis sans modifier badges, objets ou histoire.</small></span><input id="source-movement-test" type="checkbox"${movement.unlocks.testOverride ? " checked" : ""}></label><label class="source-dev-field"><span>Cap de niveau</span><select id="source-dev-level-cap"><option value=""${model.dev.levelCapOverride === null ? " selected" : ""}>Progression normale · ${model.dev.storyLevelCap}</option>${levelCaps}</select><small>Le cap simulé sert aux Bonbons Rares et aux combats ouverts par ce navigateur.</small></label></div></details>
      <details data-dev-section="bag"${this.openDevSection === "bag" ? " open" : ""}><summary>Gestion du Sac <small>Par catégorie</small></summary><div class="source-dev-section source-dev-form"><label><span>Catégorie</span><select id="source-dev-pocket">${pockets}</select></label><label><span>Objet</span><select id="source-dev-item">${items}</select></label><label><span>Quantité à ajouter</span><select id="source-dev-item-quantity">${quantities}</select></label><div class="source-dev-buttons"><button type="button" id="source-dev-grant-items">Ajouter au Sac</button><button type="button" id="source-dev-reset-pocket" class="danger">Vider cette catégorie</button></div><small>Le vidage supprime uniquement les objets de la catégorie choisie dans cette sauvegarde.</small></div></details>
      <details data-dev-section="pokemon"${this.openDevSection === "pokemon" ? " open" : ""}><summary>Donner un Pokémon <small>Équipe ou Ranch</small></summary><div class="source-dev-section source-dev-form"><label><span>Espèce</span><input id="source-dev-pokemon" list="source-dev-pokemon-list" value="NINCADA" autocomplete="off"><datalist id="source-dev-pokemon-list">${pokemonOptions}</datalist></label><label><span>Niveau</span><select id="source-dev-pokemon-level">${pokemonLevels}</select></label><button type="button" id="source-dev-grant-pokemon">Ajouter le Pokémon</button><small>Le Pokémon rejoint l'équipe si une place est libre, sinon le Ranch. Exemple évolution : NINCADA niveau 19.</small></div></details>
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
      this.openDevSection = "bag";
      this.renderDevTools(content, model);
    });
    content.querySelector<HTMLSelectElement>("#source-dev-item")?.addEventListener("change", (event) => {
      this.selectedDevItemId = (event.currentTarget as HTMLSelectElement).value || null;
    });
    content.querySelector<HTMLButtonElement>("#source-dev-grant-items")?.addEventListener("click", () => {
      const quantity = Number(content.querySelector<HTMLSelectElement>("#source-dev-item-quantity")?.value ?? 99);
      this.callbacks.onGrantTestItems(this.selectedDevPocket, this.selectedDevItemId, quantity);
    });
    content.querySelector<HTMLButtonElement>("#source-dev-reset-pocket")?.addEventListener("click", () => {
      if (window.confirm("Vider tous les objets de cette catégorie ?")) this.callbacks.onResetTestItemPocket(this.selectedDevPocket);
    });
    content.querySelector<HTMLButtonElement>("#source-dev-grant-pokemon")?.addEventListener("click", () => {
      const species = content.querySelector<HTMLInputElement>("#source-dev-pokemon")?.value.trim() ?? "";
      const level = Number(content.querySelector<HTMLSelectElement>("#source-dev-pokemon-level")?.value ?? 5);
      this.callbacks.onGrantTestPokemon(species, level);
    });
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
