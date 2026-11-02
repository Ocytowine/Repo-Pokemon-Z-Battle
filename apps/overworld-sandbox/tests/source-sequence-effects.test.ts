import { describe, expect, it, vi } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { SourceSequenceEffects, resolveSourceTrainer, sourceSequenceCommandFamily,
  type SourceSequenceEffectDependencies } from "../src/source-sequence-effects.js";
import type { ImportedMapAssets } from "../src/imported-map.js";
import type { SourceSequenceSession } from "../src/source-sequence-controller.js";
import type { SourceWildEncounterOutcome } from "../src/source-battle-controller.js";

function command(kind: string): ImportedEventPage["commands"][number] {
  return { kind, text: null, indent: 0, data: {} };
}

describe("source sequence effect families", () => {
  it("erases a roaming encounter event after escape but stops its sequence after defeat", async () => {
    const request = { ...command("request-random-encounter"), data: { method: "Land" } };
    const erase = command("erase-event");
    const session = { mapId: 16, eventId: 1, cursor: 1,
      plan: { steps: [{ command: request }, { command: erase }] } } as unknown as SourceSequenceSession;
    const callback = { finish: null as ((outcome: SourceWildEncounterOutcome) => void) | null };
    const erased = vi.fn();
    const resume = vi.fn();
    const effects = new SourceSequenceEffects({
      startRandomEncounter: (_method, onComplete) => { callback.finish = onComplete; return true; },
      isActive: () => true, resume, eraseEvent: erased,
    } as unknown as SourceSequenceEffectDependencies);
    expect(await effects.execute(session, request)).toBe("pause");
    callback.finish?.("escaped");
    expect(session.cursor).toBe(1);
    expect(resume).toHaveBeenCalledOnce();
    expect(await effects.execute(session, erase)).toBe("continue");
    expect(erased).toHaveBeenCalledWith(16, 1);

    session.cursor = 1;
    callback.finish?.("lost");
    expect(session.cursor).toBe(session.plan.steps.length);
  });

  it("routes state, battle, shops, Pokémon services and transfers", () => {
    expect(sourceSequenceCommandFamily(command("set-switches"))).toBe("state");
    expect(sourceSequenceCommandFamily(command("request-random-encounter"))).toBe("random-encounter");
    expect(sourceSequenceCommandFamily(command("request-trainer-battle"))).toBe("trainer-battle");
    expect(sourceSequenceCommandFamily(command("open-shop"))).toBe("shop");
    expect(sourceSequenceCommandFamily(command("open-ranch"))).toBe("ranch");
    expect(sourceSequenceCommandFamily(command("open-day-care"))).toBe("day-care");
    expect(sourceSequenceCommandFamily(command("open-day-care-eggs"))).toBe("day-care-eggs");
    expect(sourceSequenceCommandFamily(command("transfer-player"))).toBe("transfer");
    expect(sourceSequenceCommandFamily(command("erase-event"))).toBe("event");
  });

  it("routes movement separately and leaves audiovisual commands to presentation", () => {
    expect(sourceSequenceCommandFamily(command("move-route"))).toBe("movement");
    expect(sourceSequenceCommandFamily(command("set-event-location"))).toBe("movement");
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
