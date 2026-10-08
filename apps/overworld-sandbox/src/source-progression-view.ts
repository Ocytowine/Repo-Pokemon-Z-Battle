import { resolvePokemonAsset, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import type { SourceEventState } from "./source-event-state.js";
import { escapeSourceHtml } from "./source-menu-view.js";

interface ProgressionActionResult {
  readonly ok: boolean;
  readonly message: string;
  readonly eventState: SourceEventState;
}

export interface SourceProgressionViewCallbacks {
  readonly onLearnMove: (pokemonId: string, moveId: string, replacementIndex?: number) => ProgressionActionResult;
  readonly onDeclineMove: (pokemonId: string, moveId: string) => ProgressionActionResult;
  readonly onResolveEvolution: (pokemonId: string, accept: boolean) => ProgressionActionResult;
  readonly onComplete: () => void;
}

export interface SourceProgressionViewModel {
  readonly eventState: SourceEventState;
  readonly catalog: PlayerCreationCatalog;
  readonly assets: PokemonAssetsManifest;
  readonly volume: number;
}

export interface SourceResolvedEvolution {
  readonly pokemonId: string;
  readonly previousSpecies: string;
  readonly nextSpecies: string;
  readonly pokemonName: string;
}

interface SourceEvolutionPresentation {
  readonly key: string;
  readonly pokemonId: string;
  readonly pokemonName: string;
  readonly previousSpecies: string;
  readonly nextSpecies: string;
  readonly targetName: string;
  readonly oldSprite: SourceEvolutionBattler | null;
  readonly nextSprite: SourceEvolutionBattler | null;
  readonly cancellable: boolean;
}

export interface SourceEvolutionBattler {
  readonly url: string;
  readonly frameCount: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

export function sourceEvolutionBattler(species: string, assets: PokemonAssetsManifest,
  appearance: { readonly form?: number; readonly shiny?: boolean; readonly female?: boolean } = {}): SourceEvolutionBattler | null {
  const record = assets.records.find((candidate) => candidate.internalName === species);
  if (record === undefined) return null;
  const resolved = resolvePokemonAsset(record, { kind: "battler", back: false, ...appearance });
  if (resolved.asset === null) return null;
  const frameCount = Math.max(1, resolved.asset.frameCount ?? 1);
  const frameHeight = Math.max(1, resolved.asset.height ?? 1);
  const frameWidth = resolved.asset.width === null ? frameHeight
    : Math.max(1, Math.floor(resolved.asset.width / frameCount));
  return { url: sourceUrl(resolved.asset.path), frameCount, frameWidth, frameHeight };
}

function battlerMarkup(sprite: SourceEvolutionBattler | null, className: string, label: string): string {
  if (sprite === null) return "";
  const cycle = Math.max(110, sprite.frameCount * 110);
  return `<span class="source-evolution-sprite ${className}" role="img" aria-label="${escapeSourceHtml(label)}" style="--evolution-sheet:url('${sprite.url}');--evolution-frames:${sprite.frameCount};--evolution-frame-steps:${Math.max(1, sprite.frameCount - 1)};--evolution-frame-ratio:${sprite.frameWidth} / ${sprite.frameHeight};--evolution-cycle:${cycle}ms"><span class="source-evolution-battler-frame${sprite.frameCount > 1 ? " animated" : ""}"></span></span>`;
}

function cryUrl(species: string, assets: PokemonAssetsManifest): string | null {
  const record = assets.records.find((candidate) => candidate.internalName === species);
  if (record === undefined) return null;
  const resolved = resolvePokemonAsset(record, { kind: "cry" });
  return resolved.asset === null ? null : sourceUrl(resolved.asset.path);
}

/** Mandatory post-level flow. Pending state exists only to survive refresh/reconnection. */
export class SourceProgressionView {
  private readonly root: HTMLElement;
  private pokemonId: string | null = null;
  private model: SourceProgressionViewModel | null = null;
  private replacingMove = false;
  private evolutionTimer: ReturnType<typeof setTimeout> | null = null;
  private evolutionMusic: HTMLAudioElement | null = null;
  private evolutionPhase: "intro" | "animating" | "success" | "cancelled" | null = null;
  private evolutionPresentation: SourceEvolutionPresentation | null = null;
  private resolvedEvolution: SourceResolvedEvolution | null = null;

  public constructor(private readonly callbacks: SourceProgressionViewCallbacks) {
    this.root = document.createElement("div");
    this.root.id = "source-progression";
    this.root.hidden = true;
    (document.getElementById("world-stage") ?? document.body).append(this.root);
  }

  public get open(): boolean { return this.pokemonId !== null; }

  public show(pokemonId: string, model: SourceProgressionViewModel): void {
    this.pokemonId = pokemonId;
    this.model = model;
    this.resolvedEvolution = null;
    this.replacingMove = false;
    this.evolutionPhase = null;
    this.evolutionPresentation = null;
    this.render();
  }

  /** Plays the mandatory presentation after an already-committed item evolution. */
  public showResolvedEvolution(evolution: SourceResolvedEvolution, model: SourceProgressionViewModel): void {
    this.pokemonId = evolution.pokemonId;
    this.model = model;
    this.resolvedEvolution = evolution;
    this.replacingMove = false;
    this.evolutionPhase = null;
    this.evolutionPresentation = null;
    this.render();
  }

  public update(model: SourceProgressionViewModel): void {
    this.model = model;
    if (this.open) this.render();
  }

  private close(): void {
    if (this.evolutionTimer !== null) clearTimeout(this.evolutionTimer);
    this.evolutionMusic?.pause();
    this.evolutionTimer = null;
    this.evolutionMusic = null;
    this.evolutionPhase = null;
    this.evolutionPresentation = null;
    this.resolvedEvolution = null;
    this.pokemonId = null;
    this.model = null;
    this.root.hidden = true;
    this.root.innerHTML = "";
    this.callbacks.onComplete();
  }

  private apply(result: ProgressionActionResult): void {
    if (!result.ok || this.model === null) {
      this.root.querySelector<HTMLElement>("[data-progression-notice]")!.textContent = result.message;
      return;
    }
    this.model = { ...this.model, eventState: result.eventState };
    this.replacingMove = false;
    this.render();
  }

  private render(): void {
    if (this.pokemonId === null || this.model === null) return;
    const pokemon = this.model.eventState.party.members.find((candidate) => candidate.id === this.pokemonId);
    if (pokemon === undefined) { this.close(); return; }
    if (this.resolvedEvolution !== null) {
      this.renderEvolution(this.resolvedEvolution.pokemonId, this.resolvedEvolution.pokemonName,
        this.resolvedEvolution.previousSpecies, this.resolvedEvolution.nextSpecies, false);
      return;
    }
    const definition = this.model.catalog.pokemon.find((candidate) => candidate.internalName === pokemon.species);
    const pokemonName = pokemon.nickname ?? definition?.name ?? pokemon.species;
    const moveId = pokemon.pendingMoves?.[0];
    if (moveId !== undefined) {
      const move = this.model.catalog.moves.find((candidate) => candidate.internalName === moveId);
      const moveName = move?.name ?? moveId;
      this.root.hidden = false;
      this.root.innerHTML = `<div class="source-progression-backdrop"><section class="source-progression-panel"><small>APPRENTISSAGE</small><h2>${escapeSourceHtml(pokemonName)}</h2>${this.replacingMove
        ? `<p>Quelle capacité doit être oubliée pour apprendre <strong>${escapeSourceHtml(moveName)}</strong> ?</p><div class="source-progression-moves">${pokemon.moves.map((slot, index) => { const known = this.model!.catalog.moves.find((candidate) => candidate.internalName === slot.internalName); return `<button type="button" data-progression-replace="${index}"><strong>${escapeSourceHtml(known?.name ?? slot.internalName)}</strong><small>${slot.pp}/${slot.maxPp} PP</small></button>`; }).join("")}</div><button type="button" data-progression-back>Retour</button>`
        : `<p>${escapeSourceHtml(pokemonName)} veut apprendre <strong>${escapeSourceHtml(moveName)}</strong>, mais connaît déjà quatre capacités.</p><p>Voulez-vous en remplacer une ?</p><footer><button type="button" data-progression-decline>Ne pas apprendre</button><button type="button" data-progression-choose>Choisir une capacité</button></footer>`}<p data-progression-notice></p></section></div>`;
      this.root.querySelector<HTMLButtonElement>("[data-progression-choose]")?.addEventListener("click", () => {
        this.replacingMove = true; this.render();
      });
      this.root.querySelector<HTMLButtonElement>("[data-progression-back]")?.addEventListener("click", () => {
        this.replacingMove = false; this.render();
      });
      this.root.querySelector<HTMLButtonElement>("[data-progression-decline]")?.addEventListener("click", () =>
        this.apply(this.callbacks.onDeclineMove(pokemon.id, moveId)));
      this.root.querySelectorAll<HTMLButtonElement>("[data-progression-replace]").forEach((button) =>
        button.addEventListener("click", () => this.apply(this.callbacks.onLearnMove(pokemon.id, moveId,
          Number(button.dataset.progressionReplace)))));
      return;
    }
    const evolution = pokemon.pendingEvolution;
    if (evolution === undefined) { this.close(); return; }
    this.renderEvolution(pokemon.id, pokemonName, pokemon.species, evolution.species, true);
  }

  private renderEvolution(pokemonId: string, pokemonName: string, previousSpecies: string, nextSpecies: string,
    cancellable: boolean): void {
    if (this.model === null) return;
    const target = this.model.catalog.pokemon.find((candidate) => candidate.internalName === nextSpecies);
    const targetName = target?.name ?? nextSpecies;
    const pokemon = this.model.eventState.party.members.find((candidate) => candidate.id === pokemonId);
    const appearance = pokemon === undefined ? {} : { form: pokemon.metadata.form, shiny: pokemon.metadata.shiny,
      female: pokemon.metadata.gender === "female" };
    const oldSprite = sourceEvolutionBattler(previousSpecies, this.model.assets, appearance);
    const nextSprite = sourceEvolutionBattler(nextSpecies, this.model.assets, appearance);
    const key = `${pokemonId}:${previousSpecies}:${nextSpecies}:${cancellable ? "level" : "item"}`;
    if (this.evolutionPresentation?.key !== key) {
      this.evolutionPresentation = { key, pokemonId, pokemonName, previousSpecies, nextSpecies,
        targetName, oldSprite, nextSprite, cancellable };
      this.evolutionPhase = "intro";
      this.playAudio(cryUrl(previousSpecies, this.model.assets));
    }
    const presentation = this.evolutionPresentation;
    const phase = this.evolutionPhase ?? "intro";
    const message = phase === "intro" ? `Quoi ?\n${pokemonName} évolue !`
      : phase === "success" ? `Félicitations ! ${pokemonName} a évolué en ${targetName} !`
        : phase === "cancelled" ? `Quoi ? L'évolution de ${pokemonName} s'est arrêtée !`
          : `${pokemonName} évolue…`;
    const spriteMarkup = phase === "animating"
      ? `${battlerMarkup(presentation.oldSprite, "source-evolution-old", pokemonName)}${battlerMarkup(presentation.nextSprite, "source-evolution-new", targetName)}`
      : phase === "success"
        ? battlerMarkup(presentation.nextSprite, "source-evolution-static", targetName)
        : battlerMarkup(presentation.oldSprite, "source-evolution-static", pokemonName);
    const action = phase === "intro" ? '<button type="button" data-evolution-start>Continuer</button>'
      : phase === "success" || phase === "cancelled"
        ? '<button type="button" data-evolution-finish>Continuer</button>' : "";
    this.root.hidden = false;
    this.root.innerHTML = `<div class="source-progression-backdrop"><section class="source-evolution-panel"><div class="source-evolution-stage" data-evolution-phase="${phase}">${spriteMarkup}${phase === "animating" && cancellable ? "<button type=\"button\" class=\"source-evolution-cancel\" data-progression-cancel-evolution>Annuler</button>" : ""}<div class="source-evolution-message"><p>${escapeSourceHtml(message).replace("\n", "<br>")}</p>${action}<small data-progression-notice></small></div></div></section></div>`;
    this.root.querySelector<HTMLButtonElement>("[data-evolution-start]")?.addEventListener("click", () =>
      this.startEvolutionAnimation());
    this.root.querySelector<HTMLButtonElement>("[data-evolution-finish]")?.addEventListener("click", () =>
      this.finishEvolutionPresentation());
    this.root.querySelector<HTMLButtonElement>("[data-progression-cancel-evolution]")
      ?.addEventListener("click", () => {
        if (this.evolutionTimer !== null) clearTimeout(this.evolutionTimer);
        this.evolutionTimer = null;
        this.evolutionMusic?.pause();
        this.evolutionMusic = null;
        const result = this.callbacks.onResolveEvolution(pokemonId, false);
        if (!result.ok || this.model === null) {
          this.root.querySelector<HTMLElement>("[data-progression-notice]")!.textContent = result.message;
          return;
        }
        this.model = { ...this.model, eventState: result.eventState };
        this.evolutionPhase = "cancelled";
        this.renderEvolution(pokemonId, pokemonName, previousSpecies, nextSpecies, cancellable);
      });
  }

  private startEvolutionAnimation(): void {
    const presentation = this.evolutionPresentation;
    if (presentation === null || this.model === null || this.evolutionPhase !== "intro") return;
    this.evolutionPhase = "animating";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.evolutionMusic = this.playAudio(sourceUrl("Audio/BGM/evolv.ogg"), true);
    this.renderEvolution(presentation.pokemonId, presentation.pokemonName, presentation.previousSpecies,
      presentation.nextSpecies, presentation.cancellable);
    this.evolutionTimer = setTimeout(() => {
      this.evolutionTimer = null;
      this.evolutionMusic?.pause();
      this.evolutionMusic = null;
      const volume = this.model!.volume;
      this.playAudio(cryUrl(presentation.nextSpecies, this.model!.assets), false, volume);
      setTimeout(() => { this.playAudio(sourceUrl("Audio/ME/EvolutionSuccess.ogg"), false, volume); }, reduced ? 0 : 450);
      if (presentation.cancellable) {
        const result = this.callbacks.onResolveEvolution(presentation.pokemonId, true);
        if (!result.ok || this.model === null) {
          this.root.querySelector<HTMLElement>("[data-progression-notice]")!.textContent = result.message;
          return;
        }
        this.model = { ...this.model, eventState: result.eventState };
      }
      this.evolutionPhase = "success";
      this.renderEvolution(presentation.pokemonId, presentation.pokemonName, presentation.previousSpecies,
        presentation.nextSpecies, presentation.cancellable);
    }, reduced ? 650 : 7_000);
  }

  private finishEvolutionPresentation(): void {
    this.resolvedEvolution = null;
    this.evolutionPhase = null;
    this.evolutionPresentation = null;
    this.render();
  }

  private playAudio(url: string | null, loop = false, volume = this.model?.volume ?? 0): HTMLAudioElement | null {
    if (url === null || volume <= 0) return null;
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    void audio.play().catch(() => undefined);
    return audio;
  }
}
