import { describe, expect, it } from "vitest";
import { createInitialState, parseScenario, replayScenario, statsAtLevel50, type BattleScenario } from "../src/scenario.js";
import { findPreset } from "../src/presets.js";

const scenario: BattleScenario = {
  version: 1,
  seed: 24_301,
  player: "BULBASAUR",
  opponent: "SQUIRTLE",
  turns: [{ playerMove: 1, opponentMove: 1 }, { playerMove: 0, opponentMove: 0 }],
};

describe("battle sandbox scenarios", () => {
  it("creates level 50 battlers from the extracted Pokemon Z base stats", () => {
    const bulbasaur = findPreset("BULBASAUR");
    if (bulbasaur === undefined) throw new Error("Missing fixture");
    expect(statsAtLevel50(bulbasaur)).toEqual({ maxHp: 125, attack: 69, defense: 69, specialAttack: 85, specialDefense: 85, speed: 65 });
    expect(createInitialState("BULBASAUR", "SQUIRTLE").battlers.player.moves.map((slot) => slot.move.internalName)).toEqual(["TACKLE", "VINEWHIP", "SLEEPPOWDER", "POISONPOWDER"]);
  });

  it("uses the French names extracted from the compiled localization", () => {
    const state = createInitialState("BULBASAUR", "SQUIRTLE");
    expect(state.battlers.player.name).toBe("Bulbizarre");
    expect(state.battlers.opponent.name).toBe("Carapuce");
    expect(state.battlers.player.moves.map((slot) => slot.move.name)).toEqual(["Charge", "Fouet Lianes", "Poudre Dodo", "Poudre Toxik"]);
  });

  it("replays an exported action history deterministically", () => {
    expect(replayScenario(scenario)).toEqual(replayScenario(structuredClone(scenario)));
  });

  it("validates imported scenarios at runtime", () => {
    expect(parseScenario(JSON.parse(JSON.stringify(scenario)) as unknown)).toEqual(scenario);
    expect(() => parseScenario({ ...scenario, player: "MISSINGNO" })).toThrow("Pokémon joueur inconnu");
    expect(() => parseScenario({ ...scenario, turns: [{ playerMove: 99, opponentMove: 0 }] })).toThrow("Index d'attaque invalide");
  });
});
