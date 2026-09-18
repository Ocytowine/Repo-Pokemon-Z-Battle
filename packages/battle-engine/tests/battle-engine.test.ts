import { describe, expect, it } from "vitest";
import {
  MINIMAL_MOVE_CATALOG,
  SeededRandom,
  calculateDamage,
  resolveTurn,
  typeEffectiveness,
  type BattleSide,
  type BattleState,
  type BattleTrace,
  type BattlerState,
  type RandomSource,
} from "../src/index.js";

class ScriptedRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: readonly number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) {
      throw new Error(`Missing or invalid scripted RNG value for nextInt(${maxExclusive}).`);
    }
    return value;
  }
}

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id: side,
    species: side === "player" ? "EEVEE" : "MEOWTH",
    name: side,
    level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: side === "player" ? 100 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 100,
    majorStatus: null,
    ability: null,
    heldItem: null,
    moves: [{ move, pp: move.pp }],
    ...overrides,
  };
}

function battle(player = battler("player"), opponent = battler("opponent")): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

describe("Pokemon Z reference calculations", () => {
  it("matches the neutral level 50 damage formula, variance and STAB", () => {
    const trace: BattleTrace[] = [];
    const damage = calculateDamage(
      "player",
      battler("player"),
      battler("opponent"),
      MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([1, 15]),
      trace,
    );

    expect(damage).toBe(29);
    expect(trace.at(-1)).toMatchObject({ type: "damage", baseDamage: 19, critical: false, variance: 100, stab: 1.5, effectiveness: 1, result: 29 });
  });

  it("matches STAB and super-effective rounding for Water Gun", () => {
    const attacker = battler("player", { types: ["WATER"] });
    const defender = battler("opponent", { types: ["FIRE"] });
    const damage = calculateDamage("player", attacker, defender, MINIMAL_MOVE_CATALOG.WATERGUN, new ScriptedRandom([1, 15]), []);
    expect(damage).toBe(64);
  });

  it("supports weaknesses, dual-type multipliers and immunities from types.txt", () => {
    expect(typeEffectiveness("WATER", ["FIRE", "ROCK"])).toBe(4);
    expect(typeEffectiveness("NORMAL", ["GHOST"])).toBe(0);
    expect(typeEffectiveness("GRASS", ["FIRE", "ROCK"])).toBe(1);
  });

  it("matches the default 1/16 critical hit and 1.5 multiplier", () => {
    const attacker = battler("player", { stages: { ...battler("player").stages, attack: -6 } });
    const defender = battler("opponent", { stages: { ...battler("opponent").stages, defense: 6 } });
    const damage = calculateDamage("player", attacker, defender, MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([0, 15]), []);
    expect(damage).toBe(44);
  });
});

