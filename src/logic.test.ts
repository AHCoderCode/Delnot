import { describe, expect, it } from "vitest";
import { formatTime, medalForTime, normalizeSave, normalizeSettings, parseSave, progressBetween } from "./logic";

describe("time and route calculations", () => {
  it("formats run time to centiseconds", () => {
    expect(formatTime(0)).toBe("00:00.00");
    expect(formatTime(61523)).toBe("01:01.52");
    expect(formatTime(-100)).toBe("00:00.00");
  });
  it("clamps route progress to the course", () => {
    expect(progressBetween(10, 10, -90)).toBe(0);
    expect(progressBetween(-40, 10, -90)).toBe(0.5);
    expect(progressBetween(-100, 10, -90)).toBe(1);
    expect(progressBetween(0, 0, 0)).toBe(0);
  });
  it("awards medals from elapsed time rather than a fabricated score", () => {
    expect(medalForTime(30000, 60000, 90000)).toBe("PLATINUM");
    expect(medalForTime(50000, 60000, 90000)).toBe("GOLD");
    expect(medalForTime(80000, 60000, 90000)).toBe("SILVER");
    expect(medalForTime(100000, 60000, 90000)).toBe("BRONZE");
  });
});

describe("safe local persistence", () => {
  it("uses safe defaults for damaged save data", () => {
    expect(parseSave("{broken").unlocked).toEqual(["lab"]);
    expect(normalizeSave(null).version).toBe(1);
  });
  it("filters invalid courses and unsafe timing values", () => {
    const save = normalizeSave({ unlocked: ["lab", "script", "heights"], best: { lab: 12000, heights: -5, descent: Infinity }, collected: ["lab:one", 5] });
    expect(save.unlocked).toEqual(["lab", "heights"]);
    expect(save.best).toEqual({ lab: 12000 });
    expect(save.collected).toEqual(["lab:one"]);
  });
  it("clamps settings to supported ranges", () => {
    const settings = normalizeSettings({ sensitivity: 99, fov: 10, quality: "ultra", masterVolume: -2, cameraEffects: false });
    expect(settings.sensitivity).toBe(2.5);
    expect(settings.fov).toBe(65);
    expect(settings.masterVolume).toBe(0);
    expect(settings.quality).toBe("ultra");
    expect(settings.cameraEffects).toBe(false);
  });
});
