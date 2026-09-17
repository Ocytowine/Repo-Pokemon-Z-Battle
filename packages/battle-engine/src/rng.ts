import type { RandomSource } from "./types.js";

export class SeededRandom implements RandomSource {
  private state: number;

  public constructor(seed: number) {
    if (!Number.isSafeInteger(seed)) {
      throw new RangeError("The RNG seed must be a safe integer.");
    }
    this.state = seed >>> 0;
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be a positive safe integer.");
    }

    // Mulberry32: a small platform-independent 32-bit generator.
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const unsigned = (value ^ (value >>> 14)) >>> 0;
    return Math.floor((unsigned / 0x1_0000_0000) * maxExclusive);
  }
}