describe("resolveTurn", () => {
  it("uses move priority before speed and skips a fainted battler", () => {
    const quickAttack = MINIMAL_MOVE_CATALOG.QUICKATTACK;
    const player = battler("player", {
      stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 1 },
      moves: [{ move: quickAttack, pp: quickAttack.pp }],
    });
    const opponent = battler("opponent", { hp: 1 });
    const result = resolveTurn(battle(player, opponent), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([99, 1, 15]));

    expect(result.events).toContainEqual({ type: "actionOrdered", order: ["player", "opponent"] });
    expect(result.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "fainted" });
    expect(result.state).toMatchObject({ status: "finished", winner: "player", turn: 2 });
    expect(result.state.battlers.opponent.hp).toBe(0);
  });

  it("draws a speed tie exactly like Pokemon Z", () => {
    const opponent = battler("opponent", { stats: { ...battler("opponent").stats, speed: 100 } });
    const result = resolveTurn(battle(battler("player"), opponent), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([0, 99, 1, 15, 99, 1, 15]));
    expect(result.events[1]).toEqual({ type: "actionOrdered", order: ["opponent", "player"] });
    expect(result.trace[2]).toEqual({ type: "rng", purpose: "speed-tie", maxExclusive: 2, value: 0 });
  });

  it("does not consume an accuracy draw for a move whose accuracy is zero", () => {
    const swift = MINIMAL_MOVE_CATALOG.SWIFT;
    const player = battler("player", { moves: [{ move: swift, pp: swift.pp }] });
    const result = resolveTurn(battle(player), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([1, 15, 99, 1, 15]));
    const purposes = result.trace.filter((entry) => entry.type === "rng").map((entry) => entry.purpose);
    expect(purposes).toEqual(["critical", "damage-variance", "accuracy", "critical", "damage-variance"]);
  });

  it("is reproducible with the same seed and does not mutate its input", () => {
    const initial = battle();
    const snapshot = structuredClone(initial);
    const actions = { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } } as const;
    const first = resolveTurn(initial, actions, new SeededRandom(0x5eed));
    const second = resolveTurn(initial, actions, new SeededRandom(0x5eed));
    expect(first).toEqual(second);
    expect(initial).toEqual(snapshot);
  });

  it("spends PP on a miss and exposes every RNG draw", () => {
    const inaccurate = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 50 };
    const player = battler("player", { moves: [{ move: inaccurate, pp: 1 }] });
    const result = resolveTurn(battle(player), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([50, 99, 1, 15]));
    expect(result.events).toContainEqual({ type: "moveMissed", side: "player", move: "TACKLE" });
    expect(result.state.battlers.player.moves[0]?.pp).toBe(0);
  });

  it("exposes presentation-relevant damage facts as domain data", () => {
    const waterGun = MINIMAL_MOVE_CATALOG.WATERGUN;
    const player = battler("player", { types: ["WATER"], moves: [{ move: waterGun, pp: waterGun.pp }] });
    const opponent = battler("opponent", { types: ["FIRE"] });
    const result = resolveTurn(battle(player, opponent), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([99, 0, 15, 99, 1, 15]));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "damageApplied", source: "player", critical: true, effectiveness: 2 }));
  });
});

