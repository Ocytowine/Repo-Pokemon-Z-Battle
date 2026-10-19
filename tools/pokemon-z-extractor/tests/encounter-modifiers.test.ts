import { describe, expect, it } from "vitest";
import { parseEncounterModifierScript } from "../src/runtime/extract-encounter-modifiers.js";

describe("encounter modifier extraction", () => {
  it("extracts map and narrative-switch status modifiers without species hardcoding", () => {
    const source = `
Events.onWildPokemonCreate+=proc {|sender,e|
  pokemon=e[0]
  if $game_map.map_id==138 || $game_map.map_id==139
    pokemon.status = PBStatuses::CADUCO
  end
end
Events.onWildPokemonCreate+=proc {|sender,e|
  pokemon=e[0]
  if $game_switches[482]
    if pokemon.species == PBSpecies::FURFROU
      pokemon.status = PBStatuses::CADUCO
    end
  end
end
`;
    expect(parseEncounterModifierScript(source, "scripts/modifiers.rb")).toEqual([
      { mapIds: [138, 139], species: [], requiredSwitches: [], effects: { majorStatus: "caduco" },
        source: { file: "scripts/modifiers.rb", line: 5 } },
      { mapIds: [], species: ["FURFROU"], requiredSwitches: [482], effects: { majorStatus: "caduco" },
        source: { file: "scripts/modifiers.rb", line: 12 } },
    ]);
  });

  it("aggregates the source preparation of one narrative opponent", () => {
    const source = `
Events.onWildPokemonCreate+=proc {|sender,e|
  pokemon=e[0]
  if $game_switches[482]
    if pokemon.species == PBSpecies::MOLTRES
      pokemon.form = 1
      pokemon.pbLearnMove(:DARKPULSE)
      pokemon.pbLearnMove(:AIRSLASH)
      pokemon.iv[0]=31
      pokemon.ev[4]=100
      pokemon.setItem(:ANTICRITICO)
      pokemon.makeShiny
      pokemon.name="Gardien"
    end
  end
end
`;
    expect(parseEncounterModifierScript(source, "scripts/modifiers.rb")).toEqual([{
      mapIds: [], species: ["MOLTRES"], requiredSwitches: [482], effects: {
        form: 1, learnedMoves: ["DARKPULSE", "AIRSLASH"], ivs: { hp: 31 },
        evs: { specialAttack: 100 }, heldItem: "ANTICRITICO", shiny: true, nickname: "Gardien",
      }, source: { file: "scripts/modifiers.rb", line: 6 },
    }]);
  });

  it("extracts Map999's dynamic level policy without treating its recalculation as three missing effects", () => {
    const source = `
Events.onWildPokemonCreate+=proc {|sender,e|
  pokemon=e[0]
  if $game_map.map_id==999
    newlevel=pbBalancedLevel($Trainer.party) - 4 + rand(5)
    pokemon.level=newlevel
    pokemon.calcStats
    pokemon.resetMoves
  end
end
`;
    expect(parseEncounterModifierScript(source, "scripts/dynamic.rb")).toEqual([{
      mapIds: [999], species: [], requiredSwitches: [],
      effects: { levelPolicy: "balanced-minus-four-to-zero" },
      source: { file: "scripts/dynamic.rb", line: 6 },
    }]);
  });
});
