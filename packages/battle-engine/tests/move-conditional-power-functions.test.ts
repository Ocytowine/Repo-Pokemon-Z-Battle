import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattlerState,
  type MajorStatusState, type RandomSource } from "../src/index.js";

const stableRng: RandomSource = { nextInt: (maxExclusive) => Math.max(0, maxExclusive - 1) };

function pokemon(id: string, move: BattleMove, speed = 50,
  overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"], hp: 200,
    stats: { maxHp: 200, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides };
}

function move(code: "07C" | "07D" | "07E" | "07F" | "080" | "081", power = 40): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, id: 1900 + Number.parseInt(code, 16),
    internalName: `MOVE${code}`, name: code, functionCode: code, power, accuracy: 0 };
}

function status(kind: MajorStatusState["kind"]): MajorStatusState {
  return kind === "sleep" ? { kind, turnsRemaining: 2 }
    : kind === "poison" ? { kind, toxicCounter: null } : { kind };
}

function damage(attacker: BattlerState, defender: BattlerState, attack: BattleMove): number {
  return calculateDamage("player", attacker, defender, attack, stableRng, []);
}

describe("Pokemon Z conditional power functions", () => {
  it.each([
    ["07C", null, "paralysis", 200],
    ["07D", null, "sleep", 200],
    ["07E", "poison", null, 200],
    ["07F", null, "hemorrhage", 200],
    ["080", null, null, 100],
  ] as const)("%s uses the same source power as an explicitly doubled move",
    (code, attackerStatus, defenderStatus, defenderHp) => {
      const conditional = move(code);
      const attacker = pokemon("attacker", conditional, 50, {
        majorStatus: attackerStatus === null ? null : status(attackerStatus),
      });
      const defender = pokemon("defender", MINIMAL_MOVE_CATALOG.TACKLE, 40, {
        hp: defenderHp, majorStatus: defenderStatus === null ? null : status(defenderStatus),
      });
      const doubled = { ...conditional, functionCode: "000" as const, power: conditional.power * 2 };
      expect(damage(attacker, defender, conditional)).toBe(damage(attacker, defender, doubled));
    });

  it("Facade doubles for burn without applying the ordinary physical burn penalty", () => {
    const facade = move("07E");
    const burned = pokemon("burned", facade, 50, { majorStatus: status("burn") });
    const poisoned = pokemon("poisoned", facade, 50, { majorStatus: status("poison") });
    const defender = pokemon("defender", MINIMAL_MOVE_CATALOG.TACKLE);
    expect(damage(burned, defender, facade)).toBe(damage(poisoned, defender, facade));
  });

  it.each(["07C", "07D", "07E", "07F", "080"] as const)(
    "%s keeps ordinary power when its condition is absent", (code) => {
      const conditional = move(code);
      const attacker = pokemon("attacker", conditional);
      const defender = pokemon("defender", MINIMAL_MOVE_CATALOG.TACKLE, 40, { hp: 101 });
      const ordinary = { ...conditional, functionCode: "000" as const };
      expect(damage(attacker, defender, conditional)).toBe(damage(attacker, defender, ordinary));
    });

  it.each([["07C", "paralysis"], ["07D", "sleep"]] as const)(
    "%s cures %s only after real non-KO damage", (code, kind) => {
      const attack = move(code, 10);
      const state = createTeamBattleState({ player: [pokemon("user", attack, 100)],
        opponent: [pokemon("target", MINIMAL_MOVE_CATALOG.TACKLE, 50,
          { majorStatus: status(kind) })] });
      const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "wait" } }, stableRng);
      expect(result.state.teams.opponent.members[0]!.majorStatus).toBeNull();
      expect(result.events).toContainEqual({ type: "statusCured", side: "opponent", status: kind });

      const knockout = createTeamBattleState({ player: [pokemon("user", attack, 100)],
        opponent: [pokemon("target", MINIMAL_MOVE_CATALOG.TACKLE, 50,
          { hp: 1, majorStatus: status(kind) })] });
      const knockedOut = resolveTeamTurn(knockout, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "wait" } }, stableRng);
      expect(knockedOut.state.teams.opponent.members[0]!.majorStatus).toEqual(status(kind));
      expect(knockedOut.events).not.toContainEqual(expect.objectContaining({ type: "statusCured" }));
    });

  it("081 remembers every damaging attacker in doubles and boosts against the selected one", () => {
    const revenge = move("081", 20);
    const reference = { ...revenge, functionCode: "000" as const, power: 40 };
    const run = (selectedMove: BattleMove) => resolveDoubleTeamTurn(createDoubleTeamBattleState({
      player: [pokemon("user", selectedMove, 20), pokemon("ally", MINIMAL_MOVE_CATALOG.TACKLE, 10)],
      opponent: [pokemon("first", MINIMAL_MOVE_CATALOG.TACKLE, 100),
        pokemon("last", MINIMAL_MOVE_CATALOG.TACKLE, 90)],
    }), [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
    ], stableRng);
    const result = run(revenge);
    const expected = run(reference);
    expect(result.state.teams.player.members[0]!.volatile?.retaliation?.attackers)
      .toEqual(["first", "last"]);
    expect(result.state.teams.opponent.members[0]!.hp)
      .toBe(expected.state.teams.opponent.members[0]!.hp);
  });

  it("081 does not reuse an attacker from an earlier turn", () => {
    const revenge = move("081", 20);
    const ordinary = { ...revenge, functionCode: "000" as const };
    const run = (selectedMove: BattleMove) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", selectedMove, 100, { volatile: { retaliation: {
        turn: 0, attackers: ["target"], last: { amount: 10, attackerId: "target" },
      } } as BattlerState["volatile"] })],
      opponent: [pokemon("target", MINIMAL_MOVE_CATALOG.TACKLE, 50)],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, stableRng);
    expect(run(revenge).state.teams.opponent.members[0]!.hp)
      .toBe(run(ordinary).state.teams.opponent.members[0]!.hp);
  });
});
