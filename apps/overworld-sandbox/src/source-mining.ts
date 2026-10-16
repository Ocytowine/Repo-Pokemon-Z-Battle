export const SOURCE_MINING_WIDTH = 13;
export const SOURCE_MINING_HEIGHT = 10;
export const SOURCE_MINING_COLLAPSE_AT = 49;

export type SourceMiningTool = "pick" | "hammer";
export type SourceMiningStatus = "active" | "collapsed" | "cleared" | "quit";

export interface SourceMiningShape {
  readonly itemId?: string;
  readonly weight?: number;
  readonly spriteX: number;
  readonly spriteY: number;
  readonly width: number;
  readonly height: number;
  readonly pattern: readonly number[];
}

export interface SourceMiningPlacement {
  readonly shape: SourceMiningShape;
  readonly x: number;
  readonly y: number;
  readonly revealed: boolean;
}

export interface SourceMiningState {
  readonly layers: readonly number[];
  readonly treasures: readonly SourceMiningPlacement[];
  readonly iron: readonly SourceMiningPlacement[];
  readonly cursor: number;
  readonly tool: SourceMiningTool;
  readonly cracks: number;
  readonly wonItems: readonly string[];
  readonly status: SourceMiningStatus;
}

export interface SourceMiningHitResult {
  readonly state: SourceMiningState;
  readonly hit: "rock" | "treasure" | "iron";
  readonly revealedItems: readonly string[];
}

const shape = (itemId: string, weight: number, spriteX: number, spriteY: number,
  width: number, height: number, pattern: string): SourceMiningShape => ({
  itemId, weight, spriteX, spriteY, width, height, pattern: [...pattern].map(Number),
});
const obstacle = (spriteX: number, spriteY: number, width: number, height: number,
  pattern: string): SourceMiningShape => ({ spriteX, spriteY, width, height, pattern: [...pattern].map(Number) });

/** Exact treasure table from Pokemon Z/Essentials. Visual variants remain independently weighted. */
export const SOURCE_MINING_TREASURES: readonly SourceMiningShape[] = Object.freeze([
  shape("DOMEFOSSIL", 20, 0, 3, 5, 4, "11111111111111101110"),
  shape("HELIXFOSSIL", 5, 5, 3, 4, 4, "0111111111111110"),
  shape("HELIXFOSSIL", 5, 9, 3, 4, 4, "1110111111110111"),
  shape("HELIXFOSSIL", 5, 13, 3, 4, 4, "0111111111111110"),
  shape("HELIXFOSSIL", 5, 17, 3, 4, 4, "1110111111110111"),
  shape("OLDAMBER", 10, 21, 3, 4, 4, "0111111111111110"),
  shape("OLDAMBER", 10, 25, 3, 4, 4, "1110111111110111"),
  shape("ROOTFOSSIL", 5, 0, 7, 5, 5, "1111011111110110001100110"),
  shape("ROOTFOSSIL", 5, 5, 7, 5, 5, "0011100111100111111101110"),
  shape("ROOTFOSSIL", 5, 10, 7, 5, 5, "0110011000110111111101111"),
  shape("ROOTFOSSIL", 5, 15, 7, 5, 5, "0111011111110011110011100"),
  shape("SKULLFOSSIL", 20, 20, 7, 4, 4, "1111111111110110"),
  shape("ARMORFOSSIL", 20, 24, 7, 5, 4, "01110011101111101110"),
  shape("CLAWFOSSIL", 5, 0, 12, 4, 5, "00110111011111101100"),
  shape("CLAWFOSSIL", 5, 4, 12, 5, 4, "11000111100111100111"),
  shape("CLAWFOSSIL", 5, 9, 12, 4, 5, "00110111110111101100"),
  shape("CLAWFOSSIL", 5, 13, 12, 5, 4, "11100111100111100011"),
  shape("FIRESTONE", 20, 20, 11, 3, 3, "111111111"),
  shape("WATERSTONE", 20, 23, 11, 3, 3, "111111110"),
  shape("THUNDERSTONE", 20, 26, 11, 3, 3, "011111110"),
  shape("LEAFSTONE", 10, 18, 14, 3, 4, "010111111010"),
  shape("LEAFSTONE", 10, 21, 14, 4, 3, "011011110110"),
  shape("MOONSTONE", 10, 25, 14, 4, 2, "01111110"),
  shape("MOONSTONE", 10, 27, 16, 2, 4, "10111101"),
  shape("SUNSTONE", 20, 21, 17, 3, 3, "010111111"),
  shape("OVALSTONE", 150, 24, 17, 3, 3, "111111111"),
  shape("EVERSTONE", 150, 21, 20, 4, 2, "11111111"),
  shape("STARPIECE", 100, 0, 17, 3, 3, "010111010"),
  shape("REVIVE", 100, 0, 20, 3, 3, "010111010"),
  shape("MAXREVIVE", 50, 0, 23, 3, 3, "111111111"),
  shape("RAREBONE", 50, 3, 17, 6, 3, "100001111111100001"),
  shape("RAREBONE", 50, 3, 20, 3, 6, "111010010010010111"),
  shape("LIGHTCLAY", 100, 6, 20, 4, 4, "1010111011110101"),
  shape("HARDSTONE", 200, 6, 24, 2, 2, "1111"),
  shape("HEARTSCALE", 200, 8, 24, 2, 2, "1011"),
  shape("IRONBALL", 100, 9, 17, 3, 3, "111111111"),
  shape("ODDKEYSTONE", 100, 10, 20, 4, 4, "1111111111111111"),
  shape("HEATROCK", 50, 12, 17, 4, 3, "101011111111"),
  shape("DAMPROCK", 50, 14, 20, 3, 3, "111111101"),
  shape("SMOOTHROCK", 50, 17, 18, 4, 4, "0010111001110100"),
  shape("ICYROCK", 50, 17, 22, 4, 4, "0110111111111001"),
  shape("REDSHARD", 100, 21, 22, 3, 3, "111110111"),
  shape("GREENSHARD", 100, 25, 20, 4, 3, "111111111101"),
  shape("YELLOWSHARD", 100, 25, 23, 4, 3, "101011101111"),
  shape("BLUESHARD", 100, 26, 26, 3, 3, "111111110"),
  ...[0, 4, 8, 12].map((x) => shape("DAWNSTONE", 10, x, 26, 4, 3, "111111111111")),
  ...[[16, 26], [20, 26], [0, 29], [4, 29]].map(([x, y]) => shape("DUSKSTONE", 10, x!, y!, 4, 3, "111111111111")),
  ...[8, 12, 16, 20].map((x) => shape("SHINYSTONE", 10, x, 29, 4, 3, "111111111111")),
  ...[0, 4, 8, 12].map((x) => shape("NUGGET", 10, x, 32, 4, 3, "111111111111")),
]);

