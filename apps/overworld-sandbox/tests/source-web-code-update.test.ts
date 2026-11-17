import { describe, expect, it } from "vitest";
import { parseWebCodeUpdate } from "../src/source-web-code-update.js";

describe("web code update offer", () => {
  it("accepts only a bounded manifest envelope", () => {
    const value = { version: "a".repeat(64), signature: "b".repeat(90),
      payload: JSON.stringify({ schemaVersion: "1.0.0" }) };
    expect(parseWebCodeUpdate(value)).toEqual(value);
    expect(parseWebCodeUpdate({ ...value, version: "wrong" })).toBeNull();
    expect(parseWebCodeUpdate({ ...value, payload: "not json" })).toBeNull();
  });
});
