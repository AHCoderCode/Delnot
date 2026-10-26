import { describe, expect, it } from "vitest";
import { generateLongCourse, LONG_COURSE_LENGTH } from "./course";

describe("the single continuous parkour route", () => {
  it("generates one stable route longer than a short level", () => {
    const a = generateLongCourse();
    const b = generateLongCourse();
    expect(a.id).toBe("line");
    expect(a.finishZ).toBe(-18_000);
    expect(LONG_COURSE_LENGTH).toBe(18_000);
    expect(a.platforms.length).toBeGreaterThan(1_800);
    expect(a.platforms).toEqual(b.platforms);
    expect(a.walls.length).toBeGreaterThan(50);
  });

  it("places many checkpoints and increases the traversal demands over distance", () => {
    const course = generateLongCourse();
    expect(course.checkpoints.length).toBeGreaterThan(35);
    expect(course.checkpoints[0]!.z).toBeGreaterThan(course.checkpoints.at(-1)!.z);
    expect(Math.min(...course.platforms.map((p) => p.width))).toBeLessThan(3.4);
    expect(Math.max(...course.platforms.map((p) => p.width))).toBeGreaterThan(5.4);
    expect(course.obstacles.length).toBeGreaterThan(140);
  });
});
