import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const punch: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TESTPUNCH",
  flags: "aj", accuracy: 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: punch, pp: punch.pp }], ...overrides };
}

describe("Pokemon Z Punching Glove", () => {
  it("boosts punches and removes contact reactions only while active", () => {
    const attacker = pokemon("user", "player", { heldItem: "PUNCHINGGLOVE" });
    const defender = pokemon("foe", "opponent", { heldItem: "ROCKYHELMET" });
    const bareDamage = calculateDamage("player", { ...attacker, heldItem: null }, defender, punch, rng, []);
    const gloveDamage = calculateDamage("player", attacker, defender, punch, rng, []);
    expect(gloveDamage).toBeGreaterThan(bareDamage);
    const normal = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [defender] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(normal.events.some((event) => event.type === "itemActivated" && event.item === "ROCKYHELMET"))
      .toBe(false);
    const embargoed = { ...attacker,
      volatile: { embargoTurns: 2 } as BattlerState["volatile"] };
    const inactive = resolveTeamTurn(createTeamBattleState({ player: [embargoed], opponent: [defender] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(inactive.events).toContainEqual(expect.objectContaining({ type: "itemActivated",
      item: "ROCKYHELMET" }));
    expect(calculateDamage("player", attacker, defender, punch, rng, [],
      { magicRoomTurns: 2 })).toBe(bareDamage);
  });

  it("protects only the punching slot from contact reactions in Duo", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", { heldItem: "PUNCHINGGLOVE" }), pokemon("p2", "player")],
      opponent: [pokemon("o1", "opponent", { heldItem: "ROCKYHELMET" }),
        pokemon("o2", "opponent", { heldItem: "ROCKYHELMET" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members[0]!.hp).toBe(200);
    expect(result.state.teams.player.members[1]!.hp).toBeLessThan(200);
  });

  it("avoids King's Shield's contact penalty for a protected punch", () => {
    const guarded = pokemon("foe", "opponent", { volatile: {
      protected: true, kingsShield: true,
    } as BattlerState["volatile"] });
    const strike = (heldItem: BattlerState["heldItem"]) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", "player", { heldItem })], opponent: [guarded],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(strike("PUNCHINGGLOVE").state.teams.player.members[0]!.stages.attack).toBe(0);
    expect(strike(null).state.teams.player.members[0]!.stages.attack).toBeLessThan(0);
  });
});
