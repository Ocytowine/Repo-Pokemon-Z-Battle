import { describe, expect, it } from "vitest";
import { sourceItemGainMessage, sourceItemGains, sourceItemPickupOffset } from "../src/source-item-presentation.js";

describe("source item presentation", () => {
  it("describes only newly obtained items with their localized names", () => {
    const gains = sourceItemGains({ POTION: 1 }, { POTION: 3, POKEBALL: 1 },
      new Map([["POTION", "Potion"], ["POKEBALL", "Poké Ball"]]));
    expect(gains).toEqual([
      { itemId: "POTION", name: "Potion", quantity: 2 },
      { itemId: "POKEBALL", name: "Poké Ball", quantity: 1 },
    ]);
    expect(gains.map(sourceItemGainMessage)).toEqual([
      "Objets obtenus : 2 × Potion !",
      "Objet obtenu : Poké Ball !",
    ]);
  });

  it("animates one visible pickup hop then returns to the tile", () => {
    expect(sourceItemPickupOffset(0)).toBeCloseTo(0);
    expect(sourceItemPickupOffset(210)).toBeCloseTo(-8);
    expect(sourceItemPickupOffset(420)).toBeCloseTo(0);
    expect(sourceItemPickupOffset(1_000)).toBeCloseTo(0);
  });
});
