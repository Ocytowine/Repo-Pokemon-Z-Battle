import { describe, expect, it } from "vitest";
import type { ImportedEventPage, ImportedMapEvent } from "../src/imported-map.js";
import { isKnownSourceCommand, isSourceStateCommand, sourceCommandCapability } from "../src/source-command-registry.js";
import { compileSourceScene, formatSourceSceneAudit } from "../src/source-scene-plan.js";

const page = (commands: ImportedEventPage["commands"]): ImportedEventPage => ({
  condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
  graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false,
    directionFix: false, through: false, alwaysOnTop: false, trigger: 3 }, commands,
});
const command = (kind: string, data: Readonly<Record<string, unknown>> = {}) =>
  ({ kind, text: null, indent: 0, data });

describe("source command registry", () => {
  it.each([
    ["show-text", "dialogue", "rendered", false],
    ["set-switches", "state", "executed", true],
    ["move-route", "movement", "rendered", false],
    ["screen-tone", "audiovisual", "rendered", false],
    ["scroll-map", "audiovisual", "rendered", false],
    ["show-animation", "audiovisual", "rendered", false],
    ["play-cry", "audiovisual", "rendered", false],
    ["play-jingle", "audiovisual", "rendered", false],
    ["panorama-motion", "audiovisual", "rendered", false],
    ["request-trainer-battle", "transition", "executed", false],
    ["text-options", "metadata", "rendered", false],
    ["move-route-continuation", "movement", "absorbed", false],
  ])("classifies %s once", (kind, family, support, state) => {
    expect(sourceCommandCapability(kind)).toMatchObject({ family, support });
    expect(isKnownSourceCommand(kind)).toBe(true);
    expect(isSourceStateCommand(kind)).toBe(state);
  });

  it("audits targets, route-only sprites and pending presentation", () => {
    const commands = [
      command("show-text", { text: "Bonjour" }),
      command("move-route", { target: 5, route: { repeat: false, skippable: false, steps: [
        { kind: "change-graphic", parameters: ["crisantow2", 0, 2, 0] }, { kind: "end", parameters: [] },
      ] } }),
      command("screen-tone"),
    ];
    const event: ImportedMapEvent = { id: 5, name: "Christian", x: 1, y: 1, pages: [page([])] };
    const plan = compileSourceScene(page(commands), [event], new Set(["crisantow2"]));
    expect(plan.audit).toMatchObject({ commandCount: 3, routeTargets: [5], missingTargets: [],
      characterAssets: ["crisantow2"], pendingPresentation: [], complete: true });
    expect(formatSourceSceneAudit(plan.audit)).toContain("aucun rendu en attente");
  });

  it("fails the audit for unknown commands, invalid routes and missing actors", () => {
    const plan = compileSourceScene(page([
      command("future-command"), command("move-route", { target: 42, route: { broken: true } }),
    ]));
    expect(plan.audit).toMatchObject({ unknownCommands: ["future-command"], invalidRoutes: [1],
      missingTargets: [42], complete: false });
  });

  it("reports a route-only sprite that was not preloaded", () => {
    const plan = compileSourceScene(page([command("move-route", { target: -1,
      route: { repeat: false, skippable: false, steps: [
        { kind: "change-graphic", parameters: ["missing-sprite", 0, 2, 0] },
      ] } })]), [], new Set());
    expect(plan.audit).toMatchObject({ missingCharacterAssets: ["missing-sprite"], complete: false });
  });

  it("clears the EV017 presentation audit once every visual command is rendered", () => {
    const rendered = ["screen-tone", "change-map-settings", "show-picture", "move-picture", "erase-picture",
      "play-music", "play-sound", "fade-music"].map((kind) => command(kind));
    const plan = compileSourceScene(page([...rendered, command("show-animation"), command("scroll-map"),
      command("text-options")]));
    expect(plan.audit.pendingPresentation).toEqual([]);
  });
});
