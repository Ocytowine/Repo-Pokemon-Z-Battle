import { describe, expect, it } from "vitest";
import { SourceParallelController, type SourceParallelCycleResult } from "../src/source-parallel-controller.js";

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("source parallel controller", () => {
  it("runs distinct events concurrently and repeats them one frame at a time", async () => {
    const delays: Array<ReturnType<typeof deferred>> = [];
    const cycles: string[] = [];
    const controller = new SourceParallelController(async (task) => {
      cycles.push(`${task.eventId}:${task.pageIndex}`);
      return "repeat";
    }, () => undefined, async () => {
      const pending = deferred(); delays.push(pending); await pending.promise;
    });
    controller.synchronize([{ mapId: 7, eventId: 2, pageIndex: 0 }, { mapId: 7, eventId: 5, pageIndex: 1 }]);
    await Promise.resolve();
    expect(cycles).toEqual(["2:0", "5:1"]);
    delays.splice(0).forEach((pending) => pending.resolve());
    await Promise.resolve(); await Promise.resolve();
    expect(cycles).toEqual(["2:0", "5:1", "2:0", "5:1"]);
    controller.stopAll();
  });

  it("cancels a removed page and replaces an event when its active page changes", async () => {
    const gate = deferred();
    const activeChecks: Array<() => boolean> = [];
    const controller = new SourceParallelController(async (task): Promise<SourceParallelCycleResult> => {
      activeChecks.push(task.active); await gate.promise; return "repeat";
    }, () => undefined);
    controller.synchronize([{ mapId: 3, eventId: 8, pageIndex: 0 }]);
    await Promise.resolve();
    controller.synchronize([{ mapId: 3, eventId: 8, pageIndex: 2 }]);
    await Promise.resolve();
    expect(activeChecks).toHaveLength(2);
    expect(activeChecks[0]!()).toBe(false);
    expect(activeChecks[1]!()).toBe(true);
    controller.stopAll(); gate.resolve();
  });

  it("stops a completed task and reports an active task failure", async () => {
    const errors: unknown[] = [];
    const controller = new SourceParallelController(async (task) => {
      if (task.eventId === 1) return "stop";
      throw new Error("boom");
    }, (_program, error) => errors.push(error));
    controller.synchronize([{ mapId: 2, eventId: 1, pageIndex: 0 }, { mapId: 2, eventId: 2, pageIndex: 0 }]);
    await Promise.resolve(); await Promise.resolve();
    expect(controller.isRunning({ mapId: 2, eventId: 1, pageIndex: 0 })).toBe(false);
    expect(controller.isRunning({ mapId: 2, eventId: 2, pageIndex: 0 })).toBe(false);
    expect(errors).toHaveLength(1);
  });
});
