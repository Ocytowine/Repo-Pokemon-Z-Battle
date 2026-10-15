import { pokemonTypeIconUrl } from "@pokemon-z-battle/game-assets";
import { resolvePokemonAsset, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { PlayerDetailsCatalog, PlayerPartyState, PlayerPokemonStorageState }
  from "@pokemon-z-battle/player-state";
import type { SourcePokedexHistory } from "./source-event-state.js";
import { SOURCE_POKEMON_POWER_TIERS, sourcePokemonIconUrl, sourcePokemonPowerTier,
  sourcePokemonTypeLabel, type SourcePokemonPowerTier } from "./source-pokemon-collection.js";
import { sourceRegionImageUrl, sourceSpeciesHabitatCoordinates, sourceSpeciesHabitatLocations,
  type SourceRegionMapCatalog } from "./source-region-map.js";

const PAGE_SIZE = 12;
export type PokedexStatus = "all" | "unseen" | "seen" | "caught" | "current" | "team" | "ranch" | "evolved" | "released";
export type PokedexSort = "number" | "name" | "potential-power";

export interface SourcePokedexFilters {
  readonly query: string;
  readonly firstType: string | null;
  readonly secondType: string | null;
  readonly status: PokedexStatus;
  readonly potentialTier: SourcePokemonPowerTier;
  readonly sort: PokedexSort;
}

export interface SourcePokedexViewModel {
  readonly history: SourcePokedexHistory;
  readonly party: PlayerPartyState;
  readonly ranch: PlayerPokemonStorageState;
  readonly catalog: PlayerDetailsCatalog;
  readonly assets: PokemonAssetsManifest;
  readonly regionMap: SourceRegionMapCatalog;
  readonly itemNames: ReadonlyMap<string, string>;
}

interface SourcePokedexStatBlock {
  readonly hp: number; readonly attack: number; readonly defense: number;
  readonly specialAttack: number; readonly specialDefense: number; readonly speed: number;
}

export interface SourcePokedexEntry {
  readonly species: string; readonly number: number; readonly name: string; readonly kind: string;
  readonly pokedexEntry: string;
  readonly height: number; readonly weight: number; readonly types: readonly string[];
  readonly baseStats: SourcePokedexStatBlock; readonly potentialPower: number;
  readonly abilities: readonly string[]; readonly evolutions: readonly SourcePokedexEvolution[]; readonly iconUrl: string;
  readonly battlerUrl: string | null; readonly battlerFrameWidth: number | null;
  readonly battlerFrameHeight: number | null; readonly battlerFrameCount: number;
  readonly footprintUrl: string | null; readonly seen: boolean; readonly caught: boolean;
  readonly teamCount: number; readonly ranchCount: number; readonly evolved: boolean; readonly released: boolean;
}

export interface SourcePokedexEvolution {
  readonly species: string;
  readonly name: string;
  readonly method: string;
  readonly parameter: string | null;
  readonly condition: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function searchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr-FR");
}
function assetUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}
function statTotal(stats: SourcePokedexStatBlock): number {
  return stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed;
}

function namedParameter(parameter: string | null, names: ReadonlyMap<string, string>): string {
  return parameter === null ? "" : names.get(parameter) ?? parameter;
}

export function sourcePokedexEvolutionCondition(method: string, parameter: string | null,
  pokemonNames: ReadonlyMap<string, string>, itemNames: ReadonlyMap<string, string>,
  moveNames: ReadonlyMap<string, string>): string {
  const level = parameter ?? "?";
  const item = namedParameter(parameter, itemNames);
  switch (method) {
    case "Level": return `Niveau ${level}`;
    case "LevelMale": return `Niveau ${level} · mâle`;
    case "LevelFemale": return `Niveau ${level} · femelle`;
    case "Item": return `Utiliser ${item}`;
    case "ItemMale": return `Utiliser ${item} · mâle`;
    case "ItemFemale": return `Utiliser ${item} · femelle`;
    case "Happiness": return "Bonheur élevé";
    case "HappinessDay": return "Bonheur élevé · de jour";
    case "HappinessNight": return "Bonheur élevé · de nuit";
    case "HasMove": return `Gagner un niveau en connaissant ${namedParameter(parameter, moveNames)}`;
    case "HasInParty": return `Gagner un niveau avec ${namedParameter(parameter, pokemonNames)} dans l’équipe`;
    case "DayHoldItem": return `Gagner un niveau de jour en tenant ${item}`;
    case "NightHoldItem": return `Gagner un niveau de nuit en tenant ${item}`;
    case "Trade": return "Échange";
    case "TradeItem": return `Échange en tenant ${item}`;
    case "AttackGreater": return `Niveau ${level} · Attaque supérieure à la Défense`;
    case "DefenseGreater": return `Niveau ${level} · Défense supérieure à l’Attaque`;
    case "AtkDefEqual": return `Niveau ${level} · Attaque égale à la Défense`;
    case "Silcoon": return `Niveau ${level} · selon la personnalité`;
    case "Cascoon": return `Niveau ${level} · selon la personnalité`;
    case "Ninjask": return `Niveau ${level}`;
    case "Shedinja": return `Niveau ${level} · place libre dans l’équipe et Poké Ball disponible`;
    default: {
      const detail = namedParameter(parameter, new Map([...pokemonNames, ...itemNames, ...moveNames]));
      return detail === "" ? method : `${method} · ${detail}`;
    }
  }
}

