import { createSourceAudio, pauseSourceAudio, playSourceAudio } from "./source-audio-lifecycle.js";

const TITLE_ASSETS = "/__pokemon-z/source/Graphics/Titles/";
const TITLE_MUSIC = "/__pokemon-z/source/Audio/BGM/Titulo2.ogg";

/** Personal Android storage only; no save, room intent, or replicated state. */
export interface TitleBgmGate {
  check(): Promise<{ ready: boolean; online: boolean }>;
  install(report: (status: string) => void): Promise<"ready" | "login-required" | "failed">;
  login(report: (status: string) => void): Promise<void>;
}

/** Local presentation only: no save, server intent, replicated state, or reconnect payload. */
export class SourceTitleScreen {
  private music: HTMLAudioElement | null = null;
  private musicReady = false;
  private readonly startButton: HTMLButtonElement;
  private readonly packNotice: HTMLElement;
  private readonly packMessage: HTMLElement;
  private readonly packInstall: HTMLButtonElement;
  private readonly packLogin: HTMLButtonElement;
  private continuing = false;
  private installingPack = false;
  private packMissing = false;
  private packOnline = true;
  private packStatusOverride: string | null = null;
  private loginNeeded = false;
  private packTimer: ReturnType<typeof setInterval> | null = null;

  public constructor(private readonly root: HTMLElement, private readonly onContinue: () => void,
    private readonly musicVolume: () => number, private readonly bgmGate?: TitleBgmGate) {
    root.innerHTML = `<div class="source-title-backdrop" aria-hidden="true"></div>
      <div class="source-title-art" aria-hidden="true">
        <img class="source-title-background" src="${TITLE_ASSETS}armaTituloZ.jpg" alt="" fetchpriority="high" decoding="async">
        <div class="source-title-stardust"></div>
        <div class="source-title-effects">
          <img class="source-title-effect" src="${TITLE_ASSETS}gen_2_effect.png" alt="">
          <img class="source-title-rays" src="${TITLE_ASSETS}gen_2_effect3.png" alt="">
        </div>
        <img class="source-title-logo" src="${TITLE_ASSETS}pokelogo.png" alt="">
        <div class="source-title-flash"></div>
      </div>
      <button type="button" class="source-title-activate">Lancer l'écran titre</button>
      <div class="source-title-content"><span class="source-title-eyebrow">UNE AVENTURE EN KALOS</span>
        <h1>Pokémon Z</h1><p>Le voyage commence ici.</p>
        <div class="source-title-actions"><button type="button" class="source-title-continue">Commencer</button></div>
        <div class="source-title-pack" hidden><span class="source-title-pack-message" role="status"></span>
          <button type="button" class="source-title-pack-install">Installer les musiques</button>
          <button type="button" class="source-title-pack-login" hidden>Connexion</button></div></div>`;
    this.startButton = root.querySelector<HTMLButtonElement>(".source-title-activate")!;
    this.packNotice = root.querySelector<HTMLElement>(".source-title-pack")!;
    this.packMessage = root.querySelector<HTMLElement>(".source-title-pack-message")!;
    this.packInstall = root.querySelector<HTMLButtonElement>(".source-title-pack-install")!;
    this.packLogin = root.querySelector<HTMLButtonElement>(".source-title-pack-login")!;
    void this.prepareBackground();
    root.querySelector<HTMLButtonElement>(".source-title-continue")!
      .addEventListener("click", () => { void this.continue(); });
    this.packInstall.addEventListener("click", () => { void this.installPack(); });
    this.packLogin.addEventListener("click", () => { void this.loginForPack(); });
    this.startButton.addEventListener("pointerdown", () => this.tryStartMusic());
    this.startButton.addEventListener("click", () => this.tryStartMusic());
    window.addEventListener("online", () => { if (this.open) void this.checkPack(); });
    window.addEventListener("offline", () => { if (this.open) void this.checkPack(); });
  }

  public get open(): boolean { return !this.root.hidden; }

  public show(): void {
    this.root.hidden = false;
    this.startButton.hidden = false;
    this.tryStartMusic();
    void this.checkPack();
    this.packTimer ??= setInterval(() => {
      if (this.open && this.packMissing && !this.installingPack) void this.checkPack();
    }, 10_000);
  }

