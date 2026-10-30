import { describe, expect, it } from "vitest";
import { parseSourceTrainerLocalizations, sourceTrainerDisplayName }
  from "../src/source-trainer-localization.js";

describe("source Trainer presentation", () => {
  const localizations = parseSourceTrainerLocalizations({ categories: {
    trainerNames: [{ key: "Crisanto", value: "Christian" }, { key: "Jean", value: "Jean" }],
    trainerTypeNames: [{ key: "6", value: "Rival" }, { key: "17", value: "Éleveur" }],
  } });

  it("combines translated class and name without changing the source identity", () => {
    const trainer = { id: 6, name: "Crisanto" };
    expect(sourceTrainerDisplayName(trainer, localizations)).toBe("Rival Christian");
    expect(trainer.name).toBe("Crisanto");
  });

  it("falls back independently when a name or class is untranslated", () => {
    expect(sourceTrainerDisplayName({ id: 17, name: "Inconnu" }, localizations)).toBe("Éleveur Inconnu");
    expect(sourceTrainerDisplayName({ id: 999, name: "Crisanto" }, localizations)).toBe("Christian");
    expect(sourceTrainerDisplayName({ id: 999, name: "Inconnu" }, localizations)).toBe("Inconnu");
    expect(sourceTrainerDisplayName({ id: 6, name: "Crisanto" }, null)).toBe("Crisanto");
  });
});
