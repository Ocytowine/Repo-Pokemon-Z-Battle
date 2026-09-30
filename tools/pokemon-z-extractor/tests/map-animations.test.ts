import { describe, expect, it } from "vitest";
import { normalizeMapAnimations } from "../src/runtime/extract-map-animations.js";
import type { RubyMarshalValue, RubyObject, RubyString, RubyUserDefined } from "../src/ruby-marshal/types.js";

function string(text: string): RubyString {
  return { kind: "string", bytes: new TextEncoder().encode(text), text, ivars: {} };
}

function object(className: string, ivars: RubyObject["ivars"]): RubyObject {
  return { kind: "object", className, ivars };
}

function animationTable(values: readonly number[]): RubyUserDefined {
  const bytes = new Uint8Array(20 + values.length * 2);
  const view = new DataView(bytes.buffer);
  [2, 1, 8, 1, values.length].forEach((value, index) => view.setInt32(index * 4, value, true));
  values.forEach((value, index) => view.setInt16(20 + index * 2, value, true));
  return { kind: "user-defined", className: "Table", bytes };
}

describe("map animation normalization", () => {
  it("names RPG Maker cells and audiovisual timings", () => {
    const color = object("Color", { "@red": 10, "@green": 20, "@blue": 30, "@alpha": 120 });
    const sound = object("RPG::AudioFile", { "@name": string("Decision"), "@volume": 80, "@pitch": 110 });
    const frame = object("RPG::Animation::Frame", {
      "@cell_max": 1, "@cell_data": animationTable([3, 8, -16, 120, 15, 1, 200, 1]),
    });
    const timing = object("RPG::Animation::Timing", {
      "@frame": 0, "@se": sound, "@flash_scope": 1, "@flash_duration": 4, "@flash_color": color,
    });
    const source: RubyMarshalValue[] = [null, object("RPG::Animation", {
      "@id": 1, "@name": string("Question"), "@animation_name": string("029-Emotion01"),
      "@animation_hue": 0, "@position": 0, "@frames": [frame], "@timings": [timing],
    })];
    expect(normalizeMapAnimations(source)).toEqual([{
      id: 1, name: "Question", graphicPath: "Graphics/Animations/029-Emotion01.png", hue: 0, position: 0,
      frames: [[{ pattern: 3, x: 8, y: -16, zoom: 120, angle: 15, mirror: true, opacity: 200, blendType: 1 }]],
      timings: [{ frame: 0, sound: { name: "Decision", volume: 80, pitch: 110 }, flashScope: 1,
        flashDuration: 4, flashColor: { red: 10, green: 20, blue: 30, alpha: 120 } }],
    }]);
  });
});
