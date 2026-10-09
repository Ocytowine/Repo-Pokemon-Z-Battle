import type { BattleSide, BattleTeam } from "@pokemon-z-battle/battle-engine";
import type { RoomSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourceBattleJoinModel {
  readonly battle: RoomSnapshot["battle"];
  readonly playerId: string | null;
  readonly team: BattleTeam | null;
  readonly available: boolean;
  readonly ownerName: string;
  readonly guestName: string;
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
    readonly onInvite: () => void;
    readonly onContinue: () => void;
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
    const participation = battle.participation;
    const proposal = battle.joinProposal;
    panel.classList.remove("compact");

    // Une proposition en attente passe avant le panneau générique de l'hôte :
    // sinon la room attend une réponse que l'interface ne permet jamais d'envoyer.
    if (proposal !== null) {
      if (proposal.joinerId === model.playerId) {
        panel.hidden = false;
        const camp = proposal.side === "player"
          ? `Avec ${escapeSourceHtml(model.ownerName)}`
          : `Avec ${escapeSourceHtml(model.opponentName)}`;
        const pokemon = proposal.members.filter((member) => member.ownerId === proposal.joinerId)
          .map((member) => escapeSourceHtml(member.battler.name)).join(", ");
        panel.innerHTML = `<strong>Demande envoyée</strong>
          <p>${escapeSourceHtml(model.ownerName)} doit maintenant accepter ou refuser ta participation.</p>
          <div class="battle-join-summary"><span>Camp choisi</span><b>${camp}</b>
            <span>Tes Pokémon</span><b>${pokemon}</b></div>`;
        return;
      }
      if (proposal.requiredApprovals.includes(model.playerId) && !proposal.approvals.includes(model.playerId)) {
        panel.hidden = false;
        const camp = proposal.side === "player" ? `Aider ${model.ownerName}` : `Aider ${model.opponentName}`;
        const guestMembers = proposal.members.filter((member) => member.ownerId === proposal.joinerId);
        const fixedMembers = proposal.members.filter((member) => member.ownerId !== proposal.joinerId);
        panel.innerHTML = `<strong>Confirmer la participation</strong>
          <p>L'autre joueur souhaite rejoindre le combat. Vérifie son camp et ses Pokémon avant de répondre.</p>
          <div class="battle-join-summary"><span>Camp choisi</span><b>${escapeSourceHtml(camp)}</b>
            <span>Ses Pokémon</span><b>${guestMembers.map((member) => escapeSourceHtml(member.battler.name)).join(", ")}</b>
            <span>Déjà dans ce camp</span><b>${fixedMembers.map((member) => escapeSourceHtml(member.battler.name)).join(", ") || "Aucun"}</b></div>
          <footer><button id="refuse-battle-join">Refuser</button><button id="accept-battle-join" class="primary">Accepter et lancer le combat</button></footer>`;
        panel.querySelector<HTMLButtonElement>("#accept-battle-join")
          ?.addEventListener("click", () => this.callbacks.onRespond(true));
        panel.querySelector<HTMLButtonElement>("#refuse-battle-join")
          ?.addEventListener("click", () => this.callbacks.onRespond(false));
        return;
      }
    }

    if (sourceTrainer && participation.battleOwnerId === model.playerId
      && (battle.session.lifecycle === "invite-choice" || battle.session.lifecycle === "join-window")) {
      panel.classList.add("compact");
      panel.hidden = false;
      if (battle.session.lifecycle === "invite-choice") {
        panel.innerHTML = `<strong>Appeler ${escapeSourceHtml(model.guestName)} ?</strong>
          <p>Vous pouvez continuer seul ou lui proposer de rejoindre ce combat.</p>
          <div><button id="continue-trainer-battle">Continuer seul</button><button id="invite-battle-join">Appeler</button></div>`;
        panel.querySelector<HTMLButtonElement>("#invite-battle-join")?.addEventListener("click", this.callbacks.onInvite);
      } else {
        panel.innerHTML = `<strong>${escapeSourceHtml(model.guestName)} a été appelé</strong>
          <p>Il doit venir interagir avec vous puis choisir son camp et ses Pokémon.</p>
          <div><button id="continue-trainer-battle">Continuer sans lui</button></div>`;
      }
      panel.querySelector<HTMLButtonElement>("#continue-trainer-battle")
        ?.addEventListener("click", this.callbacks.onContinue);
      return;
    }

    const joinableLifecycle = sourceWild
      ? battle.session.lifecycle === "join-window" || battle.session.lifecycle === "active"
      : battle.session.lifecycle === "join-window";
    if (!joinableLifecycle) {
      panel.hidden = true;
      return;
    }

    const joinedSide = (["player", "opponent"] as const)
      .find((side) => participation.camps[side].trainerIds.includes(model.playerId!));
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
      panel.innerHTML = `<strong>Participation indisponible</strong><p>Tu dois être présent sur la carte partagée.</p>`;
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
    const ownLimit = Math.min(3, Math.max(0, 6 - camp.members.length));
    this.#selected = new Set([...this.#selected]
      .filter((id) => ownCandidates.some((member) => member.id === id && member.hp > 0)));
    panel.hidden = false;
    const refusal = battle.joinRefusal?.playerId === model.playerId
      ? `<p class="battle-join-refusal">${escapeSourceHtml(battle.joinRefusal.reason)}</p>` : "";
    const title = sourceWild ? `Aider ${escapeSourceHtml(model.ownerName)}` : "Rejoindre ce combat";
    const description = sourceWild ? `Choisis les Pokémon qui aideront ${escapeSourceHtml(model.ownerName)}.`
      : "Choisis d'abord ton camp, puis uniquement les Pokémon de ton équipe que tu veux engager.";
    const campChoices = sourceWild ? "" : `<section class="battle-join-step"><h3>1. Choisir ton camp</h3>
      <nav class="battle-join-side-choices"><button data-join-side="player" class="${this.#side === "player" ? "active" : ""}><small>COOPÉRER</small>Aider ${escapeSourceHtml(model.ownerName)}</button>
      <button data-join-side="opponent" class="${this.#side === "opponent" ? "active" : ""}><small>S'OPPOSER</small>Aider ${escapeSourceHtml(model.opponentName)}</button></nav></section>`;
    const fixedNames = camp.members.map((member) => escapeSourceHtml(member.battler.name)).join(", ");
    panel.innerHTML = `<strong>${title}</strong><p>${description}</p>${refusal}${campChoices}
      <section class="battle-join-step"><h3>${sourceWild ? "1" : "2"}. Choisir tes Pokémon</h3>
        <p class="battle-join-fixed">Déjà dans ce camp, sans modification : <b>${fixedNames}</b></p>
        ${ownLimit === 0 ? `<p class="battle-join-refusal">Ce camp possède déjà six Pokémon et ne peut pas recevoir de participant supplémentaire.</p>` : ""}
        <div class="battle-join-members">${ownCandidates.map((member) => {
          const selected = this.#selected.has(member.id);
          const unavailable = member.hp <= 0;
          return `<button data-join-member="${escapeSourceHtml(member.id)}" class="${selected ? "selected" : ""}" ${unavailable ? "disabled" : ""} aria-pressed="${selected}"><i>${selected ? "✓" : ""}</i><span>${escapeSourceHtml(member.name)} <small>N.${member.level} · ${member.hp}/${member.stats.maxHp} PV${unavailable ? " · K.O." : ""}</small></span></button>`;
        }).join("")}</div>
      </section>
      <footer><span><b>${this.#selected.size}/${ownLimit}</b> de tes Pokémon sélectionnés</span><button id="dismiss-battle-join">Annuler</button><button id="submit-battle-join" class="primary" ${this.validSelection(model.team, ownLimit) ? "" : "disabled"}>Envoyer la demande</button></footer>`;
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-join-side]")) button.addEventListener("click", () => {
      this.#side = button.dataset.joinSide as BattleSide;
      this.resetSelection(battle, model.team!);
      this.render(model);
    });
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-join-member]")) button.addEventListener("click", () => {
      const id = button.dataset.joinMember!;
      if (this.#selected.has(id)) this.#selected.delete(id);
      else if (this.#selected.size < ownLimit) this.#selected.add(id);
      this.render(model);
    });
    panel.querySelector<HTMLButtonElement>("#submit-battle-join")?.addEventListener("click", () => {
      this.callbacks.onPropose(this.#side,
        [...camp.members.map((member) => member.battler.id), ...this.#selected]);
    });
    panel.querySelector<HTMLButtonElement>("#dismiss-battle-join")
      ?.addEventListener("click", () => { this.dismiss(); this.render(model); });
  }

  private resetSelection(battle: NonNullable<RoomSnapshot["battle"]>, team: BattleTeam): void {
    const existingCount = battle.participation!.camps[this.#side].members.length;
    const ownLimit = Math.min(3, Math.max(0, 6 - existingCount));
    const active = team.members[team.activeIndex];
    const ordered = [active, ...team.members].filter((member, index, members) => member !== undefined
      && member.hp > 0 && members.findIndex((candidate) => candidate?.id === member.id) === index);
    this.#selected = new Set(ordered.slice(0, ownLimit).map((member) => member!.id));
  }

  private validSelection(team: BattleTeam, ownLimit: number): boolean {
    return this.#selected.size > 0 && this.#selected.size <= ownLimit
      && [...this.#selected].every((id) => team.members.some((member) => member.id === id && member.hp > 0));
  }
}
