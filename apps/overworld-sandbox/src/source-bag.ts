import type { SourceShopItem } from "./source-economy.js";

export interface SourceBagPocket {
  readonly id: number;
  readonly name: string;
}

export interface SourceBagEntry {
  readonly item: SourceShopItem;
  readonly quantity: number;
}

export interface SourceBagSubfamily {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export type SourceBagNode =
  | { readonly kind: "item"; readonly entry: SourceBagEntry }
  | { readonly kind: "family"; readonly family: SourceBagSubfamily; readonly entries: readonly SourceBagEntry[];
    readonly typeCount: number; readonly totalQuantity: number };

export const SOURCE_BAG_SUBFAMILY_THRESHOLD = 8;
export const SOURCE_BAG_PAGE_SIZE = 9;
export const SOURCE_BATTLE_BAG_PAGE_SIZE = 4;

export const SOURCE_BAG_POCKETS: readonly SourceBagPocket[] = [
  { id: 1, name: "Objets" },
  { id: 2, name: "Médicaments" },
  { id: 3, name: "Poké Balls" },
  { id: 4, name: "CT et CS" },
  { id: 5, name: "Ingrédients" },
  { id: 6, name: "Méga-Gemmes" },
  { id: 7, name: "Objets de combat" },
  { id: 8, name: "Objets rares" },
] as const;

const unavailableSourceItemIcons = new Set<number>();
let availableSourceItemIcons: ReadonlySet<number> | null = null;

export function configureSourceItemIconAvailability(itemIds: ReadonlySet<number>): void {
  availableSourceItemIcons = new Set(itemIds);
}

export function sourceItemIconUrl(itemId: number): string {
  const safeId = Number.isSafeInteger(itemId) && itemId >= 0 ? itemId : 0;
  const resolvedId = unavailableSourceItemIcons.has(safeId)
    || availableSourceItemIcons !== null && !availableSourceItemIcons.has(safeId) ? 0 : safeId;
  return `/__pokemon-z/source/Graphics/Icons/item${String(resolvedId).padStart(3, "0")}.png`;
}

/** Remembers source gaps so rerendering the Bag does not request the same missing bitmap repeatedly. */
export function sourceItemIconFallbackUrl(failedUrl: string): string {
  const match = /\/item(\d+)\.png(?:[?#].*)?$/iu.exec(failedUrl);
  if (match?.[1] !== undefined) unavailableSourceItemIcons.add(Number(match[1]));
  return sourceItemIconUrl(0);
}

export function sourcePocketIconUrl(pocket: number): string {
  const safePocket = Number.isSafeInteger(pocket) ? Math.max(1, Math.min(8, pocket)) : 1;
  return `/__pokemon-z/source/Graphics/Icons/bagPocket${safePocket}.png`;
}

export function sourceBagEntries(inventory: Readonly<Record<string, number>>,
  catalog: ReadonlyMap<string, SourceShopItem>, pocket: number): readonly SourceBagEntry[] {
  return Object.entries(inventory).flatMap(([internalName, quantity]) => {
    const item = catalog.get(internalName);
    return item !== undefined && item.pocket === pocket && Number.isSafeInteger(quantity) && quantity > 0
      ? [{ item, quantity }] : [];
  }).sort((left, right) => left.item.id - right.item.id);
}

export function sourceBagPocketCounts(inventory: Readonly<Record<string, number>>,
  catalog: ReadonlyMap<string, SourceShopItem>): ReadonlyMap<number, number> {
  const counts = new Map<number, number>();
  for (const [internalName, quantity] of Object.entries(inventory)) {
    const item = catalog.get(internalName);
    if (item === undefined || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
    counts.set(item.pocket, (counts.get(item.pocket) ?? 0) + 1);
  }
  return counts;
}

const MEDICINE_HP = new Set(["POTION", "SUPERPOTION", "HYPERPOTION", "MAXPOTION", "FULLRESTORE",
  "BERRYJUICE", "RAGECANDYBAR", "SWEETHEART", "FRESHWATER", "SODAPOP", "LEMONADE", "MOOMOOMILK",
  "ENERGYPOWDER", "ENERGYROOT", "RAMENPICANTE", "RAMENPICANTE1", "RAMENPICANTE2", "RAMENPICANTE3",
  "VENDAJE"]);
const MEDICINE_STATUS = new Set(["AWAKENING", "ANTIDOTE", "BURNHEAL", "PARLYZHEAL", "ICEHEAL",
  "FULLHEAL", "LAVACOOKIE", "CREPE", "CASTELIACONE", "HEALPOWDER"]);
const MEDICINE_REVIVE = new Set(["REVIVE", "MAXREVIVE", "REVIVALHERB", "SACREDASH", "Cenizas"]);
const MEDICINE_PP = new Set(["ETHER", "MAXETHER", "ELIXIR", "MAXELIXIR", "PPUP", "PPMAX"]);
const MEDICINE_TRAINING = new Set(["HPUP", "PROTEIN", "IRON", "CALCIUM", "ZINC", "CARBOS",
  "HEALTHWING", "MUSCLEWING", "RESISTWING", "GENIUSWING", "CLEVERWING", "SWIFTWING", "SCapsula",
  "ACapsula", "DCapsula", "AECapsula", "DECapsula", "VCapsula", "CHAPADORADA", "SUPERHPUP",
  "SUPERPROTEIN", "SUPERIRON", "SUPERCALCIUM", "SUPERZINC", "SUPERCARBOS", "POKESENCIA",
  "POKESENCIAREFINADA"]);
const CLASSIC_BALLS = new Set(["POKEBALL", "GREATBALL", "ULTRABALL", "PREMIERBALL"]);
const APRICORN_BALLS = new Set(["FASTBALL", "LEVELBALL", "LUREBALL", "HEAVYBALL", "LOVEBALL",
  "FRIENDBALL", "MOONBALL"]);
const ESCAPE_BATTLE_ITEMS = new Set(["POKEDOLL", "FLUFFYTAIL", "POKETOY"]);
const EVOLUTION_STONES = new Set(["FIRESTONE", "THUNDERSTONE", "WATERSTONE", "LEAFSTONE", "MOONSTONE",
  "SUNSTONE", "DUSKSTONE", "DAWNSTONE", "SHINYSTONE"]);

const FAMILY = {
  berries: { id: "berries", name: "Sac de Baies", description: "Toutes les variétés de Baies possédées." },
  mints: { id: "mints", name: "Boîte de Menthes", description: "Menthes qui modifient la nature." },
  ingredients: { id: "ingredients", name: "Matériaux", description: "Composants de fabrication et ingrédients." },
  hp: { id: "medicine-hp", name: "Soins des PV", description: "Potions, boissons et autres soins des PV." },
  status: { id: "medicine-status", name: "Soins de statut", description: "Remèdes contre les altérations de statut." },
  revive: { id: "medicine-revive", name: "Rappels", description: "Objets permettant de ranimer un Pokémon." },
  pp: { id: "medicine-pp", name: "Soins des PP", description: "Objets qui restaurent ou augmentent les PP." },
  training: { id: "medicine-training", name: "Entraînement", description: "Vitamines, Plumes, Capsules et Essences." },
  specialBalls: { id: "balls-special", name: "Balls spécialisées", description: "Balls adaptées à des conditions particulières." },
  apricornBalls: { id: "balls-apricorn", name: "Balls artisanales", description: "Balls traditionnellement fabriquées avec des Noigrumes." },
  homemadeBalls: { id: "balls-homemade", name: "Balls faites maison", description: "Balls fabriquées localement." },
  battleBoosts: { id: "battle-boosts", name: "Boosts de combat", description: "Objets X et effets tactiques temporaires." },
  battleEscape: { id: "battle-escape", name: "Objets de fuite", description: "Objets permettant de quitter un combat sauvage." },
  evolution: { id: "evolution-items", name: "Pierres d'évolution", description: "Pierres provoquant certaines évolutions." },
  apricorns: { id: "apricorns", name: "Noigrumes", description: "Fruits utilisés pour fabriquer des Balls." },
  fossils: { id: "fossils", name: "Fossiles", description: "Restes de Pokémon anciens." },
  treasures: { id: "treasures", name: "Trésors", description: "Objets rares et matériaux de valeur." },
  heldBattle: { id: "held-battle", name: "Équipement de combat", description: "Objets tenus aux effets tactiques variés." },
  incense: { id: "held-incense", name: "Encens", description: "Encens aux effets variés." },
  typeBoosters: { id: "held-types", name: "Renforts de type", description: "Objets renforçant une famille de capacités." },
  plates: { id: "held-plates", name: "Plaques", description: "Plaques associées aux différents types." },
  gems: { id: "held-gems", name: "Gemmes de type", description: "Gemmes consommables renforçant un type." },
  speciesGear: { id: "held-species", name: "Objets spécifiques", description: "Objets liés à certaines espèces de Pokémon." },
  tradeEvolution: { id: "held-evolution", name: "Objets d'évolution", description: "Objets tenus intervenant dans une évolution." },
  amulets: { id: "amulets", name: "Amulettes de rencontre", description: "Amulettes agissant sur les rencontres par type." },
  mega: { id: "mega-stones", name: "Méga-Gemmes", description: "Gemmes liées aux Méga-Évolutions." },
  mail: { id: "mail", name: "Courrier", description: "Lettres pouvant être confiées à un Pokémon." },
  keyTools: { id: "key-tools", name: "Outils d'aventure", description: "Outils réutilisables pendant l'exploration." },
  keyKeys: { id: "key-keys", name: "Clés et accès", description: "Clés, cartes et laissez-passer importants." },
} as const satisfies Readonly<Record<string, SourceBagSubfamily>>;

/** Semantic classification shared by the field Bag and every battle Bag adapter. */
export function sourceBagSubfamily(item: SourceShopItem): SourceBagSubfamily | null {
  const id = item.internalName;
  if (item.pocket === 2) {
    if (MEDICINE_HP.has(id)) return FAMILY.hp;
    if (MEDICINE_STATUS.has(id)) return FAMILY.status;
    if (MEDICINE_REVIVE.has(id)) return FAMILY.revive;
    if (MEDICINE_PP.has(id)) return FAMILY.pp;
    if (MEDICINE_TRAINING.has(id)) return FAMILY.training;
    return null;
  }
  if (item.pocket === 3) {
    if (/CASERA$/u.test(id)) return FAMILY.homemadeBalls;
    if (APRICORN_BALLS.has(id)) return FAMILY.apricornBalls;
    if (!CLASSIC_BALLS.has(id) && id !== "MASTERBALL") return FAMILY.specialBalls;
    return null;
  }
  // The source game treats CT/CS as a catalogue. Keep this pocket flat: a dedicated filter will replace folders later.
  if (item.pocket === 4) return null;
  if (item.pocket === 5) {
    if (item.itemType === 5 || /BERRY$/u.test(id)) return FAMILY.berries;
    if (/MINT$/u.test(id)) return FAMILY.mints;
    if (item.id >= 732) return FAMILY.ingredients;
    return null;
  }
  if (item.pocket === 6) return item.itemType === 2 || /MAIL$/u.test(id) ? FAMILY.mail : FAMILY.mega;
  if (item.pocket === 7) {
    if (/^X(?:ATTACK|DEFEND|SPECIAL|SPDEF|SPEED|ACCURACY)\d*$/u.test(id) || /^DIREHIT\d*$/u.test(id)
      || ["GUARDSPEC", "RESETURGE", "ABILITYURGE", "ITEMURGE", "ITEMDROP"].includes(id)) return FAMILY.battleBoosts;
    if (ESCAPE_BATTLE_ITEMS.has(id)) return FAMILY.battleEscape;
    return null;
  }
  if (item.pocket === 1) {
    if (EVOLUTION_STONES.has(id) || /STONEIMBUIDA$/u.test(id)) return FAMILY.evolution;
    if (/APRICORN$/u.test(id)) return FAMILY.apricorns;
    if (/FOSSIL$/u.test(id) || id === "OLDAMBER") return FAMILY.fossils;
    if (item.id >= 38 && item.id <= 64) return FAMILY.treasures;
    if (item.id >= 66 && item.id <= 126 || [541, 721, 730, 766, 811, 812, 813, 814, 834, 835, 844, 863,
      875, 876, 877, 888, 889, 890, 946, 947].includes(item.id)) return FAMILY.heldBattle;
    if (item.id >= 127 && item.id <= 135) return FAMILY.incense;
    if (item.id >= 136 && item.id <= 152) return FAMILY.typeBoosters;
    if (item.id >= 153 && item.id <= 168 || item.id === 718 || item.id === 719) return FAMILY.plates;
    if (item.id >= 169 && item.id <= 185) return FAMILY.gems;
    if (item.id >= 186 && item.id <= 201) return FAMILY.speciesGear;
    if (item.id >= 202 && item.id <= 211) return FAMILY.tradeEvolution;
    if (item.id >= 776 && item.id <= 793) return FAMILY.amulets;
    return null;
  }
  if (item.pocket === 8) {
    if (item.fieldUse === 2 || /^(?:BICYCLE\d*|SURFMONTURA|POKERIDER|OLDROD|GOODROD|SUPERROD)$/u.test(id)) return FAMILY.keyTools;
    if (/LLAVE|KEY|TICKET|PASE|TMAGN/u.test(id)) return FAMILY.keyKeys;
  }
  return null;
}

/** Collapses only families that have enough distinct owned items to reduce clutter. */
export function sourceBagNodes(entries: readonly SourceBagEntry[], threshold = SOURCE_BAG_SUBFAMILY_THRESHOLD): readonly SourceBagNode[] {
  const safeThreshold = Number.isSafeInteger(threshold) && threshold > 1 ? threshold : SOURCE_BAG_SUBFAMILY_THRESHOLD;
  const grouped = new Map<string, { family: SourceBagSubfamily; entries: SourceBagEntry[] }>();
  for (const entry of entries) {
    const family = sourceBagSubfamily(entry.item);
    if (family === null) continue;
    const group = grouped.get(family.id) ?? { family, entries: [] };
    group.entries.push(entry);
    grouped.set(family.id, group);
  }
  const collapsed = new Set([...grouped].filter(([, group]) => group.entries.length >= safeThreshold)
    .map(([familyId]) => familyId));
  const emitted = new Set<string>();
  return entries.flatMap((entry): SourceBagNode[] => {
    const family = sourceBagSubfamily(entry.item);
    if (family === null || !collapsed.has(family.id)) return [{ kind: "item", entry }];
    if (emitted.has(family.id)) return [];
    emitted.add(family.id);
    const familyEntries = grouped.get(family.id)!.entries;
    return [{ kind: "family", family, entries: familyEntries, typeCount: familyEntries.length,
      totalQuantity: familyEntries.reduce((total, candidate) => total + candidate.quantity, 0) }];
  });
}

export function sourceBagFamilyEntries(entries: readonly SourceBagEntry[], familyId: string): readonly SourceBagEntry[] {
  return entries.filter((entry) => sourceBagSubfamily(entry.item)?.id === familyId);
}

export function sourceBagPage<T>(values: readonly T[], requestedPage: number, pageSize: number): {
  readonly entries: readonly T[]; readonly page: number; readonly pageCount: number } {
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : SOURCE_BAG_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(values.length / size));
  const page = Math.max(0, Math.min(pageCount - 1, Number.isSafeInteger(requestedPage) ? requestedPage : 0));
  return { entries: values.slice(page * size, (page + 1) * size), page, pageCount };
}

/** Explicit test-only mutation. The caller remains responsible for persisting its own personal save. */
export function grantSourceTestItems(inventory: Readonly<Record<string, number>>,
  catalog: ReadonlyMap<string, SourceShopItem>, quantity = 99,
  selection: { readonly pocket?: number; readonly itemId?: string; readonly mode?: "set" | "add" } = {}): Readonly<Record<string, number>> {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) throw new Error("Quantité de test invalide.");
  const next = { ...inventory };
  for (const [internalName, item] of catalog) {
    if (selection.pocket !== undefined && item.pocket !== selection.pocket) continue;
    if (selection.itemId !== undefined && internalName !== selection.itemId) continue;
    next[internalName] = selection.mode === "add" ? Math.min(999, (next[internalName] ?? 0) + quantity) : quantity;
  }
  return next;
}

/** Removes only the selected source pocket from the personal save. */
export function resetSourceTestItemPocket(inventory: Readonly<Record<string, number>>,
  catalog: ReadonlyMap<string, SourceShopItem>, pocket: number): Readonly<Record<string, number>> {
  if (!Number.isSafeInteger(pocket) || !SOURCE_BAG_POCKETS.some((candidate) => candidate.id === pocket)) {
    throw new Error("Catégorie de Sac invalide.");
  }
  const next = { ...inventory };
  for (const [internalName, item] of catalog) if (item.pocket === pocket) delete next[internalName];
  return next;
}
