import { DEFAULT_SOURCE_NEW_GAME_CHOICES, loadSourceNewGameDraft, parseSourceNewGameChoices,
  persistSourceNewGameDraft, type SourceNewGameChoices, type SourceNewGameStep } from "./source-new-game.js";
import type { PlayerAvatarSelection } from "@pokemon-z-battle/player-state";

interface SourceNewGameViewCallbacks {
  readonly onCustomize: () => void;
  readonly onBackToSaves: () => void;
  readonly onStart: (choices: SourceNewGameChoices) => void | Promise<void>;
}

const STORY_BEATS = Object.freeze([
  ["Une invitation royale", "Diplômé de l’Académie Pokémon de Paldea, vous avez été retenu par la Professeure Lèa Olivier pour rejoindre son programme de jeunes chercheurs en Kalos."],
  ["L’alchimie Pokémon", "Olivier étudie les propriétés étonnantes des Pokémon afin de les mettre au service de tous. Deux autres apprentis partageront ce voyage avec vous."],
  ["En route pour Kalos", "Le voyage est payé par le roi. Une calèche vous conduit vers Bourg Canvas, mais un apprenti réputé ponctuel manque au rendez-vous dans la brume…"],
] as const);
const STEP_LABELS: readonly [SourceNewGameStep, string][] = [
  ["story", "Prologue"], ["identity", "Personnage"], ["settings", "Aventure"], ["review", "Départ"],
];
const DIFFICULTY_LABELS = { classic: "Classique", challenging: "Difficile", heroic: "Héroïque" } as const;
const MODE_LABELS = { normal: "Normal", nuzlocke: "Nuzlocke" } as const;
const REGION_LABELS = { kalos: "Kalos", kanto: "Kanto", johto: "Johto", hoenn: "Hoenn",
  sinnoh: "Sinnoh", unys: "Unys", alola: "Alola", galar: "Galar", paldea: "Paldea" } as const;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** Personal draft. The completed setup is still committed by the shared game-start path. */
export class SourceNewGameView {
  private beat = 0;
  private step: SourceNewGameStep = "story";
  private busy = false;
  private playerName = "Joueur";
  private player: PlayerAvatarSelection | null = null;
  private choices: SourceNewGameChoices = DEFAULT_SOURCE_NEW_GAME_CHOICES;

  public constructor(private readonly root: HTMLElement, private readonly storage: Storage,
    private readonly slot: 1 | 2, private readonly callbacks: SourceNewGameViewCallbacks) {
    const draft = loadSourceNewGameDraft(storage, slot);
    if (draft !== null) {
      this.beat = draft.storyBeat;
      this.step = draft.step;
      this.choices = draft.choices;
      this.player = draft.player;
    }
  }

  public show(playerName: string): void {
    this.playerName = playerName;
    this.root.hidden = false;
    this.render();
  }

  public hide(): void { this.root.hidden = true; }

  public updatePlayerSelection(selection: PlayerAvatarSelection): void {
    this.player = selection;
    this.playerName = selection.profile.displayName;
    this.persist();
    if (!this.root.hidden) this.render();
  }

  private persist(): void {
    persistSourceNewGameDraft(this.storage, this.slot, { schemaVersion: 1,
      step: this.step, storyBeat: this.beat, choices: this.choices, player: this.player });
  }

  private go(step: SourceNewGameStep): void {
    this.step = step;
    this.persist();
    this.render();
  }

  private render(): void {
    const stepNumber = STEP_LABELS.findIndex(([key]) => key === this.step) + 1;
    this.root.innerHTML = `<div class="source-new-game-shell"><header class="source-new-game-header">
      <div><small>PARTIE ${this.slot} · NOUVELLE AVENTURE</small><h1>${this.step === "story" ? "Votre histoire commence" : this.step === "identity" ? "Votre personnage" : this.step === "settings" ? "Votre aventure" : "Prêt pour le départ ?"}</h1></div>
      <button type="button" data-new-game-saves>Retour aux parties</button></header>
      <nav class="source-new-game-steps" aria-label="Préparation de l’aventure">${STEP_LABELS.map(([key, label], index) =>
    `<span class="${index + 1 === stepNumber ? "active" : index + 1 < stepNumber ? "done" : ""}" ${key === this.step ? 'aria-current="step"' : ""}>${index + 1}. ${label}</span>`).join("")}</nav>
      <main class="source-new-game-content">${this.step === "story" ? this.storyMarkup()
    : this.step === "identity" ? this.identityMarkup()
      : this.step === "settings" ? this.settingsMarkup() : this.reviewMarkup()}</main></div>`;
    this.root.querySelector<HTMLButtonElement>("[data-new-game-saves]")!.onclick = () => {
      if (this.busy) return;
      this.persist(); this.hide(); this.callbacks.onBackToSaves();
    };
    if (this.step === "story") this.bindStory();
    else if (this.step === "identity") this.bindIdentity();
    else if (this.step === "settings") this.bindSettings();
    else this.bindReview();
  }

  private storyMarkup(): string {
    const [title, text] = STORY_BEATS[this.beat]!;
    return `<section class="source-new-game-panel source-new-game-story">
      <small>PROLOGUE · ${this.beat + 1}/${STORY_BEATS.length}</small><h2>${title}</h2><p>${text}</p>
      <div class="source-new-game-progress" aria-hidden="true">${STORY_BEATS.map((_, index) => `<span class="${index <= this.beat ? "active" : ""}"></span>`).join("")}</div>
      <footer class="source-new-game-actions"><button type="button" data-story-previous>${this.beat === 0 ? "Retour aux parties" : "Précédent"}</button>
      <button type="button" data-story-skip>Abréger</button>
      <button type="button" class="primary" data-story-next>${this.beat === STORY_BEATS.length - 1 ? "Choisir mon personnage" : "Continuer"}</button></footer></section>`;
  }

