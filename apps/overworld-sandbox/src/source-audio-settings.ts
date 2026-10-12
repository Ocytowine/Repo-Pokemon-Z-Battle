export type SourceAudioChannel = "music" | "effects" | "coopEffects";

export interface SourceAudioSettings {
  readonly music: number;
  readonly effects: number;
  readonly coopEffects: number;
}

const LEGACY_VOLUME_KEY = "pokemon-z-battle.options.volume.v1";
const AUDIO_KEYS: Readonly<Record<SourceAudioChannel, string>> = {
  music: "pokemon-z-battle.options.music-volume.v1",
  effects: "pokemon-z-battle.options.effects-volume.v1",
  coopEffects: "pokemon-z-battle.options.coop-effects-volume.v1",
};

function volume(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
}

/** Migrates the former global volume independently into each audio channel. */
export function sourceAudioSettings(storage: Pick<Storage, "getItem">): SourceAudioSettings {
  const legacy = volume(storage.getItem(LEGACY_VOLUME_KEY), 80);
  return {
    music: volume(storage.getItem(AUDIO_KEYS.music), legacy),
    effects: volume(storage.getItem(AUDIO_KEYS.effects), legacy),
    coopEffects: volume(storage.getItem(AUDIO_KEYS.coopEffects), legacy),
  };
}

export function persistSourceAudioChannel(storage: Pick<Storage, "setItem">,
  channel: SourceAudioChannel, value: number): number {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 80));
  storage.setItem(AUDIO_KEYS[channel], String(normalized));
  return normalized;
}
