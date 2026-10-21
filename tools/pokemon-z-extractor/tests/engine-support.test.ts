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

  it("advertises the closed Route 3 and Route 4 move mechanics as supported", () => {
    const functionCodes = ["021", "049", "082", "083", "093", "098", "09C", "0DC", "0F1", "0F4", "0FA", "110"];
    const report = createEngineSupportReport({
      types: { records: [] }, abilities: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      moves: { records: functionCodes.map((functionCode) => ({ functionCode })) },
    } as unknown as EngineSupportInput);

    expect(report.categories.moveFunctionCodes).toEqual(functionCodes.map((key) => ({
      key, extracted: true, engineSupport: "supported",
    })));
  });

  it("advertises the first Route 5 move mechanics as supported", () => {
    const functionCodes = ["010", "02D", "064", "06D", "086", "0F0"];
    const report = createEngineSupportReport({
      types: { records: [] }, abilities: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      moves: { records: functionCodes.map((functionCode) => ({ functionCode })) },
    } as unknown as EngineSupportInput);

    expect(report.categories.moveFunctionCodes).toEqual(functionCodes.map((key) => ({
      key, extracted: true, engineSupport: "supported",
    })));
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

  it("keeps only genuinely incomplete source abilities partial", () => {
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: ["CHLOROPHYLL", "COMPOUNDEYES", "DRYSKIN", "INTIMIDATE", "SHIELDDUST", "RIVALRY",
        "PICKPOCKET", "STURDY", "TINTEDLENS"]
        .map((internalName, id) => ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual([
      { key: "CHLOROPHYLL", extracted: true, engineSupport: "supported" },
      { key: "COMPOUNDEYES", extracted: true, engineSupport: "supported" },
      { key: "DRYSKIN", extracted: true, engineSupport: "supported" },
      { key: "INTIMIDATE", extracted: true, engineSupport: "supported" },
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

  it("advertises the completed weather-control talent family as supported", () => {
    const names = ["AIRLOCK", "CLOUDNINE", "DELTASTREAM", "DESOLATELAND", "OVERCOAT", "PODERGELIDO",
      "PRIMORDIALSEA", "SLUSHRUSH"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the shared status and end-of-turn talent family as supported", () => {
    const names = ["BADDREAMS", "EARLYBIRD", "HYDRATION", "POISONHEAL", "SPEEDBOOST"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the shared PP and held-item control talent family as supported", () => {
    const names = ["KLUTZ", "PRESSURE", "UNNERVE"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as unknown as EngineSupportInput);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      ({ key, extracted: true, engineSupport: "supported" })));
  });

  it("advertises the consumed-item lifecycle talent family as supported", () => {
    const names = ["HARVEST", "PICKUP", "UNBURDEN"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as never);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      expect.objectContaining({ key, engineSupport: "supported" })));
  });

  it("advertises the action-control talent family as supported", () => {
    const names = ["CURSEDBODY", "INFILTRATOR", "MAGICBOUNCE", "OBLIVIOUS", "STENCH"];
    const report = createEngineSupportReport({
      types: { records: [] }, moves: { records: [] }, items: { records: [] }, pokemon: { records: [] },
      abilities: { records: names.map((internalName, id) =>
        ({ id, internalName, name: internalName, description: "" })) },
    } as never);
    expect(report.categories.abilities).toEqual(names.map((key) =>
      expect.objectContaining({ key, engineSupport: "supported" })));
  });
});