export function createSourcePokedexEntries(model: SourcePokedexViewModel): readonly SourcePokedexEntry[] {
  const seen = new Set(model.history.seenSpecies); const caught = new Set(model.history.caughtSpecies);
  const evolved = new Set(model.history.evolvedSpecies); const released = new Set(model.history.releasedSpecies);
  const teamCounts = new Map<string, number>(); const ranchCounts = new Map<string, number>();
  const names = new Map(model.catalog.pokemon.map((pokemon) => [pokemon.internalName, pokemon.name]));
  const abilityNames = new Map(model.catalog.abilities.map((ability) => [ability.internalName, ability.name]));
  const moveNames = new Map(model.catalog.moves.map((move) => [move.internalName, move.name]));
  for (const pokemon of model.party.members) teamCounts.set(pokemon.species, (teamCounts.get(pokemon.species) ?? 0) + 1);
  for (const pokemon of model.ranch.members) ranchCounts.set(pokemon.species, (ranchCounts.get(pokemon.species) ?? 0) + 1);
  return model.catalog.pokemon.flatMap((pokemon) => {
    if (pokemon.id < 1) return [];
    const record = model.assets.records.find((candidate) => candidate.id === pokemon.id);
    const icon = record === undefined ? null : resolvePokemonAsset(record,
      { kind: "icon", form: 0, shiny: false, female: false }).asset;
    const battler = record === undefined ? null : resolvePokemonAsset(record,
      { kind: "battler", form: 0, shiny: false, female: false, back: false }).asset;
    const footprint = record === undefined ? null : resolvePokemonAsset(record,
      { kind: "footprint", form: 0, shiny: false, female: false }).asset;
    const teamCount = teamCounts.get(pokemon.internalName) ?? 0;
    const ranchCount = ranchCounts.get(pokemon.internalName) ?? 0;
    const wasCaught = caught.has(pokemon.internalName) || teamCount + ranchCount > 0;
    const frameCount = Math.max(1, battler?.frameCount ?? 1);
    return [{ species: pokemon.internalName, number: pokemon.id, name: pokemon.name, kind: pokemon.kind,
      pokedexEntry: pokemon.pokedexEntry,
      height: pokemon.height, weight: pokemon.weight, types: pokemon.types, baseStats: pokemon.baseStats,
      potentialPower: statTotal(pokemon.baseStats),
      abilities: [...pokemon.abilities, ...pokemon.hiddenAbilities].map((ability) => abilityNames.get(ability) ?? ability),
      evolutions: (pokemon.evolutions ?? []).map((evolution) => ({ species: evolution.species,
        name: names.get(evolution.species) ?? evolution.species, method: evolution.method,
        parameter: evolution.parameter, condition: sourcePokedexEvolutionCondition(evolution.method,
          evolution.parameter, names, model.itemNames, moveNames) })),
      iconUrl: icon === null ? sourcePokemonIconUrl(pokemon.id) : assetUrl(icon.path),
      battlerUrl: battler === null ? null : assetUrl(battler.path),
      battlerFrameWidth: battler?.width === null || battler?.width === undefined ? null : Math.floor(battler.width / frameCount),
      battlerFrameHeight: battler?.height ?? null, battlerFrameCount: frameCount,
      footprintUrl: footprint === null ? null : assetUrl(footprint.path),
      seen: seen.has(pokemon.internalName) || wasCaught, caught: wasCaught, teamCount, ranchCount,
      evolved: evolved.has(pokemon.internalName), released: released.has(pokemon.internalName) }];
  }).sort((left, right) => left.number - right.number);
}

