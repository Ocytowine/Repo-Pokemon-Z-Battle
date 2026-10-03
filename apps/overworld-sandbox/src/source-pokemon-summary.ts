import { pokemonTypeIconUrl } from "@pokemon-z-battle/game-assets";
import { experienceAtLevel, POKEMON_NATURES, type PlayerDetailsCatalog, type PokemonNature,
  type PokemonTrainingValues, type PublicPokemonIdentity } from "@pokemon-z-battle/player-state";
import { resolvePokemonAsset, type PokemonAssetsManifest, type PokemonSummaryAssets }
  from "@pokemon-z-battle/local-assets";
import type { SourcePokemonCollectionEntry } from "./source-pokemon-collection.js";
import { sourcePokemonTypeLabel } from "./source-pokemon-collection.js";

export type SourcePokemonSummaryContext = "team" | "ranch" | "battle";
export type SourcePokemonSummaryPage = "identity" | "history" | "stats" | "moves" | "ribbons";

export interface SourcePublicPokemonSummary {
  readonly visibility: "public";
  readonly species: string;
  readonly displayName: string;
  readonly number: number;
  readonly level: number;
  readonly types: readonly string[];
  readonly gender: PublicPokemonIdentity["gender"];
  readonly shiny: boolean;
  readonly form: number;
  readonly originalTrainer: PublicPokemonIdentity["originalTrainer"];
  readonly restrictedPages: readonly Exclude<SourcePokemonSummaryPage, "identity">[];
}

export interface SourcePokemonSummaryModel {
  readonly entry: SourcePokemonCollectionEntry;
  readonly species: PlayerDetailsCatalog["pokemon"][number];
  readonly ability: PlayerDetailsCatalog["abilities"][number] | null;
  readonly spriteUrl: string | null;
  readonly spriteAnimation: { readonly frameWidth: number; readonly frameHeight: number;
    readonly frameCount: number } | null;
  readonly cryPath: string | null;
  readonly moves: readonly { readonly slot: SourcePokemonCollectionEntry["pokemon"]["moves"][number];
    readonly definition: PlayerDetailsCatalog["moves"][number] | null }[];
  readonly ballUrl: string | null;
  readonly shinyUrl: string | null;
  readonly pokerusUrl: string | null;
  readonly statusesUrl: string | null;
  readonly statusRow: number | null;
  readonly ballName: string;
  readonly heldItemName: string;
  readonly formName: string | null;
  readonly status: string;
  readonly experienceToNextLevel: number;
  readonly characteristic: string;
  readonly hiddenPowerType: string;
}

export interface SourcePokemonSummaryViewModel {
  readonly open: boolean;
  readonly context: SourcePokemonSummaryContext;
  readonly pokemonId: string | null;
  readonly entries: readonly SourcePokemonCollectionEntry[];
  readonly catalog: PlayerDetailsCatalog;
  readonly pokemonAssets: PokemonAssetsManifest;
  readonly summaryAssets: PokemonSummaryAssets;
  readonly itemNames: ReadonlyMap<string, string>;
}

export interface SourcePokemonSummaryCallbacks {
  readonly onClose: () => void;
  readonly onPokemonChanged: (pokemonId: string, cryPath: string | null) => void;
  readonly onMoveReorder: (pokemonId: string, fromIndex: number, toIndex: number) => void;
}

const SUMMARY_PAGES: readonly { readonly id: SourcePokemonSummaryPage; readonly label: string }[] = [
  { id: "identity", label: "Identité" }, { id: "history", label: "Historique" },
  { id: "stats", label: "Stats" }, { id: "moves", label: "Capacités" },
  { id: "ribbons", label: "Rubans" },
];

const NATURE_LABELS: Readonly<Record<PokemonNature, string>> = {
  HARDY: "Hardi", LONELY: "Solo", BRAVE: "Brave", ADAMANT: "Rigide", NAUGHTY: "Mauvais",
  BOLD: "Assuré", DOCILE: "Docile", RELAXED: "Relax", IMPISH: "Malin", LAX: "Lâche",
  TIMID: "Timide", HASTY: "Pressé", SERIOUS: "Sérieux", JOLLY: "Jovial", NAIVE: "Naïf",
  MODEST: "Modeste", MILD: "Doux", QUIET: "Discret", BASHFUL: "Pudique", RASH: "Foufou",
  CALM: "Calme", GENTLE: "Gentil", SASSY: "Malpoli", CAREFUL: "Prudent", QUIRKY: "Bizarre",
};

