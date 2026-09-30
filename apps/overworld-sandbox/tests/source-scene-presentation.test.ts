import { describe, expect, it } from "vitest";
import { parseSourceAnimation, parseSourceAudio, parseSourceMapVisual, parseSourcePicture, parseSourceScroll,
  parseSourceTextOptions, parseSourceTone, parseSourceWeather, selectSourceCryPath } from "../src/source-scene-presentation.js";

describe("source scene presentation parameters", () => {
  it("normalizes RPG Maker tones and frame durations", () => {
    expect(parseSourceTone({ tone: { red: -255, green: -300, blue: 20, gray: 12 }, duration: 10 })).toEqual({
      red: -255, green: -255, blue: 20, gray: 12, durationMs: 250,
    });
  });

  it("decodes show, move and erase picture commands", () => {
    expect(parseSourcePicture("show-picture", { parameters: [1, "crisantoNieve1", 0, 0, 12, 24, 100, 80, 255, 0] }))
      .toEqual({ id: 1, name: "crisantoNieve1", origin: "top-left", x: 12, y: 24,
        scaleX: 1, scaleY: 0.8, opacity: 1, blendMode: "normal", durationMs: 0 });
    expect(parseSourcePicture("move-picture", { parameters: [1, 10, 1, 0, 256, 192, 120, 120, 0, 1] }))
      .toMatchObject({ id: 1, name: null, origin: "center", x: 256, y: 192, scaleX: 1.2,
        scaleY: 1.2, opacity: 0, blendMode: "screen", durationMs: 250 });
    expect(parseSourcePicture("erase-picture", { parameters: [1] })).toMatchObject({ id: 1, name: null });
  });

  it("normalizes source audio volume and pitch", () => {
    expect(parseSourceAudio({ audio: { name: "Crisanto", volume: 80, pitch: 120 } }))
      .toEqual({ name: "Crisanto", volume: 0.8, pitch: 1.2 });
  });

  it("selects the default extracted cry for a species", () => {
    expect(selectSourceCryPath({ records: [{ internalName: "MRMIME", assets: { cry: [
      { path: "Audio/SE/Cries/122Cry_1.ogg", form: 1 },
      { path: "Audio/SE/Cries/122Cry.ogg", form: null },
    ] } }] }, "MRMIME")).toBe("Audio/SE/Cries/122Cry.ogg");
  });

  it("decodes panorama and moving fog settings", () => {
    expect(parseSourceMapVisual({ parameters: [0, "fondoAgua", 20] })).toEqual({
      kind: "panorama", name: "fondoAgua", hue: 20, opacity: 1, blendMode: "normal",
      zoom: 1, scrollX: 0, scrollY: 0,
    });
    expect(parseSourceMapVisual({ parameters: [1, "fogPrueba", 0, 120, 2, 200, 2, -2] })).toEqual({
      kind: "fog", name: "fogPrueba", hue: 0, opacity: 120 / 255, blendMode: "multiply",
      zoom: 2, scrollX: 2, scrollY: -2,
    });
    expect(parseSourceWeather({ parameters: [0, 5, 10] })).toEqual({ kind: "none", power: 5, durationMs: 250 });
    expect(parseSourceWeather({ parameters: [3, 9, 20] })).toEqual({ kind: "snow", power: 9, durationMs: 500 });
  });

  it("decodes concurrent camera scrolls using RPG Maker speeds", () => {
    expect(parseSourceScroll({ direction: 6, distance: 18, speed: 3 })).toEqual({
      direction: 6, distancePixels: 576, durationMs: 7_200,
    });
    expect(parseSourceScroll({ direction: 5, distance: 2, speed: 3 })).toBeNull();
  });

  it("decodes dialogue position, transparency and animation targets", () => {
    expect(parseSourceTextOptions({ parameters: [1, 1] })).toEqual({ position: "middle", transparent: true });
    expect(parseSourceTextOptions({ parameters: [2, 0] })).toEqual({ position: "bottom", transparent: false });
    expect(parseSourceAnimation({ parameters: [8, 2] })).toEqual({ target: 8, animationId: 2 });
  });
});
