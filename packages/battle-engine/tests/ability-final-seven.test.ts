import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, applyIllusion, applyStanceChange, calculateDamage,
  createTeamBattleState, reconcileAbilityForm, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";

const zero: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 120, specialAttack: 80, specialDefense: 140,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null,
    appearance: { form: 0, shiny: false, gender: null },
    moves: [{ move: { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 }, pp: 35 }], ...overrides };
}

describe("the final seven Pokemon Z abilities", () => {
  it("reconciles Greninja, Darmanitan and Arceus forms from their distinct sources", () => {
    const greninja = pokemon("greninja", "player", { species: "GRENINJA", ability: "FORMAILUSORIA",
      hp: 134, types: ["WATER", "PSYCHIC"] });
    expect(reconcileAbilityForm(greninja, "player", null).battler.appearance?.form).toBe(1);
    expect(reconcileAbilityForm({ ...greninja, hp: 133 }, "player", null).battler.appearance?.form).toBe(0);

    const darmanitan = pokemon("darmanitan", "player", { species: "DARMANITAN", ability: "ZENMODE",
      hp: 100, types: ["FIRE"] });
    expect(reconcileAbilityForm(darmanitan, "player", null).battler).toMatchObject({
      types: ["FIRE", "ICE"], appearance: { form: 1 },
    });

    const arceus = pokemon("arceus", "player", { species: "ARCEUS", ability: "MULTITYPE",
      heldItem: "FLAMEPLATE" });
    expect(reconcileAbilityForm(arceus, "player", null).battler).toMatchObject({
      types: ["FIRE"], appearance: { form: 10 },
    });
  });

  it("changes Aegislash stance before a damaging move and restores its defensive statistics", () => {
    const shield = pokemon("aegislash", "player", { species: "AEGISLASH", ability: "STANCECHANGE",
      stats: { maxHp: 200, attack: 50, defense: 140, specialAttack: 50, specialDefense: 140, speed: 60 } });
    const blade = applyStanceChange(shield, "player", MINIMAL_MOVE_CATALOG.TACKLE).battler;
    expect(blade).toMatchObject({ appearance: { form: 1 },
      stats: { attack: 140, defense: 50, specialAttack: 140, specialDefense: 50 } });
    const kingsShield: BattleMove = { ...MINIMAL_MOVE_CATALOG.PROTECT,
      internalName: "KINGSSHIELD", name: "Bouclier Royal", category: "Status" };
    expect(applyStanceChange(blade, "player", kingsShield).battler).toMatchObject({
      appearance: { form: 0 }, stats: { attack: 50, defense: 140, specialAttack: 50, specialDefense: 140 },
    });
  });

  it("keeps Illusion visual-only and reveals the real battler after direct damage", () => {
    const zoroark = pokemon("zoroark", "player", { species: "ZOROARK", ability: "ILLUSION",
      types: ["DARK"] });
    const decoy = pokemon("pikachu", "player", { species: "PIKACHU", name: "Pika",
      appearance: { form: 2, shiny: true, gender: "female" } });
    const disguised = applyIllusion({ activeIndex: 0, members: [zoroark, decoy] }, 0).members[0]!;
    expect(disguised).toMatchObject({ species: "ZOROARK", types: ["DARK"],
      illusion: { species: "PIKACHU", name: "Pika", types: ["NORMAL"], form: 2,
        shiny: true, gender: "female" } });
    const state = createTeamBattleState({ player: [zoroark, decoy], opponent: [pokemon("foe", "opponent")] });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "move", moveIndex: 0 } }, zero);
    expect(result.state.teams.player.members[0]!.illusion).toBeUndefined();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "ILLUSION" }));

    const suppressed = createTeamBattleState({ player: [zoroark, decoy],
      opponent: [pokemon("gas", "opponent", { ability: "NEUTRALIZINGGAS" })] });
    expect(suppressed.teams.player.members[0]!.illusion).toBeUndefined();
  });

  it("suppresses another active ability while Neutralizing Gas is present", () => {
    const fire: BattleMove = { ...MINIMAL_MOVE_CATALOG.WATERGUN, internalName: "EMBER", name: "Flammèche",
      type: "FIRE", power: 60, accuracy: 0 };
    const attacker = pokemon("blaze", "player", { ability: "BLAZE", types: ["FIRE"], hp: 50,
      moves: [{ move: fire, pp: 10 }] });
    const damage = (ability: BattlerState["ability"]) => {
      const result = resolveTeamTurn(createTeamBattleState({ player: [attacker],
        opponent: [pokemon("target", "opponent", { ability })] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
      return result.events.find((event) => event.type === "damageApplied")?.amount ?? 0;
    };
    expect(damage("NEUTRALIZINGGAS")).toBeLessThan(damage(null));

    const finisher = pokemon("moxie", "player", { ability: "MOXIE",
      moves: [{ move: { ...MINIMAL_MOVE_CATALOG.TACKLE, power: 500, accuracy: 0 }, pp: 10 }] });
    const knockout = resolveTeamTurn(createTeamBattleState({ player: [finisher],
      opponent: [pokemon("gas", "opponent", { ability: "NEUTRALIZINGGAS", hp: 1 })] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, zero);
    expect(knockout.state.teams.player.members[0]!.stages.attack).toBe(1);
  });

  it("applies Forme Illusoire's source evasion threshold and a Plate's matching type boost", () => {
    const accurate: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 100 };
    const attacker = pokemon("attacker", "player", { moves: [{ move: accurate, pp: 10 }] });
    const target = pokemon("greninja", "opponent", { species: "GRENINJA", ability: "FORMAILUSORIA",
      hp: 151 });
    const roll70: RandomSource = { nextInt: (maximum) => maximum === 100 ? 70 : 0 };
    const missed = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, roll70);
    expect(missed.events).toContainEqual(expect.objectContaining({ type: "moveMissed", side: "player" }));

    const fire: BattleMove = { ...MINIMAL_MOVE_CATALOG.WATERGUN, type: "FIRE", power: 60 };
    const normal = calculateDamage("player", pokemon("arceus", "player", { types: ["FIRE"] }),
      pokemon("target", "opponent"), fire, zero, []);
    const plated = calculateDamage("player", pokemon("arceus", "player", {
      types: ["FIRE"], ability: "MULTITYPE", heldItem: "FLAMEPLATE" }),
    pokemon("target", "opponent"), fire, zero, []);
    expect(plated).toBeGreaterThan(normal);
  });
});

