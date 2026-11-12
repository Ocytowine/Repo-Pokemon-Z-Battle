import { describe, expect, it } from "vitest";
import type { ImportedEventPage, ImportedMapEvent } from "../src/imported-map.js";
import { finalDirectSourceTransfer, findActiveSourceParallelEvents, findNewlyActivatedSourceAutorun,
  findSourceMapEntryAutorun, resumeSourceMapEntryAutorun, sourceMapEntryAmbientVisuals } from "../src/source-autorun.js";
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

  it("selects the first active autorun when entering a map", () => {
    const laterEvent = { ...openingEvent, id: 29, name: "later" };
    expect(findSourceMapEntryAutorun([laterEvent, openingEvent], 3, createSourceEventState()))
      .toMatchObject({ event: { id: 1 }, pageIndex: 0 });
  });

  it("resumes a map-entry scene after the foreground becomes free", () => {
    const state = { ...createSourceEventState(), variables: { 194: 4 } };
    const neutralPage = { ...page, settings: { ...page.settings, trigger: 0 },
      condition: { ...page.condition, switch1Id: null, variable: { id: 194, minimum: 5 } } };
    const storyPage = { ...page,
      condition: { ...page.condition, switch1Id: null, variable: { id: 194, minimum: 3 } } };
    const storyEvent = { ...event, id: 32, pages: [storyPage, neutralPage] };
    const select = () => findSourceMapEntryAutorun([storyEvent], 283, state);
    const started: number[] = [];
    const start = (autorun: { event: ImportedMapEvent }) => { started.push(autorun.event.id); return true; };
    const busy = resumeSourceMapEntryAutorun(283, 283, false, select, start);
    expect(busy).toEqual({ pendingMapId: 283, started: false });
    expect(started).toEqual([]);
    expect(resumeSourceMapEntryAutorun(busy.pendingMapId, 283, true, select, start))
      .toEqual({ pendingMapId: null, started: true });
    expect(started).toEqual([32]);
  });

  it("advances to the next map-entry effect after a self-erasing autorun", () => {
    const cleanup = { ...openingEvent, id: 41, pages: [{ ...openingEvent.pages[0]!, commands: [
      { kind: "weather", text: null, indent: 0, data: { parameters: [0, 5, 0] } },
      { kind: "erase-event", text: null, indent: 0, data: {} },
    ] }] };
    const fog = { ...openingEvent, id: 42, pages: [{ ...openingEvent.pages[0]!, commands: [
      { kind: "change-map-settings", text: null, indent: 0,
        data: { parameters: [1, "fogCiudadRomantis", 0, 175, 1, 200, 0, 0] } },
      { kind: "erase-event", text: null, indent: 0, data: {} },
    ] }] };
    const state = createSourceEventState();
    expect(findSourceMapEntryAutorun([fog, cleanup], 233, state)?.event.id).toBe(41);
    expect(findSourceMapEntryAutorun([fog], 233, state)?.event.id).toBe(42);
    expect(sourceMapEntryAmbientVisuals([cleanup, fog], 233, state)).toEqual([fog.pages[0]!.commands[0]]);
    expect(sourceMapEntryAmbientVisuals([fog, openingEvent], 233, state)).toEqual([fog.pages[0]!.commands[0]]);
  });

  it("selects active parallel pages in deterministic event order", () => {
    const parallelPage = { ...page,
      condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
      settings: { ...page.settings, trigger: 4 } };
    const parallelEvent = { ...openingEvent, id: 25, pages: [parallelPage] };
    const earlierParallel = { ...parallelEvent, id: 9 };
    expect(findActiveSourceParallelEvents([parallelEvent, openingEvent, earlierParallel], 3,
      createSourceEventState()).map(({ event: activeEvent }) => activeEvent.id)).toEqual([9, 25]);
  });

  it("uses the final direct transfer after a narrative sequence", () => {
    expect(finalDirectSourceTransfer(commands, 17, 0, { x: 52, y: 22 })).toEqual({
      eventId: 17, pageIndex: 0, eventX: 52, eventY: 22,
      targetMapId: 3, targetX: 15, targetY: 16, direction: 2, fade: 0,
    });
  });
});
