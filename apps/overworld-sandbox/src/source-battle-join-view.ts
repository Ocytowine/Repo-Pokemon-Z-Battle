import type { BattleSide, BattleTeam } from "@pokemon-z-battle/battle-engine";
import type { RoomSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourceBattleJoinModel {
  readonly battle: RoomSnapshot["battle"];
  readonly playerId: string | null;
  readonly team: BattleTeam | null;
  readonly available: boolean;
}

export class SourceBattleJoinView {
  #battleId: string | null = null;
  #side: BattleSide = "player";
  #selected = new Set<string>();

  public constructor(private readonly callbacks: {
    readonly onPropose: (side: BattleSide, finalMemberIds: readonly string[]) => void;
    readonly onRespond: (accept: boolean) => void;
    readonly onObserve: () => void;
    readonly onClose: () => void;
  }) {}

  public render(model: SourceBattleJoinModel): void {
    const panel = document.querySelector<HTMLElement>("#battle-join-prompt");
    if (panel === null) return;
    const battle = model.battle;
    if (battle === null || battle.duel || battle.participation === null || model.playerId === null
      || battle.session.lifecycle !== "join-window") {
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
          <ul>${proposal.members.map((member) => `<li>${escapeSourceHtml(member.battler.name)} · ${member.ownerId === proposal.joinerId ? "invité" : "équipe actuelle"}${proposal.finalMemberIds.includes(member.battler.id) ? " · retenu" : ""}</li>`).join("")}</ul>
          <div><button id="accept-battle-join">Accepter</button><button id="refuse-battle-join">Refuser</button></div>`;
        panel.querySelector<HTMLButtonElement>("#accept-battle-join")?.addEventListener("click", () => this.callbacks.onRespond(true));
        panel.querySelector<HTMLButtonElement>("#refuse-battle-join")?.addEventListener("click", () => this.callbacks.onRespond(false));
        return;
      }
    }
    if (battle.observerIds.includes(model.playerId)) {
      panel.hidden = true;
      return;
    }
    if (participation.battleOwnerId === model.playerId) {
      panel.hidden = false;
      panel.innerHTML = `<strong>Participation au combat</strong>
        <p>L'invité peut encore observer ou proposer une composition. Le premier tour fermera aussi cette fenêtre.</p>
        ${this.campsHtml(battle)}
        ${battle.observerIds.length > 0 ? "<p>L'invité a choisi de rester observateur.</p>" : ""}
        <footer><span>Fenêtre ouverte</span><button id="close-battle-join">Commencer sans autre changement</button></footer>`;
      panel.querySelector<HTMLButtonElement>("#close-battle-join")
        ?.addEventListener("click", () => this.callbacks.onClose());
      return;
    }
    if (joinedSide !== undefined) {
      panel.hidden = true;
      return;
    }
    if (!model.available || participation.format === "double" || battle.state.turn !== 1) {
      panel.hidden = false;
      const reason = !model.available ? "Tu dois être présent sur la carte partagée."
        : participation.format === "double" ? "Un combat double n'accepte pas de participant supplémentaire."
          : "Le premier tour a déjà commencé.";
      panel.innerHTML = `<strong>Participation indisponible</strong><p>${reason}</p>`;
      return;
    }
    if (model.team === null) {
      panel.hidden = false;
      panel.innerHTML = `<strong>Observer le combat</strong><p>Aucun Pokémon conscient n'est disponible pour rejoindre un camp.</p>
        <footer><span>Participation impossible</span><button id="observe-battle">Observer</button></footer>`;
      panel.querySelector<HTMLButtonElement>("#observe-battle")
        ?.addEventListener("click", () => this.callbacks.onObserve());
      return;
    }
    if (this.#battleId !== battle.id) {
      this.#battleId = battle.id;
      this.#side = "player";
      this.resetSelection(battle, model.team);
    }
    const camp = participation.camps[this.#side];
    const candidates = [...new Map([...camp.members.map((member) => member.battler), ...model.team.members]
      .map((member) => [member.id, member])).values()];
    panel.hidden = false;
    const refusal = battle.joinRefusal?.playerId === model.playerId
      ? `<p class="battle-join-refusal">${escapeSourceHtml(battle.joinRefusal.reason)}</p>` : "";
    panel.innerHTML = `<strong>Rejoindre ce combat</strong><p>Choisis ton camp puis la composition finale (six Pokémon maximum), ou reste observateur.</p>${refusal}
      <nav><button data-join-side="player" class="${this.#side === "player" ? "active" : ""}">Camp de l'hôte</button><button data-join-side="opponent" class="${this.#side === "opponent" ? "active" : ""}">Camp adverse</button></nav>
      <div class="battle-join-members">${candidates.map((member) => {
        const owner = camp.members.some((entry) => entry.battler.id === member.id) ? "équipe actuelle" : "ton équipe";
        const active = camp.activeMemberId === member.id ? " · actif" : "";
        return `<button data-join-member="${escapeSourceHtml(member.id)}" class="${this.#selected.has(member.id) ? "selected" : ""}">${escapeSourceHtml(member.name)} <small>N.${member.level} · ${owner}${active}</small></button>`;
      }).join("")}</div>
      <footer><span>${this.#selected.size}/6 retenus</span><button id="observe-battle">Observer</button><button id="submit-battle-join" ${this.validSelection(model.team) ? "" : "disabled"}>Proposer</button></footer>`;
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
    panel.querySelector<HTMLButtonElement>("#observe-battle")
      ?.addEventListener("click", () => this.callbacks.onObserve());
  }

  private resetSelection(battle: NonNullable<RoomSnapshot["battle"]>, team: BattleTeam): void {
    const existing = battle.participation!.camps[this.#side].members.map((member) => member.battler.id);
    const own = team.members.map((member) => member.id);
    this.#selected = new Set([...existing, ...own].slice(0, 6));
  }

  private validSelection(team: BattleTeam): boolean {
    return this.#selected.size > 0 && this.#selected.size <= 6
      && team.members.some((member) => this.#selected.has(member.id));
  }

  private campsHtml(battle: NonNullable<RoomSnapshot["battle"]>): string {
    const participation = battle.participation!;
    return `<div class="battle-join-camps">${(["player", "opponent"] as const).map((side) => {
      const camp = participation.camps[side];
      const label = side === "player" ? "Camp de l'hôte" : "Camp adverse";
      return `<section><b>${label}</b><ul>${camp.members.map((member) => {
        const owner = member.ownerId === null ? "adversaire source" : escapeSourceHtml(member.ownerId);
        const active = member.battler.id === camp.activeMemberId ? " · actif" : "";
        return `<li>${escapeSourceHtml(member.battler.name)} · ${owner}${active}</li>`;
      }).join("")}</ul></section>`;
    }).join("")}</div>`;
  }
}
