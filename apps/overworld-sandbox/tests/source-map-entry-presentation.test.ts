import { describe, expect, it } from "vitest";
import { sourceAreaBannerVariant, sourceShouldShowArea, sourceTransferUsesFade }
  from "../src/source-map-entry-presentation.js";

describe("source map entry presentation", () => {
  it("uses the fade flag from the original transfer command", () => {
    expect(sourceTransferUsesFade(0)).toBe(true);
    expect(sourceTransferUsesFade(1)).toBe(false);
    expect(sourceTransferUsesFade(undefined)).toBe(false);
  });

  it("shows the location sign only on eligible entries with a changed name", () => {
    expect(sourceShouldShowArea("Route 3", "Bois-en-Tronc", true, true)).toBe(true);
    expect(sourceShouldShowArea("Route 3", "Route 3", true, true)).toBe(false);
    expect(sourceShouldShowArea("Route 3", "Bois-en-Tronc", false, true)).toBe(false);
    expect(sourceShouldShowArea("Route 3", "Bois-en-Tronc", true, false)).toBe(false);
  });

  it("selects the source LetsGO banner variants for French map names", () => {
    expect(sourceAreaBannerVariant("Bourg Canvas")).toBe(0);
    expect(sourceAreaBannerVariant("Route 5")).toBe(1);
    expect(sourceAreaBannerVariant("Montagne du Nord")).toBe(2);
    expect(sourceAreaBannerVariant("Grotte des Îles")).toBe(3);
  });
});
