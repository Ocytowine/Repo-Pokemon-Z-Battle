import type { BattleSide } from "@pokemon-z-battle/battle-engine";

export const SOURCE_BATTLE_VIEWPORT = { width: 512, height: 384 } as const;

// Valeurs du jeu source (PokeBattle_SceneConstants + SpriteAutoAlign).
const SINGLE_BATTLER_ORIGINS: Record<BattleSide, { readonly centerX: number; readonly groundY: number }> = {
  player: { centerX: 128, groundY: 320 }, // PLAYERBATTLER_Y (304) + BATTLE_PLAYER_OFFSET (16)
  opponent: { centerX: 384, groundY: 168 }, // FOEBATTLER_Y (118) + BATTLE_ENEMY_OFFSET (50)
};

// PLAYER/FOEBATTLERD1/D2 du jeu source, avec les memes offsets appliques par
// SpriteAutoAlign. Le premier actif se decale lui aussi lors du passage en double.
const DOUBLE_BATTLER_ORIGINS: Record<BattleSide, readonly [
  { readonly centerX: number; readonly groundY: number },
  { readonly centerX: number; readonly groundY: number },
]> = {
  player: [{ centerX: 80, groundY: 320 }, { centerX: 160, groundY: 336 }],
  opponent: [{ centerX: 432, groundY: 168 }, { centerX: 352, groundY: 152 }],
};

// Constantes du plugin Animated Sprites charge par le jeu source.
// BitmapWrapperEX agrandit chaque frame avant tout calcul de placement.
const BATTLER_SCALES: Record<BattleSide, number> = {
  player: 3, // BACKSPRITE_SCALE
  opponent: 2, // FRONTSPRITE_SCALE
};

export interface SourceBattleSpritePlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
}

export interface SourceTrainerSpritePlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function sourceBattleSpriteScale(side: BattleSide): number {
  return BATTLER_SCALES[side];
}

/** Dernier pixel opaque apres l'agrandissement nearest-neighbour de BitmapWrapperEX. */
export function sourceBattleScaledVisibleBottom(visibleBottom: number, scale: number): number {
  const safeScale = Math.max(1, scale);
  return (Math.max(0, visibleBottom) + 1) * safeScale - 1;
}

const TRAINER_ORIGINS: Record<BattleSide, { readonly centerX: number; readonly bottomY: number }> = {
  player: { centerX: 128, bottomY: 384 },
  opponent: { centerX: 384, bottomY: 168 },
};

/** Placement centre-bas utilisé par pbStartBattle pour les Dresseurs. */
export function sourceTrainerSpritePlacement(side: BattleSide, width: number, height: number): SourceTrainerSpritePlacement {
  const origin = TRAINER_ORIGINS[side];
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  return { left: origin.centerX - safeWidth / 2, top: origin.bottomY - safeHeight,
    width: safeWidth, height: safeHeight };
}

/**
 * Reproduit l'auto-alignement du jeu : le centre horizontal de la frame reste
 * sur l'origine du combattant et son dernier pixel visible touche la ligne de sol.
 */
export function sourceBattleSpritePlacement(side: BattleSide, frameWidth: number, frameHeight: number,
  visibleBottom: number, format: "single" | "double" = "single", activeSlot = 0): SourceBattleSpritePlacement {
  const origin = format === "double"
    ? DOUBLE_BATTLER_ORIGINS[side][activeSlot === 0 ? 0 : 1]
    : SINGLE_BATTLER_ORIGINS[side];
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
