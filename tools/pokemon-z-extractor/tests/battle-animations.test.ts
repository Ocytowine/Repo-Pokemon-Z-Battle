import { describe, expect, it } from "vitest";
import { normalizeBattleAnimations } from "../src/runtime/extract-battle-animations.js";
import type { RubyExtendedValue, RubyMarshalValue, RubyString } from "../src/ruby-marshal/types.js";

function string(text: string): RubyString {
  return { kind: "string", bytes: new TextEncoder().encode(text), text, ivars: {} };
}

function animation(name: string): RubyExtendedValue {
  const cel: RubyMarshalValue[] = [128, 224, 100, 0, 0, 1, 1, 4, 255, null, null, 100];
  cel[25] = 1; cel[26] = 3;
  return {
    kind: "user-class", moduleName: "PBAnimation", value: [],
    ivars: {
      "@name": string(`Move:${name}`), "@graphic": string("sheet.png"),
      "@hue": 0, "@position": 3, "@array": [[cel]], "@timing": [],
    },
  };
}

function timing(type: number): RubyMarshalValue {
  return { kind: "object", className: "PBAnimTiming", ivars: {
    "@frame": 3, "@timingType": type, "@name": string("effect.png"), "@volume": 90, "@pitch": 110,
    "@bgX": 12, "@bgY": null, "@opacity": 220, "@colorRed": 10, "@colorGreen": null,
    "@colorBlue": 30, "@colorAlpha": 40, "@duration": 7,
  } };
}

describe("battle animation normalization", () => {
  it("maps supported moves and names sparse cel fields", () => {
    const animations: RubyMarshalValue[] = [];
    animations[4] = animation("TACKLE");
    const root: RubyExtendedValue = {
      kind: "user-class", moduleName: "PBAnimations", value: [],
      ivars: { "@array": animations },
    };
    const player: RubyMarshalValue[] = [];
    player[303] = 4;
    const result = normalizeBattleAnimations(root, [player, []], [{ id: 303, internalName: "TACKLE", functionCode: "000" }]);
    expect(result.mappings).toEqual([{ moveId: 303, internalName: "TACKLE", player: 4, opponent: null }]);
    expect(result.animations[0]).toMatchObject({
      index: 4, name: "Move:TACKLE", graphicPath: "Graphics/Animations/sheet.png",
      frames: [[{ slot: 0, x: 128, y: 224, pattern: 4, focus: 3, blendType: 1 }]],
    });
  });

  it("can index a move excluded by the engine audit without expanding its frame data", () => {
    const root: RubyExtendedValue = { kind: "user-class", moduleName: "PBAnimations", value: [], ivars: { "@array": [] } };
    const player: RubyMarshalValue[] = [];
    player[99] = 7;
    const result = normalizeBattleAnimations(root, [player, []],
      [{ id: 99, internalName: "FUTURE_MOVE", functionCode: "999" }], new Set());
    expect(result.mappings[0]?.player).toBe(7);
    expect(result.animations).toEqual([]);
  });

  it("always expands common battle effects outside move2anim", () => {
    const common = animation("IGNORED");
    common.ivars["@name"] = string("Common:Sleep");
    common.ivars["@timing"] = [timing(2)];
    const root: RubyExtendedValue = {
      kind: "user-class", moduleName: "PBAnimations", value: [],
      ivars: { "@array": [common] },
    };
    const result = normalizeBattleAnimations(root, [[], []], [], new Set());
    expect(result.animations).toHaveLength(1);
    expect(result.animations[0]?.name).toBe("Common:Sleep");
    expect(result.animations[0]?.timings[0]).toEqual({ frame: 3, type: 2, name: "effect.png",
      volume: 90, pitch: 110, x: 12, y: null, opacity: 220,
      color: { red: 10, green: null, blue: 30, alpha: 40 }, duration: 7 });
  });
});
