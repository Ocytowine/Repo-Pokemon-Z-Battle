import type { BattleEffects, BattleEvent, BattleSide, BattlerState } from "./types.js";

function effectsBase(effects: BattleEffects | undefined): BattleEffects {
  return effects ?? { sides: {
    player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 },
  }, waterSportTurns: 0 };
}

export function isGrounded(battler: BattlerState): boolean {
  return !battler.types.includes("FLYING") && battler.ability !== "LEVITATE";
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
