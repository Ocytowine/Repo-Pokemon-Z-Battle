import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, transformBattler,
  type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";
import { effectiveTypeMultiplier, effectiveWeight } from "../src/damage.js";
import { isGrounded } from "../src/ability-field-entry.js";
import { TRAINING_SPEED_ITEMS } from "../src/held-speed-items.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
function mon(id: string, side: BattleSide, item: string | null = null, speed = 100): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 500, attack: 60, defense: 100, specialAttack: 60, specialDefense: 100, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 500, majorStatus: null, ability: null,
    heldItem: item, moves: [{ move, pp: 10 }] };
}
const action = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "move" as const, moveIndex: 0 } };
function firstSide(player: BattlerState, opponent = mon("foe", "opponent", null, 100), magicRoomTurns = 0) {
  const state = createTeamBattleState({ player: [player], opponent: [opponent] });
  const effects = { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0, magicRoomTurns };
  const result = resolveTeamTurn({ ...state, effects }, action, rng);
  return result.events.find((event) => event.type === "teamActionOrdered")?.order[0]?.side;
}

describe("objets tenus de Vitesse et de poids", () => {
  it.each(TRAINING_SPEED_ITEMS)("halves speed with %s and suspends it under Magic Room", (item) => {
    const user = mon("user", "player", item, 120);
    expect(firstSide(user)).toBe("opponent");
    expect(firstSide(user, undefined, 2)).toBe("player");
  });

  it("handles Iron Ball speed and grounding with source-specific suppression", () => {
    const ball = { ...mon("flyer", "player", "IRONBALL", 120), types: ["FLYING"], ability: "LEVITATE" };
    const ground = { ...move, type: "GROUND" };
    expect(firstSide(ball)).toBe("opponent");
    expect(firstSide(ball, undefined, 2)).toBe("opponent");
    expect(isGrounded(ball)).toBe(true);
    expect(effectiveTypeMultiplier(mon("foe", "opponent"), ball, ground)).toBeGreaterThan(0);
    expect(isGrounded(ball, { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0,
      magicRoomTurns: 2 })).toBe(false);
    expect(effectiveTypeMultiplier(mon("foe", "opponent"), ball, ground, null, 2)).toBe(0);
  });

  it("doubles Ditto speed only before Transform and applies Float Stone to speed and weight", () => {
    const ditto = mon("ditto", "player", "QUICKPOWDER", 60);
    expect(firstSide(ditto)).toBe("player");
    expect(firstSide(ditto, undefined, 2)).toBe("opponent");
    const transformed = transformBattler(ditto, mon("copy", "opponent", null, 60));
    expect(transformed).not.toBeNull();
    expect(firstSide(transformed!)).toBe("opponent");
    const stone = { ...mon("stone", "player", "FLOATSTONE", 85),
      capture: { weight: 1000 } as BattlerState["capture"] };
    expect(firstSide(stone)).toBe("player");
    expect(firstSide(stone, undefined, 2)).toBe("opponent");
    expect(effectiveWeight(stone)).toBe(500);
    expect(effectiveWeight(stone, undefined, 2)).toBe(1000);
  });

  it("uses the same held speed rule when a guest acts in doubles", () => {
    const state = createDoubleTeamBattleState({ player: [mon("foe", "player", null, 100)],
      opponent: [mon("ditto", "opponent", "QUICKPOWDER", 60)] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
    ];
    expect(resolveDoubleTeamTurn(state, actions, rng).events
      .find((event) => event.type === "teamActionOrdered")?.order[0]?.side).toBe("opponent");
  });
});
