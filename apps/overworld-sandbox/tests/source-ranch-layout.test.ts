import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { SourcePokemonFilters } from "../src/source-pokemon-collection.js";
import { SourceRanchView } from "../src/source-ranch-view.js";

describe("Ranch and shared inventory panel layout", () => {
  it("centers the shared action wheel inside its game panel", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-action-wheel-backdrop\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*place-items:\s*center/s);
    expect(css).not.toMatch(/\.source-action-wheel-backdrop\s*\{[^}]*position:\s*fixed/s);
  });

  it("keeps held-item pagination inside the modal without vertical scrolling", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-held-item-panel\s*\{[^}]*height:\s*min\(440px, 100%\)[^}]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.source-held-item-browser\s*\{[^}]*display:\s*grid[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.source-held-item-browser > \.source-inventory-pagination\s*\{[^}]*grid-row:\s*3[^}]*margin:\s*4px auto 0/s);
    expect(css).toMatch(/\.source-held-item-browser > \.source-inventory-grid\s*\{[^}]*grid-row:\s*2[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[^}]*grid-template-rows:\s*repeat\(2, minmax\(0, 68px\)\)[^}]*overflow:\s*hidden/s);
    expect(css).not.toMatch(/\.source-held-item-browser > \.source-inventory-grid\s*\{[^}]*overflow-y:\s*(?:auto|scroll)/s);
    expect(css).toMatch(/\.source-held-item-browser \.source-inventory-copy > strong\s*\{[^}]*white-space:\s*normal[^}]*text-overflow:\s*clip[^}]*line-clamp:\s*unset/s);
    expect(css).toMatch(/\.source-held-item-browser \.source-inventory-card\s*\{[^}]*grid-template-areas:\s*"art copy" "counts copy"/s);
    expect(css).toMatch(/\.source-held-item-browser \.source-inventory-copy > small\s*\{[^}]*line-clamp:\s*5/s);
    expect(css).toMatch(/\.source-held-item-browser \.source-inventory-counts\s*\{[^}]*display:\s*flex[^}]*width:\s*40px[^}]*grid-area:\s*counts[^}]*justify-content:\s*center/s);
    expect(css).toMatch(/\.source-held-item-browser \.source-inventory-copy\s*\{[^}]*border:\s*0[^}]*outline:\s*0/s);
    expect(css).toMatch(/\.source-menu-content-bag \.source-inventory-card\s*\{[^}]*grid-template-areas:\s*"art copy"\s*"counts copy"/s);
    expect(css).toMatch(/\.source-menu-content-bag \.source-inventory-counts\s*\{[^}]*display:\s*flex[^}]*width:\s*40px[^}]*grid-area:\s*counts[^}]*justify-content:\s*center/s);
    expect(css).toMatch(/\.source-menu-content-bag \.source-inventory-copy\s*\{[^}]*border:\s*0[^}]*outline:\s*0/s);
    expect(css).toMatch(/\.source-menu-content-bag \.source-inventory-copy > small\s*\{[^}]*line-clamp:\s*6/s);
    expect(css).toMatch(/@media \(max-width:\s*430px\)[\s\S]*\.source-menu-content-bag \.source-inventory-copy > small\s*\{[^}]*line-clamp:\s*8/s);
  });

  it("opens filters and sorting in a bounded dialog without shrinking the Ranch grid", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");
    const view = await readFile(new URL("../src/source-ranch-view.ts", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch-workspace\s*\{[^}]*grid-template-areas:\s*"toolbar"\s*"content"[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s);
    expect(css).toMatch(/\.source-ranch-tools-backdrop\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
    expect(css).toMatch(/\.source-ranch-tools-dialog\s*\{[^}]*max-height:\s*100%[^}]*overflow:\s*hidden/s);
    expect(view).toContain('role="dialog" aria-modal="true"');
    expect(view).toContain("data-source-ranch-tools-close");
    expect(view).toContain("data-source-ranch-tools-apply");
    expect(view).toContain("data-source-ranch-tools-dismiss");
  });

  it("cancels pending changes and applies only confirmed filters", () => {
    const view = new SourceRanchView(() => {}, () => {}, () => {}, () => {}, () => {}, () => {});
    const state = view as unknown as { filters: SourcePokemonFilters; draftFilters: SourcePokemonFilters | null;
      toolsPanel: "filters" | "sort" | null; ranchPage: number; applyTools(): void };
    const original = state.filters;
    state.ranchPage = 2;
    state.toolsPanel = "filters";
    state.draftFilters = { ...original, query: "Pikachu" };
    expect(view.cancel()).toBe(true);
    expect(state.filters).toEqual(original);
    expect(state.ranchPage).toBe(2);
    expect(state.draftFilters).toBeNull();

    state.toolsPanel = "filters";
    state.draftFilters = { ...original, query: "Pikachu" };
    state.applyTools();
    expect(state.filters.query).toBe("Pikachu");
    expect(state.ranchPage).toBe(0);
    expect(state.draftFilters).toBeNull();
    expect(state.toolsPanel).toBeNull();
  });

  it("keeps storage in its own grid area when the Team panel is hidden", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch-content\s*\{[^}]*grid-template-areas:\s*"storage"/s);
    expect(css).toMatch(/\[data-team-expanded="true"\] \.source-ranch-content\s*\{[^}]*grid-template-areas:\s*"team storage"/s);
    expect(css).toMatch(/\.source-ranch-team\s*\{[^}]*grid-area:\s*team/s);
    expect(css).toMatch(/\.source-ranch-storage\s*\{[^}]*grid-area:\s*storage/s);
  });

  it("keeps the animated background on the stable Ranch root", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch::before\s*\{[^}]*Ranch\.png[^}]*animation:\s*source-ranch-background-drift/s);
    expect(css).not.toMatch(/\.source-ranch-workspace::before\s*\{[^}]*Ranch\.png/s);
  });

  it("keeps types and the four move slots visible on compact cards", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-pokemon-card\.compact \.source-pokemon-types\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.source-pokemon-card\.compact \.source-pokemon-moves\s*\{[^}]*display:\s*grid/s);
    expect(css).toMatch(/\.source-pokemon-card\.compact \.source-pokemon-moves\s*\{[^}]*repeat\(2,/s);
  });

  it("fits compact cards to their slots without stretching their internal rows", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-pokemon-card\.compact\s*\{[^}]*align-content:\s*center/s);
    expect(css).toMatch(/\.source-ranch-storage \.source-pokemon-grid > \.source-pokemon-card\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/s);
  });

  it("keeps all six team cards in a contained vertical list in both facilities", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");
    const ranch = await readFile(new URL("../src/source-ranch-view.ts", import.meta.url), "utf8");
    const dayCare = await readFile(new URL("../src/source-day-care-view.ts", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch-team-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*grid-auto-rows:\s*clamp\([^}]*overflow-y:\s*auto/s);
    expect(ranch).toContain("Array.from({ length: 6 }");
    expect(dayCare).toContain("Array.from({ length: 6 }");
    expect(ranch).toContain("scrollTop = teamScrollTop");
    expect(dayCare).toContain("scrollTop = teamScrollTop");
    expect(ranch).not.toContain("sourceTeamPagerHtml");
    expect(css).toMatch(/\.source-ranch-storage \.source-pokemon-grid\s*\{[^}]*gap:\s*6px[^}]*padding:\s*6px 3px 10px/s);
  });

  it("centers the team sprite across the full card and keeps the item above HP and moves", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");
    const dayCare = await readFile(new URL("../src/source-day-care-view.ts", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch-team-list \.source-pokemon-card\.compact\s*\{[^}]*--facility-team-icon:\s*clamp\([^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto/s);
    expect(css).toMatch(/\.source-ranch-team-list \.source-pokemon-card\.compact \.source-pokemon-icon\s*\{[^}]*grid-row:\s*1 \/ 3;[^}]*place-self:\s*center/s);
    expect(css).toMatch(/\.source-ranch-team-list \.source-pokemon-card\.compact \.source-pokemon-moves\s*\{[^}]*display:\s*grid;[^}]*grid-row:\s*2;/s);
    expect(css).toMatch(/\.source-ranch-team-list \.source-pokemon-card\.compact \.source-pokemon-held-item\s*\{[^}]*display:\s*inline-flex/s);
    expect(css).toMatch(/\.source-ranch-team-list \.source-pokemon-card\.team-layout \.source-pokemon-level,[\s\S]*?\.source-pokemon-types\s*\{[^}]*translateY\(var\(--team-badge-shift\)\)/s);
    expect(css).toMatch(/\.source-ranch-team-list \.source-pokemon-card\.compact \.source-pokemon-vitals\s*\{[^}]*translateY\(calc\(-1 \* var\(--team-badge-shift\)\)\)/s);
    expect(dayCare).toContain("model.items.get(member.pokemon.heldItem)?.name");
  });

  it("uses the whole folded storage area as a 4x4 page without a result strip", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");
    const view = await readFile(new URL("../src/source-ranch-view.ts", import.meta.url), "utf8");

    expect(css).toMatch(/\[data-team-expanded="false"\] \.source-ranch-storage \.source-pokemon-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,[^}]*grid-template-rows:\s*repeat\(4,/s);
    expect(css).toMatch(/\.source-ranch-storage\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto/s);
    expect(css).not.toContain(".source-ranch-result");
    expect(view).not.toContain("source-ranch-result");
  });

  it("uses a uniform background tint and icon-only compact type badges", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch-workspace::after\s*\{[^}]*background:\s*#[0-9a-f]+;/s);
    expect(css).toMatch(/\.source-pokemon-card\.compact \.source-pokemon-types b\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
  });
});
