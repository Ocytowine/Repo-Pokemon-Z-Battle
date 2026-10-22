import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, resolveDoubleTeamTurn, resolveTurn,
  type BattleMove, type BattleSide, type BattleState, type BattleTrace, type BattlerState,
  type RandomSource } from "../src/index.js";

const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };
const zeroRolls: RandomSource = { nextInt: () => 0 };

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id: side, species: side === "player" ? "EEVEE" : "MEOWTH", name: side, level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 240, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides,
  };
}

function classifiedMove(flags: string, overrides: Partial<BattleMove> = {}): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "CLASSIFIED", name: "Classifiée",
    accuracy: 0, power: 80, flags, ...overrides };
}

function battle(player: BattlerState, opponent: BattlerState): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

function actions() {
  return { player: { kind: "move" as const, moveIndex: 0 },
    opponent: { kind: "move" as const, moveIndex: 0 } };
}

describe("Pokemon Z move-classification abilities", () => {
  it("lets Bulletproof block bomb-flagged moves after PP use and lets Mold Breaker bypass it", () => {
    const bomb = classifiedMove("n");
    const defender = battler("opponent", { ability: "BULLETPROOF" });
    const player = battler("player", { moves: [{ move: bomb, pp: bomb.pp }] });
    const blocked = resolveTurn(battle(player, defender), actions(), highRolls);
    expect(blocked.state.battlers.opponent.hp).toBe(240);
    expect(blocked.state.battlers.player.moves[0]!.pp).toBe(bomb.pp - 1);
    expect(blocked.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "BULLETPROOF", effect: "block-move" });

    const bypassed = resolveTurn(battle({ ...player, ability: "MOLDBREAKER" }, defender), actions(), highRolls);
    expect(bypassed.state.battlers.opponent.hp).toBeLessThan(240);
  });

  it("keeps a bomb spread move active against the non-Bulletproof double target", () => {
    const bomb = classifiedMove("n", { targetCode: "04" });
    const state = createDoubleTeamBattleState({
      player: [battler("player", { moves: [{ move: bomb, pp: bomb.pp }] }),
        { ...battler("player"), id: "player-partner" }],
      opponent: [battler("opponent", { ability: "BULLETPROOF" }),
        { ...battler("opponent"), id: "open-target" }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(240);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(240);
  });

  it("applies both Punk Rock sound multipliers and lets Mold Breaker bypass only the defensive one", () => {
    const sound = classifiedMove("k", { category: "Special" });
    const neutral = calculateDamage("player", battler("player"), battler("opponent"), sound, highRolls, []);
    const attackTrace: BattleTrace[] = [];
    const boosted = calculateDamage("player", battler("player", { ability: "PUNKROCK" }),
      battler("opponent"), sound, highRolls, attackTrace);
    expect(boosted).toBeGreaterThan(neutral);
    expect(attackTrace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "PUNKROCK", multiplier: 1.3 }]) }));

    const defenseTrace: BattleTrace[] = [];
    const reduced = calculateDamage("player", battler("player"),
      battler("opponent", { ability: "PUNKROCK" }), sound, highRolls, defenseTrace);
    expect(reduced).toBeLessThan(neutral);
    expect(defenseTrace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "PUNKROCK", multiplier: 0.5 }]) }));
    expect(calculateDamage("player", battler("player", { ability: "MOLDBREAKER" }),
      battler("opponent", { ability: "PUNKROCK" }), sound, highRolls, [])).toBe(neutral);
  });

  it("converts Normal to Ice without a power bonus and gives Voz Valquiria sound moves flinch", () => {
    const voice = classifiedMove("k", { internalName: "HYPERVOICE", type: "NORMAL", category: "Special" });
    const dragon = battler("opponent", { types: ["DRAGON"] });
    const trace: BattleTrace[] = [];
    calculateDamage("player", battler("player", { ability: "VOZVALQUIRIA" }), dragon,
      voice, highRolls, trace);
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage", effectiveness: 2,
      abilityModifiers: expect.not.arrayContaining([{ ability: "VOZVALQUIRIA", multiplier: 1.2 }]) }));

    const result = resolveTurn(battle(
      battler("player", { ability: "VOZVALQUIRIA", moves: [{ move: voice, pp: voice.pp }] }), dragon),
    actions(), zeroRolls);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "VOZVALQUIRIA", effect: "inflict-flinch" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "actionSkipped",
      side: "opponent", reason: "flinch" }));
  });

  it("uses flag h for both the critical stage and Penetrante's flinch", () => {
    const highCritical = classifiedMove("h", { internalName: "SLASH" });
    const trace: BattleTrace[] = [];
    calculateDamage("player", battler("player"), battler("opponent"), highCritical, highRolls, trace);
    expect(trace).toContainEqual({ type: "rng", purpose: "critical", maxExclusive: 8, value: 7 });

    const result = resolveTurn(battle(
      battler("player", { ability: "PENETRANTE",
        moves: [{ move: highCritical, pp: highCritical.pp }] }), battler("opponent")),
    actions(), zeroRolls);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "PENETRANTE", effect: "inflict-flinch" });
  });

  it.each(["PENETRANTE", "VOZVALQUIRIA"] as const)("lets Shield Dust plus Covert Cloak block %s flinch", (ability) => {
    const move = classifiedMove(ability === "PENETRANTE" ? "h" : "k");
    const target = battler("opponent", { ability: "SHIELDDUST", heldItem: "COVERTCLOAK" });
    const result = resolveTurn(battle(
      battler("player", { ability, moves: [{ move, pp: move.pp }] }), target), actions(), zeroRolls);
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated", ability }));
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "volatileApplied", effect: "flinch" }));
  });
});
