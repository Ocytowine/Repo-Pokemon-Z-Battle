import { describe, expect, it } from "vitest";
import type { ImportedEventPage } from "../src/imported-map.js";
import { resolveEventFlow } from "../src/source-event-flow.js";
import { createSourceEventState } from "../src/source-event-state.js";

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

  it("preserves mixed-case source item identifiers", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "Kernel.pbItemBall(PBItems::ACapsula)" }),
    ]), [], createSourceEventState(), 9, 40);
    expect(result.page.commands[0]).toMatchObject({ kind: "grant-item", data: { itemId: "ACapsula", quantity: 1 } });
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

  it("ports the source starter, follower and forced encounter sequence", () => {
    const result = resolveEventFlow(page([
      command("ruby-script", 0, { source: "pbAddPokemon(:CHESPIN,5)" }),
      command("ruby-script", 0, { source: "pbPokemonFollow(10)" }),
      command("ruby-script", 0, { source: "pbWildBattle(PBSpecies::BIDOOF,2)" }),
    ]), [], createSourceEventState(), 2, 9);
    expect(result).toMatchObject({ complete: true, blockedReason: null });
    expect(result.page.commands.map((entry) => entry.kind)).toEqual(["add-pokemon", "set-follower", "request-encounter"]);
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
