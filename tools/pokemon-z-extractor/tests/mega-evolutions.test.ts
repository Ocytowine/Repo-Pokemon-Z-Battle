import { describe, expect, it } from "vitest";
import { parseMegaEvolutions } from "../src/runtime/extract-mega-evolutions.js";

describe("mega evolution extraction", () => {
  it("extracts every held-item branch, including alternate mega forms", () => {
    const records = parseMegaEvolutions(`
      MultipleForms.register(:CHARIZARD,{
      "getMegaForm"=>proc{|pokemon|
        next 1 if isConst?(pokemon.item,PBItems,:CHARIZARDITEX)
        next 2 if isConst?(pokemon.item,PBItems,:CHARIZARDITEY)
        next
      },
      "getBaseStats"=>proc{|pokemon|
        next [78,130,111,100,130,85] if pokemon.form==1
        next [78,104,78,100,159,115] if pokemon.form==2
      },
      "getAbilityList"=>proc{|pokemon|
        next [[getID(PBAbilities,:TOUGHCLAWS),0]] if pokemon.form==1
        next [[getID(PBAbilities,:DROUGHT),0]] if pokemon.form==2
      },
      "type2"=>proc{|pokemon|
        next getID(PBTypes,:DRAGON) if pokemon.form==1
      },
      "getUnmegaForm"=>proc{|pokemon| next 0 }
      })
      MultipleForms.register(:PIKACHU,{
      "getBaseStats"=>proc{|pokemon| next [1,2,3,4,5,6] }
      })
    `);

    expect(records).toEqual([
      { species: "CHARIZARD", heldItem: "CHARIZARDITEX", form: 1,
        baseStats: { hp: 78, attack: 130, defense: 111, speed: 100, specialAttack: 130, specialDefense: 85 },
        ability: "TOUGHCLAWS", type2: "DRAGON" },
      { species: "CHARIZARD", heldItem: "CHARIZARDITEY", form: 2,
        baseStats: { hp: 78, attack: 104, defense: 78, speed: 100, specialAttack: 159, specialDefense: 115 },
        ability: "DROUGHT" },
    ]);
  });

  it("refuses an empty or duplicated declarative catalogue", () => {
    expect(() => parseMegaEvolutions("MultipleForms.register(:EEVEE,{})"))
      .toThrow("Aucune Méga-Évolution");
    expect(() => parseMegaEvolutions(`
      MultipleForms.register(:EEVEE,{\n"getMegaForm"=>proc{|pokemon|\nnext 1 if isConst?(pokemon.item,PBItems,:EEVEELITE)\n},\n"getBaseStats"=>proc{|pokemon|\nnext [1,2,3,4,5,6] if pokemon.form==1\n},\n"getAbilityList"=>proc{|pokemon|\nnext [[getID(PBAbilities,:RUNAWAY),0]] if pokemon.form==1\n},\n})
      MultipleForms.register(:EEVEE,{\n"getMegaForm"=>proc{|pokemon|\nnext 2 if isConst?(pokemon.item,PBItems,:EEVEELITE)\n},\n"getBaseStats"=>proc{|pokemon|\nnext [1,2,3,4,5,6] if pokemon.form==2\n},\n"getAbilityList"=>proc{|pokemon|\nnext [[getID(PBAbilities,:RUNAWAY),0]] if pokemon.form==2\n},\n})
    `)).toThrow("dupliquée");
  });
});
