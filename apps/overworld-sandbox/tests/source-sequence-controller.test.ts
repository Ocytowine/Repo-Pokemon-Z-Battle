import { describe, expect, it, vi } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { SourceSequenceController } from "../src/source-sequence-controller.js";
import type { SourceScenePlan } from "../src/source-scene-plan.js";

function plan(commands: ImportedEventPage["commands"]): SourceScenePlan {
  const page = { id: 1, conditions: {}, graphic: {}, settings: {}, commands } as ImportedEventPage;
  return { page, steps: commands.map((command, index) => ({ index, command, capability: null })),
    audit: { complete: true, commandCount: commands.length, counts: {}, unknownCommands: [],
      invalidRoutes: [], routeTargets: [], missingTargets: [], characterAssets: [], missingCharacterAssets: [],
      pendingPresentation: [] } };
}

describe("source sequence controller", () => {
  it("groups text continuations and resumes at the next command", async () => {
    const textPages: ImportedEventPage[] = [];
    const executed: string[] = [];
    const controller = new SourceSequenceController({
      dialogueActive: () => false,
      onText: (_session, page) => { textPages.push(page); },
      onChoice: vi.fn(),
      executeCommand: async (_session, command) => { executed.push(command.kind); return "continue"; },
      onComplete: vi.fn(),
      onError: vi.fn(),
    });
    const session = controller.start({ label: "scene", mapId: 3, eventId: 4, translations: new Map(),
      plan: plan([{ kind: "show-text", text: "A", indent: 0, data: { text: "A" } },
        { kind: "text-continuation", text: "B", indent: 0, data: { text: "B" } },
        { kind: "end", text: null, indent: 0, data: {} }]) });
    await Promise.resolve();
    expect(textPages[0]?.commands.map((command) => command.kind)).toEqual(["show-text", "text-continuation"]);
    expect(session.cursor).toBe(2);
    await controller.advance();
    expect(executed).toEqual(["end"]);
    expect(controller.current).toBeNull();
  });

  it("pauses commands and reports the exact failing command", async () => {
    const errors: string[] = [];
    let pause = true;
    const controller = new SourceSequenceController({
      dialogueActive: () => false,
      onText: vi.fn(),
      onChoice: vi.fn(),
      executeCommand: async (_session, command) => {
        if (pause) { pause = false; return "pause"; }
        throw new Error(command.kind);
      },
      onComplete: vi.fn(),
      onError: (_session, kind) => { errors.push(kind); },
    });
    controller.start({ label: "scene", mapId: 3, eventId: 4, translations: new Map(),
      plan: plan([{ kind: "wait", text: null, indent: 0, data: { frames: 1 } },
        { kind: "end", text: null, indent: 0, data: {} }]) });
    await Promise.resolve();
    expect(controller.current?.cursor).toBe(1);
    await controller.advance();
    expect(errors).toEqual(["end"]);
    expect(controller.current).toBeNull();
  });
});
