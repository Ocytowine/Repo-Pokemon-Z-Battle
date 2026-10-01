import { describe, expect, it } from "vitest";
import { sourceCharacterAssetName, sourcePlayerImageFor, type SourcePlayerVisuals } from "../src/source-player-profile.js";

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
});