const STAT_ORDER = ["hp", "attack", "defense", "speed", "specialAttack", "specialDefense"] as const;
const NATURE_STAT_ORDER = ["attack", "defense", "speed", "specialAttack", "specialDefense"] as const;
const STAT_LABELS: Readonly<Record<typeof STAT_ORDER[number], string>> = {
  hp: "PV", attack: "Attaque", defense: "Défense", speed: "Vitesse",
  specialAttack: "Atq. Spé.", specialDefense: "Déf. Spé.",
};
const CHARACTERISTICS = [
  ["Adore manger.", "S'assoupit souvent.", "Éparpille souvent les choses.", "S'emporte facilement.", "Aime se détendre."],
  ["Fier de sa puissance.", "Aime se démener.", "Un peu coléreux.", "Aime la bagarre.", "Très coléreux."],
  ["Corps robuste.", "Encaisse bien les coups.", "Très persévérant.", "Bon combattant.", "Très endurant."],
  ["Aime courir.", "Attentif aux sons.", "Vif et étourdi.", "Un peu clown.", "Fuit rapidement."],
  ["Très curieux.", "Coquin.", "Très astucieux.", "Souvent dans la lune.", "Très méticuleux."],
  ["Fort volontaire.", "Un peu vaniteux.", "Fortement obstiné.", "Déteste perdre.", "Un peu entêté."],
] as const;
const HIDDEN_POWER_TYPES = ["FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG", "GHOST", "STEEL",
  "FIRE", "WATER", "GRASS", "ELECTRIC", "PSYCHIC", "ICE", "DRAGON", "DARK", "FAIRY"] as const;
const MARKS = ["●", "■", "▲", "♥"] as const;
const BALL_TYPES: Readonly<Record<string, number>> = Object.freeze({
  POKEBALL: 0, GREATBALL: 1, SAFARIBALL: 2, ULTRABALL: 3, MASTERBALL: 4, NETBALL: 5, DIVEBALL: 6,
  NESTBALL: 7, REPEATBALL: 8, TIMERBALL: 9, LUXURYBALL: 10, PREMIERBALL: 11, DUSKBALL: 12,
  HEALBALL: 13, QUICKBALL: 14, CHERISHBALL: 15, FASTBALL: 16, LEVELBALL: 17, LUREBALL: 18,
  HEAVYBALL: 19, LOVEBALL: 20, FRIENDBALL: 21, MOONBALL: 22, SPORTBALL: 23,
  ESPIRIBALL: 24, POKEBALLCASERA: 25, SUPERBALLCASERA: 26, ULTRABALLCASERA: 27,
});

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

export function sourcePokemonCharacteristic(personalId: number, ivs: PokemonTrainingValues): string {
  let bestIndex = 0;
  const tiebreaker = personalId % 6;
  for (let index = 0; index < STAT_ORDER.length; index += 1) {
    const value = ivs[STAT_ORDER[index]!];
    const best = ivs[STAT_ORDER[bestIndex]!];
    if (value === best) {
      if (index >= tiebreaker && bestIndex < tiebreaker) bestIndex = index;
    } else if (value > best) bestIndex = index;
  }
  const iv = ivs[STAT_ORDER[bestIndex]!];
  return CHARACTERISTICS[bestIndex]![iv % 5]!;
}

export function sourceHiddenPowerType(ivs: PokemonTrainingValues): string {
  const bits = STAT_ORDER.reduce((value, stat, index) => value | ((ivs[stat] & 1) << index), 0);
  return HIDDEN_POWER_TYPES[Math.floor((bits * (HIDDEN_POWER_TYPES.length - 1)) / 63)]!;
}

export function createPublicSourcePokemonSummary(identity: PublicPokemonIdentity,
  catalog: PlayerDetailsCatalog): SourcePublicPokemonSummary {
  const species = catalog.pokemon.find((candidate) => candidate.internalName === identity.species);
  if (species === undefined) throw new Error(`Espèce absente du catalogue : ${identity.species}.`);
  return { visibility: "public", species: identity.species, displayName: identity.nickname ?? species.name,
    number: species.id, level: identity.level, types: species.types, gender: identity.gender,
    shiny: identity.shiny, form: identity.form, originalTrainer: identity.originalTrainer,
    restrictedPages: ["history", "stats", "moves", "ribbons"] };
}

