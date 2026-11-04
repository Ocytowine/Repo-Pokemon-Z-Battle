import { afterEach, describe, expect, it, vi } from "vitest";
import { createSourceAudio, pauseSourceAudio, playSourceAudio, setSourceAudioActive }
  from "../src/source-audio-lifecycle.js";

class FakeAudio {
  public loop = false;
  public paused = true;
  public ended = false;
  public plays = 0;
  public pauses = 0;
  public constructor(public readonly src = "") {}
  public addEventListener(): void {}
  public play(): Promise<void> { this.plays += 1; this.paused = false; return Promise.resolve(); }
  public pause(): void { this.pauses += 1; this.paused = true; }
}

afterEach(() => { setSourceAudioActive(true); vi.unstubAllGlobals(); });

describe("audio foreground lifecycle", () => {
  it("resumes the active music at its position, but leaves one-shot effects stopped", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    const music = createSourceAudio("map.ogg") as unknown as FakeAudio;
    music.loop = true;
    const effect = createSourceAudio("cry.ogg") as unknown as FakeAudio;
    await Promise.all([playSourceAudio(music as unknown as HTMLAudioElement),
      playSourceAudio(effect as unknown as HTMLAudioElement)]);
    setSourceAudioActive(false);
    expect(music.paused).toBe(true);
    expect(effect.paused).toBe(true);
    setSourceAudioActive(true);
    await Promise.resolve();
    expect(music.plays).toBe(2);
    expect(effect.plays).toBe(1);
    pauseSourceAudio(music as unknown as HTMLAudioElement);
  });

  it("does not revive a track explicitly stopped while backgrounded", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    const oldTrack = createSourceAudio("map.ogg") as unknown as FakeAudio;
    oldTrack.loop = true;
    await playSourceAudio(oldTrack as unknown as HTMLAudioElement);
    setSourceAudioActive(false);
    pauseSourceAudio(oldTrack as unknown as HTMLAudioElement);
    const nextTrack = createSourceAudio("battle.ogg") as unknown as FakeAudio;
    nextTrack.loop = true;
    await playSourceAudio(nextTrack as unknown as HTMLAudioElement);
    setSourceAudioActive(true);
    await Promise.resolve();
    expect(oldTrack.plays).toBe(1);
    expect(nextTrack.plays).toBe(1);
    pauseSourceAudio(nextTrack as unknown as HTMLAudioElement);
  });
});
