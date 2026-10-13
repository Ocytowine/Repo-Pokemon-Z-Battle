import { describe, expect, it } from "vitest";
import { parseSourceRegionMap, sourceRegionForMap, sourceSpeciesHabitatCoordinates }
  from "../src/source-region-map.js";

const regions = { regions: [{ id: 0, name: "Kalos", filename: "mapRegion0.png", points: [
  { x: 18, y: 13, name: "Pueblo Vinilo", description: "", destination: { mapId: 9, x: 24, y: 31 }, hiddenSwitchId: null },
] }] };
const metadata = { records: [
  { mapId: 9, mapPosition: { region: 0, x: 18, y: 13 } },
  { mapId: 14, mapPosition: { region: 0, x: 19, y: 13 } },
] };
const encounters = { records: [
  { mapId: 14, methods: [{ method: "Land", slots: [{ species: "FENNEKIN" }, { species: "FENNEKIN" }] }] },
  { mapId: 10, methods: [{ method: "Cave", slots: [{ species: "ZUBAT" }] }] },
] };
const mapInfos = { records: [
  { id: 9, parentId: 0 }, { id: 10, parentId: 9 }, { id: 14, parentId: 0 },
] };

describe("source regional map", () => {
  it("inherits a regional position for interiors from the RPG Maker hierarchy", () => {
    const catalog = parseSourceRegionMap(regions, metadata, encounters, mapInfos);
    expect(catalog.mapPositions.get(10)).toEqual({ region: 0, x: 18, y: 13 });
    expect(sourceRegionForMap(catalog, 10)?.name).toBe("Kalos");
  });

  it("deduplicates encounter methods into Pokédex habitat cells", () => {
    const catalog = parseSourceRegionMap(regions, metadata, encounters, mapInfos);
    expect(sourceSpeciesHabitatCoordinates(catalog, "FENNEKIN"))
      .toEqual([{ region: 0, x: 19, y: 13 }]);
    expect(sourceSpeciesHabitatCoordinates(catalog, "ZUBAT"))
      .toEqual([{ region: 0, x: 18, y: 13 }]);
  });
});
