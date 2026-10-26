import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, applyPokemonItemEffect, createTeamBattleState,
  resolveTeamTurn, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
function pokemon(id: string, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 100, majorStatus: null,
    ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }], ...overrides };
}
const item = (id: string) => ({ player: { kind: "item" as const, itemId: id, targetTeamIndex: 0 },
  opponent: { kind: "wait" as const } });

describe("source battle trainer items", () => {
  it("raises Focus Energy to the source level and refuses repeated lower items", () => {
    const state = createTeamBattleState({ player: [pokemon("host")], opponent: [pokemon("foe")] });
    const first = resolveTeamTurn(state, item("DIREHIT"), rng);
    expect(first.state.teams.player.members[0]?.volatile?.focusEnergy).toBe(1);
    expect(first.events).toContainEqual(expect.objectContaining({ type: "trainerItemUsed",
      itemId: "DIREHIT", focusEnergyRaised: 1 }));
    expect(() => resolveTeamTurn(first.state, item("DIREHIT"), rng)).toThrow("no-effect");
    const second = resolveTeamTurn(first.state, item("DIREHIT2"), rng);
    expect(second.state.teams.player.members[0]?.volatile?.focusEnergy).toBe(2);
    const third = resolveTeamTurn(second.state, item("DIREHIT3"), rng);
    expect(third.state.teams.player.members[0]?.volatile?.focusEnergy).toBe(3);
    expect(() => resolveTeamTurn(third.state, item("DIREHIT2"), rng)).toThrow("no-effect");
  });

  it("starts Mist for the whole side, blocks a second Guard Spec and rejects reserves", () => {
    const state = createTeamBattleState({ player: [pokemon("host"), pokemon("reserve")],
      opponent: [pokemon("foe")] });
    const first = resolveTeamTurn(state, item("GUARDSPEC"), rng);
    expect(first.events).toContainEqual(expect.objectContaining({ type: "battleEffectChanged",
      side: "player", effect: "mist", turns: 5 }));
    expect(first.state.effects?.sides.player.mistTurns).toBeGreaterThan(0);
    expect(() => resolveTeamTurn(first.state, item("GUARDSPEC"), rng)).toThrow("no-effect");
    expect(() => resolveTeamTurn(state, { player: { kind: "item", itemId: "GUARDSPEC",
      targetTeamIndex: 1 }, opponent: { kind: "wait" } }, rng)).toThrow("active Pokemon");
  });

  it("the two flutes cure only their matching volatile condition", () => {
    const confused = pokemon("host", { volatile: { confusionTurns: 3, flinched: false,
      focusEnergy: 0, identified: false, disabledMove: null, disableTurns: 0,
      encoreMove: null, encoreTurns: 0, bindingMove: null, bindingTurns: 0,
      cursed: false, lastMoveUsed: null, infatuated: true } });
    const yellow = applyPokemonItemEffect(confused, "YELLOWFLUTE",
      { context: "battle", revivalAllowed: true });
    expect(typeof yellow).toBe("object");
    if (typeof yellow === "string") return;
    expect(yellow.pokemon.volatile?.confusionTurns).toBe(0);
    expect(yellow.pokemon.volatile?.infatuated).toBe(true);
    expect(yellow.effect.confusionCured).toBe(true);
    const red = applyPokemonItemEffect(yellow.pokemon, "REDFLUTE",
      { context: "battle", revivalAllowed: true });
    expect(typeof red).toBe("object");
    if (typeof red === "string") return;
    expect(red.pokemon.volatile?.infatuated).toBe(false);
    expect(red.effect.infatuationCured).toBe(true);
    expect(applyPokemonItemEffect(red.pokemon, "REDFLUTE",
      { context: "battle", revivalAllowed: true })).toBe("no-effect");
  });

  it.each(["POKEDOLL", "FLUFFYTAIL", "POKETOY"])("%s guarantees wild escape without an opponent turn", (id) => {
    const state = createTeamBattleState({ player: [pokemon("host")], opponent: [pokemon("wild")] });
    const escaped = resolveTeamTurn(state, item(id), rng,
      { context: "battle", revivalAllowed: true },
      { opponentItemTheft: true, wildBattle: true, escapable: true });
    expect(escaped.state.status).toBe("finished");
    expect(escaped.state.winner).toBeNull();
    expect(escaped.events).toContainEqual({ type: "battleEscaped", side: "player", move: id });
    expect(escaped.events.some((event) => event.type === "moveUsed")).toBe(false);
    expect(() => resolveTeamTurn(state, item(id), rng,
      { context: "battle", revivalAllowed: true },
      { opponentItemTheft: true, wildBattle: false })).toThrow("no-effect");
  });

  it.each(["HEALPOWDER", "FULLHEAL", "FULLRESTORE"])("%s cures confusion even without major status", (id) => {
    const confused = pokemon("host", { volatile: { confusionTurns: 3, flinched: false,
      focusEnergy: 0, identified: false, disabledMove: null, disableTurns: 0,
      encoreMove: null, encoreTurns: 0, bindingMove: null, bindingTurns: 0,
      cursed: false, lastMoveUsed: null }, happiness: 150 });
    const applied = applyPokemonItemEffect(confused, id, { context: "battle", revivalAllowed: true });
    expect(typeof applied).toBe("object");
    if (typeof applied === "string") return;
    expect(applied.pokemon.volatile?.confusionTurns).toBe(0);
    expect(applied.effect.confusionCured).toBe(true);
    expect(applied.effect.happinessChanged).toBe(id === "HEALPOWDER" ? -5 : 0);
    expect(applyPokemonItemEffect(pokemon("healthy"), id,
      { context: "battle", revivalAllowed: true })).toBe("no-effect");
  });
});
