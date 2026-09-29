import { describe, expect, it } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { SourceDialogueController } from "../src/source-dialogue-controller.js";
import { createSourceEventState } from "../src/source-event-state.js";

type Command = ImportedEventPage["commands"][number];
const condition = { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null } as const;
const command = (kind: string, indent: number, data: Readonly<Record<string, unknown>> = {}): Command =>
  ({ kind, indent, text: typeof data.text === "string" ? data.text : null, data });
const page = (commands: readonly Command[]): ImportedEventPage => ({
  condition,
  graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false, directionFix: false,
    through: false, alwaysOnTop: false, trigger: 0 },
  commands,
});

describe("source dialogue controller", () => {
  it("advances through text, waits for a choice and completes the selected branch", () => {
    const controller = new SourceDialogueController();
    const state = createSourceEventState();
    const eventPage = page([
      command("show-text", 0, { text: "Question" }),
      command("show-choices", 0, { choices: ["Oui", "Non"], cancelType: 2 }),
      command("choice-branch", 0, { choiceIndex: 0 }),
      command("show-text", 1, { text: "Accepté" }),
      command("choice-branch", 0, { choiceIndex: 1 }),
      command("show-text", 1, { text: "Refusé" }),
      command("choice-end", 0),
      command("end", 0),
    ]);

    const started = controller.begin(eventPage, 3, 7, "Personnage", new Map(), state, 8);
    expect(started).toMatchObject({ changed: true, completed: null });
    expect(controller.current).toMatchObject({ lines: ["Question"], index: 0, choosing: false });

    controller.advance();
    expect(controller.current).toMatchObject({ choosing: true, shownLines: 1 });

    const selected = controller.choose(1, state, 8);
    expect(selected.completed).toBeNull();
    expect(controller.current).toMatchObject({ lines: ["Refusé"], choosing: false, selections: [1] });

    const completed = controller.advance();
    expect(controller.current).toBeNull();
    expect(completed.completed?.flow.complete).toBe(true);
    expect(completed.completed?.flow.page.commands.map((entry) => entry.text ?? entry.kind))
      .toEqual(["Question", "Refusé", "end"]);
  });

  it("completes events without dialogue immediately and supports cancellation", () => {
    const controller = new SourceDialogueController();
    const state = createSourceEventState();
    const completed = controller.begin(page([command("set-switches", 0, { firstId: 1, lastId: 1, value: true })]),
      3, 7, "Interrupteur", new Map(), state, 2);
    expect(completed.completed?.flow.complete).toBe(true);
    expect(controller.current).toBeNull();

    controller.begin(page([command("show-text", 0, { text: "Bonjour" })]), 3, 8, "Personnage", new Map(), state, 2);
    expect(controller.cancel()).toBe(true);
    expect(controller.current).toBeNull();
    expect(controller.cancel()).toBe(false);
  });
});
