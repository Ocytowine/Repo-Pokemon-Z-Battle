import { pokemonItemTargetMode, type BattlePosition, type BattleSide, type BattleTeam,
  type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { pokemonTypeIconUrl } from "@pokemon-z-battle/game-assets";
import { SOURCE_BATTLE_BAG_PAGE_SIZE, sourceBagFamilyEntries, sourceBagNodes, sourceBagPage,
  sourceBagSubfamily, sourceItemIconFallbackUrl, type SourceBagEntry } from "./source-bag.js";
import { sourceBagGridHtml, sourceBagPaginationHtml } from "./source-bag-grid.js";
import { escapeSourceHtml } from "./source-menu-view.js";
import type { SourceShopItem } from "./source-economy.js";

export interface SourceBattleBagEntry extends SourceShopItem {
  readonly quantity: number;
  readonly usable?: boolean;
}

export interface SourceBattleOverlayModel {
  readonly state: TeamBattleState | null;
  readonly local: boolean;
  readonly animating: boolean;
  readonly waitingForJoin: boolean;
  readonly networkSide: BattleSide | null;
  readonly controllableMemberIds: readonly string[] | null;
  readonly networkSubmittedTurn: number | null;
  readonly submittedActiveSlots: readonly number[];
  readonly escapable: boolean;
  readonly escapeConfirmedByMe: boolean;
  readonly escapeConfirmationCount: number;
  readonly escapeConfirmationRequired: number;
  readonly capturable: boolean;
  readonly escaped: boolean;
  readonly bag: {
    readonly balls: readonly SourceBattleBagEntry[];
    readonly medicine: readonly SourceBattleBagEntry[];
    readonly battleItems: readonly SourceBattleBagEntry[];
  };
}

export interface SourceBattleOverlayCallbacks {
  readonly onRenderVisuals: (state: TeamBattleState, local: boolean) => void;
  readonly onMove: (moveIndex: number, local: boolean, activeSlot: number, target?: BattlePosition) => void;
  readonly onSwitch: (teamIndex: number, local: boolean, activeSlot: number) => void;
  readonly onItem: (itemId: string, targetTeamIndex: number, local: boolean, activeSlot: number,
    targetMoveIndex?: number) => void;
  readonly onCapture: (ballId: string, local: boolean, activeSlot: number, target?: BattlePosition) => void;
  readonly onReplacement: (teamIndex: number, activeSlot: number) => void;
  readonly onLeave: () => void;
  readonly onEscape: (local: boolean) => void;
  readonly onDetails: (pokemonId: string) => void;
}

type BattleMenu = "root" | "moves" | "targets" | "pokemon" | "bag" | "balls" | "medicine" | "battle-items"
  | "item-targets" | "item-moves";

export function sourceBattleSummary(state: TeamBattleState, observing: boolean): string {
  const playerTeam = state.teams.player;
  const opponentTeam = state.teams.opponent;
  const player = playerTeam.members[playerTeam.activeIndex];
  const opponent = opponentTeam.members[opponentTeam.activeIndex];
  if (player === undefined || opponent === undefined) return "";
  return `${player.hp}/${player.stats.maxHp} PV · ${opponent.hp}/${opponent.stats.maxHp} PV${observing ? " · observation" : ""}`;
}

function disabled(value: boolean): string { return value ? " disabled" : ""; }

function hpPercent(hp: number, maximum: number): number {
  return Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maximum)) * 100)));
}

export class SourceBattleOverlay {
  private menu: BattleMenu = "root";
  private renderedTurn: number | null = null;
  private activeSlot = 0;
  private pendingMoveIndex: number | null = null;
  private pendingItemId: string | null = null;
  private pendingItemTargetIndex: number | null = null;
  private selectedBagFamilyId: string | null = null;
  private bagPage = 0;

  public constructor(private readonly callbacks: SourceBattleOverlayCallbacks) {}

