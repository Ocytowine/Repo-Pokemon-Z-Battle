import { describe, expect, it } from "vitest";
import { createEngineSupportReport, type EngineSupportInput } from "../src/validation/engine-support.js";

describe("engine support report", () => {
  it("reports implemented main evolutions and keeps Shedinja explicit", () => {
    const report = createEngineSupportReport({
      types: { records: [] },
      moves: { records: [] },
      abilities: { records: [] },
      items: { records: [] },
      pokemon: { records: [{ evolutions: [
        { species: "NINJASK", method: "Ninjask", parameter: "20" },
        { species: "SHEDINJA", method: "Shedinja", parameter: "20" },
      ] }] },
    } as unknown as EngineSupportInput);

    expect(report.categories.evolutionMethods).toEqual([
      { key: "Ninjask", extracted: true, engineSupport: "supported" },
      { key: "Shedinja", extracted: true, engineSupport: "not-implemented" },
    ]);
  });
});
