import type { BattleEffects, BattleEvent, BattleSide, BattlerState } from "./types.js";
import { heldItemIsActive } from "./ability-item-control.js";

function effectsBase(effects: BattleEffects | undefined): BattleEffects {
  return effects ?? { sides: {
    player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 },
  }, waterSportTurns: 0 };
}

export function isGrounded(battler: BattlerState, effects?: BattleEffects): boolean {
  if ((effects?.gravityTurns ?? 0) > 0 || battler.volatile?.ingrain === true
    || battler.volatile?.smackDown === true) return true;
  if (battler.heldItem === "IRONBALL" && heldItemIsActive(battler, effects?.magicRoomTurns ?? 0)) return true;
  return !battler.types.includes("FLYING") && battler.ability !== "LEVITATE"
    && (battler.volatile?.magnetRiseTurns ?? 0) === 0
    && (battler.volatile?.telekinesisTurns ?? 0) === 0
    && !(battler.heldItem === "AIRBALLOON" && heldItemIsActive(battler, effects?.magicRoomTurns ?? 0));
}

export function resolveGrassyTerrainHealing(battler: BattlerState, side: BattleSide,
  effects?: BattleEffects): { battler: BattlerState; events: readonly BattleEvent[] } {
  if (effects?.terrain !== "grassy" || battler.hp <= 0 || battler.hp >= battler.stats.maxHp
    || !isGrounded(battler, effects) || (battler.volatile?.healBlockTurns ?? 0) > 0) {
    return { battler, events: [] };
  }
  const amount = Math.min(battler.stats.maxHp - battler.hp,
    Math.max(1, Math.floor(battler.stats.maxHp / 16)));
  return { battler: { ...battler, hp: battler.hp + amount },
    events: [{ type: "hpRestored", side, source: "move", move: "GRASSYTERRAIN",
      amount, hp: battler.hp + amount }] };
}

export function applyEntryFieldAbility(battler: BattlerState, side: BattleSide,
  effects: BattleEffects | undefined): { readonly effects: BattleEffects | undefined;
    readonly events: readonly BattleEvent[] } {
  if (battler.hp <= 0) return { effects, events: [] };
  const current = effectsBase(effects);
  if (battler.ability === "PRESENCIARARA") {
    const turns = (current.trickRoomTurns ?? 0) > 0 ? 0 : 5;
    return { effects: { ...current, trickRoomTurns: turns }, events: [
      { type: "abilityActivated", side, ability: "PRESENCIARARA", effect: "set-trick-room" },
      { type: "battleEffectChanged", side: null, effect: "trick-room", turns },
    ] };
  }
  if (battler.ability === "ELECTRICSURGE" && current.terrain !== "electric") {
    return { effects: { ...current, terrain: "electric", terrainTurns: 5 }, events: [
      { type: "abilityActivated", side, ability: "ELECTRICSURGE", effect: "set-terrain" },
      { type: "battleEffectChanged", side: null, effect: "terrain", turns: 5 },
    ] };
  }
  if (battler.ability === "GRASSYSURGE" && current.terrain !== "grassy") {
    return { effects: { ...current, terrain: "grassy", terrainTurns: 5 }, events: [
      { type: "abilityActivated", side, ability: "GRASSYSURGE", effect: "set-terrain" },
      { type: "battleEffectChanged", side: null, effect: "terrain", turns: 5 },
    ] };
  }
  if (battler.ability === "MISTYSURGE" && current.terrain !== "misty") {
    return { effects: { ...current, terrain: "misty", terrainTurns: 5 }, events: [
      { type: "abilityActivated", side, ability: "MISTYSURGE", effect: "set-terrain" },
      { type: "battleEffectChanged", side: null, effect: "terrain", turns: 5 },
    ] };
  }
  if (battler.ability === "PSYCHICSURGE" && current.terrain !== "psychic") {
    return { effects: { ...current, terrain: "psychic", terrainTurns: 5 }, events: [
      { type: "abilityActivated", side, ability: "PSYCHICSURGE", effect: "set-terrain" },
      { type: "battleEffectChanged", side: null, effect: "terrain", turns: 5 },
    ] };
  }
  return { effects, events: [] };
}
