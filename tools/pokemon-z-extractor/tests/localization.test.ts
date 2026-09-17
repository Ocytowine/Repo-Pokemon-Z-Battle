import { describe, expect, it } from "vitest";
import { selectLocalizedValue } from "../src/runtime/extract-localization.js";

describe("localization priority", () => {
  it("prefers french.dat, then messages.dat, then PBS", () => {
    expect(selectLocalizedValue("Français", "Source", "PBS")).toEqual({
      value: "Français",
      source: "french",
    });
    expect(selectLocalizedValue(null, "Source", "PBS")).toEqual({
      value: "Source",
      source: "messages",
    });
    expect(selectLocalizedValue(null, null, "PBS")).toEqual({
      value: "PBS",
      source: "pbs",
    });
    expect(selectLocalizedValue(null, null, null)).toBeNull();
  });

  it("keeps an intentional empty compiled translation", () => {
    expect(selectLocalizedValue("", "Source", "PBS")).toEqual({
      value: "",
      source: "french",
    });
  });
});