  public render(model: SourceBattleOverlayModel): void {
    const panel = document.querySelector<HTMLElement>("#encounter-panel");
    if (panel === null) return;
    panel.hidden = model.state === null;
    if (model.state === null) {
      this.menu = "root";
      this.renderedTurn = null;
      return;
    }
    if (this.renderedTurn !== model.state.turn) {
      this.menu = "root";
      this.renderedTurn = model.state.turn;
      this.activeSlot = 0;
      this.pendingMoveIndex = null;
      this.pendingItemId = null;
      this.pendingItemTargetIndex = null;
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
    }
    const visualStage = document.querySelector<HTMLElement>("#source-battle-stage");
    if (visualStage !== null) {
      visualStage.hidden = false;
      visualStage.classList.toggle("waiting-for-join", model.waitingForJoin);
    }
    if (!model.waitingForJoin) this.callbacks.onRenderVisuals(model.state, model.local);
    const playerTeam = model.state.teams.player;
    const opponentTeam = model.state.teams.opponent;
    const player = playerTeam.members[playerTeam.activeIndex];
    const opponent = opponentTeam.members[opponentTeam.activeIndex];
    if (player === undefined || opponent === undefined) return;
    const title = document.querySelector<HTMLElement>("#encounter-title");
    if (title !== null) title.textContent = `${player.name} contre ${opponent.name}`;
    const turn = document.querySelector<HTMLElement>("#encounter-turn");
    if (turn !== null) turn.textContent = `Tour ${model.state.turn}`;
    const summary = document.querySelector<HTMLElement>("#encounter-summary");
    if (summary !== null) summary.textContent = sourceBattleSummary(model.state,
      !model.local && model.networkSide === null);
    this.renderActions(model, playerTeam);
  }

  private renderActions(model: SourceBattleOverlayModel, team: BattleTeam): void {
    const actions = document.querySelector<HTMLElement>("#encounter-actions");
    if (actions === null || model.state === null) return;
    if (model.waitingForJoin) {
      actions.innerHTML = '<div class="source-battle-menu source-battle-result"><p>En attente de l’autre Dresseur…</p><small>Il doit venir interagir avec vous et choisir son camp.</small></div>';
      return;
    }
    const activeIndices = team.activeIndices ?? [team.activeIndex];
    const controllableSlots = activeIndices.flatMap((index, slot) => model.controllableMemberIds === null
      || model.controllableMemberIds.includes(team.members[index]!.id) ? [slot] : []);
    if (!controllableSlots.includes(this.activeSlot) || model.submittedActiveSlots.includes(this.activeSlot)) {
      this.activeSlot = controllableSlots.find((slot) => !model.submittedActiveSlots.includes(slot)) ?? controllableSlots[0] ?? 0;
    }
    const active = team.members[activeIndices[this.activeSlot] ?? team.activeIndex];
    if (active === undefined) return;
    if (!model.local && model.state.status === "finished") {
      const result = model.state.winner === "player" ? "Victoire !" : "Défaite.";
      actions.innerHTML = `<div class="source-battle-menu source-battle-result"><button id="leave-player-duel">${result}<small>Retour au jeu</small></button></div>`;
      actions.querySelector<HTMLButtonElement>("#leave-player-duel")?.addEventListener("click", this.callbacks.onLeave);
      return;
    }
    if (!model.local && model.escaped) {
      actions.innerHTML = '<div class="source-battle-menu source-battle-result"><p>Fuite réussie</p><small>Retour au monde en préparation…</small></div>';
      return;
    }
    const submitted = !model.local && model.networkSubmittedTurn === model.state.turn
      && model.submittedActiveSlots.includes(this.activeSlot);
    const blocked = submitted || model.escapeConfirmedByMe || model.animating
      || !model.local && model.networkSide === null;
    const replacement = !model.local && model.networkSide !== null && (model.state.replacementRequired.includes("player")
      || model.state.slotReplacements?.some((position) => position.side === "player" && position.slot === this.activeSlot) === true);
    if (replacement) {
      this.menu = "pokemon";
      this.renderPokemon(actions, team, model, blocked, true);
      return;
    }
    if (this.menu === "moves") this.renderMoves(actions, active, model, blocked);
    else if (this.menu === "targets") this.renderTargets(actions, model, blocked);
    else if (this.menu === "pokemon") this.renderPokemon(actions, team, model, blocked, false);
    else if (this.menu === "bag") this.renderBagCategories(actions, model, blocked);
    else if (this.menu === "item-targets") this.renderItemTargets(actions, team, model, blocked);
    else if (this.menu === "item-moves") this.renderItemMoves(actions, team, model, blocked);
    else if (this.menu === "balls" || this.menu === "medicine" || this.menu === "battle-items") {
      this.renderBagItems(actions, model, blocked, this.menu);
    } else this.renderRoot(actions, model, team, blocked);
  }

