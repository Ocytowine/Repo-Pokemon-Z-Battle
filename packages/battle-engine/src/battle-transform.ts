import type { BattlerState } from "./types.js";

export function restoreMoveModifiedStats(battler: BattlerState): BattlerState {
  const original = battler.volatile?.originalMoveStats;
  return original == null ? battler : { ...battler, stats: { ...original } };
}

export function restoreMimickedMoves(battler: BattlerState): BattlerState {
  const originals = battler.volatile?.mimicOriginalSlots;
  if (originals === undefined || originals.length === 0) return battler;
  const permanentlyChanged = new Set(battler.sketchedMoveSlots?.map((entry) => entry.index) ?? []);
  const moves = battler.moves.map((slot, index) => {
    const original = originals.find((entry) => entry.index === index);
    return original === undefined || permanentlyChanged.has(index) ? slot
      : { ...original.slot, move: { ...original.slot.move } };
  });
  return { ...battler, moves };
}

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
