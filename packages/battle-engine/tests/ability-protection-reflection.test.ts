import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";
import { resolveEntryAbility } from "../src/ability-entry.js";

const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 240, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides,
  };
}

function move(overrides: Partial<BattleMove> = {}): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, ...overrides };
}

function single(attacker: BattlerState, defender: BattlerState) {
  return resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [defender] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, highRolls);
}

describe("Pokemon Z protection, drain and reflection abilities", () => {
  it("blocks targeted and self-targeted Status moves with Good as Gold unless Mold Breaker bypasses it", () => {
    const growl = { ...MINIMAL_MOVE_CATALOG.GROWL, accuracy: 0, targetCode: "00" };
    const protectedResult = single(
      pokemon("attacker", "player", { moves: [{ move: growl, pp: growl.pp }] }),
      pokemon("gold", "opponent", { ability: "GOODASGOLD" }));
    expect(protectedResult.state.teams.opponent.members[0]!.stages.attack).toBe(0);
    expect(protectedResult.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "GOODASGOLD", effect: "block-move" });

    const bypassed = single(
      pokemon("breaker", "player", { ability: "MOLDBREAKER", moves: [{ move: growl, pp: growl.pp }] }),
      pokemon("gold", "opponent", { ability: "GOODASGOLD" }));
    expect(bypassed.state.teams.opponent.members[0]!.stages.attack).toBe(-1);

    const howl = { ...MINIMAL_MOVE_CATALOG.HOWL, targetCode: "10" };
    const selfBlocked = single(
      pokemon("gold", "player", { ability: "GOODASGOLD", moves: [{ move: howl, pp: howl.pp }] }),
      pokemon("target", "opponent"));
    expect(selfBlocked.state.teams.player.members[0]!.stages.attack).toBe(0);
    expect(selfBlocked.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "GOODASGOLD", effect: "block-move" });
  });

  it("lets Wonder Guard through only for strictly super-effective damage or Mold Breaker", () => {
    const neutral = move({ internalName: "NEUTRAL", name: "Neutre", type: "NORMAL" });
    const fire = move({ internalName: "FIRETEST", name: "Feu", type: "FIRE" });
    const wonder = pokemon("wonder", "opponent", { ability: "WONDERGUARD", types: ["BUG"] });
    const blocked = single(pokemon("attacker", "player", { moves: [{ move: neutral, pp: neutral.pp }] }), wonder);
    expect(blocked.state.teams.opponent.members[0]!.hp).toBe(240);
    expect(blocked.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "WONDERGUARD", effect: "block-move" });

    const effective = single(pokemon("attacker", "player", { moves: [{ move: fire, pp: fire.pp }] }), wonder);
    expect(effective.state.teams.opponent.members[0]!.hp).toBeLessThan(240);
    const bypassed = single(pokemon("breaker", "player", { ability: "MOLDBREAKER",
      moves: [{ move: neutral, pp: neutral.pp }] }), wonder);
    expect(bypassed.state.teams.opponent.members[0]!.hp).toBeLessThan(240);
  });

  it("keeps a spread move active against targets not protected by Wonder Guard", () => {
    const spread = move({ internalName: "SPREAD", name: "Zone", targetCode: "04" });
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: spread, pp: spread.pp }] }),
        pokemon("ally", "player")],
      opponent: [pokemon("wonder", "opponent", { ability: "WONDERGUARD" }),
        pokemon("open", "opponent")],
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

  it("turns draining recovery into Liquid Ooze damage without a Mold Breaker bypass", () => {
    const drain = move({ internalName: "ABSORB", name: "Vol-Vie", functionCode: "0DD",
      type: "GRASS", category: "Special", power: 40 });
    for (const ability of [null, "MOLDBREAKER"] as const) {
      const result = single(pokemon("drainer", "player", { ability, hp: 120,
        moves: [{ move: drain, pp: drain.pp }] }),
      pokemon("ooze", "opponent", { ability: "LIQUIDOOZE" }));
      const dealt = result.events.find((event) => event.type === "damageApplied")?.amount ?? 0;
      expect(result.state.teams.player.members[0]!.hp).toBe(120 - Math.round(dealt / 2));
      expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityDamage",
        ability: "LIQUIDOOZE", amount: Math.round(dealt / 2) }));
      expect(result.events).not.toContainEqual(expect.objectContaining({ type: "hpRestored", move: "ABSORB" }));
    }
  });

  it("returns Innards Out's total actual multi-hit HP loss to the attacker", () => {
    const doubleHit = move({ internalName: "DOUBLEHIT", name: "Coup Double", functionCode: "0BD", power: 80 });
    const result = single(pokemon("attacker", "player", { moves: [{ move: doubleHit, pp: doubleHit.pp }] }),
      pokemon("innards", "opponent", { ability: "INNARDSOUT", hp: 25 }));
    const actualDamage = result.events.filter((event) => event.type === "damageApplied")
      .reduce((total, event) => total + event.amount, 0);
    expect(actualDamage).toBe(25);
    expect(result.state.teams.player.members[0]!.hp).toBe(240 - actualDamage);
    expect(result.events).toContainEqual({ type: "abilityDamage", source: "opponent", target: "player",
      ability: "INNARDSOUT", amount: actualDamage, hp: 240 - actualDamage });

    const mutualKnockout = single(pokemon("attacker", "player", { hp: 10,
      moves: [{ move: doubleHit, pp: doubleHit.pp }] }),
    pokemon("innards", "opponent", { ability: "INNARDSOUT", hp: 25 }));
    expect(mutualKnockout.state).toMatchObject({ status: "finished", winner: null });
    expect(mutualKnockout.events).toContainEqual({ type: "fainted", side: "player" });
  });

  it("reflects opposing stat drops, keeps self changes local and yields to Mold Breaker", () => {
    const growl = { ...MINIMAL_MOVE_CATALOG.GROWL, accuracy: 0 };
    const reflected = single(pokemon("attacker", "player", { moves: [{ move: growl, pp: growl.pp }] }),
      pokemon("mirror", "opponent", { ability: "MIRRORARMOR" }));
    expect(reflected.state.teams.player.members[0]!.stages.attack).toBe(-1);
    expect(reflected.state.teams.opponent.members[0]!.stages.attack).toBe(0);
    expect(reflected.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "MIRRORARMOR", effect: "reflect-stat-drop" });

    const bypassed = single(pokemon("breaker", "player", { ability: "MOLDBREAKER",
      moves: [{ move: growl, pp: growl.pp }] }),
    pokemon("mirror", "opponent", { ability: "MIRRORARMOR" }));
    expect(bypassed.state.teams.opponent.members[0]!.stages.attack).toBe(-1);
    expect(bypassed.state.teams.player.members[0]!.stages.attack).toBe(0);

    const howl = { ...MINIMAL_MOVE_CATALOG.HOWL, targetCode: "10" };
    const selfChange = single(pokemon("mirror", "player", { ability: "MIRRORARMOR",
      moves: [{ move: howl, pp: howl.pp }] }), pokemon("target", "opponent"));
    expect(selfChange.state.teams.player.members[0]!.stages.attack).toBe(1);
  });

  it("reflects Intimidate on entry through the same stage-change contract", () => {
    const state = createTeamBattleState({
      player: [pokemon("intimidator", "player", { ability: "INTIMIDATE" })],
      opponent: [pokemon("mirror", "opponent", { ability: "MIRRORARMOR" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, highRolls);
    expect(result.state.teams.player.members[0]!.stages.attack).toBe(-1);
    expect(result.state.teams.opponent.members[0]!.stages.attack).toBe(0);
    const direct = resolveEntryAbility("player", pokemon("intimidator", "player", { ability: "INTIMIDATE" }),
      [{ side: "opponent", battler: pokemon("mirror", "opponent", { ability: "MIRRORARMOR" }) }],
      highRolls, []);
    expect(direct.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "MIRRORARMOR", effect: "reflect-stat-drop" });
  });
});
