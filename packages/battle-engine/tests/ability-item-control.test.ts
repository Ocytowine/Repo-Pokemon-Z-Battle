import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { RESIST_BERRY_TYPES } from "../src/battle-berries.js";

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

describe("source PP and held-item control abilities", () => {
  it("maps every reachable source type-resistance berry, including Chilan", () => {
    expect(Object.keys(RESIST_BERRY_TYPES)).toHaveLength(17);
    expect(RESIST_BERRY_TYPES.PAYAPABERRY).toBe("PSYCHIC");
    expect(RESIST_BERRY_TYPES.CHILANBERRY).toBe("NORMAL");
    expect(RESIST_BERRY_TYPES.ROSELIBERRY).toBeUndefined();
  });

  it("halves a matching super-effective hit once and consumes the resistance berry", () => {
    const fire = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "FIRE", accuracy: 0 };
    const fight = (item: BattlerState["heldItem"]) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: fire, pp: fire.pp }] })],
      opponent: [pokemon("target", "opponent", { types: ["GRASS"], heldItem: item })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15]));
    const bare = fight(null);
    const resisted = fight("OCCABERRY");
    const hit = (events: typeof bare.events) => events.find((event) => event.type === "damageApplied");
    const bareHit = hit(bare.events);
    const resistedHit = hit(resisted.events);
    if (bareHit?.type !== "damageApplied" || resistedHit?.type !== "damageApplied")
      throw new Error("Attaque de test sans dégât.");
    expect(resistedHit.amount).toBeLessThan(bareHit.amount);
    expect(resisted.state.teams.opponent.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "OCCABERRY" });
    expect(resisted.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "OCCABERRY", effect: "weaken" }));
  });

  it("keeps a resistance berry inert under Magic Room", () => {
    const fire = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "FIRE", accuracy: 0 };
    const base = createTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: fire, pp: fire.pp }] })],
      opponent: [pokemon("target", "opponent", { types: ["GRASS"], heldItem: "OCCABERRY" })],
    });
    const initialized = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("setup", "player")], opponent: [pokemon("setup-foe", "opponent")],
    }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([])).state.effects!;
    const result = resolveTeamTurn({ ...base, effects: { ...initialized, magicRoomTurns: 2 } },
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([1, 15]));
    expect(result.state.teams.opponent.members[0]!.heldItem).toBe("OCCABERRY");
  });

  it("uses Chilan on a neutral Normal hit, unlike the weakness-only berries", () => {
    const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const result = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move, pp: move.pp }] })],
      opponent: [pokemon("target", "opponent", { heldItem: "CHILANBERRY" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15]));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "CHILANBERRY", effect: "weaken" }));
  });

  it("heals with Enigma after a super-effective hit and retaliates with Jaboca/Rowap", () => {
    for (const [berry, category] of [["JABOCABERRY", "Physical"], ["ROWAPBERRY", "Special"]] as const) {
      const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, category, accuracy: 0 };
      const result = resolveTeamTurn(createTeamBattleState({
        player: [pokemon("attacker", "player", { moves: [{ move, pp: move.pp }] })],
        opponent: [pokemon("target", "opponent", { heldItem: berry })],
      }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
      new ScriptedRandom([1, 15]));
      expect(result.state.teams.player.members[0]!.hp).toBe(140);
      expect(result.state.teams.opponent.members[0]!.heldItem).toBeNull();
      expect(result.events).toContainEqual(expect.objectContaining({ type: "itemActivated",
        item: berry, effect: "damage", amount: 20 }));
    }
    const fire = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "FIRE", accuracy: 0 };
    const healed = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: fire, pp: fire.pp }] })],
      opponent: [pokemon("target", "opponent", { hp: 100, types: ["GRASS"], heldItem: "ENIGMABERRY" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15]));
    expect(healed.events).toContainEqual(expect.objectContaining({ type: "itemActivated",
      item: "ENIGMABERRY", effect: "heal", amount: 40 }));
    expect(healed.state.teams.opponent.members[0]!.heldItem).toBeNull();
  });

  it("spends Micle's 20% accuracy boost on the next accuracy check", () => {
    const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 60 };
    const result = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("attacker", "player", { hp: 40, heldItem: "MICLEBERRY",
        moves: [{ move, pp: move.pp }] })],
      opponent: [pokemon("target", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([65, 1, 15]));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "damageApplied" }));
    expect(result.state.teams.player.members[0]!.volatile?.micleBerry).toBe(false);
  });

  it.each([
    ["FIGYBERRY", "spicy"], ["WIKIBERRY", "dry"], ["MAGOBERRY", "sweet"],
    ["AGUAVBERRY", "bitter"], ["IAPAPABERRY", "sour"],
  ] as const)("heals with %s and confuses only a Pokémon disliking %s", (berry, flavor) => {
    const state = createTeamBattleState({
      player: [pokemon("berry", "player", { hp: 80, heldItem: berry, berryFlavorDislike: flavor })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([0]));
    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 100, heldItem: null,
      volatile: { confusionTurns: 2 } });
  });

  it("activates Lansat, Micle and Starf at their source pinch threshold", () => {
    for (const berry of ["LANSATBERRY", "MICLEBERRY", "STARFBERRY"] as const) {
      const state = createTeamBattleState({
        player: [pokemon("berry", "player", { hp: 40, heldItem: berry })],
        opponent: [pokemon("foe", "opponent")],
      });
      const result = resolveTeamTurn(state,
        { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([0]));
      const member = result.state.teams.player.members[0]!;
      expect(member.heldItem).toBeNull();
      if (berry === "LANSATBERRY") expect(member.volatile?.focusEnergy).toBe(2);
      if (berry === "MICLEBERRY") expect(member.volatile?.micleBerry).toBe(true);
      if (berry === "STARFBERRY") expect(member.stages.attack).toBe(2);
    }
  });

  it("lets a slow Custap holder act first within its priority bracket", () => {
    const state = createTeamBattleState({
      player: [pokemon("custap", "player", { hp: 40, heldItem: "CUSTAPBERRY",
        stats: { ...pokemon("custap", "player").stats, speed: 10 } })],
      opponent: [pokemon("fast", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 15]));
    expect(result.events.find((event) => event.type === "moveUsed")).toMatchObject({ side: "player" });
    expect(result.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "CUSTAPBERRY" });
  });

  it("orders Custap in double battles across the positioned slots", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("custap", "player", { hp: 40, heldItem: "CUSTAPBERRY",
        stats: { ...pokemon("custap", "player").stats, speed: 10 } }), pokemon("ally", "player")],
      opponent: [pokemon("fast", "opponent"), pokemon("foe2", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 0, 1, 15, 1, 15]));
    const firstMove = result.events.find((event) => event.type === "positionedActionResolved"
      && event.events.some((inner) => inner.type === "moveUsed"));
    expect(firstMove).toMatchObject({ actor: { side: "player", slot: 0 } });
    expect(result.state.teams.player.members[0]!.heldItem).toBeNull();
  });
  it("makes an opposing move spend two PP with Pressure but leaves self-targeting moves unchanged", () => {
    const state = createTeamBattleState({
      player: [pokemon("attacker", "player")], opponent: [pokemon("pressure", "opponent", { ability: "PRESSURE" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([1, 15]));
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(MINIMAL_MOVE_CATALOG.TACKLE.pp - 2);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "PRESSURE",
      effect: "pressure" }));

    const focus: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FOCUSENERGY",
      name: "Puissance", functionCode: "048", power: 0, category: "Status", targetCode: "10" };
    const selfState = createTeamBattleState({
      player: [pokemon("focused", "player", { moves: [{ move: focus, pp: focus.pp }] })],
      opponent: [pokemon("pressure", "opponent", { ability: "PRESSURE" })],
    });
    const selfResult = resolveTeamTurn(selfState,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([0]));
    expect(selfResult.state.teams.player.members[0]!.moves[0]!.pp).toBe(focus.pp - 1);
  });

  it("charges one additional PP for each Pressure target of a spread move", () => {
    const spread: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, targetCode: "04", accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: spread, pp: spread.pp }] }), pokemon("ally", "player")],
      opponent: [pokemon("pressure1", "opponent", { ability: "PRESSURE" }),
        pokemon("pressure2", "opponent", { ability: "PRESSURE" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 1, 15, 1, 15]));
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(spread.pp - 3);

    const lastPpState = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: spread, pp: 1 }] }), pokemon("ally", "player")],
      opponent: [pokemon("pressure1", "opponent", { ability: "PRESSURE" }),
        pokemon("pressure2", "opponent", { ability: "PRESSURE" })],
    });
    const lastPpResult = resolveDoubleTeamTurn(lastPpState, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 1, 15, 1, 15]));
    expect(lastPpResult.state.teams.player.members[0]!.moves[0]!.pp).toBe(0);
    expect(lastPpResult.state.teams.opponent.members.slice(0, 2).every((member) => member.hp < member.stats.maxHp)).toBe(true);
  });

  it("blocks opposing berries with Unnerve and lets them reactivate after it leaves", () => {
    const state = createTeamBattleState({
      player: [pokemon("berry", "player", { hp: 60, heldItem: "ORANBERRY" })],
      opponent: [pokemon("unnerve", "opponent", { ability: "UNNERVE" }), pokemon("reserve", "opponent")],
    });
    const blocked = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(blocked.state.teams.player.members[0]).toMatchObject({ hp: 60, heldItem: "ORANBERRY" });
    const released = resolveTeamTurn(blocked.state,
      { player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 1 } }, new ScriptedRandom([]));
    expect(released.state.teams.player.members[0]).toMatchObject({ hp: 70, heldItem: null });
  });

  it("heals with Sitrus only at half HP and preserves its recycling history", () => {
    const state = createTeamBattleState({
      player: [pokemon("berry", "player", { hp: 80, heldItem: "SITRUSBERRY" })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 120, heldItem: null,
      recyclableItem: "SITRUSBERRY" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      side: "player", item: "SITRUSBERRY", effect: "heal" }));
  });

  it.each([
    ["CHESTOBERRY", "sleep"], ["PECHABERRY", "poison"], ["RAWSTBERRY", "burn"],
    ["CHERIBERRY", "paralysis"], ["ASPEARBERRY", "frozen"], ["LUMBERRY", "caduco"],
  ] as const)("cures %s's matching status in the shared battle state", (berry, kind) => {
    const majorStatus = kind === "sleep" ? { kind, turnsRemaining: 2 } as const
      : kind === "poison" ? { kind, toxicCounter: null } as const : { kind } as const;
    const state = createTeamBattleState({
      player: [pokemon("berry", "player", { majorStatus, heldItem: berry })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ majorStatus: null, heldItem: null,
      recyclableItem: berry });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "statusCured", side: "player", status: kind }));
  });

  it("restores the first empty move with Leppa and keeps the restored PP in the snapshot", () => {
    const state = createTeamBattleState({
      player: [pokemon("berry", "player", { heldItem: "LEPPABERRY",
        moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 0 }] })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "LEPPABERRY", moves: [{ pp: 10 }] });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "ppChanged", side: "player", pp: 10 }));
  });

  it("cures confusion with Persim and both ailments with Lum without losing the second cure", () => {
    for (const berry of ["PERSIMBERRY", "LUMBERRY"] as const) {
      const state = createTeamBattleState({
        player: [pokemon("berry", "player", { heldItem: berry,
          majorStatus: berry === "LUMBERRY" ? { kind: "burn" } : null,
          volatile: { confusionTurns: 2, flinched: false, focusEnergy: 0, identified: false,
            disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
            bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null } })],
        opponent: [pokemon("foe", "opponent")],
      });
      const result = resolveTeamTurn(state,
        { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
      expect(result.state.teams.player.members[0]).toMatchObject({ heldItem: null,
        majorStatus: null, volatile: { confusionTurns: 0 } });
      expect(result.events).toContainEqual(expect.objectContaining({ type: "volatileEnded",
        side: "player", effect: "confusion" }));
    }
  });

  it("keeps Leppa and a status berry inactive under Unnerve and Magic Room", () => {
    for (const [berry, blockedByRoom] of [["LEPPABERRY", false], ["PECHABERRY", true]] as const) {
      const member = pokemon("berry", "player", { heldItem: berry,
        ...(berry === "LEPPABERRY" ? { moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 0 }] }
          : { majorStatus: { kind: "poison", toxicCounter: null } }) });
      const opponent = pokemon("foe", "opponent", blockedByRoom ? {} : { ability: "UNNERVE" });
      const state = createTeamBattleState({ player: [member], opponent: [opponent] });
      const initialized = blockedByRoom ? resolveTeamTurn(createTeamBattleState({
        player: [pokemon("setup", "player")], opponent: [pokemon("setup-foe", "opponent")],
      }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([])).state.effects : undefined;
      const result = resolveTeamTurn({ ...state,
        ...(blockedByRoom ? { effects: { ...initialized!, magicRoomTurns: 2 } } : {}) },
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
      expect(result.state.teams.player.members[0]!.heldItem).toBe(berry);
    }
  });

  it("activates a pinch stat berry after damage crosses quarter HP, before the next action", () => {
    const state = createTeamBattleState({
      player: [pokemon("attacker", "player")],
      opponent: [pokemon("berry", "opponent", { hp: 41, heldItem: "SALACBERRY" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([1, 15]));
    const damage = result.events.find((event) => event.type === "damageApplied");
    expect(damage?.type === "damageApplied" && damage.hp).toBeLessThanOrEqual(40);
    expect(result.state.teams.opponent.members[0]!.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      side: "opponent", item: "SALACBERRY" }));
  });

  it("applies status berries in double battles to the affected slot only", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("berry", "player", { heldItem: "PECHABERRY",
        majorStatus: { kind: "poison", toxicCounter: null } }), pokemon("ally", "player")],
      opponent: [pokemon("foe1", "opponent"), pokemon("foe2", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ majorStatus: null, heldItem: null });
    expect(result.state.teams.player.members[1]!.heldItem).toBeNull();
  });

  it.each([
    ["GANLONBERRY", "defense"], ["SALACBERRY", "speed"],
    ["PETAYABERRY", "specialAttack"], ["APICOTBERRY", "specialDefense"],
  ] as const)("boosts %s's %s in the shared passive hook", (berry, stat) => {
    const state = createTeamBattleState({
      player: [pokemon("berry", "player", { hp: 40, heldItem: berry })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]!.stages[stat]).toBe(1);
    expect(result.state.teams.player.members[0]!.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed", item: berry }));
  });

  it("suppresses Sitrus and pinch berries in Magic Room in both double slots", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("sitrus", "player", { hp: 70, heldItem: "SITRUSBERRY" }),
        pokemon("salac", "player", { hp: 35, heldItem: "SALACBERRY" })],
      opponent: [pokemon("foe1", "opponent"), pokemon("foe2", "opponent")],
    });
    const suppressed = resolveDoubleTeamTurn({ ...state, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, magicRoomTurns: 2 } }, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(suppressed.state.teams.player.members.slice(0, 2).map((member) => member.heldItem))
      .toEqual(["SITRUSBERRY", "SALACBERRY"]);
    expect(suppressed.state.effects?.magicRoomTurns).toBe(1);
  });

  it("lets one Unnerve bearer block both opposing berries in double battles", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("unnerve", "player", { ability: "UNNERVE" }), pokemon("ally", "player")],
      opponent: [pokemon("berry1", "opponent", { hp: 60, heldItem: "ORANBERRY" }),
        pokemon("berry2", "opponent", { hp: 60, heldItem: "ORANBERRY" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(result.state.teams.opponent.members.slice(0, 2).map((member) => [member.hp, member.heldItem]))
      .toEqual([[60, "ORANBERRY"], [60, "ORANBERRY"]]);
  });

  it("lets an ally's Unnerve block a defensive berry in a double battle", () => {
    const psychic: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "PSYCHICSTRIKE",
      type: "PSYCHIC", targetCode: "00", accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: psychic, pp: psychic.pp }] }),
        pokemon("unnerve", "player", { ability: "UNNERVE" })],
      opponent: [pokemon("berry", "opponent", { types: ["POISON"], heldItem: "PAYAPABERRY" }),
        pokemon("ally", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 1, 15]));
    expect(result.state.teams.opponent.members[0]!.heldItem).toBe("PAYAPABERRY");
  });

  it("makes held items inert with Klutz without removing them", () => {
    const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const target = pokemon("target", "opponent");
    const damage = (ability: BattlerState["ability"], heldItem: BattlerState["heldItem"]): number =>
      calculateDamage("player", pokemon("attacker", "player", { ability, heldItem }), target, move,
        new ScriptedRandom([1, 15]), [], { reflect: false, lightScreen: false, luckyChant: false,
          mudSport: false, waterSport: false });
    expect(damage("KLUTZ", "LIFEORB")).toBe(damage(null, null));
    expect(damage(null, "LIFEORB")).toBeGreaterThan(damage("KLUTZ", "LIFEORB"));

    const state = createTeamBattleState({
      player: [pokemon("klutz", "player", { ability: "KLUTZ", hp: 60, heldItem: "ORANBERRY" })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 60, heldItem: "ORANBERRY" });
  });

  it("doubles Unburden speed after an item is consumed and resets it on switch", () => {
    const fighting: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FIGHTINGHIT",
      type: "FIGHTING", accuracy: 0 };
    const state = createTeamBattleState({
      player: [pokemon("unburden", "player", { ability: "UNBURDEN", heldItem: "FIGHTINGGEM",
        stats: { ...pokemon("unburden", "player").stats, speed: 60 }, moves: [{ move: fighting, pp: fighting.pp }] }),
        pokemon("reserve", "player")],
      opponent: [pokemon("fast", "opponent", { stats: { ...pokemon("fast", "opponent").stats, speed: 90 } })],
    });
    const consumed = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 15]));
    expect(consumed.events).toContainEqual({ type: "teamActionOrdered", order: [
      { side: "opponent", kind: "move" }, { side: "player", kind: "move" },
    ] });
    expect(consumed.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "FIGHTINGGEM", volatile: { unburdened: true } });
    const accelerated = resolveTeamTurn(consumed.state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 15]));
    expect(accelerated.events).toContainEqual({ type: "teamActionOrdered", order: [
      { side: "player", kind: "move" }, { side: "opponent", kind: "move" },
    ] });
    const switched = resolveTeamTurn(accelerated.state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    const returned = resolveTeamTurn(switched.state,
      { player: { kind: "switch", teamIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(returned.state.teams.player.members[0]!.volatile?.unburdened).not.toBe(true);
  });

  it("lets Pickup recover the latest item consumed by another active battler", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("pickup", "player", { ability: "PICKUP" }), pokemon("ally", "player")],
      opponent: [pokemon("oran", "opponent", { hp: 60, heldItem: "ORANBERRY" }),
        pokemon("liechi", "opponent", { hp: 30, heldItem: "LIECHIBERRY" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]!.heldItem).toBe("LIECHIBERRY");
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      events: expect.arrayContaining([{ type: "heldItemRecovered", side: "player", item: "LIECHIBERRY",
        ability: "PICKUP" }]) }));
  });

  it("restores a consumed berry with Harvest and immediately checks its activation", () => {
    const state = createTeamBattleState({
      player: [pokemon("harvest", "player", { ability: "HARVEST", hp: 60, heldItem: "ORANBERRY" })],
      opponent: [pokemon("foe", "opponent")],
    });
    const sunny = { ...state, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 }, opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, weather: "sun" as const, weatherTurns: 5 } };
    const result = resolveTeamTurn(sunny,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 80, heldItem: null,
      recyclableItem: "ORANBERRY", volatile: { unburdened: true } });
    expect(result.events).toContainEqual({ type: "heldItemRecovered", side: "player",
      item: "ORANBERRY", ability: "HARVEST" });
  });
});
