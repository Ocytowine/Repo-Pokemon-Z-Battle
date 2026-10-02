import { describe, expect, it } from "vitest";
import { parseMapBattleMetadata } from "../src/runtime/extract-map-metadata.js";

describe("map battle metadata", () => {
  it("extracts battle presentation settings by map without interpreting comments", () => {
    expect(parseMapBattleMetadata("[002]\n# Snow map\nBattleBack=Snow\nWildBattleBGM=Salvaje.ogg\nWildVictoryME=VictoriaSalvaje.ogg\nDiveMap=12\nBicycle=false\n[003]\nOutdoor=true\nBicycleAlways=true\n"))
      .toEqual([{ mapId: 2, battleback: "Snow", wildBattleBgm: "Salvaje.ogg", wildVictoryMe: "VictoriaSalvaje.ogg",
        outdoor: null, bicycle: false, bicycleAlways: false, diveMap: 12 },
      { mapId: 3, battleback: null, wildBattleBgm: null, wildVictoryMe: null,
        outdoor: true, bicycle: null, bicycleAlways: true, diveMap: null }]);
  });
});