describe("major statuses from Pokemon Z", () => {
  it("applies regular poison and its 1/12 end-of-turn damage", () => {
    const poisonPowder = MINIMAL_MOVE_CATALOG.POISONPOWDER;
    const player = battler("player", { moves: [{ move: poisonPowder, pp: poisonPowder.pp }] });
    const result = resolveTurn(
      battle(player),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 99, 1, 15]),
    );

    expect(result.state.battlers.opponent.majorStatus).toEqual({ kind: "poison", toxicCounter: null });
    expect(result.events).toContainEqual({ type: "statusApplied", source: "player", target: "opponent", status: "poison" });
    expect(result.events).toContainEqual({ type: "statusDamage", side: "opponent", status: "poison", amount: 8, hp: 92 });
  });

  it("uses the fangame burn modifier and residual damage", () => {
    const burned = battler("player", { majorStatus: { kind: "burn" } });
    const trace: BattleTrace[] = [];
    expect(calculateDamage("player", burned, battler("opponent"), MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), trace)).toBe(15);
    expect(trace.at(-1)).toMatchObject({ type: "damage", statusModifier: 0.5, result: 15 });

    const result = resolveTurn(
      battle(burned),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15, 99, 1, 15]),
    );
    expect(result.events).toContainEqual(expect.objectContaining({ type: "statusDamage", side: "player", status: "burn", amount: 6 }));
  });

  it("quarters paralysis speed and consumes the explicit 25% action roll", () => {
    const paralyzed = battler("player", { majorStatus: { kind: "paralysis" } });
    const result = resolveTurn(
      battle(paralyzed),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15, 0]),
    );
    expect(result.events[1]).toEqual({ type: "actionOrdered", order: ["opponent", "player"] });
    expect(result.events).toContainEqual({ type: "actionSkipped", side: "player", reason: "paralysis" });
    expect(result.trace).toContainEqual({ type: "rng", purpose: "paralysis", maxExclusive: 4, value: 0 });
  });

  it("draws a 2-4 turn sleep duration and wakes before acting when it expires", () => {
    const sleepPowder = MINIMAL_MOVE_CATALOG.SLEEPPOWDER;
    const player = battler("player", { moves: [{ move: sleepPowder, pp: sleepPowder.pp }] });
    const first = resolveTurn(
      battle(player),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 0]),
    );
    expect(first.state.battlers.opponent.majorStatus).toEqual({ kind: "sleep", turnsRemaining: 1 });
    expect(first.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "sleep" });

    const second = resolveTurn(
      first.state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 99, 1, 15]),
    );
    expect(second.state.battlers.opponent.majorStatus).toBeNull();
    expect(second.events).toContainEqual({ type: "statusCured", side: "opponent", status: "sleep" });
  });

  it("rejects status applications blocked by an existing status or type immunity", () => {
    const thunderWave = MINIMAL_MOVE_CATALOG.THUNDERWAVE;
    const player = battler("player", { moves: [{ move: thunderWave, pp: thunderWave.pp }] });
    const electric = battler("opponent", { types: ["ELECTRIC"] });
    const result = resolveTurn(
      battle(player, electric),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 99, 1, 15]),
    );
    expect(result.events).toContainEqual({ type: "statusApplicationFailed", source: "player", target: "opponent", status: "paralysis", reason: "type-immune" });
  });

  it("applies freeze as a damaging secondary effect and halves special damage", () => {
    const iceBeam = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, effectChance: 100 };
    const player = battler("player", { moves: [{ move: iceBeam, pp: iceBeam.pp }] });
    const result = resolveTurn(
      battle(player),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15, 0, 99, 1, 15]),
    );
    expect(result.state.battlers.opponent.majorStatus).toEqual({ kind: "frozen" });
    expect(result.events).toContainEqual({ type: "statusDamage", side: "opponent", status: "frozen", amount: 6, hp: 53 });

    const frozen = battler("player", { majorStatus: { kind: "frozen" }, moves: [{ move: MINIMAL_MOVE_CATALOG.SWIFT, pp: 20 }] });
    expect(calculateDamage("player", frozen, battler("opponent"), MINIMAL_MOVE_CATALOG.SWIFT, new ScriptedRandom([1, 15]), [])).toBe(21);
  });

  it("implements Caduco below half HP and Hemorrhage critical stages", () => {
    const caduco = battler("opponent", { hp: 50, majorStatus: { kind: "caduco" } });
    const caducoTrace: BattleTrace[] = [];
    expect(calculateDamage("player", battler("player"), caduco, MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), caducoTrace)).toBe(44);
    expect(caducoTrace.at(-1)).toMatchObject({ type: "damage", statusModifier: 1.5 });

    const hemorrhage = battler("opponent", { majorStatus: { kind: "hemorrhage" } });
    const hemorrhageTrace: BattleTrace[] = [];
    calculateDamage("player", battler("player"), hemorrhage, MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), hemorrhageTrace);
    expect(hemorrhageTrace).toContainEqual({ type: "rng", purpose: "critical", maxExclusive: 2, value: 1 });

    const scopeTrace: BattleTrace[] = [];
    calculateDamage("player", battler("player", { heldItem: "SCOPELENS" }), battler("opponent"), MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([7, 15]), scopeTrace);
    expect(scopeTrace).toContainEqual({ type: "rng", purpose: "critical", maxExclusive: 8, value: 7 });

    const decayingLight = MINIMAL_MOVE_CATALOG.LUZDECADENTE;
    const applied = resolveTurn(
      battle(battler("player", { moves: [{ move: decayingLight, pp: decayingLight.pp }] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15, 99, 99, 1, 15]),
    );
    expect(applied.state.battlers.opponent.majorStatus).toEqual({ kind: "caduco" });
  });

  it("runs Guts, Quick Feet and Magic Guard through their dedicated hooks", () => {
    const guts = battler("player", { ability: "GUTS", majorStatus: { kind: "burn" } });
    const gutsTrace: BattleTrace[] = [];
    expect(calculateDamage("player", guts, battler("opponent"), MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), gutsTrace)).toBe(42);
    expect(gutsTrace.at(-1)).toMatchObject({ type: "damage", attack: 150, statusModifier: 1 });

    const quickFeet = battler("player", { ability: "QUICKFEET", majorStatus: { kind: "paralysis" } });
    const quickResult = resolveTurn(
      battle(quickFeet),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 99, 1, 15, 99, 1, 15]),
    );
    expect(quickResult.events[1]).toEqual({ type: "actionOrdered", order: ["player", "opponent"] });
    expect(quickResult.trace).toContainEqual({ type: "order", side: "player", priority: 0, speed: 150 });

    const guarded = battler("player", { ability: "MAGICGUARD", majorStatus: { kind: "burn" } });
    const guardedResult = resolveTurn(
      battle(guarded),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15, 99, 1, 15]),
    );
    expect(guardedResult.events.some((event) => event.type === "statusDamage" && event.side === "player")).toBe(false);
  });
});

