import { describe, expect, it } from "vitest";
import { parseMapBattleMetadata } from "../src/runtime/extract-map-metadata.js";

describe("map battle metadata", () => {
  it("extracts battle presentation settings by map without interpreting comments", () => {
    expect(parseMapBattleMetadata("[002]\n# Snow map\nBattleBack=Snow\nWildBattleBGM=Salvaje.ogg\nWildVictoryME=VictoriaSalvaje.ogg\n[003]\nOutdoor=true\n"))
      .toEqual([{ mapId: 2, battleback: "Snow", wildBattleBgm: "Salvaje.ogg", wildVictoryMe: "VictoriaSalvaje.ogg" },
        { mapId: 3, battleback: null, wildBattleBgm: null, wildVictoryMe: null }]);
  });
});
