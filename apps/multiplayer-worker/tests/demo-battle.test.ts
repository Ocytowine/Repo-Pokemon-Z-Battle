import { describe, expect, it } from "vitest";
import { createDemoBattle } from "../src/demo-battle.js";

describe("overworld encounter battles", () => {
  it("builds distinct minimal wild and trainer encounters", () => {
    const wild = createDemoBattle({ kind: "wild" });
    const trainer = createDemoBattle({ kind: "trainer" });
    expect(wild.teams.player.members).toHaveLength(1);
    expect(wild.teams.opponent.members[0]).toMatchObject({ species: "PIDGEY", name: "Roucool sauvage" });
    expect(trainer.teams.player.members).toHaveLength(1);
    expect(trainer.teams.opponent.members[0]).toMatchObject({ species: "CHARMANDER", name: "Salamèche de Lina" });
  });
});
