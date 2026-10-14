import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Ranch panel layout", () => {
  it("pins the content to the fill row even when the tools drawer is empty", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch-workspace\s*\{[^}]*grid-template-areas:\s*"toolbar"\s*"tools"\s*"content"[^}]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)/s);
    expect(css).toMatch(/\.source-ranch-toolbar\s*\{[^}]*grid-area:\s*toolbar/s);
    expect(css).toMatch(/\.source-ranch-tools-slot\s*\{[^}]*grid-area:\s*tools/s);
    expect(css).toMatch(/\.source-ranch-content\s*\{[^}]*grid-area:\s*content/s);
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

  it("uses one stable card-width column for the Team and three for storage", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.source-ranch-toolbar\s*\{[^}]*grid-template-columns:\s*25%/s);
    expect(css).toMatch(/\[data-team-expanded="true"\] \.source-ranch-content\s*\{[^}]*grid-template-columns:\s*25%/s);
    expect(css).toMatch(/\.source-ranch-storage \.source-pokemon-grid\s*\{[^}]*gap:\s*6px[^}]*padding:\s*6px 3px 10px/s);
    expect(css).toMatch(/\.source-pokemon-card\.compact \.source-pokemon-moves\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*2/s);
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
