import { describe, expect, it } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { expandSourceCommonEvents, type SourceCommonEvent } from "../src/source-common-events.js";

const basePage: Omit<ImportedEventPage, "commands"> = {
  condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
  graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true,
    stepAnimation: false, directionFix: false, through: false, alwaysOnTop: false, trigger: 0 },
};

const command = (kind: string, indent = 0, data: Readonly<Record<string, unknown>> = {}) =>
  ({ kind, text: null, indent, data });

describe("source common events", () => {
  it("expands a common event inline while preserving nested indentation", () => {
    const common: SourceCommonEvent = { id: 58, name: "TenerGolpeRoca", commands: [
      command("show-text", 0, { text: "Rocher" }), command("condition", 0),
      command("grant-item", 1), command("condition-end", 0),
    ] };
    const page: ImportedEventPage = { ...basePage, commands: [
      command("condition", 0), command("call-common-event", 1, { parameters: [58] }),
      command("condition-end", 0),
    ] };

    expect(expandSourceCommonEvents(page, new Map([[58, common]])).commands.map((entry) =>
      [entry.kind, entry.indent])).toEqual([
      ["condition", 0], ["show-text", 1], ["condition", 1], ["grant-item", 2],
      ["condition-end", 1], ["condition-end", 0],
    ]);
  });

  it("keeps a cyclic call visible to the scene audit", () => {
    const common: SourceCommonEvent = { id: 7, name: "Cycle",
      commands: [command("call-common-event", 0, { parameters: [7] })] };
    const page: ImportedEventPage = { ...basePage,
      commands: [command("call-common-event", 0, { parameters: [7] })] };

    expect(expandSourceCommonEvents(page, new Map([[7, common]])).commands[0])
      .toMatchObject({ kind: "call-common-event", data: { expansionError: "cycle" } });
  });
});