  public hide(): void {
    this.root.hidden = true;
    delete this.root.dataset.titleActive;
    this.musicReady = false;
    pauseSourceAudio(this.music);
    this.music = null;
    if (this.packTimer !== null) clearInterval(this.packTimer);
    this.packTimer = null;
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.open) return false;
    if (event.code === "Enter" || event.code === "Space") {
      if (this.root.dataset.titleActive !== "true") {
        event.preventDefault();
        this.tryStartMusic();
      } else if (!(event.target instanceof HTMLButtonElement && this.root.contains(event.target))) {
        event.preventDefault();
        void this.continue();
      }
    } else if (event.code !== "Tab") event.preventDefault();
    return true;
  }

  private async continue(): Promise<void> {
    if (!this.open || this.root.dataset.titleActive !== "true" || this.continuing) return;
    this.continuing = true;
    try {
      if (!(await this.checkPack()) || !this.open) return;
      this.hide();
      this.onContinue();
    } finally { this.continuing = false; }
  }

  private showPackMessage(message: string, login = false): void {
    this.packNotice.hidden = false;
    this.packMessage.textContent = message;
    this.packInstall.hidden = !this.packOnline;
    this.packInstall.disabled = this.installingPack;
    this.packLogin.hidden = !login || !this.packOnline;
  }

  private async checkPack(): Promise<boolean> {
    if (this.bgmGate === undefined) return true;
    try {
      const { ready, online } = await this.bgmGate.check();
      if (!this.open) return false;
      this.packMissing = !ready;
      this.packOnline = online;
      if (ready) {
        this.packStatusOverride = null;
        this.loginNeeded = false;
        this.packNotice.hidden = true;
      } else if (!online) {
        this.showPackMessage("Hors ligne : le titre reste disponible. Installe les musiques dès que le réseau revient.");
      } else {
        this.showPackMessage(this.packStatusOverride ?? "Pack de musiques requis avant d'ouvrir une partie.",
          this.loginNeeded);
      }
      return ready;
    } catch {
      if (this.open) {
        this.packMissing = true;
        this.showPackMessage("Impossible de vérifier les musiques. Réessaie quand le réseau est disponible.");
      }
      return false;
    }
  }

  private async installPack(): Promise<void> {
    if (this.bgmGate === undefined || this.installingPack || !this.packOnline) return;
    this.installingPack = true;
    this.packStatusOverride = null;
    this.loginNeeded = false;
    this.showPackMessage("Vérification du pack de musiques…");
    try {
      const result = await this.bgmGate.install((status) => {
        this.packStatusOverride = status;
        if (this.open) this.showPackMessage(status);
      });
      if (!this.open) return;
      if (result === "ready" && await this.checkPack()) this.packNotice.hidden = true;
      else if (result === "login-required") {
        this.loginNeeded = true;
        this.packStatusOverride = "Connexion nécessaire pour télécharger les musiques.";
        this.showPackMessage(this.packStatusOverride, true);
      }
      // The installer already reported the exact failure or publication state.
    } catch {
      if (this.open) this.showPackMessage("Téléchargement interrompu. Réessaie plus tard.");
    } finally { this.installingPack = false; this.packInstall.disabled = false; }
  }

  private async loginForPack(): Promise<void> {
    if (this.bgmGate === undefined) return;
    this.showPackMessage("Ouverture de la connexion…");
    await this.bgmGate.login((status) => {
      this.loginNeeded = !status.startsWith("Connecté au cloud");
      this.packStatusOverride = status;
      if (this.open) this.showPackMessage(status, this.loginNeeded);
    });
  }

  private activateTitle(): void {
    if (!this.open || !this.musicReady || this.root.dataset.backgroundReady !== "true"
      || this.root.dataset.titleActive === "true") return;
    this.root.dataset.titleActive = "true";
    this.startButton.hidden = true;
  }

  private async prepareBackground(): Promise<void> {
    const background = this.root.querySelector<HTMLImageElement>(".source-title-background")!;
    try {
      await background.decode();
    } catch {
      // The local optimized copy may be absent on another installation.
      background.src = `${TITLE_ASSETS}armaTituloZ.png`;
      try { await background.decode(); } catch { background.hidden = true; }
    }
    this.root.dataset.backgroundReady = "true";
    this.activateTitle();
  }

  private tryStartMusic(): void {
    if (!this.open || this.root.dataset.titleActive === "true") return;
    const volume = this.musicVolume();
    if (volume <= 0) { this.musicReady = true; this.activateTitle(); return; }
    const music = this.music ?? createSourceAudio(TITLE_MUSIC);
    this.music = music;
    music.loop = true;
    music.volume = Math.max(0, Math.min(1, volume / 100));
    void playSourceAudio(music).then(() => {
      if (this.open && this.music === music) { this.musicReady = true; this.activateTitle(); }
      else pauseSourceAudio(music);
    }).catch((error: unknown) => {
      if (!this.open || this.music !== music) return;
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      // Missing or undecodable audio must not trap the player on the title.
      this.musicReady = true;
      this.activateTitle();
    });
  }
}
