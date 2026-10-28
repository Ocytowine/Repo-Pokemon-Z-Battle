import { describe, expect, it } from "vitest";
import { resolveSourceAndroidUpdate } from "../src/source-android-update.js";

const candidate = { versionCode: 3, versionName: "0.3.0", notes: "Corrections et améliorations.",
  sizeBytes: 800_000_000, sha256: "a".repeat(64),
  downloadUrl: "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev/api/updates/download/3" };

describe("Android update offer", () => {
  it("offers only a strictly newer signed package version", () => {
    expect(resolveSourceAndroidUpdate(candidate, 2)).toEqual({ state: "available", update: candidate });
    expect(resolveSourceAndroidUpdate(candidate, 3)).toEqual({ state: "current" });
  });

  it("rejects a download link outside the private Access Worker", () => {
    expect(resolveSourceAndroidUpdate({ ...candidate,
      downloadUrl: "https://example.com/untrusted.apk" }, 2)).toEqual({ state: "unavailable" });
  });
});
