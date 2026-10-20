import { describe, expect, it } from "vitest";
import { SOURCE_CHARACTER_GUIDE, sourceCharacterGuideImageUrl, sourceCharacterGuideImageUrls,
  sourceCharacterGuideLevel,
  unlockedSourceCharacterGuideEntries } from "../src/source-character-guide.js";

describe("source character guide", () => {
  it("preserves the source two-stage unlock contract", () => {
    expect(SOURCE_CHARACTER_GUIDE).toHaveLength(30);
    expect(unlockedSourceCharacterGuideEntries({}).map(({ name }) => name)).toEqual(["Olivier"]);
    expect(unlockedSourceCharacterGuideEntries({ "240": 1 })).toHaveLength(30);
  });

  it("sanitizes legacy variable values and exposes source image paths", () => {
    expect(sourceCharacterGuideLevel({ "240": -4 })).toBe(0);
    expect(sourceCharacterGuideLevel({ "240": 1.9 })).toBe(1);
    expect(sourceCharacterGuideImageUrl(SOURCE_CHARACTER_GUIDE[0]!))
      .toBe("/__pokemon-z/source/Graphics/Pictures/infog_olivier.png");
    expect(sourceCharacterGuideImageUrls(SOURCE_CHARACTER_GUIDE[0]!)).toEqual([
      "/__pokemon-z/source/Graphics/Pictures/infog_olivier.png",
      "/__pokemon-z/source/Graphics/Pictures/olivierPres.png",
      "/__pokemon-z/source/Graphics/Pictures/introOlivier0.png",
    ]);
  });
});
