import type { BattleSide, BattleTeam } from "@pokemon-z-battle/battle-engine";
import type { RoomSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourceBattleJoinModel {
  readonly battle: RoomSnapshot["battle"];
  readonly playerId: string | null;
  readonly team: BattleTeam | null;
  readonly available: boolean;
  readonly ownerName: string;
  readonly opponentName: string;
}

export class SourceBattleJoinView {
  #battleId: string | null = null;
  #openedBattleId: string | null = null;
  #side: BattleSide = "player";
  #selected = new Set<string>();

  public constructor(private readonly callbacks: {
    readonly onPropose: (side: BattleSide, finalMemberIds: readonly string[]) => void;
    readonly onRespond: (accept: boolean) => void;
  }) {}

  public open(battleId: string): void { this.#openedBattleId = battleId; }
  public dismiss(): void { this.#openedBattleId = null; }

  public render(model: SourceBattleJoinModel): void {
    const panel = document.querySelector<HTMLElement>("#battle-join-prompt");
    if (panel === null) return;
    const battle = model.battle;
    if (battle === null || battle.duel || battle.participation === null || model.playerId === null) {
      panel.hidden = true;
      return;
    }
    const sourceWild = battle.sourceContext?.origin === "source-wild";
    const sourceTrainer = battle.sourceContext?.origin === "source-trainer";
    const joinableLifecycle = sourceWild
      ? battle.session.lifecycle === "join-window" || battle.session.lifecycle === "active"
      : battle.session.lifecycle === "join-window";
    if (!joinableLifecycle) {
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
        const camp = proposal.side === "player" ? `avec ${model.ownerName}` : `avec ${model.opponentName}`;
        panel.innerHTML = `<strong>Demande de participation</strong><p>L'invité souhaite combattre ${escapeSourceHtml(camp)} avec ${proposal.finalMemberIds.length} Pokémon.</p>
          <ul>${proposal.members.map((member) => `<li>${escapeSourceHtml(member.battler.name)} · ${member.ownerId === proposal.joinerId ? "invité" : "équipe actuelle"}${proposal.finalMemberIds.includes(member.battler.id) ? " · retenu" : ""}</li>`).join("")}</ul>
          <div><button id="accept-battle-join">Accepter</button><button id="refuse-battle-join">Refuser</button></div>`;
        panel.querySelector<HTMLButtonElement>("#accept-battle-join")?.addEventListener("click", () => this.callbacks.onRespond(true));
        panel.querySelector<HTMLButtonElement>("#refuse-battle-join")?.addEventListener("click", () => this.callbacks.onRespond(false));
        return;
      }
    }
    if (battle.observerIds.includes(model.playerId) || joinedSide !== undefined) {
      panel.hidden = true;
      return;
    }
    if (participation.battleOwnerId === model.playerId) {
      panel.hidden = !sourceTrainer;
      if (sourceTrainer) panel.innerHTML = `<strong>Combat de Dresseur</strong>
        <p>En attente de l'invité… Il doit venir interagir avec vous et choisir son camp avant l'envoi des Pokémon.</p>`;
      return;
    }
    if (this.#openedBattleId !== battle.id) {
      panel.hidden = true;
      return;
    }
    if (!model.available) {
      panel.hidden = false;
      const reason = !model.available ? "Tu dois être présent sur la carte partagée."
        : "Un combat double n'accepte pas de participant supplémentaire.";
      panel.innerHTML = `<strong>Participation indisponible</strong><p>${reason}</p>`;
      return;
    }
    if (model.team === null) {
      panel.hidden = false;
      panel.innerHTML = `<strong>Participation impossible</strong><p>Aucun Pokémon conscient n'est disponible pour rejoindre ce combat.</p>
        <footer><span>Soignez d'abord votre équipe.</span><button id="dismiss-battle-join">Fermer</button></footer>`;
      panel.querySelector<HTMLButtonElement>("#dismiss-battle-join")
        ?.addEventListener("click", () => { this.dismiss(); this.render(model); });
      return;
    }
    if (this.#battleId !== battle.id) {
      this.#battleId = battle.id;
      this.#side = "player";
      this.resetSelection(battle, model.team);
    }
    if (sourceWild && this.#side !== "player") {
      this.#side = "player";
      this.resetSelection(battle, model.team);
    }
    const camp = participation.camps[this.#side];
    const existingIds = new Set(camp.members.map((member) => member.battler.id));
    const ownCandidates = model.team.members.filter((member) => !existingIds.has(member.id));
    panel.hidden = false;
    const refusal = battle.joinRefusal?.playerId === model.playerId
      ? `<p class="battle-join-refusal">${escapeSourceHtml(battle.joinRefusal.reason)}</p>` : "";
    const title = sourceWild ? `Aider ${escapeSourceHtml(model.ownerName)}` : "Rejoindre ce combat";
    const description = sourceWild ? `Choisis les Pokémon qui aideront ${escapeSourceHtml(model.ownerName)}.`
      : "Choisis ton camp puis la composition finale (six Pokémon maximum).";
    const campChoices = sourceWild ? "" : `<nav><button data-join-side="player" class="${this.#side === "player" ? "active" : ""}>Aider ${escapeSourceHtml(model.ownerName)}</button><button data-join-side="opponent" class="${this.#side === "opponent" ? "active" : ""}>Se rallier à ${escapeSourceHtml(model.opponentName)}</button></nav>`;
    panel.innerHTML = `<strong>${title}</strong><p>${description}</p>${refusal}${campChoices}
      <div class="battle-join-members">${camp.members.map((member) =>
        `<span class="battle-join-fixed">${escapeSourceHtml(member.battler.name)} <small>N.${member.battler.level} · équipe de l'autre Dresseur · conservé</small></span>`).join("")}${ownCandidates.map((member) => {
        const owner = camp.members.some((entry) => entry.battler.id === member.id) ? "équipe actuelle" : "ton équipe";
        const active = camp.activeMemberId === member.id ? " · actif" : "";
        return `<button data-join-member="${escapeSourceHtml(member.id)}" class="${this.#selected.has(member.id) ? "selected" : ""}">${escapeSourceHtml(member.name)} <small>N.${member.level} · ${owner}${active}</small></button>`;
      }).join("")}</div>
      <footer><span>${this.#selected.size}/6 retenus</span><button id="dismiss-battle-join">Annuler</button><button id="submit-battle-join" ${this.validSelection(model.team) ? "" : "disabled"}>Confirmer</button></footer>`;
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-join-side]")) button.addEventListener("click", () => {
      this.#side = button.dataset.joinSide as BattleSide;
      this.resetSelection(battle, model.team!);
      this.render(model);
    });
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-join-member]")) button.addEventListener("click", () => {
      const id = button.dataset.joinMember!;
      if (this.#selected.has(id)) this.#selected.delete(id);
      else {
        const ownSelected = model.team!.members.filter((member) => this.#selected.has(member.id)).length;
        if (this.#selected.size < 6 && ownSelected < 3) this.#selected.add(id);
      }
      this.render(model);
    });
    panel.querySelector<HTMLButtonElement>("#submit-battle-join")?.addEventListener("click", () => {
      this.callbacks.onPropose(this.#side, [...this.#selected]);
    });
    panel.querySelector<HTMLButtonElement>("#dismiss-battle-join")
      ?.addEventListener("click", () => { this.dismiss(); this.render(model); });
  }

  private resetSelection(battle: NonNullable<RoomSnapshot["battle"]>, team: BattleTeam): void {
    const existing = battle.participation!.camps[this.#side].members.map((member) => member.battler.id);
    const own = team.members.map((member) => member.id);
    this.#selected = new Set([...existing, ...own.slice(0, Math.min(3, Math.max(0, 6 - existing.length)))]);
  }

  private validSelection(team: BattleTeam): boolean {
    return this.#selected.size > 0 && this.#selected.size <= 6
      && team.members.some((member) => this.#selected.has(member.id))
      && team.members.filter((member) => this.#selected.has(member.id)).length <= 3;
  }
}
