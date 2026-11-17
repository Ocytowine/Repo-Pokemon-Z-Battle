import { describe, expect, it } from "vitest";
import { selectEventPage, type ImportedMap, type ImportedMapEvent } from "../src/imported-map.js";
import { applySafeStateCommands, createSourceEventState } from "../src/source-event-state.js";
import { executeSourceMoveRouteStep } from "../src/source-move-route.js";
import { SourceNpcMotionController, sourceNpcMoveDelay, sourceNpcStepDuration, sourceTrainerSightRange }
  from "../src/source-npc-motion.js";

const map: ImportedMap = {
  id: 3, name: "Test", width: 5, height: 5, tilesetId: 1,
  layers: { lower: Array(25).fill(384), middle: Array(25).fill(0), upper: Array(25).fill(0) },
  collision: { masks: Array(25).fill(15) }, transfers: [],
};

const event: ImportedMapEvent = { id: 6, name: "Promeneur", x: 2, y: 2, pages: [{
  condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
  graphic: { tileId: 0, characterName: "npc", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 1, moveSpeed: 3, moveFrequency: 6, walkAnimation: true,
    stepAnimation: false, directionFix: false, through: false, alwaysOnTop: false, trigger: 0 },
  commands: [],
}] };

describe("source NPC motion", () => {
  it("keeps a falling boulder above characters, replicates its pose, then shows the filled hole", () => {
    const boulder: ImportedMapEvent = { ...event, pages: [
      { ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, characterName: "rocafuerza" },
        settings: { ...event.pages[0]!.settings, moveType: 0 } },
      { ...event.pages[0]!, condition: { ...event.pages[0]!.condition, switch1Id: 773 },
        graphic: { ...event.pages[0]!.graphic, characterName: "" },
        settings: { ...event.pages[0]!.settings, moveType: 0 } },
    ] };
    const hole: ImportedMapEvent = { ...event, id: 7, x: 0, pages: [
      { ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, characterName: "agujero" } },
      { ...event.pages[0]!, condition: { ...event.pages[0]!.condition, switch1Id: 773 },
        graphic: { ...event.pages[0]!.graphic, characterName: "rocagujero2" } },
    ] };
    const host = new SourceNpcMotionController();
    host.reset(map.id, [boulder, hole], 0);
    let actor = host.scriptedActor(boulder.id, map.id, [boulder, hole], createSourceEventState(), 0)!;
    for (const [index, kind] of ["through-on", "always-on-top-on", "step-left", "step-left"].entries()) {
      const result = executeSourceMoveRouteStep(actor, { kind, parameters: [] }, { player: { x: 4, y: 4 } });
      expect(result.supported).toBe(true);
      host.applyScriptedActor(boulder.id, result.actor, result.destination, index * 300);
      actor = result.destination === null ? result.actor : { ...result.actor, ...result.destination };
    }
    expect(host.logicalEvents([boulder])[0]).toMatchObject({ x: hole.x, y: hole.y });
    expect(host.poses(1_200).get(boulder.id)?.alwaysOnTop).toBe(true);
    const guest = new SourceNpcMotionController();
    guest.reset(map.id, [boulder, hole], 0);
    guest.applyNetworkActors([{ eventId: boulder.id, x: hole.x, y: hole.y,
      direction: "left", alwaysOnTop: true }], 1_200);
    expect(guest.poses(1_200).get(boulder.id)?.alwaysOnTop).toBe(true);

    const switched = applySafeStateCommands(createSourceEventState(), { ...boulder.pages[0]!, commands: [
      { kind: "set-switches", text: null, indent: 0, data: { firstId: 773, lastId: 773, value: true } },
    ] }, map.id, boulder.id);
    expect(switched.safe).toBe(true);
    const fallen = switched.state;
    expect(selectEventPage(boulder, map.id, fallen)?.graphic.characterName).toBe("");
    expect(selectEventPage(hole, map.id, fallen)?.graphic.characterName).toBe("rocagujero2");
    host.update(1_500, map, [boulder, hole], fallen, [{ x: 4, y: 4 }]);
    expect(host.poses(1_500).get(boulder.id)?.alwaysOnTop).toBeUndefined();
  });
  it("faces the interacting player, freezes autonomous movement, and restores the previous direction", () => {
    const controller = new SourceNpcMotionController();
    const state = createSourceEventState();
    controller.reset(map.id, [event], 0);
    expect(controller.lockForInteraction(event.id, map.id, [event], state, { x: 3, y: 2 }, 100)).toBe(true);
    expect(controller.poses(100).get(event.id)).toMatchObject({ direction: 6 });
    controller.update(2_000, map, [event], state, [{ x: 3, y: 2 }]);
    expect(controller.logicalEvents([event])[0]).toMatchObject({ x: 2, y: 2 });
    controller.unlockInteraction(event.id, map.id, [event], state, 2_000);
    expect(controller.poses(2_000).get(event.id)).toMatchObject({ direction: 2 });
  });

  it("honors direction fix and sends the host-facing pose to a Coop guest", () => {
    const state = createSourceEventState();
    const fixed = { ...event, pages: [{ ...event.pages[0]!, settings: {
      ...event.pages[0]!.settings, directionFix: true } }] };
    const fixedController = new SourceNpcMotionController();
    fixedController.reset(map.id, [fixed], 0);
    fixedController.lockForInteraction(fixed.id, map.id, [fixed], state, { x: 3, y: 2 }, 100);
    expect(fixedController.poses(100).get(fixed.id)).toMatchObject({ direction: 2 });

    const host = new SourceNpcMotionController();
    const guest = new SourceNpcMotionController();
    host.reset(map.id, [event], 0);
    guest.reset(map.id, [event], 0);
    host.lockForInteraction(event.id, map.id, [event], state, { x: 3, y: 2 }, 100);
    guest.applyNetworkWorldActors(host.worldActors([event], map.id, state), 100);
    expect(guest.poses(100).get(event.id)).toMatchObject({ direction: 6 });
    host.unlockInteraction(event.id, map.id, [event], state, 200);
    guest.applyNetworkWorldActors(host.worldActors([event], map.id, state), 200);
    expect(guest.poses(200).get(event.id)).toMatchObject({ direction: 2 });
  });

  it("repositions a scene actor immediately for source set-event-location commands", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    expect(controller.setScriptedActorLocation(event.id, { x: 4, y: 1 }, 8)).toBe(true);
    expect(controller.poses(0).get(event.id)).toMatchObject({ x: 4, y: 1, direction: 8 });
    expect(controller.setScriptedActorLocation(999, { x: 1, y: 1 })).toBe(false);
  });

  it("converts the original game's step speed and idle frequency to milliseconds", () => {
    expect(sourceNpcStepDuration(1)).toBe(1_067);
    expect(sourceNpcStepDuration(3)).toBe(267);
    expect(sourceNpcStepDuration(6)).toBe(33);
    expect(sourceNpcMoveDelay(3)).toBe(1_717);
    expect(sourceNpcMoveDelay(5)).toBe(517);
    expect(sourceNpcMoveDelay(6)).toBe(17);
  });

  it("starts a deterministic random tile movement and exposes an interpolated pose", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    controller.update(150, map, [event], createSourceEventState(), [{ x: 4, y: 4 }]);
    const logical = controller.logicalEvents([event])[0]!;
    expect(Math.abs(logical.x - event.x) + Math.abs(logical.y - event.y)).toBe(1);
    const start = controller.poses(150).get(event.id)!;
    const middle = controller.poses(150 + sourceNpcStepDuration(3) / 2).get(event.id)!;
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
    controller.update(150, map, [event], createSourceEventState(), [occupiedByPlayer]);
    const logical = controller.logicalEvents([event])[0]!;
    expect(logical).toMatchObject({ x: 2, y: 2 });
  });

  it("recognizes trainer sight ranges and starts a fixed trainer on line of sight", () => {
    expect(sourceTrainerSightRange("Trainer(4)")).toBe(4);
    expect(sourceTrainerSightRange("Promeneur")).toBeNull();
    const trainer: ImportedMapEvent = { ...event, name: "Trainer(4)", x: 2, y: 1,
      pages: [{ ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, direction: 2 },
        settings: { ...event.pages[0]!.settings, moveType: 0, trigger: 2 } }] };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [trainer], 0);
    expect(controller.update(1, map, [trainer], createSourceEventState(), [{ x: 2, y: 4 }]))
      .toMatchObject({ event: { id: trainer.id }, pageIndex: 0, target: { x: 2, y: 4 } });
    expect(controller.logicalEvents([trainer])[0]).toMatchObject({ x: 2, y: 1 });
  });

  it("does not notice a player outside the trainer direction or range", () => {
    const trainer: ImportedMapEvent = { ...event, name: "Trainer(2)", x: 2, y: 1,
      pages: [{ ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, direction: 2 },
        settings: { ...event.pages[0]!.settings, moveType: 0, trigger: 2 } }] };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [trainer], 0);
    expect(controller.update(1, map, [trainer], createSourceEventState(), [{ x: 3, y: 1 }])).toBeNull();
    expect(controller.update(2, map, [trainer], createSourceEventState(), [{ x: 2, y: 4 }])).toBeNull();
  });

  it("selects the nearest visible participant and reports that canonical target", () => {
    const trainer: ImportedMapEvent = { ...event, name: "Trainer(4)", x: 2, y: 1,
      pages: [{ ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, direction: 2 },
        settings: { ...event.pages[0]!.settings, moveType: 0, trigger: 2 } }] };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [trainer], 0);
    expect(controller.update(1, map, [trainer], createSourceEventState(),
      [{ x: 2, y: 4 }, { x: 2, y: 2 }]))
      .toMatchObject({ event: { id: trainer.id }, target: { x: 2, y: 2 } });
  });

  it("keeps a guest blocking without letting them trigger host narration", () => {
    const trainer: ImportedMapEvent = { ...event, name: "Trainer(4)", x: 2, y: 1,
      pages: [{ ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, direction: 2 },
        settings: { ...event.pages[0]!.settings, moveType: 3, trigger: 2,
          moveRoute: { repeat: true, skippable: false,
            steps: [{ kind: "step-down", parameters: [] }] } } }] };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [trainer], 0);
    expect(controller.update(150, map, [trainer], createSourceEventState(),
      [{ x: 2, y: 2 }, { x: 4, y: 4 }], [{ x: 4, y: 4 }])).toBeNull();
    expect(controller.logicalEvents([trainer])[0]).toMatchObject({ x: 2, y: 1 });
  });

  it("does not retrigger a trainer until every participant has left its sight", () => {
    const trainer: ImportedMapEvent = { ...event, name: "Trainer(4)", x: 2, y: 1,
      pages: [{ ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, direction: 2 },
        settings: { ...event.pages[0]!.settings, moveType: 0, trigger: 2 } }] };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [trainer], 0);
    expect(controller.update(1, map, [trainer], createSourceEventState(), [{ x: 2, y: 3 }])).not.toBeNull();
    expect(controller.update(2_000, map, [trainer], createSourceEventState(), [{ x: 2, y: 3 }])).toBeNull();
    expect(controller.update(2_001, map, [trainer], createSourceEventState(), [{ x: 3, y: 3 }])).toBeNull();
    expect(controller.update(2_002, map, [trainer], createSourceEventState(), [{ x: 2, y: 3 }])).not.toBeNull();
  });

  it("does not notice a player through another blocking event", () => {
    const trainer: ImportedMapEvent = { ...event, name: "Trainer(4)", x: 2, y: 1,
      pages: [{ ...event.pages[0]!, graphic: { ...event.pages[0]!.graphic, direction: 2 },
        settings: { ...event.pages[0]!.settings, moveType: 0, trigger: 2 } }] };
    const blocker: ImportedMapEvent = { ...event, id: 7, name: "Obstacle", x: 2, y: 2,
      pages: [{ ...event.pages[0]!, settings: { ...event.pages[0]!.settings, moveType: 0 } }] };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [trainer, blocker], 0);
    expect(controller.update(1, map, [trainer, blocker], createSourceEventState(), [{ x: 2, y: 4 }])).toBeNull();
  });

  it("starts an event-touch sequence when a random autonomous step reaches the player", () => {
    const probe = new SourceNpcMotionController();
    probe.reset(map.id, [event], 0);
    probe.update(150, map, [event], createSourceEventState(), [{ x: 4, y: 4 }]);
    const destination = probe.logicalEvents([event])[0]!;
    const touchingEvent: ImportedMapEvent = {
      ...event, pages: [{ ...event.pages[0]!, settings: { ...event.pages[0]!.settings, trigger: 2 } }],
    };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [touchingEvent], 0);
    const contact = controller.update(150, map, [touchingEvent], createSourceEventState(), [destination]);
    expect(contact).toMatchObject({ event: { id: event.id }, pageIndex: 0 });
    expect(controller.logicalEvents([touchingEvent])[0]).toMatchObject({ x: 2, y: 2 });
  });

  it("loops a custom autonomous route and reports its event-touch contact", () => {
    const routedEvent: ImportedMapEvent = {
      ...event, pages: [{ ...event.pages[0]!, settings: { ...event.pages[0]!.settings, moveType: 3, trigger: 2,
        moveRoute: { repeat: true, skippable: false, steps: [
          { kind: "face-right", parameters: [] }, { kind: "step-right", parameters: [] },
          { kind: "end", parameters: [] },
        ] } } }],
    };
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [routedEvent], 0);
    expect(controller.update(150, map, [routedEvent], createSourceEventState(), [{ x: 3, y: 2 }])).toBeNull();
    const contact = controller.update(151, map, [routedEvent], createSourceEventState(), [{ x: 3, y: 2 }]);
    expect(contact).toMatchObject({ event: { id: event.id }, pageIndex: 0 });
    expect(controller.poses(151).get(event.id)).toMatchObject({ x: 2, y: 2, direction: 6 });
  });

  it("retries a blocked non-skippable route step before taking the next turn", () => {
    const routedEvent: ImportedMapEvent = { ...event, pages: [{ ...event.pages[0]!, settings: {
      ...event.pages[0]!.settings, moveType: 3, moveRoute: { repeat: false, skippable: false,
        steps: [{ kind: "step-right", parameters: [] }, { kind: "step-down", parameters: [] }] },
    } }] };
    const controller = new SourceNpcMotionController();
    const state = createSourceEventState();
    controller.reset(map.id, [routedEvent], 0);
    controller.update(150, map, [routedEvent], state, [{ x: 3, y: 2 }]);
    expect(controller.logicalEvents([routedEvent])[0]).toMatchObject({ x: 2, y: 2 });
    controller.update(300, map, [routedEvent], state, [{ x: 4, y: 4 }]);
    expect(controller.logicalEvents([routedEvent])[0]).toMatchObject({ x: 3, y: 2 });
    controller.update(550, map, [routedEvent], state, [{ x: 4, y: 4 }]);
    controller.update(700, map, [routedEvent], state, [{ x: 4, y: 4 }]);
    expect(controller.logicalEvents([routedEvent])[0]).toMatchObject({ x: 3, y: 3 });
  });

  it("keeps a route speed change for subsequent steps and sends it to a Coop guest", () => {
    const routedEvent: ImportedMapEvent = { ...event, pages: [{ ...event.pages[0]!, settings: {
      ...event.pages[0]!.settings, moveType: 3, moveRoute: { repeat: false, skippable: false,
        steps: [{ kind: "change-speed", parameters: [6] }, { kind: "step-right", parameters: [] }] },
    } }] };
    const state = createSourceEventState();
    const host = new SourceNpcMotionController();
    host.reset(map.id, [routedEvent], 0);
    host.update(150, map, [routedEvent], state, [{ x: 4, y: 4 }]);
    host.update(151, map, [routedEvent], state, [{ x: 4, y: 4 }]);
    const snapshot = host.worldActors([routedEvent], map.id, state);
    expect(snapshot[0]).toMatchObject({ x: 3, y: 2, moveSpeed: 6, action: "step" });
    expect(host.poses(151 + sourceNpcStepDuration(6) / 2).get(event.id)?.x).toBeCloseTo(2.5);
    const guest = new SourceNpcMotionController();
    guest.reset(map.id, [routedEvent], 0);
    guest.applyNetworkWorldActors(snapshot, 1_000);
    expect(guest.poses(1_000 + sourceNpcStepDuration(6) / 2).get(event.id)?.x).toBeCloseTo(2.5);
  });

  it("starts consecutive fast steps at the source cadence without an extra render-frame pause", () => {
    const fastEvent: ImportedMapEvent = { ...event, pages: [{ ...event.pages[0]!, settings: {
      ...event.pages[0]!.settings, moveType: 3, moveSpeed: 6, moveFrequency: 6,
      moveRoute: { repeat: false, skippable: false,
        steps: [{ kind: "step-right", parameters: [] }, { kind: "step-right", parameters: [] }] },
    } }] };
    const controller = new SourceNpcMotionController();
    const state = createSourceEventState();
    controller.reset(map.id, [fastEvent], 0);
    controller.update(17, map, [fastEvent], state, [{ x: 0, y: 0 }]);
    expect(controller.logicalEvents([fastEvent])[0]).toMatchObject({ x: 3, y: 2 });
    controller.update(67, map, [fastEvent], state, [{ x: 0, y: 0 }]);
    expect(controller.logicalEvents([fastEvent])[0]).toMatchObject({ x: 4, y: 2 });
    expect(controller.poses(83.5).get(event.id)?.x).toBeCloseTo(3.5);
  });

  it("animates a scripted route and exposes its graphic changes", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    const actor = controller.scriptedActor(event.id, map.id, [event], createSourceEventState(), 100)!;
    const duration = controller.applyScriptedActor(event.id,
      { ...actor, direction: "right", characterName: "npc-revealed", opacity: 128, pattern: 2 },
      { x: 3, y: 2 }, 100);
    expect(duration).toBe(267);
    expect(controller.logicalEvents([event])[0]).toMatchObject({ x: 3, y: 2 });
    expect(controller.poses(100 + duration / 2).get(event.id)).toMatchObject({
      x: 2.5, y: 2, direction: 6, characterName: "npc-revealed", opacity: 128,
    });
  });

  it("renders a scripted jump as an arc with a duration scaled to its distance", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    const actor = controller.scriptedActor(event.id, map.id, [event], createSourceEventState(), 100)!;
    const duration = controller.applyScriptedActor(event.id, actor, { x: 6, y: 2 }, 100, "jump");

    expect(duration).toBe(1_068);
    expect(controller.poses(100 + duration / 2).get(event.id)).toMatchObject({ x: 4, y: 2 });
    expect(controller.poses(100 + duration / 2).get(event.id)?.renderOffsetY).toBeLessThan(-10);
    expect(controller.poses(100 + duration).get(event.id)).toMatchObject({ x: 6, y: 2, renderOffsetY: 0 });
  });

  it("replays a narrative actor's vertical jump offset for a Coop guest", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    controller.applyNetworkActors([
      { eventId: event.id, x: event.x, y: event.y, direction: "down", renderOffsetY: -14 },
    ], 100);

    expect(controller.poses(100).get(event.id)).toMatchObject({ renderOffsetY: -14 });
  });

  it("exports logical world actors and interpolates a host step on a guest", () => {
    const host = new SourceNpcMotionController();
    host.reset(map.id, [event], 0);
    host.update(150, map, [event], createSourceEventState(), [{ x: 4, y: 4 }]);
    const actors = host.worldActors([event], map.id, createSourceEventState());
    expect(actors).toHaveLength(1);
    expect(actors[0]).toMatchObject({ eventId: event.id, blocking: true, moveSpeed: 3, action: "step" });

    const guest = new SourceNpcMotionController();
    guest.reset(map.id, [event], 0);
    guest.applyNetworkWorldActors(actors, 1_000);
    const start = guest.poses(1_000).get(event.id)!;
    const middle = guest.poses(1_000 + sourceNpcStepDuration(3) / 2).get(event.id)!;
    guest.applyNetworkWorldActors(actors.map((actor) => ({ ...actor, action: "idle" as const })), 1_150);
    const afterEarlyIdle = guest.poses(1_175).get(event.id)!;
    const end = guest.poses(1_000 + sourceNpcStepDuration(3)).get(event.id)!;
    expect(start).toMatchObject({ x: event.x, y: event.y });
    expect(Math.abs(middle.x - start.x) + Math.abs(middle.y - start.y)).toBeCloseTo(0.5);
    expect(Math.abs(afterEarlyIdle.x - start.x) + Math.abs(afterEarlyIdle.y - start.y)).toBeCloseTo(175 / sourceNpcStepDuration(3));
    expect(end).toMatchObject({ x: actors[0]!.x, y: actors[0]!.y });
  });

  it("restores a canonical actor position without replaying a stale step", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    controller.applyNetworkWorldActors([{ eventId: event.id, x: 3, y: 2, direction: "right",
      blocking: true, moveSpeed: 3, action: "idle" }], 2_000);
    expect(controller.poses(2_000).get(event.id)).toMatchObject({ x: 3, y: 2, direction: 6 });
  });

  it("continues a corrected network step from the displayed pose without jumping", () => {
    const controller = new SourceNpcMotionController();
    controller.reset(map.id, [event], 0);
    controller.applyNetworkWorldActors([{ eventId: event.id, x: 3, y: 2, direction: "right",
      blocking: true, moveSpeed: 3, action: "step" }], 1_000);
    expect(controller.poses(1_125).get(event.id)?.x).toBeCloseTo(2 + 125 / sourceNpcStepDuration(3));
    controller.applyNetworkWorldActors([{ eventId: event.id, x: 4, y: 2, direction: "right",
      blocking: true, moveSpeed: 3, action: "step" }], 1_125);
    expect(controller.poses(1_125).get(event.id)?.x).toBeCloseTo(2 + 125 / sourceNpcStepDuration(3));
    expect(controller.poses(1_600).get(event.id)).toMatchObject({ x: 4, y: 2 });
  });
});