export function createSourcePokemonSummary(entry: SourcePokemonCollectionEntry, catalog: PlayerDetailsCatalog,
  pokemonAssets: PokemonAssetsManifest, summaryAssets: PokemonSummaryAssets,
  itemNames: ReadonlyMap<string, string>): SourcePokemonSummaryModel {
  const pokemon = entry.pokemon;
  const species = catalog.pokemon.find((candidate) => candidate.internalName === pokemon.species);
  if (species === undefined) throw new Error(`Espèce absente du catalogue : ${pokemon.species}.`);
  const assets = pokemonAssets.records.find((candidate) => candidate.id === species.id);
  const request = { form: pokemon.metadata.form, shiny: pokemon.metadata.shiny,
    female: pokemon.metadata.gender === "female" } as const;
  const sprite = assets === undefined ? null : resolvePokemonAsset(assets, { kind: "battler", ...request }).asset;
  const cry = assets === undefined ? null : resolvePokemonAsset(assets, { kind: "cry", ...request }).asset;
  const ballName = pokemon.metadata.origin.ball ?? "POKEBALL";
  const ballIndex = BALL_TYPES[ballName] ?? 0;
  const ballPath = summaryAssets.balls.get(ballIndex) ?? summaryAssets.balls.get(0) ?? null;
  const ability = pokemon.ability === null ? null
    : catalog.abilities.find((candidate) => candidate.internalName === pokemon.ability) ?? null;
  const nextExperience = pokemon.level >= 100 ? pokemon.experience : experienceAtLevel(pokemon.level + 1, species.growthRate);
  const formName = pokemon.metadata.form === 0 ? null : species.formNames[pokemon.metadata.form] || `Forme ${pokemon.metadata.form}`;
  const statusRows: Readonly<Record<string, number>> = { sleep: 0, poison: 1, burn: 2, paralysis: 3,
    frozen: 4, caduco: 5, hemorrhage: 6 };
  const statusRow = pokemon.majorStatus !== null ? statusRows[pokemon.majorStatus.kind] ?? null
    : pokemon.hp <= 0 ? 7 : pokemon.metadata.pokerus?.cured === false ? 8 : null;
  const spriteFrames = sprite?.frameCount ?? 1;
  const spriteAnimation = sprite === null || sprite.width === null || sprite.height === null ? null
    : { frameWidth: Math.floor(sprite.width / spriteFrames), frameHeight: sprite.height, frameCount: spriteFrames };
  const moveDefinitions = new Map(catalog.moves.map((move) => [move.internalName, move]));
  return { entry, species, ability, spriteUrl: sprite === null ? null : sourceUrl(sprite.path), spriteAnimation,
    cryPath: cry?.path ?? null, moves: pokemon.moves.map((slot) => ({ slot,
      definition: moveDefinitions.get(slot.internalName) ?? null })),
    ballUrl: ballPath === null ? null : sourceUrl(ballPath),
    shinyUrl: summaryAssets.shiny === null ? null : sourceUrl(summaryAssets.shiny),
    pokerusUrl: summaryAssets.pokerus === null ? null : sourceUrl(summaryAssets.pokerus),
    statusesUrl: summaryAssets.statuses === null ? null : sourceUrl(summaryAssets.statuses), statusRow,
    ballName: itemNames.get(ballName) ?? ballName,
    heldItemName: pokemon.heldItem === null ? "Aucun" : itemNames.get(pokemon.heldItem) ?? pokemon.heldItem,
    formName, status: pokemon.hp <= 0 ? "K.O." : pokemon.majorStatus?.kind ?? "En forme",
    experienceToNextLevel: Math.max(0, nextExperience - pokemon.experience),
    characteristic: sourcePokemonCharacteristic(pokemon.metadata.personalId, pokemon.metadata.ivs),
    hiddenPowerType: sourceHiddenPowerType(pokemon.metadata.ivs) };
}

