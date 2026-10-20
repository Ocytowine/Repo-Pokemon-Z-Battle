import { describe, expect, it } from "vitest";
import { calculateDamage, createDoubleTeamBattleState, MINIMAL_MOVE_CATALOG, resolveDoubleTeamTurn, resolveTurn,
  type BattleMove, type BattleSide, type BattleState, type BattlerState, type RandomSource } from "../src/index.js";

class ScriptedRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) throw new Error(`RNG ${maxExclusive} manquant.`);
    return value;
  }
}

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id: side, species: "EEVEE", name: side, level: 30, types: ["NORMAL"], hp: 100,
    stats: { maxHp: 100, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80,
      speed: side === "player" ? 90 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null, moves: [{ move, pp: move.pp }], ...overrides };
}

function battle(player: BattlerState, opponent = battler("opponent")): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

function move(internalName: string, functionCode: BattleMove["functionCode"], category: BattleMove["category"],
  power = 0, effectChance = 0): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName, name: internalName, functionCode, category, power,
    accuracy: 0, effectChance };
}

const steadyRandom: RandomSource = { nextInt: (maximum) => Math.min(1, maximum - 1) };

describe("Route 3 to Bois-en-Tronc battle dependencies", () => {
  it("ports the two-stage trainer stat moves and Recover", () => {
    for (const [testedMove, stat, expected] of [
      [move("AMNESIA", "033", "Status"), "specialDefense", 2],
      [move("SCREECH", "04C", "Status"), "defense", -2],
      [move("FAKETEARS", "04F", "Status"), "specialDefense", -2],
    ] as const) {
      const player = battler("player", { moves: [{ move: testedMove, pp: 10 }] });
      const result = resolveTurn(battle(player), { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([99, 1, 15]));
      const target = expected > 0 ? result.state.battlers.player : result.state.battlers.opponent;
      expect(target.stages[stat]).toBe(expected);
    }
    const recover = move("RECOVER", "0D5", "Status");
    const healed = resolveTurn(battle(battler("player", { hp: 20, moves: [{ move: recover, pp: 10 }] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15]));
    expect(healed.events).toContainEqual(expect.objectContaining({ type: "hpRestored", side: "player", amount: 50 }));
  });

  it("resolves Double Kick as exactly two hits", () => {
    const doubleKick = move("DOUBLEKICK", "0BD", "Physical", 30);
    const result = resolveTurn(battle(battler("player", { moves: [{ move: doubleKick, pp: 30 }] }),
      battler("opponent", { hp: 500, stats: { ...battler("opponent").stats, maxHp: 500 } })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 1, 15, 99, 1, 15]));
    expect(result.events.filter((event) => event.type === "damageApplied" && event.source === "player")).toHaveLength(2);
  });

  it("resolves Twineedle as two hits with one poison chance per landed hit", () => {
    const twineedle = move("TWINEEDLE", "0BE", "Physical", 25, 20);
    const result = resolveTurn(battle(battler("player", { ability: "CORROSION",
      moves: [{ move: twineedle, pp: 20 }] }),
      battler("opponent", { types: ["STEEL"], hp: 500,
        stats: { ...battler("opponent").stats, maxHp: 500 } })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 1, 15, 99, 0, 99, 1, 15]));
    expect(result.events.filter((event) => event.type === "damageApplied" && event.source === "player")).toHaveLength(2);
    expect(result.state.battlers.opponent.majorStatus).toEqual({ kind: "poison", toxicCounter: null });
    expect(result.events).toContainEqual({ type: "statusApplied", source: "player",
      target: "opponent", status: "poison" });
  });

  it("applies both source screens and sport fields to their matching damage category", () => {
    const attacker = battler("player", { types: ["ELECTRIC"] });
    const target = battler("opponent");
    const electric = { ...MINIMAL_MOVE_CATALOG.WATERGUN, type: "ELECTRIC" };
    const plain = calculateDamage("player", attacker, target, electric, new ScriptedRandom([1, 15]), []);
    const reduced = calculateDamage("player", attacker, target, electric, new ScriptedRandom([1, 15]), [],
      { reflect: false, lightScreen: true, luckyChant: false, mudSport: true, waterSport: false });
    expect(reduced).toBeLessThan(plain / 2);
  });

  it("uses the shared deterministic abilities for the route trainers", () => {
    const boosted = calculateDamage("player", battler("player", { ability: "PIELHERBACEA", types: ["GRASS"] }),
      battler("opponent", { types: ["WATER"] }), MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([1, 15]), []);
    const neutral = calculateDamage("player", battler("player"), battler("opponent", { types: ["WATER"] }),
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    expect(boosted).toBeGreaterThan(neutral);
    const unaware = calculateDamage("player", battler("player", { stages: { ...battler("player").stages, attack: 6 } }),
      battler("opponent", { ability: "UNAWARE" }), MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([1, 15]), []);
    expect(unaware).toBe(neutral);
  });

  it("uses Pokemon Z's exact Flail HP brackets", () => {
    const flail = move("FLAIL", "098", "Physical", 1);
    const powers = [1, 20, 50, 100, 170, 330].map((hp) => {
      const trace: Parameters<typeof calculateDamage>[5] = [];
      calculateDamage("player", battler("player", { hp, stats: { ...battler("player").stats, maxHp: 480 } }),
        battler("opponent"), flail, steadyRandom, trace);
      return trace.find((entry) => entry.type === "damage")!.baseDamage;
    });
    expect(powers[0]).toBeGreaterThan(powers[1]!);
    expect(powers[1]).toBeGreaterThan(powers[2]!);
    expect(powers[2]).toBeGreaterThan(powers[3]!);
    expect(powers[3]).toBeGreaterThan(powers[4]!);
    expect(powers[4]).toBeGreaterThan(powers[5]!);
  });

  it("stores Charge for the next Electric attack and consumes it on hit", () => {
    const electric = { ...move("THUNDERSHOCK", "000", "Special", 40), type: "ELECTRIC" };
    const charged = battler("player", { types: ["ELECTRIC"], volatile: {
      confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false, disabledMove: null,
      disableTurns: 0, encoreMove: null, encoreTurns: 0, bindingMove: null, bindingTurns: 0,
      cursed: false, lastMoveUsed: "CHARGE", chargeTurns: 1,
    }, moves: [{ move: electric, pp: 20 }] });
    const ordinary = resolveTurn(battle(battler("player", { types: ["ELECTRIC"],
      moves: [{ move: electric, pp: 20 }] })), { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, steadyRandom);
    const boosted = resolveTurn(battle(charged), { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, steadyRandom);
    const ordinaryDamage = ordinary.events.find((event): event is Extract<(typeof ordinary.events)[number],
      { type: "damageApplied" }> => event.type === "damageApplied" && event.source === "player")!;
    const boostedDamage = boosted.events.find((event): event is Extract<(typeof boosted.events)[number],
      { type: "damageApplied" }> => event.type === "damageApplied" && event.source === "player")!;
    expect(boostedDamage.amount).toBeGreaterThan(ordinaryDamage.amount);
    expect(boosted.state.battlers.player.volatile?.chargeTurns).toBe(0);
  });

  it("heals the Leech Seed user's position and lets Rapid Spin clear seed, binding and hazards", () => {
    const seeded = battler("opponent", { hp: 80, volatile: {
      confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false, disabledMove: null,
      disableTurns: 0, encoreMove: null, encoreTurns: 0, bindingMove: null, bindingTurns: 0,
      cursed: false, lastMoveUsed: null, leechSeededBy: "player",
    } });
    const drained = resolveTurn(battle(battler("player", { hp: 50 }), seeded), {
      player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 },
    }, steadyRandom);
    expect(drained.events).toContainEqual(expect.objectContaining({ type: "leechSeedDamage", side: "opponent" }));
    expect(drained.events).toContainEqual(expect.objectContaining({ type: "hpRestored", side: "player", move: "LEECHSEED" }));

    const rapidSpin = move("RAPIDSPIN", "110", "Physical", 20);
    const spinner = battler("player", { volatile: {
      confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false, disabledMove: null,
      disableTurns: 0, encoreMove: null, encoreTurns: 0, bindingMove: "WRAP", bindingTurns: 4,
      cursed: false, lastMoveUsed: null, leechSeededBy: "opponent",
    }, moves: [{ move: rapidSpin, pp: 40 }] });
    const spun = resolveTurn({ ...battle(spinner), effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0, spikesLayers: 3, toxicSpikesLayers: 2,
        stealthRock: true, stickyWeb: true },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, mudSportTurns: 0, waterSportTurns: 0 } }, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, steadyRandom);
    expect(spun.state.battlers.player.volatile).toMatchObject({ bindingTurns: 0, leechSeededBy: null });
    expect(spun.state.effects?.sides.player).toMatchObject({ spikesLayers: 0, toxicSpikesLayers: 0,
      stealthRock: false, stickyWeb: false });
  });

  it("lets Defog clear screens, safeguards, hazards and terrain on both camps", () => {
    const defog = move("DEFOG", "049", "Status");
    const result = resolveTurn({ ...battle(battler("player", { moves: [{ move: defog, pp: 15 }] })), effects: {
      sides: {
        player: { reflectTurns: 3, lightScreenTurns: 2, luckyChantTurns: 0, mistTurns: 4,
          safeguardTurns: 3, spikesLayers: 2, toxicSpikesLayers: 1, stealthRock: true, stickyWeb: true },
        opponent: { reflectTurns: 3, lightScreenTurns: 2, luckyChantTurns: 0, mistTurns: 4,
          safeguardTurns: 3, spikesLayers: 2, toxicSpikesLayers: 1, stealthRock: true, stickyWeb: true },
      }, mudSportTurns: 0, waterSportTurns: 0, terrain: "grassy", terrainTurns: 5,
    } }, { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, steadyRandom);

    expect(result.state.effects).toMatchObject({ terrain: null, terrainTurns: 0, sides: {
      player: { reflectTurns: 0, lightScreenTurns: 0, mistTurns: 0, safeguardTurns: 0,
        spikesLayers: 0, toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false },
      opponent: { reflectTurns: 0, lightScreenTurns: 0, mistTurns: 0, safeguardTurns: 0,
        spikesLayers: 0, toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false },
    } });
  });

  it("transfers held items with Thief, respects Sticky Hold and applies Take Down recoil", () => {
    const thief = move("THIEF", "0F1", "Physical", 40);
    const stolen = resolveTurn(battle(battler("player", { moves: [{ move: thief, pp: 25 }] }),
      battler("opponent", { heldItem: "ORANBERRY" })), { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, steadyRandom);
    expect(stolen.state.battlers.player.heldItem).toBe("ORANBERRY");
    expect(stolen.state.battlers.opponent.heldItem).toBeNull();
    expect(stolen.events).toContainEqual(expect.objectContaining({ type: "heldItemTransferred", item: "ORANBERRY" }));

    const retained = resolveTurn(battle(battler("player", { moves: [{ move: thief, pp: 25 }] }),
      battler("opponent", { heldItem: "ORANBERRY", ability: "STICKYHOLD" })), {
      player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 },
    }, steadyRandom);
    expect(retained.state.battlers.opponent.heldItem).toBe("ORANBERRY");

    const takeDown = move("TAKEDOWN", "0FA", "Physical", 30);
    const recoil = resolveTurn(battle(battler("player", { moves: [{ move: takeDown, pp: 20 }] })), {
      player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 },
    }, steadyRandom);
    expect(recoil.events).toContainEqual(expect.objectContaining({ type: "recoilDamage", side: "player" }));
  });

  it("combines Assurance, Round and Helping Hand in the authoritative double resolver", () => {
    const tackle = { ...move("TACKLE", "000", "Physical", 20), targetCode: "00" };
    const assurance = { ...move("ASSURANCE", "082", "Physical", 20), targetCode: "00" };
    const round = { ...move("ROUND", "083", "Special", 20), targetCode: "00" };
    const helper = { ...move("HELPINGHAND", "09C", "Status"), priority: 5, targetCode: "100" };
    const enemy = battler("opponent", { hp: 500, stats: { ...battler("opponent").stats, maxHp: 500 } });

    const assuranceState = createDoubleTeamBattleState({ player: [
      battler("player", { id: "fast", stats: { ...battler("player").stats, speed: 100 }, moves: [{ move: tackle, pp: 20 }] }),
      battler("player", { id: "assurance", stats: { ...battler("player").stats, speed: 90 }, moves: [{ move: assurance, pp: 20 }] }),
    ], opponent: [enemy] });
    const assuranceResult = resolveDoubleTeamTurn(assuranceState, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0, target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0, target: { side: "opponent", slot: 0 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], steadyRandom);
    const damages = assuranceResult.events.flatMap((event) => event.type === "positionedActionResolved"
      ? event.events.filter((inner) => inner.type === "damageApplied") : []);
    expect(damages[1]!.amount).toBeGreaterThan(damages[0]!.amount);

    const comboState = createDoubleTeamBattleState({ player: [
      battler("player", { id: "helper", moves: [{ move: helper, pp: 20 }] }),
      battler("player", { id: "round", moves: [{ move: round, pp: 20 }] }),
    ], opponent: [enemy] });
    const combo = resolveDoubleTeamTurn(comboState, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0, target: { side: "opponent", slot: 0 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], steadyRandom);
    expect(combo.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      events: expect.arrayContaining([expect.objectContaining({ type: "volatileApplied", effect: "helping-hand" })]) }));
    const helpedDamage = combo.events.flatMap((event) => event.type === "positionedActionResolved"
      ? event.events.filter((inner) => inner.type === "damageApplied") : [])[0]!;
    expect(helpedDamage.amount).toBeGreaterThan(0);

    const roundsState = createDoubleTeamBattleState({ player: [
      battler("player", { id: "round-fast", stats: { ...battler("player").stats, speed: 100 }, moves: [{ move: round, pp: 20 }] }),
      battler("player", { id: "round-slow", stats: { ...battler("player").stats, speed: 10 }, moves: [{ move: round, pp: 20 }] }),
    ], opponent: [enemy] });
    const rounds = resolveDoubleTeamTurn(roundsState, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0, target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0, target: { side: "opponent", slot: 0 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
    ], steadyRandom);
    const roundDamage = rounds.events.flatMap((event) => event.type === "positionedActionResolved"
      && event.actor.side === "player"
      ? event.events.filter((inner) => inner.type === "damageApplied") : []);
    expect(roundDamage[1]!.amount).toBeGreaterThan(roundDamage[0]!.amount);
    expect(rounds.events.filter((event) => event.type === "positionedActionResolved")
      .slice(0, 3).map((event) => event.type === "positionedActionResolved" ? event.actor : null))
      .toEqual([{ side: "player", slot: 0 }, { side: "player", slot: 1 }, { side: "opponent", slot: 0 }]);
  });
});
