import { describe, expect, it } from "vitest";
import { executeSourceMoveRouteStep, parseSourceMoveRoute, type SourceRouteActor } from "../src/source-move-route.js";

const actor: SourceRouteActor = {
  x: 5, y: 5, direction: "up", moveSpeed: 3, moveFrequency: 3,
  walkAnimation: true, stepAnimation: false, directionFix: false, through: false, alwaysOnTop: false,
  opacity: 255, characterName: "hero", characterHue: 0, pattern: 0,
};
const context = { player: { x: 8, y: 5 }, randomDirection: "left" as const };
const run = (kind: string, parameters: readonly unknown[] = []) =>
  executeSourceMoveRouteStep(actor, { kind, parameters }, context);

describe("source move routes", () => {
  it("parses a validated source route", () => {
    expect(parseSourceMoveRoute({ repeat: false, skippable: true, steps: [
      { kind: "step-up", parameters: [] }, { kind: "end", parameters: [] },
    ] })).toMatchObject({ repeat: false, skippable: true, steps: [{ kind: "step-up" }, { kind: "end" }] });
    expect(parseSourceMoveRoute({ repeat: false, skippable: false, steps: [{ kind: 3, parameters: [] }] })).toBeNull();
  });

  it("resolves directional, relative, targeted and jump movements", () => {
    expect(run("step-right")).toMatchObject({ destination: { x: 6, y: 5 }, actor: { direction: "right" } });
    expect(run("step-forward")).toMatchObject({ destination: { x: 5, y: 4 }, actor: { direction: "up" } });
    expect(run("step-backward")).toMatchObject({ destination: { x: 5, y: 6 }, actor: { direction: "up" } });
    expect(run("step-toward-player")).toMatchObject({ destination: { x: 6, y: 5 }, actor: { direction: "right" } });
    expect(run("step-random")).toMatchObject({ destination: { x: 4, y: 5 }, actor: { direction: "left" } });
    expect(run("jump", [2, -1])).toMatchObject({ destination: { x: 7, y: 4 } });
  });

  it("applies waits, orientation and presentation changes", () => {
    expect(run("wait", [8])).toMatchObject({ waitMs: 200 });
    expect(run("face-right")).toMatchObject({ actor: { direction: "right" } });
    expect(run("turn-around")).toMatchObject({ actor: { direction: "down" } });
    expect(run("change-graphic", ["crisantow2", 0, 4, 1])).toMatchObject({
      actor: { characterName: "crisantow2", direction: "left", pattern: 1 },
    });
    expect(run("change-opacity", [100])).toMatchObject({ actor: { opacity: 100 } });
    expect(run("direction-fix-on")).toMatchObject({ actor: { directionFix: true } });
  });

  it("reports route completion, switch effects and unsupported steps", () => {
    expect(run("switch-on", [67])).toMatchObject({ switchChange: { id: 67, value: true } });
    expect(run("end")).toMatchObject({ complete: true, supported: true });
    expect(run("ruby-script", ["puts 'x'"])).toMatchObject({ supported: false, reason: expect.stringContaining("ruby-script") });
  });
});
