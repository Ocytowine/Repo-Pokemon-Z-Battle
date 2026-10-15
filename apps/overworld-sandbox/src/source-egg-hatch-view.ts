import type { PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import type { SourcePendingHatch } from "./source-egg-incubation.js";
import { sourceEvolutionBattler } from "./source-progression-view.js";
import { sourceTransformationBackdropHtml } from "./source-transformation-stage.js";
import { startSourcePokemonSpriteAnimations, type SourcePokemonSpriteAnimation }
  from "./source-pokemon-sprite-animator.js";

export interface SourceEggHatchViewModel {
  readonly candidate: SourcePendingHatch;
  readonly catalog: PlayerCreationCatalog;
  readonly assets: PokemonAssetsManifest;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly partyHasSpace: boolean;
}

export interface SourceEggHatchCompletion {
  readonly ok: boolean;
  readonly message: string;
}

export interface SourceEggHatchViewOptions {
  readonly onSceneAudioStart?: () => void;
  readonly onSceneAudioEnd?: () => void;
}

type HatchPhase = "intro" | "hatching" | "revealed" | "nickname" | "name-entry" | "destination";

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

function pokemonSprite(model: SourceEggHatchViewModel): string {
  const pokemon = model.candidate.pokemon;
  const sprite = sourceEvolutionBattler(pokemon.species, model.assets, { form: pokemon.metadata.form,
    shiny: pokemon.metadata.shiny, female: pokemon.metadata.gender === "female" });
  if (sprite === null) return "";
  return `<span class="source-hatch-pokemon" style="--hatch-ratio:${sprite.frameWidth} / ${sprite.frameHeight}"><canvas data-pokemon-sprite-animation data-src="${sprite.url}" data-frame-width="${sprite.frameWidth}" data-frame-height="${sprite.frameHeight}" data-frame-count="${sprite.frameCount}" width="${sprite.frameWidth}" height="${sprite.frameHeight}"></canvas></span>`;
}

export class SourceEggHatchView {
  private readonly root: HTMLElement;
  private model: SourceEggHatchViewModel | null = null;
  private phase: HatchPhase | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private soundTimers: Array<ReturnType<typeof setTimeout>> = [];
  private music: HTMLAudioElement | null = null;
  private nickname: string | null = null;
  private notice = "";
  private spriteAnimations: readonly SourcePokemonSpriteAnimation[] = [];

  public constructor(private readonly onComplete: (pokemonId: string, destination: "party" | "ranch",
    nickname: string | null) => SourceEggHatchCompletion,
  private readonly options: SourceEggHatchViewOptions = {}) {
    this.root = document.createElement("div");
    this.root.id = "source-egg-hatch";
    this.root.hidden = true;
    (document.getElementById("world-stage") ?? document.body).append(this.root);
  }

  public get open(): boolean { return this.model !== null; }

  public show(model: SourceEggHatchViewModel): void {
    if (this.model?.candidate.pokemon.id === model.candidate.pokemon.id) return;
    this.stopAudio();
    this.model = model;
    this.phase = "intro";
    this.nickname = null;
    this.notice = "";
    this.options.onSceneAudioStart?.();
    this.render();
  }

  public setAudioVolumes(musicVolume: number, effectsVolume: number): void {
    if (this.model !== null) this.model = { ...this.model, musicVolume, effectsVolume };
    if (this.music !== null) this.music.volume = Math.max(0, Math.min(1, musicVolume));
  }

  private play(path: string, volume: number, loop = false): HTMLAudioElement | null {
    if (volume <= 0) return null;
    const audio = new Audio(sourceUrl(path));
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    void audio.play().catch(() => undefined);
    return audio;
  }

  private stopAudio(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.soundTimers.forEach(clearTimeout);
    this.soundTimers = [];
    this.timer = null;
    this.music?.pause();
    this.music = null;
  }

  private beginHatching(): void {
    if (this.model === null || this.phase !== "intro") return;
    this.phase = "hatching";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.music = this.play("Audio/BGM/evolv.ogg", this.model.musicVolume, true);
    const shakeDelays = reduced ? [120] : [900, 1_800, 2_800, 3_800];
    this.soundTimers = shakeDelays.map((delay) => setTimeout(() => {
      if (this.model !== null && this.phase === "hatching") {
        this.play("Audio/SE/ballshake.mp3", this.model.effectsVolume);
      }
    }, delay));
    this.render();
    this.timer = setTimeout(() => {
      if (this.model === null) return;
      this.timer = null;
      this.music?.pause();
      this.music = null;
      this.soundTimers = [];
      this.play("Audio/SE/recall.mp3", this.model.effectsVolume);
      this.phase = "revealed";
      this.render();
      const cry = this.model.assets.records.find((record) => record.internalName === this.model!.candidate.pokemon.species)
        ?.assets.cry?.[0]?.path;
      if (cry !== undefined) this.play(cry, this.model.effectsVolume);
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.model !== null) this.play("Audio/ME/EvolutionSuccess.ogg", this.model.musicVolume);
      }, reduced ? 0 : 450);
    }, reduced ? 700 : 5_200);
  }

  private proceedAfterNickname(): void {
    if (this.model === null) return;
    if (this.model.candidate.location === "party") this.complete("party");
    else { this.phase = "destination"; this.render(); }
  }

  private complete(destination: "party" | "ranch"): void {
    if (this.model === null) return;
    const result = this.onComplete(this.model.candidate.pokemon.id, destination, this.nickname);
    if (!result.ok) { this.notice = result.message; this.render(); return; }
    this.stopSpriteAnimations();
    this.stopAudio();
    this.model = null;
    this.phase = null;
    this.root.hidden = true;
    this.root.innerHTML = "";
    this.options.onSceneAudioEnd?.();
  }

  private render(): void {
    if (this.model === null || this.phase === null) return;
    this.stopSpriteAnimations();
    const model = this.model;
    const definition = model.catalog.pokemon.find((pokemon) => pokemon.internalName === model.candidate.pokemon.species);
    const name = definition?.name ?? model.candidate.pokemon.species;
    const background = sourceTransformationBackdropHtml("hatch");
    const visual = this.phase === "revealed" || this.phase === "nickname" || this.phase === "name-entry"
      || this.phase === "destination" ? pokemonSprite(model)
      : `<span class="source-hatch-egg"><i></i><b class="source-hatch-cracks"></b></span>`;
    let message = "";
    if (this.phase === "intro") message = `<p>Tiens ?</p><button type="button" data-hatch-start>Continuer</button>`;
    else if (this.phase === "hatching") message = `<p>L’Œuf est en train d’éclore…</p>`;
    else if (this.phase === "revealed") message = `<p>${name} est sorti de l’Œuf !</p><button type="button" data-hatch-next>Continuer</button>`;
    else if (this.phase === "nickname") message = `<p>Voulez-vous donner un surnom à ${name} ?</p><div><button type="button" data-hatch-nickname="no">Non</button><button type="button" data-hatch-nickname="yes">Oui</button></div>`;
    else if (this.phase === "name-entry") message = `<label><span>Surnom de ${name}</span><input data-hatch-name maxlength="12" value="${this.nickname ?? ""}" autocomplete="off"></label><div><button type="button" data-hatch-name-cancel>Retour</button><button type="button" data-hatch-name-confirm>Valider</button></div>`;
    else message = `<p>Où envoyer ${this.nickname ?? name} ?</p><div><button type="button" data-hatch-destination="party"${model.partyHasSpace ? "" : " disabled"}>Équipe</button><button type="button" data-hatch-destination="ranch">Ranch</button></div>`;
    this.root.hidden = false;
    this.root.innerHTML = `<div class="source-progression-backdrop"><section class="source-hatch-stage" data-hatch-phase="${this.phase}">${background}<div class="source-hatch-visual">${visual}</div><div class="source-evolution-message source-hatch-message">${message}<small>${this.notice}</small></div></section></div>`;
    this.spriteAnimations = startSourcePokemonSpriteAnimations(this.root, "idle");
    this.root.querySelector<HTMLButtonElement>("[data-hatch-start]")?.addEventListener("click", () => this.beginHatching());
    this.root.querySelector<HTMLButtonElement>("[data-hatch-next]")?.addEventListener("click", () => { this.phase = "nickname"; this.render(); });
    this.root.querySelectorAll<HTMLButtonElement>("[data-hatch-nickname]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.hatchNickname === "yes") { this.phase = "name-entry"; this.render(); }
      else { this.nickname = null; this.proceedAfterNickname(); }
    }));
    this.root.querySelector<HTMLButtonElement>("[data-hatch-name-cancel]")?.addEventListener("click", () => { this.phase = "nickname"; this.render(); });
    this.root.querySelector<HTMLButtonElement>("[data-hatch-name-confirm]")?.addEventListener("click", () => {
      const value = this.root.querySelector<HTMLInputElement>("[data-hatch-name]")?.value.trim() ?? "";
      this.nickname = value === "" ? null : value;
      this.proceedAfterNickname();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-hatch-destination]").forEach((button) => button.addEventListener("click", () => {
      const destination = button.dataset.hatchDestination;
      if (destination === "party" || destination === "ranch") this.complete(destination);
    }));
  }

  private stopSpriteAnimations(): void {
    this.spriteAnimations.forEach((animation) => animation.stop());
    this.spriteAnimations = [];
  }
}
