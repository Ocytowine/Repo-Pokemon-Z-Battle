import { describe, expect, it } from "vitest";
import type { ImportedEventPage, ImportedMapEvent } from "../src/imported-map.js";
import { applySafeStateCommands, completePendingEncounter, createSourceEventState, parseSourceEventState, selectActiveEventPage } from "../src/source-event-state.js";

function page(condition: ImportedEventPage["condition"], commands: ImportedEventPage["commands"] = []): ImportedEventPage {
  return { condition, graphic: { tileId: 0, characterName: "npc", direction: 2, pattern: 0, opacity: 255 },
    settings: { through: false, alwaysOnTop: false, trigger: 0 }, commands };
}

const unconditional = { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null } as const;
const emptyParty = { schemaVersion: 1 as const, activeIndex: null, members: [] } as const;

describe("persistent source event state", () => {
  it("selects the last page whose switch, variable and scoped self-switch conditions are met", () => {
    const event: ImportedMapEvent = { id: 7, name: "NPC", x: 0, y: 0, pages: [page(unconditional),
      page({ ...unconditional, switch1Id: 4 }), page({ ...unconditional, variable: { id: 9, minimum: 3 } }),
      page({ ...unconditional, selfSwitch: "A" })] };
    expect(selectActiveEventPage(event, 3, createSourceEventState())?.pageIndex).toBe(0);
    expect(selectActiveEventPage(event, 3, { switches: { 4: true }, variables: {}, selfSwitches: {}, inventory: {}, checkpoint: null, party: emptyParty, pendingEncounter: null })?.pageIndex).toBe(1);
    expect(selectActiveEventPage(event, 3, { switches: {}, variables: { 9: 3 }, selfSwitches: {}, inventory: {}, checkpoint: null, party: emptyParty, pendingEncounter: null })?.pageIndex).toBe(2);
    expect(selectActiveEventPage(event, 3, { switches: {}, variables: {}, selfSwitches: { "3:7:A": true }, inventory: {}, checkpoint: null, party: emptyParty, pendingEncounter: null })?.pageIndex).toBe(3);
    expect(selectActiveEventPage(event, 4, { switches: {}, variables: {}, selfSwitches: { "3:7:A": true }, inventory: {}, checkpoint: null, party: emptyParty, pendingEncounter: null })?.pageIndex).toBe(0);
  });

  it("locks every starter selection page once the party contains a Pokemon", () => {
    const starterPage = page(unconditional, [
      { kind: "ruby-script", text: null, indent: 0, data: { source: "pbAddPokemon(:CHESPIN,5)" } },
      { kind: "set-switches", text: null, indent: 0, data: { firstId: 62, lastId: 62, value: true } },
      { kind: "ruby-script", text: null, indent: 0, data: { source: "pbWildBattle(PBSpecies::BIDOOF,2)" } },
    ]);
    const giftPage = page(unconditional, [
      { kind: "ruby-script", text: null, indent: 0, data: { source: "pbAddPokemon(:PIKACHU,5)" } },
    ]);
    const starterEvent: ImportedMapEvent = { id: 9, name: "Starter plante", x: 0, y: 0, pages: [starterPage] };
    const giftEvent: ImportedMapEvent = { id: 20, name: "Cadeau", x: 1, y: 0, pages: [giftPage] };
    const state = { ...createSourceEventState(), party: { schemaVersion: 1 as const, activeIndex: 0, members: [{
      id: "starter", species: "CHESPIN", nickname: null, level: 5, experience: 135,
      stats: { maxHp: 21, attack: 12, defense: 13, specialAttack: 11, specialDefense: 12, speed: 10 }, hp: 21,
      majorStatus: null, ability: "OVERGROW", heldItem: null,
      moves: [{ internalName: "TACKLE", pp: 35, maxPp: 35 }],
    }] } };
    expect(selectActiveEventPage(starterEvent, 2, createSourceEventState())?.page).toBe(starterPage);
    expect(selectActiveEventPage(starterEvent, 2, state)).toBeNull();
    expect(selectActiveEventPage(giftEvent, 2, state)?.page).toBe(giftPage);
  });

  it("applies supported switch, variable and self-switch mutations immutably", () => {
    const commands: ImportedEventPage["commands"] = [
      { kind: "set-switches", text: null, indent: 0, data: { firstId: 10, lastId: 11, value: true } },
      { kind: "change-variables", text: null, indent: 0, data: { firstId: 5, lastId: 5, operation: "set", operand: { kind: "constant", values: [7] } } },
      { kind: "change-variables", text: null, indent: 0, data: { firstId: 5, lastId: 5, operation: "add", operand: { kind: "constant", values: [2] } } },
      { kind: "set-self-switch", text: null, indent: 0, data: { id: "A", value: true } },
    ];
    const initial = createSourceEventState();
    const result = applySafeStateCommands(initial, page(unconditional, commands), 3, 8);
    expect(result).toMatchObject({ safe: true, appliedCommands: 4 });
    expect(result.state).toEqual({ switches: { 10: true, 11: true }, variables: { 5: 9 }, selfSwitches: { "3:8:A": true }, inventory: {}, checkpoint: null, party: emptyParty, pendingEncounter: null,
      wildEncounterSteps: 0, wildEncounterRngState: 0x9e37_79b9 });
    expect(initial).toEqual({ switches: {}, variables: {}, selfSwitches: {}, inventory: {}, checkpoint: null, party: emptyParty, pendingEncounter: null,
      wildEncounterSteps: 0, wildEncounterRngState: 0x9e37_79b9 });
  });

  it("does not partially mutate an event containing unsupported control flow", () => {
    const unsafe = page(unconditional, [
      { kind: "set-self-switch", text: null, indent: 0, data: { id: "A", value: true } },
      { kind: "show-choices", text: null, indent: 0, data: { choices: ["Oui", "Non"] } },
    ]);
    const initial = createSourceEventState();
    expect(applySafeStateCommands(initial, unsafe, 3, 8)).toMatchObject({ state: initial, appliedCommands: 0, safe: false });
  });

  it("validates persisted state before restoring it", () => {
    expect(parseSourceEventState({ switches: { 2: true }, variables: { 3: 4 }, selfSwitches: { "3:1:A": false } }))
      .toEqual({ switches: { 2: true }, variables: { 3: 4 }, selfSwitches: { "3:1:A": false }, inventory: {}, checkpoint: null, party: emptyParty, pendingEncounter: null,
        wildEncounterSteps: 0, wildEncounterRngState: 0x9e37_79b9 });
    expect(() => parseSourceEventState({ switches: { 2: "yes" }, variables: {}, selfSwitches: {} })).toThrow("invalide");
  });

  it("grants and removes personal inventory items atomically", () => {
    const eventPage = page(unconditional, [
      { kind: "grant-item", text: null, indent: 0, data: { itemId: "POTION", quantity: 3, policy: "PERSONAL" } },
      { kind: "remove-item", text: null, indent: 0, data: { itemId: "POTION", quantity: 1, policy: "PERSONAL" } },
      { kind: "set-self-switch", text: null, indent: 0, data: { id: "A", value: true } },
    ]);
    const result = applySafeStateCommands(createSourceEventState(), eventPage, 3, 21);
    expect(result.state.inventory).toEqual({ POTION: 2 });
    expect(result.state.selfSwitches).toEqual({ "3:21:A": true });
    const missing = applySafeStateCommands(createSourceEventState(), page(unconditional, [
      { kind: "remove-item", text: null, indent: 0, data: { itemId: "KEY", quantity: 1 } },
    ]), 3, 1);
    expect(missing).toMatchObject({ safe: false, appliedCommands: 0, state: createSourceEventState() });
  });

  it("stores a validated personal checkpoint from the execution context", () => {
    const checkpointPage = page(unconditional, [
      { kind: "set-checkpoint", text: null, indent: 0, data: { policy: "PERSONAL" } },
    ]);
    const result = applySafeStateCommands(createSourceEventState(), checkpointPage, 3, 30,
      { checkpoint: { mapId: 3, x: 47, y: 13, direction: "right" } });
    expect(result.state.checkpoint).toEqual({ mapId: 3, x: 47, y: 13, direction: "right" });
    expect(applySafeStateCommands(createSourceEventState(), checkpointPage, 3, 30)).toMatchObject({ safe: false, appliedCommands: 0 });
  });

  it("applies recover-all to the persistent party once a starter exists", () => {
    const state = { ...createSourceEventState(), party: { schemaVersion: 1 as const, activeIndex: 0, members: [{
      id: "starter", species: "PIKACHU", nickname: null, level: 8, experience: 400,
      stats: { maxHp: 28, attack: 15, defense: 12, specialAttack: 14, specialDefense: 14, speed: 20 },
      hp: 3, majorStatus: { kind: "burn" as const }, ability: null, heldItem: null,
      moves: [{ internalName: "TACKLE", pp: 1, maxPp: 35 }],
    }] } };
    const result = applySafeStateCommands(state, page(unconditional, [
      { kind: "heal-party", text: null, indent: 0, data: {} },
    ]), 3, 30);
    expect(result.state.party.members[0]).toMatchObject({ hp: 28, majorStatus: null, moves: [{ pp: 35 }] });
    expect(state.party.members[0]).toMatchObject({ hp: 3, majorStatus: { kind: "burn" }, moves: [{ pp: 1 }] });
  });

  it("adds the chosen starter and queues its scripted encounter atomically", () => {
    const eventPage = page(unconditional, [
      { kind: "add-pokemon", text: null, indent: 0, data: { species: "CHESPIN", level: 5 } },
      { kind: "request-encounter", text: null, indent: 0, data: { species: "BIDOOF", level: 2 } },
      { kind: "set-switches", text: null, indent: 0, data: { firstId: 65, lastId: 65, value: true } },
    ]);
    const result = applySafeStateCommands(createSourceEventState(), eventPage, 2, 9, {
      checkpoint: { mapId: 2, x: 52, y: 22, direction: "up" },
      createPokemon: (species, level) => ({ id: "starter", species, nickname: null, level, experience: 0,
        stats: { maxHp: 22, attack: 12, defense: 14, specialAttack: 11, specialDefense: 13, speed: 10 }, hp: 22,
        majorStatus: null, ability: "OVERGROW", heldItem: null, moves: [{ internalName: "TACKLE", pp: 35, maxPp: 35 }] }),
    });
    expect(result).toMatchObject({ safe: true, appliedCommands: 3, state: { switches: {},
      pendingEncounter: { species: "BIDOOF", level: 2, victorySwitches: { 65: true }, escapable: false },
      party: { activeIndex: 0, members: [{ species: "CHESPIN", level: 5 }] } } });
    expect(completePendingEncounter(result.state)).toMatchObject({ switches: { 65: true }, pendingEncounter: null });
  });
});