export function filterSourcePokedexEntries(entries: readonly SourcePokedexEntry[],
  filters: SourcePokedexFilters): readonly SourcePokedexEntry[] {
  const query = searchText(filters.query.trim());
  return entries.filter((entry) => {
    if (query !== "" && !searchText(`${entry.name} ${entry.species} ${entry.number}`).includes(query)) return false;
    if (filters.firstType !== null && !entry.types.includes(filters.firstType)) return false;
    if (filters.secondType !== null && (!entry.types.includes(filters.secondType)
      || filters.secondType === filters.firstType)) return false;
    if (filters.potentialTier !== "all" && sourcePokemonPowerTier(entry.potentialPower).id !== filters.potentialTier) return false;
    const current = entry.teamCount + entry.ranchCount > 0;
    if (filters.status === "unseen" && entry.seen || filters.status === "seen" && (!entry.seen || entry.caught)
      || filters.status === "caught" && !entry.caught || filters.status === "current" && !current
      || filters.status === "team" && entry.teamCount === 0 || filters.status === "ranch" && entry.ranchCount === 0
      || filters.status === "evolved" && !entry.evolved || filters.status === "released" && !entry.released) return false;
    return true;
  }).sort((left, right) => filters.sort === "name"
    ? left.name.localeCompare(right.name, "fr") || left.number - right.number
    : filters.sort === "potential-power" ? right.potentialPower - left.potentialPower || left.number - right.number
      : left.number - right.number);
}

function typeOptions(types: readonly string[], selected: string | null, label: string): string {
  return `<option value="">${label}</option>${types.map((type) =>
    `<option value="${escapeHtml(type)}"${selected === type ? " selected" : ""}>${escapeHtml(sourcePokemonTypeLabel(type))}</option>`).join("")}`;
}
function statusOptions(selected: PokedexStatus): string {
  const options: readonly [PokedexStatus, string][] = [["all", "Tous"], ["unseen", "Non vus"],
    ["seen", "Vus seulement"], ["caught", "Obtenus"], ["current", "Possédés actuellement"],
    ["team", "Dans l’équipe"], ["ranch", "Dans le Ranch"], ["evolved", "Ont évolué"],
    ["released", "Ont été relâchés"]];
  return options.map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
}
function powerOptions(selected: SourcePokemonPowerTier): string {
  return `<option value="all"${selected === "all" ? " selected" : ""}>Tous les potentiels</option>${SOURCE_POKEMON_POWER_TIERS.map((tier) =>
    `<option value="${tier.id}"${selected === tier.id ? " selected" : ""}>${tier.label} · ${tier.minimum}${tier.maximum === null ? "+" : `–${tier.maximum}`}</option>`).join("")}`;
}

function badges(entry: SourcePokedexEntry): string {
  const result = [];
  if (entry.teamCount > 0) result.push(`<span data-status="team">Équipe${entry.teamCount > 1 ? ` ×${entry.teamCount}` : ""}</span>`);
  if (entry.ranchCount > 0) result.push(`<span data-status="ranch">Ranch${entry.ranchCount > 1 ? ` ×${entry.ranchCount}` : ""}</span>`);
  if (entry.evolved) result.push('<span data-status="evolved">A évolué</span>');
  if (entry.released) result.push('<span data-status="released">Relâché</span>');
  if (result.length === 0 && entry.caught) result.push('<span data-status="caught">Obtenu</span>');
  if (result.length === 0 && entry.seen) result.push('<span data-status="seen">Vu</span>');
  return result.join("");
}

