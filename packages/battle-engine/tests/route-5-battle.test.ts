import { describe, expect, it } from "vitest";
import { calculateDamage, createTeamBattleState, MINIMAL_MOVE_CATALOG, resolveTeamTurn, resolveTurn,
  restoreTransformedBattler, transformBattler,
  type BattleMove, type BattleSide, type BattleState, type BattlerState,
  type RandomSource } from "../src/index.js";

const steadyRandom: RandomSource = { nextInt: (maximum) => Math.min(1, maximum - 1) };

function move(internalName: string, functionCode: BattleMove["functionCode"],
  category: BattleMove["category"], power = 0, effectChance = 0): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName, name: internalName, functionCode,
    category, power, accuracy: 0, effectChance };
}

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const basicMove = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id: side, species: "EEVEE", name: side, level: 30, types: ["NORMAL"], hp: 160,
    stats: { maxHp: 160, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80,
      speed: side === "player" ? 90 : 20 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: basicMove, pp: basicMove.pp }], ...overrides };
}

function battle(player: BattlerState, opponent = battler("opponent")): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

function usePlayerMove(player: BattlerState, opponent = battler("opponent")) {
  return resolveTurn(battle(player, opponent), {
    player: { kind: "move" as const, moveIndex: 0 },
    opponent: { kind: "move" as const, moveIndex: 0 },
  }, steadyRandom);
}

