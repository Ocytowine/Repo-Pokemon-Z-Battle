import { describe, expect, it, vi } from "vitest";
import { SourceSequenceRunner } from "../src/source-sequence-runner.js";

describe("source sequence runner", () => {
  it("serializes routes for one actor while allowing different actors in parallel", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const trace: string[] = [];
    const runner = new SourceSequenceRunner();
    runner.startRoute(5, async () => { trace.push("christian-1"); await gate; }, vi.fn());
    runner.startRoute(5, async () => { trace.push("christian-2"); }, vi.fn());
    runner.startRoute(18, async () => { trace.push("lettre"); }, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(trace).toEqual(["christian-1", "lettre"]);
    release();
    await runner.waitForMovement();
    expect(trace).toEqual(["christian-1", "lettre", "christian-2"]);
    expect(runner.pendingRoutes).toBe(0);
  });

  it("centralizes and caps source timing", async () => {
    const delays: number[] = [];
    const runner = new SourceSequenceRunner((milliseconds) => { delays.push(milliseconds); return Promise.resolve(); });
    await runner.delay(-10);
    await runner.delay(8 * 25);
    await runner.delay(999_999);
    expect(delays).toEqual([0, 200, 5_000]);
  });
});