  private renderRoot(actions: HTMLElement, model: SourceBattleOverlayModel, team: BattleTeam, blocked: boolean): void {
    const activeIndices = team.activeIndices ?? [team.activeIndex];
    const reserves = team.members.filter((member, index) => !activeIndices.includes(index) && member.hp > 0).length;
    const bagCount = [...model.bag.balls, ...model.bag.medicine, ...model.bag.battleItems]
      .filter((entry) => entry.usable !== false).length;
    const activePicker = activeIndices.length < 2 ? "" : `<div class="source-battle-active-picker">${activeIndices.map((index, slot) => `<button data-active-slot="${slot}"${disabled(model.submittedActiveSlots.includes(slot))}>${escapeSourceHtml(team.members[index]!.name)}${slot === this.activeSlot ? " ✓" : ""}</button>`).join("")}</div>`;
    actions.innerHTML = `${activePicker}<div class="source-battle-menu source-battle-root" aria-label="Commandes de combat">
      <button data-battle-menu="moves" class="attack"${disabled(blocked)}><b>⚔</b><span>Attaque</span><small>Choisir une capacité</small></button>
      <button data-battle-menu="pokemon" class="pokemon"${disabled(blocked)}><b>●</b><span>Pokémon</span><small>${reserves} remplaçant${reserves > 1 ? "s" : ""}</small></button>
      <button data-battle-menu="bag" class="bag"${disabled(blocked)}><b>▣</b><span>Sac</span><small>${bagCount} objet${bagCount > 1 ? "s" : ""} dans ces poches</small></button>
      <button id="escape-source-encounter" class="escape"${disabled(model.animating || model.escapeConfirmedByMe
        || !model.local && model.networkSubmittedTurn === model.state?.turn || !model.escapable)}><b>↗</b><span>Fuite</span><small>${model.escapeConfirmedByMe
          ? `Confirmation envoyée · ${model.escapeConfirmationCount}/${model.escapeConfirmationRequired}`
          : model.escapable && model.escapeConfirmationRequired > 1
            ? `Accord requis · ${model.escapeConfirmationCount}/${model.escapeConfirmationRequired}`
            : model.escapable ? "Quitter le combat" : model.local ? "Combat de Dresseur" : "Indisponible en duel"}</small></button>
    </div>`;
    actions.querySelectorAll<HTMLButtonElement>("[data-battle-menu]").forEach((button) => button.addEventListener("click", () => {
      this.menu = button.dataset.battleMenu as BattleMenu;
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
      this.render(model);
    }));
    actions.querySelectorAll<HTMLButtonElement>("[data-active-slot]").forEach((button) => button.addEventListener("click", () => {
      this.activeSlot = Number(button.dataset.activeSlot);
      this.render(model);
    }));
    actions.querySelector<HTMLButtonElement>("#escape-source-encounter")?.addEventListener("click", () => {
      this.menu = "root";
      this.callbacks.onEscape(model.local);
    });
  }

