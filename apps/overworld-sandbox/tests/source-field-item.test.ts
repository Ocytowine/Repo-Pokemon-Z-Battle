import { describe, expect, it } from "vitest";
import { createSourceEventState } from "../src/source-event-state.js";
import { useSourceFieldItem } from "../src/source-field-item.js";

describe("Pokemon Z location-sensitive field items", () => {
  it("activates Malvo's Talisman only at the exact source location without consuming it", () => {
    const state = { ...createSourceEventState(), inventory: { TALISMANMALVO: 1 } };
    expect(useSourceFieldItem(state, "TALISMANMALVO", "Talisman de Malvo",
      { mapId: 190, x: 74, y: 24 })).toMatchObject({ ok: true, state, sharedWorldChanged: false });
    const opened = useSourceFieldItem(state, "TALISMANMALVO", "Talisman de Malvo",
      { mapId: 190, x: 74, y: 25 });
    expect(opened).toMatchObject({ ok: true, sharedWorldChanged: true,
      state: { inventory: { TALISMANMALVO: 1 }, switches: { "412": true } } });
  });
});
