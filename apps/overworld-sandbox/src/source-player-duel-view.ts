import type { BattleSide } from "@pokemon-z-battle/battle-engine";
import type { PlayerDuelChallenge, RoomPlayerSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourcePlayerDuelModel {
  readonly challenge: PlayerDuelChallenge | null;
  readonly battleActive: boolean;
  readonly side: BattleSide | null;
  readonly players: readonly RoomPlayerSnapshot[];
  readonly canAccept: boolean;
  readonly unavailableReason?: string | null;
  readonly teamNotice?: string | null;
  readonly teamDiagnostic?: string | null;
}

export class SourcePlayerDuelView {
  public constructor(private readonly callbacks: { readonly onAccept: () => void; readonly onRefuse: () => void }) {}

  public render(model: SourcePlayerDuelModel): void {
    const panel = document.querySelector<HTMLElement>("#player-duel-prompt");
    if (panel === null) return;
    const challenge = model.challenge;
    const hidden = challenge === null || model.side === null || model.battleActive;
    panel.hidden = hidden;
    if (challenge === null || model.side === null || model.battleActive) {
      panel.replaceChildren();
      return;
    }
    const challenged = model.side === challenge.challenged;
    const otherSide = challenged ? challenge.challenger : challenge.challenged;
    const other = model.players.find((player) => player.side === otherSide);
    const name = other?.profile.profile.displayName ?? "L'autre joueur";
    const unavailable = model.unavailableReason ?? "Il faut au moins un Pokémon en état de combattre.";
    const diagnostic = model.teamDiagnostic === undefined || model.teamDiagnostic === null ? ""
      : `<small>État lu par le combat : ${escapeSourceHtml(model.teamDiagnostic)}</small>`;
    const notice = model.teamNotice === undefined || model.teamNotice === null ? ""
      : `<small>${escapeSourceHtml(model.teamNotice)}</small>`;
    panel.innerHTML = challenged
      ? `<strong>${escapeSourceHtml(name)} vous défie !</strong><p>Accepter un combat Pokémon classique ?</p><div><button id="accept-player-duel" ${model.canAccept ? "" : "disabled"}>Accepter</button><button id="refuse-player-duel">Refuser</button></div>${model.canAccept ? notice : `<small>${escapeSourceHtml(unavailable)}</small>${diagnostic}`}`
      : `<strong>Défi envoyé à ${escapeSourceHtml(name)}</strong><p>En attente de sa réponse…</p><button id="refuse-player-duel">Annuler</button>`;
    panel.querySelector<HTMLButtonElement>("#accept-player-duel")?.addEventListener("click", this.callbacks.onAccept);
    panel.querySelector<HTMLButtonElement>("#refuse-player-duel")?.addEventListener("click", this.callbacks.onRefuse);
  }
}
