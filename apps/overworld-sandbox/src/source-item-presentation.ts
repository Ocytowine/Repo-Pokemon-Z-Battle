export interface SourceItemGain {
  readonly itemId: string;
  readonly name: string;
  readonly quantity: number;
}

export function sourceItemGains(before: Readonly<Record<string, number>>, after: Readonly<Record<string, number>>,
  names: ReadonlyMap<string, string>): readonly SourceItemGain[] {
  return Object.entries(after).flatMap(([itemId, quantity]) => {
    const gained = quantity - (before[itemId] ?? 0);
    return gained > 0 ? [{ itemId, name: names.get(itemId) ?? itemId, quantity: gained }] : [];
  });
}

export function sourceItemGainMessage(gain: SourceItemGain): string {
  return gain.quantity === 1 ? `Objet obtenu : ${gain.name} !` : `Objets obtenus : ${gain.quantity} × ${gain.name} !`;
}

export function sourceItemPickupOffset(elapsedMs: number): number {
  const progress = Math.max(0, Math.min(1, elapsedMs / 420));
  return -Math.sin(progress * Math.PI) * 8;
}
