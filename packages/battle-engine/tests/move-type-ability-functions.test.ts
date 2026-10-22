import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";

const zero: RandomSource = { nextInt: () => 0 };

function battler(id: string, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 200, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 20 }], ...overrides };
}

function move(code: BattleMove["functionCode"]): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.GROWL, functionCode: code, internalName: `MOVE${code}`,
    name: `MOVE${code}`, category: "Status", power: 0, accuracy: 0, effectChance: 0,
    targetCode: code === "060" ? "10" : "00" };
}

function use(code: BattleMove["functionCode"], player: Partial<BattlerState> = {},
  opponent: Partial<BattlerState> = {}, environment?: "cave" | "forest",
  terrain?: "electric" | "grassy") {
  const state = createTeamBattleState({ player: [battler("player", { ...player,
    moves: [{ move: move(code), pp: 10 }] }), battler("reserve")],
    opponent: [battler("opponent", opponent), battler("opponent-reserve")] });
  return resolveTeamTurn({ ...state, effects: { sides: {
    player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 },
  }, waterSportTurns: 0, environment: environment ?? "none", terrain: terrain ?? null } },
  { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
}

describe("Pokemon Z HP, type and ability move functions", () => {
  it("floors Pain Split's HP average and caps each battler at its own maximum", () => {
    const result = use("05A", { hp: 41, stats: {
      maxHp: 50, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 } },
    { hp: 180 });
    expect(result.state.teams.player.members[0]!.hp).toBe(50);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(110);
    expect(result.events.filter((event) => event.type === "hpShared")).toHaveLength(2);
  });

  it("maps Camouflage's source environments and terrain precedence and restores type on switch", () => {
    for (const [environment, terrain, expected] of [
      ["cave", null, "ROCK"], ["forest", null, "BUG"], ["cave", "electric", "ELECTRIC"],
    ] as const) {
      const result = use("060", {}, {}, environment, terrain ?? undefined);
      expect(result.state.teams.player.members[0]!.types).toEqual([expected]);
      const switched = resolveTeamTurn(result.state, {
        player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" },
      }, zero);
      expect(switched.state.teams.player.members[0]!.types).toEqual(["NORMAL"]);
    }
    expect(use("060").events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    expect(use("060", { ability: "MULTITYPE" }, {}, "cave").events)
      .toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("applies Soak and Reflect Type to the correct battler with switch restoration", () => {
    const soaked = use("061", {}, { types: ["FIRE", "FLYING"] });
    expect(soaked.state.teams.opponent.members[0]!.types).toEqual(["WATER"]);
    const switched = resolveTeamTurn(soaked.state, {
      player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 1 },
    }, zero);
    expect(switched.state.teams.opponent.members[0]!.types).toEqual(["FIRE", "FLYING"]);
    const copied = use("062", {}, { types: ["FIRE", "FLYING"] });
    expect(copied.state.teams.player.members[0]!.types).toEqual(["FIRE", "FLYING"]);
    expect(use("062").events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    expect(use("061", {}, { types: ["WATER"] }).events)
      .toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("replaces abilities temporarily with Simple Beam, Role Play and Entrainment", () => {
    const simple = use("063", {}, { ability: "CONTRARY" });
    expect(simple.state.teams.opponent.members[0]!.ability).toBe("SIMPLE");
    expect(simple.state.teams.opponent.members[0]!.volatile?.originalAbility).toBe("CONTRARY");
    const copied = use("065", { ability: "SIMPLE" }, { ability: "CONTRARY" });
    expect(copied.state.teams.player.members[0]!.ability).toBe("CONTRARY");
    const trained = use("066", { ability: "SIMPLE" }, { ability: "CONTRARY" });
    expect(trained.state.teams.opponent.members[0]!.ability).toBe("SIMPLE");
    const switched = resolveTeamTurn(trained.state, {
      player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 1 },
    }, zero);
    expect(switched.state.teams.opponent.members[0]!.ability).toBe("CONTRARY");
    expect(use("065", { ability: "SIMPLE" }, { ability: "ILLUSION" }).events)
      .toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    expect(use("066", { ability: "ILLUSION" }, { ability: "SIMPLE" }).events)
      .toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("targets the selected slot in doubles for temporary ability replacement", () => {
    const state = createDoubleTeamBattleState({
      player: [battler("player", { ability: "SIMPLE", moves: [{ move: move("066"), pp: 10 }] }),
        battler("ally")],
      opponent: [battler("first", { ability: "CONTRARY" }),
        battler("second", { ability: "CONTRARY" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], zero);
    expect(result.state.teams.opponent.members[0]!.ability).toBe("CONTRARY");
    expect(result.state.teams.opponent.members[1]!.ability).toBe("SIMPLE");
  });

  it("swaps abilities, reruns their entry hooks and restores both on withdrawal", () => {
    const swapped = use("067", { ability: "SIMPLE" }, { ability: "PRESSURE" });
    expect(swapped.state.teams.player.members[0]!.ability).toBe("PRESSURE");
    expect(swapped.state.teams.opponent.members[0]!.ability).toBe("SIMPLE");
    expect(swapped.events).toContainEqual(expect.objectContaining({
      type: "abilityActivated", side: "player", ability: "PRESSURE", effect: "pressure",
    }));
    const withdrawn = resolveTeamTurn(swapped.state, {
      player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "switch", teamIndex: 1 },
    }, zero);
    expect(withdrawn.state.teams.player.members[0]!.ability).toBe("SIMPLE");
    expect(withdrawn.state.teams.opponent.members[0]!.ability).toBe("PRESSURE");
    expect(use("067", { ability: "ILLUSION" }, { ability: "PRESSURE" }).events)
      .toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("suppresses an ability with Gastro Acid until withdrawal", () => {
    const suppressed = use("068", {}, { ability: "CONTRARY" });
    expect(suppressed.state.teams.opponent.members[0]!.ability).toBeNull();
    expect(suppressed.state.teams.opponent.members[0]!.volatile).toMatchObject({
      gastroAcid: true, originalAbility: "CONTRARY",
    });
    const withdrawn = resolveTeamTurn(suppressed.state, {
      player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 1 },
    }, zero);
    expect(withdrawn.state.teams.opponent.members[0]!.ability).toBe("CONTRARY");
    expect(use("068", {}, { ability: "MULTITYPE" }).events)
      .toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    const gas = use("068", { ability: "SIMPLE" }, { ability: "NEUTRALIZINGGAS" });
    expect(gas.state.teams.opponent.members[0]!.ability).toBeNull();
    expect(gas.state.teams.opponent.members[0]!.volatile?.originalAbility).toBe("NEUTRALIZINGGAS");
    expect(gas.state.teams.player.members[0]!.ability).toBe("SIMPLE");
  });
});
