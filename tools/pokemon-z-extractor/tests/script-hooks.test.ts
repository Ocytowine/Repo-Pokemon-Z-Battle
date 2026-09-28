import { describe, expect, it } from "vitest";
import { SCRIPT_FAMILY_POLICIES, classifyRubyHook, normalizeRubySignature, portTargetRubyLine } from "../src/runtime/script-hooks.js";

describe("Ruby script hook catalog", () => {
  it("groups literal variants without evaluating Ruby", () => {
    expect(normalizeRubySignature("Kernel.pbItemBall(PBItems::ORANBERRY)")).toBe("pbItemBall(PBItems::<constant>)");
    expect(normalizeRubySignature("pbItemBall(PBItems::POTION)")).toBe("pbItemBall(PBItems::<constant>)");
    expect(normalizeRubySignature('pbSetSelfSwitch(12, "A", false)')).toBe("pbSetSelfSwitch(<number>,<string>,false)");
  });

  it("assigns representative hooks to cooperative families", () => {
    expect(classifyRubyHook("Kernel.pbItemBall(PBItems::POTION)")).toBe("inventory");
    expect(classifyRubyHook("pbWildBattle(PBSpecies::BIDOOF,2)")).toBe("encounter");
    expect(classifyRubyHook("$PokemonSystem.difficulty = 2")).toBe("system");
    expect(classifyRubyHook("pbFollowingAnimation(2)")).toBe("follower");
    expect(new Set(Object.values(SCRIPT_FAMILY_POLICIES).map((entry) => entry.policy))).toEqual(
      new Set(["PERSONAL", "SHARED", "HOST_ONLY", "SYNCED"]),
    );
  });

  it("ports only the declarative hooks required by Map001", () => {
    expect(portTargetRubyLine("pbChangePlayer(3)")).toEqual({ kind: "set-player-avatar", avatarId: 3, family: "profile", policy: "PERSONAL" });
    expect(portTargetRubyLine('pbTrainerName("Red")')).toEqual({ kind: "request-trainer-name", defaultName: "Red", family: "profile", policy: "PERSONAL" });
    expect(portTargetRubyLine("pbToneChangeAll(Tone.new(0,-20,10,0),20)")).toEqual({ kind: "set-screen-tone", red: 0, green: -20, blue: 10, gray: 0, duration: 20, family: "audio-visual", policy: "PERSONAL" });
    expect(portTargetRubyLine("$PokemonSystem.difficulty = 2")).toEqual({ kind: "set-difficulty", level: 2, family: "system", policy: "HOST_ONLY" });
    expect(portTargetRubyLine("$PokemonGlobal.nuzlocke = false")).toEqual({ kind: "set-nuzlocke", enabled: false, family: "system", policy: "HOST_ONLY" });
    expect(portTargetRubyLine("dangerous_unknown_call()")).toBeNull();
  });
});
