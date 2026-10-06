import { describe, expect, it } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { resolveSourceTrainer, sourceSequenceCommandFamily } from "../src/source-sequence-effects.js";
import type { ImportedMapAssets } from "../src/imported-map.js";

function command(kind: string): ImportedEventPage["commands"][number] {
  return { kind, text: null, indent: 0, data: {} };
}

describe("source sequence effect families", () => {
  it("routes state, battle, shop, ranch and transfer commands", () => {
    expect(sourceSequenceCommandFamily(command("set-switches"))).toBe("state");
    expect(sourceSequenceCommandFamily(command("request-trainer-battle"))).toBe("trainer-battle");
    expect(sourceSequenceCommandFamily(command("open-shop"))).toBe("shop");
    expect(sourceSequenceCommandFamily(command("open-ranch"))).toBe("ranch");
    expect(sourceSequenceCommandFamily(command("transfer-player"))).toBe("transfer");
  });

  it("routes movement separately and leaves audiovisual commands to presentation", () => {
    expect(sourceSequenceCommandFamily(command("move-route"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("trainer-notice"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("wait-for-movement"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("set-movement-mode"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("play-sound"))).toBe("presentation");
  });

  it("resolves one unambiguous localized trainer name without weakening type and version", () => {
    const trainers: ImportedMapAssets["trainers"] = [
      { trainerType: "DUOMOSQUETERO", name: "Hector y Zaida", version: 0,
        pokemon: [{ species: "TEST", level: 5, moves: [null] }] },
      { trainerType: "DUOMOSQUETERO", name: "Didri y Dani", version: 0,
        pokemon: [{ species: "TEST", level: 5, moves: [null] }] },
    ];
    expect(resolveSourceTrainer(trainers, "DUOMOSQUETERO", "Hector et Zaida", 0)?.name)
      .toBe("Hector y Zaida");
    expect(resolveSourceTrainer(trainers, "AUTRE", "Hector et Zaida", 0)).toBeNull();
  });
});
