import { describe, expect, it } from "vitest";
import { formatTime, medalForTime, normalizeJoystick, normalizeSave, normalizeSettings, parseSave, progressBetween } from "./logic";

describe("mobile joystick input", () => {
  it("normalizes movement inside the stick radius", () => {
    expect(normalizeJoystick(25, 0, 50)).toEqual({ x: 0.5, y: 0 });
    expect(normalizeJoystick(0, -25, 50)).toEqual({ x: 0, y: -0.5 });
  });
  it("clamps diagonal input and filters stick drift", () => {
    const diagonal = normalizeJoystick(100, 100, 50);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(normalizeJoystick(2, -3, 50)).toEqual({ x: 0, y: 0 });
    expect(normalizeJoystick(NaN, 2, 50)).toEqual({ x: 0, y: 0 });
  });
});

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
    expect(parseSave("{broken").unlocked).toEqual(["line"]);
    expect(normalizeSave(null).version).toBe(1);
  });
  it("filters invalid courses and unsafe timing values", () => {
    const save = normalizeSave({ unlocked: ["line", "script", "heights"], best: { line: 12000, lab: 33000 }, collected: ["line:one", 5] });
    expect(save.unlocked).toEqual(["line"]);
    expect(save.best).toEqual({ line: 12000 });
    expect(save.collected).toEqual(["line:one"]);
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
