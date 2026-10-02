import { describe, expect, it } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { sourceSequenceCommandFamily } from "../src/source-sequence-effects.js";

function command(kind: string): ImportedEventPage["commands"][number] {
  return { kind, text: null, indent: 0, data: {} };
}

describe("source sequence effect families", () => {
  it("routes state, battle, shop and transfer commands", () => {
    expect(sourceSequenceCommandFamily(command("set-switches"))).toBe("state");
    expect(sourceSequenceCommandFamily(command("request-trainer-battle"))).toBe("trainer-battle");
    expect(sourceSequenceCommandFamily(command("open-shop"))).toBe("shop");
    expect(sourceSequenceCommandFamily(command("transfer-player"))).toBe("transfer");
  });

  it("routes movement separately and leaves audiovisual commands to presentation", () => {
    expect(sourceSequenceCommandFamily(command("move-route"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("wait-for-movement"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("set-movement-mode"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("play-sound"))).toBe("presentation");
  });
});