export const SOURCE_MINING_IRON: readonly SourceMiningShape[] = Object.freeze([
  obstacle(0, 0, 1, 4, "1111"), obstacle(1, 0, 2, 4, "11111111"),
  obstacle(3, 0, 4, 2, "11111111"), obstacle(3, 2, 4, 1, "1111"),
  obstacle(7, 0, 3, 3, "111111111"), obstacle(0, 5, 3, 2, "110011"),
  obstacle(0, 7, 3, 2, "010111"), obstacle(3, 5, 3, 2, "011110"),
  obstacle(3, 7, 3, 2, "111010"), obstacle(6, 3, 2, 3, "101101"),
  obstacle(8, 3, 2, 3, "011110"), obstacle(6, 6, 2, 3, "101110"),
  obstacle(8, 6, 2, 3, "011101"),
]);

function randomIndex(random: () => number, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

function cells(shapeValue: SourceMiningShape, x: number, y: number): readonly number[] {
  return shapeValue.pattern.flatMap((filled, index) => filled === 0 ? [] : [
    x + index % shapeValue.width + (y + Math.floor(index / shapeValue.width)) * SOURCE_MINING_WIDTH,
  ]);
}

function overlaps(placements: readonly SourceMiningPlacement[], candidate: SourceMiningShape,
  x: number, y: number): boolean {
  const occupied = new Set(placements.flatMap((placement) => cells(placement.shape, placement.x, placement.y)));
  return cells(candidate, x, y).some((cell) => occupied.has(cell));
}

function fossil(itemId: string): boolean {
  return ["DOMEFOSSIL", "HELIXFOSSIL", "OLDAMBER", "ROOTFOSSIL", "SKULLFOSSIL", "ARMORFOSSIL", "CLAWFOSSIL"]
    .includes(itemId);
}

function allowedTreasure(existing: readonly SourceMiningPlacement[], itemId: string): boolean {
  if (itemId === "HEARTSCALE") return true;
  return !existing.some((placement) => placement.shape.itemId === itemId
    || fossil(itemId) && fossil(placement.shape.itemId ?? ""));
}

function placeShape(random: () => number, shapeValue: SourceMiningShape,
  occupied: readonly SourceMiningPlacement[]): SourceMiningPlacement | null {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const x = randomIndex(random, SOURCE_MINING_WIDTH - shapeValue.width + 1);
    const y = randomIndex(random, SOURCE_MINING_HEIGHT - shapeValue.height + 1);
    if (!overlaps(occupied, shapeValue, x, y)) return { shape: shapeValue, x, y, revealed: false };
  }
  return null;
}

function weightedTreasure(random: () => number): SourceMiningShape {
  const total = SOURCE_MINING_TREASURES.reduce((sum, entry) => sum + (entry.weight ?? 0), 0);
  let roll = random() * total;
  for (const entry of SOURCE_MINING_TREASURES) {
    roll -= entry.weight ?? 0;
    if (roll < 0) return entry;
  }
  return SOURCE_MINING_TREASURES.at(-1)!;
}