function genderSymbol(gender: SourcePokemonSummaryModel["entry"]["pokemon"]["metadata"]["gender"]): string {
  return gender === "male" ? "♂" : gender === "female" ? "♀" : gender === "genderless" ? "◇" : "?";
}

function readableStatus(status: string): string {
  const labels: Readonly<Record<string, string>> = { sleep: "Sommeil", poison: "Poison", burn: "Brûlure",
    paralysis: "Paralysie", frozen: "Gel", caduco: "Caduco", hemorrhage: "Hémorragie" };
  return labels[status] ?? status;
}

function dateLabel(value: string | null): string {
  if (value === null) return "Information inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date source illisible" : date.toLocaleDateString("fr-FR");
}

function mapLabel(mapId: number | null): string {
  return mapId === null ? "Lieu inconnu" : `Carte ${String(mapId).padStart(3, "0")}`;
}

function originLabel(method: SourcePokemonSummaryModel["entry"]["pokemon"]["metadata"]["origin"]["method"]): string {
  return { encounter: "Rencontré", egg: "Reçu comme œuf", trade: "Obtenu par échange", gift: "Reçu en cadeau",
    fateful: "Rencontre fatidique", unknown: "Méthode inconnue" }[method];
}

function natureEffect(nature: PokemonNature, stat: typeof NATURE_STAT_ORDER[number]): "up" | "down" | "neutral" {
  const index = POKEMON_NATURES.indexOf(nature);
  const up = Math.floor(index / 5);
  const down = index % 5;
  const statIndex = NATURE_STAT_ORDER.indexOf(stat);
  return up === down || statIndex < 0 ? "neutral" : statIndex === up ? "up" : statIndex === down ? "down" : "neutral";
}

function identityPage(model: SourcePokemonSummaryModel): string {
  const pokemon = model.entry.pokemon;
  const owner = pokemon.metadata.owner;
  const typeBadges = model.entry.types.map((type) => `<span><img src="${pokemonTypeIconUrl(type)}" alt="">${escapeHtml(sourcePokemonTypeLabel(type))}</span>`).join("");
  return `<div class="source-summary-fields source-summary-identity">
    <article><small>N° Pokédex</small><strong>${String(model.species.id).padStart(3, "0")}</strong></article>
    <article><small>Espèce</small><strong>${escapeHtml(model.species.kind)}</strong></article>
    <article class="wide"><small>Type</small><div class="source-summary-types">${typeBadges}</div></article>
    <article><small>Dresseur d'origine</small><strong>${escapeHtml(owner.name ?? "Inconnu")}</strong></article>
    <article><small>N° ID public</small><strong>${owner.publicId === null ? "Inconnu" : String(owner.publicId).padStart(5, "0")}</strong></article>
    <article><small>Expérience totale</small><strong>${pokemon.experience.toLocaleString("fr-FR")}</strong></article>
    <article><small>Prochain niveau</small><strong>${pokemon.level >= 100 ? "Niveau maximal" : `${model.experienceToNextLevel.toLocaleString("fr-FR")} EXP`}</strong></article>
    <article><small>Taille</small><strong>${model.species.height.toLocaleString("fr-FR")} m</strong></article>
    <article><small>Poids</small><strong>${model.species.weight.toLocaleString("fr-FR")} kg</strong></article>
    <p class="source-summary-note">L'entrée Pokédex française n'est pas disponible dans les données extraites : aucun texte anglais n'est substitué.</p>
  </div>`;
}

function historyPage(model: SourcePokemonSummaryModel): string {
  const metadata = model.entry.pokemon.metadata;
  const egg = metadata.eggSteps > 0;
  return `<div class="source-summary-history">
    <article><small>Nature</small><strong>${escapeHtml(NATURE_LABELS[metadata.nature])}</strong><p>${escapeHtml(model.characteristic)}</p></article>
    <article><small>Obtention</small><strong>${escapeHtml(originLabel(metadata.origin.method))} au niveau ${metadata.origin.level}</strong><p>${escapeHtml(mapLabel(metadata.origin.mapId))} · ${escapeHtml(dateLabel(metadata.origin.receivedAt))}</p></article>
    <article><small>Éclosion</small><strong>${metadata.origin.hatchedAt === null ? "Non renseignée" : escapeHtml(dateLabel(metadata.origin.hatchedAt))}</strong><p>${escapeHtml(mapLabel(metadata.origin.hatchedMapId))}</p></article>
    <article><small>Compatibilité Pokémon Z</small><strong>${egg ? `Œuf · ${metadata.eggSteps} pas restants` : "Pokémon éclos"}</strong><p>Pokémon obscur : état non représenté dans la sauvegarde actuelle.</p></article>
  </div>`;
}

