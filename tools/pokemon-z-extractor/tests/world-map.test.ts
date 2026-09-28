import { describe, expect, it } from "vitest";
import type { RpgTable, RubyObject } from "../src/ruby-marshal/types.js";
import { buildCollisionMasks, extractSimpleTransfers, tileAllowsDirection } from "../src/runtime/world-map.js";

function rubyObject(className: string, ivars: RubyObject["ivars"]): RubyObject {
  return { kind: "object", className, ivars };
}

describe("world map normalization", () => {
  it("applies XP passage flags from the upper layer to the lower layer", () => {
    const passages = Array.from({ length: 10 }, () => 0);
    const priorities = Array.from({ length: 10 }, () => 0);
    priorities[2] = 1;
    passages[3] = 0x01;
    expect(tileAllowsDirection([2, 3, 1], passages, priorities, 0x01)).toBe(false);
    expect(tileAllowsDirection([2, 3, 1], passages, priorities, 0x02)).toBe(true);

    const table: RpgTable = {
      dimensions: 3,
      xSize: 2,
      ySize: 1,
      zSize: 3,
      values: [1, 1, 3, 1, 2, 2],
    };
    expect(buildCollisionMasks(table, passages, priorities)).toEqual([0x0e, 0x0f]);
  });

  it("keeps direct transfer provenance and ignores variable transfers", () => {
    const directCommand = rubyObject("RPG::EventCommand", {
      "@code": 201,
      "@indent": 0,
      "@parameters": [0, 12, 8, 4, 2, 0],
    });
    const variableCommand = rubyObject("RPG::EventCommand", {
      "@code": 201,
      "@indent": 0,
      "@parameters": [1, 1, 2, 3, 0, 1],
    });
    const page = rubyObject("RPG::Event::Page", { "@list": [directCommand, variableCommand] });
    const event = rubyObject("RPG::Event", {
      "@id": 7,
      "@name": { kind: "string", bytes: new Uint8Array(), text: "Porte", ivars: {} },
      "@x": 3,
      "@y": 9,
      "@pages": [page],
    });
    const events = { kind: "hash" as const, entries: [[7, event] as const] };
    expect(extractSimpleTransfers(events)).toEqual([{
      eventId: 7,
      eventName: "Porte",
      eventX: 3,
      eventY: 9,
      pageIndex: 0,
      commandIndex: 0,
      targetMapId: 12,
      targetX: 8,
      targetY: 4,
      direction: 2,
      fade: 0,
    }]);
  });
});