export function createSourceMiningGame(random: () => number = Math.random): SourceMiningState {
  const treasures: SourceMiningPlacement[] = [];
  const treasureCount = 2 + randomIndex(random, 3);
  for (let attempts = 0; treasures.length < treasureCount && attempts < 2_000; attempts += 1) {
    const candidate = weightedTreasure(random);
    if (!allowedTreasure(treasures, candidate.itemId!)) continue;
    const placement = placeShape(random, candidate, treasures);
    if (placement !== null) treasures.push(placement);
  }
  if (treasures.length !== treasureCount) throw new Error("Impossible de répartir les trésors de fouille.");
  const iron: SourceMiningPlacement[] = [];
  const ironCount = 4 + randomIndex(random, 3);
  for (let attempts = 0; iron.length < ironCount && attempts < 2_000; attempts += 1) {
    const candidate = SOURCE_MINING_IRON[randomIndex(random, SOURCE_MINING_IRON.length)]!;
    const placement = placeShape(random, candidate, [...treasures, ...iron]);
    if (placement !== null) iron.push(placement);
  }
  if (iron.length !== ironCount) throw new Error("Impossible de répartir les obstacles de fouille.");
  return { layers: Array.from({ length: SOURCE_MINING_WIDTH * SOURCE_MINING_HEIGHT },
    () => 2 + randomIndex(random, 5)), treasures, iron, cursor: 58, tool: "pick", cracks: 0,
    wonItems: [], status: "active" };
}

function contains(placement: SourceMiningPlacement, position: number): boolean {
  return cells(placement.shape, placement.x, placement.y).includes(position);
}

function fullyRevealed(placement: SourceMiningPlacement, layers: readonly number[]): boolean {
  return cells(placement.shape, placement.x, placement.y).every((position) => layers[position] === 0);
}

export function moveSourceMiningCursor(state: SourceMiningState, dx: number, dy: number): SourceMiningState {
  if (state.status !== "active") return state;
  const x = state.cursor % SOURCE_MINING_WIDTH;
  const y = Math.floor(state.cursor / SOURCE_MINING_WIDTH);
  const nextX = Math.max(0, Math.min(SOURCE_MINING_WIDTH - 1, x + dx));
  const nextY = Math.max(0, Math.min(SOURCE_MINING_HEIGHT - 1, y + dy));
  return { ...state, cursor: nextX + nextY * SOURCE_MINING_WIDTH };
}

export function selectSourceMiningCell(state: SourceMiningState, position: number): SourceMiningState {
  if (state.status !== "active" || !Number.isInteger(position) || position < 0
    || position >= SOURCE_MINING_WIDTH * SOURCE_MINING_HEIGHT) return state;
  return { ...state, cursor: position };
}

export function toggleSourceMiningTool(state: SourceMiningState): SourceMiningState {
  return state.status === "active" ? { ...state, tool: state.tool === "pick" ? "hammer" : "pick" } : state;
}

export function hitSourceMiningWall(state: SourceMiningState): SourceMiningHitResult {
  if (state.status !== "active") return { state, hit: "rock", revealedItems: [] };
  const layers = [...state.layers];
  const pattern = state.tool === "hammer" ? [1, 2, 1, 2, 2, 2, 1, 2, 1] : [0, 1, 0, 1, 2, 1, 0, 1, 0];
  const centerDamage = pattern[4]!;
  const centerIron = state.iron.some((placement) => contains(placement, state.cursor));
  let hit: SourceMiningHitResult["hit"] = "rock";
  if (layers[state.cursor]! <= centerDamage && centerIron) {
    layers[state.cursor] = Math.max(0, layers[state.cursor]! - centerDamage);
    hit = "iron";
  } else {
    const centerX = state.cursor % SOURCE_MINING_WIDTH;
    const centerY = Math.floor(state.cursor / SOURCE_MINING_WIDTH);
    for (let py = 0; py < 3; py += 1) for (let px = 0; px < 3; px += 1) {
      const x = centerX + px - 1;
      const y = centerY + py - 1;
      if (x < 0 || x >= SOURCE_MINING_WIDTH || y < 0 || y >= SOURCE_MINING_HEIGHT) continue;
      const position = x + y * SOURCE_MINING_WIDTH;
      layers[position] = Math.max(0, layers[position]! - pattern[px + py * 3]!);
    }
    if (layers[state.cursor] === 0 && state.treasures.some((placement) => contains(placement, state.cursor))) {
      hit = "treasure";
    }
  }
  const revealedItems: string[] = [];
  const treasures = state.treasures.map((placement) => {
    if (placement.revealed || !fullyRevealed(placement, layers)) return placement;
    revealedItems.push(placement.shape.itemId!);
    return { ...placement, revealed: true };
  });
  const cracks = state.cracks + (state.tool === "hammer" ? 2 : 1);
  const allFound = treasures.every((placement) => placement.revealed);
  const status: SourceMiningStatus = cracks >= SOURCE_MINING_COLLAPSE_AT ? "collapsed"
    : allFound ? "cleared" : "active";
  return { state: { ...state, layers, treasures, cracks,
    wonItems: [...state.wonItems, ...revealedItems], status }, hit, revealedItems };
}

export function quitSourceMiningGame(state: SourceMiningState): SourceMiningState {
  return state.status === "active" ? { ...state, status: "quit" } : state;
}
