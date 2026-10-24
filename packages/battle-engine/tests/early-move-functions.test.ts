import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const low: RandomSource = { nextInt: () => 0 };
const high: RandomSource = { nextInt: (max) => max - 1 };
const move = (code: BattleMove["functionCode"], category: BattleMove["category"] = "Physical"):
  BattleMove => ({ ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
    category, power: category === "Status" ? 0 : 65, accuracy: 100,
    effectChance: 0, targetCode: category === "Status" ? "10" : "00" });
function battler(side: BattleSide, selected: BattleMove): BattlerState {
  return { id: side, species: "EEVEE", name: side, level: 50, types: ["NORMAL"],
    stats: { maxHp: 1000, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 1000, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: selected, pp: 10 }] };
}
const actions = { player: { kind: "move" as const, moveIndex: 0 }, opponent: { kind: "wait" as const } };
const use = (user: BattlerState, target = battler("opponent", move("000")), rng = low,
  weather?: "hail" | "rain" | "sun") => resolveTeamTurn({
    ...createTeamBattleState({ player: [user], opponent: [target] }),
    ...(weather === undefined ? {} : { effects: { weather, waterSportTurns: 0,
      sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
        opponent: { reflectTurns: 0, luckyChantTurns: 0 } } } }),
  }, actions, rng);

describe("early move function batch", () => {
  it("Struggle ignores Ghost immunity, works at zero PP and recoils by a quarter of maximum HP", () => {
    const struggle = { ...move("002"), type: "NORMAL", accuracy: 0, power: 50 };
    const user = { ...battler("player", struggle), moves: [{ move: struggle, pp: 0 }] };
    const target = { ...battler("opponent", move("000")), types: ["GHOST"] };
    const result = use(user, target);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(1000);
    expect(result.state.teams.player.members[0]!.hp).toBe(750);
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(0);
  });

  it.each([["00B", "burn"], ["00E", "frozen"]] as const)(
    "%s rolls its status and flinch independently", (code, status) => {
      const result = use(battler("player", { ...move(code), effectChance: 10 }));
      expect(result.state.teams.opponent.members[0]?.majorStatus?.kind).toBe(status);
      expect(result.events.some((event) => event.type === "volatileApplied" && event.effect === "flinch")).toBe(true);
      expect(result.trace.filter((entry) => entry.type === "rng" && entry.purpose === "additional-effect").length)
        .toBeGreaterThanOrEqual(2);
    });

  it("Blizzard always hits in hail and Hurricane always hits in rain but drops to 50% in sun", () => {
    const blizzard = { ...move("00D", "Special"), accuracy: 70, effectChance: 10, type: "ICE" };
    const hurricane = { ...move("015", "Special"), accuracy: 70, effectChance: 30, type: "FLYING" };
    expect(use(battler("player", blizzard), battler("opponent", move("000")), high, "hail")
      .events.some((event) => event.type === "damageApplied")).toBe(true);
    expect(use(battler("player", hurricane), battler("opponent", move("000")), high, "rain")
      .events.some((event) => event.type === "damageApplied")).toBe(true);
    expect(use(battler("player", hurricane), battler("opponent", move("000")), high, "sun")
      .events.some((event) => event.type === "moveMissed")).toBe(true);
  });

  it("Snore requires sleep and can attack during it", () => {
    const snore = { ...move("011", "Special"), effectChance: 30 };
    expect(use(battler("player", snore)).events).toContainEqual({ type: "moveFailed", side: "player",
      move: "011", reason: "condition" });
    const asleep = { ...battler("player", snore), majorStatus: { kind: "sleep" as const, turnsRemaining: 3 } };
    const result = use(asleep);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(1000);
    expect(result.state.teams.player.members[0]?.majorStatus).toEqual({ kind: "sleep", turnsRemaining: 2 });
  });

  it("Chatter confuses after a damaging hit even when source effectChance is zero", () => {
    const chatter = { ...move("014", "Special"), effectChance: 0, type: "FLYING" };
    const result = use(battler("player", chatter), battler("opponent", move("000")), high);
    expect(result.state.teams.opponent.members[0]?.volatile?.confusionTurns).toBeGreaterThan(0);
  });

  it("Refresh cures burn but fails without a curable status", () => {
    const refresh = move("018", "Status");
    const burned = { ...battler("player", refresh), majorStatus: { kind: "burn" as const } };
    expect(use(burned).state.teams.player.members[0]?.majorStatus).toBeNull();
    expect(use(battler("player", refresh)).events).toContainEqual({ type: "moveFailed", side: "player",
      move: "018", reason: "condition" });
  });

  it("Safeguard lasts five turns and Psycho Shift transfers a valid status", () => {
    const guard = { ...move("01A", "Status"), targetCode: "40" };
    const first = use(battler("player", guard));
    expect(first.state.effects?.sides.player.safeguardTurns).toBe(4);
    const repeated = resolveTeamTurn(first.state, actions, low);
    expect(repeated.events).toContainEqual({ type: "moveFailed", side: "player",
      move: "01A", reason: "condition" });
    const shift = { ...move("01B", "Status"), targetCode: "00", accuracy: 100 };
    const poisoned = { ...battler("player", shift),
      majorStatus: { kind: "poison" as const, toxicCounter: 0 } };
    const transferred = use(poisoned);
    expect(transferred.state.teams.player.members[0]?.majorStatus).toBeNull();
    expect(transferred.state.teams.opponent.members[0]?.majorStatus?.kind).toBe("poison");
    const burned = { ...battler("player", shift), majorStatus: { kind: "burn" as const } };
    const fireTarget = { ...battler("opponent", move("000")), types: ["FIRE"] };
    const blocked = use(burned, fireTarget);
    expect(blocked.state.teams.player.members[0]?.majorStatus?.kind).toBe("burn");
    expect(blocked.state.teams.opponent.members[0]?.majorStatus).toBeNull();
  });

  it("shares Safeguard across both active allies in double after snapshot restoration", () => {
    const guard = { ...move("01A", "Status"), targetCode: "40" };
    const initial = createDoubleTeamBattleState({
      player: [battler("player", guard), { ...battler("player", move("000")), id: "ally" }],
      opponent: [battler("opponent", move("000")), { ...battler("opponent", move("000")), id: "enemy2" }],
    });
    const result = resolveDoubleTeamTurn(JSON.parse(JSON.stringify(initial)) as typeof initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], low);
    expect(result.state.effects?.sides.player.safeguardTurns).toBe(4);
  });
});
