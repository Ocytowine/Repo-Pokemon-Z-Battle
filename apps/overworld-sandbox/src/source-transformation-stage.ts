export type SourceTransformationKind = "evolution" | "hatch";

/** Stable animated backdrop shared by evolution and hatching presentations. */
export function sourceTransformationBackdropHtml(kind: SourceTransformationKind): string {
  const lines = Array.from({ length: 6 }, (_, index) => `<i style="--transformation-line:${index}"></i>`).join("");
  return `<div class="source-transformation-backdrop" data-transformation-kind="${kind}" aria-hidden="true"><span></span><b></b>${lines}</div>`;
}
