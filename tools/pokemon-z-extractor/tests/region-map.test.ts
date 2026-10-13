import { describe, expect, it } from "vitest";
import { parseRegionMaps } from "../src/runtime/extract-region-map.js";

describe("region map", () => {
  it("extracts labels, fly destinations and optional hidden switches", () => {
    expect(parseRegionMaps(`[0]\nName="Kalos"\nFilename=mapRegion0.png\nPoint=18,17,"Pueblo Lienzo","Laboratorio Flare",3,34,14,\nPoint=19,17,"Ruta 1",,,,,42\n`))
      .toEqual([{ id: 0, name: "Kalos", filename: "mapRegion0.png", points: [
        { x: 18, y: 17, name: "Pueblo Lienzo", description: "Laboratorio Flare",
          destination: { mapId: 3, x: 34, y: 14 }, hiddenSwitchId: null },
        { x: 19, y: 17, name: "Ruta 1", description: "", destination: null, hiddenSwitchId: 42 },
      ] }]);
  });
});