function card(entry: SourcePokedexEntry, highlightPotential: boolean): string {
  const visible = entry.seen || entry.caught; const element = visible ? "button" : "article";
  const attributes = visible ? ` type="button" data-pokedex-species="${escapeHtml(entry.species)}" aria-label="Voir les données de ${escapeHtml(entry.name)}"` : "";
  const types = visible ? entry.types.map((type) =>
    `<span title="${escapeHtml(sourcePokemonTypeLabel(type))}"><img src="${pokemonTypeIconUrl(type)}" alt="${escapeHtml(sourcePokemonTypeLabel(type))}"></span>`).join("") : "";
  const potential = highlightPotential
    ? `<b class="source-pokedex-potential">${entry.potentialPower} · ${escapeHtml(sourcePokemonPowerTier(entry.potentialPower).label)}</b>` : "";
  return `<${element}${attributes} class="source-pokedex-card${entry.caught ? " caught" : entry.seen ? " seen" : " unseen"}">
    <span class="source-pokedex-number">N°${String(entry.number).padStart(4, "0")}</span>
    <span class="source-pokedex-icon${visible ? " animated" : ""}" style="background-image:url('${escapeHtml(entry.iconUrl)}')" aria-hidden="true"></span>
    <div><strong>${visible ? escapeHtml(entry.name) : "????"}</strong><span class="source-pokedex-types">${types}</span>
      <small>${entry.caught ? "Espèce obtenue" : entry.seen ? "Espèce observée" : "Données inconnues"}</small>${potential}</div>
    <footer>${badges(entry)}</footer></${element}>`;
}

const STAT_LABELS: readonly [keyof SourcePokedexStatBlock, string][] = [["hp", "PV"], ["attack", "Attaque"],
  ["defense", "Défense"], ["specialAttack", "Atq. Spé."], ["specialDefense", "Déf. Spé."], ["speed", "Vitesse"]];

function habitatPage(entry: SourcePokedexEntry, catalog: SourceRegionMapCatalog): string {
  const coordinates = sourceSpeciesHabitatCoordinates(catalog, entry.species);
  const locations = sourceSpeciesHabitatLocations(catalog, entry.species);
  const regionId = coordinates[0]?.region ?? catalog.regions[0]?.id;
  const region = catalog.regions.find((candidate) => candidate.id === regionId) ?? null;
  if (region === null) return '<div class="source-pokedex-habitat-empty"><strong>Carte indisponible</strong><span>Aucune région n’est définie.</span></div>';
  const mappedLocations = new Map<string, { readonly coordinate: NonNullable<(typeof locations)[number]["coordinate"]>;
    readonly names: string[] }>();
  for (const location of locations) {
    if (location.coordinate === null || location.coordinate.region !== region.id) continue;
    const key = `${location.coordinate.x}:${location.coordinate.y}`;
    const current = mappedLocations.get(key);
    if (current === undefined) mappedLocations.set(key, { coordinate: location.coordinate, names: [location.name] });
    else current.names.push(location.name);
  }
  const cells = [...mappedLocations.values()].map(({ coordinate, names }) => {
    const horizontal = coordinate.x <= 4 ? " label-right" : coordinate.x >= 25 ? " label-left" : "";
    const vertical = coordinate.y <= 2 ? " label-below" : "";
    return `<i class="${`${horizontal}${vertical}`.trim()}" style="--map-x:${coordinate.x};--map-y:${coordinate.y}"><span>${names.map(escapeHtml).join(" · ")}</span></i>`;
  }).join("");
  return `<div class="source-pokedex-habitat"><div class="source-pokedex-habitat-map"><img src="${sourceRegionImageUrl(region.filename)}" alt="Carte de ${escapeHtml(region.name)}"><div>${cells}</div></div></div>`;
}

