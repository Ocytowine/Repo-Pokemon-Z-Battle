import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifyPokemonAsset, normalizedWebPath } from "../src/assets/classify-assets.js";
import { readImageDimensions } from "../src/assets/image-metadata.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("Pokemon asset conventions", () => {
  it("classifies battler flags and forms in their historical order", () => {
    expect(classifyPokemonAsset("Graphics/Battlers/003fsb_2.png")).toEqual({
      pokemonId: 3,
      kind: "battler",
      form: 2,
      shiny: true,
      female: true,
      back: true,
      variant: null,
    });
    expect(classifyPokemonAsset("Graphics/Battlers/658sfb_1.png")).toMatchObject({
      pokemonId: 658, shiny: true, female: true, back: true, form: 1,
    });
  });

  it("keeps named and alternate cry variants", () => {
    expect(classifyPokemonAsset("Graphics/Icons/icon070_shadow.png")).toMatchObject({
      pokemonId: 70, kind: "icon", variant: "shadow",
    });
    expect(classifyPokemonAsset("Graphics/Battlers/490egg.png")).toMatchObject({
      pokemonId: 490, kind: "battler", variant: "egg",
    });
    expect(classifyPokemonAsset("Audio/SE/Cries/637_3Cry.ogg")).toMatchObject({
      pokemonId: 637, kind: "cry", form: 3,
    });
    expect(classifyPokemonAsset("Audio/SE/Cries/1005.ogg")).toMatchObject({
      pokemonId: 1005, kind: "cry", form: null,
    });
  });

  it("associates icons, footprints, cries and overworld sprites", () => {
    expect(classifyPokemonAsset("Graphics/Icons/icon025s_1.png")).toMatchObject({
      pokemonId: 25, kind: "icon", shiny: true, form: 1,
    });
    expect(classifyPokemonAsset("Graphics/Icons/Footprints/footprint025.png")).toMatchObject({
      pokemonId: 25, kind: "footprint",
    });
    expect(classifyPokemonAsset("Audio/SE/Cries/025Cry_2.ogg")).toMatchObject({
      pokemonId: 25, kind: "cry", form: 2,
    });
    expect(classifyPokemonAsset("Graphics/Characters/025s.png")).toMatchObject({
      pokemonId: 25, kind: "overworld", shiny: true,
    });
  });

  it("normalizes a portable web lookup path without changing accents", () => {
    expect(normalizedWebPath("Graphics\\Pictures\\Écran.PNG"))
      .toBe("graphics/pictures/écran.png");
  });
});

describe("image metadata", () => {
  it("reads PNG dimensions without decoding pixels", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-image-"));
    temporaryDirectories.push(directory);
    const file = path.join(directory, "strip.png");
    const bytes = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(bytes, 0);
    bytes.writeUInt32BE(1152, 16);
    bytes.writeUInt32BE(96, 20);
    await writeFile(file, bytes);
    await expect(readImageDimensions(file)).resolves.toEqual({ width: 1152, height: 96 });
  });
});
