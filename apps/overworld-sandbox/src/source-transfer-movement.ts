import type { Direction } from "@pokemon-z-battle/overworld-engine";

/** One continuation per successful step-triggered transfer, never a replayed input. */
export class SourceTransferMovementContinuation {
  private pending = false;

  public begin(): void { this.pending = false; }

  public arrive(stepTriggered: boolean): void { this.pending = stepTriggered; }

  public takeWhenReady(ready: boolean, heldDirection: Direction | null): Direction | null {
    if (!this.pending || !ready) return null;
    this.pending = false;
    return heldDirection;
  }
}
