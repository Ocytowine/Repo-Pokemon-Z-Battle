import type { PlayerPartyState } from "@pokemon-z-battle/player-state";
import { sourceEggHatchMessage, type SourceIncubatorState } from "./source-incubator.js";

export interface SourceIncubatorViewModel {
  readonly open: boolean;
  readonly party: PlayerPartyState;
  readonly incubator: SourceIncubatorState;
}

type PendingAction = { readonly kind: "deposit"; readonly slot: number; readonly pokemonId: string }
  | { readonly kind: "party" | "ranch"; readonly slot: number };

function eggCycle(steps: number): number {
  if (steps < 1_275) return 250;
  if (steps < 2_550) return 500;
  if (steps < 10_200) return 750;
  return 1_000;
}

function eggIcon(steps: number): string {
  return `<span class="source-incubator-egg-icon" style="--source-egg-cycle:${eggCycle(steps)}ms" aria-hidden="true"></span>`;
}

export class SourceIncubatorView {
  private selectedSlot: number | null = null;
  private pending: PendingAction | null = null;
  private wasOpen = false;

  public constructor(private readonly onClose: () => void,
    private readonly onDeposit: (pokemonId: string, slot: number) => void,
    private readonly onWithdraw: (slot: number, destination: "party" | "ranch") => void) {}

