import type { ImportedAvatar, ImportedMapAssets } from "./imported-map.js";
import { SOURCE_BAG_POCKETS, sourceBagEntries, sourceBagPocketCounts, sourceItemIconUrl,
  sourcePocketIconUrl } from "./source-bag.js";
import type { SourceEventState } from "./source-event-state.js";
import type { SourceMenuTab } from "./source-scene-coordinator.js";
import type { SourceShopItem } from "./source-economy.js";
import type { SourceWorldSave } from "./source-world-save.js";
import type { PlayerConnectionState, SourceMovementMode } from "@pokemon-z-battle/multiplayer-protocol";
import { sourceMovementCapabilityLabel, type SourceMovementCapability,
  type SourceMovementUnlocks } from "./source-player-movement.js";
import { createSourcePokemonCollection } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml } from "./source-pokemon-card-view.js";
import { sourcePokemonActions, sourcePokemonActionWheelHtml } from "./source-pokemon-actions.js";
import { isPokemonItemUseSupported } from "@pokemon-z-battle/player-state";

const SOURCE_VOLUME_KEY = "pokemon-z-battle.options.volume.v1";

export function escapeSourceHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function sourceMenuVolume(storage: Pick<Storage, "getItem">): number {
  const stored = Number(storage.getItem(SOURCE_VOLUME_KEY) ?? 80);
  return Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 80;
}

