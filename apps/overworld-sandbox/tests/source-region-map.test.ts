import { describe, expect, it } from "vitest";
import { parseSourceRegionMap, sourceRegionForMap, sourceSpeciesHabitatCoordinates,
  sourceSpeciesHabitatLocations }
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
  { id: 9, parentId: 0, name: "Bourg Canvas" },
  { id: 10, parentId: 9, name: "Centre Pokémon" },
  { id: 14, parentId: 0, name: "Route 2" },
] };
const localization = { categories: {
  regionNames: [{ key: "0", value: "Kalos" }],
  placeNames: [{ key: "Pueblo Vinilo", value: "Bordevin" }],
  placeDescriptions: [{ key: "Chateau Merlot", value: "Manoir Merlot" }],
} };

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

  it("exposes the source location names used by the Pokedex habitat list", () => {
    const catalog = parseSourceRegionMap(regions, metadata, encounters, mapInfos);
    expect(sourceSpeciesHabitatLocations(catalog, "FENNEKIN"))
      .toEqual([{ mapId: 14, name: "Route 2", coordinate: { region: 0, x: 19, y: 13 } }]);
    expect(sourceSpeciesHabitatLocations(catalog, "ZUBAT"))
      .toEqual([{ mapId: 10, name: "Centre Pokémon · Bourg Canvas",
        coordinate: { region: 0, x: 18, y: 13 } }]);
  });

  it("uses the French localization catalog for regional names and descriptions", () => {
    const withDescription = { regions: [{ ...regions.regions[0]!, points: [
      { ...regions.regions[0]!.points[0]!, description: "Chateau Merlot" },
    ] }] };
    const catalog = parseSourceRegionMap(withDescription, metadata, encounters, mapInfos, localization);
    expect(catalog.regions[0]).toMatchObject({ name: "Kalos", points: [
      { name: "Bordevin", description: "Manoir Merlot" },
    ] });
  });

  it("keeps source text when a French regional translation is absent", () => {
    const catalog = parseSourceRegionMap(regions, metadata, encounters, mapInfos, { categories: {} });
    expect(catalog.regions[0]?.points[0]).toMatchObject({ name: "Pueblo Vinilo", description: "" });
  });
});
