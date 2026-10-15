import type { PlayerCreationCatalog, PlayerPartyState } from "@pokemon-z-battle/player-state";
import { sourceDayCareCompatibility, type SourceDayCareState } from "./source-day-care.js";

export interface SourceDayCareEggViewModel {
  readonly open: boolean;
  readonly party: PlayerPartyState;
  readonly dayCare: SourceDayCareState;
  readonly catalog: PlayerCreationCatalog;
  readonly incubatorUnlocked: boolean;
  readonly incubatorHasSpace: boolean;
}

type Confirmation = "collect" | "discard" | null;

function compatibilityMessage(dayCare: SourceDayCareState, catalog: PlayerCreationCatalog): string {
  if (dayCare.slots.some((slot) => slot === null)) {
    return "Confiez deux Pokémon à la Pension pour que je puisse observer leur entente.";
  }
  const compatibility = sourceDayCareCompatibility(dayCare, catalog);
  return ["Ils préfèrent jouer avec d’autres Pokémon.", "Ils ne semblent pas beaucoup s’apprécier.",
    "Ils ont l’air de bien s’entendre.", "Ils ont l’air de très bien s’entendre !"][compatibility.score]!;
}

export class SourceDayCareEggView {
  private confirmation: Confirmation = null;
  private wasOpen = false;

  public constructor(private readonly onClose: () => void,
    private readonly onCollect: () => void,
    private readonly onCollectInIncubator: () => void,
    private readonly onDiscard: () => void) {}

  public render(model: SourceDayCareEggViewModel): void {
    const root = document.querySelector<HTMLElement>("#source-day-care-eggs");
    if (root === null) return;
    root.hidden = !model.open;
    if (!model.open) { this.wasOpen = false; this.confirmation = null; return; }
    if (!this.wasOpen) this.confirmation = null;
    this.wasOpen = true;
    const ready = model.dayCare.eggReady && model.dayCare.pendingEgg !== null;
    const partyFull = model.party.members.length >= 6;
    const confirmation = this.confirmation;
    const body = !ready
      ? `<div class="source-day-care-egg-empty"><span aria-hidden="true">♡</span><h2>Pas encore d’Œuf</h2><p>${compatibilityMessage(model.dayCare, model.catalog)}</p><small>Je vous préviendrai dès que j’en aurai trouvé un.</small></div>`
      : `<div class="source-day-care-egg-ready"><div class="source-day-care-egg-art" aria-hidden="true"><span class="source-incubator-egg-icon"></span></div>
          <div><small>UNE DÉCOUVERTE À LA PENSION</small><h2>Nous avons trouvé un Œuf !</h2>
          <p>Vos Pokémon tenaient cet Œuf. Voulez-vous le récupérer ? Son contenu restera inconnu jusqu’à l’éclosion.</p></div></div>
        <div class="source-day-care-egg-actions">
          <button type="button" class="primary" data-day-care-egg-action="collect"${partyFull ? " disabled" : ""}><strong>Ajouter à l’équipe</strong><small>${partyFull ? "Équipe complète" : `${model.party.members.length}/6 · Aucun frais`}</small></button>
          <button type="button" data-day-care-egg-action="incubator"${model.incubatorUnlocked && model.incubatorHasSpace ? "" : " disabled"}><strong>Placer dans l’Incubateur</strong><small>${!model.incubatorUnlocked ? "Objet non obtenu" : model.incubatorHasSpace ? "Un emplacement libre sera utilisé" : "Incubateur complet"}</small></button>
          <button type="button" data-day-care-egg-action="leave"><strong>Le laisser à la Pension</strong><small>Vous pourrez revenir plus tard</small></button>
          <button type="button" class="danger" data-day-care-egg-action="discard"><strong>Refuser l’Œuf</strong><small>Cette décision sera définitive</small></button>
        </div>${partyFull ? `<p class="source-day-care-egg-warning">Votre équipe est complète. Libérez une place ou attendez l’ouverture de l’incubateur.</p>` : ""}`;
    const overlay = confirmation === null ? "" : `<div class="source-day-care-dialog-backdrop"><section class="source-day-care-confirm" role="alertdialog" aria-modal="true">
      <small>${confirmation === "collect" ? "CONFIRMATION" : "DÉCISION DÉFINITIVE"}</small>
      <h3>${confirmation === "collect" ? "Recevoir cet Œuf ?" : "Refuser définitivement cet Œuf ?"}</h3>
      <p>${confirmation === "collect" ? "L’Œuf sera placé dans votre équipe et comptera comme une place occupée jusqu’à son éclosion."
        : "L’Œuf sera confié à quelqu’un d’autre. Vous ne pourrez pas récupérer celui-ci plus tard."}</p>
      <footer><button type="button" data-day-care-egg-cancel>Annuler</button><button type="button" class="primary${confirmation === "discard" ? " danger" : ""}" data-day-care-egg-confirm>${confirmation === "collect" ? "Recevoir l’Œuf" : "Oui, le refuser"}</button></footer>
    </section></div>`;
    root.innerHTML = `<section class="source-day-care-egg-panel"><header><div><small>PENSION POKÉMON</small><h1>Gardien des Œufs</h1></div><button type="button" data-day-care-egg-close aria-label="Fermer">×</button></header>
      <main>${body}</main>${overlay}</section>`;
    root.querySelector<HTMLButtonElement>("[data-day-care-egg-close]")?.addEventListener("click", this.onClose);
    root.querySelector<HTMLButtonElement>('[data-day-care-egg-action="leave"]')?.addEventListener("click", this.onClose);
    root.querySelector<HTMLButtonElement>('[data-day-care-egg-action="collect"]')?.addEventListener("click", () => {
      this.confirmation = "collect"; this.render(model);
    });
    root.querySelector<HTMLButtonElement>('[data-day-care-egg-action="incubator"]')?.addEventListener("click",
      this.onCollectInIncubator);
    root.querySelector<HTMLButtonElement>('[data-day-care-egg-action="discard"]')?.addEventListener("click", () => {
      this.confirmation = "discard"; this.render(model);
    });
    root.querySelector<HTMLButtonElement>("[data-day-care-egg-cancel]")?.addEventListener("click", () => {
      this.confirmation = null; this.render(model);
    });
    root.querySelector<HTMLButtonElement>("[data-day-care-egg-confirm]")?.addEventListener("click", () => {
      const accepted = this.confirmation; this.confirmation = null;
      if (accepted === "collect") this.onCollect();
      else if (accepted === "discard") this.onDiscard();
    });
  }
}
