import { describe, expect, it } from "vitest";
import { AUTOTILE_PARTS, blockingDefaultEventPoints, dialogueLines, eventInFront, moveImportedAvatar, parseImportedMap, parseMapTranslations, selectDefaultEventPage, transferForEvent, type ImportedMap, type ImportedMapEvent } from "../src/imported-map.js";

function map(masks: readonly number[]): ImportedMap {
  return { id: 3, name: "Test", width: 3, height: 1, tilesetId: 1,
    layers: { lower: [384, 384, 384], middle: [0, 0, 0], upper: [0, 0, 0] },
    collision: { masks }, transfers: [] };
}

describe("imported RPG Maker map", () => {
  it("contains all 48 autotile compositions", () => {
    expect(AUTOTILE_PARTS).toHaveLength(48);
    expect(AUTOTILE_PARTS.flat()).toHaveLength(192);
    expect(AUTOTILE_PARTS.flat().every((part) => part >= 1 && part <= 48)).toBe(true);
  });

  it("requires both outgoing and incoming directional passages", () => {
    const avatar = { x: 1, y: 0, direction: "down" as const };
    expect(moveImportedAvatar(map([15, 15, 15]), avatar, "right")).toMatchObject({ x: 2, y: 0, direction: "right" });
    expect(moveImportedAvatar(map([15, 11, 15]), avatar, "right")).toMatchObject({ x: 1, y: 0, direction: "right" });
    expect(moveImportedAvatar(map([15, 15, 13]), avatar, "right")).toMatchObject({ x: 1, y: 0, direction: "right" });
  });

  it("validates layer and collision lengths", () => {
    expect(() => parseImportedMap({ id: 3, name: "Bad", width: 2, height: 1, tilesetId: 1,
      layers: { lower: [384], middle: [0, 0], upper: [0, 0] }, collision: { masks: [15, 15] }, transfers: [] })).toThrow("couches");
  });

  it("selects the last unconditional event page and exposes only simple dialogue", () => {
    const basePage = { condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
      graphic: { tileId: 0, characterName: "npc", direction: 2, pattern: 0, opacity: 255 },
      settings: { through: false, alwaysOnTop: false, trigger: 0 },
      commands: [{ kind: "show-text", text: "Bonjour" }, { kind: "set-switches", text: null }] } as const;
    const event: ImportedMapEvent = { id: 1, name: "NPC", x: 2, y: 0, pages: [basePage,
      { ...basePage, condition: { ...basePage.condition, switch1Id: 10 }, commands: [{ kind: "show-text", text: "Cache" }] }] };
    const page = selectDefaultEventPage(event);
    expect(page).toBe(basePage);
    expect(page === null ? [] : dialogueLines(page)).toEqual(["Bonjour"]);
    expect(eventInFront([event], { x: 1, y: 0, direction: "right" })?.event.id).toBe(1);
    expect(blockingDefaultEventPoints([event])).toEqual([{ x: 2, y: 0 }]);
    expect(moveImportedAvatar(map([15, 15, 15]), { x: 1, y: 0, direction: "right" }, "right", [{ x: 2, y: 0 }])).toMatchObject({ x: 1, y: 0 });
    const active = eventInFront([event], { x: 1, y: 0, direction: "right" });
    const withTransfer: ImportedMap = { ...map([15, 15, 15]), transfers: [
      { eventId: 1, pageIndex: 0, eventX: 2, eventY: 0, targetMapId: 4, targetX: 7, targetY: 13, direction: 8 },
    ] };
    expect(active === null ? null : transferForEvent(withTransfer, active)?.targetMapId).toBe(4);
  });

  it("reassembles split source lines before applying the French translation", () => {
    const translations = parseMapTranslations({ categories: { mapDialogues: [
      { key: "Hola mundo.", value: "<b>Bonjour</b> le monde.", context: "3" },
      { key: "Hola mundo.", value: "Mauvaise carte", context: "4" },
    ] } }, 3);
    const event: ImportedMapEvent = { id: 1, name: "NPC", x: 0, y: 0, pages: [{
      condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
      graphic: { tileId: 0, characterName: "npc", direction: 2, pattern: 0, opacity: 255 },
      settings: { through: false, alwaysOnTop: false, trigger: 0 },
      commands: [{ kind: "show-text", text: "Hola " }, { kind: "text-continuation", text: "mundo." }],
    }] };
    expect(dialogueLines(event.pages[0]!, translations)).toEqual(["Bonjour le monde."]);
  });
});
