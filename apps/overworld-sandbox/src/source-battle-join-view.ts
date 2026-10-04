import type { BattleSide, BattleTeam } from "@pokemon-z-battle/battle-engine";
import type { RoomSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourceBattleJoinModel {
  readonly battle: RoomSnapshot["battle"];
  readonly playerId: string | null;
  readonly team: BattleTeam | null;
}

export class SourceBattleJoinView {
  #battleId: string | null = null;
  #side: BattleSide = "player";
  #selected = new Set<string>();

  public constructor(private readonly callbacks: {
    readonly onPropose: (side: BattleSide, finalMemberIds: readonly string[]) => void;
    readonly onRespond: (accept: boolean) => void;
  }) {}

  public render(model: SourceBattleJoinModel): void {
    const panel = document.querySelector<HTMLElement>("#battle-join-prompt");
    if (panel === null) return;
    const battle = model.battle;
    if (battle === null || battle.duel || battle.participation === null || model.playerId === null) {
      panel.hidden = true;
      return;
    }
    const participation = battle.participation;
    const proposal = battle.joinProposal;
    const joinedSide = (["player", "opponent"] as const)
      .find((side) => participation.camps[side].trainerIds.includes(model.playerId!));
    if (proposal !== null) {
      if (proposal.joinerId === model.playerId) {
        panel.hidden = false;
        panel.innerHTML = `<strong>Participation proposée</strong><p>En attente de l'accord du meneur du combat…</p>`;
        return;
      }
      if (proposal.requiredApprovals.includes(model.playerId) && !proposal.approvals.includes(model.playerId)) {
        panel.hidden = false;
        const camp = proposal.side === "player" ? "avec l'hôte" : "avec l'adversaire";
        panel.innerHTML = `<strong>Demande de participation</strong><p>L'invité souhaite combattre ${camp} avec ${proposal.finalMemberIds.length} Pokémon.</p>
          <ul>${proposal.members.map((member) => `<li>${escapeSourceHtml(member.battler.name)} · ${member.ownerId === proposal.joinerId ? "invité" : "équipe actuelle"}</li>`).join("")}</ul>
          <div><button id="accept-battle-join">Accepter</button><button id="refuse-battle-join">Refuser</button></div>`;
        panel.querySelector<HTMLButtonElement>("#accept-battle-join")?.addEventListener("click", () => this.callbacks.onRespond(true));
        panel.querySelector<HTMLButtonElement>("#refuse-battle-join")?.addEventListener("click", () => this.callbacks.onRespond(false));
        return;
      }
    }
    if (joinedSide !== undefined || model.team === null || battle.state.turn !== 1) {
      panel.hidden = true;
      return;
    }
    if (this.#battleId !== battle.id) {
      this.#battleId = battle.id;
      this.#side = "player";
      this.resetSelection(battle, model.team);
    }
    const camp = participation.camps[this.#side];
    const candidates = [...camp.members.map((member) => member.battler), ...model.team.members];
    panel.hidden = false;
    panel.innerHTML = `<strong>Rejoindre ce combat</strong><p>Choisis ton camp puis la composition finale (six Pokémon maximum).</p>
      <nav><button data-join-side="player" class="${this.#side === "player" ? "active" : ""}">Camp de l'hôte</button><button data-join-side="opponent" class="${this.#side === "opponent" ? "active" : ""}">Camp adverse</button></nav>
      <div class="battle-join-members">${candidates.map((member) => `<button data-join-member="${escapeSourceHtml(member.id)}" class="${this.#selected.has(member.id) ? "selected" : ""}">${escapeSourceHtml(member.name)} <small>N.${member.level}</small></button>`).join("")}</div>
      <footer><span>${this.#selected.size}/6 retenus</span><button id="submit-battle-join" ${this.validSelection(model.team) ? "" : "disabled"}>Proposer</button></footer>`;
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-join-side]")) button.addEventListener("click", () => {
      this.#side = button.dataset.joinSide as BattleSide;
      this.resetSelection(battle, model.team!);
      this.render(model);
    });
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-join-member]")) button.addEventListener("click", () => {
      const id = button.dataset.joinMember!;
      if (this.#selected.has(id)) this.#selected.delete(id);
      else if (this.#selected.size < 6) this.#selected.add(id);
      this.render(model);
    });
    panel.querySelector<HTMLButtonElement>("#submit-battle-join")?.addEventListener("click", () => {
      this.callbacks.onPropose(this.#side, [...this.#selected]);
    });
  }

  private resetSelection(battle: NonNullable<RoomSnapshot["battle"]>, team: BattleTeam): void {
    const existing = battle.participation!.camps[this.#side].members.map((member) => member.battler.id);
    const own = team.members.map((member) => member.id);
    this.#selected = new Set((this.#side === "player" ? [...existing, ...own] : own).slice(0, 6));
  }

  private validSelection(team: BattleTeam): boolean {
    return this.#selected.size > 0 && this.#selected.size <= 6
      && team.members.some((member) => this.#selected.has(member.id));
  }
}
