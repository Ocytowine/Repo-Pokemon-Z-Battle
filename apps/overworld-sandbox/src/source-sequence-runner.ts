export type SourceSequenceDelay = (milliseconds: number) => Promise<void>;

function browserDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export class SourceSequenceRunner {
  private readonly tasks = new Set<Promise<void>>();
  private readonly actorChains = new Map<number, Promise<void>>();

  public constructor(private readonly delayImplementation: SourceSequenceDelay = browserDelay) {}

  public get pendingRoutes(): number {
    return this.tasks.size;
  }

  public delay(milliseconds: number): Promise<void> {
    return this.delayImplementation(Math.max(0, Math.min(5_000, milliseconds)));
  }

  public startRoute(target: number, operation: () => Promise<void>, onError: (error: unknown) => void): void {
    const previous = this.actorChains.get(target) ?? Promise.resolve();
    let task: Promise<void>;
    task = previous.then(operation).catch(onError).finally(() => {
      this.tasks.delete(task);
      if (this.actorChains.get(target) === task) this.actorChains.delete(target);
    });
    this.tasks.add(task);
    this.actorChains.set(target, task);
  }

  public async waitForMovement(): Promise<void> {
    await Promise.all([...this.tasks]);
  }
}
