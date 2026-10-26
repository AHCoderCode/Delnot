export type CourseId = `ch${1 | 2 | 3}-l${1 | 2 | 3 | 4 | 5}`;
export type Medal = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "PRACTICE";

export interface SavedCheckpoint {
  x: number; top: number; z: number; index: number; elapsedMs: number; started: boolean;
}
export interface SaveData {
  version: 2;
  unlocked: CourseId[];
  completed: CourseId[];
  best: Partial<Record<CourseId, number>>;
  medals: Partial<Record<CourseId, Medal>>;
  collected: string[];
  lastCourse: CourseId;
  selectedCourse: CourseId;
  checkpoints: Partial<Record<CourseId, SavedCheckpoint>>;
}

export interface GameSettings {
  version: 1;
  sensitivity: number;
  fov: number;
  quality: "low" | "medium" | "high" | "ultra";
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  cameraEffects: boolean;
  reducedMotion: boolean;
  showHud: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  version: 1, sensitivity: 0.85, fov: 82, quality: "high",
  masterVolume: 0.75, musicVolume: 0.28, effectsVolume: 0.72,
  cameraEffects: true, reducedMotion: false, showHud: true
};

export const COURSE_IDS: CourseId[] = [1,2,3].flatMap((chapter) =>
  [1,2,3,4,5].map((level) => `ch${chapter}-l${level}` as CourseId)
);
export const DEFAULT_SAVE: SaveData = {
  version: 2, unlocked: ["ch1-l1"], completed: [], best: {}, medals: {}, collected: [],
  lastCourse: "ch1-l1", selectedCourse: "ch1-l1", checkpoints: {}
};

const MEDALS: Medal[] = ["PLATINUM", "GOLD", "SILVER", "BRONZE", "PRACTICE"];
const QUALITY = ["low", "medium", "high", "ultra"] as const;

export function formatTime(milliseconds: number): string {
  const safe = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const totalCentiseconds = Math.floor(safe / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + "." + String(centiseconds).padStart(2, "0");
}

export function normalizeJoystick(dx: number, dy: number, radius: number): { x: number; y: number } {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(radius) || radius <= 0) return { x: 0, y: 0 };
  const distance = Math.hypot(dx, dy);
  if (distance <= radius * 0.12) return { x: 0, y: 0 };
  const scale = Math.min(1, radius / distance) / radius;
  return { x: dx * scale, y: dy * scale };
}

export function progressBetween(positionZ: number, startZ: number, finishZ: number): number {
  const span = startZ - finishZ;
  if (!Number.isFinite(positionZ) || !Number.isFinite(startZ) || !Number.isFinite(finishZ) || span <= 0) return 0;
  return Math.min(1, Math.max(0, (startZ - positionZ) / span));
}

