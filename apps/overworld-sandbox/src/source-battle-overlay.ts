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
  readonly onRenderLocalVisuals: () => void;
  readonly onMove: (moveIndex: number, local: boolean) => void;
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
    if (visualStage !== null) visualStage.hidden = !model.local;
    if (model.local) this.callbacks.onRenderLocalVisuals();
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
    this.renderActions(model, player.moves);
  }

  private renderActions(model: SourceBattleOverlayModel,
    moves: TeamBattleState["teams"]["player"]["members"][number]["moves"]): void {
    const actions = document.querySelector<HTMLElement>("#encounter-actions");
    if (actions === null || model.state === null) return;
    actions.innerHTML = moves.map((slot, index) => {
      const disabled = slot.pp <= 0 || (model.local && model.animating)
        || (!model.local && (model.networkSide !== "player" || model.networkSubmittedTurn === model.state?.turn));
      return `<button data-encounter-move="${index}" ${disabled ? "disabled" : ""}>${escapeSourceHtml(slot.move.name)}<small>${slot.pp} PP</small></button>`;
    }).join("") + (model.local && model.escapable
      ? `<button id="escape-source-encounter" ${model.animating ? "disabled" : ""}>Fuir<small>Quitter le combat sauvage</small></button>` : "");
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-move]").forEach((button) =>
      button.addEventListener("click", () => {
        const moveIndex = Number(button.dataset.encounterMove);
        if (Number.isInteger(moveIndex)) this.callbacks.onMove(moveIndex, model.local);
      }));
    actions.querySelector<HTMLButtonElement>("#escape-source-encounter")
      ?.addEventListener("click", this.callbacks.onEscape);
  }
}
