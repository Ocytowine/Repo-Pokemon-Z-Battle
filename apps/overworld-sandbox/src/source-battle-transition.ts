export const SOURCE_TRANSITION_FRAME_MS = 25;

export type SourceBattleTransitionKind = "wild-outdoor" | "trainer-standard";

export interface SourceTransitionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SourceTrainerBand {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly ballX: number;
  readonly ballY: number;
  readonly ballAngle: number;
}

export function selectSourceBattleTransition(trainerBattle: boolean): SourceBattleTransitionKind {
  return trainerBattle ? "trainer-standard" : "wild-outdoor";
}

/** Port direct des boucles de ebWildAnimationOutdoor (16 positions x 2 frames). */
export function sourceWildOutdoorFrames(width: number, height: number): readonly (readonly SourceTransitionRect[])[] {
  const cellWidth = width / 16;
  const cellHeight = height / 4;
  return Array.from({ length: 16 }, (_, index) => {
    const firstX = index < 8 ? cellWidth + (index % 8) * cellWidth * 2
      : width - cellWidth - (index % 8) * cellWidth * 2;
    const secondX = index < 8 ? width - cellWidth - (index % 8) * cellWidth * 2
      : cellWidth + (index % 8) * cellWidth * 2;
    const firstY = Math.floor(index / 8) * cellHeight;
    const secondY = height - cellHeight - firstY;
    return [1, 2].map((step) => {
      const extent = step * cellWidth / 2;
      return [
        { x: firstX, y: firstY, width: extent, height: cellHeight },
        { x: firstX - extent, y: firstY, width: extent, height: cellHeight },
        { x: secondX, y: secondY, width: extent, height: cellHeight },
        { x: secondX - extent, y: secondY, width: extent, height: cellHeight },
      ];
    });
  }).flat();
}

/** Port direct des 28 frames de ebTrainerAnimation3. */
export function sourceTrainerBandFrames(width: number, height: number): readonly (readonly SourceTrainerBand[])[] {
  const rowHeight = height / 6;
  return Array.from({ length: 28 }, (_, frame) => Array.from({ length: 6 }, (_, row) => {
    const fromLeft = row % 2 === 0;
    const extent = (frame + 1) * 24;
    return {
      x: fromLeft ? -32 : width + 32 - extent,
      y: row * rowHeight,
      width: extent,
      height: rowHeight,
      ballX: (fromLeft ? -32 : width + 32) + (fromLeft ? extent : -extent),
      ballY: row * rowHeight + rowHeight / 2,
      ballAngle: (frame + 1) * (fromLeft ? -42 : 42),
    };
  }));
}
