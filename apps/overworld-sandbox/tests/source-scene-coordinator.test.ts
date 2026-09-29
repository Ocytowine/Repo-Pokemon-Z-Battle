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
    scenes.selectMenuTab("bag");
    scenes.openMenu(idle);
    expect(scenes.menuTab).toBe("bag");
  });
});
