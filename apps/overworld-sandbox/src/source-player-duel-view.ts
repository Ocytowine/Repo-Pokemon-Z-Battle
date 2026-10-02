import type { BattleSide } from "@pokemon-z-battle/battle-engine";
import type { PlayerDuelChallenge, RoomPlayerSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourcePlayerDuelModel {
  readonly challenge: PlayerDuelChallenge | null;
  readonly side: BattleSide | null;
  readonly players: readonly RoomPlayerSnapshot[];
  readonly canAccept: boolean;
}

export class SourcePlayerDuelView {
  public constructor(private readonly callbacks: { readonly onAccept: () => void; readonly onRefuse: () => void }) {}

  public render(model: SourcePlayerDuelModel): void {
    const panel = document.querySelector<HTMLElement>("#player-duel-prompt");
    if (panel === null) return;
    const challenge = model.challenge;
    panel.hidden = challenge === null || model.side === null;
    if (challenge === null || model.side === null) return;
    const challenged = model.side === challenge.challenged;
    const otherSide = challenged ? challenge.challenger : challenge.challenged;
    const other = model.players.find((player) => player.side === otherSide);
    const name = other?.profile.profile.displayName ?? "L'autre joueur";
    panel.innerHTML = challenged
      ? `<strong>${escapeSourceHtml(name)} vous défie !</strong><p>Accepter un combat Pokémon classique ?</p><div><button id="accept-player-duel" ${model.canAccept ? "" : "disabled"}>Accepter</button><button id="refuse-player-duel">Refuser</button></div>${model.canAccept ? "" : "<small>Il faut au moins un Pokémon en état de combattre.</small>"}`
      : `<strong>Défi envoyé à ${escapeSourceHtml(name)}</strong><p>En attente de sa réponse…</p><button id="refuse-player-duel">Annuler</button>`;
    panel.querySelector<HTMLButtonElement>("#accept-player-duel")?.addEventListener("click", this.callbacks.onAccept);
    panel.querySelector<HTMLButtonElement>("#refuse-player-duel")?.addEventListener("click", this.callbacks.onRefuse);
  }
}
