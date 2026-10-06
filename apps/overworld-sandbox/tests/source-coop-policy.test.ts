import { describe, expect, it } from "vitest";
import { guestSourceEventAccess, guestSourceStateCommandAllowed, shouldRejoinSharedSourceMap,
  sourceInteractionTarget, sourcePlayersFaceForDuel, sourceStateWithHostStory }
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
    expect(guestSourceEventAccess(page(["show-text", "heal-party", "request-trainer-battle"]))).toBe("blocked");
    expect(guestSourceEventAccess(page(["screen-tone", "transfer-player", "request-encounter"]))).toBe("blocked");
    const technicalHealing = page(["heal-party", "set-self-switch"]);
    expect(guestSourceEventAccess(technicalHealing)).toBe("personal");
    expect(guestSourceStateCommandAllowed(technicalHealing, "heal-party")).toBe(true);
    expect(guestSourceStateCommandAllowed(technicalHealing, "set-self-switch")).toBe(false);
    const technicalTransfer = page(["transfer-player", "set-switches"]);
    expect(guestSourceEventAccess(technicalTransfer)).toBe("transfer");
    expect(guestSourceStateCommandAllowed(technicalTransfer, "set-switches")).toBe(false);
    const ranch = page(["ruby-script"]);
    expect(guestSourceEventAccess({ ...ranch, commands: [
      { kind: "ruby-script", text: null, indent: 0, data: { source: "pbPokeCenterPC" } },
    ] })).toBe("personal");
  });

  it("uses the authoritative shared avatars to offer a PvP challenge to either player", () => {
    const world = { mapId: 14, width: 10, height: 10, passages: "f".repeat(100), blockedPoints: [],
      actors: [], actorRevision: 0,
      story: { switches: {}, variables: {}, selfSwitches: {} }, followers: {},
      presence: { player: "shared", opponent: "shared" },
      avatars: { player: { x: 4, y: 4, direction: "down" }, opponent: { x: 4, y: 5, direction: "up" } } } as const;
    expect(sourcePlayersFaceForDuel(world, "player")).toBe(true);
    expect(sourcePlayersFaceForDuel(world, "opponent")).toBe(true);
    expect(sourcePlayersFaceForDuel({ ...world,
      presence: { player: "shared", opponent: "away" } }, "player")).toBe(false);
  });

  it("rejoins the shared instance when the host reaches the guest's map", () => {
    expect(shouldRejoinSharedSourceMap(true, "away", 7, 7)).toBe(true);
    expect(shouldRejoinSharedSourceMap(true, "away", 7, 7, true)).toBe(false);
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
    expect(synchronized.ranch).toBe(local.ranch);
  });
});
