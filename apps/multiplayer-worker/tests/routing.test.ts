import { describe, expect, it } from "vitest";
import { generateRoomCode, roomCodeFromPath } from "../src/routing.js";

describe("multiplayer worker routing", () => {
  it("creates readable six-character room codes without ambiguous glyphs", () => {
    expect(generateRoomCode(new Uint8Array([0, 1, 2, 24, 30, 31]))).toMatch(/^[A-Z2-9]{6}$/u);
    expect(generateRoomCode(new Uint8Array([0, 1, 2, 24, 30, 31]))).not.toMatch(/[01IO]/u);
  });

  it("normalizes room codes from API paths", () => {
    expect(roomCodeFromPath("/api/rooms/abc234/join", "join")).toBe("ABC234");
    expect(roomCodeFromPath("/api/rooms/abc234/socket", "socket")).toBe("ABC234");
    expect(roomCodeFromPath("/api/rooms/invalid/join", "join")).toBeNull();
  });
});
