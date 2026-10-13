import { describe, expect, it } from "vitest";
import { createEngineSupportReport, type EngineSupportInput } from "../src/validation/engine-support.js";

describe("engine support report", () => {
  it("advertises Sweet Scent's combat function as supported", () => {
    const report = createEngineSupportReport({
      types: { records: [] }, abilities: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      moves: { records: [{ functionCode: "048" }] },
    } as unknown as EngineSupportInput);
    expect(report.categories.moveFunctionCodes).toEqual([
      { key: "048", extracted: true, engineSupport: "supported" },
    ]);
  });

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

  it("does not advertise weather-dependent or incomplete source abilities as fully supported", () => {
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: ["CHLOROPHYLL", "DRYSKIN", "INTIMIDATE", "SHIELDDUST", "RIVALRY"]
        .map((internalName, id) => ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual([
      { key: "CHLOROPHYLL", extracted: true, engineSupport: "partial" },
      { key: "DRYSKIN", extracted: true, engineSupport: "partial" },
      { key: "INTIMIDATE", extracted: true, engineSupport: "partial" },
      { key: "RIVALRY", extracted: true, engineSupport: "supported" },
      { key: "SHIELDDUST", extracted: true, engineSupport: "supported" },
    ]);
  });
});
