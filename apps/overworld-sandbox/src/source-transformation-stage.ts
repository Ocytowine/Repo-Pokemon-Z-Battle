export type SourceTransformationKind = "evolution" | "hatch";

/** Stable animated backdrop shared by evolution and hatching presentations. */
export function sourceTransformationBackdropHtml(kind: SourceTransformationKind): string {
  const lines = Array.from({ length: 6 }, (_, index) =>
    `<i class="source-transformation-line" style="--transformation-line:${index};--transformation-line-delay:${index * -800}ms"></i>`).join("");
  const evolutionCore = kind === "evolution"
    ? '<i class="source-transformation-core-light"></i>'
    : "";
  const rays = Array.from({ length: 8 }, (_, index) =>
    `<i style="--transformation-ray-angle:${index * 45 + 12}deg;--transformation-ray-delay:${index * 110}ms"></i>`).join("");
  const particles = Array.from({ length: 16 }, (_, index) => {
    const angle = ((index * 137.5) - 90) * Math.PI / 180;
    const distance = 82 + (index % 4) * 18;
    return `<i style="--transformation-particle-x:${Math.round(Math.cos(angle) * distance)}px;--transformation-particle-y:${Math.round(Math.sin(angle) * distance)}px;--transformation-particle-delay:${index * 45}ms"></i>`;
  }).join("");
  const evolutionEffects = kind === "evolution"
    ? `<div class="source-transformation-effects" aria-hidden="true"><i class="source-transformation-start-light"></i><i class="source-transformation-end-light"></i><span class="source-transformation-rays">${rays}</span><span class="source-transformation-particles">${particles}</span></div>`
    : "";
  return `<div class="source-transformation-backdrop" data-transformation-kind="${kind}" aria-hidden="true"><span class="source-transformation-background"></span><b class="source-transformation-overlay"></b>${lines}${evolutionCore}</div>${evolutionEffects}`;
}
