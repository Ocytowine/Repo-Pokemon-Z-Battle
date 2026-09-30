import { describe, expect, it } from "vitest";
import { AUTOTILE_PARTS, activeEventAt, blockingDefaultEventPoints, dialogueLines, eventFootprint, eventGraphicPattern, eventInFront, eventPoseForActivePage, importedCameraPosition, moveImportedAvatar, parseImportedMap, parseMapTranslations, selectDefaultEventPage, sourceCharacterZ, sourceEventHasShadow, sourcePriorityTileZ, transferForEvent, type ImportedMap, type ImportedMapEvent } from "../src/imported-map.js";

function map(masks: readonly number[]): ImportedMap {
  return { id: 3, name: "Test", width: 3, height: 1, tilesetId: 1,
    layers: { lower: [384, 384, 384], middle: [0, 0, 0], upper: [0, 0, 0] },
    collision: { masks }, transfers: [] };
}

describe("imported RPG Maker map", () => {
  it("applies scripted camera offsets while respecting map edges", () => {
    const largeMap = { width: 40, height: 30 };
    expect(importedCameraPosition({ width: 576, height: 432 }, largeMap, { x: 20, y: 15 }, { x: 64, y: -32 }))
      .toEqual({ x: 432, y: 248 });
    expect(importedCameraPosition({ width: 576, height: 432 }, largeMap, { x: 0, y: 0 }, { x: -300, y: -300 }))
      .toEqual({ x: 0, y: 0 });
  });

  it("orders priority tiles around characters like the RPG Maker tilemap", () => {
    const character = sourceCharacterZ(10, 48);
    expect(sourcePriorityTileZ(9, 1)).toBeLessThan(character);
    expect(sourcePriorityTileZ(10, 1)).toBeGreaterThan(character);
    expect(sourcePriorityTileZ(8, 3)).toBeGreaterThan(character);
  });

  it("honors the source noShadow event-name convention", () => {
    expect(sourceEventHasShadow("Crisanto")).toBe(true);
    expect(sourceEventHasShadow("carta/noShadow/")).toBe(false);
  });

  it("drops stale graphic overrides when an event changes page", () => {
    const blankPage: ImportedMapEvent["pages"][number] = {
      condition: { switch1Id: null, switch2Id: null, variable: { id: 55, minimum: 1 }, selfSwitch: null },
      graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
      settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false,
        directionFix: false, through: false, alwaysOnTop: false, trigger: 0 },
      commands: [],
    };
    expect(eventPoseForActivePage({ x: 24, y: 16, direction: 6, pageIndex: 0,
      characterName: "crisantow" }, blankPage, 1)).toEqual({ x: 24, y: 16, direction: 2, pageIndex: 1 });
  });

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
      settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false, directionFix: false,
        through: false, alwaysOnTop: false, trigger: 0 },
      commands: [{ kind: "show-text", text: "Bonjour", indent: 0, data: { text: "Bonjour" } },
        { kind: "set-switches", text: null, indent: 0, data: { firstId: 10, lastId: 10, value: true } }] } as const;
    const event: ImportedMapEvent = { id: 1, name: "NPC", x: 2, y: 0, pages: [basePage,
      { ...basePage, condition: { ...basePage.condition, switch1Id: 10 }, commands: [{ kind: "show-text", text: "Cache", indent: 0, data: { text: "Cache" } }] }] };
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
      settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false, directionFix: false,
        through: false, alwaysOnTop: false, trigger: 0 },
      commands: [{ kind: "show-text", text: "Hola ", indent: 0, data: { text: "Hola " } },
        { kind: "text-continuation", text: "mundo.", indent: 0, data: { text: "mundo." } }],
    }] };
    expect(dialogueLines(event.pages[0]!, translations)).toEqual(["Bonjour le monde."]);
  });

  it("uses the source bottom-left anchor for size(w,h) event zones", () => {
    const event: ImportedMapEvent = { id: 8, name: "sortie size(3,2)", x: 5, y: 4, pages: [{
      condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
      graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
      settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false, directionFix: false,
        through: false, alwaysOnTop: false, trigger: 1 }, commands: [],
    }] };
    expect(eventFootprint(event)).toEqual([
      { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 },
      { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 },
    ]);
    expect(activeEventAt([event], 7, 3)?.event.id).toBe(8);
    expect(activeEventAt([event], 4, 4)).toBeNull();
  });

  it("animates only event pages whose stationary animation is enabled", () => {
    const animated = { condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
      graphic: { tileId: 0, characterName: "npc", direction: 2, pattern: 2, opacity: 255 },
      settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: true, directionFix: false,
        through: false, alwaysOnTop: false, trigger: 0 }, commands: [] } as const;
    expect(eventGraphicPattern(animated, 0)).toBe(0);
    expect(eventGraphicPattern(animated, 540)).toBe(3);
    expect(eventGraphicPattern({ ...animated, settings: { ...animated.settings, stepAnimation: false } }, 540)).toBe(2);
  });
});
