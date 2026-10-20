import { describe, expect, it } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { resolveEventFlow } from "../src/source-event-flow.js";
import { createSourceEventState } from "../src/source-event-state.js";
import { expandSourceCommonEvents, type SourceCommonEvent } from "../src/source-common-events.js";

type Command = ImportedEventPage["commands"][number];
const condition = { switch1Id: null, switch2Id: null, variable: null, selfSwitch: null } as const;
const emptyParty = { schemaVersion: 1 as const, activeIndex: null, members: [] } as const;
const command = (kind: string, indent: number, data: Readonly<Record<string, unknown>> = {}): Command =>
  ({ kind, indent, text: typeof data.text === "string" ? data.text : null, data });
const page = (commands: readonly Command[]): ImportedEventPage => ({ condition,
  graphic: { tileId: 0, characterName: "", direction: 2, pattern: 0, opacity: 255 },
  settings: { moveType: 0, moveSpeed: 3, moveFrequency: 3, walkAnimation: true, stepAnimation: false, directionFix: false,
    through: false, alwaysOnTop: false, trigger: 0 }, commands });

describe("source event choice and condition flow", () => {
  it("collapses the source daycare dialogue tree into the personal Pension service", () => {
    const result = resolveEventFlow(page([
      command("condition", 0, { kind: "ruby-script", script: "Kernel.pbDayCareDeposited==0" }),
      command("ruby-script", 1, { source: "pbDayCareDeposit(pbGet(1))" }),
      command("condition-end", 0),
    ]), [], createSourceEventState(), 48, 5);
    expect(result).toMatchObject({ complete: true, pendingChoice: null, blockedReason: null });
    expect(result.page.commands).toEqual([expect.objectContaining({ kind: "open-day-care",
      data: { policy: "PERSONAL" } })]);
  });

  it("routes the source egg caretaker separately from Pension management", () => {
    const result = resolveEventFlow(page([
      command("condition", 0, { kind: "ruby-script", script: "pbEggGenerated?" }),
      command("ruby-script", 1, { source: "pbDayCareGenerateEgg" }),
      command("condition-end", 0),
    ]), [], createSourceEventState(), 24, 34);
    expect(result).toMatchObject({ complete: true, pendingChoice: null, blockedReason: null });
    expect(result.page.commands).toEqual([expect.objectContaining({ kind: "open-day-care-eggs",
      data: { policy: "PERSONAL" } })]);
  });

  it("ports source traversal scripts and lets the isolated test override satisfy movement-item branches", () => {
    const eventPage = page([
      command("condition", 0, { kind: "ruby-script",
        script: "$PokemonBag.pbQuantity(PBItems::BICYCLE)>0" }),
      command("ruby-script", 1, { source: "Kernel.pbMountBike" }),
      command("else", 0), command("show-text", 1, { text: "Objet requis" }), command("condition-end", 0),
      command("ruby-script", 0, { source: "$PokemonGlobal.runningShoes=true" }),
      command("ruby-script", 0, { source: "Kernel.pbDismountBike" }),
    ]);
    const locked = resolveEventFlow(eventPage, [], createSourceEventState(), 14, 1,
      { playerDirection: 2, movementTestUnlocks: false });
    expect(locked.page.commands.map((entry) => entry.kind)).toEqual([
      "show-text", "set-running-shoes", "set-movement-mode",
    ]);
    const testUnlocked = resolveEventFlow(eventPage, [], createSourceEventState(), 14, 1,
      { playerDirection: 2, movementTestUnlocks: true });
    expect(testUnlocked.page.commands.map((entry) => entry.kind)).toEqual([
      "set-movement-mode", "set-running-shoes", "set-movement-mode",
    ]);
  });

  it("pauses on a choice then projects only the selected nested branch", () => {
    const eventPage = page([
      command("show-text", 0, { text: "Question" }), command("show-choices", 0, { choices: ["Oui", "Non"], cancelType: 2 }),
      command("choice-branch", 0, { choiceIndex: 0 }), command("set-switches", 1, { firstId: 1, lastId: 1, value: true }),
      command("show-choices", 1, { choices: ["A", "B"], cancelType: 2 }),
      command("choice-branch", 1, { choiceIndex: 0 }), command("show-text", 2, { text: "A choisi" }),
      command("choice-branch", 1, { choiceIndex: 1 }), command("show-text", 2, { text: "B choisi" }), command("choice-end", 1),
      command("choice-branch", 0, { choiceIndex: 1 }), command("show-text", 1, { text: "Refus" }), command("choice-end", 0), command("end", 0),
    ]);
    expect(resolveEventFlow(eventPage, [], createSourceEventState(), 3, 1)).toMatchObject({ complete: false,
      pendingChoice: { choices: ["Oui", "Non"] }, consumedChoices: 0 });
    const nested = resolveEventFlow(eventPage, [0], createSourceEventState(), 3, 1);
    expect(nested).toMatchObject({ complete: false, pendingChoice: { choices: ["A", "B"] }, consumedChoices: 1 });
    const complete = resolveEventFlow(eventPage, [0, 1], createSourceEventState(), 3, 1);
    expect(complete.complete).toBe(true);
    expect(complete.page.commands.map((entry) => entry.text ?? entry.kind)).toEqual(["Question", "set-switches", "B choisi", "end"]);
  });

  it("evaluates standard switch, variable and self-switch conditions", () => {
    const eventPage = page([
      command("condition", 0, { kind: "switch", operands: [2, 0] }), command("show-text", 1, { text: "ON" }),
      command("else", 0), command("show-text", 1, { text: "OFF" }), command("condition-end", 0),
      command("condition", 0, { kind: "variable", operands: [4, 0, 3, 1] }), command("show-text", 1, { text: "VAR" }), command("condition-end", 0),
      command("condition", 0, { kind: "self-switch", operands: ["A", 0] }), command("show-text", 1, { text: "SELF" }), command("condition-end", 0),
    ]);
    const state = { switches: { 2: true }, variables: { 4: 5 }, selfSwitches: { "3:9:A": true }, inventory: {}, money: 3000, pokedexEnabled: false, followerEnabled: false, checkpoint: null,
      party: emptyParty, pendingEncounter: null };
    expect(resolveEventFlow(eventPage, [], state, 3, 9).page.commands.map((entry) => entry.text)).toEqual(["ON", "VAR", "SELF"]);
  });

  it("evaluates native source money conditions", () => {
    const eventPage = page([
      command("condition", 0, { kind: "gold", operands: [3000, 0] }),
      command("show-text", 1, { text: "Assez" }), command("else", 0),
      command("show-text", 1, { text: "Insuffisant" }), command("condition-end", 0),
    ]);
    expect(resolveEventFlow(eventPage, [], createSourceEventState(), 3, 1).page.commands[0]?.text).toBe("Assez");
    expect(resolveEventFlow(eventPage, [], { ...createSourceEventState(), money: 2999 }, 3, 1)
      .page.commands[0]?.text).toBe("Insuffisant");
  });

  it("selects single or double trainer branches from the conscious non-egg party count", () => {
    const eventPage = page([
      command("condition", 0, { kind: "ruby-script", script: "$Trainer.ablePokemonCount == 1" }),
      command("show-text", 1, { text: "Combat simple" }), command("else", 0),
      command("show-text", 1, { text: "Combat double" }), command("condition-end", 0),
    ]);
    const template = createSourceEventState().party;
    const pokemon = { id: "party-1", species: "FENNEKIN", nickname: null, level: 5, experience: 0, hp: 20,
      stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
      gender: "female" as const, shiny: false, nature: "HARDY", ability: "BLAZE", heldItem: null,
      friendship: 70, moves: [], ivs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      metadata: { form: 0, markings: 0, eggSteps: 0, pokerus: 0, obtainedMap: 0, obtainedLevel: 5,
        obtainedText: "", obtainMode: 0, hatchedMap: 0, language: 2, ownerId: 1, ownerName: "Test" } };
    const single = { ...createSourceEventState(), party: { ...template, activeIndex: 0, members: [pokemon] } };
    const double = { ...single, party: { ...single.party, members: [pokemon, { ...pokemon, id: "party-2" }] } };
    expect(resolveEventFlow(eventPage, [], single, 27, 1).page.commands[0]?.text).toBe("Combat simple");
    expect(resolveEventFlow(eventPage, [], double, 27, 1).page.commands[0]?.text).toBe("Combat double");
  });

  it("selects the source movement branch from the player's direction", () => {
    const eventPage = page([
      command("condition", 0, { kind: "character-direction", operands: [-1, 6] }),
      command("show-text", 1, { text: "Droite" }), command("else", 0),
      command("show-text", 1, { text: "Autre direction" }), command("condition-end", 0),
    ]);
    const state = createSourceEventState();
    expect(resolveEventFlow(eventPage, [], state, 2, 9, { playerDirection: 6 }).page.commands[0]?.text).toBe("Droite");
    expect(resolveEventFlow(eventPage, [], state, 2, 9, { playerDirection: 8 }).page.commands[0]?.text).toBe("Autre direction");
    expect(resolveEventFlow(eventPage, [], state, 2, 9)).toMatchObject({
      complete: false, blockedReason: "condition character-direction non prise en charge",
    });
  });

  it("ports allowlisted item and cry scripts without evaluating Ruby", () => {
    const eventPage = page([
      command("ruby-script", 0, { source: "Kernel.pbItemBall(PBItems::ORANBERRY)" }),
      command("ruby-script", 0, { source: "pbPlayCry(PBSpecies::KRICKETOT)" }),
      command("set-self-switch", 0, { id: "A", value: true }),
    ]);
    const result = resolveEventFlow(eventPage, [], createSourceEventState(), 3, 14);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual(["grant-item", "play-cry", "set-self-switch"]);
    expect(result.page.commands[0]?.data).toMatchObject({ itemId: "ORANBERRY", quantity: 1, policy: "PERSONAL" });
  });

  it("ports fixed and variable source boss fights into host-authoritative encounters", () => {
    const fixed = resolveEventFlow(page([
      command("ruby-script", 0, { source: "$game_variables[300] = [:SPEED, 1, :DEFENSE, 1]" }),
      command("ruby-script", 0, { source: "$PokemonGlobal.nextBattleBGM=\"CombateNido\"" }),
      command("condition", 0, { kind: "ruby-script", script: "pbBossFight(PBSpecies::FURFROU,11,0)" }),
      command("show-text", 1, { text: "Victoire" }), command("condition-end", 0),
    ]), [], createSourceEventState(), 24, 13);
    expect(fixed).toMatchObject({ complete: true, blockedReason: null });
    expect(fixed.page.commands[0]).toMatchObject({ kind: "set-next-wild-battle-stages",
      data: { stages: { speed: 1, defense: 1 }, policy: "HOST_NARRATIVE" } });
    expect(fixed.page.commands).toContainEqual(expect.objectContaining({ kind: "request-encounter",
      data: expect.objectContaining({ species: "FURFROU", level: 11, boss: true, policy: "HOST_ONLY" }) }));

    const variable = resolveEventFlow(page([
      command("condition", 0, { kind: "ruby-script",
        script: "pbBossFight([:VOLBEAT,:ILLUMISE,:BUTTERFREE][pbGet(183)],17)" }),
      command("show-text", 1, { text: "Nid vaincu" }), command("condition-end", 0),
    ]), [], { ...createSourceEventState(), variables: { "183": 1 } }, 28, 8);
    expect(variable.page.commands[0]).toMatchObject({ kind: "request-encounter", data: {
      speciesChoices: ["VOLBEAT", "ILLUMISE", "BUTTERFREE"], speciesVariableId: 183, level: 17,
      boss: true, policy: "HOST_ONLY",
    } });
  });

  it("ports scripted wild encounters with the extended Pokemon Z arguments", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbWildBattle(:MORELULL,16,81,false,false)" }),
    ]), [], createSourceEventState(), 28, 21);
    expect(result.page.commands[0]).toMatchObject({ kind: "request-encounter",
      data: { species: "MORELULL", level: 16, policy: "HOST_ONLY" } });
  });

  it("ports source random reward lists without choosing on the client", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source:
        "Kernel.pbReceiveItem([:PPUP,:QUICKBALL,:BRIGHTPOWDER,:SERIOUSMINT,:ELIXIR][rand(5)])" }),
    ]), [], createSourceEventState(), 28, 8);
    expect(result.page.commands[0]).toMatchObject({ kind: "grant-random-item", data: {
      itemChoices: ["PPUP", "QUICKBALL", "BRIGHTPOWDER", "SERIOUSMINT", "ELIXIR"],
      quantity: 1, policy: "HOST_REWARD",
    } });
  });

  it("preserves mixed-case source item identifiers", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "Kernel.pbItemBall(PBItems::ACapsula)" }),
    ]), [], createSourceEventState(), 9, 40);
    expect(result.page.commands[0]).toMatchObject({ kind: "grant-item", data: { itemId: "ACapsula", quantity: 1 } });
  });

  it("normalizes source inventory mutations across item-reference syntaxes", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "Kernel.pbReceiveItem(PBItems::Cenizas)" }),
      command("ruby-script", 0, { source: "pbReceiveItem(:POTION, 3)" }),
      command("ruby-script", 0, { source: "$PokemonBag.pbStoreItem(PBItems::ACapsula)" }),
      command("ruby-script", 0, { source: "$PokemonBag.pbDeleteItem(PBItems::POTION, 2)" }),
      command("ruby-script", 0, { source: "pbItemBall(:POLVOBRILLANTE, 2)" }),
    ]), [], createSourceEventState(), 16, 16);

    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([
      expect.objectContaining({ kind: "grant-item", data: { itemId: "Cenizas", quantity: 1, policy: "PERSONAL" } }),
      expect.objectContaining({ kind: "grant-item", data: { itemId: "POTION", quantity: 3, policy: "PERSONAL" } }),
      expect.objectContaining({ kind: "grant-item", data: { itemId: "ACapsula", quantity: 1, policy: "PERSONAL" } }),
      expect.objectContaining({ kind: "remove-item", data: { itemId: "POTION", quantity: 2, policy: "PERSONAL" } }),
      expect.objectContaining({ kind: "grant-item", data: { itemId: "POLVOBRILLANTE", quantity: 2,
        policy: "PERSONAL" } }),
    ]);
  });

  it("projects crafted inventory into later conditions from the same interaction", () => {
    const eventPage = page([
      command("ruby-script", 0, { source: "$PokemonBag.pbDeleteItem(:BRASACANDENTE,1)" }),
      command("ruby-script", 0, { source: "$PokemonBag.pbDeleteItem(:POLVOBRILLANTE,1)" }),
      command("ruby-script", 0, { source: "Kernel.pbItemBall(PBItems::POLVOEXPLOSIVO)" }),
      command("condition", 0, { kind: "ruby-script",
        script: "$PokemonBag.pbQuantity(PBItems::POLVOEXPLOSIVO)>0" }),
      command("show-text", 1, { text: "La poudre peut être utilisée immédiatement." }),
      command("condition-end", 0),
    ]);
    const state = { ...createSourceEventState(),
      inventory: { BRASACANDENTE: 1, POLVOBRILLANTE: 1 } };

    const result = resolveEventFlow(eventPage, [], state, 54, 2);

    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual([
      "remove-item", "remove-item", "grant-item", "show-text",
    ]);
  });

  it("ports Pokemon Z rock destruction and its optional 25 percent encounter", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbEraseThisEvent" }),
      command("ruby-script", 0, { source: "Kernel.pbRockSmashRandomEncounter" }),
    ]), [], createSourceEventState(), 54, 2);

    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([
      expect.objectContaining({ kind: "erase-event", data: expect.objectContaining({ policy: "SHARED" }) }),
      expect.objectContaining({ kind: "request-random-encounter", data: expect.objectContaining({
        method: "RockSmash", chancePercent: 25, optional: true, policy: "HOST_ONLY",
      }) }),
    ]);
  });

  it("resolves the complete Z rock flow through common-event crafting and immediate use", () => {
    const common: SourceCommonEvent = { id: 58, name: "TenerGolpeRoca", commands: [
      command("show-text", 0, { text: "Un rocher fissuré bloque le passage." }),
      command("condition", 0, { kind: "variable", operands: [926, 0, 3, 1] }),
      command("condition", 1, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(:BRASACANDENTE)>0" }),
      command("condition", 2, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(:POLVOBRILLANTE)>0" }),
      command("show-choices", 3, { choices: ["Oui", "Non"], cancelType: 2 }),
      command("choice-branch", 3, { choiceIndex: 0, text: "Oui" }),
      command("ruby-script", 4, { source: "$PokemonBag.pbDeleteItem(:BRASACANDENTE,1)" }),
      command("ruby-script", 4, { source: "$PokemonBag.pbDeleteItem(:POLVOBRILLANTE,1)" }),
      command("ruby-script", 4, { source: "Kernel.pbItemBall(PBItems::POLVOEXPLOSIVO)" }),
      command("choice-branch", 3, { choiceIndex: 1, text: "Non" }),
      command("choice-end", 3), command("condition-end", 2), command("condition-end", 1),
      command("condition-end", 0),
    ] };
    const rock = expandSourceCommonEvents(page([
      command("call-common-event", 0, { parameters: [58] }),
      command("condition", 0, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(:POLVOEXPLOSIVO)>0" }),
      command("show-choices", 1, { choices: ["Oui", "Non"], cancelType: 2 }),
      command("choice-branch", 1, { choiceIndex: 0, text: "Oui" }),
      command("ruby-script", 2, { source: "$PokemonBag.pbDeleteItem(:POLVOEXPLOSIVO,1)" }),
      command("set-self-switch", 2, { id: "A", value: true }),
      command("ruby-script", 2, { source: "Kernel.pbRockSmashRandomEncounter" }),
      command("choice-branch", 1, { choiceIndex: 1, text: "Non" }),
      command("choice-end", 1), command("condition-end", 0),
    ]), new Map([[58, common]]));
    const state = { ...createSourceEventState(), variables: { "926": 3 },
      inventory: { BRASACANDENTE: 1, POLVOBRILLANTE: 1 } };

    const result = resolveEventFlow(rock, [0, 0], state, 54, 2);

    expect(result).toMatchObject({ complete: true, pendingChoice: null, blockedReason: null,
      consumedChoices: 2 });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual([
      "show-text", "remove-item", "remove-item", "grant-item", "remove-item",
      "set-self-switch", "request-random-encounter",
    ]);
  });

  it("resolves Pokemon Z Cut from inline alchemy through obstacle rewards and axe breakage", () => {
    const common: SourceCommonEvent = { id: 59, name: "TenerCorte", commands: [
      command("condition", 0, { kind: "variable", operands: [926, 0, 12, 1] }),
      command("condition", 1, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(PBItems::MADERA)>0" }),
      command("condition", 2, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(PBItems::VIRUTASFERREAS)>0" }),
      command("show-choices", 3, { choices: ["Oui", "Non"], cancelType: 2 }),
      command("choice-branch", 3, { choiceIndex: 0, text: "Oui" }),
      command("ruby-script", 4, { source: "$PokemonBag.pbDeleteItem(:MADERA,1)" }),
      command("ruby-script", 4, { source: "$PokemonBag.pbDeleteItem(:VIRUTASFERREAS,1)" }),
      command("ruby-script", 4, { source: "Kernel.pbItemBall(PBItems::HACHAENDEBLE)" }),
      command("choice-branch", 3, { choiceIndex: 1, text: "Non" }),
      command("choice-end", 3), command("condition-end", 2), command("condition-end", 1),
      command("condition-end", 0),
    ] };
    const shrub = expandSourceCommonEvents(page([
      command("show-text", 0, { text: "Un arbuste bloque le passage." }),
      command("call-common-event", 0, { parameters: [59] }),
      command("condition", 0, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(PBItems::HACHAENDEBLE)>0" }),
      command("show-text", 1, { text: "La hache coupe l'arbuste." }),
      command("play-sound", 1, { audio: { name: "PRSFX- Cut", volume: 80, pitch: 100 } }),
      command("show-animation", 1, { parameters: [0, 19] }),
      command("set-self-switch", 1, { id: "A", value: true }),
      command("ruby-script", 1, { source: "Kernel.pbItemBall(PBItems::PECHABERRY)" }),
      command("ruby-script", 1, { source: "Kernel.pbItemBall(PBItems::ORANBERRY)" }),
      command("ruby-script", 1, { source: "$PokemonBag.pbDeleteItem(:HACHAENDEBLE,1)" }),
      command("show-text", 1, { text: "La hache s'est cassée." }),
      command("condition-end", 0),
    ]), new Map([[59, common]]));
    const state = { ...createSourceEventState(), variables: { "926": 12 },
      inventory: { MADERA: 1, VIRUTASFERREAS: 1 } };

    const result = resolveEventFlow(shrub, [0], state, 9, 39);

    expect(result).toMatchObject({ complete: true, pendingChoice: null, blockedReason: null,
      consumedChoices: 1 });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual([
      "show-text", "remove-item", "remove-item", "grant-item", "show-text", "play-sound",
      "show-animation", "set-self-switch", "grant-item", "grant-item", "remove-item", "show-text",
    ]);
    expect(result.page.commands[5]?.data).toEqual({ audio: { name: "PRSFX- Cut", volume: 80, pitch: 100 } });
    expect(result.page.commands[6]?.data).toEqual({ parameters: [0, 19] });
  });

  it("uses an already owned weak axe without requiring the inline alchemy level", () => {
    const common: SourceCommonEvent = { id: 59, name: "TenerCorte", commands: [
      command("condition", 0, { kind: "variable", operands: [926, 0, 12, 1] }),
      command("show-choices", 1, { choices: ["Oui", "Non"], cancelType: 2 }),
      command("choice-branch", 1, { choiceIndex: 0, text: "Oui" }),
      command("ruby-script", 2, { source: "Kernel.pbItemBall(PBItems::HACHAENDEBLE)" }),
      command("choice-branch", 1, { choiceIndex: 1, text: "Non" }),
      command("choice-end", 1), command("condition-end", 0),
    ] };
    const shrub = expandSourceCommonEvents(page([
      command("call-common-event", 0, { parameters: [59] }),
      command("condition", 0, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(:HACHAENDEBLE)>0" }),
      command("set-self-switch", 1, { id: "A", value: true }),
      command("ruby-script", 1, { source: "$PokemonBag.pbDeleteItem(:HACHAENDEBLE,1)" }),
      command("condition-end", 0),
    ]), new Map([[59, common]]));
    const state = { ...createSourceEventState(), variables: { "926": 0 }, inventory: { HACHAENDEBLE: 1 } };

    const result = resolveEventFlow(shrub, [], state, 46, 28);

    expect(result).toMatchObject({ complete: true, pendingChoice: null, blockedReason: null,
      consumedChoices: 0 });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual(["set-self-switch", "remove-item"]);
  });

  it("ports the Magic Watering Can flower chain through its source inventory and world mutations", () => {
    const flower = page([
      command("condition", 0, { kind: "ruby-script",
        script: "$PokemonBag.pbQuantity(PBItems::REGADERAMAGICA)>0" }),
      command("show-text", 1, { text: "Voulez-vous l'arroser avec la Regadera Mágica ?" }),
      command("show-choices", 1, { choices: ["Oui", "Non"], cancelType: 2 }),
      command("choice-branch", 1, { choiceIndex: 0, text: "Oui" }),
      command("show-animation", 2, { parameters: [0, 28] }),
      command("wait", 2, { frames: 30 }),
      command("show-text", 2, { text: "Quelque chose jaillit de l'intérieur !" }),
      command("ruby-script", 2, { source: "$PokemonBag.pbDeleteItem(:REGADERAMAGICA,1)" }),
      command("ruby-script", 2, { source: "Kernel.pbItemBall(PBItems::TALISMANMALVO)" }),
      command("set-switches", 2, { firstId: 400, lastId: 400, value: true }),
      command("choice-branch", 1, { choiceIndex: 1, text: "Non" }),
      command("choice-end", 1), command("condition-end", 0),
    ]);
    const state = { ...createSourceEventState(), inventory: { REGADERAMAGICA: 1 } };
    const result = resolveEventFlow(flower, [0], state, 192, 1);
    expect(result).toMatchObject({ complete: true, blockedReason: null, consumedChoices: 1 });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual([
      "show-text", "show-animation", "wait", "show-text", "remove-item", "grant-item", "set-switches",
    ]);
    expect(result.page.commands[1]?.data).toEqual({ parameters: [0, 28] });
  });

  it("evaluates the ETERNO Unown door condition from ordered persisted forms", () => {
    const forms = [4, 19, 4, 17, 13, 14];
    const base = createSourceEventState();
    const members = forms.map((form, index) => ({
      id: `unown-${index}`, species: "UNOWN", nickname: null, level: 5, experience: 0,
      stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 }, hp: 20,
      majorStatus: null, ability: null, heldItem: null, moves: [],
      metadata: { schemaVersion: 1 as const, personality: index, originalTrainerId: 0, originalTrainerName: "Joueur",
        originalTrainerGender: null, origin: { method: "encounter" as const, mapId: null, level: 5,
          receivedAt: null, hatchedMapId: null, hatchedAt: null, fateful: false }, nature: "HARDY", gender: null,
        happiness: 70, shiny: false, form, pokerus: { strain: 0, days: 0 }, markings: 0, ribbons: [],
        contest: { cool: 0, beauty: 0, cute: 0, smart: 0, tough: 0, sheen: 0 }, ivs: [0, 0, 0, 0, 0, 0],
        evs: [0, 0, 0, 0, 0, 0], eggSteps: 0, ball: "POKEBALL" },
    }));
    const door = page([
      command("condition", 0, { kind: "ruby-script", script: "unown_check" }),
      command("set-switches", 1, { firstId: 900, lastId: 900, value: true }),
      command("else", 0), command("show-text", 1, { text: "La porte reste close." }),
      command("condition-end", 0),
    ]);
    const state = { ...base, party: { schemaVersion: 1 as const, activeIndex: 0, members } };
    expect(resolveEventFlow(door, [], state, 403, 1).page.commands.map((entry) => entry.kind))
      .toEqual(["set-switches"]);
    const reversed = { ...state, party: { ...state.party, members: [...members].reverse() } };
    expect(resolveEventFlow(door, [], reversed, 403, 1).page.commands.map((entry) => entry.kind))
      .toEqual(["show-text"]);
  });

  it("does not let a legacy numeric outfit assignment block the avatar-profile presentation", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "$Trainer.outfit=7" }),
    ]), [], createSourceEventState(), 336, 10);

    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands[0]).toMatchObject({ kind: "runtime-noop",
      data: { policy: "AVATAR_PROFILE_PRESENTATION" } });
  });

  it.each([
    ["<", 1, 0, true], ["<=", 1, 1, true], ["==", 2, 2, true], ["!=", 2, 1, true],
    [">=", 2, 2, true], [">", 2, 3, true], [">", 2, 2, false],
  ] as const)("evaluates inventory quantity conditions with %s", (comparator, expected, owned, branchMatches) => {
    const eventPage = page([
      command("condition", 0, { kind: "ruby-script",
        script: `$PokemonBag.pbQuantity(PBItems::BRASACANDENTE)${comparator}${expected}` }),
      command("show-text", 1, { text: "vrai" }), command("else", 0),
      command("show-text", 1, { text: "faux" }), command("condition-end", 0),
    ]);
    const state = { ...createSourceEventState(),
      inventory: owned === 0 ? {} : { BRASACANDENTE: owned } };
    const result = resolveEventFlow(eventPage, [], state, 16, 17);

    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands[0]?.text).toBe(branchMatches ? "vrai" : "faux");
  });

  it("supports symbol item references and applies movement test unlocks before comparison", () => {
    const eventPage = page([
      command("condition", 0, { kind: "ruby-script", script: "$PokemonBag.pbQuantity(:BICYCLE)<1" }),
      command("show-text", 1, { text: "absent" }), command("else", 0),
      command("show-text", 1, { text: "présent" }), command("condition-end", 0),
    ]);
    expect(resolveEventFlow(eventPage, [], createSourceEventState(), 16, 17,
      { playerDirection: 2, movementTestUnlocks: false }).page.commands[0]?.text).toBe("absent");
    expect(resolveEventFlow(eventPage, [], createSourceEventState(), 16, 17,
      { playerDirection: 2, movementTestUnlocks: true }).page.commands[0]?.text).toBe("présent");
  });

  it("ports healing checkpoints and accepts non-authoritative presentation commands", () => {
    const eventPage = page([
      command("ruby-script", 0, { source: "Kernel.pbSetPokemonCenter" }), command("recover-all", 0),
      command("screen-tone", 0), command("wait", 0, { frames: 20 }), command("play-jingle", 0), command("end", 0),
    ]);
    const result = resolveEventFlow(eventPage, [], createSourceEventState(), 3, 30);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual([
      "set-checkpoint", "heal-party", "screen-tone", "wait", "play-jingle", "end",
    ]);
  });

  it("ports the Pokemon Center vial refill as a personal state command", () => {
    const result = resolveEventFlow(page([
      command("recover-all", 0), command("change-variables", 0, { firstId: 238, lastId: 238,
        operation: "set", operand: { kind: "variable", values: [239] } }),
    ]), [], createSourceEventState(), 10, 4);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual(["heal-party", "refill-poke-vial"]);
  });

  it("ports the source starter, follower and forced encounter sequence", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbAddPokemon(:CHESPIN,5)" }),
      command("ruby-script", 0, { source: "pbPokemonFollow(10)" }),
      command("ruby-script", 0, { source: "pbWildBattle(PBSpecies::BIDOOF,2)" }),
    ]), [], createSourceEventState(), 2, 9);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual(["add-pokemon", "set-follower", "request-encounter"]);
  });

  it("ports visible roaming encounters from the current map table", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbEncounter(EncounterTypes::Land)" }),
      command("erase-event", 0),
    ]), [], createSourceEventState(), 136, 22);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([
      expect.objectContaining({ kind: "request-random-encounter",
        data: expect.objectContaining({ method: "Land", policy: "HOST_ONLY" }) }),
      expect.objectContaining({ kind: "erase-event" }),
    ]);
  });

  it("ports every source Pokemon Center PC to the personal Ranch", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbPokeCenterPC" }),
    ]), [], createSourceEventState(), 5, 12);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([expect.objectContaining({ kind: "open-ranch",
      data: expect.objectContaining({ policy: "PERSONAL" }) })]);
  });

  it("ports the source panorama motion without evaluating Ruby", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbPanoramaMove(4,4)" }),
    ]), [], createSourceEventState(), 7, 25);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([
      expect.objectContaining({ kind: "panorama-motion",
        data: expect.objectContaining({ scrollX: 1, scrollY: 1, requestedX: 4, requestedY: 4, policy: "PRESENTATION" }) }),
    ]);
  });

  it("ports the Pokedex grant and accepts the map-entry weather cleanup", () => {
    const result = resolveEventFlow(page([
      command("weather", 0, { parameters: [0, 5, 0] }),
      command("ruby-script", 0, { source: "$Trainer.pokedex=true" }),
      command("erase-event", 0),
    ]), [], createSourceEventState(), 9, 35);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual([
      "weather", "set-pokedex-enabled", "erase-event",
    ]);
  });

  it("accepts the safe narrative envelope used by the post-battle autorun", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "$GameSpeed = 0" }),
      command("transfer-player", 0, { addressing: "direct", map: 3, x: 15, y: 16, direction: 2, fade: 0 }),
      command("change-map-settings", 0, { parameters: [] }),
      command("move-route", 0, { target: -1, route: { repeat: false, skippable: false,
        steps: [{ kind: "step-up", parameters: [] }, { kind: "end", parameters: [] }] } }),
      command("move-route-continuation", 0, { step: { kind: "step-up", parameters: [] } }),
      command("wait-for-movement", 0), command("text-options", 0), command("scroll-map", 0), command("fade-music", 0),
      command("show-text", 0, { text: "Suite" }), command("end", 0),
    ]), [], createSourceEventState(), 2, 17);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual([
      "runtime-noop", "transfer-player", "change-map-settings", "move-route", "move-route-continuation",
      "wait-for-movement", "text-options", "scroll-map", "fade-music", "show-text", "end",
    ]);
  });

  it.each(["pbCaveEntrance", "pbCaveExit", "Kernel.pbCaveEntrance"])(
    "keeps a cave threshold sequence executable for %s",
    (hook) => {
      const result = resolveEventFlow(page([
        command("screen-tone", 0, { tone: { red: 255, green: 255, blue: 255, gray: 255 }, duration: 6 }),
        command("wait", 0, { frames: 8 }),
        command("ruby-script", 0, { source: hook }),
        command("transfer-player", 0, { addressing: "direct", map: 16, x: 6, y: 45, direction: 0, fade: 1 }),
        command("screen-tone", 0, { tone: { red: 0, green: 0, blue: 0, gray: 0 }, duration: 6 }),
        command("end", 0),
      ]), [], createSourceEventState(), 52, 1);

      expect(result).toMatchObject({ complete: true, blockedReason: null });
      expect(result.page.commands).toEqual([
        expect.objectContaining({ kind: "screen-tone" }),
        expect.objectContaining({ kind: "wait" }),
        expect.objectContaining({ kind: "runtime-noop",
          data: expect.objectContaining({ policy: "CAVE_TRANSITION_PRESENTATION" }) }),
        expect.objectContaining({ kind: "transfer-player",
          data: expect.objectContaining({ map: 16, x: 6, y: 45 }) }),
        expect.objectContaining({ kind: "screen-tone" }),
        expect.objectContaining({ kind: "end" }),
      ]);
    },
  );

  it("joins split Ruby calls and absorbs dependent-follower presentation hooks", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "$PokemonTemp.dependentEvents.remove_sprite" }),
      command("ruby-script-continuation", 0, { source: "(true)" }),
      command("show-text", 0, { text: "Suite" }),
      command("ruby-script", 0, { source: "$PokemonTemp.dependentEvents.refresh_sprite" }),
    ]), [], createSourceEventState(), 5, 5);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual(["runtime-noop", "show-text", "runtime-noop"]);
  });

  it("turns a trainer-battle condition into a deferred sequence command", () => {
    const result = resolveEventFlow(page([
      command("condition", 0, { kind: "ruby-script",
        script: "pbTrainerBattle(PBTrainers::CRISANTO1,\"Crisanto\",_I(\"Perdu\"),false,2,true)" }),
      command("end", 1), command("else", 0), command("exit-event", 1), command("condition-end", 0),
    ]), [], createSourceEventState(), 3, 28);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([
      expect.objectContaining({ kind: "request-trainer-battle",
        data: expect.objectContaining({ trainerType: "CRISANTO1", trainerName: "Crisanto",
          defeatText: "Perdu", format: "single", version: 2, canLose: true }) }),
      expect.objectContaining({ kind: "end" }),
    ]);
  });

  it("ports an ordinary route trainer including its presentation hooks and trailing outcome argument", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbTrainerIntro(:CAMPESINO)" }),
      command("ruby-script", 0, { source: "Kernel.pbNoticePlayer(get_character(0))" }),
      command("show-text", 0, { text: "Bienvenue !" }),
      command("condition", 0, { kind: "ruby-script",
        script: "pbTrainerBattle(PBTrainers::CAMPESINO,\"Jean\",_I(\"Perdu\"),false,0,false,0)" }),
      command("set-self-switch", 1, { id: "A", value: true }), command("end", 1),
      command("condition-end", 0), command("ruby-script", 0, { source: "pbTrainerEnd" }), command("end", 0),
    ]), [], createSourceEventState(), 14, 22);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([
      expect.objectContaining({ kind: "runtime-noop", data: expect.objectContaining({ policy: "TRAINER_PRESENTATION" }) }),
      expect.objectContaining({ kind: "trainer-notice",
        data: expect.objectContaining({ animationId: 3, policy: "SHARED_PRESENTATION" }) }),
      expect.objectContaining({ kind: "show-text" }),
      expect.objectContaining({ kind: "request-trainer-battle",
        data: expect.objectContaining({ trainerType: "CAMPESINO", trainerName: "Jean",
          defeatText: "Perdu", format: "single", version: 0, canLose: false }) }),
      expect.objectContaining({ kind: "set-self-switch" }), expect.objectContaining({ kind: "end" }),
      expect.objectContaining({ kind: "runtime-noop", data: expect.objectContaining({ policy: "TRAINER_PRESENTATION" }) }),
      expect.objectContaining({ kind: "end" }),
    ]);
  });

  it("turns a multiline Pokemon Mart call into a shop command", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbPokemonMart([" }),
      command("ruby-script-continuation", 0, { source: ":POKEBALL,:POTION," }),
      command("ruby-script-continuation", 0, { source: ":ANTIDOTE])" }),
    ]), [], createSourceEventState(), 10, 5);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands).toEqual([expect.objectContaining({ kind: "open-shop",
      data: expect.objectContaining({ stock: ["POKEBALL", "POTION", "ANTIDOTE"] }) })]);
  });

  it("stops before an unsupported command without exposing later dialogue", () => {
    const result = resolveEventFlow(page([command("show-text", 0, { text: "Avant" }), command("ruby-script", 0),
      command("show-text", 0, { text: "Après" })]), [], createSourceEventState(), 3, 1);
    expect(result).toMatchObject({ complete: false, blockedReason: "commande ruby-script non prise en charge" });
    expect(result.page.commands.map((entry) => entry.text)).toEqual(["Avant"]);
  });
});
