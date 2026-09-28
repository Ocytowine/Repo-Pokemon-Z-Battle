import { describe, expect, it, vi } from "vitest";
import { buildBattleScenes, createHttpDirectoryHandle, fileFromLocalPath, selectBattler, type AssetManifest, type PokemonAssetRecord } from "../src/index.js";

describe("local asset helpers", () => {
  it("groups battleback triplets and reports incomplete scenes", () => {
    const entry = (path: string) => ({ path: `Graphics/Battlebacks/${path}.png`, category: "graphics/battlebacks", mediaType: "image" as const, image: null });
    const manifest: AssetManifest = { schemaVersion: "1", records: [entry("battlebgField"), entry("playerbaseField"), entry("enemybaseField"), entry("battlebgCave")] };
    expect(buildBattleScenes(manifest).map((scene) => [scene.id, scene.complete])).toEqual([["field", true], ["cave", false]]);
  });

  it("selects the neutral requested battler first", () => {
    const base = { pokemonId: 25, kind: "battler" as const, form: null, shiny: false, female: false, variant: null, width: 96, height: 96, frameCount: 1 };
    const front = { ...base, back: false, path: "front.png" };
    const back = { ...base, back: true, path: "back.png" };
    const record = { id: 25, internalName: "PIKACHU", name: "Pikachu", assets: { battler: [front, back], icon: [], footprint: [], cry: [], overworld: [] } } satisfies PokemonAssetRecord;
    expect(selectBattler(record, true)?.path).toBe("back.png");
    expect(selectBattler(record, false)?.path).toBe("front.png");
  });

  it("loads a nested asset from the local development endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["image"], { type: "image/png" }), { status: 200 }),
    );
    const file = await fileFromLocalPath(
      createHttpDirectoryHandle("/__pokemon-z/source"),
      "Graphics/Battlers/Pikachu face.png",
    );
    expect(fetchMock).toHaveBeenCalledWith("/__pokemon-z/source/Graphics/Battlers/Pikachu%20face.png");
    expect(file.name).toBe("Pikachu face.png");
    expect(file.type).toBe("image/png");
    fetchMock.mockRestore();
  });
});
