import { createDoubleTeamBattleState, createTeamBattleState, MINIMAL_MOVE_CATALOG,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { flingPower } from "../src/battle-fling.js";

class Random implements RandomSource {
  private index = 0;
  constructor(private readonly values: readonly number[] = []) {}
  nextInt(maxExclusive: number): number {
    const value = this.values[this.index++] ?? 0;
    if (value < 0 || value >= maxExclusive) throw new Error(`Bad RNG ${value}/${maxExclusive}`);
    return value;
  }
}

function move(code: BattleMove["functionCode"], category: BattleMove["category"] = "Status",
  power = 0): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: `MOVE${code}`, name: code,
    functionCode: code, category, power, accuracy: 0, effectChance: 0,
    targetCode: category === "Status" && code === "0F6" ? "10" : "00" };
}

function pokemon(id: string, selected: BattleMove, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 160, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0,
      accuracy: 0, evasion: 0 }, hp: 160, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: selected, pp: selected.pp }], ...overrides };
}

function use(code: BattleMove["functionCode"], user: Partial<BattlerState>, target: Partial<BattlerState>,
  category: BattleMove["category"] = "Status", power = 0, rolls: readonly number[] = []) {
  const selected = move(code, category, power);
  const state = createTeamBattleState({ player: [pokemon("user", selected, user)],
    opponent: [pokemon("target", move("000", "Physical", 40), target)] });
  return resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
    opponent: { kind: "wait" } }, new Random(rolls));
}

