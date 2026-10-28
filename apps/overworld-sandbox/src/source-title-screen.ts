const TITLE_ASSETS = "/__pokemon-z/source/Graphics/Titles/";
const TITLE_MUSIC = "/__pokemon-z/source/Audio/BGM/Titulo2.ogg";

/** Local presentation only: no save, server intent, replicated state, or reconnect payload. */
export class SourceTitleScreen {
  private music: HTMLAudioElement | null = null;
  private readonly musicButton: HTMLButtonElement;

  public constructor(private readonly root: HTMLElement, private readonly onContinue: () => void,
    private readonly musicVolume: number) {
    root.innerHTML = `<div class="source-title-backdrop" aria-hidden="true"></div>
      <div class="source-title-art" aria-hidden="true">
        <img class="source-title-background" src="${TITLE_ASSETS}armaTituloZ.jpg" alt="" fetchpriority="high" decoding="async">
        <img class="source-title-effect" src="${TITLE_ASSETS}gen_2_effect.png" alt="">
        <img class="source-title-glow" src="${TITLE_ASSETS}gen_2_effect3.png" alt="">
        <img class="source-title-logo" src="${TITLE_ASSETS}pokelogo.png" alt="">
      </div>
      <div class="source-title-content"><span class="source-title-eyebrow">UNE AVENTURE EN KALOS</span>
        <h1>Pokémon Z</h1><p>Le voyage commence ici.</p>
        <div class="source-title-actions"><button type="button" class="source-title-continue">Commencer</button>
          <button type="button" class="source-title-music" aria-pressed="false">Activer la musique</button></div>
        <small>Entrée ou Espace pour continuer</small></div>`;
    this.musicButton = root.querySelector<HTMLButtonElement>(".source-title-music")!;
    void this.prepareBackground();
    root.querySelector<HTMLButtonElement>(".source-title-continue")!
      .addEventListener("click", () => this.continue());
    this.musicButton.addEventListener("click", () => { void this.toggleMusic(); });
  }

  public get open(): boolean { return !this.root.hidden; }

  public show(): void { this.root.hidden = false; }

  public hide(): void {
    this.root.hidden = true;
    this.music?.pause();
    this.music = null;
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.open) return false;
    if (event.code === "Enter" || event.code === "Space") {
      if (!(event.target instanceof HTMLButtonElement && this.root.contains(event.target))) {
        event.preventDefault();
        this.continue();
      }
    } else if (event.code !== "Tab") event.preventDefault();
    return true;
  }

  private continue(): void {
    if (!this.open) return;
    this.hide();
    this.onContinue();
  }

  private async prepareBackground(): Promise<void> {
    const background = this.root.querySelector<HTMLImageElement>(".source-title-background")!;
    try {
      await background.decode();
    } catch {
      // The local optimized copy may be absent on another installation.
      background.src = `${TITLE_ASSETS}armaTituloZ.png`;
      try { await background.decode(); } catch { return; }
    }
    this.root.dataset.backgroundReady = "true";
  }

  private async toggleMusic(): Promise<void> {
    if (this.music !== null) {
      this.music.pause();
      this.music = null;
      this.musicButton.textContent = "Activer la musique";
      this.musicButton.setAttribute("aria-pressed", "false");
      return;
    }
    const music = new Audio(TITLE_MUSIC);
    music.loop = true;
    music.volume = Math.max(0, Math.min(1, this.musicVolume / 100));
    try {
      await music.play();
      if (!this.open) { music.pause(); return; }
      this.music = music;
      this.musicButton.textContent = "Couper la musique";
      this.musicButton.setAttribute("aria-pressed", "true");
    } catch {
      this.musicButton.textContent = "Musique indisponible";
    }
  }
}