describe("stat stages, power abilities and held battle items", () => {
  it("applies self boosts and opponent drops from status moves", () => {
    const howl = MINIMAL_MOVE_CATALOG.HOWL;
    const growl = MINIMAL_MOVE_CATALOG.GROWL;
    const player = battler("player", { moves: [{ move: howl, pp: howl.pp }] });
    const opponent = battler("opponent", { moves: [{ move: growl, pp: growl.pp }] });
    const result = resolveTurn(
      battle(player, opponent),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0]),
    );

    expect(result.state.battlers.player.stages.attack).toBe(0);
    expect(result.events).toContainEqual({ type: "statStageChanged", source: "player", target: "player", stat: "attack", delta: 1, stage: 1 });
    expect(result.events).toContainEqual({ type: "statStageChanged", source: "opponent", target: "player", stat: "attack", delta: -1, stage: 0 });
  });

  it("runs damaging stat effects through their PBS chance and clamps stages", () => {
    const flameCharge = MINIMAL_MOVE_CATALOG.FLAMECHARGE;
    const boosted = battler("player", {
      stages: { ...battler("player").stages, speed: 6 },
      moves: [{ move: flameCharge, pp: flameCharge.pp }],
    });
    const result = resolveTurn(
      battle(boosted),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15, 0, 99, 1, 15]),
    );

    expect(result.state.battlers.player.stages.speed).toBe(6);
    expect(result.events).toContainEqual({ type: "statStageChangeFailed", source: "player", target: "player", stat: "speed", reason: "limit" });
    expect(result.trace).toContainEqual({ type: "rng", purpose: "additional-effect", maxExclusive: 100, value: 0 });
  });

  it("supports Huge Power, Pure Power, Muscle Band and Wise Glasses", () => {
    const neutralPhysical = calculateDamage("player", battler("player"), battler("opponent"), MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    const hugePower = calculateDamage("player", battler("player", { ability: "HUGEPOWER" }), battler("opponent"), MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    const purePower = calculateDamage("player", battler("player", { ability: "PUREPOWER" }), battler("opponent"), MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    const muscleBand = calculateDamage("player", battler("player", { heldItem: "MUSCLEBAND" }), battler("opponent"), MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    const neutralSpecial = calculateDamage("player", battler("player"), battler("opponent"), MINIMAL_MOVE_CATALOG.SWIFT, new ScriptedRandom([1, 15]), []);
    const wiseGlasses = calculateDamage("player", battler("player", { heldItem: "WISEGLASSES" }), battler("opponent"), MINIMAL_MOVE_CATALOG.SWIFT, new ScriptedRandom([1, 15]), []);

    expect(hugePower).toBeGreaterThan(neutralPhysical);
    expect(purePower).toBe(hugePower);
    expect(muscleBand).toBeGreaterThan(neutralPhysical);
    expect(wiseGlasses).toBeGreaterThan(neutralSpecial);
  });

  it("gives Assault Vest its special defense boost and blocks status moves", () => {
    const neutral = calculateDamage("player", battler("player"), battler("opponent"), MINIMAL_MOVE_CATALOG.SWIFT, new ScriptedRandom([1, 15]), []);
    const vested = calculateDamage("player", battler("player"), battler("opponent", { heldItem: "ASSAULTVEST" }), MINIMAL_MOVE_CATALOG.SWIFT, new ScriptedRandom([1, 15]), []);
    expect(vested).toBeLessThan(neutral);

    const howl = MINIMAL_MOVE_CATALOG.HOWL;
    const player = battler("player", { heldItem: "ASSAULTVEST", moves: [{ move: howl, pp: howl.pp }] });
    const result = resolveTurn(
      battle(player),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15]),
    );
    expect(result.events).toContainEqual({ type: "actionSkipped", side: "player", reason: "item-blocked" });
    expect(result.state.battlers.player.moves[0]?.pp).toBe(howl.pp);
  });
});
