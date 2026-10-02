import { describe, expect, it } from "vitest";
import { guestSourceEventAccess, shouldRejoinSharedSourceMap, sourceInteractionTarget, sourceStateWithHostStory }
  from "../src/source-coop-policy.js";
import type { ImportedEventPage } from "../src/imported-map.js";
import { createSourceEventState } from "../src/source-event-state.js";

function page(kinds: readonly string[]): ImportedEventPage {
  return { conditions: { switch1Valid: false, switch2Valid: false, variableValid: false,
    selfSwitchValid: false }, graphic: { tileId: 0, characterName: "", characterHue: 0, direction: 2,
    pattern: 0, opacity: 255, blendType: 0 }, settings: { moveType: 0, moveSpeed: 3,
    moveFrequency: 3, moveRoute: null, walkAnimation: true, stepAnimation: false,
    directionFix: false, through: false, alwaysOnTop: false, trigger: 0 },
  commands: kinds.map((kind) => ({ kind, text: null, indent: 0, data: {} })) };
}

describe("guest source event policy", () => {
  it("keeps map interactions ahead of player challenges", () => {
    expect(sourceInteractionTarget(true, true)).toBe("event");
    expect(sourceInteractionTarget(true, false)).toBe("event");
    expect(sourceInteractionTarget(false, true)).toBe("player");
    expect(sourceInteractionTarget(false, false)).toBeNull();
  });

  it("allows generic healing and transfers without opening unrelated host story events", () => {
    expect(guestSourceEventAccess(page(["show-text", "heal-party"]))).toBe("personal");
    expect(guestSourceEventAccess(page(["show-choices", "recover-all"]))).toBe("personal");
    expect(guestSourceEventAccess(page(["screen-tone", "transfer-player"]))).toBe("transfer");
    expect(guestSourceEventAccess(page(["show-text", "set-switches"]))).toBe("blocked");
  });

  it("rejoins the shared instance when the host reaches the guest's map", () => {
    expect(shouldRejoinSharedSourceMap(true, "away", 7, 7)).toBe(true);
    expect(shouldRejoinSharedSourceMap(true, "away", 6, 7)).toBe(false);
    expect(shouldRejoinSharedSourceMap(true, "shared", 7, 7)).toBe(false);
  });

  it("uses the host story even while the guest is on another map", () => {
    const local = { ...createSourceEventState(), switches: { "10": false }, variables: { "2": 1 } };
    const synchronized = sourceStateWithHostStory(local,
      { switches: { "10": true }, variables: { "2": 7 }, selfSwitches: { "4:2:A": true } }, true);
    expect(synchronized).toMatchObject({ switches: { "10": true }, variables: { "2": 7 },
      selfSwitches: { "4:2:A": true } });
    expect(synchronized.party).toBe(local.party);
  });
});
