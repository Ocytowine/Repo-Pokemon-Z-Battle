/** Audio is local presentation state: it is never saved or replicated in Coop. */
const sounds = new Set<HTMLAudioElement>();
const resumeWhenActive = new Set<HTMLAudioElement>();
let active = true;

export function sourceAudioActive(): boolean { return active; }

export function createSourceAudio(url?: string): HTMLAudioElement {
  const audio = url === undefined ? new Audio() : new Audio(url);
  sounds.add(audio);
  audio.addEventListener("ended", () => {
    sounds.delete(audio);
    resumeWhenActive.delete(audio);
  });
  return audio;
}

export function playSourceAudio(audio: HTMLAudioElement): Promise<void> {
  sounds.add(audio);
  if (!active) {
    if (audio.loop) resumeWhenActive.add(audio);
    else sounds.delete(audio);
    return Promise.resolve();
  }
  return audio.play().then(() => {
    // Android can move the app to the background while a media promise resolves.
    if (!active) {
      if (audio.loop) resumeWhenActive.add(audio);
      audio.pause();
      if (!audio.loop) sounds.delete(audio);
    }
  }).catch((error: unknown) => {
    if (!audio.loop) sounds.delete(audio);
    throw error;
  });
}

/** An explicit stop must not revive a previous track when the app returns. */
export function pauseSourceAudio(audio: HTMLAudioElement | null): void {
  if (audio === null) return;
  resumeWhenActive.delete(audio);
  audio.pause();
  sounds.delete(audio);
}

export function setSourceAudioActive(nextActive: boolean): void {
  if (active === nextActive) return;
  active = nextActive;
  if (!active) {
    for (const audio of sounds) {
      if (audio.paused) continue;
      if (audio.loop) resumeWhenActive.add(audio);
      audio.pause();
      if (!audio.loop) sounds.delete(audio);
    }
    return;
  }
  resumeSourceAudioAfterGesture();
}

/** Retries a music resume when WebView requires a fresh user gesture. */
export function resumeSourceAudioAfterGesture(): void {
  if (!active) return;
  const pending = [...resumeWhenActive];
  resumeWhenActive.clear();
  for (const audio of pending) {
    if (!sounds.has(audio) || !audio.loop || audio.ended) continue;
    void playSourceAudio(audio).catch((error: unknown) => {
      if (active && sounds.has(audio) && error instanceof DOMException && error.name === "NotAllowedError") {
        resumeWhenActive.add(audio);
      }
    });
  }
}
