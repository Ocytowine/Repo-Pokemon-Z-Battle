import { describe, expect, it } from "vitest";
import { NATURAL_GIFT_BERRIES, naturalGiftProfile } from "../src/natural-gift.js";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattlerState,
  type RandomSource } from "../src/index.js";
import { effectiveMoveType } from "../src/move-properties.js";

const rng: RandomSource = { nextInt: (limit) => limit - 1 };
const gift: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "NATURALGIFT",
  functionCode: "096", power: 1, accuracy: 0 };
const magicRoom: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "MAGICROOM",
  functionCode: "0F9", power: 0, category: "Status", accuracy: 0, targetCode: "20", priority: -7 };
function battler(id: string, heldItem: BattlerState["heldItem"], move = gift): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"], hp: 300,
    stats: { maxHp: 300, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed: 50 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null, ability: null,
    heldItem, moves: [{ move, pp: 20 }] };
}

describe("Pokemon Z Natural Gift source table", () => {
  it("contains the 64 berries present in the local 2.12 FR item catalog", () => {
    expect(NATURAL_GIFT_BERRIES.size).toBe(64);
    expect([...NATURAL_GIFT_BERRIES.values()].reduce((counts, entry) => {
      counts[entry.power] = (counts[entry.power] ?? 0) + 1;
      return counts;
    }, {} as Record<number, number>)).toEqual({ 80: 33, 90: 16, 100: 15 });
    expect(new Set([...NATURAL_GIFT_BERRIES.values()].map((entry) => entry.type)).size).toBe(17);
  });

  it("uses the source type and new-mechanics power for representative berries", () => {
    expect(naturalGiftProfile("CHERIBERRY")).toEqual({ type: "FIRE", power: 80 });
    expect(naturalGiftProfile("QUALOTBERRY")).toEqual({ type: "POISON", power: 90 });
    expect(naturalGiftProfile("LIECHIBERRY")).toEqual({ type: "GRASS", power: 100 });
    expect(naturalGiftProfile("CHILANBERRY")).toEqual({ type: "NORMAL", power: 80 });
  });

  it("does not invent berries named by the move script but absent from the item catalog", () => {
    for (const item of ["ROSELIBERRY", "KEEBERRY", "MARANGABERRY", "UNKNOWN", null]) {
      expect(naturalGiftProfile(item)).toBeNull();
    }
  });

  it.each([["CHERIBERRY", "FIRE", 80], ["ORANBERRY", "POISON", 80], ["LIECHIBERRY", "GRASS", 100],
    ["PAYAPABERRY", "PSYCHIC", 80]] as const)(
    "096 resolves %s with %s/%i and consumes it after damage", (item, type, power) => {
      const user = battler("user", item);
      const target = battler("target", null, MINIMAL_MOVE_CATALOG.TACKLE);
      const reference = calculateDamage("player", user, target,
        { ...gift, functionCode: "000", type, power }, rng, []);
      const result = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [target] }),
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
      expect(result.events).toContainEqual(expect.objectContaining({ type: "damageApplied",
        amount: reference, target: "opponent" }));
      expect(result.state.teams.player.members[0]!.heldItem).toBeNull();
      expect(result.state.teams.player.members[0]!.recyclableItem).toBe(item);
    });

  it("096 fails without an active berry, under Unnerve or Magic Room", () => {
    const base = createTeamBattleState({ player: [battler("user", "ORANBERRY")],
      opponent: [battler("target", null, MINIMAL_MOVE_CATALOG.TACKLE)] });
    const effects = resolveTeamTurn(base, { player: { kind: "wait" },
      opponent: { kind: "wait" } }, rng).state.effects!;
    const cases = [
      { ...base, teams: { ...base.teams, player: { ...base.teams.player,
        members: [battler("user", null)] } } },
      { ...base, teams: { ...base.teams, player: { ...base.teams.player,
        members: [{ ...battler("user", "ORANBERRY"), ability: "KLUTZ" as const }] } } },
      { ...base, teams: { ...base.teams, opponent: { ...base.teams.opponent,
        members: [{ ...battler("target", null, MINIMAL_MOVE_CATALOG.TACKLE), ability: "UNNERVE" as const }] } } },
      { ...base, effects: { ...effects, magicRoomTurns: 2 } },
    ];
    for (const state of cases) {
      const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "wait" } }, rng);
      expect(result.events).toContainEqual(expect.objectContaining({ type: "moveFailed",
        side: "player", reason: "condition" }));
      expect(result.events).not.toContainEqual(expect.objectContaining({ type: "damageApplied" }));
    }
  });

  it("096 checks the other opposing slot's Unnerve in doubles", () => {
    const state = createDoubleTeamBattleState({
      player: [battler("user", "PAYAPABERRY"), battler("ally", null, MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [battler("target", null, MINIMAL_MOVE_CATALOG.TACKLE),
        { ...battler("other", null, MINIMAL_MOVE_CATALOG.TACKLE), ability: "UNNERVE" }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, events: expect.arrayContaining([
        expect.objectContaining({ type: "moveFailed", reason: "condition" })]) }));
    expect(result.state.teams.player.members[0]!.heldItem).toBe("PAYAPABERRY");
  });

  it("096 retains the berry on immunity and restores Magic Room's countdown", () => {
    const user = battler("user", "ORANBERRY");
    const immune = { ...battler("target", null, MINIMAL_MOVE_CATALOG.TACKLE), types: ["STEEL"] };
    const base = createTeamBattleState({ player: [user], opponent: [immune] });
    const hit = resolveTeamTurn(base, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(hit.state.teams.player.members[0]!.heldItem).toBe("ORANBERRY");
    const prepared = resolveTeamTurn(base, { player: { kind: "wait" },
      opponent: { kind: "wait" } }, rng).state;
    const blocked = resolveTeamTurn({ ...prepared,
      effects: { ...prepared.effects!, magicRoomTurns: 2 } },
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(blocked.state.effects?.magicRoomTurns).toBe(1);
    expect(blocked.events).toContainEqual(expect.objectContaining({ type: "moveFailed", side: "player" }));
  });

  it("0F9 activates, expires and can be ended early in the shared solo resolver", () => {
    const base = createTeamBattleState({ player: [battler("user", "CHERIBERRY", magicRoom)],
      opponent: [battler("target", null, MINIMAL_MOVE_CATALOG.TACKLE)] });
    const actions = { player: { kind: "move", moveIndex: 0 } as const,
      opponent: { kind: "wait" } as const };
    const active = resolveTeamTurn(base, actions, rng);
    expect(active.events).toContainEqual(expect.objectContaining({ type: "battleEffectChanged",
      effect: "magic-room", turns: 5 }));
    expect(active.state.effects?.magicRoomTurns).toBe(4);
    expect(active.state.teams.player.members[0]!.heldItem).toBe("CHERIBERRY");
    const ended = resolveTeamTurn(active.state, actions, rng);
    expect(ended.state.effects?.magicRoomTurns).toBe(0);
    expect(ended.events).toContainEqual(expect.objectContaining({ type: "battleEffectChanged",
      effect: "magic-room", turns: 0 }));
  });

  it("0F9 is shared by the double resolver and preserves its timer in state", () => {
    const base = createDoubleTeamBattleState({
      player: [battler("user", "CHERIBERRY", magicRoom), battler("ally", null, MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [battler("target", null, MINIMAL_MOVE_CATALOG.TACKLE),
        battler("other", null, MINIMAL_MOVE_CATALOG.TACKLE)],
    });
    const actions = [
      { actor: { side: "player" as const, slot: 0 as const }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "player" as const, slot: 1 as const }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 as const }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 as const }, action: { kind: "wait" as const } },
    ];
    const active = resolveDoubleTeamTurn(base, actions, rng);
    expect(active.state.effects?.magicRoomTurns).toBe(4);
    expect(active.state.teams.player.members[0]!.heldItem).toBe("CHERIBERRY");
    const ended = resolveDoubleTeamTurn(active.state, actions, rng);
    expect(ended.state.effects?.magicRoomTurns).toBe(0);
  });

  it("suppresses an active Plate's 09F type without removing the held item", () => {
    const judgment: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "JUDGMENT",
      functionCode: "09F", type: "NORMAL", category: "Special" };
    const arceus = battler("arceus", "FLAMEPLATE", judgment);
    expect(effectiveMoveType(arceus, judgment).type).toBe("FIRE");
    expect(effectiveMoveType(arceus, judgment, null, 2).type).toBe("NORMAL");
    expect(arceus.heldItem).toBe("FLAMEPLATE");
  });
});
