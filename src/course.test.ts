import {describe,expect,it} from "vitest";
import {COURSE_IDS} from "./logic";
import {LEVEL_DEFINITIONS,generateLevelCourse,levelDefinition} from "./course";
describe("three-chapter campaign",()=>{
it("contains exactly five levels per chapter with each fifth level a boss",()=>{expect(COURSE_IDS).toHaveLength(15);expect(LEVEL_DEFINITIONS).toHaveLength(15);for(const chapter of [1,2,3]){const l=LEVEL_DEFINITIONS.filter(v=>v.chapter===chapter);expect(l).toHaveLength(5);expect(l.map(v=>v.level)).toEqual([1,2,3,4,5]);expect(l[4]!.boss).toBe(true);expect(l.slice(0,4).every(v=>!v.boss)).toBe(true);}});
it("uses seven-minute normal and fourteen-minute boss design targets",()=>{expect(LEVEL_DEFINITIONS.filter(v=>!v.boss).every(v=>v.targetMinutes===7)).toBe(true);expect(LEVEL_DEFINITIONS.filter(v=>v.boss).every(v=>v.targetMinutes>=13&&v.targetMinutes<=15)).toBe(true);});
it("rebuilds deterministic geometry and adds boss challenges",()=>{const a=generateLevelCourse("ch1-l1"),b=generateLevelCourse("ch1-l1"),boss=generateLevelCourse("ch3-l5");expect(a.platforms).toEqual(b.platforms);expect(a.finishZ).toBeLessThan(-4000);expect(a.checkpoints.length).toBeGreaterThan(8);expect(boss.finishZ).toBeLessThan(-9500);expect(boss.checkpoints.length).toBeGreaterThan(17);expect(boss.walls.length).toBeGreaterThan(a.walls.length);expect(Math.min(...boss.platforms.map(p=>p.width))).toBeLessThan(Math.min(...a.platforms.map(p=>p.width)));});
it("names the chapter bosses",()=>{expect(levelDefinition("ch2-l3").chapterTitle).toBe("HIGHLINE");expect(levelDefinition("ch3-l5").title).toBe("The Apex");expect(levelDefinition("ch3-l5").description).toContain("Boss run");});
});