  private renderMoves(actions: HTMLElement, active: BattleTeam["members"][number],
    model: SourceBattleOverlayModel, blocked: boolean): void {
    const cards = active.moves.map((slot, index) => `<button data-encounter-move="${index}"${disabled(blocked || slot.pp <= 0)}><span class="source-move-name"><img src="${pokemonTypeIconUrl(slot.move.type)}" alt="">${escapeSourceHtml(slot.move.name)}</span><small>${slot.pp} PP · ${escapeSourceHtml(slot.move.type)}</small></button>`).join("");
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu"><header><button data-battle-back aria-label="Retour">‹</button><div><small>ATTAQUE</small><strong>Quelle capacité ?</strong></div></header><div class="source-battle-move-grid">${cards}</div></div>`;
    this.bindBack(actions, model);
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-move]").forEach((button) =>
      button.addEventListener("click", () => {
        const moveIndex = Number(button.dataset.encounterMove);
        if (!Number.isInteger(moveIndex)) return;
        const move = active.moves[moveIndex]?.move;
        const selectable = ["00", "400"].includes((move?.targetCode ?? "00").toUpperCase());
        const opponentCount = model.state?.teams.opponent.activeIndices?.length ?? 1;
        if (selectable && opponentCount > 1) {
          this.pendingMoveIndex = moveIndex;
          this.menu = "targets";
          this.render(model);
        } else {
          this.menu = "root";
          this.callbacks.onMove(moveIndex, model.local, this.activeSlot);
        }
      }));
  }

  private renderTargets(actions: HTMLElement, model: SourceBattleOverlayModel, blocked: boolean): void {
    if (model.state === null || this.pendingMoveIndex === null) { this.menu = "moves"; this.render(model); return; }
    const team = model.state.teams.opponent;
    const indices = team.activeIndices ?? [team.activeIndex];
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu"><header><button data-battle-back="moves" aria-label="Retour">‹</button><div><small>CIBLE</small><strong>Quel Pokemon viser ?</strong></div></header><div class="source-battle-move-grid">${indices.map((index, slot) => {
      const battler = team.members[index]!;
      return `<button data-target-slot="${slot}"${disabled(blocked || battler.hp <= 0)}><span>${escapeSourceHtml(battler.name)}</span><small>${battler.hp}/${battler.stats.maxHp} PV</small></button>`;
    }).join("")}</div></div>`;
    this.bindBack(actions, model, "moves");
    actions.querySelectorAll<HTMLButtonElement>("[data-target-slot]").forEach((button) => button.addEventListener("click", () => {
      const moveIndex = this.pendingMoveIndex!;
      this.pendingMoveIndex = null;
      this.menu = "root";
      this.callbacks.onMove(moveIndex, model.local, this.activeSlot,
        { side: "opponent", slot: Number(button.dataset.targetSlot) });
    }));
  }

  private renderPokemon(actions: HTMLElement, team: BattleTeam, model: SourceBattleOverlayModel,
    blocked: boolean, replacement: boolean): void {
    const rows = team.members.map((member, index) => {
      const active = (team.activeIndices ?? [team.activeIndex]).includes(index);
      const cannotSwitch = blocked || active || member.hp <= 0
        || model.controllableMemberIds !== null && !model.controllableMemberIds.includes(member.id);
      return `<article class="source-battle-team-row${active ? " active" : ""}"><div><strong>${escapeSourceHtml(member.name)}</strong><small>N.${member.level}${active ? " · AU COMBAT" : member.hp <= 0 ? " · K.O." : ""}</small></div><span class="source-battle-team-hp"><i><b style="width:${hpPercent(member.hp, member.stats.maxHp)}%"></b></i><em>${member.hp}/${member.stats.maxHp} PV</em></span><nav><button data-battle-details="${escapeSourceHtml(member.id)}"${disabled(model.animating)}>Détails</button><button data-${replacement ? "encounter-replacement" : "encounter-switch"}="${index}"${disabled(cannotSwitch)}>${replacement ? "Envoyer" : "Changer"}</button></nav></article>`;
    }).join("");
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu source-battle-team"><header>${replacement ? "" : '<button data-battle-back aria-label="Retour">‹</button>'}<div><small>POKÉMON</small><strong>${replacement ? "Choisissez un remplaçant" : "Équipe et détails"}</strong></div></header><div class="source-battle-team-list">${rows}</div></div>`;
    if (!replacement) this.bindBack(actions, model);
    actions.querySelectorAll<HTMLButtonElement>("[data-battle-details]").forEach((button) =>
      button.addEventListener("click", () => this.callbacks.onDetails(button.dataset.battleDetails!)));
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-switch]").forEach((button) =>
      button.addEventListener("click", () => {
        this.menu = "root";
        this.callbacks.onSwitch(Number(button.dataset.encounterSwitch), model.local, this.activeSlot);
      }));
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-replacement]").forEach((button) =>
      button.addEventListener("click", () => this.callbacks.onReplacement(Number(button.dataset.encounterReplacement), this.activeSlot)));
  }

  private renderBagCategories(actions: HTMLElement, model: SourceBattleOverlayModel, blocked: boolean): void {
    const categories = [
      { id: "balls", label: "Poké Balls", hint: model.capturable ? "Pokémon sauvage" : "Cible non capturable", count: model.bag.balls.filter((entry) => entry.usable !== false).length, unavailable: !model.capturable },
      { id: "medicine", label: "Soins", hint: "PV et statuts", count: model.bag.medicine.filter((entry) => entry.usable !== false).length, unavailable: false },
      { id: "battle-items", label: "Objets combat", hint: "Bonus temporaires", count: model.bag.battleItems.filter((entry) => entry.usable !== false).length, unavailable: false },
    ] as const;
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu"><header><button data-battle-back aria-label="Retour">‹</button><div><small>SAC</small><strong>Choisir une catégorie</strong></div></header><div class="source-battle-bag-categories">${categories.map((category) => `<button data-battle-menu="${category.id}"${disabled(blocked || category.unavailable)}><b>${category.count}</b><span>${category.label}</span><small>${category.hint}</small></button>`).join("")}</div></div>`;
    this.bindBack(actions, model);
    actions.querySelectorAll<HTMLButtonElement>("[data-battle-menu]").forEach((button) => button.addEventListener("click", () => {
      this.menu = button.dataset.battleMenu as BattleMenu;
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
      this.render(model);
    }));
  }

  private renderBagItems(actions: HTMLElement, model: SourceBattleOverlayModel, blocked: boolean,
    category: "balls" | "medicine" | "battle-items"): void {
    const sourceEntries = category === "balls" ? model.bag.balls
      : category === "medicine" ? model.bag.medicine : model.bag.battleItems;
    const entries: readonly SourceBagEntry[] = sourceEntries.filter((entry) => entry.usable !== false)
      .map((item) => ({ item, quantity: item.quantity }));
    let familyEntries = this.selectedBagFamilyId === null ? []
      : sourceBagFamilyEntries(entries, this.selectedBagFamilyId);
    if (this.selectedBagFamilyId !== null && familyEntries.length === 0) {
      this.selectedBagFamilyId = null;
      this.bagPage = 0;
      familyEntries = [];
    }
    const nodes = this.selectedBagFamilyId === null ? sourceBagNodes(entries)
      : familyEntries.map((entry) => ({ kind: "item" as const, entry }));
    const page = sourceBagPage(nodes, this.bagPage, SOURCE_BATTLE_BAG_PAGE_SIZE);
    this.bagPage = page.page;
    const family = familyEntries[0] === undefined ? null : sourceBagSubfamily(familyEntries[0].item);
    const title = category === "balls" ? "Poké Balls" : category === "medicine" ? "Soins" : "Objets combat";
    const unavailable = category === "balls" ? "Ce Pokémon ne peut pas être capturé."
      : "L'effet de cet objet n'est pas disponible.";
    const list = entries.length === 0 ? '<p class="source-battle-empty">Aucun objet de cette catégorie.</p>'
      : sourceBagGridHtml(page.entries, { itemAttribute: "data-battle-item",
        familyAttribute: "data-battle-bag-family", disabled: () => blocked });
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu source-battle-bag-items"><header><button data-battle-back="${family === null ? "bag" : category}" aria-label="Retour">‹</button><div><small>SAC · ${title}</small><strong>${family === null ? "Choisir un objet" : escapeSourceHtml(family.name)}</strong></div></header>${family === null ? "" : `<div class="source-battle-family-summary"><span>${familyEntries.length} sortes</span><b>${familyEntries.reduce((sum, entry) => sum + entry.quantity, 0)} objets</b></div>`}<div class="source-battle-inventory-page">${list}</div>${sourceBagPaginationHtml(page.page, page.pageCount)}<footer>${blocked ? "Action en cours." : entries.length > 0 ? "Choisissez un objet puis votre Pokémon." : unavailable}</footer></div>`;
    actions.querySelectorAll<HTMLImageElement>("[data-source-item-icon]").forEach((image) =>
      image.addEventListener("error", () => { image.src = sourceItemIconFallbackUrl(image.src); }, { once: true }));
    actions.querySelector<HTMLButtonElement>("[data-battle-back]")?.addEventListener("click", () => {
      if (family !== null) {
        this.selectedBagFamilyId = null;
        this.bagPage = 0;
      } else this.menu = "bag";
      this.render(model);
    });
    actions.querySelectorAll<HTMLButtonElement>("[data-battle-bag-family]").forEach((button) =>
      button.addEventListener("click", () => {
        this.selectedBagFamilyId = button.dataset.battleBagFamily ?? null;
        this.bagPage = 0;
        this.render(model);
      }));
    actions.querySelectorAll<HTMLButtonElement>("[data-source-inventory-page]").forEach((button) =>
      button.addEventListener("click", () => {
        this.bagPage = Number(button.dataset.sourceInventoryPage);
        this.render(model);
      }));
    if (category === "balls") actions.querySelectorAll<HTMLButtonElement>("[data-battle-item]").forEach((button) =>
      button.addEventListener("click", () => {
        this.menu = "root";
        this.selectedBagFamilyId = null;
        this.bagPage = 0;
        this.callbacks.onCapture(button.dataset.battleItem!, model.local, this.activeSlot);
      }));
    else actions.querySelectorAll<HTMLButtonElement>("[data-battle-item]").forEach((button) =>
      button.addEventListener("click", () => {
        this.pendingItemId = button.dataset.battleItem ?? null;
        if (category === "battle-items") {
          const activeIndices = model.state?.teams.player.activeIndices ?? [model.state?.teams.player.activeIndex ?? 0];
          const targetTeamIndex = activeIndices[this.activeSlot];
          if (this.pendingItemId === null || targetTeamIndex === undefined) return;
          const itemId = this.pendingItemId;
          this.pendingItemId = null;
          this.menu = "root";
          this.selectedBagFamilyId = null;
          this.bagPage = 0;
          this.callbacks.onItem(itemId, targetTeamIndex, model.local, this.activeSlot);
        } else {
          this.menu = "item-targets";
          this.render(model);
        }
      }));
  }

  private renderItemTargets(actions: HTMLElement, team: BattleTeam, model: SourceBattleOverlayModel,
    blocked: boolean): void {
    if (this.pendingItemId === null) { this.menu = "medicine"; this.render(model); return; }
    const rows = team.members.map((member, index) => {
      const owned = model.controllableMemberIds === null || model.controllableMemberIds.includes(member.id);
      return `<button data-item-target="${index}"${disabled(blocked || !owned)}><span>${escapeSourceHtml(member.name)}</span><small>${member.hp}/${member.stats.maxHp} PV${member.majorStatus === null ? "" : ` · ${escapeSourceHtml(member.majorStatus.kind)}`}</small></button>`;
    }).join("");
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu"><header><button data-battle-back="medicine" aria-label="Retour">‹</button><div><small>OBJET</small><strong>Sur quel Pokémon ?</strong></div></header><div class="source-battle-move-grid">${rows}</div></div>`;
    this.bindBack(actions, model, "medicine");
    actions.querySelectorAll<HTMLButtonElement>("[data-item-target]").forEach((button) =>
      button.addEventListener("click", () => {
        const itemId = this.pendingItemId!;
        const targetIndex = Number(button.dataset.itemTarget);
        if (pokemonItemTargetMode(itemId) === "move") {
          this.pendingItemTargetIndex = targetIndex;
          this.menu = "item-moves";
          this.render(model);
          return;
        }
        this.pendingItemId = null;
        this.menu = "root";
        this.callbacks.onItem(itemId, targetIndex, model.local, this.activeSlot);
      }));
  }

  private renderItemMoves(actions: HTMLElement, team: BattleTeam, model: SourceBattleOverlayModel,
    blocked: boolean): void {
    const member = this.pendingItemTargetIndex === null ? undefined : team.members[this.pendingItemTargetIndex];
    if (this.pendingItemId === null || this.pendingItemTargetIndex === null || member === undefined) {
      this.menu = "item-targets";
      this.render(model);
      return;
    }
    const rows = member.moves.map((slot, index) =>
      `<button data-item-move="${index}"${disabled(blocked || slot.pp >= slot.move.pp)}><span>${escapeSourceHtml(slot.move.name)}</span><small>${slot.pp}/${slot.move.pp} PP</small></button>`).join("");
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu"><header><button data-battle-back="item-targets" aria-label="Retour">‹</button><div><small>OBJET</small><strong>Quelle capacité restaurer ?</strong></div></header><div class="source-battle-move-grid">${rows}</div></div>`;
    this.bindBack(actions, model, "item-targets");
    actions.querySelectorAll<HTMLButtonElement>("[data-item-move]").forEach((button) =>
      button.addEventListener("click", () => {
        const itemId = this.pendingItemId!;
        const targetIndex = this.pendingItemTargetIndex!;
        const moveIndex = Number(button.dataset.itemMove);
        this.pendingItemId = null;
        this.pendingItemTargetIndex = null;
        this.menu = "root";
        this.callbacks.onItem(itemId, targetIndex, model.local, this.activeSlot, moveIndex);
      }));
  }

  private bindBack(actions: HTMLElement, model: SourceBattleOverlayModel, destination: BattleMenu = "root"): void {
    actions.querySelector<HTMLButtonElement>("[data-battle-back]")?.addEventListener("click", () => {
      this.menu = destination;
      this.render(model);
    });
  }
}