function detail(entry: SourcePokedexEntry, position: number, count: number,
  catalog: SourceRegionMapCatalog, page: "information" | "habitat"): string {
  const types = entry.types.map((type) => `<span><img src="${pokemonTypeIconUrl(type)}" alt="">${escapeHtml(sourcePokemonTypeLabel(type))}</span>`).join("");
  const sprite = entry.battlerUrl === null || entry.battlerFrameWidth === null || entry.battlerFrameHeight === null ? "?"
    : `<canvas data-pokedex-summary-sprite width="${entry.battlerFrameWidth}" height="${entry.battlerFrameHeight}" aria-label="Sprite animé de ${escapeHtml(entry.name)}"></canvas>`;
  const stats = STAT_LABELS.map(([stat, label]) => `<article><small>${label}</small><strong>${entry.baseStats[stat]}</strong><span>BASE</span></article>`).join("");
  const evolutions = entry.evolutions.length === 0 ? "<strong>Aucune</strong>" : entry.evolutions.map((evolution) =>
    `<div class="source-pokedex-evolution"><strong>${escapeHtml(evolution.name)}</strong><span>${escapeHtml(evolution.condition)}</span></div>`).join("");
  const informationAside = `<aside><div class="source-summary-name"><strong>${escapeHtml(entry.name)}</strong><span>N° ${String(entry.number).padStart(3, "0")}</span></div>
      <div class="source-summary-sprite${entry.caught ? "" : " silhouette"}">${sprite}</div>
      <div class="source-summary-flags source-pokedex-detail-types">${types}</div>
      ${entry.footprintUrl === null || !entry.caught ? "" : `<div class="source-pokedex-footprint-row"><small>Empreinte</small><img class="source-pokedex-footprint" src="${escapeHtml(entry.footprintUrl)}" alt="Empreinte de ${escapeHtml(entry.name)}"></div>`}
      <span class="source-summary-form">${entry.caught ? "Données complètes" : "Espèce observée"}</span></aside>`;
  const informationPage = `<div class="source-summary-fields"><article><small>Catégorie</small><strong>${entry.caught ? escapeHtml(entry.kind) : "Donnée à obtenir"}</strong></article><article><small>Potentiel</small><strong>${entry.caught ? `${entry.potentialPower} · ${escapeHtml(sourcePokemonPowerTier(entry.potentialPower).label)}` : "—"}</strong></article>
        <article><small>Taille</small><strong>${entry.caught ? `${entry.height.toLocaleString("fr-FR")} m` : "—"}</strong></article><article><small>Poids</small><strong>${entry.caught ? `${entry.weight.toLocaleString("fr-FR")} kg` : "—"}</strong></article>
        <article class="wide"><small>Type</small><div class="source-summary-types">${types}</div></article></div>
      ${entry.caught ? `<p class="source-summary-note source-pokedex-description">${escapeHtml(entry.pokedexEntry)}</p>
        <div class="source-summary-stats source-pokedex-general-stats">${stats}</div>
        <div class="source-pokedex-detail-columns"><article><small>Talents connus</small><strong>${escapeHtml(entry.abilities.join(" · ") || "Inconnu")}</strong></article><article class="source-pokedex-evolutions"><small>Évolution suivante</small>${evolutions}</article></div>`
        : '<p class="source-summary-note source-pokedex-description locked">Capturez cette espèce pour débloquer sa catégorie, ses mensurations et ses données générales.</p>'}`;
  return `<section class="source-pokedex-detail" role="dialog" aria-modal="true" aria-label="Données Pokédex de ${escapeHtml(entry.name)}">
    <header><div><small>N°${String(entry.number).padStart(4, "0")} · ${entry.caught ? "OBTENU" : "OBSERVÉ"}</small><strong>${escapeHtml(entry.name)}</strong></div><span>${position + 1}/${count}</span><button type="button" data-pokedex-detail-close aria-label="Fermer">×</button></header>
    <nav class="source-summary-tabs" aria-label="Pages de la fiche Pokédex"><button type="button" data-pokedex-detail-page="information"${page === "information" ? ' class="active"' : ""}>Informations</button><button type="button" data-pokedex-detail-page="habitat"${page === "habitat" ? ' class="active"' : ""}>Zones de capture</button></nav>
    <div class="source-summary-layout${page === "habitat" ? " source-pokedex-habitat-layout" : ""}">${page === "information" ? informationAside : ""}
      <section class="source-summary-page">${page === "habitat" ? habitatPage(entry, catalog) : informationPage}</section></div>
    <footer><button type="button" data-pokedex-detail-nav="previous"${count < 2 ? " disabled" : ""}>‹ Pokémon précédent</button><span>Fiche générale du Pokédex</span><button type="button" data-pokedex-detail-nav="next"${count < 2 ? " disabled" : ""}>Pokémon suivant ›</button></footer></section>`;
}

function sourceStatus(value: FormDataEntryValue | null): PokedexStatus {
  return typeof value === "string" && ["unseen", "seen", "caught", "current", "team", "ranch", "evolved", "released"].includes(value)
    ? value as PokedexStatus : "all";
}
function sourcePowerTier(value: FormDataEntryValue | null): SourcePokemonPowerTier {
  return typeof value === "string" && ["very-low", "low", "moderate", "good", "very-powerful", "super-powerful"].includes(value)
    ? value as SourcePokemonPowerTier : "all";
}

