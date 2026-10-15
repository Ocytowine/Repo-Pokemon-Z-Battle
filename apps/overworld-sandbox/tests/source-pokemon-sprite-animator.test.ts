import { describe, expect, it } from "vitest";
import { SOURCE_POKEMON_SPRITE_FRAME_MS,
  sourcePokemonSpriteFrameState } from "../src/source-pokemon-sprite-animator.js";

describe("source Pokemon sprite animator", () => {
  it("matches Pokemon Z's 15 source frames per second cadence", () => {
    expect(SOURCE_POKEMON_SPRITE_FRAME_MS).toBeCloseTo(66.67, 2);
    expect(sourcePokemonSpriteFrameState(66, 4).frame).toBe(0);
    expect(sourcePokemonSpriteFrameState(67, 4).frame).toBe(1);
    expect(sourcePokemonSpriteFrameState(SOURCE_POKEMON_SPRITE_FRAME_MS * 4, 4).frame).toBe(0);
  });

  it("adds a subtle ground-anchored motion even to a single-frame battler", () => {
    const rest = sourcePokemonSpriteFrameState(0, 1);
    const motion = sourcePokemonSpriteFrameState(640, 1);
    expect(rest).toMatchObject({ frame: 0, offsetY: 0 });
    expect(motion.offsetY).toBeLessThan(0);
  });
});
