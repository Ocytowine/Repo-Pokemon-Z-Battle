import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState, resolveDoubleTeamTurn,
  resolveTeamTurn, type BattleEffects, type BattleMove, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";
import { describe, expect, it } from "vitest";

class ScriptedRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) throw new Error(`Missing RNG for ${maxExclusive}.`);
    return value;
  }
}

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 160, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 110 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 160, majorStatus: null, ability: null, heldItem: null, moves: [{ move, pp: move.pp }], ...overrides };
}

const TAUNT: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TAUNT", name: "Provoc",
  functionCode: "0BA", power: 0, category: "Status", accuracy: 0, flags: "bc" };

function screens(): BattleEffects {
  return { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 5, lightScreenTurns: 5, luckyChantTurns: 0, safeguardTurns: 5 } }, waterSportTurns: 0 };
}

describe("source action-control abilities", () => {
  it("reflects Attract through Destiny Knot and clears each link when its source switches", () => {
    const attract: BattleMove = { ...TAUNT, internalName: "ATTRACT", name: "Attraction", functionCode: "016" };
    const state = createTeamBattleState({
      player: [pokemon("lover", "player", { appearance: { form: 0, shiny: false, gender: "male" },
        moves: [{ move: attract, pp: attract.pp }] }), pokemon("reserve", "player")],
      opponent: [pokemon("knot", "opponent", { heldItem: "DESTINYKNOT",
        appearance: { form: 0, shiny: false, gender: "female" } }), pokemon("other", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.opponent.members[0]!.volatile).toMatchObject({
      infatuated: true, infatuatedBy: "lover" });
    expect(result.state.teams.player.members[0]!.volatile).toMatchObject({
      infatuated: true, infatuatedBy: "knot" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "itemActivated", item: "DESTINYKNOT" }));
    const switched = resolveTeamTurn(result.state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(switched.state.teams.opponent.members[0]!.volatile?.infatuated).toBe(false);
  });

  it("retains the Destiny Knot source link in Duo and clears it when that slot switches", () => {
    const attract: BattleMove = { ...TAUNT, internalName: "ATTRACT", name: "Attraction", functionCode: "016" };
    const state = createDoubleTeamBattleState({
      player: [pokemon("lover", "player", { appearance: { form: 0, shiny: false, gender: "male" },
        moves: [{ move: attract, pp: attract.pp }] }), pokemon("ally", "player"), pokemon("reserve", "player")],
      opponent: [pokemon("knot", "opponent", { heldItem: "DESTINYKNOT",
        appearance: { form: 0, shiny: false, gender: "female" } }), pokemon("other", "opponent")],
    });
    const first = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 0]));
    expect(first.state.teams.opponent.members[0]!.volatile).toMatchObject({
      infatuated: true, infatuatedBy: "lover" });
    const second = resolveDoubleTeamTurn(first.state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "switch", teamIndex: 2 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(second.state.teams.opponent.members[0]!.volatile?.infatuated).toBe(false);
  });

  it("prevents Taunt with Oblivious and cures stale infatuation and Taunt state", () => {
    const state = createTeamBattleState({
      player: [pokemon("taunter", "player", { moves: [{ move: TAUNT, pp: TAUNT.pp }] })],
      opponent: [pokemon("oblivious", "opponent", { ability: "OBLIVIOUS" })],
    });
    const prevented = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(prevented.state.teams.opponent.members[0]!.volatile?.tauntTurns ?? 0).toBe(0);
    expect(prevented.events).toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "OBLIVIOUS", effect: "prevent-taunt" }));

    const stale = { ...prevented.state, teams: { ...prevented.state.teams,
      opponent: { ...prevented.state.teams.opponent, members: prevented.state.teams.opponent.members.map((member, index) =>
        index === 0 ? { ...member, volatile: { ...member.volatile!, infatuated: true, tauntTurns: 2 } } : member) } } };
    const cured = resolveTeamTurn(stale,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(cured.state.teams.opponent.members[0]!.volatile).toMatchObject({ infatuated: false, tauntTurns: 0 });

    const attract: BattleMove = { ...TAUNT, internalName: "ATTRACT", name: "Attraction", functionCode: "016" };
    const attracted = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("lover", "player", { appearance: { form: 0, shiny: false, gender: "male" },
        moves: [{ move: attract, pp: attract.pp }] })],
      opponent: [pokemon("oblivious", "opponent", { ability: "OBLIVIOUS",
        appearance: { form: 0, shiny: false, gender: "female" } })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(attracted.state.teams.opponent.members[0]!.volatile?.infatuated ?? false).toBe(false);
  });

  it("reflects source Magic Coat moves with Magic Bounce, including in double battles", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("taunter", "player", { moves: [{ move: TAUNT, pp: TAUNT.pp }] }), pokemon("ally", "player")],
      opponent: [pokemon("mirror", "opponent", { ability: "MAGICBOUNCE" }), pokemon("ally2", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 0]));
    expect(result.state.teams.player.members[0]!.volatile?.tauntTurns).toBe(3);
    expect(result.state.teams.opponent.members[0]!.volatile?.tauntTurns ?? 0).toBe(0);
    expect(result.events).toContainEqual(expect.objectContaining({ events: expect.arrayContaining([
      expect.objectContaining({ type: "abilityActivated", ability: "MAGICBOUNCE", effect: "reflect-move" }),
    ]) }));

    const bypassed = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("breaker", "player", { ability: "MOLDBREAKER", moves: [{ move: TAUNT, pp: TAUNT.pp }] })],
      opponent: [pokemon("mirror", "opponent", { ability: "MAGICBOUNCE" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(bypassed.state.teams.opponent.members[0]!.volatile?.tauntTurns).toBe(3);
    expect(bypassed.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "MAGICBOUNCE" }));
  });

  it("lets Infiltrator ignore Reflect and Light Screen", () => {
    const physical = (ability: BattlerState["ability"]): number => {
      const result = resolveTeamTurn({ ...createTeamBattleState({
        player: [pokemon("attacker", "player", { ability })], opponent: [pokemon("target", "opponent")],
      }), effects: screens() },
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([1, 15]));
      return 160 - result.state.teams.opponent.members[0]!.hp;
    };
    expect(physical("INFILTRATOR")).toBeGreaterThan(physical(null));

    const special: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SPECIALHIT",
      category: "Special", accuracy: 0 };
    const specialDamage = (ability: BattlerState["ability"]): number => {
      const result = resolveTeamTurn({ ...createTeamBattleState({
        player: [pokemon("attacker", "player", { ability, moves: [{ move: special, pp: special.pp }] })],
        opponent: [pokemon("target", "opponent")],
      }), effects: screens() },
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([1, 15]));
      return 160 - result.state.teams.opponent.members[0]!.hp;
    };
    expect(specialDamage("INFILTRATOR")).toBeGreaterThan(specialDamage(null));

    const poison: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "POISONPOWDER",
      functionCode: "005", power: 0, category: "Status", accuracy: 0, flags: "bc" };
    const status = (ability: BattlerState["ability"]): BattlerState["majorStatus"] => resolveTeamTurn({
      ...createTeamBattleState({
        player: [pokemon("attacker", "player", { ability, moves: [{ move: poison, pp: poison.pp }] })],
        opponent: [pokemon("target", "opponent")],
      }), effects: screens() },
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]))
      .state.teams.opponent.members[0]!.majorStatus;
    expect(status(null)).toBeNull();
    expect(status("INFILTRATOR")).toEqual({ kind: "poison", toxicCounter: null });
  });

  it("disables the damaging move with Cursed Body on the source 30 percent roll", () => {
    const state = createTeamBattleState({ player: [pokemon("attacker", "player")],
      opponent: [pokemon("cursed", "opponent", { ability: "CURSEDBODY" })] });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([1, 15, 0]));
    expect(result.state.teams.player.members[0]!.volatile).toMatchObject({ disabledMove: "TACKLE", disableTurns: 2 });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "CURSEDBODY", effect: "disable-move" }));
  });

  it("adds Stench flinch only to moves without an intrinsic flinch effect", () => {
    const state = createTeamBattleState({ player: [pokemon("stench", "player", { ability: "STENCH" })],
      opponent: [pokemon("target", "opponent")] });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 0]));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "STENCH", effect: "inflict-flinch" }));
    expect(result.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "flinch" });

    const fakeOut: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FAKEOUT",
      functionCode: "012", accuracy: 0, effectChance: 100 };
    const excluded = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("stench", "player", { ability: "STENCH", moves: [{ move: fakeOut, pp: fakeOut.pp }] })],
      opponent: [pokemon("target", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15, 0]));
    expect(excluded.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "STENCH" }));
  });
});
