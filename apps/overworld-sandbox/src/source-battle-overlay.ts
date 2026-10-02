import type { BattleSide, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourceBattleOverlayModel {
  readonly state: TeamBattleState | null;
  readonly local: boolean;
  readonly animating: boolean;
  readonly networkSide: BattleSide | null;
  readonly networkSubmittedTurn: number | null;
  readonly escapable: boolean;
}

export interface SourceBattleOverlayCallbacks {
  readonly onRenderVisuals: (state: TeamBattleState, local: boolean) => void;
  readonly onMove: (moveIndex: number, local: boolean) => void;
  readonly onSwitch: (teamIndex: number) => void;
  readonly onReplacement: (teamIndex: number) => void;
  readonly onLeave: () => void;
  readonly onEscape: () => void;
}

export function sourceBattleSummary(state: TeamBattleState, observing: boolean): string {
  const playerTeam = state.teams.player;
  const opponentTeam = state.teams.opponent;
  const player = playerTeam.members[playerTeam.activeIndex];
  const opponent = opponentTeam.members[opponentTeam.activeIndex];
  if (player === undefined || opponent === undefined) return "";
  return `${player.hp}/${player.stats.maxHp} PV · ${opponent.hp}/${opponent.stats.maxHp} PV${observing ? " · observation" : ""}`;
}

export class SourceBattleOverlay {
  public constructor(private readonly callbacks: SourceBattleOverlayCallbacks) {}

  public render(model: SourceBattleOverlayModel): void {
    const panel = document.querySelector<HTMLElement>("#encounter-panel");
    if (panel === null) return;
    panel.hidden = model.state === null;
    if (model.state === null) return;
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
      !model.local && model.networkSide === "opponent");
    this.renderActions(model);
  }

  private renderActions(model: SourceBattleOverlayModel): void {
    const actions = document.querySelector<HTMLElement>("#encounter-actions");
    if (actions === null || model.state === null) return;
    const side: BattleSide = model.local ? "player" : model.networkSide ?? "player";
    const team = model.state.teams[side];
    const active = team.members[team.activeIndex];
    if (active === undefined) return;
    if (!model.local && model.state.status === "finished") {
      const result = model.state.winner === side ? "Victoire !" : "Défaite.";
      actions.innerHTML = `<button id="leave-player-duel">${result}<small>Retour au jeu</small></button>`;
      actions.querySelector<HTMLButtonElement>("#leave-player-duel")?.addEventListener("click", this.callbacks.onLeave);
      return;
    }
    const submitted = !model.local && model.networkSubmittedTurn === model.state.turn;
    const replacement = !model.local && model.state.replacementRequired.includes(side);
    const choices = team.members.map((member, index) => ({ member, index }))
      .filter(({ member, index }) => index !== team.activeIndex && member.hp > 0);
    if (replacement) {
      actions.innerHTML = choices.map(({ member, index }) =>
        `<button data-encounter-replacement="${index}" ${submitted || model.animating ? "disabled" : ""}>${escapeSourceHtml(member.name)}<small>${member.hp}/${member.stats.maxHp} PV</small></button>`).join("");
      actions.querySelectorAll<HTMLButtonElement>("[data-encounter-replacement]").forEach((button) =>
        button.addEventListener("click", () => this.callbacks.onReplacement(Number(button.dataset.encounterReplacement))));
      return;
    }
    actions.innerHTML = active.moves.map((slot, index) => {
      const disabled = slot.pp <= 0 || model.animating
        || submitted;
      return `<button data-encounter-move="${index}" ${disabled ? "disabled" : ""}>${escapeSourceHtml(slot.move.name)}<small>${slot.pp} PP</small></button>`;
    }).join("") + (!model.local ? choices.map(({ member, index }) =>
      `<button data-encounter-switch="${index}" ${submitted || model.animating ? "disabled" : ""}>Changer : ${escapeSourceHtml(member.name)}<small>${member.hp}/${member.stats.maxHp} PV</small></button>`).join("") : "")
      + (model.local && model.escapable
      ? `<button id="escape-source-encounter" ${model.animating ? "disabled" : ""}>Fuir<small>Quitter le combat sauvage</small></button>` : "");
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-move]").forEach((button) =>
      button.addEventListener("click", () => {
        const moveIndex = Number(button.dataset.encounterMove);
        if (Number.isInteger(moveIndex)) this.callbacks.onMove(moveIndex, model.local);
      }));
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-switch]").forEach((button) =>
      button.addEventListener("click", () => this.callbacks.onSwitch(Number(button.dataset.encounterSwitch))));
    actions.querySelector<HTMLButtonElement>("#escape-source-encounter")
      ?.addEventListener("click", this.callbacks.onEscape);
  }
}
