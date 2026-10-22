import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState, type RandomSource } from "../src/index.js";

const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.SWIFT : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides,
  };
}

function move(type: string): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: `TEST${type}`, name: type,
    type, category: "Special", power: 80, accuracy: 0 };
}

function damage(usedMove: BattleMove, activeAbilities: readonly NonNullable<BattlerState["ability"]>[],
  attackerAbility: BattlerState["ability"] = null): { readonly value: number; readonly trace: BattleTrace[] } {
  const trace: BattleTrace[] = [];
  return { value: calculateDamage("player", pokemon("attacker", "player", { ability: attackerAbility }),
    pokemon("target", "opponent"), usedMove, highRolls, trace,
    { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false,
      activeAbilities }), trace };
}

function doubleActions(target: { readonly side: BattleSide; readonly slot: number }) {
  return [
    { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0, target } },
    { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
    { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
    { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
  ];
}

describe("global aura abilities", () => {
  it.each([
    ["DARKAURA", "DARK"],
    ["FAIRYAURA", "FAIRY"],
    ["AURADORADA", "ELECTRIC"],
  ] as const)("lets %s boost every active battler's %s damage by 4/3", (ability, type) => {
    const usedMove = move(type);
    const neutral = damage(usedMove, []);
    const boosted = damage(usedMove, [ability]);
    expect(boosted.value).toBeGreaterThan(neutral.value);
    expect(boosted.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability, multiplier: 4 / 3 }]) }));
    expect(damage(move("WATER"), [ability]).value).toBe(damage(move("WATER"), []).value);
  });

  it("does not stack duplicate auras and lets Aura Break reverse them to 2/3", () => {
    const dark = move("DARK");
    expect(damage(dark, ["DARKAURA", "DARKAURA"]).value).toBe(damage(dark, ["DARKAURA"]).value);
    const neutral = damage(dark, []);
    const reversed = damage(dark, ["DARKAURA", "AURABREAK"]);
    expect(reversed.value).toBeLessThan(neutral.value);
    expect(reversed.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "AURABREAK", multiplier: 2 / 3 }]) }));
    expect(damage(dark, ["DARKAURA", "AURABREAK"], "MOLDBREAKER").value).toBe(reversed.value);
    expect(damage(dark, ["AURABREAK"]).value).toBe(neutral.value);
  });

  it("derives a global aura from any active side in a positioned double battle", () => {
    const dark = move("DARK");
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: dark, pp: dark.pp }] }),
        pokemon("ally", "player")],
      opponent: [pokemon("target", "opponent"), pokemon("aura", "opponent", { ability: "DARKAURA" })],
    });
    const result = resolveDoubleTeamTurn(state, doubleActions({ side: "opponent", slot: 0 }), highRolls);
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "DARKAURA", multiplier: 4 / 3 }]) }));
  });

  it("drops an aura when its active holder is knocked out earlier in the round", () => {
    const dark = move("DARK");
    const knockout = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, power: 250 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { stats: { ...pokemon("attacker", "player").stats, speed: 100 },
        moves: [{ move: dark, pp: dark.pp }] }),
      pokemon("aura", "player", { ability: "DARKAURA", hp: 1 })],
      opponent: [pokemon("fast", "opponent", { stats: { ...pokemon("fast", "opponent").stats,
        attack: 500, speed: 150 }, moves: [{ move: knockout, pp: knockout.pp }] }),
      pokemon("other", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 1 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    expect(result.state.teams.player.members[1]!.hp).toBe(0);
    const darkTrace = result.trace.find((entry) => entry.type === "damage" && entry.move === dark.internalName);
    expect(darkTrace).toMatchObject({ abilityModifiers: expect.not.arrayContaining([
      { ability: "DARKAURA", multiplier: 4 / 3 },
    ]) });
  });

  it("drops an opposing aura when its holder switches out before a simple-battle attack", () => {
    const dark = move("DARK");
    const state = createTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: dark, pp: dark.pp }] })],
      opponent: [pokemon("aura", "opponent", { ability: "DARKAURA" }), pokemon("reserve", "opponent")],
    });
    const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "switch", teamIndex: 1 } }, highRolls);
    const darkTrace = result.trace.find((entry) => entry.type === "damage" && entry.move === dark.internalName);
    expect(darkTrace).toMatchObject({ abilityModifiers: expect.not.arrayContaining([
      { ability: "DARKAURA", multiplier: 4 / 3 },
    ]) });
  });
});
