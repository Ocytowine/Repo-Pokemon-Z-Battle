import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState,
  type RandomSource } from "../src/index.js";

const normal: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 80, power: 40 };
const rng = (roll = 0): RandomSource => ({ nextInt: (max) => max === 100 ? roll : 0 });

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: normal, pp: normal.pp }], ...overrides };
}

const use = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };
const play = (attacker: BattlerState, defender: BattlerState, roll: number) =>
  resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [defender] }), use, rng(roll));

describe("source precision, critical and survival items", () => {
  it.each(["BRIGHTPOWDER", "LAXINCENSE"] as const)("reduces hit chance with %s", (item) => {
    const attacker = pokemon("user", "player");
    const target = pokemon("foe", "opponent", { heldItem: item });
    expect(play(attacker, { ...target, heldItem: null }, 75).events.some((event) =>
      event.type === "damageApplied")).toBe(true);
    const protectedTarget = play(attacker, target, 75);
    expect(protectedTarget.events).toContainEqual({ type: "moveMissed", side: "player",
      move: normal.internalName });
    expect(protectedTarget.trace).toContainEqual(expect.objectContaining({ type: "accuracy",
      threshold: 80 / 1.1, hit: false }));
  });

  it("boosts Zoom Lens only after the target acted or when it did not choose a move", () => {
    const attacker = pokemon("user", "player", { heldItem: "ZOOMLENS" });
    const waiting = play(attacker, pokemon("foe", "opponent"), 90);
    expect(waiting.events.some((event) => event.type === "damageApplied")).toBe(true);
    const foe = pokemon("foe", "opponent", { moves: [{ move: normal, pp: 10 }] });
    const attempted = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [foe] }),
      { player: use.player, opponent: { kind: "move", moveIndex: 0 } }, rng(90));
    expect(attempted.events).toContainEqual({ type: "moveMissed", side: "player",
      move: normal.internalName });
    const slowAttacker = pokemon("user", "player", { heldItem: "ZOOMLENS",
      stats: { ...attacker.stats, speed: 40 } });
    const alreadyMoved = resolveTeamTurn(createTeamBattleState({ player: [slowAttacker], opponent: [foe] }),
      { player: use.player, opponent: { kind: "move", moveIndex: 0 } }, rng(90));
    expect(alreadyMoved.events.some((event) => event.type === "damageApplied"
      && event.source === "player")).toBe(true);
  });

  it("applies Zoom Lens only to the chosen target in Duo", () => {
    const attacker = pokemon("p1", "player", { heldItem: "ZOOMLENS" });
    const state = createDoubleTeamBattleState({ player: [attacker, pokemon("p2", "player")],
      opponent: [pokemon("o1", "opponent"), pokemon("o2", "opponent")] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng(90));
    expect(result.state.teams.opponent.members[0]!.hp).toBe(200);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(200);
  });

  it.each([
    ["RAZORCLAW", "EEVEE", 8], ["STICK", "FARFETCHD", 2],
    ["STICK", "SIRFETCHD", 2], ["LUCKYPUNCH", "CHANSEY", 2],
    ["STICK", "EEVEE", 16], ["LUCKYPUNCH", "EEVEE", 16],
  ] as const)("sets the source critical bracket for %s on %s", (item, species, expected) => {
    const attacker = pokemon("user", "player", { species, heldItem: item });
    const trace: BattleTrace[] = [];
    calculateDamage("player", attacker, pokemon("foe", "opponent"), normal, rng(), trace);
    expect(trace).toContainEqual(expect.objectContaining({ type: "rng", purpose: "critical",
      maxExclusive: expected }));
  });

  it("lets Focus Band save a full-HP holder on its 10 percent roll without consuming it", () => {
    const lethal: BattleMove = { ...normal, power: 500, accuracy: 0 };
    const attacker = pokemon("user", "player", { moves: [{ move: lethal, pp: 10 }] });
    const defender = pokemon("foe", "opponent", { heldItem: "FOCUSBAND" });
    const survive = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [defender] }),
      use, { nextInt: () => 0 });
    expect(survive.state.teams.opponent.members[0]).toMatchObject({ hp: 1, heldItem: "FOCUSBAND" });
    expect(survive.events).toContainEqual(expect.objectContaining({ type: "itemActivated",
      item: "FOCUSBAND", effect: "survive" }));
    expect(survive.trace).toContainEqual(expect.objectContaining({ type: "rng",
      purpose: "focus-band", maxExclusive: 10, value: 0 }));
    const fail = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [defender] }),
      use, { nextInt: (max) => max === 10 ? 9 : 0 });
    expect(fail.state.teams.opponent.members[0]!.hp).toBe(0);
    expect(fail.state.teams.opponent.members[0]!.heldItem).toBe("FOCUSBAND");
    const wounded = resolveTeamTurn(createTeamBattleState({ player: [attacker],
      opponent: [{ ...defender, hp: 100 }] }), use, { nextInt: () => 0 });
    expect(wounded.trace.some((entry) => entry.type === "rng" && entry.purpose === "focus-band"))
      .toBe(false);
    const suppressed = resolveTeamTurn({
      ...createTeamBattleState({ player: [attacker], opponent: [defender] }),
      effects: { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
        opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
      waterSportTurns: 0, magicRoomTurns: 2 },
    }, use, { nextInt: () => 0 });
    expect(suppressed.state.teams.opponent.members[0]!.hp).toBe(0);
  });
});
