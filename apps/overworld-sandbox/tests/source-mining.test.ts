import { describe, expect, it } from "vitest";
import { createSourceMiningGame, hitSourceMiningWall, SOURCE_MINING_COLLAPSE_AT,
  SOURCE_MINING_HEIGHT, SOURCE_MINING_TREASURES, SOURCE_MINING_WIDTH,
  type SourceMiningShape, type SourceMiningState } from "../src/source-mining.js";
import { isKnownSourceCommand } from "../src/source-command-registry.js";
import { portSourceRubyCommand } from "../src/source-script-ports.js";

function seeded(seed = 0x1234_5678): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function occupied(shape: SourceMiningShape, x: number, y: number): number[] {
  return shape.pattern.flatMap((filled, index) => filled === 0 ? [] : [
    x + index % shape.width + (y + Math.floor(index / shape.width)) * SOURCE_MINING_WIDTH,
  ]);
}

function state(overrides: Partial<SourceMiningState> = {}): SourceMiningState {
  return { layers: Array(SOURCE_MINING_WIDTH * SOURCE_MINING_HEIGHT).fill(6), treasures: [], iron: [],
    cursor: 58, tool: "pick", cracks: 0, wonItems: [], status: "active", ...overrides };
}

describe("source mining", () => {
  it("keeps the complete source sprite table structurally valid", () => {
    expect(SOURCE_MINING_TREASURES).toHaveLength(61);
    for (const entry of SOURCE_MINING_TREASURES) {
      expect(entry.pattern).toHaveLength(entry.width * entry.height);
      expect(entry.pattern.some(Boolean)).toBe(true);
    }
  });

  it("generates 2-4 treasures and 4-6 non-overlapping iron shapes", () => {
    const game = createSourceMiningGame(seeded());
    expect(game.treasures.length).toBeGreaterThanOrEqual(2);
    expect(game.treasures.length).toBeLessThanOrEqual(4);
    expect(game.iron.length).toBeGreaterThanOrEqual(4);
    expect(game.iron.length).toBeLessThanOrEqual(6);
    expect(game.layers.every((layer) => layer >= 2 && layer <= 6)).toBe(true);
    const all = [...game.treasures, ...game.iron];
    all.forEach((placement, index) => {
      const own = new Set(occupied(placement.shape, placement.x, placement.y));
      for (const other of all.slice(index + 1)) {
        expect(occupied(other.shape, other.x, other.y).some((cell) => own.has(cell))).toBe(false);
      }
    });
  });

  it("reveals and awards a treasure only when every occupied cell is uncovered", () => {
    const treasure: SourceMiningShape = { itemId: "HEARTSCALE", weight: 1, spriteX: 0, spriteY: 0,
      width: 1, height: 1, pattern: [1] };
    const layers = Array(SOURCE_MINING_WIDTH * SOURCE_MINING_HEIGHT).fill(6);
    layers[58] = 1;
    const result = hitSourceMiningWall(state({ layers, treasures: [{ shape: treasure, x: 6, y: 4, revealed: false }] }));
    expect(result.revealedItems).toEqual(["HEARTSCALE"]);
    expect(result.state.wonItems).toEqual(["HEARTSCALE"]);
    expect(result.state.status).toBe("cleared");
  });

  it("stops a blow on exposed iron instead of damaging neighbouring tiles", () => {
    const iron: SourceMiningShape = { spriteX: 0, spriteY: 0, width: 1, height: 1, pattern: [1] };
    const layers = Array(SOURCE_MINING_WIDTH * SOURCE_MINING_HEIGHT).fill(6);
    layers[58] = 2;
    const result = hitSourceMiningWall(state({ layers, iron: [{ shape: iron, x: 6, y: 4, revealed: false }] }));
    expect(result.hit).toBe("iron");
    expect(result.state.layers[58]).toBe(0);
    expect(result.state.layers[57]).toBe(6);
    expect(result.state.layers[59]).toBe(6);
  });

  it("collapses at the source threshold before declaring all treasures found", () => {
    const treasure: SourceMiningShape = { itemId: "NUGGET", weight: 1, spriteX: 0, spriteY: 0,
      width: 1, height: 1, pattern: [1] };
    const layers = Array(SOURCE_MINING_WIDTH * SOURCE_MINING_HEIGHT).fill(6);
    layers[0] = 1;
    const result = hitSourceMiningWall(state({ layers, cursor: 0, cracks: SOURCE_MINING_COLLAPSE_AT - 1,
      treasures: [{ shape: treasure, x: 0, y: 0, revealed: false }] }));
    expect(result.revealedItems).toEqual(["NUGGET"]);
    expect(result.state.status).toBe("collapsed");
  });

  it("ports pbMiningGame as an audited personal scene command", () => {
    const command = portSourceRubyCommand({ kind: "ruby-script", text: null, indent: 2,
      data: { source: "pbMiningGame" } });
    expect(command).toMatchObject({ kind: "open-mining", data: { policy: "PERSONAL" } });
    expect(isKnownSourceCommand(command!.kind)).toBe(true);
  });
});
