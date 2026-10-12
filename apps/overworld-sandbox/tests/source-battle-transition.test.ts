import { describe, expect, it } from "vitest";
import { selectSourceBattleTransition, sourceTrainerBandFrames, sourceWildOutdoorFrames } from
  "../src/source-battle-transition.js";

describe("source battle standard transitions", () => {
  it("keeps only the two explicitly ported variants", () => {
    expect(selectSourceBattleTransition(false)).toBe("wild-outdoor");
    expect(selectSourceBattleTransition(true)).toBe("trainer-standard");
  });

  it("ports the 32 wild outdoor frames", () => {
    const frames = sourceWildOutdoorFrames(512, 384);
    expect(frames).toHaveLength(32);
    expect(frames[0]).toEqual([
      { x: 32, y: 0, width: 16, height: 96 },
      { x: 16, y: 0, width: 16, height: 96 },
      { x: 480, y: 288, width: 16, height: 96 },
      { x: 464, y: 288, width: 16, height: 96 },
    ]);
  });

  it("ports the six trainer bands over 28 frames", () => {
    const frames = sourceTrainerBandFrames(512, 384);
    expect(frames).toHaveLength(28);
    expect(frames[0]).toHaveLength(6);
    expect(frames[27]?.[0]).toMatchObject({ x: -32, width: 672, ballX: 640, ballAngle: -1176 });
    expect(frames[27]?.[1]).toMatchObject({ x: -128, width: 672, ballX: -128, ballAngle: 1176 });
  });
});
