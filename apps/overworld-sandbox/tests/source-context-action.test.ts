import { describe, expect, it } from "vitest";
import type { ActiveMapEvent } from "../src/imported-map.js";
import { resolveSourceContextAction } from "../src/source-context-action.js";
import { SourceSceneCoordinator } from "../src/source-scene-coordinator.js";

const base = { dialogue: null, worldAvailable: true, event: null, eventTransfer: false,
  remotePlayer: false, joinableBattle: false, traversal: null, sprintAllowed: true } as const;
const event = { event: { id: 1 }, page: { settings: { trigger: 0 }, graphic: {
  characterName: "npc", tileId: 0 }, commands: [{ kind: "show-text" }] }, pageIndex: 0 } as ActiveMapEvent;

describe("context action button", () => {
  it("uses the existing interaction for dialogue, NPCs, signs and Coop players", () => {
    expect(resolveSourceContextAction({ ...base, dialogue: "continue" }).label).toBe("Suite");
    expect(resolveSourceContextAction({ ...base, event }).label).toBe("Parler");
    expect(resolveSourceContextAction({ ...base, event: { ...event, page: { ...event.page,
      graphic: { ...event.page.graphic, characterName: "", tileId: 384 } } } }).label).toBe("Lire");
    expect(resolveSourceContextAction({ ...base, remotePlayer: true }).label).toBe("Défier");
    expect(resolveSourceContextAction({ ...base, joinableBattle: true }).label).toBe("Rejoindre");
  });

  it("offers sprint only on an empty actionable tile when movement permits it", () => {
    expect(resolveSourceContextAction(base).kind).toBe("sprint");
    expect(resolveSourceContextAction({ ...base, sprintAllowed: false }).kind).toBe("unavailable");
    expect(resolveSourceContextAction({ ...base, worldAvailable: false }).kind).toBe("unavailable");
    expect(resolveSourceContextAction({ ...base, traversal: "dive" }).label).toBe("Plonger");
    const touchTransfer = { ...event, page: { ...event.page, settings: { ...event.page.settings, trigger: 1 } } };
    expect(resolveSourceContextAction({ ...base, event: touchTransfer, eventTransfer: true }).kind).toBe("interact");
    expect(resolveSourceContextAction({ ...base, event: touchTransfer }).kind).toBe("sprint");
  });

  it("keeps sprint available during a walking step while interaction waits for the step to finish", () => {
    const scenes = new SourceSceneCoordinator();
    const moving = { dialogue: false, battle: false, transition: false, sequence: false, movement: true };
    expect(scenes.allows("world-input", moving)).toBe(false);
    expect(scenes.mode(moving)).toBe("overworld");
    expect(resolveSourceContextAction({ ...base,
      worldAvailable: scenes.mode(moving) === "overworld" }).kind).toBe("sprint");
  });
});
