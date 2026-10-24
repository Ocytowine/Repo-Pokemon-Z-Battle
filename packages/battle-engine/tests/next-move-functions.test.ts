import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = (code: BattleMove["functionCode"], category: BattleMove["category"] = "Physical"):
  BattleMove => ({ ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
    category, power: 20, accuracy: 90, effectChance: 0 });
function battler(side: BattleSide, chosen: BattleMove): BattlerState {
  return { id: side, species: "EEVEE", name: side, level: 50, types: ["NORMAL"],
    stats: { maxHp: 1000, attack: 100, defense: 80, specialAttack: 100,
      specialDefense: 200, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 1000, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: chosen, pp: 10 }] };
}

describe("multi-hit and defensive targeting functions", () => {
  it("Triple Kick checks each hit and grows from one to three times its base power", () => {
    const result = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", move("0BF"))],
      opponent: [battler("opponent", move("000"))],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const damage = result.events.filter((event) => event.type === "damageApplied" && event.source === "player");
    expect(damage).toHaveLength(3);
    const traces = result.trace.filter((entry) => entry.type === "damage" && entry.side === "player");
    expect(traces.map((entry) => entry.baseDamage)).toEqual([...traces.map((entry) => entry.baseDamage)]
      .sort((left, right) => left - right));
    expect(traces[2]!.baseDamage).toBeGreaterThan(traces[0]!.baseDamage);
    expect(result.trace.filter((entry) => entry.type === "accuracy" && entry.side === "player")).toHaveLength(3);
  });

  it("Brick Break ignores and removes both target screens", () => {
    const initial = createTeamBattleState({ player: [battler("player", move("10A"))],
      opponent: [battler("opponent", move("000"))] });
    const screened = { ...initial, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 5, lightScreenTurns: 5, luckyChantTurns: 0 },
    }, waterSportTurns: 0 } };
    const actions = { player: { kind: "move" as const, moveIndex: 0 }, opponent: { kind: "wait" as const } };
    const hit = resolveTeamTurn(screened, actions, rng);
    const ordinary = resolveTeamTurn(initial, actions, rng);
    expect(hit.state.teams.opponent.members[0]?.hp).toBe(ordinary.state.teams.opponent.members[0]?.hp);
    expect(hit.state.effects?.sides.opponent.reflectTurns).toBe(0);
    expect(hit.state.effects?.sides.opponent.lightScreenTurns).toBe(0);
  });

  it("Psyshock-like moves use physical Defense with Special Attack", () => {
    const result = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { ...move("122", "Special"), type: "PSYCHIC" })],
      opponent: [battler("opponent", move("000"))],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const damage = result.trace.find((entry) => entry.type === "damage" && entry.side === "player");
    expect(damage?.type === "damage" && damage.defense).toBe(80);
  });
});

describe("Stockpile family", () => {
  const prepare = () => createTeamBattleState({
    player: [{ ...battler("player", move("112", "Status")), hp: 500,
      moves: [move("112", "Status"), move("113", "Special"), move("114", "Status")]
        .map((entry) => ({ move: { ...entry, targetCode: entry.functionCode === "113" ? "00" : "10" }, pp: 10 })) }],
    opponent: [battler("opponent", move("000"))],
  });
  const use = (state: ReturnType<typeof prepare>, moveIndex: number) => resolveTeamTurn(state,
    { player: { kind: "move", moveIndex }, opponent: { kind: "wait" } }, rng);

  it("stores up to three charges and consumes them for Swallow's healing", () => {
    let state = prepare();
    state = use(state, 0).state;
    state = use(state, 0).state;
    expect(state.teams.player.members[0]?.volatile?.stockpileCount).toBe(2);
    expect(state.teams.player.members[0]?.stages.defense).toBe(2);
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const swallowed = use(restored, 2);
    expect(swallowed.state.teams.player.members[0]?.hp).toBe(1000);
    expect(swallowed.state.teams.player.members[0]?.volatile?.stockpileCount).toBe(0);
    expect(swallowed.state.teams.player.members[0]?.stages.defense).toBe(0);
    expect(swallowed.state.teams.player.members[0]?.stages.specialDefense).toBe(0);
    expect(use(swallowed.state, 1).events).toContainEqual({ type: "moveFailed", side: "player",
      move: "113", reason: "condition" });
  });

  it("Spit Up uses stored power and removes only earned defense stages after a hit", () => {
    let state = prepare();
    state = use(state, 0).state;
    state = use(state, 0).state;
    const result = use(state, 1);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(1000);
    expect(result.state.teams.player.members[0]?.volatile?.stockpileCount).toBe(0);
    expect(result.state.teams.player.members[0]?.stages.defense).toBe(0);
  });
});

