import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";
import { effectiveWeight } from "../src/damage.js";

const zero: RandomSource = { nextInt: () => 0 };

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id: side, species: side === "player" ? "EEVEE" : "MEOWTH", name: side, level: 50,
    types: ["NORMAL"], stats: { maxHp: 500, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 500, majorStatus: null, ability: null,
    heldItem: null, moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 35 }], ...overrides };
}

function statusMove(functionCode: BattleMove["functionCode"], internalName: string): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.GROWL, functionCode, internalName, name: internalName,
    category: "Status", power: 0, accuracy: 0, effectChance: 0 };
}

function resolvePlayerMove(player: BattlerState, opponent = battler("opponent")) {
  return resolveTeamTurn(createTeamBattleState({ player: [player], opponent: [opponent] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
}

describe("Pokemon Z stat-stage move functions", () => {
  it.each([
    ["052", ["attack", "specialAttack"]],
    ["053", ["defense", "specialDefense"]],
    ["054", ["attack", "defense", "specialAttack", "specialDefense", "speed", "accuracy", "evasion"]],
  ] as const)("swaps the selected %s stages without applying Contrary", (code, stats) => {
    const move = statusMove(code, `MOVE${code}`);
    const user = battler("player", { ability: "CONTRARY", moves: [{ move, pp: 10 }],
      stages: { attack: 3, defense: 2, specialAttack: 1, specialDefense: -1,
        speed: 4, accuracy: -2, evasion: 5 } });
    const target = battler("opponent", { stages: { attack: -3, defense: -2, specialAttack: -1,
      specialDefense: 1, speed: -4, accuracy: 2, evasion: -5 } });
    const result = resolvePlayerMove(user, target);
    for (const stat of stats) {
      expect(result.state.teams.player.members[0]!.stages[stat]).toBe(target.stages[stat]);
      expect(result.state.teams.opponent.members[0]!.stages[stat]).toBe(user.stages[stat]);
    }
  });

  it("copies all target stages with Psych Up, including through Contrary", () => {
    const move = statusMove("055", "PSYCHUP");
    const user = battler("player", { ability: "CONTRARY", moves: [{ move, pp: 10 }] });
    const target = battler("opponent", { stages: { attack: 4, defense: -3,
      specialAttack: 1, specialDefense: -2, speed: 5, accuracy: -1, evasion: 6 } });
    const result = resolvePlayerMove(user, target);
    expect(result.state.teams.player.members[0]!.stages).toEqual(target.stages);
    expect(result.state.teams.opponent.members[0]!.stages).toEqual(target.stages);
  });

  it("toggles Power Trick and restores base stats on withdrawal", () => {
    const move = { ...statusMove("057", "POWERTRICK"), targetCode: "10" };
    const user = battler("player", { stats: { ...battler("player").stats,
      attack: 81, defense: 150 }, moves: [{ move, pp: 10 }] });
    const state = createTeamBattleState({ player: [user, { ...battler("player"), id: "reserve" }],
      opponent: [battler("opponent")] });
    const used = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, zero);
    expect(used.state.teams.player.members[0]!.stats).toMatchObject({ attack: 150, defense: 81 });
    expect(used.state.teams.player.members[0]!.volatile?.powerTrick).toBe(true);
    const toggled = resolveTeamTurn(used.state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, zero);
    expect(toggled.state.teams.player.members[0]!.stats).toMatchObject({ attack: 81, defense: 150 });
    const switched = resolveTeamTurn(used.state, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "wait" } }, zero);
    expect(switched.state.teams.player.members[0]!.stats).toMatchObject({ attack: 81, defense: 150 });
    expect(switched.state.teams.player.members[0]!.volatile).toBeUndefined();
  });

  it.each([
    ["058", "attack", "specialAttack"], ["059", "defense", "specialDefense"],
  ] as const)("averages %s actual stats with floor and restores both battlers on switch", (code, first, second) => {
    const move = statusMove(code, `MOVE${code}`);
    const user = battler("player", { stats: { ...battler("player").stats,
      [first]: 81, [second]: 53 }, moves: [{ move, pp: 10 }] });
    const target = battler("opponent", { stats: { ...battler("opponent").stats,
      [first]: 140, [second]: 80 } });
    const state = createTeamBattleState({ player: [user, { ...battler("player"), id: "reserve" }],
      opponent: [target, { ...battler("opponent"), id: "enemy-reserve" }] });
    const used = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, zero);
    for (const side of ["player", "opponent"] as const) {
      expect(used.state.teams[side].members[0]!.stats[first]).toBe(110);
      expect(used.state.teams[side].members[0]!.stats[second]).toBe(66);
    }
    const switched = resolveTeamTurn(used.state, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "switch", teamIndex: 1 } }, zero);
    expect(switched.state.teams.player.members[0]!.stats[first]).toBe(81);
    expect(switched.state.teams.opponent.members[0]!.stats[first]).toBe(140);
  });

  it("applies Guard Split only to the selected opponent slot in doubles", () => {
    const move = statusMove("059", "GUARDSPLIT");
    const state = createDoubleTeamBattleState({
      player: [battler("player", { moves: [{ move, pp: 10 }] }),
        { ...battler("player"), id: "ally" }],
      opponent: [battler("opponent", { stats: { ...battler("opponent").stats, defense: 200 } }),
        { ...battler("opponent"), id: "other", stats: { ...battler("opponent").stats, defense: 300 } }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], zero);
    expect(result.state.teams.player.members[0]!.stats.defense).toBe(200);
    expect(result.state.teams.opponent.members[0]!.stats.defense).toBe(200);
    expect(result.state.teams.opponent.members[1]!.stats.defense).toBe(200);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "positionedActionResolved", actor: { side: "player", slot: 0 },
      targets: [{ side: "opponent", slot: 1 }],
    }));
  });
  it("draws Acupressure from only eligible stages with an authoritative trace", () => {
    const move = { ...statusMove("037", "ACUPRESSURE"), targetCode: "200" };
    const user = battler("player", { stages: { attack: 6, defense: 6, specialAttack: 6,
      specialDefense: 6, speed: 6, accuracy: 6, evasion: 0 },
      moves: [{ move, pp: 10 }] });
    const raised = resolvePlayerMove(user);
    expect(raised.state.teams.player.members[0]!.stages.evasion).toBe(2);
    expect(raised.trace).toContainEqual({ type: "rng", purpose: "acupressure", maxExclusive: 1, value: 0 });
    const capped = resolvePlayerMove({ ...user, stages: { ...user.stages, evasion: 6 } });
    expect(capped.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    expect(capped.trace).not.toContainEqual(expect.objectContaining({ purpose: "acupressure" }));
  });

  it("sacrifices half the maximum HP for Belly Drum and obeys Contrary", () => {
    const move = statusMove("03A", "BELLYDRUM");
    const used = resolvePlayerMove(battler("player", { moves: [{ move, pp: 10 }] }));
    expect(used.state.teams.player.members[0]).toMatchObject({ hp: 250, stages: { attack: 6 } });
    const contrary = resolvePlayerMove(battler("player", { ability: "CONTRARY",
      moves: [{ move, pp: 10 }] }));
    expect(contrary.state.teams.player.members[0]!.stages.attack).toBe(-6);
    const weak = resolvePlayerMove(battler("player", { hp: 250, moves: [{ move, pp: 10 }] }));
    expect(weak.state.teams.player.members[0]!.hp).toBe(250);
    expect(weak.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("separately resolves Flatter and Swagger boosts and confusion", () => {
    for (const [code, stat, delta] of [["040", "specialAttack", 1], ["041", "attack", 2]] as const) {
      const move = { ...statusMove(code, `MOVE${code}`), accuracy: 0 };
      const result = resolvePlayerMove(battler("player", { moves: [{ move, pp: 10 }] }));
      expect(result.state.teams.opponent.members[0]!.stages[stat]).toBe(delta);
      expect(result.state.teams.opponent.members[0]!.volatile?.confusionTurns).toBeGreaterThan(0);
      const ownTempo = resolvePlayerMove(battler("player", { moves: [{ move, pp: 10 }] }),
        battler("opponent", { ability: "OWNTEMPO" }));
      expect(ownTempo.state.teams.opponent.members[0]!.stages[stat]).toBe(delta);
      expect(ownTempo.state.teams.opponent.members[0]!.volatile?.confusionTurns ?? 0).toBe(0);
    }
  });

  it("clears target stages only after Clear Smog deals damage", () => {
    const clearSmog: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: "050",
      internalName: "CLEARSMOG", name: "Bain de Smog", category: "Special", type: "POISON", accuracy: 0 };
    const boosted = battler("opponent", { stages: { ...battler("opponent").stages,
      attack: 4, defense: -2 } });
    const hit = resolvePlayerMove(battler("player", { moves: [{ move: clearSmog, pp: 10 }] }), boosted);
    expect(hit.state.teams.opponent.members[0]!.stages).toMatchObject({ attack: 0, defense: 0 });
    const immune = resolvePlayerMove(battler("player", { moves: [{ move: clearSmog, pp: 10 }] }),
      { ...boosted, types: ["STEEL"] });
    expect(immune.state.teams.opponent.members[0]!.stages).toMatchObject({ attack: 4, defense: -2 });
  });

  it("keeps Mist on the side and blocks existing hostile stat drops", () => {
    const mist = statusMove("056", "MIST");
    const protectedTurn = resolvePlayerMove(battler("player", { moves: [{ move: mist, pp: 10 }] }),
      battler("opponent", { moves: [{ move: MINIMAL_MOVE_CATALOG.GROWL, pp: 10 }] }));
    expect(protectedTurn.state.effects?.sides.player.mistTurns).toBe(4);
    const enemyGrowl = resolveTeamTurn(protectedTurn.state, {
      player: { kind: "wait" }, opponent: { kind: "move", moveIndex: 0 },
    }, zero);
    expect(enemyGrowl.state.teams.player.members[0]!.stages.attack).toBe(0);
    expect(enemyGrowl.events).toContainEqual(expect.objectContaining({
      type: "statStageChangeFailed", reason: "mist",
    }));
    const bypass = resolveTeamTurn({ ...protectedTurn.state, teams: {
      ...protectedTurn.state.teams, opponent: { ...protectedTurn.state.teams.opponent,
        members: [{ ...protectedTurn.state.teams.opponent.members[0]!, ability: "INFILTRATOR" }] },
    } }, { player: { kind: "wait" }, opponent: { kind: "move", moveIndex: 0 } }, zero);
    expect(bypass.state.teams.player.members[0]!.stages.attack).toBe(-1);
  });

  it("protects a Mist-covered side from Intimidate on the next entry", () => {
    const state = createTeamBattleState({
      player: [battler("player", { moves: [{ move: statusMove("056", "MIST"), pp: 10 }] })],
      opponent: [battler("opponent"), { ...battler("opponent"), id: "intimidator",
        ability: "INTIMIDATE" }],
    });
    const mist = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, zero);
    const entered = resolveTeamTurn(mist.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, zero);
    expect(entered.state.teams.player.members[0]!.stages.attack).toBe(0);
    expect(entered.events).toContainEqual(expect.objectContaining({
      type: "statStageChangeFailed", reason: "mist", stat: "attack",
    }));
  });

  it("targets an ally with Acupressure and clears all four stages with Haze", () => {
    const acupressure = { ...statusMove("037", "ACUPRESSURE"), targetCode: "200" };
    const haze = { ...statusMove("051", "HAZE"), targetCode: "20" };
    const boosted = { ...battler("opponent").stages, attack: 3 };
    const state = createDoubleTeamBattleState({
      player: [battler("player", { stages: { ...boosted, speed: 2 },
        moves: [{ move: acupressure, pp: 10 }, { move: haze, pp: 10 }] }),
        { ...battler("player"), id: "ally", stages: boosted }],
      opponent: [battler("opponent", { stages: boosted }),
        { ...battler("opponent"), id: "other", stages: boosted }],
    });
    const actions = (moveIndex: number, target: { side: BattleSide; slot: number }) => [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const,
        moveIndex, target } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const raised = resolveDoubleTeamTurn(state, actions(0, { side: "player", slot: 1 }), zero);
    expect(raised.state.teams.player.members[1]!.stages.attack).toBe(5);
    expect(raised.events).toContainEqual(expect.objectContaining({
      type: "positionedActionResolved", targets: [{ side: "player", slot: 1 }],
      events: expect.arrayContaining([expect.objectContaining({ type: "statStageChanged", target: "player" })]),
    }));
    const cleared = resolveDoubleTeamTurn(raised.state, actions(1, { side: "player", slot: 0 }), zero);
    for (const side of ["player", "opponent"] as const) {
      for (const member of cleared.state.teams[side].members) {
        expect(Object.values(member.stages).every((stage) => stage === 0)).toBe(true);
      }
    }
  });
  it("reduces weight only when Autotomize raises Speed, and clears it on switch", () => {
    const first = battler("player", { capture: { rate: 45, baseSpeed: 50, weight: 1_500 },
      moves: [{ move: statusMove("031", "AUTOTOMIZE"), pp: 10 }] });
    const team = createTeamBattleState({ player: [first, { ...battler("player"), id: "reserve" }],
      opponent: [battler("opponent")] });
    const raised = resolveTeamTurn(team, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, zero);
    expect(raised.state.teams.player.members[0]!.stages.speed).toBe(2);
    expect(effectiveWeight(raised.state.teams.player.members[0]!)).toBe(500);
    const withdrawn = resolveTeamTurn(raised.state, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "wait" } }, zero);
    expect(withdrawn.state.teams.player.members[0]!.volatile?.weightChange).toBeUndefined();
    expect(effectiveWeight(withdrawn.state.teams.player.members[0]!)).toBe(1_500);
    const capped = resolvePlayerMove(battler("player", { capture: first.capture!,
      stages: { ...first.stages, speed: 6 }, moves: first.moves }));
    expect(capped.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    expect(effectiveWeight(capped.state.teams.player.members[0]!)).toBe(1_500);
  });

  it("follows Shell Smash's source order and requires a possible offensive boost", () => {
    const smash = statusMove("035", "SHELLSMASH");
    const result = resolvePlayerMove(battler("player", { ability: "SIMPLE",
      moves: [{ move: smash, pp: 10 }] }));
    expect(result.state.teams.player.members[0]!.stages).toMatchObject({
      defense: -2, specialDefense: -2, attack: 4, specialAttack: 4, speed: 4,
    });
    const capped = resolvePlayerMove(battler("player", {
      stages: { ...battler("player").stages, attack: 6, specialAttack: 6, speed: 6 },
      moves: [{ move: smash, pp: 10 }],
    }));
    expect(capped.state.teams.player.members[0]!.stages.defense).toBe(0);
    expect(capped.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    const tailGlow = resolvePlayerMove(battler("player", { ability: "CONTRARY",
      moves: [{ move: statusMove("039", "TAILGLOW"), pp: 10 }],
    }));
    expect(tailGlow.state.teams.player.members[0]!.stages.specialAttack).toBe(-3);
  });

  it("applies Superpower and V-create self drops only after damage", () => {
    for (const [code, expected] of [
      ["03B", { attack: -1, defense: -1 }],
      ["03D", { speed: -1, defense: -1, specialDefense: -1 }],
    ] as const) {
      const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: `MOVE${code}`,
        name: code, functionCode: code, accuracy: 0 };
      const landed = resolvePlayerMove(battler("player", { moves: [{ move, pp: 5 }] }));
      expect(landed.state.teams.player.members[0]!.stages).toMatchObject(expected);
      const blocked = resolvePlayerMove(battler("player", { moves: [{ move, pp: 5 }] }),
        battler("opponent", { types: ["GHOST"] }));
      expect(blocked.state.teams.player.members[0]!.stages).toMatchObject(battler("player").stages);
    }
  });

  it("honors Tickle and Captivate gender and opponent stat protections", () => {
    const tickle = resolvePlayerMove(battler("player", {
      moves: [{ move: statusMove("04A", "TICKLE"), pp: 10 }],
    }));
    expect(tickle.state.teams.opponent.members[0]!.stages).toMatchObject({ attack: -1, defense: -1 });
    const captivate = statusMove("04E", "CAPTIVATE");
    const male = battler("player", { appearance: { form: 0, shiny: false, gender: "male" },
      moves: [{ move: captivate, pp: 10 }] });
    const female = battler("opponent", { appearance: { form: 0, shiny: false, gender: "female" } });
    expect(resolvePlayerMove(male, female).state.teams.opponent.members[0]!.stages.specialAttack).toBe(-2);
    const oblivious = resolvePlayerMove(male, { ...female, ability: "OBLIVIOUS" });
    expect(oblivious.state.teams.opponent.members[0]!.stages.specialAttack).toBe(0);
    const sameGender = resolvePlayerMove(male, { ...female,
      appearance: { ...female.appearance!, gender: "male" } });
    expect(sameGender.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    const mistState = createTeamBattleState({ player: [battler("player", {
      moves: [{ move: statusMove("04A", "TICKLE"), pp: 10 }],
    })], opponent: [female] });
    const mist = resolveTeamTurn({ ...mistState, effects: { waterSportTurns: 0, sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0, mistTurns: 2 },
    } } }, { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
    expect(mist.state.teams.opponent.members[0]!.stages.attack).toBe(0);
    expect(mist.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("applies V-create's source ally damage only after a real hit in doubles", () => {
    const vcreate: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "VCREATE",
      name: "V de Fuego", functionCode: "03D", accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [battler("player", { moves: [{ move: vcreate, pp: 5 }] }),
        { ...battler("player"), id: "ally" }],
      opponent: [battler("opponent"), { ...battler("opponent"), id: "other" }],
    });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const,
        moveIndex: 0, target: { side: "opponent" as const, slot: 0 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const hit = resolveDoubleTeamTurn(state, actions, zero);
    expect(hit.state.teams.player.members[1]!.hp).toBe(469);
    expect(hit.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, targets: [{ side: "player", slot: 1 }],
      events: expect.arrayContaining([expect.objectContaining({ type: "recoilDamage", amount: 31 })]),
    }));
    const immune = createDoubleTeamBattleState({
      player: state.teams.player.members,
      opponent: [{ ...battler("opponent"), types: ["GHOST"] }, battler("opponent")],
    });
    expect(resolveDoubleTeamTurn(immune, actions, zero).state.teams.player.members[1]!.hp).toBe(500);
  });
  it.each([
    ["024", { attack: 1, defense: 1 }],
    ["025", { attack: 1, defense: 1, accuracy: 1 }],
    ["029", { attack: 1, accuracy: 1 }],
    ["02A", { defense: 1, specialDefense: 1 }],
    ["02B", { specialAttack: 1, specialDefense: 1, speed: 1 }],
    ["036", { speed: 2, attack: 1 }],
    ["038", { defense: 3 }],
  ] as const)("applies the %s self boosts", (code, expected) => {
    const result = resolvePlayerMove(battler("player", {
      moves: [{ move: statusMove(code, `MOVE${code}`), pp: 10 }],
    }));
    expect(result.state.teams.player.members[0]!.stages).toMatchObject(expected);
  });

  it("keeps the order and partial success of mixed boosts with Simple and Contrary", () => {
    const shiftGear = statusMove("036", "SHIFTGEAR");
    const simple = resolvePlayerMove(battler("player", { ability: "SIMPLE",
      stages: { ...battler("player").stages, speed: 5 },
      moves: [{ move: shiftGear, pp: 10 }],
    }));
    expect(simple.state.teams.player.members[0]!.stages).toMatchObject({ speed: 6, attack: 2 });
    const contrary = resolvePlayerMove(battler("player", { ability: "CONTRARY",
      moves: [{ move: statusMove("025", "COIL"), pp: 10 }],
    }));
    expect(contrary.state.teams.player.members[0]!.stages).toMatchObject({
      attack: -1, defense: -1, accuracy: -1,
    });
    const partial = resolvePlayerMove(battler("player", {
      stages: { ...battler("player").stages, defense: 6 },
      moves: [{ move: statusMove("02A", "COSMICPOWER"), pp: 10 }],
    }));
    expect(partial.state.teams.player.members[0]!.stages.specialDefense).toBe(1);
    expect(partial.events).toContainEqual(expect.objectContaining({
      type: "statStageChangeFailed", stat: "defense",
    }));
    expect(partial.events).not.toContainEqual(expect.objectContaining({ type: "moveFailed" }));
    const capped = resolvePlayerMove(battler("player", {
      stages: { ...battler("player").stages, defense: 6 },
      moves: [{ move: statusMove("038", "COTTONGUARD"), pp: 10 }],
    }));
    expect(capped.events).toContainEqual(expect.objectContaining({ type: "moveFailed", reason: "condition" }));
  });

  it("supports Dragon Dance and Calm Mind with Simple, Contrary and partial stage limits", () => {
    const dragonDance = statusMove("026", "DRAGONDANCE");
    const simple = resolvePlayerMove(battler("player", { ability: "SIMPLE",
      moves: [{ move: dragonDance, pp: 20 }] }));
    expect(simple.state.teams.player.members[0]!.stages).toMatchObject({ attack: 2, speed: 2 });

    const calmMind = statusMove("02C", "CALMMIND");
    const contrary = resolvePlayerMove(battler("player", { ability: "CONTRARY",
      moves: [{ move: calmMind, pp: 20 }] }));
    expect(contrary.state.teams.player.members[0]!.stages).toMatchObject({
      specialAttack: -1, specialDefense: -1,
    });

    const partial = resolvePlayerMove(battler("player", {
      stages: { ...battler("player").stages, attack: 6 }, moves: [{ move: dragonDance, pp: 20 }],
    }));
    expect(partial.state.teams.player.members[0]!.stages).toMatchObject({ attack: 6, speed: 1 });
    expect(partial.events).toContainEqual(expect.objectContaining({
      type: "statStageChangeFailed", stat: "attack",
    }));
    expect(partial.events).not.toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("supports Swords Dance and Nasty Plot, including a damaging additional effect", () => {
    const swordsDance = resolvePlayerMove(battler("player", {
      moves: [{ move: statusMove("02E", "SWORDSDANCE"), pp: 20 }],
    }));
    expect(swordsDance.state.teams.player.members[0]!.stages.attack).toBe(2);

    const nastyPlot = resolvePlayerMove(battler("player", { ability: "SIMPLE",
      moves: [{ move: statusMove("032", "NASTYPLOT"), pp: 20 }] }));
    expect(nastyPlot.state.teams.player.members[0]!.stages.specialAttack).toBe(4);

    const damagingBoost: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: "02E",
      internalName: "DAMAGINGBOOST", name: "Boost offensif", accuracy: 0, effectChance: 100 };
    const boosted = resolvePlayerMove(battler("player", {
      moves: [{ move: damagingBoost, pp: 10 }],
    }));
    expect(boosted.state.teams.player.members[0]!.stages.attack).toBe(2);
  });

  it("applies offensive self-drops only after real damage and through Simple or Contrary", () => {
    const closeCombat: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: "03C",
      internalName: "CLOSECOMBAT", name: "Close Combat", accuracy: 0 };
    const simple = resolvePlayerMove(battler("player", { ability: "SIMPLE",
      moves: [{ move: closeCombat, pp: 5 }] }));
    expect(simple.state.teams.player.members[0]!.stages).toMatchObject({ defense: -2, specialDefense: -2 });

    const spinOut: BattleMove = { ...closeCombat, functionCode: "03E", internalName: "SPINOUT" };
    const slowed = resolvePlayerMove(battler("player", { moves: [{ move: spinOut, pp: 5 }] }));
    expect(slowed.state.teams.player.members[0]!.stages.speed).toBe(-1);

    const overheat: BattleMove = { ...closeCombat, functionCode: "03F", internalName: "OVERHEAT",
      category: "Special" };
    const contrary = resolvePlayerMove(battler("player", { ability: "CONTRARY",
      moves: [{ move: overheat, pp: 5 }] }));
    expect(contrary.state.teams.player.members[0]!.stages.specialAttack).toBe(2);

    const immune = resolvePlayerMove(battler("player", { moves: [{ move: closeCombat, pp: 5 }] }),
      battler("opponent", { types: ["GHOST"] }));
    expect(immune.state.teams.player.members[0]!.stages).toMatchObject({ defense: 0, specialDefense: 0 });
  });

  it.each([
    ["026", { attack: 1, speed: 1 }, "attack"],
    ["025", { attack: 1, defense: 1, accuracy: 1 }, "accuracy"],
  ] as const)("positions %s stat events in a double battle", (code, expected, eventStat) => {
    const dragonDance = statusMove(code, `MOVE${code}`);
    const state = createDoubleTeamBattleState({
      player: [battler("player", { moves: [{ move: dragonDance, pp: 20 }] }),
        { ...battler("player"), id: "player-ally" }],
      opponent: [battler("opponent"), { ...battler("opponent"), id: "opponent-ally" }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], zero);
    expect(result.state.teams.player.members[0]!.stages).toMatchObject(expected);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "positionedActionResolved", actor: { side: "player", slot: 0 },
      events: expect.arrayContaining([expect.objectContaining({
        type: "statStageChanged", target: "player", stat: eventStat,
      })]),
    }));
  });
});
