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
      abilities: { records: ["CHLOROPHYLL", "COMPOUNDEYES", "DRYSKIN", "INTIMIDATE", "SHIELDDUST", "RIVALRY",
        "PICKPOCKET", "STURDY", "TINTEDLENS"]
        .map((internalName, id) => ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual([
      { key: "CHLOROPHYLL", extracted: true, engineSupport: "partial" },
      { key: "COMPOUNDEYES", extracted: true, engineSupport: "partial" },
      { key: "DRYSKIN", extracted: true, engineSupport: "partial" },
      { key: "INTIMIDATE", extracted: true, engineSupport: "partial" },
      { key: "PICKPOCKET", extracted: true, engineSupport: "supported" },
      { key: "RIVALRY", extracted: true, engineSupport: "supported" },
      { key: "SHIELDDUST", extracted: true, engineSupport: "supported" },
      { key: "STURDY", extracted: true, engineSupport: "partial" },
      { key: "TINTEDLENS", extracted: true, engineSupport: "supported" },
    ]);
  });

  it("advertises the shared damage-modifier talent family as supported", () => {
    const names = ["ADAPTABILITY", "FILTER", "IRONFIST", "MULTISCALE", "SNIPER", "SOLIDROCK",
      "STRONGJAW", "TECHNICIAN", "THICKFAT", "TOUGHCLAWS"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);

    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the shared contact-reaction talent family as supported", () => {
    const names = ["EFFECTSPORE", "FLAMEBODY", "GOOEY", "IRONBARBS", "POISONPOINT", "POISONTOUCH", "ROUGHSKIN"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the shared elemental-immunity talent family as supported", () => {
    const names = ["FLASHFIRE", "LEVITATE", "LIGHTNINGROD", "MOTORDRIVE", "SAPSIPPER", "STORMDRAIN",
      "VOLTABSORB", "WATERABSORB"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the shared passive-protection talent family as supported", () => {
    const names = ["BATTLEARMOR", "CLEARBODY", "HYPERCUTTER", "IMMUNITY", "INSOMNIA", "LIMBER", "MAGMAARMOR",
      "OWNTEMPO", "SHELLARMOR", "VITALSPIRIT", "WATERVEIL", "WHITESMOKE"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the offensive tradeoff talent family and its recoil move functions", () => {
    const names = ["RECKLESS", "ROCKHEAD", "SHEERFORCE", "SKILLLINK", "SUPERLUCK"];
    const codes = ["0FA", "0FB", "0FC", "0FD", "0FE", "10B"];
    const report = createEngineSupportReport({
      types: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      moves: { records: codes.map((functionCode) => ({ functionCode })) },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
    expect(report.categories.moveFunctionCodes).toEqual(codes.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the shared reactive-stat talent family as supported", () => {
    const names = ["ANGERPOINT", "BERSERK", "COMPETITIVE", "DEFIANT", "RATTLED", "STAMINA",
      "STEAMENGINE", "WATERCOMPACTION", "WEAKARMOR"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });
});