describe("Route 5 battle dependencies", () => {
  it("uses the attacker's exact level for Night Shade", () => {
    const nightShade = { ...move("NIGHTSHADE", "06D", "Special", 1), type: "GHOST" };
    const result = usePlayerMove(battler("player", { level: 37,
      moves: [{ move: nightShade, pp: 15 }] }), battler("opponent", { hp: 160, types: ["PSYCHIC"] }));
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "damageApplied", source: "player", target: "opponent", amount: 37,
    }));
    const immune = usePlayerMove(battler("player", { level: 37,
      moves: [{ move: nightShade, pp: 15 }] }), battler("opponent", { types: ["NORMAL"] }));
    expect(immune.events).toContainEqual(expect.objectContaining({
      type: "damageApplied", source: "player", target: "opponent", amount: 0,
    }));
  });

  it("doubles Acrobatics only when the attacker has no held item", () => {
    const acrobatics = move("ACROBATICS", "086", "Physical", 55);
    const target = battler("opponent");
    const withoutItem = calculateDamage("player", battler("player"), target, acrobatics,
      steadyRandom, []);
    const withItem = calculateDamage("player", battler("player", { heldItem: "ORANBERRY" }),
      target, acrobatics, steadyRandom, []);
    expect(withoutItem).toBeGreaterThan(withItem * 1.8);
  });

  it("raises all five combat stats when Ancient Power's additional effect succeeds", () => {
    const ancientPower = move("ANCIENTPOWER", "02D", "Special", 60, 100);
    const result = usePlayerMove(battler("player", { moves: [{ move: ancientPower, pp: 5 }] }));
    expect(result.state.battlers.player.stages).toMatchObject({
      attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1,
    });
  });

  it("lets Stomp flinch its target while Inner Focus blocks that effect", () => {
    const stomp = move("STOMP", "010", "Physical", 65, 100);
    const ordinary = usePlayerMove(battler("player", { moves: [{ move: stomp, pp: 20 }] }));
    expect(ordinary.events).toContainEqual(expect.objectContaining({
      type: "actionSkipped", side: "opponent", reason: "flinch",
    }));
    const focused = usePlayerMove(battler("player", { moves: [{ move: stomp, pp: 20 }] }),
      battler("opponent", { ability: "INNERFOCUS" }));
    expect(focused.events).not.toContainEqual(expect.objectContaining({
      type: "actionSkipped", side: "opponent", reason: "flinch",
    }));
  });

  it("changes the target ability with Worry Seed and respects protected abilities", () => {
    const worrySeed = move("WORRYSEED", "064", "Status");
    const changed = usePlayerMove(battler("player", { moves: [{ move: worrySeed, pp: 10 }] }),
      battler("opponent", { ability: "RUNAWAY" }));
    expect(changed.state.battlers.opponent.ability).toBe("INSOMNIA");
    expect(changed.events).toContainEqual(expect.objectContaining({ type: "abilityChanged",
      target: "opponent", ability: "INSOMNIA" }));

    for (const ability of ["DISGUISE", "INSOMNIA", "MULTITYPE", "STANCECHANGE", "TRUANT"]) {
      const protectedTarget = usePlayerMove(battler("player", { moves: [{ move: worrySeed, pp: 10 }] }),
        battler("opponent", { ability }));
      expect(protectedTarget.state.battlers.opponent.ability).toBe(ability);
      expect(protectedTarget.events).toContainEqual(expect.objectContaining({
        type: "moveFailed", side: "player", move: "WORRYSEED",
      }));
    }
  });

  it("boosts Knock Off and removes a losable held item unless Sticky Hold protects it", () => {
    const knockOff = move("KNOCKOFF", "0F0", "Physical", 65);
    const target = battler("opponent", { heldItem: "ORANBERRY" });
    const boosted = calculateDamage("player", battler("player"), target, knockOff,
      steadyRandom, []);
    const plain = calculateDamage("player", battler("player"), battler("opponent"), knockOff,
      steadyRandom, []);
    expect(boosted).toBeGreaterThan(plain * 1.35);

    const removed = usePlayerMove(battler("player", { moves: [{ move: knockOff, pp: 20 }] }), target);
    expect(removed.state.battlers.opponent.heldItem).toBeNull();
    expect(removed.events).toContainEqual(expect.objectContaining({
      type: "heldItemRemoved", item: "ORANBERRY",
    }));

    const retained = usePlayerMove(battler("player", { moves: [{ move: knockOff, pp: 20 }] }),
      battler("opponent", { heldItem: "ORANBERRY", ability: "STICKYHOLD" }));
    expect(retained.state.battlers.opponent.heldItem).toBe("ORANBERRY");
  });

  it("scales Fury Cutter and Rollout from their consecutive-turn counters", () => {
    const fury = { ...move("FURYCUTTER", "091", "Physical", 40), type: "BUG" };
    const rollout = { ...move("ROLLOUT", "0D3", "Physical", 30), type: "ROCK" };
    const target = battler("opponent");
    const furyFirst = calculateDamage("player", battler("player", { moves: [{ move: fury, pp: 20 }],
      volatile: { furyCutterCount: 1 } as NonNullable<BattlerState["volatile"]> }), target, fury, steadyRandom, []);
    const furyFourth = calculateDamage("player", battler("player", { moves: [{ move: fury, pp: 20 }],
      volatile: { furyCutterCount: 4 } as NonNullable<BattlerState["volatile"]> }), target, fury, steadyRandom, []);
    const rolloutFirst = calculateDamage("player", battler("player", { moves: [{ move: rollout, pp: 20 }],
      volatile: { rolloutTurns: 4 } as NonNullable<BattlerState["volatile"]> }), target, rollout, steadyRandom, []);
    const rolloutFifth = calculateDamage("player", battler("player", { moves: [{ move: rollout, pp: 20 }],
      volatile: { rolloutTurns: 0 } as NonNullable<BattlerState["volatile"]> }), target, rollout, steadyRandom, []);
    expect(furyFourth).toBeGreaterThan(furyFirst * 6);
    expect(rolloutFifth).toBeGreaterThan(rolloutFirst * 12);
  });

  it("selects Nature Power from the replicated encounter environment", () => {
    const naturePower = move("NATUREPOWER", "0B3", "Status");
    const state = { ...battle(battler("player", { moves: [{ move: naturePower, pp: 20 }] })), effects: {
      sides: { player: { reflectTurns: 0, luckyChantTurns: 0 }, opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
      waterSportTurns: 0, environment: "grass" as const,
    } };
    const result = resolveTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, steadyRandom);
    expect(result.events).toContainEqual({ type: "moveUsed", side: "player", move: "ENERGYBALL" });
    expect(result.state.battlers.player.moves[0]?.pp).toBe(19);
  });

  it("draws Magnitude's source-weighted power through the deterministic trace", () => {
    const magnitude = { ...move("MAGNITUDE", "095", "Physical", 1), type: "GROUND" };
    const result = usePlayerMove(battler("player", { moves: [{ move: magnitude, pp: 30 }] }));
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "rng", purpose: "magnitude" }));
  });

  it("copies and restores a transformed battler without changing its maximum HP", () => {
    const original = battler("player", { species: "DITTO", ability: "IMPOSTER" });
    const targetMove = move("EMBER", "00A", "Special", 40);
    const target = battler("opponent", { species: "FENNEKIN", name: "Feunnec", types: ["FIRE"],
      ability: "BLAZE", stats: { maxHp: 220, attack: 90, defense: 70, specialAttack: 110,
        specialDefense: 80, speed: 100 }, moves: [{ move: targetMove, pp: 25 }] });
    const transformed = transformBattler(original, target);
    expect(transformed).toMatchObject({ species: "FENNEKIN", ability: "BLAZE",
      stats: { maxHp: 160 }, moves: [{ pp: 5 }] });
    expect(restoreTransformedBattler(transformed!)).toMatchObject({ species: "DITTO", ability: "IMPOSTER",
      stats: { maxHp: 160 } });
  });

  it("applies Imposter and Grassy Surge from the shared team-state constructor", () => {
    const ditto = battler("player", { species: "DITTO", ability: "IMPOSTER" });
    const grassy = battler("opponent", { species: "GROOKEY", ability: "GRASSYSURGE", types: ["GRASS"] });
    const state = createTeamBattleState({ player: [ditto], opponent: [grassy] });
    expect(state.teams.player.members[0]).toMatchObject({ species: "GROOKEY", types: ["GRASS"] });
    expect(state.effects).toMatchObject({ terrain: "grassy", terrainTurns: 5 });
  });

  it("blocks trainer items while Embargo is active", () => {
    const player = battler("player", { hp: 80, volatile: { embargoTurns: 3 } as NonNullable<BattlerState["volatile"]> });
    const state = { ...createTeamBattleState({ player: [player], opponent: [battler("opponent")] }),
      teams: { player: { activeIndex: 0, members: [player], items: ["POTION"] },
        opponent: { activeIndex: 0, members: [battler("opponent")] } } };
    expect(() => resolveTeamTurn(state, { player: { kind: "item", itemId: "POTION", targetTeamIndex: 0 },
      opponent: { kind: "wait" } }, steadyRandom)).toThrow("embargo");
  });
});
