import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, activeBattlePositions, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, switchTrapAbility,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState, type RandomSource } from "../src/index.js";
import { resolveLateEndOfTurnAbilities } from "../src/ability-end-turn.js";

class ScriptedRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++] ?? 0;
    if (value < 0 || value >= maxExclusive) throw new Error(`Invalid RNG ${value}/${maxExclusive}.`);
    return value;
  }
}

const zero: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0,
      accuracy: 0, evasion: 0 }, hp: 200, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides };
}

function waits(state: ReturnType<typeof createDoubleTeamBattleState>) {
  return activeBattlePositions(state).map((actor) => ({ actor, action: { kind: "wait" as const } }));
}

describe("Pokemon Z recoil, absorption, cycles and switch traps", () => {
  it("lets Cabeza Hielo suppress generic recoil without suppressing damage", () => {
    const recoil: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "DOUBLEEDGE",
      name: "Damocles", functionCode: "0FC", accuracy: 0 };
    const state = createTeamBattleState({ player: [pokemon("user", "player", { ability: "CABEZAHIELO",
      moves: [{ move: recoil, pp: recoil.pp }] })], opponent: [pokemon("target", "opponent")] });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(200);
    expect(result.state.teams.player.members[0]!.hp).toBe(200);
    expect(result.events.some((event) => event.type === "recoilDamage")).toBe(false);
  });

  it("absorbs Fire with Despierta Llama, while Mold Breaker bypasses it", () => {
    const fire = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "EMBER", name: "Flammèche",
      type: "FIRE", category: "Special" as const, accuracy: 0 };
    const defend = (ability: BattlerState["ability"]) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", "player", { ability, moves: [{ move: fire, pp: fire.pp }] })],
      opponent: [pokemon("target", "opponent", { ability: "DESPIERTALLAMA" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
    const absorbed = defend(null);
    expect(absorbed.state.teams.opponent.members[0]!.hp).toBe(200);
    expect(absorbed.state.teams.opponent.members[0]!.stages.specialAttack).toBe(1);
    expect(absorbed.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "DESPIERTALLAMA", effect: "absorb-type" });
    expect(defend("MOLDBREAKER").state.teams.opponent.members[0]!.hp).toBeLessThan(200);
  });

  it("gives Despierta Llama priority over Storm Drain when redirecting Water in doubles", () => {
    const attacker = pokemon("user", "player");
    const water = { ...attacker.moves[0]!.move, type: "WATER", internalName: "WATERGUN" };
    const state = createDoubleTeamBattleState({
      player: [{ ...attacker, moves: [{ move: water, pp: water.pp }] },
        pokemon("flame", "player", { ability: "DESPIERTALLAMA" })],
      opponent: [pokemon("intended", "opponent"), pokemon("drain", "opponent", { ability: "STORMDRAIN" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      ...waits(state).filter(({ actor }) => !(actor.side === "player" && actor.slot === 0)),
    ], zero);
    expect(result.state.teams.player.members[1]!.hp).toBeLessThan(200);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(200);
    expect(result.state.teams.opponent.members[1]!.stages.specialAttack).toBe(0);
  });

  it("uses two deterministic, distinct eligible Moody draws", () => {
    const trace: BattleTrace[] = [];
    const result = resolveLateEndOfTurnAbilities(pokemon("moody", "player", { ability: "MOODY",
      stages: { attack: 6, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0,
        accuracy: 0, evasion: -6 } }), "player", [], new ScriptedRandom([0, 4]), trace);
    expect(result.battler.stages.defense).toBe(2);
    expect(result.battler.stages.accuracy).toBe(-1);
    expect(result.battler.stages.attack).toBe(6);
    expect(result.battler.stages.evasion).toBe(-6);
    expect(trace).toEqual([
      { type: "rng", purpose: "ability", maxExclusive: 6, value: 0 },
      { type: "rng", purpose: "ability", maxExclusive: 5, value: 4 },
    ]);
    expect(result.events[0]).toEqual({ type: "abilityActivated", side: "player",
      ability: "MOODY", effect: "randomize-stats" });
  });

  it("alternates Truant, resets it on switch, and persists its authoritative volatile state", () => {
    let state = createTeamBattleState({ player: [pokemon("truant", "player", { ability: "TRUANT" }),
      pokemon("reserve", "player")], opponent: [pokemon("foe", "opponent")] });
    const act = () => resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
    let result = act();
    state = result.state;
    expect(state.teams.player.members[0]!.volatile?.truantLoafing).toBe(true);
    result = act();
    state = result.state;
    expect(result.events).toContainEqual({ type: "actionSkipped", side: "player", reason: "truant" });
    expect(state.teams.player.members[0]!.volatile?.truantLoafing).toBe(false);
    state = resolveTeamTurn(state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, zero).state;
    state = resolveTeamTurn(state,
      { player: { kind: "switch", teamIndex: 0 }, opponent: { kind: "wait" } }, zero).state;
    expect(state.teams.player.members[0]!.volatile?.truantLoafing ?? false).toBe(false);
    expect(structuredClone(state).teams.player.members[0]!.volatile?.truantLoafing ?? false).toBe(false);
  });

  it("shares all switch-trap exemptions and rejects voluntary switches in single and double battles", () => {
    const trapped = pokemon("trapped", "player", { types: ["STEEL"] });
    expect(switchTrapAbility(trapped, [pokemon("magnet", "opponent", { ability: "MAGNETPULL" })]))
      .toBe("MAGNETPULL");
    expect(switchTrapAbility({ ...trapped, types: ["GHOST", "STEEL"] },
      [pokemon("magnet", "opponent", { ability: "MAGNETPULL" })])).toBeNull();
    expect(switchTrapAbility({ ...trapped, heldItem: "SHEDSHELL" },
      [pokemon("magnet", "opponent", { ability: "MAGNETPULL" })])).toBeNull();
    expect(switchTrapAbility(pokemon("air", "player", { types: ["FLYING"] }),
      [pokemon("arena", "opponent", { ability: "ARENATRAP" })])).toBeNull();
    expect(switchTrapAbility(pokemon("shadow", "player", { ability: "SHADOWTAG" }),
      [pokemon("foe-shadow", "opponent", { ability: "SHADOWTAG" })])).toBeNull();

    const single = createTeamBattleState({ player: [trapped, pokemon("reserve", "player")],
      opponent: [pokemon("magnet", "opponent", { ability: "MAGNETPULL" })] });
    expect(() => resolveTeamTurn(single,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, zero)).toThrow(/MAGNETPULL/u);

    const double = createDoubleTeamBattleState({
      player: [pokemon("grounded", "player"), pokemon("ally", "player"), pokemon("reserve", "player")],
      opponent: [pokemon("arena", "opponent", { ability: "ARENATRAP" }), pokemon("other", "opponent")],
    });
    expect(() => resolveDoubleTeamTurn(double, [
      { actor: { side: "player", slot: 0 }, action: { kind: "switch", teamIndex: 2 } },
      ...waits(double).filter(({ actor }) => !(actor.side === "player" && actor.slot === 0)),
    ], zero)).toThrow(/ARENATRAP/u);
  });
});
