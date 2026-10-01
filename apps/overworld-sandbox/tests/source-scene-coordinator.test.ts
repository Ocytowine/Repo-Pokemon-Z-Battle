import { describe, expect, it } from "vitest";
import { SourceSceneCoordinator, type SourceSceneActivity } from "../src/source-scene-coordinator.js";

const idle: SourceSceneActivity = { dialogue: false, battle: false, transition: false, sequence: false, movement: false };

describe("source scene coordinator", () => {
  it("opens and closes the menu only from an idle overworld", () => {
    const scenes = new SourceSceneCoordinator();
    expect(scenes.openMenu(idle)).toBe(true);
    expect(scenes.mode(idle)).toBe("menu");
    expect(scenes.closeMenu()).toBe(true);
    expect(scenes.mode(idle)).toBe("overworld");
  });

  it.each(["dialogue", "battle", "transition", "sequence", "movement"] as const)("blocks the menu during %s", (key) => {
    const scenes = new SourceSceneCoordinator();
    expect(scenes.openMenu({ ...idle, [key]: true })).toBe(false);
    expect(scenes.menuOpen).toBe(false);
  });

  it("keeps the selected section between openings", () => {
    const scenes = new SourceSceneCoordinator();
    scenes.selectMenuTab("coop");
    scenes.openMenu(idle);
    expect(scenes.menuTab).toBe("coop");
  });

  it.each(["world-input", "scene-change", "start-sequence"] as const)("only allows %s from an idle overworld", (action) => {
    const scenes = new SourceSceneCoordinator();
    expect(scenes.allows(action, idle)).toBe(true);
    for (const key of ["dialogue", "battle", "transition", "sequence", "movement"] as const) {
      expect(scenes.allows(action, { ...idle, [key]: true })).toBe(false);
    }
    scenes.openMenu(idle);
    expect(scenes.allows(action, idle)).toBe(false);
  });

  it("separates dialogue input, ambient movement and scripted transfers", () => {
    const scenes = new SourceSceneCoordinator();
    expect(scenes.allows("dialogue-input", { ...idle, dialogue: true })).toBe(true);
    expect(scenes.allows("world-input", { ...idle, dialogue: true })).toBe(false);
    expect(scenes.allows("ambient-motion", { ...idle, movement: true })).toBe(true);
    expect(scenes.allows("source-transfer", { ...idle, sequence: true })).toBe(true);
    expect(scenes.allows("source-transfer", { ...idle, sequence: true, transition: true })).toBe(false);
  });
});
