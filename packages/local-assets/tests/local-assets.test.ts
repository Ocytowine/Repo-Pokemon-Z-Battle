import { describe, expect, it, vi } from "vitest";
import { buildBattleScenes, createHttpDirectoryHandle, fileFromLocalPath, resolvePokemonAsset, selectBattleSceneVisuals,
  resolvePokemonSummaryAssets, selectBattler, type AssetManifest, type PokemonAssetRecord } from "../src/index.js";

describe("local asset helpers", () => {
  it("groups battleback triplets and reports incomplete scenes", () => {
    const entry = (path: string) => ({ path: `Graphics/Battlebacks/${path}.png`, category: "graphics/battlebacks", mediaType: "image" as const, image: null });
    const manifest: AssetManifest = { schemaVersion: "1", records: [entry("battlebgField"), entry("playerbaseField"), entry("enemybaseField"), entry("battlebgCave")] };
    expect(buildBattleScenes(manifest).map((scene) => [scene.id, scene.complete])).toEqual([["field", true], ["cave", false]]);
  });

  it("uses a wide Z background with the complete base scene's original bases", () => {
    const entry = (path: string, width: number, height: number) => ({ path: `Graphics/Battlebacks/${path}.png`,
      category: "graphics/battlebacks", mediaType: "image" as const,
      image: { width, height, animation: null } });
    const scenes = buildBattleScenes({ schemaVersion: "1", records: [
      entry("battlebgBosque", 512, 384), entry("playerbaseBosque", 512, 384), entry("enemybaseBosque", 512, 384),
      entry("battlebgBosqueZ", 2400, 1080),
      entry("battlebgPradera", 512, 384), entry("playerbasePradera", 512, 384), entry("enemybasePradera", 512, 384),
      entry("battlebgPraderaZ", 2400, 1080),
    ] });
    expect(selectBattleSceneVisuals(scenes, "Bosque")).toMatchObject({ scene: { id: "bosque", complete: true },
      background: { path: "Graphics/Battlebacks/battlebgBosqueZ.png" }, wide: true });
    expect(selectBattleSceneVisuals(scenes, "BosqueZ").scene?.playerBase?.path)
      .toBe("Graphics/Battlebacks/playerbaseBosque.png");
    expect(selectBattleSceneVisuals(scenes, "Pradera")).toMatchObject({ scene: { id: "pradera", complete: true },
      background: { path: "Graphics/Battlebacks/battlebgPraderaZ.png" }, wide: true });
    expect(selectBattleSceneVisuals(scenes, "Bosque", () => false)).toMatchObject({
      background: { path: "Graphics/Battlebacks/battlebgBosque.png" }, wide: false });
  });

  it("uses wide backgrounds when the legacy battlebg files were archived", () => {
    const entry = (path: string) => ({ path: `Graphics/Battlebacks/${path}.png`,
      category: "graphics/battlebacks", mediaType: "image" as const,
      image: { width: 2400, height: 1080, animation: null } });
    const scenes = buildBattleScenes({ schemaVersion: "1", records: [
      entry("battlebgBosqueZ"), entry("playerbaseBosque"), entry("enemybaseBosque"),
      entry("battlebgNightSkyZ"),
    ] });
    expect(selectBattleSceneVisuals(scenes, "Bosque")).toMatchObject({ scene: { id: "bosque", complete: true },
      background: { path: "Graphics/Battlebacks/battlebgBosqueZ.png" }, wide: true });
    expect(selectBattleSceneVisuals(scenes, "NightSky")).toMatchObject({ scene: { id: "nightsky", complete: false },
      background: { path: "Graphics/Battlebacks/battlebgNightSkyZ.png" }, wide: true });
  });

  it("keeps an archived background for scenes without a Z replacement", () => {
    const entry = (path: string, category = "graphics/battlebacks") => ({ path, category,
      mediaType: "image" as const, image: { width: 512, height: 384, animation: null } });
    const scenes = buildBattleScenes({ schemaVersion: "1", records: [
      entry("Graphics/Battlebacks/OLD/battlebgMirra.png", "graphics/battlebacks/old"),
      entry("Graphics/Battlebacks/playerbaseMirra.png"), entry("Graphics/Battlebacks/enemybaseMirra.png"),
    ] });
    expect(selectBattleSceneVisuals(scenes, "Mirra")).toMatchObject({ scene: { id: "mirra", complete: true },
      background: { path: "Graphics/Battlebacks/OLD/battlebgMirra.png" }, wide: false });
  });

  it("uses the archived background offline and a retained wide background when no legacy exists", () => {
    const entry = (path: string, width: number, height: number) => ({ path,
      category: path.includes("/OLD/") ? "graphics/battlebacks/old" : "graphics/battlebacks",
      mediaType: "image" as const, image: { width, height, animation: null } });
    const scenes = buildBattleScenes({ schemaVersion: "1", records: [
      entry("Graphics/Battlebacks/OLD/battlebgBosque.png", 512, 384),
      entry("Graphics/Battlebacks/playerbaseBosque.png", 512, 384),
      entry("Graphics/Battlebacks/enemybaseBosque.png", 512, 384),
      entry("Graphics/Battlebacks/battlebgBosqueZ.png", 2400, 1080),
      entry("Graphics/Battlebacks/battlebgCorazonArmaZ.png", 2400, 1080),
      entry("Graphics/Battlebacks/playerbaseCorazonArma.png", 512, 384),
      entry("Graphics/Battlebacks/enemybaseCorazonArma.png", 512, 384),
    ] });
    const available = (background: { path: string }) => background.path.endsWith("CorazonArmaZ.png");
    expect(selectBattleSceneVisuals(scenes, "Bosque", available)).toMatchObject({
      background: { path: "Graphics/Battlebacks/OLD/battlebgBosque.png" }, wide: false });
    expect(selectBattleSceneVisuals(scenes, "CorazonArma", available)).toMatchObject({
      background: { path: "Graphics/Battlebacks/battlebgCorazonArmaZ.png" }, wide: true });
  });

  it("selects the neutral requested battler first", () => {
    const base = { pokemonId: 25, kind: "battler" as const, form: null, shiny: false, female: false, variant: null, width: 96, height: 96, frameCount: 1 };
    const front = { ...base, back: false, path: "front.png" };
    const back = { ...base, back: true, path: "back.png" };
    const record = { id: 25, internalName: "PIKACHU", name: "Pikachu", assets: { battler: [front, back], icon: [], footprint: [], cry: [], overworld: [] } } satisfies PokemonAssetRecord;
    expect(selectBattler(record, true)?.path).toBe("back.png");
    expect(selectBattler(record, false)?.path).toBe("front.png");
  });

  it("resolves form, shiny, gender and back variants with explicit fallbacks", () => {
    const base = { pokemonId: 25, kind: "battler" as const, form: null, shiny: false, female: false,
      back: false, variant: null, width: 96, height: 96, frameCount: 1 };
    const record = { id: 25, internalName: "PIKACHU", name: "Pikachu", assets: { battler: [
      { ...base, path: "default.png" }, { ...base, form: 1, shiny: true, female: true, back: true, path: "exact.png" },
      { ...base, form: 1, back: true, path: "form-back.png" },
    ], icon: [], footprint: [], cry: [], overworld: [] } } satisfies PokemonAssetRecord;
    expect(resolvePokemonAsset(record, { kind: "battler", form: 1, shiny: true, female: true, back: true }))
      .toEqual({ asset: expect.objectContaining({ path: "exact.png" }), fallbacks: [] });
    expect(resolvePokemonAsset(record, { kind: "battler", form: 2, shiny: true, female: true, back: true }))
      .toMatchObject({ asset: { path: "exact.png" }, fallbacks: ["form"] });
  });

  it("indexes every fixed source summary asset and available ball", () => {
    const entry = (path: string) => ({ path, category: "graphics/pictures", mediaType: "image" as const, image: null });
    const assets = resolvePokemonSummaryAssets({ schemaVersion: "1", records: [entry("Graphics/Pictures/category.png"),
      entry("Graphics/Pictures/ribbons.png"), entry("Graphics/Pictures/shiny.png"), entry("Graphics/Pictures/statuses.PNG"),
      entry("Graphics/Pictures/summaryPokerus.png"), entry("Graphics/Pictures/summaryball00.png"),
      entry("Graphics/Pictures/summaryball23.png")] });
    expect(assets).toMatchObject({ category: "Graphics/Pictures/category.png", ribbons: "Graphics/Pictures/ribbons.png",
      shiny: "Graphics/Pictures/shiny.png", statuses: "Graphics/Pictures/statuses.PNG",
      pokerus: "Graphics/Pictures/summaryPokerus.png" });
    expect([...assets.balls]).toEqual([[0, "Graphics/Pictures/summaryball00.png"], [23, "Graphics/Pictures/summaryball23.png"]]);
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
