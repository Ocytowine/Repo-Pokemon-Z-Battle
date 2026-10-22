import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.GROWL;
  const base: BattleMove = side === "player" ? { ...source, flags: "a" } : { ...source };
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 100, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...base, accuracy: 0 }, pp: base.pp }], ...overrides,
  };
}

function explosion(targetCode = "00"): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "EXPLOSION", name: "Explosion",
    functionCode: "0E0", power: 250, accuracy: 0, flags: "bef", targetCode };
}

function actions() {
  return { player: { kind: "move" as const, moveIndex: 0 }, opponent: { kind: "wait" as const } };
}

describe("Aftermath, Damp and explosive moves", () => {
  it("deals one quarter of the attacker's maximum HP after a contact knockout", () => {
    const attacker = pokemon("attacker", "player");
    const aftermath = pokemon("aftermath", "opponent", { hp: 1, ability: "AFTERMATH" });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [aftermath] }),
      actions(), rng);

    expect(result.state.teams.player.members[0]?.hp).toBe(75);
    expect(result.events).toContainEqual({ type: "abilityDamage", source: "opponent", target: "player",
      ability: "AFTERMATH", amount: 25, hp: 75 });
  });

  it.each(["MAGICGUARD", "MOLDBREAKER"])("lets %s prevent or bypass Aftermath", (ability) => {
    const attacker = pokemon("attacker", "player", { ability });
    const aftermath = pokemon("aftermath", "opponent", { hp: 1, ability: "AFTERMATH" });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [aftermath] }),
      actions(), rng);
    expect(result.state.teams.player.members[0]?.hp).toBe(100);
  });

  it("blocks Explosion globally with Damp after spending the move's PP", () => {
    const move = explosion();
    const attacker = pokemon("attacker", "player", { moves: [{ move, pp: 5 }] });
    const damp = pokemon("damp", "opponent", { ability: "DAMP" });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [damp] }),
      actions(), rng);

    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 100, moves: [{ pp: 4 }] });
    expect(result.state.teams.opponent.members[0]?.hp).toBe(100);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "DAMP", effect: "block-move" });
  });

  it("lets Mold Breaker bypass Damp and sacrifices the user before post-hit effects", () => {
    const move = explosion();
    const attacker = pokemon("attacker", "player", { ability: "MOLDBREAKER",
      moves: [{ move, pp: 5 }] });
    const reserve = pokemon("reserve", "player");
    const damp = pokemon("damp", "opponent", { ability: "DAMP", hp: 500,
      stats: { ...pokemon("damp", "opponent").stats, maxHp: 500, defense: 500 } });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker, reserve], opponent: [damp] }),
      actions(), rng);

    expect(result.state.teams.player.members[0]?.hp).toBe(0);
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(500);
    expect(result.state.replacementRequired).toEqual(["player"]);
    expect(result.events).toContainEqual({ type: "recoilDamage", side: "player", move: "EXPLOSION",
      reason: "self-destruct", amount: 100, hp: 0 });
  });

  it("finishes as a draw when Explosion knocks out both final battlers", () => {
    const move = explosion();
    const attacker = pokemon("attacker", "player", { moves: [{ move, pp: 5 }] });
    const target = pokemon("target", "opponent", { hp: 1 });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [target] }),
      actions(), rng);

    expect(result.state).toMatchObject({ status: "finished", winner: null, replacementRequired: [] });
    expect(result.events).toContainEqual({ type: "battleEnded", winner: null });
  });

  it("resolves a spread Explosion against both targets but reports one sacrifice", () => {
    const move = explosion("04");
    const attacker = pokemon("attacker", "player", { moves: [{ move, pp: 5 }] });
    const state = createDoubleTeamBattleState({
      player: [attacker, pokemon("ally", "player")],
      opponent: [pokemon("first", "opponent"), pokemon("second", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    const inner = result.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : []);

    expect(result.state.teams.player.members[0]?.hp).toBe(0);
    expect(result.state.teams.opponent.members.slice(0, 2).every((member) => member.hp < 100)).toBe(true);
    expect(inner.filter((event) => event.type === "recoilDamage"
      && event.reason === "self-destruct")).toHaveLength(1);
  });

  it("lets a Damp partner on the fourth slot block spread Explosion and Aftermath", () => {
    const move = explosion("04");
    const attacker = pokemon("attacker", "player", { moves: [{ move, pp: 5 }] });
    const state = createDoubleTeamBattleState({
      player: [attacker, pokemon("ally", "player")],
      opponent: [pokemon("aftermath", "opponent", { hp: 1, ability: "AFTERMATH" }),
        pokemon("damp", "opponent", { ability: "DAMP" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);

    expect(result.state.teams.player.members[0]?.hp).toBe(100);
    expect(result.state.teams.opponent.members[0]?.hp).toBe(1);
    const inner = result.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : []);
    expect(inner.filter((event) => event.type === "abilityActivated" && event.ability === "DAMP")).toHaveLength(1);

    const contactState = createDoubleTeamBattleState({
      player: [pokemon("contact", "player"), pokemon("contact-ally", "player")],
      opponent: [pokemon("aftermath", "opponent", { hp: 1, ability: "AFTERMATH" }),
        pokemon("damp", "opponent", { ability: "DAMP" })],
    });
    const contactResult = resolveDoubleTeamTurn(contactState, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(contactResult.state.teams.player.members[0]?.hp).toBe(100);
    const contactEvents = contactResult.events.flatMap((event) =>
      event.type === "positionedActionResolved" ? event.events : []);
    expect(contactEvents.some((event) => event.type === "abilityActivated"
      && event.ability === "AFTERMATH")).toBe(false);
  });
});