function ivRank(iv: number): string { return iv > 25 ? "★★★★" : iv > 16 ? "★★★☆" : iv > 6 ? "★★☆☆" : "★☆☆☆"; }

function statsPage(model: SourcePokemonSummaryModel, advanced: boolean): string {
  const pokemon = model.entry.pokemon;
  if (advanced) {
    const values = STAT_ORDER.map((stat) => `<tr><th>${STAT_LABELS[stat]}</th><td>${pokemon.metadata.evs[stat]}</td><td>${pokemon.metadata.ivs[stat]}</td></tr>`).join("");
    return `<div class="source-summary-advanced"><div class="source-summary-ability"><small>Talent</small><strong>${escapeHtml(model.ability?.name ?? pokemon.ability ?? "Inconnu")}</strong><p>${escapeHtml(model.ability?.description ?? "Description indisponible.")}</p></div>
      <table><thead><tr><th>Stat</th><th>EV</th><th>IV</th></tr></thead><tbody>${values}</tbody></table>
      <div class="source-summary-advanced-foot"><span>Bonheur <b>${pokemon.metadata.happiness ?? "Inconnu"}</b></span><span>Puissance Cachée <b>${escapeHtml(sourcePokemonTypeLabel(model.hiddenPowerType))}</b></span></div></div>`;
  }
  const stats = [
    ["hp", "PV", `${pokemon.hp}/${pokemon.stats.maxHp}`], ["attack", "Attaque", pokemon.stats.attack],
    ["defense", "Défense", pokemon.stats.defense], ["specialAttack", "Atq. Spé.", pokemon.stats.specialAttack],
    ["specialDefense", "Déf. Spé.", pokemon.stats.specialDefense], ["speed", "Vitesse", pokemon.stats.speed],
  ] as const;
  return `<div class="source-summary-stats">${stats.map(([stat, label, value]) => {
    const effect = stat === "hp" ? "neutral" : natureEffect(pokemon.metadata.nature, stat);
    const iv = pokemon.metadata.ivs[stat];
    return `<article class="${effect}"><small>${label}</small><strong>${value}</strong><span title="Appréciation IV de Z">${ivRank(iv)}</span></article>`;
  }).join("")}<div class="source-summary-ability"><small>Talent</small><strong>${escapeHtml(model.ability?.name ?? pokemon.ability ?? "Inconnu")}</strong><p>${escapeHtml(model.ability?.description ?? "Description indisponible.")}</p></div></div>`;
}

function moveValue(value: number, kind: "power" | "accuracy"): string {
  if (value === 0) return "—";
  if (kind === "power" && value === 1) return "???";
  return String(value);
}

