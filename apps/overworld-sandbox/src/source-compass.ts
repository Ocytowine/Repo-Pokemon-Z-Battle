import { resolvePokemonAsset, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { PlayerDetailsCatalog } from "@pokemon-z-battle/player-state";
import type { ImportedEncounterTable } from "./imported-map.js";
import { sourcePokemonIconUrl } from "./source-pokemon-collection.js";

export interface SourceCompassEntry {
  readonly species: string;
  readonly number: number;
  readonly name: string;
  readonly iconUrl: string;
  readonly caught: boolean;
  readonly methods: readonly string[];
}

export interface SourceCompassViewModel {
  readonly available: boolean;
  readonly open: boolean;
  readonly encounter: ImportedEncounterTable | null;
  readonly catalog: PlayerDetailsCatalog;
  readonly assets: PokemonAssetsManifest;
  readonly caughtSpecies: readonly string[];
  readonly locationName: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function assetUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

/** Reproduit le DexNav de Z : toutes les méthodes de la carte, espèces uniques, ordre du Pokédex. */
export function sourceCompassEntries(encounter: ImportedEncounterTable | null, catalog: PlayerDetailsCatalog,
  assets: PokemonAssetsManifest, caughtSpecies: readonly string[]): readonly SourceCompassEntry[] {
  if (encounter === null) return [];
  const caught = new Set(caughtSpecies);
  const methodsBySpecies = new Map<string, Set<string>>();
  for (const method of encounter.methods) for (const slot of method.slots) {
    const methods = methodsBySpecies.get(slot.species) ?? new Set<string>();
    methods.add(method.method);
    methodsBySpecies.set(slot.species, methods);
  }
  const definitions = new Map(catalog.pokemon.map((pokemon) => [pokemon.internalName, pokemon]));
  return [...methodsBySpecies].flatMap(([species, methods]) => {
    const definition = definitions.get(species);
    if (definition === undefined) return [];
    const record = assets.records.find((candidate) => candidate.id === definition.id);
    const icon = record === undefined ? null : resolvePokemonAsset(record,
      { kind: "icon", form: 0, shiny: false, female: false }).asset;
    return [{ species, number: definition.id, name: definition.name,
      iconUrl: icon === null ? sourcePokemonIconUrl(definition.id) : assetUrl(icon.path),
      caught: caught.has(species), methods: [...methods] }];
  }).sort((left, right) => left.number - right.number);
}

export class SourceCompassView {
  public constructor(private readonly onToggle: () => void, private readonly onClose: () => void) {}

  public render(model: SourceCompassViewModel): void {
    const toggle = document.querySelector<HTMLButtonElement>("#source-compass-toggle");
    const panel = document.querySelector<HTMLElement>("#source-compass");
    if (toggle === null || panel === null) return;
    toggle.hidden = !model.available;
    toggle.classList.toggle("active", model.open);
    toggle.setAttribute("aria-expanded", String(model.open));
    panel.hidden = !model.available || !model.open;
    if (!model.available || !model.open) return;
    const entries = sourceCompassEntries(model.encounter, model.catalog, model.assets, model.caughtSpecies);
    const known = entries.filter((entry) => entry.caught).length;
    const cards = entries.map((entry) => `<article class="source-compass-pokemon${entry.caught ? " caught" : " unknown"}" title="${entry.caught ? escapeHtml(entry.name) : "Pokémon non capturé"}">
      <span style="--compass-icon:url('${entry.iconUrl}')" aria-hidden="true"></span>
      <small>${entry.caught ? escapeHtml(entry.name) : "???"}</small>
    </article>`).join("");
    panel.innerHTML = `<header><img src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/radar.png" alt=""><div><small>BOUSSOLE</small><strong>${escapeHtml(model.locationName)}</strong><span>${entries.length} Pokémon · ${known} capturé${known > 1 ? "s" : ""}</span></div><button type="button" data-source-compass-close aria-label="Fermer la Boussole">×</button></header>
      ${entries.length === 0 ? '<div class="source-compass-empty"><strong>Aucun Pokémon sauvage</strong><small>Cette zone ne possède aucune table de rencontres.</small></div>'
        : `<div class="source-compass-grid">${cards}</div>`}
      <footer>Les silhouettes correspondent aux espèces que vous n'avez pas encore capturées.</footer>`;
    panel.querySelector<HTMLButtonElement>("[data-source-compass-close]")?.addEventListener("click", this.onClose);
  }

  public bind(): void {
    document.querySelector<HTMLButtonElement>("#source-compass-toggle")?.addEventListener("click", this.onToggle);
  }
}
