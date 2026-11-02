import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dialogueLines, type ImportedEventPage } from "../src/imported-map.js";
import { resolveEventFlow } from "../src/source-event-flow.js";
import { applySafeStateCommands, createSourceEventState, parseSourceEventState } from "../src/source-event-state.js";
import { compileSourceScene } from "../src/source-scene-plan.js";
import { guestPersonalAchievementPage, guestSourceEventAccess, guestSourceStateCommandAllowed,
  sourceStateWithHostStory, sourceStateWithLocalStory } from "../src/source-coop-policy.js";

type Command = ImportedEventPage["commands"][number];
const entry = (kind: string, indent: number, data: Record<string, unknown> = {}): Command =>
  ({ kind, indent, text: typeof data.text === "string" ? data.text : null, data });
const page = (commands: Command[]): ImportedEventPage => ({
  condition: { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null },
  graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false,
    directionFix: false, through: false, alwaysOnTop: false, trigger: 0 }, commands,
});
const constant = (operation: string, value: number): Command => entry("change-variables", 0,
  { firstId: 218, lastId: 218, operation, operand: { kind: "constant", values: [value] } });

describe("source achievements and Map024 counters", () => {
  it("counts distinct owned species, displays the number, and grants the Pokédex thresholds once", () => {
    const state = { ...createSourceEventState(), pokedex: { seenSpecies: [],
      caughtSpecies: Array.from({ length: 250 }, (_, i) => `SPECIES_${i}`), evolvedSpecies: [], releasedSpecies: [] } };
    const event = page([
      entry("ruby-script", 0, { source: "$game_variables[226]=$Trainer.pokedexOwned()" }),
      entry("show-text", 0, { text: "Capturés : \\v[226]" }),
      entry("condition", 0, { kind: "ruby-script", script: "$Trainer.pokedexOwned() >= 250" }),
      entry("ruby-script", 1, { source: "setLogro(23, 3)" }), entry("condition-end", 0),
    ]);
    const flow = resolveEventFlow(event, [], state, 24, 50);
    expect(flow.blockedReason).toBeNull();
    expect(dialogueLines(flow.page)).toEqual(["Capturés : 250"]);
    const applied = applySafeStateCommands(state, flow.page, 24, 50);
    expect(applied.safe).toBe(true);
    expect(applied.state.achievements[23]).toBe(3);
    expect(applied.state.variables["226"]).toBe(250);
    const repeated = applySafeStateCommands(applied.state, flow.page, 24, 50);
    expect(repeated.state.achievements[23]).toBe(3);
    expect(parseSourceEventState(JSON.parse(JSON.stringify(applied.state))).achievements[23]).toBe(3);
  });

  it("projects the 108 inventory checks before evaluating the TM milestone", () => {
    const state = { ...createSourceEventState(), inventory: Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`TM${String(i + 1).padStart(2, "0")}`, 1])) };
    const commands: Command[] = [constant("set", 0)];
    for (let i = 1; i <= 108; i += 1) {
      commands.push(entry("condition", 0, { kind: "ruby-script",
        script: `$PokemonBag.pbQuantity(PBItems::TM${String(i).padStart(2, "0")})>0` }));
      commands.push({ ...constant("add", 1), indent: 1 });
      commands.push(entry("condition-end", 0));
    }
    commands.push(entry("show-text", 0, { text: "MT : \\v[218]" }));
    commands.push(entry("condition", 0, { kind: "variable", operands: [218, 0, 100, 1] }));
    commands.push(entry("ruby-script", 1, { source: "setLogro(18, 3)" }));
    commands.push(entry("condition-end", 0));
    const flow = resolveEventFlow(page(commands), [], state, 24, 49);
    expect(flow.blockedReason).toBeNull();
    expect(dialogueLines(flow.page)).toEqual(["MT : 100"]);
    const result = applySafeStateCommands(state, flow.page, 24, 49);
    expect(result.state.variables["218"]).toBe(100);
    expect(result.state.achievements[18]).toBe(3);
  });

  it("checks the original village, recipe and Alfa thresholds and the final statue", () => {
    const state = { ...createSourceEventState(), variables: { "111": 15, "926": 46, "70": 18 } };
    for (const [variable, threshold, operator, achievement] of [
      [111, 15, 1, 22], [926, 46, 1, 19], [70, 18, 0, 20],
    ]) {
      const flow = resolveEventFlow(page([
        entry("condition", 0, { kind: "variable", operands: [variable, 0, threshold, operator] }),
        entry("ruby-script", 1, { source: `setLogro(${achievement}, 3)` }), entry("condition-end", 0),
      ]), [], state, 24, variable);
      expect(flow.blockedReason).toBeNull();
      expect(applySafeStateCommands(state, flow.page, 24, variable).state.achievements[achievement]).toBe(3);
    }
    const statue = page([
      entry("condition", 0, { kind: "ruby-script", script: "getLogro(0)==3  " }),
      entry("set-switches", 1, { firstId: 820, lastId: 820, value: true }),
      entry("condition-end", 0),
    ]);
    expect(resolveEventFlow(statue, [], state, 24, 55).page.commands).toEqual([]);
    const complete = { ...state, achievements: state.achievements.map(() => 3) as (1 | 2 | 3)[] };
    expect(resolveEventFlow(statue, [], complete, 24, 55).page.commands[0]?.kind).toBe("set-switches");
  });

  it("lets a guest claim personal Pokédex milestones after the host has cleared the shared switches", () => {
    const milestone = page([
      entry("condition", 0, { kind: "switch", operands: [694, 1] }),
      entry("condition", 1, { kind: "ruby-script", script: "$Trainer.pokedexOwned() >= 750" }),
      entry("ruby-script", 2, { source: "setLogro(25, 3)" }),
      entry("set-switches", 2, { firstId: 694, lastId: 694, value: true }),
      entry("condition-end", 1), entry("condition-end", 0),
    ]);
    const event = { id: 50, name: "Pokédex", x: 0, y: 0, pages: [milestone, page([])] };
    const owned = Array.from({ length: 750 }, (_, i) => `SPECIES_${i}`);
    const local = { ...createSourceEventState(), pokedex: { seenSpecies: owned, caughtSpecies: owned,
      evolvedSpecies: [], releasedSpecies: [] } };
    const hostStory = { switches: { "694": true }, variables: {}, selfSwitches: {} };
    const projected = sourceStateWithHostStory(local, hostStory, true);
    expect(guestPersonalAchievementPage(event)?.pageIndex).toBe(0);
    expect(guestSourceEventAccess(milestone)).toBe("personal");
    expect(guestSourceStateCommandAllowed(milestone, "set-achievement")).toBe(true);
    expect(guestSourceStateCommandAllowed(milestone, "set-switches")).toBe(false);
    const flow = resolveEventFlow(milestone, [], projected, 24, 50,
      { playerDirection: 2, personalAchievementGates: true });
    expect(flow.blockedReason).toBeNull();
    const personalCommands = flow.page.commands.filter((command) => command.kind !== "set-switches");
    const applied = applySafeStateCommands(local, { ...flow.page, commands: personalCommands }, 24, 50);
    const restored = sourceStateWithLocalStory(local, applied.state);
    expect(restored.achievements[25]).toBe(3);
    expect(restored.switches["694"]).toBeUndefined();
    expect(guestPersonalAchievementPage(event)?.pageIndex).toBe(0);
  });

  const sourceMapPath = new URL("../../../.pokemon-z/data/events/Map024.json", import.meta.url);
  it.skipIf(!existsSync(sourceMapPath))("audits the six extracted Map024 events against their real commands", () => {
    const source = JSON.parse(readFileSync(sourceMapPath, "utf8")) as {
      events: { id: number; pages: { commands: { kind: string; indent: number; data: Record<string, unknown> }[] }[] }[];
    };
    const events = new Map(source.events.map((event) => [event.id, event]));
    const owned = Array.from({ length: 750 }, (_, id) => `SPECIES_${id}`);
    const inventory = Object.fromEntries(Array.from({ length: 100 }, (_, index) =>
      [`TM${String(index + 1).padStart(2, "0")}`, 1]));
    const state = { ...createSourceEventState(), variables: { "111": 15, "926": 46, "70": 18 }, inventory,
      pokedex: { seenSpecies: owned, caughtSpecies: owned, evolvedSpecies: [], releasedSpecies: [] } };
    for (const [eventId, achievementId] of [[32, 22], [47, 19], [48, 20], [49, 18], [50, 23]]) {
      const raw = events.get(eventId)?.pages[0]?.commands;
      expect(raw).toBeDefined();
      const flow = resolveEventFlow(page(raw!.map((item) => entry(item.kind, item.indent, item.data))), [], state, 24, eventId);
      expect(flow.blockedReason).toBeNull();
      expect(compileSourceScene(flow.page).audit.complete).toBe(true);
      const applied = applySafeStateCommands(state, flow.page, 24, eventId);
      expect(applied.safe).toBe(true);
      expect(applied.state.achievements[achievementId]).toBe(3);
    }
    const completed = { ...state, achievements: Array(27).fill(3) as (1 | 2 | 3)[] };
    const statue = events.get(55)!.pages;
    const firstPage = resolveEventFlow(page(statue[0]!.commands.map((item) => entry(item.kind, item.indent, item.data))),
      [], completed, 24, 55);
    expect(firstPage.blockedReason).toBeNull();
    expect(firstPage.page.commands.some((command) => command.kind === "set-switches"
      && command.data.firstId === 820)).toBe(true);
    expect(compileSourceScene(firstPage.page).audit.complete).toBe(true);
    expect(compileSourceScene(page(statue[1]!.commands.map((item) => entry(item.kind, item.indent, item.data))))
      .audit.complete).toBe(true);
    const guestState = sourceStateWithHostStory(state, { switches: { "694": true }, variables: state.variables,
      selfSwitches: {} }, true);
    const guestEvent = events.get(50)!;
    const guestPages = { id: guestEvent.id, name: "Pokédex", x: 0, y: 0,
      pages: guestEvent.pages.map((raw) => page(raw.commands.map((item) => entry(item.kind, item.indent, item.data)))) };
    const personal = guestPersonalAchievementPage(guestPages);
    expect(personal?.pageIndex).toBe(0);
    const guestFlow = resolveEventFlow(personal!.page, [], guestState, 24, 50,
      { playerDirection: 2, personalAchievementGates: true });
    expect(guestFlow.blockedReason).toBeNull();
    const personalOnly = guestFlow.page.commands.filter((command) => !["set-switches", "set-self-switch"].includes(command.kind));
    const guestApplied = applySafeStateCommands(state, { ...guestFlow.page, commands: personalOnly }, 24, 50);
    expect(guestApplied.state.achievements.slice(23, 26)).toEqual([3, 3, 3]);
  });
});
