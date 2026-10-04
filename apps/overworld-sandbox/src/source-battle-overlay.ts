import type { BattleSide, BattleTeam, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { pokemonTypeIconUrl } from "@pokemon-z-battle/game-assets";
import { sourceItemIconUrl } from "./source-bag.js";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourceBattleBagEntry {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly description: string;
  readonly quantity: number;
}

export interface SourceBattleOverlayModel {
  readonly state: TeamBattleState | null;
  readonly local: boolean;
  readonly animating: boolean;
  readonly networkSide: BattleSide | null;
  readonly networkSubmittedTurn: number | null;
  readonly escapable: boolean;
  readonly capturable: boolean;
  readonly bag: {
    readonly balls: readonly SourceBattleBagEntry[];
    readonly medicine: readonly SourceBattleBagEntry[];
    readonly battleItems: readonly SourceBattleBagEntry[];
  };
}

export interface SourceBattleOverlayCallbacks {
  readonly onRenderVisuals: (state: TeamBattleState, local: boolean) => void;
  readonly onMove: (moveIndex: number, local: boolean) => void;
  readonly onSwitch: (teamIndex: number, local: boolean) => void;
  readonly onReplacement: (teamIndex: number) => void;
  readonly onLeave: () => void;
  readonly onEscape: () => void;
  readonly onDetails: (pokemonId: string) => void;
}

type BattleMenu = "root" | "moves" | "pokemon" | "bag" | "balls" | "medicine" | "battle-items";

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
    }
    const visualStage = document.querySelector<HTMLElement>("#source-battle-stage");
    if (visualStage !== null) visualStage.hidden = false;
    this.callbacks.onRenderVisuals(model.state, model.local);
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
    const active = team.members[team.activeIndex];
    if (active === undefined) return;
    if (!model.local && model.state.status === "finished") {
      const result = model.state.winner === "player" ? "Victoire !" : "Défaite.";
      actions.innerHTML = `<div class="source-battle-menu source-battle-result"><button id="leave-player-duel">${result}<small>Retour au jeu</small></button></div>`;
      actions.querySelector<HTMLButtonElement>("#leave-player-duel")?.addEventListener("click", this.callbacks.onLeave);
      return;
    }
    const submitted = !model.local && model.networkSubmittedTurn === model.state.turn;
    const blocked = submitted || model.animating;
    const replacement = !model.local && model.state.replacementRequired.includes("player");
    if (replacement) {
      this.menu = "pokemon";
      this.renderPokemon(actions, team, model, blocked, true);
      return;
    }
    if (this.menu === "moves") this.renderMoves(actions, active, model, blocked);
    else if (this.menu === "pokemon") this.renderPokemon(actions, team, model, blocked, false);
    else if (this.menu === "bag") this.renderBagCategories(actions, model, blocked);
    else if (this.menu === "balls" || this.menu === "medicine" || this.menu === "battle-items") {
      this.renderBagItems(actions, model, blocked, this.menu);
    } else this.renderRoot(actions, model, team, blocked);
  }

  private renderRoot(actions: HTMLElement, model: SourceBattleOverlayModel, team: BattleTeam, blocked: boolean): void {
    const reserves = team.members.filter((member, index) => index !== team.activeIndex && member.hp > 0).length;
    const bagCount = model.bag.balls.length + model.bag.medicine.length + model.bag.battleItems.length;
    actions.innerHTML = `<div class="source-battle-menu source-battle-root" aria-label="Commandes de combat">
      <button data-battle-menu="moves" class="attack"${disabled(blocked)}><b>⚔</b><span>Attaque</span><small>Choisir une capacité</small></button>
      <button data-battle-menu="pokemon" class="pokemon"${disabled(blocked)}><b>●</b><span>Pokémon</span><small>${reserves} remplaçant${reserves > 1 ? "s" : ""}</small></button>
      <button data-battle-menu="bag" class="bag"${disabled(blocked)}><b>▣</b><span>Sac</span><small>${bagCount} objet${bagCount > 1 ? "s" : ""} dans ces poches</small></button>
      <button id="escape-source-encounter" class="escape"${disabled(blocked || !model.escapable)}><b>↗</b><span>Fuite</span><small>${model.escapable ? "Quitter le combat" : model.local ? "Combat de Dresseur" : "Indisponible en duel"}</small></button>
    </div>`;
    actions.querySelectorAll<HTMLButtonElement>("[data-battle-menu]").forEach((button) => button.addEventListener("click", () => {
      this.menu = button.dataset.battleMenu as BattleMenu;
      this.render(model);
    }));
    actions.querySelector<HTMLButtonElement>("#escape-source-encounter")?.addEventListener("click", () => {
      this.menu = "root";
      this.callbacks.onEscape();
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
        this.menu = "root";
        this.callbacks.onMove(moveIndex, model.local);
      }));
  }

  private renderPokemon(actions: HTMLElement, team: BattleTeam, model: SourceBattleOverlayModel,
    blocked: boolean, replacement: boolean): void {
    const rows = team.members.map((member, index) => {
      const active = index === team.activeIndex;
      const cannotSwitch = blocked || active || member.hp <= 0;
      return `<article class="source-battle-team-row${active ? " active" : ""}"><div><strong>${escapeSourceHtml(member.name)}</strong><small>N.${member.level}${active ? " · AU COMBAT" : member.hp <= 0 ? " · K.O." : ""}</small></div><span class="source-battle-team-hp"><i><b style="width:${hpPercent(member.hp, member.stats.maxHp)}%"></b></i><em>${member.hp}/${member.stats.maxHp} PV</em></span><nav><button data-battle-details="${escapeSourceHtml(member.id)}"${disabled(model.animating)}>Détails</button><button data-${replacement ? "encounter-replacement" : "encounter-switch"}="${index}"${disabled(cannotSwitch)}>${replacement ? "Envoyer" : "Changer"}</button></nav></article>`;
    }).join("");
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu source-battle-team"><header>${replacement ? "" : '<button data-battle-back aria-label="Retour">‹</button>'}<div><small>POKÉMON</small><strong>${replacement ? "Choisissez un remplaçant" : "Équipe et détails"}</strong></div></header><div class="source-battle-team-list">${rows}</div></div>`;
    if (!replacement) this.bindBack(actions, model);
    actions.querySelectorAll<HTMLButtonElement>("[data-battle-details]").forEach((button) =>
      button.addEventListener("click", () => this.callbacks.onDetails(button.dataset.battleDetails!)));
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-switch]").forEach((button) =>
      button.addEventListener("click", () => {
        this.menu = "root";
        this.callbacks.onSwitch(Number(button.dataset.encounterSwitch), model.local);
      }));
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-replacement]").forEach((button) =>
      button.addEventListener("click", () => this.callbacks.onReplacement(Number(button.dataset.encounterReplacement))));
  }

  private renderBagCategories(actions: HTMLElement, model: SourceBattleOverlayModel, blocked: boolean): void {
    const categories = [
      { id: "balls", label: "Poké Balls", hint: model.capturable ? "Pokémon sauvage" : "Cible non capturable", count: model.bag.balls.length, unavailable: !model.capturable },
      { id: "medicine", label: "Soins", hint: "PV et statuts", count: model.bag.medicine.length, unavailable: false },
      { id: "battle-items", label: "Objets combat", hint: "Bonus temporaires", count: model.bag.battleItems.length, unavailable: false },
    ] as const;
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu"><header><button data-battle-back aria-label="Retour">‹</button><div><small>SAC</small><strong>Choisir une catégorie</strong></div></header><div class="source-battle-bag-categories">${categories.map((category) => `<button data-battle-menu="${category.id}"${disabled(blocked || category.unavailable)}><b>${category.count}</b><span>${category.label}</span><small>${category.hint}</small></button>`).join("")}</div></div>`;
    this.bindBack(actions, model);
    actions.querySelectorAll<HTMLButtonElement>("[data-battle-menu]").forEach((button) => button.addEventListener("click", () => {
      this.menu = button.dataset.battleMenu as BattleMenu;
      this.render(model);
    }));
  }

  private renderBagItems(actions: HTMLElement, model: SourceBattleOverlayModel, blocked: boolean,
    category: "balls" | "medicine" | "battle-items"): void {
    const entries = category === "balls" ? model.bag.balls
      : category === "medicine" ? model.bag.medicine : model.bag.battleItems;
    const title = category === "balls" ? "Poké Balls" : category === "medicine" ? "Soins" : "Objets combat";
    const unavailable = !model.local ? "Les objets attendent leur raccord au combat Coop autoritaire."
      : "L'effet de cet objet n'est pas encore porté dans le moteur de combat.";
    const list = entries.length === 0 ? '<p class="source-battle-empty">Aucun objet de cette catégorie.</p>'
      : entries.map((entry) => `<button class="source-battle-item" disabled title="${escapeSourceHtml(unavailable)}"><img src="${sourceItemIconUrl(entry.id)}" alt=""><span><strong>${escapeSourceHtml(entry.name)}</strong><small>${escapeSourceHtml(entry.description)}</small></span><b>×${entry.quantity}</b></button>`).join("");
    actions.innerHTML = `<div class="source-battle-menu source-battle-submenu source-battle-bag-items"><header><button data-battle-back="bag" aria-label="Retour">‹</button><div><small>SAC</small><strong>${title}</strong></div></header><div>${list}</div><footer>${blocked ? "Action en cours." : unavailable}</footer></div>`;
    this.bindBack(actions, model, "bag");
  }

  private bindBack(actions: HTMLElement, model: SourceBattleOverlayModel, destination: BattleMenu = "root"): void {
    actions.querySelector<HTMLButtonElement>("[data-battle-back]")?.addEventListener("click", () => {
      this.menu = destination;
      this.render(model);
    });
  }
}
