import { describe, expect, it } from "vitest";
import { guestSourceEventAccess, sourceDialoguePresentation } from "../src/source-coop-policy.js";
import type { ImportedEventPage } from "../src/imported-map.js";

function page(kinds: readonly string[]): ImportedEventPage {
  return { conditions: { switch1Valid: false, switch2Valid: false, variableValid: false,
    selfSwitchValid: false }, graphic: { tileId: 0, characterName: "", characterHue: 0, direction: 2,
    pattern: 0, opacity: 255, blendType: 0 }, settings: { moveType: 0, moveSpeed: 3,
    moveFrequency: 3, moveRoute: null, walkAnimation: true, stepAnimation: false,
    directionFix: false, through: false, alwaysOnTop: false, trigger: 0 },
  commands: kinds.map((kind) => ({ kind, text: null, indent: 0, data: {} })) };
}

describe("guest source event policy", () => {
  it("allows generic healing and transfers without opening unrelated host story events", () => {
    expect(guestSourceEventAccess(page(["show-text", "heal-party"]))).toBe("personal");
    expect(guestSourceEventAccess(page(["show-choices", "recover-all"]))).toBe("personal");
    expect(guestSourceEventAccess(page(["screen-tone", "transfer-player"]))).toBe("transfer");
    expect(guestSourceEventAccess(page(["show-text", "set-switches"]))).toBe("blocked");
  });

  it("keeps a personal guest dialogue visible over the observed host scene", () => {
    expect(sourceDialoguePresentation(true, true)).toBe("local");
    expect(sourceDialoguePresentation(false, true)).toBe("readonly");
    expect(sourceDialoguePresentation(false, false)).toBe("none");
  });
});
