import { describe, expect, it } from "vitest";
import {
  MINIMAL_MOVE_CATALOG,
  IMPLEMENTED_BATTLE_ABILITIES,
  SeededRandom,
  calculateDamage,
  resolveBattleVolatileEndOfTurn,
  resolveTurn,
  typeEffectiveness,
  type BattleMove,
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

  it("applies the Route 2 Agility function as a two-stage speed boost", () => {
    const agility: BattleMove = { id: 1, internalName: "AGILITY", name: "Hate", functionCode: "030", power: 0,
      type: "PSYCHIC", category: "Status", accuracy: 0, pp: 30, priority: 0, effectChance: 0 };
    const player = battler("player", { moves: [{ move: agility, pp: agility.pp }] });
    const result = resolveTurn(battle(player),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 1, 15]));

    expect(result.state.battlers.player.stages.speed).toBe(2);
    expect(result.events).toContainEqual({ type: "statStageChanged", source: "player", target: "player",
      stat: "speed", delta: 2, stage: 2 });
  });

  it("applies Pokemon Z Sweet Scent as a two-stage evasion drop", () => {
    const sweetScent: BattleMove = { id: 417, internalName: "SWEETSCENT", name: "Doux Parfum",
      functionCode: "048", power: 0, type: "NORMAL", category: "Status", accuracy: 0, pp: 20,
      priority: 0, effectChance: 0, targetCode: "04" };
    const player = battler("player", { moves: [{ move: sweetScent, pp: sweetScent.pp }] });
    const result = resolveTurn(battle(player),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 1, 15]));

    expect(result.state.battlers.opponent.stages.evasion).toBe(-2);
    expect(result.events).toContainEqual({ type: "statStageChanged", source: "player", target: "opponent",
      stat: "evasion", delta: -2, stage: -2 });
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

  it("applies Rivalry only when both battlers have a binary gender", () => {
    const litleo = battler("opponent", {
      level: 8,
      ability: "RIVALRY",
      appearance: { form: 0, shiny: false, gender: "female" },
      stats: { maxHp: 29, attack: 15, defense: 15, specialAttack: 17, specialDefense: 12, speed: 17 },
      stages: { ...battler("opponent").stages, attack: 4 },
    });
    const target = (gender: "male" | "female" | "genderless" | null) => battler("player", {
      level: 8,
      appearance: { form: 0, shiny: false, gender },
      stats: { maxHp: 25, attack: 16, defense: 12, specialAttack: 15, specialDefense: 14, speed: 15 },
      stages: { ...battler("player").stages, defense: -1 },
    });
    const oppositeTrace: BattleTrace[] = [];
    const sameTrace: BattleTrace[] = [];
    const genderlessTrace: BattleTrace[] = [];

    const opposite = calculateDamage("opponent", litleo, target("male"), MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([4, 3]), oppositeTrace);
    const same = calculateDamage("opponent", litleo, target("female"), MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([4, 3]), sameTrace);
    const genderless = calculateDamage("opponent", litleo, target("genderless"), MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([4, 3]), genderlessTrace);

    expect(opposite).toBe(32);
    expect(same).toBe(40);
    expect(genderless).toBe(32);
    expect(oppositeTrace.at(-1)).toMatchObject({ type: "damage", statusModifier: 1,
      abilityModifier: { ability: "RIVALRY", multiplier: 1 }, result: 32 });
    expect(sameTrace.at(-1)).toMatchObject({ type: "damage", statusModifier: 1.25,
      abilityModifier: { ability: "RIVALRY", multiplier: 1.25 }, result: 40 });
    expect(genderlessTrace.at(-1)).toMatchObject({ type: "damage", statusModifier: 1,
      abilityModifier: null, result: 32 });
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

  it("activates the starter type talents below one third HP", () => {
    const neutral = calculateDamage("player", battler("player", { types: ["GRASS"], hp: 33 }), battler("opponent"),
      MINIMAL_MOVE_CATALOG.VINEWHIP, new ScriptedRandom([1, 15]), []);
    const overgrow = calculateDamage("player", battler("player", { types: ["GRASS"], hp: 33, ability: "OVERGROW" }),
      battler("opponent"), MINIMAL_MOVE_CATALOG.VINEWHIP, new ScriptedRandom([1, 15]), []);
    expect(overgrow).toBeGreaterThan(neutral);
  });

  it("applies Floracion to Grass attacks without an HP threshold", () => {
    const floweringTrace: BattleTrace[] = [];
    const neutral = calculateDamage("player", battler("player", { types: ["FAIRY"] }), battler("opponent"),
      MINIMAL_MOVE_CATALOG.VINEWHIP, new ScriptedRandom([1, 15]), []);
    const flowering = calculateDamage("player", battler("player", { types: ["FAIRY"], ability: "FLORACION" }),
      battler("opponent"), MINIMAL_MOVE_CATALOG.VINEWHIP, new ScriptedRandom([1, 15]), floweringTrace);
    const nonGrass = calculateDamage("player", battler("player", { ability: "FLORACION" }), battler("opponent"),
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    const neutralNonGrass = calculateDamage("player", battler("player"), battler("opponent"),
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);

    expect(flowering).toBeGreaterThan(neutral);
    expect(floweringTrace.at(-1)).toMatchObject({ type: "damage",
      abilityModifier: { ability: "FLORACION", multiplier: 1.5 } });
    expect(nonGrass).toBe(neutralNonGrass);
  });

  it("doubles stat changes received by a battler with Simple", () => {
    const growl = MINIMAL_MOVE_CATALOG.GROWL;
    const player = battler("player", { moves: [{ move: growl, pp: growl.pp }] });
    const opponent = battler("opponent", { ability: "SIMPLE" });
    const result = resolveTurn(battle(player, opponent),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 0, 1, 15]));
    expect(result.state.battlers.opponent.stages.attack).toBe(-2);
    expect(result.events).toContainEqual({ type: "statStageChanged", source: "player", target: "opponent", stat: "attack", delta: -2, stage: -2 });
  });

  it("uses the source fixed-damage range for Psywave", () => {
    const psywave: BattleMove = { id: 1, internalName: "PSYWAVE", name: "Vague Psy", functionCode: "06F", power: 1,
      type: "PSYCHIC", category: "Special", accuracy: 100, pp: 15, priority: 0, effectChance: 0 };
    const trace: BattleTrace[] = [];
    expect(calculateDamage("player", battler("player", { level: 20 }), battler("opponent"), psywave,
      new ScriptedRandom([50]), trace)).toBe(20);
    expect(trace.at(-1)).toMatchObject({ type: "damage", move: "PSYWAVE", critical: false, result: 20 });
  });

  it("supports the Route 1 healing moves and passive talents", () => {
    const morningSun: BattleMove = { id: 386, internalName: "MORNINGSUN", name: "Aurore", functionCode: "0D8", power: 0,
      type: "NORMAL", category: "Status", accuracy: 0, pp: 5, priority: 0, effectChance: 0 };
    const absorb: BattleMove = { id: 210, internalName: "ABSORB", name: "Vol-Vie", functionCode: "0DD", power: 30,
      type: "GRASS", category: "Special", accuracy: 100, pp: 25, priority: 0, effectChance: 0 };
    const healer = battler("player", { hp: 20, moves: [{ move: morningSun, pp: 5 }] });
    const healed = resolveTurn(battle(healer), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 1, 15]));
    expect(healed.events).toContainEqual({ type: "hpRestored", side: "player", source: "move", move: "MORNINGSUN", amount: 50, hp: 70 });

    const draining = battler("player", { hp: 50, types: ["GRASS"], moves: [{ move: absorb, pp: 25 }] });
    const drained = resolveTurn(battle(draining), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 1, 15, 0, 1, 15]));
    expect(drained.events).toContainEqual(expect.objectContaining({ type: "hpRestored", side: "player", move: "ABSORB" }));

    const bigPecks = battler("opponent", { ability: "BIGPECKS", moves: [{ move: MINIMAL_MOVE_CATALOG.TAILWHIP, pp: 30 }] });
    const protectedResult = resolveTurn(battle(battler("player", { moves: [{ move: MINIMAL_MOVE_CATALOG.TAILWHIP, pp: 30 }] }), bigPecks),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([0, 0]));
    expect(protectedResult.events).toContainEqual({ type: "abilityActivated", side: "opponent", ability: "BIGPECKS", effect: "prevent-stat-drop" });
  });

  it("supports Vin's confusion and disable effects as authoritative volatile state", () => {
    const supersonic: BattleMove = { id: 1, internalName: "SUPERSONIC", name: "Ultrason", functionCode: "013",
      power: 0, type: "NORMAL", category: "Status", accuracy: 55, pp: 20, priority: 0, effectChance: 0 };
    const confused = resolveTurn(battle(battler("player", { moves: [{ move: supersonic, pp: 20 }] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 0, 0, 15]));
    expect(confused.events).toContainEqual(expect.objectContaining({ type: "volatileApplied", target: "opponent",
      effect: "confusion" }));
    expect(confused.events).toContainEqual(expect.objectContaining({ type: "confusionDamage", side: "opponent" }));
    expect(confused.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "confusion" });

    const disable: BattleMove = { id: 2, internalName: "DISABLE", name: "Entrave", functionCode: "0B9",
      power: 0, type: "NORMAL", category: "Status", accuracy: 100, pp: 20, priority: 0, effectChance: 0 };
    const target = battler("opponent", { volatile: { confusionTurns: 0, flinched: false, focusEnergy: 0,
      identified: false, disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
      bindingMove: null, bindingTurns: 0, cursed: false,
      lastMoveUsed: "SCRATCH" } });
    const disabled = resolveTurn(battle(battler("player", { moves: [{ move: disable, pp: 20 }] }), target),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0]));
    expect(disabled.events).toContainEqual(expect.objectContaining({ type: "volatileApplied", target: "opponent",
      effect: "disable", move: "SCRATCH" }));
    expect(disabled.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "disabled" });
  });

  it("supports the early-route Work Up, Growth, Low Kick and Foresight rules", () => {
    for (const functionCode of ["027", "028"] as const) {
      const move: BattleMove = { id: 1, internalName: functionCode === "027" ? "WORKUP" : "GROWTH",
        name: "Renforcement", functionCode, power: 0, type: "NORMAL", category: "Status", accuracy: 0,
        pp: 20, priority: 0, effectChance: 0 };
      const result = resolveTurn(battle(battler("player", { moves: [{ move, pp: 20 }] })),
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
        new ScriptedRandom([0, 1, 15]));
      expect(result.state.battlers.player.stages).toMatchObject({ attack: 1, specialAttack: 1 });
    }

    const lowKick: BattleMove = { id: 2, internalName: "LOWKICK", name: "Balayette", functionCode: "09A",
      power: 1, type: "FIGHTING", category: "Physical", accuracy: 100, pp: 20, priority: 0, effectChance: 0 };
    const light = calculateDamage("player", battler("player", { types: ["FIGHTING"] }),
      battler("opponent", { capture: { rate: 100, baseSpeed: 50, weight: 99 } }), lowKick,
      new ScriptedRandom([1, 15]), []);
    const heavy = calculateDamage("player", battler("player", { types: ["FIGHTING"] }),
      battler("opponent", { capture: { rate: 100, baseSpeed: 50, weight: 2_000 } }), lowKick,
      new ScriptedRandom([1, 15]), []);
    expect(heavy).toBeGreaterThan(light);

    const normal = calculateDamage("player", battler("player"), battler("opponent", { types: ["GHOST"] }),
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    const identified = calculateDamage("player", battler("player"), battler("opponent", { types: ["GHOST"],
      volatile: { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: true, disabledMove: null,
        disableTurns: 0, encoreMove: null, encoreTurns: 0, bindingMove: null, bindingTurns: 0,
        cursed: false, lastMoveUsed: null } }),
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    expect(normal).toBe(0);
    expect(identified).toBeGreaterThan(0);

    const curse: BattleMove = { id: 3, internalName: "CURSE", name: "Malédiction", functionCode: "10D",
      power: 0, type: "GHOST", category: "Status", accuracy: 0, pp: 10, priority: 0, effectChance: 0 };
    const cursed = resolveTurn(battle(battler("player", { types: ["ROCK"], moves: [{ move: curse, pp: 10 }] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 1, 15]));
    expect(cursed.state.battlers.player.stages).toMatchObject({ attack: 1, defense: 1, speed: -1 });
  });

  it("forces the source move selected by Encore", () => {
    const encore: BattleMove = { id: 1, internalName: "ENCORE", name: "Encore", functionCode: "0BC",
      power: 0, type: "NORMAL", category: "Status", accuracy: 100, pp: 5, priority: 0, effectChance: 0 };
    const opponent = battler("opponent", { moves: [
      { move: MINIMAL_MOVE_CATALOG.SCRATCH, pp: MINIMAL_MOVE_CATALOG.SCRATCH.pp },
      { move: MINIMAL_MOVE_CATALOG.TACKLE, pp: MINIMAL_MOVE_CATALOG.TACKLE.pp },
    ], volatile: { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
      disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0, bindingMove: null,
      bindingTurns: 0, cursed: false, lastMoveUsed: "SCRATCH" } });
    const applied = resolveTurn(battle(battler("player", { moves: [{ move: encore, pp: 5 }] }), opponent),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 1 } },
      new ScriptedRandom([0, 0, 1, 15]));
    const result = resolveTurn(applied.state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 1 } },
      new ScriptedRandom([0, 0, 1, 15]));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "moveUsed", side: "opponent", move: "SCRATCH" }));
    expect(result.state.battlers.opponent.volatile).toMatchObject({ encoreMove: "SCRATCH", encoreTurns: 2 });
  });

  it("applies the Fortress held-item rules and consumes one-shot items", () => {
    const fighting: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "KARATECHOP",
      name: "Poing Karaté", type: "FIGHTING" };
    const neutral = calculateDamage("player", battler("player", { types: ["FIGHTING"] }),
      battler("opponent"), fighting, new SeededRandom(41), []);
    const gemDamage = calculateDamage("player", battler("player", { types: ["FIGHTING"], heldItem: "FIGHTINGGEM" }),
      battler("opponent"), fighting, new SeededRandom(41), []);
    const evioliteDamage = calculateDamage("player", battler("player", { types: ["FIGHTING"] }),
      battler("opponent", { heldItem: "EVIOLITE", canEvolve: true }), fighting, new SeededRandom(41), []);
    expect(gemDamage).toBeGreaterThan(neutral);
    expect(evioliteDamage).toBeLessThan(neutral);

    const result = resolveTurn(battle(battler("player", { heldItem: "FIGHTINGGEM",
      moves: [{ move: fighting, pp: fighting.pp }] })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(7));
    expect(result.state.battlers.player.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      side: "player", item: "FIGHTINGGEM", effect: "boost" }));
  });

  it("ports Venoshock, Fake Out, Taunt and team screens through authoritative state", () => {
    const venoshock: BattleMove = { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: "VENOSHOCK",
      name: "Choc Venin", functionCode: "07B", type: "POISON", power: 65 };
    const healthy = calculateDamage("player", battler("player"), battler("opponent"), venoshock,
      new SeededRandom(9), []);
    const poisoned = calculateDamage("player", battler("player"), battler("opponent", {
      majorStatus: { kind: "poison", toxicCounter: null } }), venoshock, new SeededRandom(9), []);
    expect(poisoned).toBeGreaterThan(healthy);

    const fakeOut: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FAKEOUT", name: "Bluff",
      functionCode: "012", priority: 3, effectChance: 100 };
    const first = resolveTurn(battle(battler("player", { moves: [{ move: fakeOut, pp: fakeOut.pp }] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(12));
    expect(first.events).toContainEqual(expect.objectContaining({ type: "volatileApplied", effect: "flinch" }));
    const second = resolveTurn(first.state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(13));
    expect(second.events).toContainEqual({ type: "moveFailed", side: "player", move: "FAKEOUT", reason: "condition" });

    const reflect: BattleMove = { ...MINIMAL_MOVE_CATALOG.HOWL, internalName: "REFLECT", name: "Reflet",
      functionCode: "0A2" };
    const screened = resolveTurn(battle(battler("player", { moves: [{ move: reflect, pp: reflect.pp }] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(14));
    expect(screened.state.effects?.sides.player.reflectTurns).toBe(4);
    expect(screened.events).toContainEqual({ type: "battleEffectChanged", side: "player", effect: "reflect", turns: 5 });

    const taunt: BattleMove = { ...MINIMAL_MOVE_CATALOG.HOWL, internalName: "TAUNT", name: "Provoc",
      functionCode: "0BA", accuracy: 100 };
    const statusTarget = battler("opponent", { moves: [{ move: MINIMAL_MOVE_CATALOG.HOWL, pp: 40 }] });
    const taunted = resolveTurn(battle(battler("player", { moves: [{ move: taunt, pp: taunt.pp }] }), statusTarget),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(15));
    expect(taunted.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "taunted" });
  });

  it("heals with Oran Berry and Cheek Pouch in the shared passive hook", () => {
    const result = resolveTurn(battle(battler("player", { hp: 30, heldItem: "ORANBERRY", ability: "CHEEKPOUCH" })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(19));
    expect(result.state.battlers.player.heldItem).toBeNull();
    expect(result.state.battlers.player.hp).toBeGreaterThan(30);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed", item: "ORANBERRY" }));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "CHEEKPOUCH",
      effect: "heal-on-berry" }));
  });
});

