import { describe, expect, it } from "vitest";
import type { ImportedMap, ImportedMapEvent } from "../src/imported-map.js";
import { createSourceEventState } from "../src/source-event-state.js";
import { SourceNpcMotionController, sourceNpcMoveDelay, sourceNpcStepDuration } from "../src/source-npc-motion.js";

const map: ImportedMap = {
  id: 3, name: "Test", width: 5, height: 5, tilesetId: 1,
  layers: { lower: Array(25).fill(384), middle: Array(25).fill(0), upper: Array(25).fill(0) },
  collision: { masks: Array(25).fill(15) }, transfers: [],
};

const event: ImportedMapEvent = { id: 6, name: "Promeneur", x: 2, y: 2, pages: [{
  condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
  graphic: { tileId: 0, characterName: "npc", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 1, moveSpeed: 3, moveFrequency: 5, walkAnimation: true,
    stepAnimation: false, directionFix: false, through: false, alwaysOnTop: false, trigger: 0 },
  commands: [],
}] };

describe("source NPC motion", () => {
  it("converts source speed and frequency to bounded timings", () => {
    expect(sourceNpcStepDuration(3)).toBe(250);
    expect(sourceNpcStepDuration(6)).toBe(80);
    expect(sourceNpcMoveDelay(3)).toBe(700);
    expect(sourceNpcMoveDelay(5)).toBe(150);
  });

  it("starts a deterministic random tile movement and exposes an interpolated pose", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    controller.update(150, map, [event], createSourceEventState(), { x: 4, y: 4 });
    const logical = controller.logicalEvents([event])[0]!;
    expect(Math.abs(logical.x - event.x) + Math.abs(logical.y - event.y)).toBe(1);
    const start = controller.poses(150).get(event.id)!;
    const middle = controller.poses(275).get(event.id)!;
    expect(start).toMatchObject({ x: 2, y: 2, pattern: 0 });
    expect(middle.pattern).toBe(1);
    expect(Math.abs(middle.x - start.x) + Math.abs(middle.y - start.y)).toBeCloseTo(0.5);
  });

  it("keeps an occupied destination blocked", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    const initialDirection = controller.poses(0).get(event.id)!.direction;
    const occupiedByPlayer = initialDirection === 2 ? { x: 2, y: 3 } : initialDirection === 4 ? { x: 1, y: 2 }
      : initialDirection === 6 ? { x: 3, y: 2 } : { x: 2, y: 1 };
    controller.update(150, map, [event], createSourceEventState(), occupiedByPlayer);
    const logical = controller.logicalEvents([event])[0]!;
    expect(logical).toMatchObject({ x: 2, y: 2 });
  });

  it("animates a scripted route and exposes its graphic changes", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    const actor = controller.scriptedActor(event.id, map.id, [event], createSourceEventState(), 100)!;
    const duration = controller.applyScriptedActor(event.id,
      { ...actor, direction: "right", characterName: "npc-revealed", opacity: 128, pattern: 2 },
      { x: 3, y: 2 }, 100);
    expect(duration).toBe(250);
    expect(controller.logicalEvents([event])[0]).toMatchObject({ x: 3, y: 2 });
    expect(controller.poses(225).get(event.id)).toMatchObject({
      x: 2.5, y: 2, direction: 6, characterName: "npc-revealed", opacity: 128,
    });
  });
});
