import { describe, expect, it, vi } from "vitest";
import { addPokemonToParty, createEmptyPlayerParty, createPersistentPokemon, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import {
  SourceBattleController,
  type SourceBattleCallbacks,
  type SourceBattlePresentation,
  type SourceBattleResources,
} from "../src/source-battle-controller.js";
import { createSourceEventState, type SourceEventState } from "../src/source-event-state.js";

const tackle = { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
  category: "Physical" as const, accuracy: 100, pp: 35, priority: 0, effectChance: 0 };
const catalog: PlayerCreationCatalog = {
  pokemon: [
    { internalName: "CHESPIN", name: "Marisson", types: ["GRASS"],
      baseStats: { hp: 61, attack: 61, defense: 65, speed: 38, specialAttack: 48, specialDefense: 45 },
      abilities: ["OVERGROW"], growthRate: "Parabolic", baseExperience: 64, levelUpMoves: [{ level: 1, move: "TACKLE" }] },
    { internalName: "BIDOOF", name: "Keunotor", types: ["NORMAL"],
      baseStats: { hp: 59, attack: 45, defense: 40, speed: 31, specialAttack: 35, specialDefense: 40 },
      abilities: ["SIMPLE"], growthRate: "Medium", baseExperience: 50, levelUpMoves: [{ level: 1, move: "TACKLE" }] },
  ],
  moves: [tackle],
};

function presentation(): SourceBattlePresentation {
  return {
    startBattle: vi.fn(async () => {}),
    playTurn: vi.fn(async () => {}),
    endBattle: vi.fn(),
    render: vi.fn(async () => {}),
  };
}

describe("source battle controller", () => {
  it("starts, renders and escapes a pending wild encounter", async () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    let eventState: SourceEventState = {
      ...createSourceEventState(),
      party,
      pendingEncounter: { species: "BIDOOF", level: 2, victorySwitches: {}, escapable: true },
      wildEncounterSteps: 8,
    };
    const resources: SourceBattleResources = {
      catalog,
      battleback: "grass",
      battleMusic: "wild.ogg",
      victoryMusic: "victory.ogg",
    };
    const visuals = presentation();
    const notices: string[] = [];
    const callbacks: SourceBattleCallbacks = {
      getEventState: () => eventState,
      updateEventState: vi.fn((nextState) => { eventState = nextState; }),
      getResources: () => resources,
      setNotice: (notice) => { notices.push(notice); },
      render: vi.fn(),
    };
    const controller = new SourceBattleController(visuals, callbacks);

    controller.startPendingEncounter();

    expect(controller.active).toBe(true);
    expect(controller.current?.teams.opponent.members[0]).toMatchObject({ species: "BIDOOF", level: 2 });
    expect(visuals.startBattle).toHaveBeenCalledWith(controller.current,
      { battleMusic: "wild.ogg", victoryMusic: "victory.ogg" });
    controller.renderVisuals();
    expect(visuals.render).toHaveBeenCalledWith(controller.current, "grass");

    await controller.escape();

    expect(controller.active).toBe(false);
    expect(controller.animating).toBe(false);
    expect(eventState.pendingEncounter).toBeNull();
    expect(eventState.wildEncounterSteps).toBe(0);
    expect(callbacks.updateEventState).toHaveBeenCalledOnce();
    expect(visuals.endBattle).toHaveBeenCalledWith(null);
    expect(notices.at(-1)).toContain("Fuite réussie");
  });

  it("does nothing when no encounter or battle resources are available", () => {
    let eventState = createSourceEventState();
    const visuals = presentation();
    const callbacks: SourceBattleCallbacks = {
      getEventState: () => eventState,
      updateEventState: (nextState) => { eventState = nextState; },
      getResources: () => null,
      setNotice: vi.fn(),
      render: vi.fn(),
    };
    const controller = new SourceBattleController(visuals, callbacks);

    controller.startPendingEncounter();

    expect(controller.active).toBe(false);
    expect(visuals.startBattle).not.toHaveBeenCalled();
    expect(callbacks.render).not.toHaveBeenCalled();
  });

  it("starts a non-escapable trainer battle and reports its result", async () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    let eventState: SourceEventState = { ...createSourceEventState(), party };
    const visuals = presentation();
    const callbacks: SourceBattleCallbacks = {
      getEventState: () => eventState,
      updateEventState: (nextState) => { eventState = nextState; },
      getResources: () => ({ catalog, battleback: "town", battleMusic: "wild.ogg", victoryMusic: "wild-win.ogg" }),
      setNotice: vi.fn(), render: vi.fn(),
    };
    const controller = new SourceBattleController(visuals, callbacks);
    const completed = vi.fn();
    expect(controller.startTrainerBattle({ trainerType: "CRISANTO1", name: "Crisanto", version: 1,
      pokemon: [{ species: "BIDOOF", level: 2, moves: [null, null, null, null] }] },
    { battleMusic: "Rival.ogg", victoryMusic: "Victoria.ogg" }, completed)).toBe(true);
    expect(controller.current?.teams.opponent.members[0]).toMatchObject({ species: "BIDOOF", level: 2 });
    expect(visuals.startBattle).toHaveBeenCalledWith(controller.current,
      { battleMusic: "Rival.ogg", victoryMusic: "Victoria.ogg" });
    for (let turn = 0; turn < 20 && controller.active; turn += 1) await controller.submitAction(0);
    expect(controller.active).toBe(false);
    expect(completed).toHaveBeenCalledWith(true);
    expect(eventState.pendingEncounter).toBeNull();
  });
});
