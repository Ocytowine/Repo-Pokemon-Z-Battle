export interface SourceParallelProgram {
  readonly mapId: number;
  readonly eventId: number;
  readonly pageIndex: number;
}

export interface SourceParallelTask extends SourceParallelProgram {
  readonly active: () => boolean;
}

export type SourceParallelCycleResult = "repeat" | "stop";
export type SourceParallelCycle = (task: SourceParallelTask) => Promise<SourceParallelCycleResult>;

interface RunningTask {
  readonly program: SourceParallelProgram;
  cancelled: boolean;
}

type Delay = (milliseconds: number) => Promise<void>;

const browserDelay: Delay = (milliseconds) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

function identity(program: SourceParallelProgram): string {
  return `${program.mapId}:${program.eventId}`;
}

function samePage(left: SourceParallelProgram, right: SourceParallelProgram): boolean {
  return left.mapId === right.mapId && left.eventId === right.eventId && left.pageIndex === right.pageIndex;
}

export class SourceParallelController {
  private readonly tasks = new Map<string, RunningTask>();

  public constructor(private readonly runCycle: SourceParallelCycle, private readonly onError: (program: SourceParallelProgram,
    error: unknown) => void, private readonly delay: Delay = browserDelay, private readonly minimumCycleMs = 25) {}

  public synchronize(programs: readonly SourceParallelProgram[]): void {
    const desired = new Map(programs.map((program) => [identity(program), program]));
    for (const [key, task] of this.tasks) {
      const next = desired.get(key);
      if (next === undefined || !samePage(task.program, next)) {
        task.cancelled = true;
        this.tasks.delete(key);
      }
    }
    for (const [key, program] of desired) {
      if (this.tasks.has(key)) continue;
      const running: RunningTask = { program, cancelled: false };
      this.tasks.set(key, running);
      void this.loop(key, running);
    }
  }

  public stopAll(): void {
    for (const task of this.tasks.values()) task.cancelled = true;
    this.tasks.clear();
  }

  public isRunning(program: SourceParallelProgram): boolean {
    const task = this.tasks.get(identity(program));
    return task !== undefined && !task.cancelled && samePage(task.program, program);
  }

  private async loop(key: string, running: RunningTask): Promise<void> {
    const task: SourceParallelTask = { ...running.program, active: () => !running.cancelled };
    try {
      while (!running.cancelled) {
        if (await this.runCycle(task) === "stop" || running.cancelled) break;
        await this.delay(this.minimumCycleMs);
      }
    } catch (error) {
      if (!running.cancelled) this.onError(running.program, error);
    } finally {
      if (this.tasks.get(key) === running) this.tasks.delete(key);
    }
  }
}