describe("source held-item move family", () => {
  it("swaps two objects, preserving both original owners for post-battle restoration", () => {
    const result = use("0F2", { heldItem: "ORANBERRY" }, { heldItem: "LEFTOVERS" });
    expect(result.state.teams.player.members[0]).toMatchObject({ heldItem: "LEFTOVERS",
      heldItemTransfer: { originalItem: "ORANBERRY" } });
    expect(result.state.teams.opponent.members[0]).toMatchObject({ heldItem: "ORANBERRY",
      heldItemTransfer: { originalItem: "LEFTOVERS" } });
    expect(result.events.filter((event) => event.type === "heldItemTransferred")).toHaveLength(2);
  });

  it("blocks Trick through Sticky Hold and Bestow onto an occupied slot", () => {
    const sticky = use("0F2", { heldItem: "ORANBERRY" },
      { heldItem: "LEFTOVERS", ability: "STICKYHOLD" });
    expect(sticky.state.teams.player.members[0]!.heldItem).toBe("ORANBERRY");
    expect(sticky.events).toContainEqual(expect.objectContaining({ type: "moveFailed", move: "MOVE0F2" }));
    const occupied = use("0F3", { heldItem: "ORANBERRY" }, { heldItem: "LEFTOVERS" });
    expect(occupied.events).toContainEqual(expect.objectContaining({ type: "moveFailed", move: "MOVE0F3" }));
  });

  it("gives away the held item and restores only a previously consumed item", () => {
    const given = use("0F3", { heldItem: "LEFTOVERS" }, {});
    expect(given.state.teams.player.members[0]!.heldItem).toBeNull();
    expect(given.state.teams.opponent.members[0]!.heldItem).toBe("LEFTOVERS");
    const recycled = use("0F6", { recyclableItem: "ORANBERRY" }, {});
    expect(recycled.state.teams.player.members[0]).toMatchObject({ heldItem: "ORANBERRY",
      recyclableItem: null });
    expect(recycled.events).toContainEqual(expect.objectContaining({ type: "heldItemRecovered",
      item: "ORANBERRY", ability: "RECYCLE" }));
  });

  it("incinerates a berry before it can heal and generalizes Bug Bite beyond Oran/Liechi", () => {
    const burned = use("0F5", {}, { hp: 100, heldItem: "SITRUSBERRY" }, "Special", 60, [1, 15]);
    expect(burned.state.teams.opponent.members[0]!.heldItem).toBeNull();
    expect(burned.events).not.toContainEqual(expect.objectContaining({ type: "itemActivated",
      item: "SITRUSBERRY" }));
    const bitten = use("0F4", { hp: 100 }, { heldItem: "SITRUSBERRY" }, "Physical", 40, [1, 15]);
    expect(bitten.state.teams.player.members[0]!.hp).toBe(140);
    expect(bitten.state.teams.opponent.members[0]!.heldItem).toBeNull();
  });

  it("flings the source item's damage class and consumes the thrown item", () => {
    expect(flingPower("HARDSTONE")).toBe(100);
    expect(flingPower("IRONBALL")).toBe(130);
    expect(flingPower("ORANBERRY")).toBe(10);
    const result = use("0F7", { heldItem: "HARDSTONE" }, {}, "Physical", 1, [1, 15]);
    expect(result.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "HARDSTONE" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "HARDSTONE" }));
  });

  it("applies Fling's item-specific effect and refuses an item suppressed by Klutz", () => {
    const burned = use("0F7", { heldItem: "FLAMEORB" }, {}, "Physical", 1, [1, 15]);
    expect(burned.state.teams.opponent.members[0]!.majorStatus?.kind).toBe("burn");
    const blocked = use("0F7", { heldItem: "HARDSTONE", ability: "KLUTZ" }, {},
      "Physical", 1);
    expect(blocked.state.teams.player.members[0]!.heldItem).toBe("HARDSTONE");
    expect(blocked.events).toContainEqual(expect.objectContaining({ type: "moveFailed",
      move: "MOVE0F7" }));
  });

  it("requires Shield Dust together with Covert Cloak to block a Fling effect", () => {
    const burn = (target: Partial<BattlerState>, source: Partial<BattlerState> = {}) =>
      use("0F7", { heldItem: "FLAMEORB", ...source }, target, "Physical", 1, [1, 15])
        .state.teams.opponent.members[0]!.majorStatus?.kind;
    expect(burn({ heldItem: "COVERTCLOAK" })).toBe("burn");
    expect(burn({ ability: "SHIELDDUST" })).toBe("burn");
    expect(burn({ ability: "SHIELDDUST", heldItem: "COVERTCLOAK" })).toBeUndefined();
    expect(burn({ ability: "SHIELDDUST", heldItem: "COVERTCLOAK" },
      { ability: "MOLDBREAKER" })).toBe("burn");
  });

  it("keeps an incinerated berry out of Recycle and respects Sticky Hold for Bug Bite", () => {
    const burned = use("0F5", {}, { heldItem: "ORANBERRY" }, "Special", 60, [1, 15]);
    expect(burned.state.teams.opponent.members[0]!.recyclableItem).toBeUndefined();
    const guarded = use("0F4", {}, { heldItem: "LIECHIBERRY", ability: "STICKYHOLD" },
      "Physical", 40, [1, 15]);
    expect(guarded.state.teams.opponent.members[0]!.heldItem).toBe("LIECHIBERRY");
    expect(guarded.state.teams.player.members[0]!.stages.attack).toBe(0);
  });

  it("checks a healing berry between impacts of a multi-hit move", () => {
    const result = use("0BD", {}, { hp: 90, heldItem: "ORANBERRY" }, "Physical", 40,
      [1, 15, 1, 15]);
    const first = result.events.findIndex((event) => event.type === "damageApplied");
    const eaten = result.events.findIndex((event) => event.type === "heldItemConsumed"
      && event.item === "ORANBERRY");
    const second = result.events.findIndex((event, index) => index > first && event.type === "damageApplied");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(eaten).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(eaten);
  });

  it("recalculates the following impact after Ganlon raises Defense", () => {
    const result = use("0BD", {}, { hp: 60, heldItem: "GANLONBERRY" },
      "Physical", 40, [1, 15, 1, 15]);
    const hits = result.events.filter((event) => event.type === "damageApplied");
    expect(hits).toHaveLength(2);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "statStageChanged",
      target: "opponent", stat: "defense", stage: 1 }));
    expect(hits[1]?.type === "damageApplied" ? hits[1].amount : 0)
      .toBeLessThan(hits[0]?.type === "damageApplied" ? hits[0].amount : 0);
  });

  it("routes an item exchange through the positioned double-battle adapter", () => {
    const trick = move("0F2");
    const state = createDoubleTeamBattleState({
      player: [pokemon("actor", trick, { heldItem: "HARDSTONE", stats: {
        ...pokemon("actor", trick).stats, speed: 130 } }), pokemon("ally", move("000", "Physical", 40))],
      opponent: [pokemon("foe", move("000", "Physical", 40), { heldItem: "LEFTOVERS" }),
        pokemon("foe-ally", move("000", "Physical", 40))],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new Random());
    expect(result.state.teams.player.members[0]!.heldItem).toBe("LEFTOVERS");
    expect(result.state.teams.opponent.members[0]!.heldItem).toBe("HARDSTONE");
    expect(result.state.teams.opponent.members[1]!.heldItem).toBeNull();
  });
});