export class SourcePokedexView {
  private filters: SourcePokedexFilters = { query: "", firstType: null, secondType: null, status: "all",
    potentialTier: "all", sort: "number" };
  private page = 0; private selectedSpecies: string | null = null;
  private spriteAnimationFrame: number | null = null;
  private spriteAnimationGeneration = 0;
  private detailPage: "information" | "habitat" = "information";

  public render(root: HTMLElement, model: SourcePokedexViewModel): void {
    this.stopSpriteAnimation();
    const entries = createSourcePokedexEntries(model); const filtered = filterSourcePokedexEntries(entries, this.filters);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); this.page = Math.min(this.page, pageCount - 1);
    const visible = filtered.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    const caught = entries.filter((entry) => entry.caught).length; const seen = entries.filter((entry) => entry.seen).length;
    const percentage = entries.length === 0 ? 0 : caught / entries.length * 100;
    const types = [...new Set(model.catalog.pokemon.flatMap((pokemon) => pokemon.types))].sort((left, right) => left.localeCompare(right));
    root.innerHTML = `<div class="source-menu-title source-pokedex-title"><div><small>ENCYCLOPÉDIE</small><h3>Pokédex de Kalos</h3></div><span>${caught}/${entries.length}</span></div>
      <section class="source-pokedex-progress"><div><strong>${caught} espèces obtenues</strong><span>${seen} vues · ${entries.length - caught} à obtenir</span></div><i><b style="width:${percentage}%"></b></i></section>
      <form class="source-pokedex-filters"><label class="source-pokedex-search"><span>Nom ou numéro</span><input name="query" type="search" value="${escapeHtml(this.filters.query)}" placeholder="Ex. Feunnec ou 653"></label>
        <label><span>Type 1</span><select name="firstType">${typeOptions(types, this.filters.firstType, "Tous")}</select></label><label><span>Type 2</span><select name="secondType">${typeOptions(types, this.filters.secondType, "Indifférent")}</select></label>
        <label><span>État</span><select name="status">${statusOptions(this.filters.status)}</select></label><label><span>Potentiel</span><select name="potentialTier">${powerOptions(this.filters.potentialTier)}</select></label>
        <label><span>Tri</span><select name="sort"><option value="number"${this.filters.sort === "number" ? " selected" : ""}>Numéro</option><option value="name"${this.filters.sort === "name" ? " selected" : ""}>Nom</option><option value="potential-power"${this.filters.sort === "potential-power" ? " selected" : ""}>Potentiel</option></select></label>
        <button type="button" data-pokedex-reset>Réinitialiser</button></form>
      <div class="source-pokedex-result"><strong>${filtered.length}</strong> résultat${filtered.length > 1 ? "s" : ""}<span>Filtrage automatique</span></div>
      <div class="source-pokedex-grid">${visible.length === 0 ? '<div class="source-pokedex-empty">Aucune espèce ne correspond à ces filtres.</div>' : visible.map((entry) => card(entry, this.filters.potentialTier !== "all")).join("")}</div>
      <footer class="source-pokedex-footer"><button type="button" data-pokedex-page="previous"${this.page === 0 ? " disabled" : ""}>‹</button><span>Page ${this.page + 1} / ${pageCount}</span><button type="button" data-pokedex-page="next"${this.page >= pageCount - 1 ? " disabled" : ""}>›</button><em>Zones de capture dans chaque fiche</em></footer>`;
    const filterForm = root.querySelector<HTMLFormElement>(".source-pokedex-filters");
    const updateFilters = (restoreSearchFocus: boolean): void => {
      if (filterForm === null) return;
      const search = filterForm.elements.namedItem("query") as HTMLInputElement | null; const selection = search?.selectionStart ?? null;
      const data = new FormData(filterForm); const text = (name: string): string | null => { const value = data.get(name); return typeof value === "string" && value !== "" ? value : null; };
      this.filters = { query: String(data.get("query") ?? ""), firstType: text("firstType"), secondType: text("secondType"),
        status: sourceStatus(data.get("status")), potentialTier: sourcePowerTier(data.get("potentialTier")),
        sort: data.get("sort") === "name" ? "name" : data.get("sort") === "potential-power" ? "potential-power" : "number" };
      this.page = 0; this.render(root, model);
      if (restoreSearchFocus) { const nextSearch = root.querySelector<HTMLInputElement>('input[name="query"]'); nextSearch?.focus(); if (selection !== null) nextSearch?.setSelectionRange(selection, selection); }
    };
    filterForm?.addEventListener("submit", (event) => event.preventDefault());
    filterForm?.addEventListener("input", (event) => { if (event.target instanceof HTMLInputElement && event.target.name === "query") updateFilters(true); });
    filterForm?.addEventListener("change", () => updateFilters(false));
    root.querySelector<HTMLButtonElement>("[data-pokedex-reset]")?.addEventListener("click", () => {
      this.filters = { query: "", firstType: null, secondType: null, status: "all", potentialTier: "all", sort: "number" };
      this.page = 0; this.render(root, model);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-pokedex-page]").forEach((button) => button.addEventListener("click", () => { this.page += button.dataset.pokedexPage === "next" ? 1 : -1; this.render(root, model); }));
    root.querySelectorAll<HTMLButtonElement>("[data-pokedex-species]").forEach((button) => button.addEventListener("click", () => { this.selectedSpecies = button.dataset.pokedexSpecies ?? null; this.detailPage = "information"; this.renderDetail(root, model, filtered); }));
  }

