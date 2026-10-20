import type { BattlerState } from "./types.js";

export function transformBattler(user: BattlerState, target: BattlerState): BattlerState | null {
  if (user.transformOriginal !== undefined || target.transformOriginal !== undefined) return null;
  const original = { species: user.species, name: user.name, types: [...user.types], stats: { ...user.stats },
    stages: { ...user.stages }, ability: user.ability,
    moves: user.moves.map((slot) => ({ ...slot, move: { ...slot.move } })) };
  return { ...user, species: target.species, name: target.name, types: [...target.types],
    stats: { ...target.stats, maxHp: user.stats.maxHp }, stages: { ...target.stages }, ability: target.ability,
    moves: target.moves.map((slot) => ({ move: { ...slot.move }, pp: Math.min(5, slot.move.pp) })),
    transformOriginal: original };
}

export function restoreTransformedBattler(battler: BattlerState): BattlerState {
  if (battler.transformOriginal === undefined) return battler;
  const original = battler.transformOriginal;
  const { transformOriginal: _ignored, ...current } = battler;
  return { ...current, species: original.species, name: original.name, types: [...original.types],
    stats: { ...original.stats }, stages: { ...original.stages }, ability: original.ability,
    moves: original.moves.map((slot) => ({ ...slot, move: { ...slot.move } })) };
}
