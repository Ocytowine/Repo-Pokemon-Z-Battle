import { describe, expect, it } from "vitest";
import { createSourceEventState, parseSourceEventState } from "../src/source-event-state.js";
import { activateSourceTypeAmulet, advanceSourceTypeAmulet, SOURCE_TYPE_AMULET_STEPS }
  from "../src/source-type-amulet.js";

describe("Pokemon Z type amulets", () => {
  it("consumes one amulet and persists its personal 500-step type effect", () => {
    const initial = { ...createSourceEventState(), inventory: { AMULETOFUEGO: 2 } };
    const activated = activateSourceTypeAmulet(initial, "AMULETOFUEGO", "Amulette Feu");
    expect(activated).toMatchObject({ ok: true, state: { inventory: { AMULETOFUEGO: 1 },
      typeAmulet: { itemId: "AMULETOFUEGO", type: "FIRE", stepsRemaining: SOURCE_TYPE_AMULET_STEPS } } });
    expect(parseSourceEventState(JSON.parse(JSON.stringify(activated.state))).typeAmulet)
      .toEqual({ itemId: "AMULETOFUEGO", type: "FIRE", stepsRemaining: 500 });
  });

  it("refuses to stack amulets and leaves both the Bag and active effect unchanged", () => {
    const active = activateSourceTypeAmulet({ ...createSourceEventState(),
      inventory: { AMULETOFUEGO: 1, AMULETOAGUA: 1 } }, "AMULETOFUEGO").state;
    const rejected = activateSourceTypeAmulet(active, "AMULETOAGUA");
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toBe(active);
    expect(rejected.state.inventory).toEqual({ AMULETOAGUA: 1 });
  });

  it("counts ordinary movement, ignores ice and expires after the final step", () => {
    const active = { ...createSourceEventState(), typeAmulet: {
      itemId: "AMULETOBICHO", type: "BUG", stepsRemaining: 2 } };
    expect(advanceSourceTypeAmulet(active, 12)).toEqual({ state: active, expired: false });
    const penultimate = advanceSourceTypeAmulet(active, 2);
    expect(penultimate).toMatchObject({ expired: false, state: { typeAmulet: { stepsRemaining: 1 } } });
    expect(advanceSourceTypeAmulet(penultimate.state, 2)).toMatchObject({
      expired: true, state: { typeAmulet: null },
    });
  });
});
