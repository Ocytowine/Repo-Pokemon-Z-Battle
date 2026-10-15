import type { PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import type { SourceEventState } from "./source-event-state.js";
import { escapeSourceHtml } from "./source-menu-view.js";
import { createSourcePokemonCollection } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml } from "./source-pokemon-card-view.js";
import { sourceEvolutionBattler } from "./source-progression-view.js";

export interface SourceCaptureResolutionResult {
  readonly ok: boolean;
  readonly message: string;
  readonly eventState: SourceEventState;
}

export interface SourceCaptureResolutionCallbacks {
  readonly onNickname: (pokemonId: string, nickname: string | null) => SourceCaptureResolutionResult;
  readonly onPlacement: (pokemonId: string, destination: "team" | "ranch",
    exchangePartyPokemonId?: string) => SourceCaptureResolutionResult;
  readonly onComplete: () => void;
}

export interface SourceCaptureResolutionModel {
  readonly pokemonId: string;
  readonly eventState: SourceEventState;
  readonly catalog: PlayerCreationCatalog;
  readonly assets: PokemonAssetsManifest;
}

type CaptureStage = "nickname" | "destination" | "exchange" | "complete";

function capturePokemon(model: SourceCaptureResolutionModel) {
  return [...model.eventState.party.members, ...model.eventState.ranch.members]
    .find((pokemon) => pokemon.id === model.pokemonId) ?? null;
}

function spriteHtml(model: SourceCaptureResolutionModel): string {
  const pokemon = capturePokemon(model);
  if (pokemon === null) return "";
  const sprite = sourceEvolutionBattler(pokemon.species, model.assets, {
    form: pokemon.metadata.form, shiny: pokemon.metadata.shiny,
    female: pokemon.metadata.gender === "female",
  });
  if (sprite === null) return "";
  const cycle = Math.max(110, sprite.frameCount * 110);
  return `<span class="source-capture-result-sprite" style="--evolution-sheet:url('${sprite.url}');--evolution-frames:${sprite.frameCount};--evolution-frame-steps:${Math.max(1, sprite.frameCount - 1)};--evolution-frame-ratio:${sprite.frameWidth} / ${sprite.frameHeight};--evolution-cycle:${cycle}ms"><span class="source-evolution-battler-frame${sprite.frameCount > 1 ? " animated" : ""}"></span></span>`;
}

export class SourceCaptureResolutionView {
  private readonly root: HTMLElement;
  private model: SourceCaptureResolutionModel | null = null;
  private stage: CaptureStage = "nickname";
  private selectedExchangeId: string | null = null;
  private notice = "";

  public constructor(private readonly callbacks: SourceCaptureResolutionCallbacks) {
    this.root = document.createElement("div");
    this.root.id = "source-capture-resolution";
    this.root.hidden = true;
    (document.getElementById("world-stage") ?? document.body).append(this.root);
  }

  public get open(): boolean { return this.model !== null; }

  public show(model: SourceCaptureResolutionModel): void {
    if (this.model?.pokemonId !== model.pokemonId) {
      this.stage = "nickname";
      this.selectedExchangeId = null;
      this.notice = "";
    }
    this.model = model;
    this.render();
  }

  public refresh(eventState: SourceEventState): void {
    if (this.model === null) return;
    this.model = { ...this.model, eventState };
    this.render();
  }

  private finish(message: string): void {
    this.notice = message;
    this.stage = "complete";
    this.render();
  }

