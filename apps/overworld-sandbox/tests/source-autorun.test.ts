import { describe, expect, it } from "vitest";
import type { ImportedEventPage, ImportedMapEvent } from "../src/imported-map.js";
import { finalDirectSourceTransfer, findNewlyActivatedSourceAutorun } from "../src/source-autorun.js";
import { createSourceEventState } from "../src/source-event-state.js";

const commands: ImportedEventPage["commands"] = [
  { kind: "transfer-player", text: null, indent: 0,
    data: { addressing: "direct", map: 2, x: 53, y: 22, direction: 8, fade: 0 } },
  { kind: "show-text", text: "Suite", indent: 0, data: { text: "Suite" } },
  { kind: "transfer-player", text: null, indent: 0,
    data: { addressing: "direct", map: 3, x: 15, y: 16, direction: 2, fade: 0 } },
];
const page: ImportedEventPage = {
  condition: { switch1Id: 65, switch2Id: null, variable: null, selfSwitch: null },
  graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false,
    directionFix: false, through: false, alwaysOnTop: false, trigger: 3 }, commands,
};
const event: ImportedMapEvent = { id: 17, name: "EV017", x: 49, y: 18, pages: [page] };
const openingEvent: ImportedMapEvent = {
  id: 1, name: "EV001", x: 0, y: 0,
  pages: [{ ...page, condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null } }],
};

describe("source autorun selection", () => {
  it("selects only the autorun newly activated by the state change", () => {
    const previousState = createSourceEventState();
    const nextState = { ...previousState, switches: { 65: true } };
    expect(findNewlyActivatedSourceAutorun([openingEvent, event], 2, previousState, nextState))
      .toMatchObject({ event: { id: 17 }, pageIndex: 0 });
  });

  it("does not restart an autorun that was already active", () => {
    const state = { ...createSourceEventState(), switches: { 65: true } };
    expect(findNewlyActivatedSourceAutorun([openingEvent, event], 2, state, state)).toBeNull();
  });

  it("uses the final direct transfer after a narrative sequence", () => {
    expect(finalDirectSourceTransfer(commands, 17, 0, { x: 52, y: 22 })).toEqual({
      eventId: 17, pageIndex: 0, eventX: 52, eventY: 22,
      targetMapId: 3, targetX: 15, targetY: 16, direction: 2,
    });
  });
});
