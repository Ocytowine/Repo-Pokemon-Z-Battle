import { describe, expect, it } from "vitest";
import { sourceGridPageLayout } from "../src/source-grid-pagination.js";

describe("menu grid capacity", () => {
  it("reduces the page when controls leave space for fewer rows", () => {
    expect(sourceGridPageLayout(560, 190, 140, 70, 3, 3, 6)).toEqual({
      columns: 3, rows: 2, pageSize: 6,
    });
    expect(sourceGridPageLayout(560, 65, 140, 70, 3, 3, 6).pageSize).toBe(3);
  });

  it("uses narrower pages without dropping any row below one", () => {
    expect(sourceGridPageLayout(350, 180, 140, 70, 3, 3, 6)).toEqual({
      columns: 2, rows: 2, pageSize: 4,
    });
    expect(sourceGridPageLayout(0, 0, 140, 70, 3, 3, 6).pageSize).toBe(1);
  });
});