  private bindStory(): void {
    this.root.querySelector<HTMLButtonElement>("[data-story-previous]")!.onclick = () => {
      if (this.beat === 0) { this.hide(); this.callbacks.onBackToSaves(); return; }
      this.beat -= 1; this.persist(); this.render();
    };
    this.root.querySelector<HTMLButtonElement>("[data-story-skip]")!.onclick = () => this.go("identity");
    this.root.querySelector<HTMLButtonElement>("[data-story-next]")!.onclick = () => {
      if (this.beat < STORY_BEATS.length - 1) { this.beat += 1; this.persist(); this.render(); }
      else this.go("identity");
    };
  }

  private identityMarkup(): string {
    return `<section class="source-new-game-panel source-new-game-identity"><div>
      <small>IDENTITÉ ET APPARENCE</small><h2>${escapeHtml(this.playerName)}</h2>
      <p>Choisissez votre nom, vos pronoms et l’apparence visible dans le monde et en Coop.</p></div>
      <button type="button" class="source-new-game-profile" data-new-game-customize>Personnaliser le héros</button>
      <footer class="source-new-game-actions"><button type="button" data-identity-back>Relire le prologue</button>
      <button type="button" class="primary" data-identity-next>Choisir les règles</button></footer></section>`;
  }

  private bindIdentity(): void {
    this.root.querySelector<HTMLButtonElement>("[data-new-game-customize]")!.onclick = () => {
      this.persist(); this.callbacks.onCustomize();
    };
    this.root.querySelector<HTMLButtonElement>("[data-identity-back]")!.onclick = () => this.go("story");
    this.root.querySelector<HTMLButtonElement>("[data-identity-next]")!.onclick = () => this.go("settings");
  }

  private settingsMarkup(): string {
    return `<section class="source-new-game-panel source-new-game-settings"><div class="source-new-game-form">
      <label>Difficulté<select data-new-game="difficulty"><option value="classic">Classique</option><option value="challenging">Difficile</option><option value="heroic">Héroïque</option></select><small>Règle du scénario source.</small></label>
      <label>Mode d’aventure<select data-new-game="adventureMode"><option value="normal">Normal</option><option value="nuzlocke">Nuzlocke</option></select><small>Le Nuzlocke est mémorisé ; ses règles non portées n’ont pas encore d’effet.</small></label>
      <label>Région des starters<select data-new-game="starterRegion">${Object.entries(REGION_LABELS).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select><small>Région proposée lors du choix du starter.</small></label></div>
      <footer class="source-new-game-actions"><button type="button" data-settings-back>Personnage</button>
      <button type="button" class="primary" data-settings-next>Vérifier mes choix</button></footer></section>`;
  }

  private bindSettings(): void {
    const difficulty = this.root.querySelector<HTMLSelectElement>('[data-new-game="difficulty"]')!;
    const mode = this.root.querySelector<HTMLSelectElement>('[data-new-game="adventureMode"]')!;
    const region = this.root.querySelector<HTMLSelectElement>('[data-new-game="starterRegion"]')!;
    difficulty.value = this.choices.difficulty;
    mode.value = this.choices.adventureMode;
    region.value = this.choices.starterRegion;
    const remember = (): void => {
      this.choices = parseSourceNewGameChoices({ difficulty: difficulty.value,
        adventureMode: mode.value, starterRegion: region.value });
      this.persist();
    };
    for (const select of [difficulty, mode, region]) select.addEventListener("change", remember);
    this.root.querySelector<HTMLButtonElement>("[data-settings-back]")!.onclick = () => { remember(); this.go("identity"); };
    this.root.querySelector<HTMLButtonElement>("[data-settings-next]")!.onclick = () => { remember(); this.go("review"); };
  }

  private reviewMarkup(): string {
    return `<section class="source-new-game-panel source-new-game-review"><div class="source-new-game-summary">
      <div><small>PERSONNAGE</small><strong>${escapeHtml(this.playerName)}</strong></div>
      <div><small>DIFFICULTÉ</small><strong>${DIFFICULTY_LABELS[this.choices.difficulty]}</strong></div>
      <div><small>MODE</small><strong>${MODE_LABELS[this.choices.adventureMode]}</strong></div>
      <div><small>STARTERS</small><strong>${REGION_LABELS[this.choices.starterRegion]}</strong></div></div>
      <p>Le voyage commence dans la calèche. La suite de la scène est jouée par le moteur commun, en solo comme en Coop.</p>
      <p class="source-new-game-error" role="alert" hidden></p>
      <footer class="source-new-game-actions"><button type="button" data-review-back>Modifier les choix</button>
      <button type="button" class="primary" data-new-game-start>Commencer le voyage</button></footer></section>`;
  }

  private bindReview(): void {
    this.root.querySelector<HTMLButtonElement>("[data-review-back]")!.onclick = () => this.go("settings");
    this.root.querySelector<HTMLButtonElement>("[data-new-game-start]")!.onclick = () => {
      if (this.busy) return;
      this.busy = true;
      const button = this.root.querySelector<HTMLButtonElement>("[data-new-game-start]")!;
      button.disabled = true;
      button.textContent = "Chargement de la calèche…";
      void Promise.resolve().then(() => this.callbacks.onStart(this.choices)).catch((error: unknown) => {
        this.busy = false;
        button.disabled = false;
        button.textContent = "Réessayer";
        const status = this.root.querySelector<HTMLElement>(".source-new-game-error");
        if (status !== null) {
          status.textContent = `Démarrage impossible : ${error instanceof Error ? error.message : "erreur inconnue"}`;
          status.title = status.textContent;
          status.hidden = false;
        }
      });
    };
  }
}
