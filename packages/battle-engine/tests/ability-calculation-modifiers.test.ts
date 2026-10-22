import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, resolveDoubleTeamTurn, resolveTurn,
  type BattleMove, type BattleSide, type BattleState, type BattleTrace, type BattlerState,
  type RandomSource } from "../src/index.js";

const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id: side, species: side === "player" ? "EEVEE" : "MEOWTH", name: side, level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides,
  };
}

function move(internalName: string, type = "FIGHTING"): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName, name: internalName,
    type, accuracy: 100, power: 80 };
}

function battle(player: BattlerState, opponent: BattlerState): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

describe("Pokemon Z calculation-only abilities", () => {
  it("uses Camorrista for exactly the ten source kicking moves", () => {
    const attacker = battler("player", { ability: "CAMORRISTA" });
    const defender = battler("opponent");
    const names = ["MEGAKICK", "LOWKICK", "ROLLINGKICK", "JUMPKICK", "HIJUMPKICK",
      "DOUBLEKICK", "TRIPLEKICK", "BLAZEKICK", "TROPKICK", "TRIPLEAXEL"];
    for (const internalName of names) {
      const trace: BattleTrace[] = [];
      calculateDamage("player", attacker, defender, move(internalName), highRolls, trace);
      expect(trace).toContainEqual(expect.objectContaining({ type: "damage",
        abilityModifiers: expect.arrayContaining([{ ability: "CAMORRISTA", multiplier: 1.2 }]) }));
    }
    const trace: BattleTrace[] = [];
    calculateDamage("player", attacker, defender, move("TACKLE"), highRolls, trace);
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage", abilityModifiers: [] }));
  });

  it("lets Realeza boost every non-Normal offensive type independently of the user's types", () => {
    const attacker = battler("player", { ability: "REALEZA", types: ["NORMAL"] });
    const defender = battler("opponent");
    const trace: BattleTrace[] = [];
    const boosted = calculateDamage("player", attacker, defender, move("EMBER", "FIRE"), highRolls, trace);
    const neutral = calculateDamage("player", { ...attacker, ability: null }, defender,
      move("EMBER", "FIRE"), highRolls, []);
    expect(boosted).toBeGreaterThan(neutral);
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "REALEZA", multiplier: 1.5 }]) }));

    const normalTrace: BattleTrace[] = [];
    calculateDamage("player", attacker, defender, move("TACKLE", "NORMAL"), highRolls, normalTrace);
    expect(normalTrace).toContainEqual(expect.objectContaining({ type: "damage", abilityModifiers: [] }));
    const unknownTrace: BattleTrace[] = [];
    calculateDamage("player", attacker, defender, move("CURSE", "QMARKS"), highRolls, unknownTrace);
    expect(unknownTrace).toContainEqual(expect.objectContaining({ type: "damage", abilityModifiers: [] }));
  });

  it("guarantees Merciless critical hits on poison before Lucky Chant but after critical immunity", () => {
    const attacker = battler("player", { ability: "MERCILESS" });
    const poisoned = battler("opponent", { majorStatus: { kind: "poison", toxicCounter: null } });
    const trace: BattleTrace[] = [];
    calculateDamage("player", attacker, poisoned, move("TACKLE", "NORMAL"), highRolls, trace,
      { reflect: false, lightScreen: false, luckyChant: true, mudSport: false, waterSport: false });
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage", critical: true }));
    expect(trace).not.toContainEqual(expect.objectContaining({ type: "rng", purpose: "critical" }));

    const armorTrace: BattleTrace[] = [];
    calculateDamage("player", attacker, { ...poisoned, ability: "BATTLEARMOR" },
      move("TACKLE", "NORMAL"), highRolls, armorTrace);
    expect(armorTrace).toContainEqual(expect.objectContaining({ type: "damage", critical: false }));
  });

  it("multiplies confused Tangled Feet evasion by 1.2 and lets Mold Breaker bypass it", () => {
    const volatile = { confusionTurns: 2, flinched: false, focusEnergy: 0, identified: false,
      disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
      bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null };
    const target = battler("opponent", { ability: "TANGLEDFEET", volatile });
    const attack = move("TACKLE", "NORMAL");
    const player = battler("player", { moves: [{ move: attack, pp: attack.pp }] });
    const tangled = resolveTurn(battle(player, target),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, highRolls);
    expect(tangled.trace).toContainEqual(expect.objectContaining({ type: "accuracy", threshold: 100 / 1.2,
      hit: false, abilityModifier: { ability: "TANGLEDFEET", multiplier: 1.2 } }));

    const bypassed = resolveTurn(battle({ ...player, ability: "MOLDBREAKER" }, target),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, highRolls);
    expect(bypassed.trace).toContainEqual(expect.objectContaining({ type: "accuracy", threshold: 100, hit: true }));
  });

  it("uses the same Camorrista calculation in a positioned double battle", () => {
    const kick = { ...move("MEGAKICK"), accuracy: 0, targetCode: "00" };
    const state = createDoubleTeamBattleState({
      player: [battler("player", { ability: "CAMORRISTA", moves: [{ move: kick, pp: kick.pp }] }),
        { ...battler("player"), id: "player-partner" }],
      opponent: [battler("opponent"), { ...battler("opponent"), id: "opponent-partner" }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "CAMORRISTA", multiplier: 1.2 }]) }));
  });
});