  private render(): void {
    const model = this.model;
    if (model === null) { this.root.hidden = true; this.root.innerHTML = ""; return; }
    const pokemon = capturePokemon(model);
    const definition = pokemon === null ? undefined : model.catalog.pokemon.find((entry) => entry.internalName === pokemon.species);
    if (pokemon === null || definition === undefined) {
      this.model = null;
      this.root.hidden = true;
      this.callbacks.onComplete();
      return;
    }
    const displayName = pokemon.nickname ?? definition.name;
    const sprite = spriteHtml(model);
    let body = "";
    if (this.stage === "nickname") {
      body = `<form class="source-capture-name-form"><label for="source-capture-nickname">Voulez-vous donner un surnom à ${escapeSourceHtml(definition.name)} ?</label><input id="source-capture-nickname" name="nickname" maxlength="12" autocomplete="off" value="${escapeSourceHtml(pokemon.nickname ?? "")}" placeholder="12 caractères maximum"><div><button type="submit">Valider le surnom</button><button type="button" data-capture-keep-name>Garder ${escapeSourceHtml(definition.name)}</button></div></form>`;
    } else if (this.stage === "destination") {
      const full = model.eventState.party.members.length >= 6;
      body = `<div class="source-capture-destinations"><p>Où voulez-vous envoyer <strong>${escapeSourceHtml(displayName)}</strong> ?</p><button type="button" data-capture-destination="team"><strong>Équipe</strong><small>${model.eventState.party.members.length}/6${full ? " · choisissez ensuite un échange" : " · place disponible"}</small></button><button type="button" data-capture-destination="ranch"><strong>Ranch</strong><small>Le conserver dans le stockage Pokémon</small></button></div>`;
    } else if (this.stage === "exchange") {
      const entries = createSourcePokemonCollection(model.eventState.party, model.eventState.ranch,
        model.catalog, model.assets).filter((entry) => entry.location === "team");
      body = `<div class="source-capture-exchange"><p>L'équipe est pleine. Choisissez le Pokémon à envoyer au Ranch.</p><div class="source-capture-exchange-grid">${entries.map((entry) => sourcePokemonCardHtml(entry, {
        selected: entry.pokemon.id === this.selectedExchangeId, compact: true, showGender: true,
      })).join("")}</div><footer><button type="button" data-capture-exchange-confirm${this.selectedExchangeId === null ? " disabled" : ""}>Confirmer l'échange</button><button type="button" data-capture-exchange-back>Retour</button></footer></div>`;
    } else {
      body = `<div class="source-capture-complete"><strong>Tout est prêt !</strong><p>${escapeSourceHtml(this.notice)}</p><button type="button" data-capture-complete>Continuer</button></div>`;
    }
    this.root.innerHTML = `<div class="source-capture-resolution-backdrop"><section class="source-capture-resolution-panel" role="dialog" aria-modal="true" aria-label="Pokémon capturé"><header><small>NOUVELLE CAPTURE</small><h2>${escapeSourceHtml(displayName)}</h2><span>N.${pokemon.level}</span></header><div class="source-capture-resolution-content"><div class="source-capture-result-visual">${sprite}<span>${escapeSourceHtml(definition.name)}</span></div><div class="source-capture-result-actions">${body}<small class="source-capture-result-notice">${escapeSourceHtml(this.notice)}</small></div></div></section></div>`;
    this.root.hidden = false;

    this.root.querySelector<HTMLFormElement>(".source-capture-name-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = new FormData(event.currentTarget as HTMLFormElement).get("nickname");
      const result = this.callbacks.onNickname(model.pokemonId, typeof value === "string" ? value : null);
      this.model = { ...model, eventState: result.eventState };
      this.notice = result.message;
      if (result.ok) this.stage = "destination";
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-capture-keep-name]")?.addEventListener("click", () => {
      const result = this.callbacks.onNickname(model.pokemonId, null);
      this.model = { ...model, eventState: result.eventState };
      this.notice = result.message;
      if (result.ok) this.stage = "destination";
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-capture-destination]").forEach((button) =>
      button.addEventListener("click", () => {
        const destination = button.dataset.captureDestination;
        if (destination === "team" && model.eventState.party.members.length >= 6) {
          this.stage = "exchange";
          this.notice = "";
          this.render();
          return;
        }
        if (destination !== "team" && destination !== "ranch") return;
        const result = this.callbacks.onPlacement(model.pokemonId, destination);
        this.model = { ...model, eventState: result.eventState };
        if (result.ok) this.finish(result.message); else { this.notice = result.message; this.render(); }
      }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-pokemon-id]").forEach((button) =>
      button.addEventListener("click", () => {
        this.selectedExchangeId = button.dataset.pokemonId ?? null;
        this.render();
      }));
    this.root.querySelector<HTMLButtonElement>("[data-capture-exchange-confirm]")?.addEventListener("click", () => {
      if (this.selectedExchangeId === null) return;
      const result = this.callbacks.onPlacement(model.pokemonId, "team", this.selectedExchangeId);
      this.model = { ...model, eventState: result.eventState };
      if (result.ok) this.finish(result.message); else { this.notice = result.message; this.render(); }
    });
    this.root.querySelector<HTMLButtonElement>("[data-capture-exchange-back]")?.addEventListener("click", () => {
      this.stage = "destination";
      this.selectedExchangeId = null;
      this.notice = "";
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-capture-complete]")?.addEventListener("click", () => {
      this.model = null;
      this.root.hidden = true;
      this.root.innerHTML = "";
      this.callbacks.onComplete();
    });
  }
}