function movesPage(model: SourcePokemonSummaryModel, summaryAssets: PokemonSummaryAssets,
  selectedIndex: number, movingIndex: number | null, editable: boolean): string {
  const selected = model.moves[selectedIndex] ?? model.moves[0] ?? null;
  const categoryIndex = selected?.definition?.category === "Special" ? 1
    : selected?.definition?.category === "Status" ? 2
      : selected?.definition?.category === "Physical" ? 0 : null;
  const categorySheet = summaryAssets.category === null ? null : sourceUrl(summaryAssets.category);
  const categoryLabel = selected?.definition?.category === "Physical" ? "Physique"
    : selected?.definition?.category === "Special" ? "Spéciale"
      : selected?.definition?.category === "Status" ? "Statut" : "Inconnue";
  const cards = Array.from({ length: 4 }, (_, index) => {
    const move = model.moves[index];
    if (move === undefined) return '<span class="source-summary-move empty"><strong>—</strong><small>Emplacement libre</small></span>';
    const definition = move.definition;
    const type = definition?.type ?? "UNKNOWN";
    return `<button type="button" data-summary-move="${index}" class="source-summary-move${index === selectedIndex ? " selected" : ""}${index === movingIndex ? " moving" : ""}"><img src="${pokemonTypeIconUrl(type)}" alt=""><div><strong>${escapeHtml(definition?.name ?? move.slot.internalName)}</strong><small>${escapeHtml(sourcePokemonTypeLabel(type))}</small></div><span>${move.slot.pp}/${move.slot.maxPp}<small>PP</small></span></button>`;
  }).join("");
  const details = selected === null ? '<div class="source-summary-move-details empty">Aucune capacité.</div>'
    : `<div class="source-summary-move-details"><header><div>${categorySheet === null || categoryIndex === null ? "" : `<i style="--category-sheet:url('${categorySheet}');--category-y:${-28 * categoryIndex}px"></i>`}<span><small>Catégorie</small><strong>${categoryLabel}</strong></span></div>${editable ? `<button type="button" data-summary-reorder>${movingIndex === null ? "Réorganiser" : "Annuler"}</button>` : '<em>Lecture seule</em>'}</header><dl><div><dt>Puissance</dt><dd>${moveValue(selected.definition?.power ?? 0, "power")}</dd></div><div><dt>Précision</dt><dd>${moveValue(selected.definition?.accuracy ?? 0, "accuracy")}</dd></div><div><dt>PP</dt><dd>${selected.slot.pp}/${selected.slot.maxPp}</dd></div></dl><p>${escapeHtml(selected.definition?.description ?? "Description indisponible.")}</p>${movingIndex === null ? "" : "<aside>Sélectionnez le nouvel emplacement de cette capacité.</aside>"}</div>`;
  return `<div class="source-summary-moves"><div class="source-summary-move-list">${cards}</div>${details}</div>`;
}

function ribbonsPage(model: SourcePokemonSummaryModel, summaryAssets: PokemonSummaryAssets): string {
  const ribbons = model.entry.pokemon.metadata.ribbons;
  const sheet = summaryAssets.ribbons === null ? null : sourceUrl(summaryAssets.ribbons);
  const cells = ribbons.map((ribbon) => {
    const id = Number(ribbon);
    const style = sheet !== null && Number.isInteger(id) && id >= 1 && id <= 80
      ? ` style="--ribbon-sheet:url('${sheet}');--ribbon-x:${-64 * ((id - 1) % 8)}px;--ribbon-y:${-64 * Math.floor((id - 1) / 8)}px"` : "";
    return `<span class="source-summary-ribbon${style === "" ? " text" : ""}"${style} title="${escapeHtml(ribbon)}">${style === "" ? escapeHtml(ribbon) : ""}</span>`;
  }).join("");
  return `<div class="source-summary-ribbons"><header><strong>${ribbons.length} ruban${ribbons.length > 1 ? "s" : ""}</strong><span>12 visibles dans l'écran original de Z</span></header><div>${cells || '<p>Aucun ruban obtenu.</p>'}</div><p class="source-summary-note">L'obtention et les libellés français des rubans seront raccordés avec leurs mécaniques source.</p></div>`;
}

function pageHtml(page: SourcePokemonSummaryPage, model: SourcePokemonSummaryModel,
  summaryAssets: PokemonSummaryAssets, advanced: boolean, selectedMoveIndex: number,
  movingMoveIndex: number | null, movesEditable: boolean): string {
  if (page === "identity") return identityPage(model);
  if (page === "history") return historyPage(model);
  if (page === "stats") return statsPage(model, advanced);
  if (page === "moves") return movesPage(model, summaryAssets, selectedMoveIndex, movingMoveIndex, movesEditable);
  return ribbonsPage(model, summaryAssets);
}

export class SourcePokemonSummaryView {
  private page: SourcePokemonSummaryPage = "identity";
  private advancedStats = false;
  private lastPokemonId: string | null = null;
  private selectedMoveIndex = 0;
  private movingMoveIndex: number | null = null;
  private spriteAnimationFrame: number | null = null;
  private spriteAnimationGeneration = 0;

  public constructor(private readonly callbacks: SourcePokemonSummaryCallbacks) {}