  public render(model: SourceIncubatorViewModel): void {
    const root = document.querySelector<HTMLElement>("#source-incubator");
    if (root === null) return;
    root.hidden = !model.open;
    if (!model.open) { this.wasOpen = false; this.selectedSlot = null; this.pending = null; return; }
    if (!this.wasOpen) { this.selectedSlot = null; this.pending = null; }
    this.wasOpen = true;
    const partyEggs = model.party.members.filter((pokemon) => pokemon.metadata.eggSteps > 0);
    const occupied = model.incubator.slots.filter((egg) => egg !== null).length;
    const slots = model.incubator.slots.map((egg, index) => egg === null
      ? `<button type="button" class="source-incubator-slot empty" data-incubator-slot="${index}"><span>+</span><strong>Place ${index + 1}</strong><small>Emplacement libre</small></button>`
      : `<button type="button" class="source-incubator-slot occupied" data-incubator-slot="${index}">${eggIcon(egg.metadata.eggSteps)}<strong>Œuf Pokémon</strong><small>${sourceEggHatchMessage(egg.metadata.eggSteps)}</small><em>${egg.metadata.eggSteps.toLocaleString("fr-FR")} pas</em></button>`).join("");
    let overlay = "";
    const selectedEgg = this.selectedSlot === null ? null : model.incubator.slots[this.selectedSlot] ?? null;
    if (this.selectedSlot !== null && selectedEgg === null && this.pending === null) {
      overlay = `<div class="source-day-care-dialog-backdrop"><section class="source-incubator-dialog" role="dialog" aria-modal="true"><header><div><small>EMPLACEMENT ${this.selectedSlot + 1}</small><h2>Placer un Œuf</h2></div><button type="button" data-incubator-cancel>×</button></header>
        ${partyEggs.length === 0 ? `<p>Aucun Œuf n’est actuellement présent dans votre équipe.</p>`
          : `<div class="source-incubator-party-eggs">${partyEggs.map((egg, index) => `<button type="button" data-incubator-deposit="${egg.id}">${eggIcon(egg.metadata.eggSteps)}<span><strong>Œuf Pokémon ${index + 1}</strong><small>${sourceEggHatchMessage(egg.metadata.eggSteps)}</small><em>${egg.metadata.eggSteps.toLocaleString("fr-FR")} pas restants</em></span></button>`).join("")}</div>`}</section></div>`;
    } else if (this.selectedSlot !== null && selectedEgg !== null && this.pending === null) {
      overlay = `<div class="source-day-care-dialog-backdrop"><section class="source-incubator-dialog" role="dialog" aria-modal="true"><header><div><small>EMPLACEMENT ${this.selectedSlot + 1}</small><h2>Œuf Pokémon</h2></div><button type="button" data-incubator-cancel>×</button></header>
        <div class="source-incubator-selected">${eggIcon(selectedEgg.metadata.eggSteps)}<div><strong>${sourceEggHatchMessage(selectedEgg.metadata.eggSteps)}</strong><small>${selectedEgg.metadata.eggSteps.toLocaleString("fr-FR")} pas restants</small></div></div>
        <div class="source-incubator-actions"><button type="button" data-incubator-withdraw="party"${model.party.members.length >= 6 ? " disabled" : ""}><strong>Ajouter à l’équipe</strong><small>${model.party.members.length >= 6 ? "Équipe complète" : `${model.party.members.length}/6 Pokémon`}</small></button><button type="button" data-incubator-withdraw="ranch"><strong>Envoyer au Ranch</strong><small>Conserver l’Œuf hors de l’Incubateur</small></button></div></section></div>`;
    }
    if (this.pending !== null) {
      const destination = this.pending.kind === "deposit" ? `placer cet Œuf dans l’emplacement ${this.pending.slot + 1}`
        : this.pending.kind === "party" ? "ajouter cet Œuf à l’équipe" : "envoyer cet Œuf au Ranch";
      overlay = `<div class="source-day-care-dialog-backdrop"><section class="source-day-care-confirm" role="alertdialog" aria-modal="true"><small>CONFIRMATION</small><h3>Confirmer le transfert ?</h3><p>Voulez-vous ${destination} ?</p><footer><button type="button" data-incubator-confirm-cancel>Annuler</button><button type="button" class="primary" data-incubator-confirm>Confirmer</button></footer></section></div>`;
    }
    root.innerHTML = `<section class="source-incubator-panel"><header><div><small>OBJET IMPORTANT</small><h1>Incubateur</h1><p>Les Œufs stockés ici ne prennent aucune place dans l’équipe.</p></div><span>${occupied}/6</span><button type="button" data-incubator-close aria-label="Fermer">×</button></header><main><div class="source-incubator-grid">${slots}</div><aside><small>ÉTAT DE L’INCUBATEUR</small><strong>${occupied === 0 ? "Aucun Œuf" : `${occupied} Œuf${occupied > 1 ? "s" : ""} en incubation`}</strong><p>Marchez pour faire progresser les Œufs. Corps Ardent et Armumagma accélèrent leur éclosion.</p></aside></main>${overlay}</section>`;
    root.querySelector<HTMLButtonElement>("[data-incubator-close]")?.addEventListener("click", this.onClose);
    root.querySelectorAll<HTMLButtonElement>("[data-incubator-slot]").forEach((button) => button.addEventListener("click", () => {
      this.selectedSlot = Number(button.dataset.incubatorSlot); this.pending = null; this.render(model);
    }));
    root.querySelector<HTMLButtonElement>("[data-incubator-cancel]")?.addEventListener("click", () => {
      this.selectedSlot = null; this.render(model);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-incubator-deposit]").forEach((button) => button.addEventListener("click", () => {
      if (this.selectedSlot === null || button.dataset.incubatorDeposit === undefined) return;
      this.pending = { kind: "deposit", slot: this.selectedSlot, pokemonId: button.dataset.incubatorDeposit };
      this.render(model);
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-incubator-withdraw]").forEach((button) => button.addEventListener("click", () => {
      if (this.selectedSlot === null) return;
      const destination = button.dataset.incubatorWithdraw;
      if (destination !== "party" && destination !== "ranch") return;
      this.pending = { kind: destination, slot: this.selectedSlot }; this.render(model);
    }));
    root.querySelector<HTMLButtonElement>("[data-incubator-confirm-cancel]")?.addEventListener("click", () => {
      this.pending = null; this.render(model);
    });
    root.querySelector<HTMLButtonElement>("[data-incubator-confirm]")?.addEventListener("click", () => {
      const pending = this.pending; this.pending = null; this.selectedSlot = null;
      if (pending?.kind === "deposit") this.onDeposit(pending.pokemonId, pending.slot);
      else if (pending !== null) this.onWithdraw(pending.slot, pending.kind);
    });
  }
}