  private renderDetail(root: HTMLElement, model: SourcePokedexViewModel, filtered: readonly SourcePokedexEntry[]): void {
    const entries = filtered.filter((entry) => entry.seen || entry.caught);
    const index = Math.max(0, entries.findIndex((entry) => entry.species === this.selectedSpecies)); const entry = entries[index];
    if (entry === undefined) { this.selectedSpecies = null; this.render(root, model); return; }
    root.insertAdjacentHTML("beforeend", detail(entry, index, entries.length, model.regionMap, this.detailPage));
    if (this.detailPage === "information") this.startSpriteAnimation(root, entry);
    root.querySelector<HTMLButtonElement>("[data-pokedex-detail-close]")?.addEventListener("click", () => {
      this.stopSpriteAnimation(); this.selectedSpecies = null; root.querySelector(".source-pokedex-detail")?.remove();
    });
    root.querySelectorAll<HTMLButtonElement>("[data-pokedex-detail-nav]").forEach((button) => button.addEventListener("click", () => {
      const offset = button.dataset.pokedexDetailNav === "previous" ? -1 : 1;
      this.selectedSpecies = entries[(index + offset + entries.length) % entries.length]?.species ?? null;
      this.stopSpriteAnimation(); root.querySelector(".source-pokedex-detail")?.remove(); this.renderDetail(root, model, filtered);
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-pokedex-detail-page]").forEach((button) => button.addEventListener("click", () => {
      this.detailPage = button.dataset.pokedexDetailPage === "habitat" ? "habitat" : "information";
      this.stopSpriteAnimation(); root.querySelector(".source-pokedex-detail")?.remove(); this.renderDetail(root, model, filtered);
    }));
  }

  private stopSpriteAnimation(): void {
    this.spriteAnimationGeneration += 1;
    if (this.spriteAnimationFrame !== null) cancelAnimationFrame(this.spriteAnimationFrame);
    this.spriteAnimationFrame = null;
  }

  private startSpriteAnimation(root: HTMLElement, entry: SourcePokedexEntry): void {
    const canvas = root.querySelector<HTMLCanvasElement>("[data-pokedex-summary-sprite]");
    if (canvas === null || entry.battlerUrl === null || entry.battlerFrameWidth === null
      || entry.battlerFrameHeight === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const generation = this.spriteAnimationGeneration;
    const image = new Image();
    image.onload = () => {
      if (generation !== this.spriteAnimationGeneration) return;
      let frame = 0; let previous = performance.now();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const draw = (time: number): void => {
        if (generation !== this.spriteAnimationGeneration) return;
        if (time - previous >= 120 && !reducedMotion) {
          frame = (frame + 1) % entry.battlerFrameCount; previous = time;
        }
        context.clearRect(0, 0, entry.battlerFrameWidth!, entry.battlerFrameHeight!);
        context.drawImage(image, frame * entry.battlerFrameWidth!, 0,
          entry.battlerFrameWidth!, entry.battlerFrameHeight!, 0, 0,
          entry.battlerFrameWidth!, entry.battlerFrameHeight!);
        if (entry.battlerFrameCount > 1 && !reducedMotion) this.spriteAnimationFrame = requestAnimationFrame(draw);
      };
      draw(previous);
    };
    image.src = entry.battlerUrl;
  }
}