describe("ability conformance regressions", () => {
  it("keeps an explicit audit entry for every ability advertised by the battle core", () => {
    const audited: Record<(typeof IMPLEMENTED_BATTLE_ABILITIES)[number], string> = {
      ACOMETIDA: "first active turn speed", ADAPTABILITY: "same-type attack bonus", AERILATE: "normal-to-flying conversion",
      BATTLEARMOR: "critical immunity",
      BIGPECKS: "defense drop immunity", BLAZE: "low HP fire power", COMPOUNDEYES: "accuracy multiplier",
      CHEEKPOUCH: "berry consumption healing", CONTRAGUARDIA: "flying redirection", CORROSION: "poison type immunity bypass",
      DRYSKIN: "water absorption",
      COMPETITIVE: "opponent stat-drop special attack boost",
      FILTER: "super-effective damage reduction", FLORACION: "final grass damage", GUTS: "status attack", HUGEPOWER: "physical attack",
      INNERFOCUS: "flinch immunity", INTIMIDATE: "entry attack drop", KEENEYE: "accuracy and evasion",
      IRONFIST: "punch move power", LEVITATE: "ground immunity", LIQUIDVOICE: "source normal-to-water conversion",
      MAGICGUARD: "indirect damage", MEGALAUNCHER: "pulse move power",
      MULTISCALE: "full HP damage reduction", NEUROFORCE: "super-effective power", NOGUARD: "accuracy bypass", OVERGROW: "low HP grass power",
      NATURALCURE: "status cure on switch", PIELHELADA: "normal-to-ice conversion",
      PIELHERBACEA: "normal-to-grass conversion", PIXILATE: "normal-to-fairy conversion", PRANKSTER: "status priority",
      PROTEAN: "type change before move", PUREPOWER: "physical attack", QUICKFEET: "status speed", REGENERATOR: "switch healing",
      RIVALRY: "source gender damage", SAPSIPPER: "grass immunity and attack boost", SCRAPPY: "ghost immunity bypass", SERENEGRACE: "secondary chance",
      SHEERFORCE: "secondary suppression and power", SHELLARMOR: "critical immunity",
      SHEDSKIN: "status cure", SHIELDDUST: "secondary prevention", SIMPLE: "stat stage multiplier",
      SKILLLINK: "maximum multi-hit count", SNIPER: "critical damage", SOLIDROCK: "super-effective damage reduction",
      SOUNDPROOF: "sound move immunity",
      STATIC: "contact paralysis", STEADFAST: "flinch speed", STRONGJAW: "biting move power",
      SWARM: "low HP bug power", SYNCHRONIZE: "status reflection", TECHNICIAN: "low-power move boost",
      THICKFAT: "fire and ice resistance", TORRENT: "low HP water power", TOUGHCLAWS: "contact move power",
      UNAWARE: "ignore opposing stat stages", WATERABSORB: "water absorption",
    };
    expect(Object.keys(audited).sort()).toEqual([...IMPLEMENTED_BATTLE_ABILITIES].sort());
  });

  it("changes a Protean user's type before its selected move", () => {
    const user = battler("player", { ability: "PROTEAN", types: ["NORMAL"],
      moves: [{ move: MINIMAL_MOVE_CATALOG.WATERGUN, pp: MINIMAL_MOVE_CATALOG.WATERGUN.pp }] });
    const result = resolveTurn(battle(user),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(5));
    expect(result.state.battlers.player.types).toEqual(["WATER"]);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "PROTEAN", effect: "change-type" });
  });

  it("applies the deterministic Mega ability damage modifiers in the shared core", () => {
    const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, flags: "aijm" };
    const neutral = calculateDamage("player", battler("player"), battler("opponent"), move,
      new ScriptedRandom([1, 15]), []);
    const boosted = ["IRONFIST", "MEGALAUNCHER", "STRONGJAW", "TECHNICIAN", "TOUGHCLAWS"]
      .map((ability) => calculateDamage("player", battler("player", { ability }), battler("opponent"), move,
        new ScriptedRandom([1, 15]), []));
    expect(boosted.every((damage) => damage > neutral)).toBe(true);

    const superEffective = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
    const fireTarget = battler("opponent", { types: ["FIRE"] });
    const ordinary = calculateDamage("player", battler("player", { types: ["WATER"] }), fireTarget,
      superEffective, new ScriptedRandom([1, 15]), []);
    const filtered = calculateDamage("player", battler("player", { types: ["WATER"] }),
      { ...fireTarget, ability: "FILTER" }, superEffective, new ScriptedRandom([1, 15]), []);
    expect(filtered).toBeLessThan(ordinary);
  });

  it("blocks critical hits with Battle Armor and makes Skill Link hit five times", () => {
    const armoredTrace: BattleTrace[] = [];
    calculateDamage("player", battler("player"), battler("opponent", { ability: "BATTLEARMOR" }),
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([15]), armoredTrace);
    expect(armoredTrace).toContainEqual(expect.objectContaining({ type: "damage", critical: false }));

    const multiHit = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FURYATTACK",
      functionCode: "0C0" as const, accuracy: 0 };
    const result = resolveTurn(battle(battler("player", { ability: "SKILLLINK",
      moves: [{ move: multiHit, pp: multiHit.pp }] }), battler("opponent", {
      stats: { ...battler("opponent").stats, maxHp: 500 }, hp: 500,
    })), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 1, 15, 1, 15, 1, 15, 1, 15, 99, 1, 15]));
    expect(result.events.filter((event) => event.type === "damageApplied" && event.source === "player")).toHaveLength(5);
  });

  it("uses Compound Eyes in the authoritative accuracy calculation", () => {
    const inaccurate = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 75 };
    const result = resolveTurn(battle(battler("player", { ability: "COMPOUNDEYES",
      moves: [{ move: inaccurate, pp: inaccurate.pp }] }), battler("opponent")),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([90, 1, 15, 99, 1, 15]));
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "moveMissed", side: "player" }));
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "accuracy", side: "player", threshold: 97.5 }));
  });

  it("uses Pokemon Z's converted move type for damage, STAB and effectiveness", () => {
    const normalMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const aerilateTrace: BattleTrace[] = [];
    calculateDamage("player", battler("player", { ability: "AERILATE", types: ["FLYING"] }),
      battler("opponent", { types: ["GRASS"] }), normalMove, new ScriptedRandom([1, 15]), aerilateTrace);
    expect(aerilateTrace).toContainEqual(expect.objectContaining({ type: "damage", stab: 1.5,
      effectiveness: 2, abilityModifier: { ability: "AERILATE", multiplier: 1.2 } }));

    const liquidVoiceTrace: BattleTrace[] = [];
    calculateDamage("player", battler("player", { ability: "LIQUIDVOICE" }),
      battler("opponent", { types: ["FIRE"] }), normalMove, new ScriptedRandom([1, 15]), liquidVoiceTrace);
    expect(liquidVoiceTrace).toContainEqual(expect.objectContaining({ type: "damage", effectiveness: 2,
      abilityModifier: { ability: "LIQUIDVOICE", multiplier: 1.2 } }));
  });

  it("applies Levitate and Scrappy while Mold Breaker bypasses defensive abilities", () => {
    const groundMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "GROUND", accuracy: 0 };
    const levitateTrace: BattleTrace[] = [];
    expect(calculateDamage("player", battler("player"), battler("opponent", { ability: "LEVITATE" }),
      groundMove, new ScriptedRandom([1, 15]), levitateTrace)).toBe(0);
    expect(levitateTrace).toContainEqual(expect.objectContaining({ type: "damage", effectiveness: 0 }));
    expect(calculateDamage("player", battler("player", { ability: "MOLDBREAKER" }),
      battler("opponent", { ability: "LEVITATE" }), groundMove, new ScriptedRandom([1, 15]), [])).toBeGreaterThan(0);

    const ghost = battler("opponent", { types: ["GHOST"] });
    expect(calculateDamage("player", battler("player"), ghost, MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([1, 15]), [])).toBe(0);
    expect(calculateDamage("player", battler("player", { ability: "SCRAPPY" }), ghost,
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), [])).toBeGreaterThan(0);
  });

  it("blocks sound moves and lets Mold Breaker pass through Soundproof", () => {
    const soundMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "ROUND", flags: "k", accuracy: 0 };
    const actions = { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } } as const;
    const blocked = resolveTurn(battle(battler("player", { moves: [{ move: soundMove, pp: soundMove.pp }] }),
      battler("opponent", { ability: "SOUNDPROOF" })), actions, new SeededRandom(30));
    expect(blocked.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "SOUNDPROOF", effect: "block-move" });
    expect(blocked.state.battlers.opponent.hp).toBe(100);

    const bypassed = resolveTurn(battle(battler("player", { ability: "MOLDBREAKER",
      moves: [{ move: soundMove, pp: soundMove.pp }] }), battler("opponent", { ability: "SOUNDPROOF" })),
    actions, new SeededRandom(30));
    expect(bypassed.state.battlers.opponent.hp).toBeLessThan(100);
  });

  it("boosts Sheer Force moves while suppressing their effect and Life Orb recoil", () => {
    const flameCharge = { ...MINIMAL_MOVE_CATALOG.FLAMECHARGE, power: 20, accuracy: 0, effectChance: 100 };
    const actions = { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } } as const;
    const result = resolveTurn(battle(battler("player", { ability: "SHEERFORCE", heldItem: "LIFEORB",
      moves: [{ move: flameCharge, pp: flameCharge.pp }] }), battler("opponent")), actions, new SeededRandom(31));
    expect(result.state.battlers.player.stages.speed).toBe(0);
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "itemActivated", side: "player",
      item: "LIFEORB" }));
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifier: { ability: "SHEERFORCE", multiplier: 1.3 } }));
  });

  it("lets Magic Guard block binding and curse while their lifecycle still advances", () => {
    const guarded = battler("player", { ability: "MAGICGUARD", volatile: {
      confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false, disabledMove: null,
      disableTurns: 0, encoreMove: null, encoreTurns: 0, bindingMove: "WRAP", bindingTurns: 2,
      cursed: true, lastMoveUsed: null,
    } });
    const result = resolveBattleVolatileEndOfTurn(guarded, "player");
    expect(result.battler).toMatchObject({ hp: 100, volatile: { bindingTurns: 1, cursed: true } });
    expect(result.events.some((event) => event.type === "bindingDamage" || event.type === "curseDamage")).toBe(false);
  });

  it("labels Keen Eye correctly when it prevents an accuracy drop", () => {
    const sandAttack: BattleMove = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "SANDATTACK",
      name: "Jet de Sable", functionCode: "047", accuracy: 0 };
    const result = resolveTurn(battle(battler("player", { moves: [{ move: sandAttack, pp: sandAttack.pp }] }),
      battler("opponent", { ability: "KEENEYE" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(21));
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent", ability: "KEENEYE",
      effect: "prevent-stat-drop" });
  });

  it("lets Keen Eye ignore only a target's positive evasion", () => {
    const evasive = battler("opponent", { stages: { ...battler("opponent").stages, evasion: 6 } });
    const accurate = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 100 };
    const result = resolveTurn(battle(battler("player", { ability: "KEENEYE",
      moves: [{ move: accurate, pp: accurate.pp }] }), evasive),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([99, 1, 15, 99, 1, 15]));
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "moveMissed", side: "player" }));
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "accuracy", side: "player",
      evasionStage: 0, threshold: 100, hit: true }));
  });

  it("can trigger Static even when the contacted defender is knocked out", () => {
    const contact = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, flags: "a" };
    const result = resolveTurn(battle(battler("player", { moves: [{ move: contact, pp: contact.pp }] }),
      battler("opponent", { hp: 1, ability: "STATIC" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 0]));
    expect(result.state.battlers.opponent.hp).toBe(0);
    expect(result.state.battlers.player.majorStatus).toEqual({ kind: "paralysis" });
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent", ability: "STATIC",
      effect: "inflict-paralysis" });
  });

  it("applies Cheek Pouch after a Payapa Berry is consumed", () => {
    const psychic: BattleMove = { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: "CONFUSION", type: "PSYCHIC",
      power: 20, accuracy: 0 };
    const result = resolveTurn(battle(battler("player", { moves: [{ move: psychic, pp: psychic.pp }] }),
      battler("opponent", { hp: 50, types: ["POISON"], heldItem: "PAYAPABERRY", ability: "CHEEKPOUCH" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(22));
    expect(result.state.battlers.opponent.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed", item: "PAYAPABERRY" }));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", side: "opponent",
      ability: "CHEEKPOUCH", effect: "heal-on-berry" }));
  });

  it("applies Cheek Pouch to the Bug Bite user that consumes a stolen Berry", () => {
    const bugBite: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "BUGBITE", type: "BUG",
      power: 10, functionCode: "0F4", accuracy: 0 };
    const result = resolveTurn(battle(battler("player", { hp: 30, ability: "CHEEKPOUCH",
      moves: [{ move: bugBite, pp: bugBite.pp }] }), battler("opponent", { heldItem: "ORANBERRY" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new SeededRandom(23));
    expect(result.state.battlers.player.hp).toBeGreaterThan(40);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", side: "player",
      ability: "CHEEKPOUCH", effect: "heal-on-berry" }));
  });

  it("lets Synchronize reflect the fangame-specific Caduco status", () => {
    const move = { ...MINIMAL_MOVE_CATALOG.LUZDECADENTE, accuracy: 0 };
    const result = resolveTurn(battle(battler("player", { moves: [{ move, pp: move.pp }] }),
      battler("opponent", { ability: "SYNCHRONIZE" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 0, 1, 15, 15]));
    expect(result.state.battlers.opponent.majorStatus).toEqual({ kind: "caduco" });
    expect(result.state.battlers.player.majorStatus).toEqual({ kind: "caduco" });
    expect(result.events).toContainEqual({ type: "statusApplied", source: "opponent", target: "player",
      status: "caduco" });
  });

  it("lets Synchronize reflect the fangame-specific Hemorrhage status", () => {
    const move = { ...MINIMAL_MOVE_CATALOG.CUT, accuracy: 0, effectChance: 100 };
    const result = resolveTurn(battle(battler("player", { moves: [{ move, pp: move.pp }] }),
      battler("opponent", { ability: "SYNCHRONIZE" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 0, 1, 1, 15]));
    expect(result.state.battlers.opponent.majorStatus).toEqual({ kind: "hemorrhage" });
    expect(result.state.battlers.player.majorStatus).toEqual({ kind: "hemorrhage" });
    expect(result.events).toContainEqual({ type: "statusApplied", source: "opponent", target: "player",
      status: "hemorrhage" });
  });

  it("reproduces Z's Shield Dust and Covert Cloak combination", () => {
    const iceBeam = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, effectChance: 100 };
    const actions = { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } } as const;
    const shieldDustOnly = resolveTurn(battle(battler("player", { moves: [{ move: iceBeam, pp: iceBeam.pp }] }),
      battler("opponent", { ability: "SHIELDDUST" })), actions,
    new ScriptedRandom([99, 1, 15, 0, 99, 1, 15]));
    const sourceCombination = resolveTurn(battle(battler("player", { moves: [{ move: iceBeam, pp: iceBeam.pp }] }),
      battler("opponent", { ability: "SHIELDDUST", heldItem: "COVERTCLOAK" })), actions,
    new ScriptedRandom([99, 1, 15, 0, 99, 1, 15]));

    expect(shieldDustOnly.state.battlers.opponent.majorStatus).toEqual({ kind: "frozen" });
    expect(sourceCombination.state.battlers.opponent.majorStatus).toBeNull();
    expect(sourceCombination.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "SHIELDDUST", effect: "prevent-additional-effect" });

    const thunderFang = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "THUNDERFANG", functionCode: "009" as const,
      type: "ELECTRIC", accuracy: 0, effectChance: 100 };
    const fangCombination = resolveTurn(battle(battler("player", {
      moves: [{ move: thunderFang, pp: thunderFang.pp }] }), battler("opponent", {
      ability: "SHIELDDUST", heldItem: "COVERTCLOAK" })), actions,
    new ScriptedRandom([1, 15, 0, 99, 1, 15]));
    expect(fangCombination.state.battlers.opponent.majorStatus).toBeNull();
    expect(fangCombination.events).not.toContainEqual(expect.objectContaining({ type: "volatileApplied",
      target: "opponent", effect: "flinch" }));
  });
});