  public render(view: SourcePokemonSummaryViewModel): void {
    const root = document.querySelector<HTMLElement>("#source-pokemon-summary");
    if (root === null) return;
    this.stopSpriteAnimation();
    root.hidden = !view.open;
    if (!view.open) { this.lastPokemonId = null; this.movingMoveIndex = null; return; }
    const index = Math.max(0, view.entries.findIndex((entry) => entry.pokemon.id === view.pokemonId));
    const entry = view.entries[index];
    if (entry === undefined) { this.callbacks.onClose(); return; }
    const model = createSourcePokemonSummary(entry, view.catalog, view.pokemonAssets, view.summaryAssets, view.itemNames);
    const pokemon = entry.pokemon;
    if (this.lastPokemonId !== pokemon.id) {
      this.lastPokemonId = pokemon.id;
      this.selectedMoveIndex = 0;
      this.movingMoveIndex = null;
      queueMicrotask(() => this.callbacks.onPokemonChanged(pokemon.id, model.cryPath));
    }
    this.selectedMoveIndex = Math.min(this.selectedMoveIndex, Math.max(0, model.moves.length - 1));
    const marks = MARKS.map((mark, markIndex) => `<span class="${(pokemon.metadata.markings & (1 << markIndex)) !== 0 ? "active" : ""}">${mark}</span>`).join("");
    const statusIcon = model.statusesUrl === null || model.statusRow === null ? ""
      : `<i class="source-summary-status-icon" style="--status-sheet:url('${model.statusesUrl}');--status-y:${-16 * model.statusRow}px"></i>`;
    const flags = [pokemon.metadata.shiny ? `<span class="shiny">${model.shinyUrl === null ? "★" : `<img src="${model.shinyUrl}" alt="">`} Chromatique</span>` : "",
      pokemon.metadata.pokerus === null ? "" : `<span>${pokemon.metadata.pokerus.cured && model.pokerusUrl !== null ? `<img src="${model.pokerusUrl}" alt="">` : ""}${pokemon.metadata.pokerus.cured ? "Pokérus guéri" : "Pokérus actif"}</span>`,
      `<span>${statusIcon}${escapeHtml(readableStatus(model.status))}</span>`].join("");
    const spriteScale = model.spriteAnimation === null ? 1 : Math.min(2,
      136 / model.spriteAnimation.frameWidth, 120 / model.spriteAnimation.frameHeight);
    const spriteMarkup = model.spriteUrl === null || model.spriteAnimation === null ? "?"
      : `<canvas data-summary-sprite width="${model.spriteAnimation.frameWidth}" height="${model.spriteAnimation.frameHeight}" style="width:${Math.round(model.spriteAnimation.frameWidth * spriteScale)}px;height:${Math.round(model.spriteAnimation.frameHeight * spriteScale)}px" role="img" aria-label="${escapeHtml(entry.displayName)}"></canvas>`;
    const tabs = SUMMARY_PAGES.map((candidate) => `<button type="button" data-summary-page="${candidate.id}" class="${candidate.id === this.page ? "active" : ""}">${candidate.label}</button>`).join("");
    root.innerHTML = `<header><div><small>${view.context === "team" ? "ÉQUIPE" : view.context === "ranch" ? "RANCH" : "COMBAT · LECTURE SEULE"}</small><strong>Résumé Pokémon</strong></div><span>${index + 1}/${view.entries.length}</span><button type="button" data-summary-close aria-label="Fermer">×</button></header>
      <nav class="source-summary-tabs" aria-label="Pages du résumé">${tabs}</nav>
      <div class="source-summary-layout"><aside><div class="source-summary-name"><strong>${escapeHtml(entry.displayName)}</strong><span>N.${pokemon.level} <b class="${pokemon.metadata.gender ?? "unknown"}">${genderSymbol(pokemon.metadata.gender)}</b></span></div>
        <div class="source-summary-sprite">${spriteMarkup}</div>
        <div class="source-summary-flags">${flags}</div><div class="source-summary-form">${escapeHtml(model.formName ?? "Forme normale")}</div>
        <div class="source-summary-object">${model.ballUrl === null ? "" : `<img src="${model.ballUrl}" alt="">`}<span><small>${escapeHtml(model.ballName)}</small><strong>${escapeHtml(model.heldItemName)}</strong></span></div>
        <div class="source-summary-marks" aria-label="Marques">${marks}</div></aside>
        <section class="source-summary-page">${pageHtml(this.page, model, view.summaryAssets, this.advancedStats,
          this.selectedMoveIndex, this.movingMoveIndex, view.context !== "battle")}</section></div>
      <footer><button type="button" data-summary-pokemon="previous"${view.entries.length < 2 ? " disabled" : ""}>↑ Pokémon précédent</button>
        ${this.page === "stats" ? `<button type="button" data-summary-advanced>${this.advancedStats ? "Stats générales" : "IV / EV détaillés"}</button>` : ""}
        <span>← → pages · ↑ ↓ Pokémon</span><button type="button" data-summary-pokemon="next"${view.entries.length < 2 ? " disabled" : ""}>Pokémon suivant ↓</button></footer>`;
    this.startSpriteAnimation(root, model);
    root.querySelector<HTMLButtonElement>("[data-summary-close]")?.addEventListener("click", this.callbacks.onClose);
    root.querySelectorAll<HTMLButtonElement>("[data-summary-page]").forEach((button) => button.addEventListener("click", () => {
      const page = button.dataset.summaryPage as SourcePokemonSummaryPage;
      if (!SUMMARY_PAGES.some((candidate) => candidate.id === page)) return;
      this.page = page;
      this.advancedStats = false;
      this.movingMoveIndex = null;
      this.render(view);
    }));
    root.querySelector<HTMLButtonElement>("[data-summary-advanced]")?.addEventListener("click", () => {
      this.advancedStats = !this.advancedStats;
      this.render(view);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-summary-move]").forEach((button) => button.addEventListener("click", () => {
      const moveIndex = Number(button.dataset.summaryMove);
      if (!Number.isInteger(moveIndex) || moveIndex < 0 || moveIndex >= model.moves.length) return;
      if (this.movingMoveIndex !== null) {
        const fromIndex = this.movingMoveIndex;
        this.movingMoveIndex = null;
        this.selectedMoveIndex = moveIndex;
        if (fromIndex !== moveIndex) this.callbacks.onMoveReorder(pokemon.id, fromIndex, moveIndex);
        else this.render(view);
        return;
      }
      this.selectedMoveIndex = moveIndex;
      this.render(view);
    }));
    root.querySelector<HTMLButtonElement>("[data-summary-reorder]")?.addEventListener("click", () => {
      this.movingMoveIndex = this.movingMoveIndex === null ? this.selectedMoveIndex : null;
      this.render(view);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-summary-pokemon]").forEach((button) => button.addEventListener("click", () => {
      const offset = button.dataset.summaryPokemon === "previous" ? -1 : 1;
      const next = (index + offset + view.entries.length) % view.entries.length;
      const nextEntry = view.entries[next];
      if (nextEntry !== undefined) {
        this.lastPokemonId = nextEntry.pokemon.id;
        this.callbacks.onPokemonChanged(nextEntry.pokemon.id,
          createSourcePokemonSummary(nextEntry, view.catalog, view.pokemonAssets, view.summaryAssets, view.itemNames).cryPath);
      }
    }));
  }

  private stopSpriteAnimation(): void {
    this.spriteAnimationGeneration += 1;
    if (this.spriteAnimationFrame !== null) cancelAnimationFrame(this.spriteAnimationFrame);
    this.spriteAnimationFrame = null;
  }

  private startSpriteAnimation(root: HTMLElement, model: SourcePokemonSummaryModel): void {
    const canvas = root.querySelector<HTMLCanvasElement>("[data-summary-sprite]");
    const animation = model.spriteAnimation;
    if (canvas === null || animation === null || model.spriteUrl === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const generation = this.spriteAnimationGeneration;
    const image = new Image();
    image.onload = () => {
      if (generation !== this.spriteAnimationGeneration) return;
      let frame = 0;
      let previous = performance.now();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const draw = (time: number) => {
        if (generation !== this.spriteAnimationGeneration) return;
        if (time - previous >= 120 && !reducedMotion) { frame = (frame + 1) % animation.frameCount; previous = time; }
        context.clearRect(0, 0, animation.frameWidth, animation.frameHeight);
        context.drawImage(image, frame * animation.frameWidth, 0, animation.frameWidth, animation.frameHeight,
          0, 0, animation.frameWidth, animation.frameHeight);
        if (animation.frameCount > 1 && !reducedMotion) this.spriteAnimationFrame = requestAnimationFrame(draw);
      };
      draw(previous);
    };
    image.src = model.spriteUrl;
  }
}
