import { describe, expect, it } from "vitest";
import { sourcePokemonSpriteFrameState } from "../src/source-pokemon-sprite-animator.js";

describe("source Pokemon sprite animator", () => {
  it("advances opaque source frames at a slightly faster cadence", () => {
    expect(sourcePokemonSpriteFrameState(124, 4).frame).toBe(0);
    expect(sourcePokemonSpriteFrameState(125, 4).frame).toBe(1);
    expect(sourcePokemonSpriteFrameState(500, 4).frame).toBe(0);
  });

  it("adds a subtle ground-anchored motion even to a single-frame battler", () => {
    const rest = sourcePokemonSpriteFrameState(0, 1);
    const motion = sourcePokemonSpriteFrameState(640, 1);
    expect(rest).toMatchObject({ frame: 0, offsetY: 0 });
    expect(motion.offsetY).toBeLessThan(0);
  });
});
