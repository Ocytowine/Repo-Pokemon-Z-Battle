import { describe, expect, it } from "vitest";
import { SourceTransferMovementContinuation } from "../src/source-transfer-movement.js";

describe("held movement across map transfer", () => {
  it("waits for the destination scene and network acknowledgement, then continues exactly once", () => {
    const continuation = new SourceTransferMovementContinuation();
    continuation.begin();
    continuation.arrive(true);
    expect(continuation.takeWhenReady(false, "up")).toBeNull();
    expect(continuation.takeWhenReady(true, "up")).toBe("up");
    expect(continuation.takeWhenReady(true, "up")).toBeNull();
  });

  it("drops released input and ignores interaction or scripted transfers", () => {
    const continuation = new SourceTransferMovementContinuation();
    continuation.arrive(true);
    expect(continuation.takeWhenReady(true, null)).toBeNull();
    continuation.arrive(false);
    expect(continuation.takeWhenReady(true, "left")).toBeNull();
    continuation.arrive(true);
    continuation.begin();
    expect(continuation.takeWhenReady(true, "left")).toBeNull();
  });
});
