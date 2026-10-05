import { DEFAULT_SOURCE_NEW_GAME_CHOICES, parseSourceNewGameChoices,
  type SourceNewGameChoices } from "./source-new-game.js";

interface SourceNewGameViewCallbacks {
  readonly onCustomize: () => void;
  readonly onStart: (choices: SourceNewGameChoices) => void | Promise<void>;
}

const STORY_BEATS = Object.freeze([
  ["Une invitation royale", "Diplômé de l’Académie Pokémon de Paldea, vous avez été retenu par la Professeure Lèa Olivier pour rejoindre son programme de jeunes chercheurs en Kalos."],
  ["L’alchimie Pokémon", "Olivier étudie les propriétés étonnantes des Pokémon afin de les mettre au service de tous. Deux autres apprentis partageront ce voyage avec vous."],
  ["En route pour Kalos", "Le voyage est payé par le roi. Une calèche vous conduit vers Bourg Canvas, mais un apprenti réputé ponctuel manque au rendez-vous dans la brume…"],
] as const);

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export class SourceNewGameView {
  private beat = 0;
  private choosing = false;
  private busy = false;
  private playerName = "Joueur";
  private choices: SourceNewGameChoices = DEFAULT_SOURCE_NEW_GAME_CHOICES;

  public constructor(private readonly root: HTMLElement, private readonly callbacks: SourceNewGameViewCallbacks) {}

  public show(playerName: string): void {
    this.playerName = playerName;
    this.root.hidden = false;
    this.render();
  }

  public hide(): void { this.root.hidden = true; }

  public updatePlayerName(playerName: string): void {
    this.playerName = playerName;
    if (!this.root.hidden) this.render();
  }

  private render(): void {
    if (this.choosing) { this.renderChoices(); return; }
    const [title, text] = STORY_BEATS[this.beat]!;
    this.root.innerHTML = `<div class="source-new-game-card source-new-game-story">
      <p class="eyebrow">PROLOGUE · ${this.beat + 1}/${STORY_BEATS.length}</p><h1>${title}</h1><p>${text}</p>
      <div class="source-new-game-progress">${STORY_BEATS.map((_, index) => `<span class="${index <= this.beat ? "active" : ""}"></span>`).join("")}</div>
      <div class="source-new-game-actions"><button type="button" data-prologue-skip>Abréger le prologue</button>
      <button type="button" class="primary" data-prologue-next>${this.beat === STORY_BEATS.length - 1 ? "Faire mes choix" : "Continuer"}</button></div></div>`;
    this.root.querySelector<HTMLButtonElement>("[data-prologue-skip]")?.addEventListener("click", () => {
      this.choosing = true; this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-prologue-next]")?.addEventListener("click", () => {
      if (this.beat < STORY_BEATS.length - 1) this.beat += 1; else this.choosing = true;
      this.render();
    });
  }

  private renderChoices(): void {
    const choices = this.choices;
    this.root.innerHTML = `<div class="source-new-game-card source-new-game-choices">
      <p class="eyebrow">AVANT LE DÉPART</p><h1>Préparez votre aventure</h1>
      <p class="source-new-game-lead">Ces décisions viennent du scénario source. Elles sont personnelles avant la création éventuelle d’une partie Coop.</p>
      <label>Difficulté<select data-new-game="difficulty"><option value="classic">Classique</option><option value="challenging">Difficile</option><option value="heroic">Héroïque</option></select></label>
      <label>Mode d’aventure<select data-new-game="adventureMode"><option value="normal">Normal</option><option value="nuzlocke">Nuzlocke</option></select><small>Le choix est conservé ; les règles Nuzlocke encore non portées resteront sans effet jusqu’à leur implémentation.</small></label>
      <label>Région des starters<select data-new-game="starterRegion"><option value="kalos">Kalos · recommandé</option><option value="kanto">Kanto</option><option value="johto">Johto</option><option value="hoenn">Hoenn</option><option value="sinnoh">Sinnoh</option><option value="unys">Unys</option><option value="alola">Alola</option><option value="galar">Galar</option><option value="paldea">Paldea</option></select></label>
      <button type="button" class="source-new-game-profile" data-new-game-customize><span>Personnaliser le héros</span><strong>${escapeHtml(this.playerName)}</strong></button>
      <div class="source-new-game-actions"><button type="button" data-prologue-back>Relire le résumé</button><button type="button" class="primary" data-new-game-start>Commencer le voyage</button></div>
      <p class="source-new-game-note">La scène source reprend dans la calèche : recherche de Christian, choix du starter et combat contre Keunotor.</p></div>`;
    const difficulty = this.root.querySelector<HTMLSelectElement>('[data-new-game="difficulty"]')!;
    const adventureMode = this.root.querySelector<HTMLSelectElement>('[data-new-game="adventureMode"]')!;
    const starterRegion = this.root.querySelector<HTMLSelectElement>('[data-new-game="starterRegion"]')!;
    difficulty.value = choices.difficulty; adventureMode.value = choices.adventureMode; starterRegion.value = choices.starterRegion;
    const rememberChoices = (): void => {
      this.choices = parseSourceNewGameChoices({ difficulty: difficulty.value,
        adventureMode: adventureMode.value, starterRegion: starterRegion.value });
    };
    difficulty.addEventListener("change", rememberChoices);
    adventureMode.addEventListener("change", rememberChoices);
    starterRegion.addEventListener("change", rememberChoices);
    this.root.querySelector<HTMLButtonElement>("[data-prologue-back]")?.addEventListener("click", () => {
      this.beat = 0; this.choosing = false; this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-new-game-customize]")?.addEventListener("click", () => {
      rememberChoices(); this.callbacks.onCustomize();
    });
    this.root.querySelector<HTMLButtonElement>("[data-new-game-start]")?.addEventListener("click", () => {
      if (this.busy) return;
      rememberChoices();
      this.busy = true;
      const button = this.root.querySelector<HTMLButtonElement>("[data-new-game-start]");
      if (button !== null) { button.disabled = true; button.textContent = "Chargement de la calèche…"; }
      void Promise.resolve(this.callbacks.onStart(this.choices)).catch(() => {
        this.busy = false;
        if (button !== null) { button.disabled = false; button.textContent = "Réessayer"; }
      });
    });
  }
}
