import { describe, expect, it } from "vitest";
import { sourceCharacterAssetName, sourcePlayerImageFor, sourceRunGroundOffsets,
  type SourcePlayerVisuals } from "../src/source-player-profile.js";

describe("applied source player profile", () => {
  it("normalizes source character aliases and resolves narrative poses", () => {
    expect(sourceCharacterAssetName("Graphics/Characters/trchar003_2.png")).toBe("trchar003_2");
    expect(sourceCharacterAssetName("Graphics\\Characters\\girl_run1.png")).toBe("girl_run1");
    const normal = {} as HTMLImageElement; const pickup = {} as HTMLImageElement;
    const visuals = { overworld: normal, bySourceName: new Map([["trchar003_2", pickup]]) } as unknown as SourcePlayerVisuals;
    expect(sourcePlayerImageFor(visuals, "trchar003_2")).toBe(pickup);
    expect(sourcePlayerImageFor(visuals, "trchar005")).toBe(normal);
    expect(sourcePlayerImageFor(visuals, "unrelated_npc")).toBeNull();
  });

  it("aligns running feet per direction and frame despite transparent sprite padding", () => {
    const pixels = (bottomPadding: number) => {
      const data = new Uint8ClampedArray(4 * 4 * 4 * 4);
      for (let row = 0; row < 4; row += 1) for (let pattern = 0; pattern < 4; pattern += 1) {
        const y = row * 4 + 3 - (row === 0 ? bottomPadding + pattern % 2 : 0);
        data[(y * 4 + pattern) * 4 + 3] = 255;
      }
      return { width: 4, height: 16, data };
    };
    expect(sourceRunGroundOffsets(pixels(0), pixels(1))[0]).toEqual([1, 1, 1, 1]);
    expect(sourceRunGroundOffsets(pixels(0), pixels(1))[1]).toEqual([0, 0, 0, 0]);
  });
});
