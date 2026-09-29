import type { BattleSide } from "@pokemon-z-battle/battle-engine";

export const SOURCE_BATTLE_VIEWPORT = { width: 512, height: 384 } as const;

// Valeurs du jeu source (PokeBattle_SceneConstants + SpriteAutoAlign).
const BATTLER_ORIGINS: Record<BattleSide, { readonly centerX: number; readonly groundY: number }> = {
  player: { centerX: 128, groundY: 320 }, // PLAYERBATTLER_Y (304) + BATTLE_PLAYER_OFFSET (16)
  opponent: { centerX: 384, groundY: 168 }, // FOEBATTLER_Y (118) + BATTLE_ENEMY_OFFSET (50)
};

export interface SourceBattleSpritePlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
}

/**
 * Reproduit l'auto-alignement du jeu : le centre horizontal de la frame reste
 * sur l'origine du combattant et son dernier pixel visible touche la ligne de sol.
 */
export function sourceBattleSpritePlacement(side: BattleSide, frameWidth: number, frameHeight: number,
  visibleBottom: number): SourceBattleSpritePlacement {
  const origin = BATTLER_ORIGINS[side];
  const safeWidth = Math.max(1, frameWidth);
  const safeHeight = Math.max(1, frameHeight);
  const bottom = Math.min(safeHeight - 1, Math.max(0, visibleBottom));
  return {
    left: origin.centerX - safeWidth / 2,
    top: origin.groundY - bottom,
    width: safeWidth,
    height: safeHeight,
    originX: safeWidth / 2,
    originY: bottom,
  };
}

export function sourceBattlePercent(value: number, axis: "x" | "y"): string {
  const extent = axis === "x" ? SOURCE_BATTLE_VIEWPORT.width : SOURCE_BATTLE_VIEWPORT.height;
  return `${(value / extent) * 100}%`;
}