describe("Flying Press", () => {
  it("combines Fighting and Flying effectiveness", () => {
    const target = { ...battler("opponent", move("000")), types: ["GRASS"] };
    const action = { player: { kind: "move" as const, moveIndex: 0 }, opponent: { kind: "wait" as const } };
    const press = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { ...move("144"), type: "FIGHTING", accuracy: 95 })],
      opponent: [target],
    }), action, rng);
    const punch = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { ...move("000"), type: "FIGHTING", accuracy: 95 })],
      opponent: [target],
    }), action, rng);
    expect(press.state.teams.opponent.members[0]!.hp).toBeLessThan(punch.state.teams.opponent.members[0]!.hp);
    expect(press.events.find((event) => event.type === "damageApplied")?.effectiveness).toBe(2);
  });

  it("hits a Minimized target despite an otherwise failing accuracy roll", () => {
    const minimized = { ...battler("opponent", move("034", "Status")),
      moves: [{ move: { ...move("034", "Status"), targetCode: "10" }, pp: 10 }] };
    const initial = createTeamBattleState({
      player: [battler("player", { ...move("144"), type: "FIGHTING", accuracy: 1 })],
      opponent: [minimized],
    });
    const setup = resolveTeamTurn(initial,
      { player: { kind: "wait" }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(setup.state.teams.opponent.members[0]?.volatile?.minimized).toBe(true);
    const roll: RandomSource = { nextInt: () => 99 };
    const hit = resolveTeamTurn(setup.state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, roll);
    expect(hit.events.some((event) => event.type === "damageApplied" && event.source === "player")).toBe(true);
  });
});

describe("Aromatherapy and Heal Bell", () => {
  const bell = { ...move("019", "Status"), targetCode: "40", accuracy: 0 };
  const poisoned = (id: string, side: BattleSide, chosen = move("000")): BattlerState => ({
    ...battler(side, chosen), id, majorStatus: { kind: "poison", toxicCounter: null },
  });

  it("cures the user and bench in solo, and survives serialized restoration", () => {
    const state = createTeamBattleState({
      player: [{ ...poisoned("user", "player", bell) }, poisoned("bench", "player")],
      opponent: [battler("opponent", move("000"))],
    });
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const result = resolveTeamTurn(restored,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.player.members.map((member) => member.majorStatus)).toEqual([null, null]);
    expect(result.events.some((event) => event.type === "partyStatusCured" && event.memberId === "bench")).toBe(true);
  });

  it("cures both active allies and the bench in double without touching opponents", () => {
    const state = createDoubleTeamBattleState({
      player: [poisoned("user", "player", bell), poisoned("ally", "player"), poisoned("bench", "player")],
      opponent: [poisoned("enemy", "opponent"), battler("opponent", move("000"))],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members.every((member) => member.majorStatus === null)).toBe(true);
    expect(result.state.teams.opponent.members[0]?.majorStatus?.kind).toBe("poison");
  });

  it("respects an active partner's Grass absorption for Aromatherapy, but cures reserves", () => {
    const aroma = { ...bell, internalName: "AROMATHERAPY", type: "GRASS" };
    const state = createDoubleTeamBattleState({
      player: [poisoned("user", "player", aroma),
        { ...poisoned("partner", "player"), ability: "SAPSIPPER" },
        { ...poisoned("bench", "player"), ability: "SAPSIPPER" }],
      opponent: [battler("opponent", move("000"))],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members.map((member) => member.majorStatus?.kind ?? null))
      .toEqual([null, "poison", null]);
  });
});

describe("source function 140 collision", () => {
  it("allows physical Last Resort only after every other known move was attempted", () => {
    const lastResort = { ...move("140"), internalName: "LASTRESORT", power: 70 };
    const first = { ...move("000"), internalName: "TACKLE" };
    const user = { ...battler("player", lastResort),
      moves: [{ move: lastResort, pp: 10 }, { move: first, pp: 10 }] };
    const initial = createTeamBattleState({ player: [user], opponent: [battler("opponent", move("000"))] });
    const actions = (moveIndex: number) => ({ player: { kind: "move" as const, moveIndex },
      opponent: { kind: "wait" as const } });
    const rejected = resolveTeamTurn(initial, actions(0), rng);
    expect(rejected.events).toContainEqual({ type: "moveFailed", side: "player", move: "LASTRESORT",
      reason: "condition" });
    const prepared = resolveTeamTurn(rejected.state, actions(1), rng);
    const used = resolveTeamTurn(prepared.state, actions(0), rng);
    expect(used.events.some((event) => event.type === "damageApplied" && event.source === "player")).toBe(true);
  });

  it("uses poisoned-target Venom Drench for the Status move in double battles", () => {
    const drench = { ...move("140", "Status"), internalName: "VENOMDRENCH",
      type: "POISON", targetCode: "00", accuracy: 85 };
    const poisoned = { ...battler("opponent", move("000")), id: "poisoned",
      majorStatus: { kind: "poison" as const, toxicCounter: null } };
    const healthy = { ...battler("opponent", move("000")), id: "healthy" };
    const state = createDoubleTeamBattleState({
      player: [battler("player", drench), battler("player", move("000"))],
      opponent: [poisoned, healthy],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]?.stages.attack).toBe(-1);
    expect(result.state.teams.opponent.members[0]?.stages.specialAttack).toBe(-1);
    expect(result.state.teams.opponent.members[0]?.stages.speed).toBe(-1);
    expect(result.state.teams.opponent.members[1]?.stages.attack).toBe(0);
  });
});
