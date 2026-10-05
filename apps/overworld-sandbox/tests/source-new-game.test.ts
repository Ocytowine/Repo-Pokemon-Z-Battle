import { describe, expect, it } from "vitest";
import { createSourceEventState } from "../src/source-event-state.js";
import { applySourceNewGameAvatar, applySourceNewGameChoices, parseSourceNewGameSetup, persistSourceNewGameSetup,
  sourceAdventureSaveExists, sourceNewGameOpeningScenePending, SOURCE_EVENT_STATE_STORAGE_KEY,
  SOURCE_NEW_GAME_STORAGE_KEY } from "../src/source-new-game.js";
import { SOURCE_WORLD_SAVE_KEY } from "../src/source-world-save.js";

function storage(entries: readonly (readonly [string, string])[] = []): Storage {
  const values = new Map(entries);
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("source new game", () => {
  it("opens the condensed prologue only when no adventure save exists", () => {
    expect(sourceAdventureSaveExists(storage())).toBe(false);
    expect(sourceAdventureSaveExists(storage([[SOURCE_WORLD_SAVE_KEY, "{}"]]))).toBe(true);
    expect(sourceAdventureSaveExists(storage([[SOURCE_EVENT_STATE_STORAGE_KEY, "{}"]]))).toBe(true);
    expect(sourceAdventureSaveExists(storage([[SOURCE_NEW_GAME_STORAGE_KEY, "invalid"]]))).toBe(false);
    const setupOnly = storage();
    persistSourceNewGameSetup(setupOnly, { difficulty: "classic", adventureMode: "normal", starterRegion: "kalos" });
    expect(sourceAdventureSaveExists(setupOnly)).toBe(false);
  });

  it("maps the three source choices to their narrative switches", () => {
    const configured = applySourceNewGameChoices(createSourceEventState(), {
      difficulty: "heroic", adventureMode: "nuzlocke", starterRegion: "paldea",
    });
    expect(configured.switches).toMatchObject({ "698": true, "320": true, "247": true });
    expect(configured.switches["238"]).toBeUndefined();

    const changed = applySourceNewGameChoices(configured, {
      difficulty: "classic", adventureMode: "normal", starterRegion: "kalos",
    });
    expect(changed.switches).toMatchObject({ "238": true });
    expect(changed.switches["698"]).toBeUndefined();
    expect(changed.switches["320"]).toBeUndefined();
    expect(changed.switches["247"]).toBeUndefined();
  });

  it("maps the selected body and palette to the source introduction variables", () => {
    expect(applySourceNewGameAvatar(createSourceEventState(), "legacy-0").variables).toMatchObject({ "51": 1, "88": 0 });
    expect(applySourceNewGameAvatar(createSourceEventState(), "legacy-5").variables).toMatchObject({ "51": 2, "88": 2 });
    expect(() => applySourceNewGameAvatar(createSourceEventState(), "custom-file")).toThrow(/Avatar/u);
  });

  it("persists the setup and resumes the opening autorun until the driver scene completes", () => {
    const target = storage();
    persistSourceNewGameSetup(target, { difficulty: "classic", adventureMode: "normal", starterRegion: "kalos" });
    expect(parseSourceNewGameSetup(JSON.parse(target.getItem(SOURCE_NEW_GAME_STORAGE_KEY)!))).toMatchObject({
      completed: true, starterRegion: "kalos",
    });
    expect(sourceNewGameOpeningScenePending(target, { mapId: 2 }, createSourceEventState())).toBe(true);
    expect(sourceNewGameOpeningScenePending(target, { mapId: 3 }, createSourceEventState())).toBe(false);
    expect(sourceNewGameOpeningScenePending(target, { mapId: 2 }, {
      ...createSourceEventState(), switches: { "61": true },
    })).toBe(false);
  });
});