export function medalForTime(milliseconds: number, goldThreshold: number, silverThreshold: number): Medal {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "BRONZE";
  if (milliseconds <= goldThreshold * 0.72) return "PLATINUM";
  if (milliseconds <= goldThreshold) return "GOLD";
  if (milliseconds <= silverThreshold) return "SILVER";
  return "BRONZE";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSave(value: unknown): SaveData {
  const output: SaveData = {
    version: 2, unlocked: ["ch1-l1"], completed: [], best: {}, medals: {}, collected: [],
    lastCourse: "ch1-l1", selectedCourse: "ch1-l1", checkpoints: {}
  };
  if (!isRecord(value)) return output;
  const validIds = (candidate: unknown): CourseId[] =>
    Array.isArray(candidate) ? Array.from(new Set(candidate.filter((id): id is CourseId =>
      typeof id === "string" && COURSE_IDS.includes(id as CourseId)))) : [];
  output.completed = validIds(value.completed);
  const savedUnlocked = validIds(value.unlocked);
  let furthest = Math.max(0, ...savedUnlocked.map((id) => COURSE_IDS.indexOf(id)));
  for (const id of output.completed) furthest = Math.max(furthest, COURSE_IDS.indexOf(id) + 1);
  output.unlocked = COURSE_IDS.slice(0, Math.min(COURSE_IDS.length, furthest + 1));
  if (isRecord(value.best)) {
    for (const id of COURSE_IDS) {
      const time = value.best[id];
      if (typeof time === "number" && Number.isFinite(time) && time > 0 && time < 24 * 60 * 60 * 1000) output.best[id] = time;
    }
  }
  if (isRecord(value.medals)) {
    for (const id of COURSE_IDS) {
      const medal = value.medals[id];
      if (typeof medal === "string" && MEDALS.includes(medal as Medal)) output.medals[id] = medal as Medal;
    }
  }
  if (Array.isArray(value.collected)) {
    output.collected = Array.from(new Set(value.collected.filter((item): item is string =>
      typeof item === "string" && item.length > 0 && item.length < 120 && !item.startsWith("line:")
    ).slice(-3000)));
  }
  const isCourseId = (candidate: unknown): candidate is CourseId =>
    typeof candidate === "string" && COURSE_IDS.includes(candidate as CourseId);
  if (isCourseId(value.lastCourse)) output.lastCourse = value.lastCourse;
  else if (isCourseId(value.currentCourse)) output.lastCourse = value.currentCourse;
  if (isCourseId(value.selectedCourse)) output.selectedCourse = value.selectedCourse;
  else output.selectedCourse = output.lastCourse;
  if (isRecord(value.checkpoints)) {
    for (const id of COURSE_IDS) {
      const cp = value.checkpoints[id];
      if (!isRecord(cp)) continue;
      const finite = (key: string): number | null =>
        typeof cp[key] === "number" && Number.isFinite(cp[key]) ? cp[key] as number : null;
      const x=finite("x"), top=finite("top"), z=finite("z"), index=finite("index"), elapsedMs=finite("elapsedMs");
      if (x===null||top===null||z===null||index===null||elapsedMs===null) continue;
      if (Math.abs(x)>50||top< -20||top>120||z< -20_100||z>100||!Number.isInteger(index)||index<0||index>600||elapsedMs<0||elapsedMs>24*60*60*1000) continue;
      output.checkpoints[id]={x,top,z,index,elapsedMs,started:typeof cp.started==="boolean"?cp.started:elapsedMs>0};
    }
  }
  for (const id of COURSE_IDS) if (!output.unlocked.includes(id)) delete output.checkpoints[id];
  if (!output.unlocked.includes(output.lastCourse)) output.lastCourse=output.unlocked[output.unlocked.length-1]??"ch1-l1";
  if (!output.unlocked.includes(output.selectedCourse)) output.selectedCourse=output.lastCourse;
  return output;
}

export function parseSave(raw: string | null): SaveData {
  if (!raw) return normalizeSave(null);
  try { return normalizeSave(JSON.parse(raw) as unknown); }
  catch { return normalizeSave(null); }
}

export function normalizeSettings(value: unknown): GameSettings {
  const result = { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) return result;
  const bounded = (key: string, fallback: number, min: number, max: number): number => {
    const candidate = value[key];
    return typeof candidate === "number" && Number.isFinite(candidate) ? Math.min(max, Math.max(min, candidate)) : fallback;
  };
  result.sensitivity = bounded("sensitivity", result.sensitivity, 0.1, 2.5);
  result.fov = bounded("fov", result.fov, 65, 105);
  result.masterVolume = bounded("masterVolume", result.masterVolume, 0, 1);
  result.musicVolume = bounded("musicVolume", result.musicVolume, 0, 1);
  result.effectsVolume = bounded("effectsVolume", result.effectsVolume, 0, 1);
  if (typeof value.quality === "string" && QUALITY.includes(value.quality as GameSettings["quality"])) result.quality = value.quality as GameSettings["quality"];
  if (typeof value.cameraEffects === "boolean") result.cameraEffects = value.cameraEffects;
  if (typeof value.reducedMotion === "boolean") result.reducedMotion = value.reducedMotion;
  if (typeof value.showHud === "boolean") result.showHud = value.showHud;
  return result;
}

export function parseSettings(raw: string | null): GameSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try { return normalizeSettings(JSON.parse(raw) as unknown); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