function bindSourceItemIconFallback(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("[data-source-item-icon]").forEach((image) => {
    image.addEventListener("error", () => { image.src = sourceItemIconUrl(0); }, { once: true });
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
  readonly onDive: () => void;
  readonly onPokemonLead: (pokemonId: string) => void;
  readonly onPokemonDetails: (pokemonId: string) => void;
  readonly onUsePokemonItem: (itemId: string, pokemonId: string) => {
    readonly ok: boolean;
    readonly message: string;
    readonly eventState: SourceEventState;
  };
}

export class SourceMenuView {
  private selectedPocket = 1;
  private selectedTeamPokemonId: string | null = null;
  private selectedBagItemId: string | null = null;
  private bagNotice: string | null = null;

  public constructor(private readonly storage: Storage, private readonly callbacks: SourceMenuViewCallbacks) {}

  public render(model: SourceMenuViewModel): void {
    const menu = document.querySelector<HTMLElement>("#source-menu");
    const content = document.querySelector<HTMLElement>("#source-menu-content");
    if (menu === null || content === null) return;
    menu.hidden = !model.open;
    if (!model.open) return;
    const location = document.querySelector<HTMLElement>("#source-menu-location");
    if (location !== null) location.textContent = model.assets.map.name;
    document.querySelectorAll<HTMLButtonElement>("[data-source-menu-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.sourceMenuTab === model.tab);
    });
    if (model.tab === "team") this.renderTeam(content, model);
    else if (model.tab === "bag") this.renderBag(content, model);
    else if (model.tab === "movement") this.renderMovement(content, model.movement);
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
    const activePokemonId = model.eventState.party.activeIndex === null ? null
      : model.eventState.party.members[model.eventState.party.activeIndex]?.id ?? null;
    const wheel = selected === null ? "" : sourcePokemonActionWheelHtml(selected,
      sourcePokemonActions("team", selected, { partySize: members.length, partyFull: members.length >= 6, activePokemonId }));
    content.innerHTML = `<div class="source-menu-title"><div><small>COMPAGNONS</small><h3>Équipe Pokémon</h3></div><span>${members.length}/6</span></div><div class="source-team-grid">${members.length === 0
      ? '<div class="source-menu-empty"><img src="/__pokemon-z/source/Graphics/Pictures/partyBall.PNG" alt=""><strong>Équipe vide</strong><small>Choisissez votre premier Pokémon pour commencer.</small></div>'
      : entries.map((entry) => sourcePokemonCardHtml(entry, { active: entry.teamIndex === model.eventState.party.activeIndex,
        selected: entry.pokemon.id === this.selectedTeamPokemonId })).join("")}</div>${wheel}`;
    content.querySelectorAll<HTMLButtonElement>(".source-team-grid [data-pokemon-id]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedTeamPokemonId = button.dataset.pokemonId ?? null;
        this.renderTeam(content, model);
      });
    });
    content.querySelector<HTMLButtonElement>("[data-pokemon-wheel-close]")?.addEventListener("click", () => {
      this.selectedTeamPokemonId = null;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLElement>("[data-pokemon-wheel-dismiss]")?.addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      this.selectedTeamPokemonId = null;
      this.renderTeam(content, model);
    });
    content.querySelector<HTMLButtonElement>('[data-pokemon-action="make-lead"]')?.addEventListener("click", () => {
      if (selected !== null) this.callbacks.onPokemonLead(selected.pokemon.id);
    });
    content.querySelector<HTMLButtonElement>('[data-pokemon-action="details"]')?.addEventListener("click", () => {
      if (selected !== null) this.callbacks.onPokemonDetails(selected.pokemon.id);
    });
  }

  private renderBag(content: HTMLElement, model: SourceMenuViewModel): void {
    const counts = sourceBagPocketCounts(model.eventState.inventory, model.assets.items);
    const entries = sourceBagEntries(model.eventState.inventory, model.assets.items, this.selectedPocket);
    if (this.selectedBagItemId !== null
      && !entries.some(({ item }) => item.internalName === this.selectedBagItemId)) this.selectedBagItemId = null;
    const selectedEntry = entries.find(({ item }) => item.internalName === this.selectedBagItemId) ?? null;
    const pocket = SOURCE_BAG_POCKETS.find((candidate) => candidate.id === this.selectedPocket)
      ?? SOURCE_BAG_POCKETS[0]!;
    const totalTypes = [...counts.values()].reduce((sum, count) => sum + count, 0);
    content.innerHTML = `<div class="source-menu-title"><div><small>INVENTAIRE · ${escapeSourceHtml(pocket.name)}</small><h3>Sac</h3></div><span>${model.eventState.money.toLocaleString("fr-FR")} ₽ · ${totalTypes} type${totalTypes > 1 ? "s" : ""}</span></div>
      <nav class="source-bag-pockets" aria-label="Poches du Sac">${SOURCE_BAG_POCKETS.map((candidate) =>
        `<button type="button" data-source-pocket="${candidate.id}" class="${candidate.id === this.selectedPocket ? "active" : ""}" title="${escapeSourceHtml(candidate.name)}"><img src="${sourcePocketIconUrl(candidate.id)}" alt=""><span>${escapeSourceHtml(candidate.name)}</span><em>${counts.get(candidate.id) ?? 0}</em></button>`).join("")}</nav>
      <div class="source-bag-list">${entries.length === 0
        ? `<div class="source-menu-empty"><img src="${sourcePocketIconUrl(pocket.id)}" alt=""><strong>Poche vide</strong><small>Aucun objet dans la catégorie ${escapeSourceHtml(pocket.name)}.</small></div>`
        : entries.map(({ item, quantity }) => {
          const supported = isPokemonItemUseSupported(item.internalName);
          return `<button type="button" class="source-bag-entry${item.internalName === this.selectedBagItemId ? " selected" : ""}"${supported ? ` data-source-bag-item="${escapeSourceHtml(item.internalName)}"` : " disabled"} title="${supported ? "Utiliser sur un Pokémon" : "Effet pas encore porté"}"><img src="${sourceItemIconUrl(item.id)}" data-source-item-icon alt=""><div><strong>${escapeSourceHtml(item.name)}</strong><small>${escapeSourceHtml(item.description)}</small></div><span>×${quantity}</span></button>`;
        }).join("")}</div>${selectedEntry === null ? "" : `<section class="source-bag-targets"><header><div><small>UTILISER</small><strong>${escapeSourceHtml(selectedEntry.item.name)}</strong></div><button type="button" data-source-bag-cancel>Annuler</button></header>${model.eventState.party.members.length === 0
          ? "<p>Aucun Pokémon dans l'équipe.</p>" : `<div>${model.eventState.party.members.map((pokemon) => `<button type="button" data-source-bag-target="${escapeSourceHtml(pokemon.id)}"><strong>${escapeSourceHtml(pokemon.nickname ?? pokemon.species)}</strong><small>${pokemon.hp}/${pokemon.stats.maxHp} PV${pokemon.majorStatus === null ? "" : ` · ${escapeSourceHtml(pokemon.majorStatus.kind)}`}</small></button>`).join("")}</div>`}</section>`}${this.bagNotice === null ? "" : `<p class="source-bag-notice">${escapeSourceHtml(this.bagNotice)}</p>`}`;
    bindSourceItemIconFallback(content);
    content.querySelectorAll<HTMLButtonElement>("[data-source-pocket]").forEach((button) => button.addEventListener("click", () => {
      const pocketId = Number(button.dataset.sourcePocket);
      if (!Number.isInteger(pocketId) || !SOURCE_BAG_POCKETS.some((candidate) => candidate.id === pocketId)) return;
      this.selectedPocket = pocketId;
      this.selectedBagItemId = null;
      this.bagNotice = null;
      this.render(model);
    }));
    content.querySelectorAll<HTMLButtonElement>("[data-source-bag-item]").forEach((button) => button.addEventListener("click", () => {
      this.selectedBagItemId = button.dataset.sourceBagItem ?? null;
      this.bagNotice = null;
      this.renderBag(content, model);
    }));
    content.querySelector<HTMLButtonElement>("[data-source-bag-cancel]")?.addEventListener("click", () => {
      this.selectedBagItemId = null;
      this.bagNotice = null;
      this.renderBag(content, model);
    });
    content.querySelectorAll<HTMLButtonElement>("[data-source-bag-target]").forEach((button) => button.addEventListener("click", () => {
      if (this.selectedBagItemId === null || button.dataset.sourceBagTarget === undefined) return;
      const result = this.callbacks.onUsePokemonItem(this.selectedBagItemId, button.dataset.sourceBagTarget);
      this.bagNotice = result.message;
      if (result.ok) this.selectedBagItemId = null;
      this.renderBag(content, { ...model, eventState: result.eventState });
    }));
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

  private renderMovement(content: HTMLElement, movement: SourceMenuMovementModel): void {
    const capabilities = (["sprint", "mount", "climb", "surf", "dive", "waterfall"] as const)
      .map((capability: SourceMovementCapability) => `<li class="${movement.unlocks[capability] ? "ready" : "locked"}"><i></i><span><strong>${sourceMovementCapabilityLabel(capability)}</strong><small>${movement.unlocks[capability] ? "Disponible" : "Encore verrouillé par la progression"}</small></span></li>`).join("");
    const diveLabel = movement.canSurfaceHere ? "Remonter à la surface" : "Plonger";
    content.innerHTML = `<div class="source-menu-title"><div><small>EXPLORATION</small><h3>Déplacements</h3></div><span>${escapeSourceHtml(movement.mode.toUpperCase())}</span></div>
      <div class="source-movement-actions"><button type="button" data-movement-mode="walk" class="${movement.mode === "walk" || movement.mode === "run" ? "active" : ""}">À pied<small>Maintenez Maj pour sprinter</small></button><button type="button" data-movement-mode="mount" class="${movement.mode === "mount" ? "active" : ""}"${movement.unlocks.mount ? "" : " disabled"}>Chevroum<small>Monture terrestre rapide</small></button><button type="button" id="source-movement-dive"${movement.canDiveHere || movement.canSurfaceHere ? "" : " disabled"}>${diveLabel}<small>Depuis une zone compatible</small></button></div>
      <label class="source-movement-test"><span><strong>Déplacements de test</strong><small>Autorise localement toutes les capacités dès le début, sans donner d'objet, de badge ou de capacité à la sauvegarde.</small></span><input id="source-movement-test" type="checkbox"${movement.unlocks.testOverride ? " checked" : ""}></label>
      <ul class="source-movement-capabilities">${capabilities}</ul><p class="source-movement-help">Surf s'active avec Espace/Entrée face à l'eau. Les corniches, la glace, les cascades et les parois Chevroum se déclenchent depuis le terrain ou leurs événements source.</p>`;
    content.querySelectorAll<HTMLButtonElement>("[data-movement-mode]").forEach((button) => button.addEventListener("click", () => {
      const mode = button.dataset.movementMode;
      if (mode === "walk" || mode === "mount") this.callbacks.onMovementMode(mode);
    }));
    content.querySelector<HTMLInputElement>("#source-movement-test")?.addEventListener("change", (event) => {
      this.callbacks.onMovementTestOverride((event.currentTarget as HTMLInputElement).checked);
    });
    content.querySelector<HTMLButtonElement>("#source-movement-dive")?.addEventListener("click", this.callbacks.onDive);
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
