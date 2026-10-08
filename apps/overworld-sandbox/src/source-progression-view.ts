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
}

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

function battlerUrl(species: string, assets: PokemonAssetsManifest): string | null {
  const record = assets.records.find((candidate) => candidate.internalName === species);
  if (record === undefined) return null;
  const resolved = resolvePokemonAsset(record, { kind: "battler", back: false });
  return resolved.asset === null ? null : sourceUrl(resolved.asset.path);
}

/** Mandatory post-level flow. Pending state exists only to survive refresh/reconnection. */
export class SourceProgressionView {
  private readonly root: HTMLElement;
  private pokemonId: string | null = null;
  private model: SourceProgressionViewModel | null = null;
  private replacingMove = false;
  private evolutionTimer: ReturnType<typeof setTimeout> | null = null;
  private evolutionStartedFor: string | null = null;

  public constructor(private readonly callbacks: SourceProgressionViewCallbacks) {
    this.root = document.createElement("div");
    this.root.id = "source-progression";
    this.root.hidden = true;
    document.body.append(this.root);
  }

  public get open(): boolean { return this.pokemonId !== null; }

  public show(pokemonId: string, model: SourceProgressionViewModel): void {
    this.pokemonId = pokemonId;
    this.model = model;
    this.replacingMove = false;
    this.render();
  }

  public update(model: SourceProgressionViewModel): void {
    this.model = model;
    if (this.open) this.render();
  }

  private close(): void {
    if (this.evolutionTimer !== null) clearTimeout(this.evolutionTimer);
    this.evolutionTimer = null;
    this.evolutionStartedFor = null;
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
    this.evolutionStartedFor = null;
    this.render();
  }

  private render(): void {
    if (this.pokemonId === null || this.model === null) return;
    const pokemon = this.model.eventState.party.members.find((candidate) => candidate.id === this.pokemonId);
    if (pokemon === undefined) { this.close(); return; }
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
    const target = this.model.catalog.pokemon.find((candidate) => candidate.internalName === evolution.species);
    const targetName = target?.name ?? evolution.species;
    const oldUrl = battlerUrl(pokemon.species, this.model.assets);
    const nextUrl = battlerUrl(evolution.species, this.model.assets);
    this.root.hidden = false;
    this.root.innerHTML = `<div class="source-progression-backdrop"><section class="source-evolution-panel"><small>ÉVOLUTION</small><h2>Oh ! ${escapeSourceHtml(pokemonName)} évolue !</h2><div class="source-evolution-stage">${oldUrl === null ? "" : `<img class="source-evolution-old" src="${oldUrl}" alt="">`}${nextUrl === null ? "" : `<img class="source-evolution-new" src="${nextUrl}" alt="">`}</div><p>${escapeSourceHtml(pokemonName)} évolue en ${escapeSourceHtml(targetName)}…</p><button type="button" data-progression-cancel-evolution>Annuler l'évolution</button><p data-progression-notice></p></section></div>`;
    this.root.querySelector<HTMLButtonElement>("[data-progression-cancel-evolution]")?.addEventListener("click", () => {
      if (this.evolutionTimer !== null) clearTimeout(this.evolutionTimer);
      this.evolutionTimer = null;
      this.apply(this.callbacks.onResolveEvolution(pokemon.id, false));
    });
    if (this.evolutionStartedFor === pokemon.id) return;
    this.evolutionStartedFor = pokemon.id;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.evolutionTimer = setTimeout(() => {
      this.evolutionTimer = null;
      this.apply(this.callbacks.onResolveEvolution(pokemon.id, true));
    }, reduced ? 650 : 3_200);
  }
}
