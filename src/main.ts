import * as THREE from "three";
import { DEFAULT_SETTINGS, formatTime, medalForTime, parseSave, parseSettings, progressBetween, type CourseId, type GameSettings, type Medal, type SaveData } from "./logic";
import "./style.css";

type MaterialKey = "concrete" | "light" | "dark" | "charcoal" | "steel" | "orange" | "cyan" | "white";
type ColliderKind = "platform" | "wall" | "beam" | "vault";
interface Collider {
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  kind: ColliderKind;
}
interface PlatformSpec { x: number; top: number; z: number; width: number; depth: number; }
interface SolidSpec { x: number; y: number; z: number; width: number; height: number; depth: number; kind: ColliderKind; }
interface CheckpointSpec { x: number; top: number; z: number; }
interface TokenSpec { id: string; x: number; top: number; z: number; }
interface HintSpec { z: number; text: string; }
interface CourseSpec {
  id: CourseId; number: string; title: string; label: string; description: string; difficulty: string;
  spawn: { x: number; top: number; z: number }; startLineZ: number; finishZ: number; finishTop: number;
  platforms: PlatformSpec[]; walls: SolidSpec[]; obstacles: SolidSpec[];
  checkpoints: CheckpointSpec[]; tokens: TokenSpec[]; hints: HintSpec[];
  goldTime: number; silverTime: number; fallLimit: number;
}
interface CheckpointRuntime { spec: CheckpointSpec; ring: THREE.Mesh; activated: boolean; }
interface TokenRuntime { spec: TokenSpec; mesh: THREE.Mesh; collected: boolean; }
interface WallContact { collider: Collider; normal: number; }
interface VaultMotion { from: THREE.Vector3; to: THREE.Vector3; direction: THREE.Vector3; time: number; duration: number; }
type InputCode = string;

const COURSES: CourseSpec[] = [
  {
    id: "lab", number: "01", title: "MOVEMENT LABORATORY", label: "STRATA / 01",
    description: "Build speed. Learn the line. Master the fundamentals.",
    difficulty: "FOUNDATION", spawn: { x: 0, top: 0, z: 10 }, startLineZ: 7.5, finishZ: -94, finishTop: 1.15,
    goldTime: 80000, silverTime: 125000, fallLimit: -16,
    platforms: [
      { x: 0, top: 0, z: 5, width: 12, depth: 14 },
      { x: 0, top: 0, z: -6, width: 4.2, depth: 4.6 },
      { x: -1.8, top: 0.55, z: -13, width: 4, depth: 4.2 },
      { x: 1.2, top: 0.95, z: -20, width: 4.2, depth: 4 },
      { x: 1.2, top: 0.95, z: -28, width: 5.2, depth: 9 },
      { x: 0, top: 1, z: -39, width: 5.5, depth: 5 },
      { x: 0, top: 1, z: -47, width: 5, depth: 4 },
      { x: -1.5, top: 0.9, z: -55, width: 4.2, depth: 5 },
      { x: 0, top: 1.2, z: -63, width: 6.5, depth: 7 },
      { x: 0, top: 1.2, z: -73, width: 4.2, depth: 4 },
      { x: 2, top: 1.55, z: -81, width: 4, depth: 4 },
      { x: 0, top: 1.15, z: -90, width: 7, depth: 9 }
    ],
    walls: [
      { x: 3, y: 3, z: -46, width: 0.55, height: 4, depth: 12, kind: "wall" },
      { x: -3.5, y: 2.8, z: -46, width: 0.45, height: 3.6, depth: 10, kind: "wall" }
    ],
    obstacles: [
      { x: 1.2, y: 2.22, z: -27, width: 4.85, height: 0.54, depth: 0.45, kind: "beam" },
      { x: 0, y: 1.6, z: -62, width: 4.9, height: 0.9, depth: 0.48, kind: "vault" }
    ],
    checkpoints: [
      { x: -1.5, top: 0.9, z: -55 },
      { x: 0, top: 1.2, z: -63 }
    ],
    tokens: [
      { id: "edge", x: 0, top: 0, z: -6 },
      { id: "line", x: 1.2, top: 0.95, z: -23 },
      { id: "flow", x: -1.5, top: 0.9, z: -55 },
      { id: "summit", x: 0, top: 1.15, z: -89 }
    ],
    hints: [
      { z: 7, text: "MOVE THROUGH THE GATE TO START THE CLOCK." },
      { z: -2, text: "JUMP / SPACE — BUFFER A JUMP JUST BEFORE AN EDGE." },
      { z: -10, text: "BUILD SPEED WITH SHIFT BEFORE LONGER GAPS." },
      { z: -23, text: "SLIDE / C OR CTRL — PASS UNDER THE LOW CONCRETE BEAM." },
      { z: -36, text: "WALL-RUN / JUMP BESIDE A WALL WHILE MOVING FORWARD." },
      { z: -57, text: "VAULT / PRESS E NEAR THE LOW BARRIER." },
      { z: -72, text: "CHECKPOINTS SAVE YOUR RESPawn POSITION FOR THIS RUN." }
    ]
  },
  {
    id: "heights", number: "02", title: "CONCRETE HEIGHTS", label: "VERTICAL / 02",
    description: "Elevated bridges, narrow landings, and sustained momentum.",
    difficulty: "ADVANCED", spawn: { x: 0, top: 0, z: 10 }, startLineZ: 7.5, finishZ: -99, finishTop: 4.2,
    goldTime: 112000, silverTime: 172000, fallLimit: -14,
    platforms: [
      { x: 0, top: 0, z: 5, width: 12, depth: 14 },
      { x: 0, top: 0, z: -6, width: 4.5, depth: 4.5 },
      { x: 1.5, top: 0.45, z: -13, width: 4, depth: 4 },
      { x: -1.2, top: 0.95, z: -20, width: 4.2, depth: 4 },
      { x: 1.5, top: 1.4, z: -27, width: 4.2, depth: 4 },
      { x: 0, top: 1.8, z: -34, width: 5, depth: 5 },
      { x: 0, top: 2.1, z: -42, width: 5.5, depth: 5 },
      { x: -1.6, top: 2.2, z: -51, width: 4.5, depth: 4 },
      { x: 1.4, top: 2.6, z: -59, width: 4.3, depth: 4 },
      { x: -0.5, top: 3, z: -67, width: 4.5, depth: 4 },
      { x: 0, top: 3.4, z: -75, width: 6, depth: 8 },
      { x: 1.5, top: 3.8, z: -86, width: 4.2, depth: 4 },
      { x: 0, top: 4.2, z: -95, width: 7, depth: 9 }
    ],
    walls: [
      { x: 3, y: 4.6, z: -42, width: 0.55, height: 4.8, depth: 12, kind: "wall" },
      { x: -3.2, y: 4.5, z: -43, width: 0.45, height: 4.6, depth: 10, kind: "wall" }
    ],
    obstacles: [
      { x: 0, y: 4.12, z: -74, width: 5.7, height: 0.55, depth: 0.45, kind: "beam" }
    ],
    checkpoints: [
      { x: 0, top: 1.8, z: -34 },
      { x: -1.6, top: 2.2, z: -51 },
      { x: 0, top: 3.4, z: -75 }
    ],
    tokens: [
      { id: "ascent", x: 1.5, top: 1.4, z: -27 },
      { id: "span", x: -1.6, top: 2.2, z: -51 },
      { id: "crown", x: 0, top: 4.2, z: -94 }
    ],
    hints: [
      { z: 7, text: "THE CLOCK STARTS WHEN YOU CROSS THE ENTRY GATE." },
      { z: -10, text: "LANDING HEIGHTS CHANGE. RELEASE FORWARD INPUT TO CORRECT MID-AIR." },
      { z: -35, text: "CHECKPOINT REACHED SOON — KEEP YOUR MOMENTUM." },
      { z: -39, text: "THE RIGHT WALL IS RUNNABLE. JUMP INTO IT WHILE MOVING FORWARD." },
      { z: -70, text: "USE THE OVERHEAD BEAM AS A SLIDE LINE, NOT A STOPPING POINT." }
    ]
  },
  {
    id: "descent", number: "03", title: "INDUSTRIAL DESCENT", label: "GRAVITY / 03",
    description: "A vertical service shaft. Drop cleanly, then recover.",
    difficulty: "EXPERT", spawn: { x: 0, top: 7, z: 10 }, startLineZ: 7.5, finishZ: -71, finishTop: -5.5,
    goldTime: 95000, silverTime: 150000, fallLimit: -14,
    platforms: [
      { x: 0, top: 7, z: 5, width: 12, depth: 14 },
      { x: 0, top: 6, z: -5, width: 4.5, depth: 4.2 },
      { x: 1.8, top: 5, z: -12, width: 4, depth: 4 },
      { x: -1.2, top: 3.8, z: -19, width: 4, depth: 4 },
      { x: 1.2, top: 2.3, z: -26, width: 4.5, depth: 4.5 },
      { x: 0, top: 1, z: -33, width: 5.5, depth: 5 },
      { x: 0, top: -0.1, z: -40, width: 3.8, depth: 3.8 },
      { x: -1.8, top: -1.4, z: -47, width: 4, depth: 4 },
      { x: 1.5, top: -2.7, z: -54, width: 4.2, depth: 4.2 },
      { x: 0, top: -4, z: -61, width: 6, depth: 6 },
      { x: 0, top: -5.5, z: -69, width: 5.5, depth: 8 }
    ],
    walls: [
      { x: 3, y: 2.9, z: -33, width: 0.55, height: 4, depth: 12, kind: "wall" },
      { x: -3.3, y: 2.7, z: -34, width: 0.45, height: 3.6, depth: 10, kind: "wall" },
      { x: 3.2, y: -3.2, z: -59, width: 0.55, height: 4.6, depth: 16, kind: "wall" }
    ],
    obstacles: [
      { x: 0, y: 2.05, z: -33, width: 4.9, height: 0.5, depth: 0.45, kind: "beam" }
    ],
    checkpoints: [
      { x: 0, top: 1, z: -33 },
      { x: 0, top: -4, z: -61 }
    ],
    tokens: [
      { id: "drop", x: 0, top: 6, z: -5 },
      { id: "shaft", x: -1.8, top: -1.4, z: -47 },
      { id: "exit", x: 0, top: -5.5, z: -69 }
    ],
    hints: [
      { z: 7, text: "DESCENT TEST: LAND ON THE NEXT PLATFORM BEFORE COMMITTING." },
      { z: -9, text: "A SMALL DROP CAN BE FASTER THAN A JUMP — KEEP THE LANDING CENTERED." },
      { z: -30, text: "CHECKPOINT AHEAD. THE SHAFT WALL CAN CARRY YOUR MOMENTUM." },
      { z: -47, text: "LOWER PLATFORMS ARE NARROWER. USE AIR CONTROL TO ALIGN." }
    ]
  },
  {
    id: "practice", number: "∞", title: "MOVEMENT LAB", label: "OPEN / 00",
    description: "An open practice floor with room to test every move.",
    difficulty: "FREE PRACTICE", spawn: { x: 0, top: 0, z: 10 }, startLineZ: 7.5, finishZ: -78, finishTop: 0,
    goldTime: 999999, silverTime: 999999, fallLimit: -16,
    platforms: [
      { x: 0, top: 0, z: -33, width: 24, depth: 92 },
      { x: 0, top: 0, z: 14, width: 24, depth: 10 },
      { x: 0, top: 0, z: -8, width: 12, depth: 3 },
      { x: 0, top: 0, z: -18, width: 9, depth: 3 },
      { x: -4, top: 0, z: -28, width: 3, depth: 3 },
      { x: 4, top: 0, z: -28, width: 3, depth: 3 },
      { x: 0, top: 0, z: -44, width: 9, depth: 3 },
      { x: 0, top: 0, z: -55, width: 9, depth: 3 },
      { x: 0, top: 0, z: -70, width: 18, depth: 10 }
    ],
    walls: [
      { x: 5.5, y: 2.2, z: -29, width: 0.55, height: 4.4, depth: 12, kind: "wall" },
      { x: -5.5, y: 2.2, z: -29, width: 0.55, height: 4.4, depth: 12, kind: "wall" }
    ],
    obstacles: [
      { x: 0, y: 2.1, z: -8, width: 10, height: 0.5, depth: 0.45, kind: "beam" },
      { x: 0, y: 0.65, z: -54, width: 5.4, height: 1.3, depth: 0.5, kind: "vault" }
    ],
    checkpoints: [{ x: 0, top: 0, z: -44 }],
    tokens: [
      { id: "practice-one", x: -4, top: 0, z: -28 },
      { id: "practice-two", x: 4, top: 0, z: -28 }
    ],
    hints: [
      { z: 7, text: "OPEN PRACTICE — NO COURSE MEDAL. EXPERIMENT WITH MOMENTUM." },
      { z: -3, text: "THE LOW BEAM CAN BE SLID UNDER. KEEP THE CAMERA CLEAR." },
      { z: -22, text: "USE A WALL-RUN TO PRESERVE SPEED ACROSS A GAP." }
    ]
  }
];

const app = document.getElementById("app");
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
if (!app || !canvas) throw new Error("Concrete Velocity requires its game canvas.");

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error("Missing UI node: " + id);
  return node as T;
}
function readLocal(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeLocal(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { showToast("LOCAL SAVE UNAVAILABLE — STORAGE IS BLOCKED."); }
}
function courseById(id: CourseId): CourseSpec {
  return COURSES.find((course) => course.id === id) ?? COURSES[0]!;
}

const saveData: SaveData = parseSave(readLocal("concrete-velocity.save.v1"));
let settings: GameSettings = parseSettings(readLocal("concrete-velocity.settings.v1"));
let selectedCourse: CourseId = "lab";
let currentCourse: CourseSpec = courseById("lab");
let isMenu = true;
let isPlaying = false;
let isPaused = false;
let isFinished = false;
let runStarted = false;
let elapsedMs = 0;
let totalElapsed = 0;
let frameCount = 0;
let fpsLastStamp = 0;
let lastFrameStamp = 0;
let lastHudStamp = 0;
let toastTimeout: number | undefined;
let hintIndex = -1;
const visitedHints = new Set<number>();
const keys = new Set<InputCode>();
const worldRoot = new THREE.Group();
const colliders: Collider[] = [];
const checkpointObjects: CheckpointRuntime[] = [];
const tokenObjects: TokenRuntime[] = [];
const materialCache = new Map<MaterialKey, THREE.MeshStandardMaterial>();
const geometryCache = new Map<string, THREE.BoxGeometry>();
let concreteTexture: THREE.CanvasTexture | null = null;
let activeCheckpoint: CheckpointSpec | null = null;
let activeCheckpointIndex = 0;
let checkpointCount = 0;
let collectedThisRun = 0;
let playerSpeed = 0;
let footstepClock = 0;
let wallContact: WallContact | null = null;
let vaultMotion: VaultMotion | null = null;
let menuYaw = 0;
const player = {
  position: new THREE.Vector3(0, 0, 10),
  velocity: new THREE.Vector3(),
  height: 1.8,
  grounded: false,
  coyote: 0,
  jumpBuffer: 0,
  sliding: false,
  wallRunning: false,
  wallNormal: 0,
  wallTime: 0,
  distance: 0
};
let yaw = 0;
let pitch = 0;
let cameraRoll = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#bdbbb5");
scene.fog = new THREE.Fog("#bdbbb5", 34, 145);
scene.add(worldRoot);
scene.add(new THREE.HemisphereLight("#ebe8df", "#555b5a", 2.05));
const sun = new THREE.DirectionalLight("#fff1dc", 3.25);
sun.position.set(-15, 28, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.00015;
scene.add(sun);
const rimLight = new THREE.DirectionalLight("#76d9d0", 0.8);
rimLight.position.set(15, 7, -55);
scene.add(rimLight);

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
} catch (error) {
  el("error-panel").hidden = false;
  el("error-message").textContent = "A WebGL 2 renderer could not be initialized. Try a desktop browser with hardware acceleration enabled. Details: " + (error instanceof Error ? error.message : "unknown graphics error");
  throw error;
}
const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / Math.max(1, window.innerHeight), 0.08, 240);
camera.rotation.order = "YXZ";
scene.add(camera);

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private music: GainNode | null = null;
  private started = false;

  start(): void {
    if (!this.context) {
      const Context = window.AudioContext;
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain();
      this.effects = this.context.createGain();
      this.music = this.context.createGain();
      this.effects.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.context.destination);

      const low = this.context.createOscillator();
      const high = this.context.createOscillator();
      const lowGain = this.context.createGain();
      const highGain = this.context.createGain();
      low.type = "sine"; low.frequency.value = 48;
      high.type = "triangle"; high.frequency.value = 51.2;
      lowGain.gain.value = 0.28; highGain.gain.value = 0.07;
      low.connect(lowGain); high.connect(highGain);
      lowGain.connect(this.music); highGain.connect(this.music);
      low.start(); high.start();
      this.started = true;
    }
    if (this.context.state === "suspended") void this.context.resume();
    this.setVolumes();
  }

  setVolumes(): void {
    if (!this.master || !this.effects || !this.music) return;
    this.master.gain.value = settings.masterVolume;
    this.effects.gain.value = settings.effectsVolume;
    this.music.gain.value = settings.musicVolume * 0.14;
  }

  tone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.13, endFrequency?: number): void {
    if (!this.context || !this.effects || this.context.state !== "running") return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain); gain.connect(this.effects);
    oscillator.start(now); oscillator.stop(now + duration + 0.02);
  }

  jump(): void { this.tone(185, 0.12, "triangle", 0.14, 360); }
  land(force: number): void { this.tone(74 + Math.min(90, force * 5), 0.16, "sine", 0.2, 38); this.tone(118, 0.08, "triangle", 0.06, 60); }
  checkpoint(): void { this.tone(520, 0.16, "sine", 0.1, 710); window.setTimeout(() => this.tone(760, 0.16, "sine", 0.1, 920), 95); }
  collect(): void { this.tone(640, 0.12, "triangle", 0.1, 1120); }
  finish(): void { this.tone(440, 0.26, "sine", 0.15, 660); window.setTimeout(() => this.tone(660, 0.26, "sine", 0.15, 880), 150); }
  step(): void { this.tone(78 + Math.random() * 30, 0.035, "sine", 0.026, 48); }
  ui(): void { this.tone(330, 0.06, "triangle", 0.045, 420); }
}
const audio = new AudioEngine();

function createConcreteTexture(): THREE.CanvasTexture {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 512; textureCanvas.height = 512;
  const context = textureCanvas.getContext("2d");
  if (context) {
    context.fillStyle = "#b8b5ad"; context.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8200; i++) {
      const tone = Math.floor(115 + Math.random() * 115);
      context.fillStyle = "rgba(" + tone + "," + tone + "," + Math.max(0, tone - 3) + "," + (0.025 + Math.random() * 0.16) + ")";
      const x = Math.random() * 512, y = Math.random() * 512, size = Math.random() * 2.2 + 0.25;
      context.fillRect(x, y, size, size);
    }
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      context.strokeStyle = "rgba(64,67,66," + (0.025 + Math.random() * 0.05) + ")";
      context.lineWidth = 0.3 + Math.random() * 1.2;
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.random() * 32 - 16, y + Math.random() * 42 + 8); context.stroke();
    }
    context.strokeStyle = "rgba(67,68,66,0.18)";
    context.lineWidth = 1;
    context.strokeRect(2, 2, 508, 508);
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function materialFor(key: MaterialKey): THREE.MeshStandardMaterial {
  const cached = materialCache.get(key);
  if (cached) return cached;
  const palette: Record<MaterialKey, { color: string; roughness: number; metalness: number; emissive?: string; emissiveIntensity?: number; map?: boolean }> = {
    concrete: { color: "#bab7af", roughness: 0.94, metalness: 0.03, map: true },
    light: { color: "#e0ddd5", roughness: 0.83, metalness: 0.06, map: true },
    dark: { color: "#5c6261", roughness: 0.91, metalness: 0.08, map: true },
    charcoal: { color: "#252b2c", roughness: 0.79, metalness: 0.16 },
    steel: { color: "#818987", roughness: 0.42, metalness: 0.62 },
    orange: { color: "#fa7649", roughness: 0.38, metalness: 0.18, emissive: "#df4e20", emissiveIntensity: 1.55 },
    cyan: { color: "#8df4e2", roughness: 0.3, metalness: 0.2, emissive: "#31cbb4", emissiveIntensity: 1.2 },
    white: { color: "#f5f1e9", roughness: 0.72, metalness: 0.04 }
  };
  const values = palette[key];
  const material = new THREE.MeshStandardMaterial({
    color: values.color, roughness: values.roughness, metalness: values.metalness,
    emissive: values.emissive ?? "#000000", emissiveIntensity: values.emissiveIntensity ?? 0,
    map: values.map ? (concreteTexture ??= createConcreteTexture()) : null
  });
  materialCache.set(key, material);
  return material;
}

function boxGeometry(width: number, height: number, depth: number): THREE.BoxGeometry {
  const key = [width, height, depth].map((n) => n.toFixed(3)).join("|");
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(width, height, depth);
    geometryCache.set(key, geometry);
  }
  return geometry;
}

function addVisualBox(x: number, y: number, z: number, width: number, height: number, depth: number, material: MaterialKey, shadows = true): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeometry(width, height, depth), materialFor(material));
  mesh.position.set(x, y, z);
  mesh.castShadow = shadows && settings.quality !== "low";
  mesh.receiveShadow = settings.quality !== "low";
  worldRoot.add(mesh);
  return mesh;
}

function addSolidBox(x: number, y: number, z: number, width: number, height: number, depth: number, material: MaterialKey, kind: ColliderKind): Collider {
  addVisualBox(x, y, z, width, height, depth, material);
  const collider: Collider = {
    minX: x - width / 2, maxX: x + width / 2,
    minY: y - height / 2, maxY: y + height / 2,
    minZ: z - depth / 2, maxZ: z + depth / 2, kind
  };
  colliders.push(collider);
  return collider;
}

function addPlatform(platform: PlatformSpec): void {
  addSolidBox(platform.x, platform.top - 0.5, platform.z, platform.width, 1, platform.depth, "concrete", "platform");
  addVisualBox(platform.x, platform.top - 0.04, platform.z, platform.width + 0.08, 0.08, platform.depth + 0.08, "dark", false);
  const lineZ = platform.z - platform.depth / 2 + 0.34;
  addVisualBox(platform.x - platform.width * 0.32, platform.top + 0.018, lineZ, 0.07, 0.025, 0.72, "orange", false);
  addVisualBox(platform.x + platform.width * 0.32, platform.top + 0.018, lineZ, 0.07, 0.025, 0.72, "orange", false);
}

function addGate(z: number, floorY: number, finish: boolean): void {
  const material: MaterialKey = finish ? "cyan" : "orange";
  const width = finish ? 8.2 : 8.6;
  addVisualBox(-width / 2, floorY + 2.1, z, 0.3, 4.2, 0.38, "charcoal", false);
  addVisualBox(width / 2, floorY + 2.1, z, 0.3, 4.2, 0.38, "charcoal", false);
  addVisualBox(0, floorY + 4.12, z, width + 0.25, 0.34, 0.42, material, false);
  addVisualBox(0, floorY + 3.75, z, width - 0.5, 0.05, 0.44, "white", false);
  addVisualBox(-width / 2, floorY + 0.08, z, 0.62, 0.16, 0.75, material, false);
  addVisualBox(width / 2, floorY + 0.08, z, 0.62, 0.16, 0.75, material, false);
}

function addCheckpoint(spec: CheckpointSpec): void {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.9, 0.16, 20), materialFor("charcoal"));
  base.position.y = spec.top + 0.08; base.castShadow = false; base.receiveShadow = true; group.add(base);
  const ringMaterial = new THREE.MeshStandardMaterial({ color: "#f47a4d", emissive: "#f45c2f", emissiveIntensity: 1.1, metalness: 0.2, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.055, 8, 28), ringMaterial);
  ring.position.set(spec.x, spec.top + 1.05, spec.z);
  ring.castShadow = false;
  group.add(ring);
  const pin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), materialFor("orange"));
  pin.position.set(spec.x, spec.top + 0.39, spec.z); pin.castShadow = false; group.add(pin);
  group.position.set(spec.x, 0, spec.z);
  worldRoot.add(group);
  checkpointObjects.push({ spec, ring, activated: false });
}

function addToken(spec: TokenSpec): void {
  const key = currentCourse.id + ":" + spec.id;
  if (saveData.collected.includes(key)) return;
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), materialFor("cyan"));
  mesh.position.set(spec.x, spec.top + 1.05, spec.z);
  mesh.castShadow = false;
  worldRoot.add(mesh);
  tokenObjects.push({ spec, mesh, collected: false });
}

function addAtmosphere(): void {
  const length = Math.abs(currentCourse.finishZ) + 32;
  for (let z = 9, i = 0; z > currentCourse.finishZ - 20; z -= 14, i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const heightA = 11 + (i % 3) * 4;
    const heightB = 14 + (i % 4) * 3;
    addVisualBox(-10.5, currentCourse.spawn.top + heightA * 0.42, z - 2, 4.4 + (i % 3), heightA, 8.8, i % 2 ? "dark" : "concrete", false);
    addVisualBox(10.8, currentCourse.spawn.top + heightB * 0.4, z - 6, 5.5 + (i % 4), heightB, 11.5, i % 2 ? "concrete" : "dark", false);
    addVisualBox(side * 6.5, currentCourse.spawn.top + 7.8 + (i % 2) * 1.7, z - 9, 0.65, 15.6, 5.4, "charcoal", false);
    if (i % 2 === 0) {
      addVisualBox(0, currentCourse.spawn.top + 13 + (i % 3), z - 11, 12.8, 0.42, 0.56, "dark", false);
      addVisualBox(side * 6.1, currentCourse.spawn.top + 13 + (i % 3), z - 11, 0.34, 0.42, 0.62, "orange", false);
    }
  }
  addVisualBox(-length * 0.025, currentCourse.spawn.top - 4.5, currentCourse.finishZ - 18, 62, 1.4, 12, "charcoal", false);
  for (let i = 0; i < 9; i++) {
    const z = 4 - i * 11;
    addVisualBox(-7.1, currentCourse.spawn.top + 2.6, z, 0.23, 5.2, 0.5, "steel", false);
    addVisualBox(7.1, currentCourse.spawn.top + 2.6, z, 0.23, 5.2, 0.5, "steel", false);
  }
}

function clearWorld(): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  worldRoot.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        const mapped = material as THREE.Material & { map?: THREE.Texture | null };
        if (mapped.map) textures.add(mapped.map);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  worldRoot.clear();
  colliders.length = 0; checkpointObjects.length = 0; tokenObjects.length = 0;
  materialCache.clear(); geometryCache.clear(); concreteTexture = null;
}

function buildWorld(course: CourseSpec): void {
  clearWorld();
  scene.fog = new THREE.Fog(course.id === "descent" ? "#a4aaa8" : "#bdbbb5", settings.quality === "low" ? 26 : 36, settings.quality === "low" ? 95 : 155);
  scene.background = new THREE.Color(course.id === "descent" ? "#9ea6a3" : "#bdbbb5");
  for (const platform of course.platforms) addPlatform(platform);
  for (const wall of course.walls) addSolidBox(wall.x, wall.y, wall.z, wall.width, wall.height, wall.depth, "dark", "wall");
  for (const obstacle of course.obstacles) {
    addSolidBox(obstacle.x, obstacle.y, obstacle.z, obstacle.width, obstacle.height, obstacle.depth, obstacle.kind === "beam" ? "charcoal" : "concrete", obstacle.kind);
    if (obstacle.kind === "beam") addVisualBox(obstacle.x, obstacle.y - obstacle.height * 0.12, obstacle.z, obstacle.width, 0.06, obstacle.depth + 0.08, "orange", false);
    else addVisualBox(obstacle.x, obstacle.y + obstacle.height / 2 - 0.1, obstacle.z, obstacle.width, 0.12, obstacle.depth + 0.05, "orange", false);
  }
  addGate(course.startLineZ, course.spawn.top, false);
  addGate(course.finishZ, course.finishTop, true);
  for (const checkpoint of course.checkpoints) addCheckpoint(checkpoint);
  for (const token of course.tokens) addToken(token);
  addAtmosphere();
  activeCheckpoint = { x: course.spawn.x, top: course.spawn.top, z: course.spawn.z };
  activeCheckpointIndex = 0;
  checkpointCount = 0;
  collectedThisRun = 0;
  hintIndex = -1;
  visitedHints.clear();
}

function saveProgress(): void { writeLocal("concrete-velocity.save.v1", JSON.stringify(saveData)); }
function saveSettings(): void { writeLocal("concrete-velocity.settings.v1", JSON.stringify(settings)); }

function applySettings(): void {
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  const ratioCap = settings.quality === "low" ? 1 : settings.quality === "medium" ? 1.35 : settings.quality === "high" ? 1.75 : 2.25;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
  renderer.shadowMap.enabled = settings.quality !== "low";
  renderer.shadowMap.type = settings.quality === "ultra" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  sun.castShadow = settings.quality !== "low";
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = settings.quality === "low" ? 26 : settings.quality === "medium" ? 32 : 36;
    scene.fog.far = settings.quality === "low" ? 94 : settings.quality === "medium" ? 122 : settings.quality === "ultra" ? 190 : 155;
  }
  audio.setVolumes();
  resizeRenderer();
}

function resizeRenderer(): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function showToast(message: string): void {
  const toast = el("toast");
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("toast-in");
  void toast.offsetWidth;
  toast.classList.add("toast-in");
  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 2500);
}

function isUnlocked(id: CourseId): boolean {
  return id === "practice" || saveData.unlocked.includes(id);
}

function renderCourseList(): void {
  const root = el("course-list");
  root.innerHTML = COURSES.filter((course) => course.id !== "practice").map((course) => {
    const locked = !isUnlocked(course.id);
    const best = saveData.best[course.id];
    const medal = saveData.medals[course.id];
    const selected = selectedCourse === course.id;
    return '<button class="course-option' + (selected ? " selected" : "") + (locked ? " locked" : "") + '" type="button" data-course="' + course.id + '"' + (locked ? ' disabled aria-disabled="true"' : "") + '>' +
      '<div class="course-option-top"><span>COURSE ' + course.number + '</span><span>' + (locked ? "LOCKED" : course.difficulty) + '</span></div>' +
      '<strong>' + course.title + '</strong><p>' + course.description + '</p>' +
      '<div class="course-option-bottom"><span>' + (locked ? "COMPLETE PRIOR COURSE TO UNLOCK" : (best ? "PB " + formatTime(best) : "NO RECORD YET")) + '</span><span>' + (medal ?? "—") + '</span></div>' +
    '</button>';
  }).join("");
  root.querySelectorAll<HTMLButtonElement>("[data-course]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.course as CourseId | undefined;
      if (!id || !isUnlocked(id)) return;
      selectedCourse = id;
      renderCourseList();
      audio.ui();
    });
  });
}

function setRunVisibility(): void {
  el("main-menu").hidden = !isMenu;
  el("hud").hidden = !isPlaying || isPaused || isFinished || !settings.showHud;
  el("pause-overlay").hidden = !isPaused;
  el("finish-overlay").hidden = !isFinished;
}

function resetPlayer(): void {
  const spawn = currentCourse.spawn;
  player.position.set(spawn.x, spawn.top, spawn.z);
  player.velocity.set(0, 0, 0);
  player.height = 1.8;
  player.grounded = true;
  player.coyote = 0.11;
  player.jumpBuffer = 0;
  player.sliding = false;
  player.wallRunning = false;
  player.wallNormal = 0;
  player.wallTime = 0;
  player.distance = 0;
  playerSpeed = 0;
  wallContact = null;
  vaultMotion = null;
  yaw = 0; pitch = 0; cameraRoll = 0;
}

function startCourse(id: CourseId): void {
  if (!isUnlocked(id)) {
    showToast("COMPLETE THE PREVIOUS COURSE TO UNLOCK THIS ROUTE.");
    return;
  }
  currentCourse = courseById(id);
  selectedCourse = id;
  isMenu = false; isPlaying = true; isPaused = false; isFinished = false; runStarted = false;
  elapsedMs = 0; totalElapsed = 0;
  buildWorld(currentCourse);
  resetPlayer();
  applySettings();
  renderCourseList();
  setRunVisibility();
  el("hud-course").textContent = currentCourse.title;
  el("hud-hint").textContent = "Move through the entry gate to start the clock.";
  audio.start();
  audio.ui();
  try { canvas.requestPointerLock(); } catch { showToast("CLICK THE GAME VIEW TO CAPTURE THE MOUSE."); }
}

function returnToMenu(): void {
  isMenu = true; isPlaying = false; isPaused = false; isFinished = false; runStarted = false;
  keys.clear(); vaultMotion = null;
  if (document.pointerLockElement) document.exitPointerLock();
  selectedCourse = currentCourse.id === "practice" ? "lab" : currentCourse.id;
  renderCourseList();
  setRunVisibility();
  el("info-overlay").hidden = true;
  el("settings-overlay").hidden = true;
  audio.ui();
}

function pauseGame(): void {
  if (!isPlaying || isPaused || isFinished) return;
  isPaused = true; keys.clear();
  setRunVisibility();
  if (document.pointerLockElement) document.exitPointerLock();
  audio.ui();
}

function resumeGame(): void {
  if (!isPlaying || isFinished) return;
  if (document.pointerLockElement) {
    isPaused = false; setRunVisibility(); return;
  }
  try { canvas.requestPointerLock(); } catch {
    isPaused = false; setRunVisibility(); showToast("POINTER LOCK UNAVAILABLE — CLICK THE GAME VIEW TO RECAPTURE.");
  }
  audio.start();
}

function restartFromCheckpoint(): void {
  if (!activeCheckpoint) return;
  player.position.set(activeCheckpoint.x, activeCheckpoint.top + 0.02, activeCheckpoint.z + 1.35);
  player.velocity.set(0, 0, 0);
  player.height = 1.8; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0;
  player.sliding = false; player.wallRunning = false; wallContact = null; vaultMotion = null;
  isPaused = false; isFinished = false;
  setRunVisibility();
  showToast("CHECKPOINT RESTORED.");
  audio.tone(190, 0.12, "triangle", 0.08, 110);
  if (!document.pointerLockElement) {
    try { canvas.requestPointerLock(); } catch { /* The user can recapture with a click. */ }
  }
}

function restartEntireCourse(): void {
  startCourse(currentCourse.id);
}

function finishCourse(): void {
  if (isFinished || !runStarted || elapsedMs <= 0) return;
  isFinished = true; isPaused = false;
  const previousBest = saveData.best[currentCourse.id];
  const isNewBest = previousBest === undefined || elapsedMs < previousBest;
  if (isNewBest) saveData.best[currentCourse.id] = elapsedMs;
  const medal: Medal = currentCourse.id === "practice" ? "PRACTICE" : medalForTime(elapsedMs, currentCourse.goldTime, currentCourse.silverTime);
  saveData.medals[currentCourse.id] = medal;
  if (currentCourse.id === "lab" && !saveData.unlocked.includes("heights")) saveData.unlocked.push("heights");
  if (currentCourse.id === "heights" && !saveData.unlocked.includes("descent")) saveData.unlocked.push("descent");
  saveProgress();
  el("finish-time").textContent = formatTime(elapsedMs);
  el("finish-best").textContent = formatTime(saveData.best[currentCourse.id] ?? elapsedMs);
  el("finish-medal").textContent = medal;
  el("finish-checkpoints").textContent = checkpointCount + " / " + currentCourse.checkpoints.length;
  el("finish-collectibles").textContent = collectedThisRun + " / " + currentCourse.tokens.length;
  el("finish-message").textContent = isNewBest ? "NEW PERSONAL BEST — this result was recorded on this device." : (currentCourse.id === "practice" ? "Practice completed. Try a different line or keep exploring." : "Course completed. Your recorded personal best remains " + formatTime(previousBest ?? elapsedMs) + ".");
  renderCourseList();
  setRunVisibility();
  if (document.pointerLockElement) document.exitPointerLock();
  audio.finish();
}

function overlapsAt(position: THREE.Vector3, height: number, collider: Collider): boolean {
  const radius = 0.34;
  return position.x + radius > collider.minX + 0.008 && position.x - radius < collider.maxX - 0.008 &&
    position.z + radius > collider.minZ + 0.008 && position.z - radius < collider.maxZ - 0.008 &&
    position.y < collider.maxY - 0.015 && position.y + height > collider.minY + 0.015;
}

function collidesAt(position: THREE.Vector3, height: number): boolean {
  return colliders.some((collider) => overlapsAt(position, height, collider));
}

function canStand(): boolean {
  return !collidesAt(player.position, 1.8);
}

function resolveAxis(axis: "x" | "z", distance: number): void {
  if (Math.abs(distance) < 0.00001) return;
  const radius = 0.34;
  const current = player.position[axis];
  const candidate = current + distance;
  let resolved = candidate;
  for (const collider of colliders) {
    if (!(player.position.y < collider.maxY - 0.015 && player.position.y + player.height > collider.minY + 0.015)) continue;
    const otherAxis = axis === "x" ? "z" : "x";
    const otherValue = player.position[otherAxis];
    const otherMin = otherAxis === "x" ? collider.minX : collider.minZ;
    const otherMax = otherAxis === "x" ? collider.maxX : collider.maxZ;
    if (!(otherValue + radius > otherMin + 0.004 && otherValue - radius < otherMax - 0.004)) continue;
    const min = axis === "x" ? collider.minX : collider.minZ;
    const max = axis === "x" ? collider.maxX : collider.maxZ;
    if (distance > 0 && current + radius <= min + 0.002 && candidate + radius > min) resolved = Math.min(resolved, min - radius - 0.002);
    if (distance < 0 && current - radius >= max - 0.002 && candidate - radius < max) resolved = Math.max(resolved, max + radius + 0.002);
  }
  player.position[axis] = resolved;
  if (Math.abs(resolved - candidate) > 0.0001) {
    if (axis === "x") player.velocity.x = 0;
    else player.velocity.z = 0;
  }
}

function findWallContact(): WallContact | null {
  const radius = 0.34;
  for (const collider of colliders) {
    if (collider.kind !== "wall") continue;
    if (!(player.position.y + player.height > collider.minY + 0.05 && player.position.y < collider.maxY - 0.05)) continue;
    if (!(player.position.z + radius > collider.minZ && player.position.z - radius < collider.maxZ)) continue;
    if (player.position.x <= collider.minX && collider.minX - (player.position.x + radius) < 0.55) return { collider, normal: -1 };
    if (player.position.x >= collider.maxX && (player.position.x - radius) - collider.maxX < 0.55) return { collider, normal: 1 };
  }
  return null;
}

function getForward(): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function tryVault(): boolean {
  const forward = getForward();
  let closest: Collider | null = null;
  let bestDistance = Infinity;
  for (const collider of colliders) {
    if (collider.kind !== "vault") continue;
    const dx = (collider.minX + collider.maxX) / 2 - player.position.x;
    const dz = (collider.minZ + collider.maxZ) / 2 - player.position.z;
    const along = dx * forward.x + dz * forward.z;
    const side = Math.abs(dx * forward.z - dz * forward.x);
    const obstacleHeight = collider.maxY - player.position.y;
    const halfDepth = (Math.abs(forward.x) * (collider.maxX - collider.minX) + Math.abs(forward.z) * (collider.maxZ - collider.minZ)) / 2;
    if (along > 0.25 && along < 2.05 && side < (collider.maxX - collider.minX) / 2 + 0.4 && obstacleHeight > 0.25 && obstacleHeight < 1.25) {
      const distance = along - halfDepth;
      if (distance < bestDistance) { bestDistance = distance; closest = collider; }
    }
  }
  if (!closest) return false;
  const obstacle = closest;
  const distance = Math.max(1.2, bestDistance + (Math.abs(forward.x) * (obstacle.maxX - obstacle.minX) + Math.abs(forward.z) * (obstacle.maxZ - obstacle.minZ)) / 2 + 0.9);
  const destination = player.position.clone().addScaledVector(forward, distance);
  destination.y = player.position.y;
  if (collidesAt(destination, 1.8)) return false;
  vaultMotion = { from: player.position.clone(), to: destination, direction: forward.clone(), time: 0, duration: 0.42 };
  player.sliding = false; player.wallRunning = false; player.velocity.set(0, 0, 0); player.height = 1.8;
  showToast("VAULT — CLEAR THE BARRIER.");
  return true;
}

function updateVault(dt: number): void {
  if (!vaultMotion) return;
  const motion = vaultMotion;
  motion.time += dt;
  const t = Math.min(1, motion.time / motion.duration);
  player.position.lerpVectors(motion.from, motion.to, t);
  player.position.y += Math.sin(t * Math.PI) * 0.88;
  player.velocity.set(motion.direction.x * 6.6, 0, motion.direction.z * 6.6);
  if (t >= 1) {
    vaultMotion = null;
    player.position.copy(motion.to);
    player.velocity.y = -0.8;
    player.grounded = false;
  }
}

function updatePlayer(dt: number): void {
  if (vaultMotion) {
    updateVault(dt);
    updateCamera(dt);
    return;
  }
  const wasGrounded = player.grounded;
  if (wasGrounded) player.coyote = 0.115;
  else player.coyote = Math.max(0, player.coyote - dt);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  const forwardInput = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const sideInput = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const slidePressed = keys.has("KeyC") || keys.has("ControlLeft") || keys.has("ControlRight");
  const forward = getForward();
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  if (slidePressed && wasGrounded && !player.sliding && playerSpeed > 3.2) {
    player.sliding = true;
    player.velocity.addScaledVector(forward, 1.75);
    audio.tone(115, 0.12, "sawtooth", 0.055, 60);
  }
  if (player.sliding && !slidePressed && canStand()) player.sliding = false;
  player.height = player.sliding ? 0.82 : 1.8;

  let jumped = false;
  if (player.jumpBuffer > 0 && (wasGrounded || player.coyote > 0 || player.wallRunning)) {
    if (player.wallRunning && wallContact) {
      player.velocity.x = wallContact.normal * 6.2;
      player.velocity.z = Math.min(player.velocity.z, -5.2);
      player.velocity.y = 7.75;
      player.wallRunning = false; wallContact = null; player.wallTime = 0;
      player.jumpBuffer = 0; player.coyote = 0; player.grounded = false; player.sliding = false;
      player.height = 1.8; jumped = true;
      audio.jump(); showToast("WALL JUMP — KEEP THE LINE.");
    } else if (!player.sliding || canStand()) {
      player.sliding = false; player.height = 1.8;
      player.velocity.y = 7.75;
      player.jumpBuffer = 0; player.coyote = 0; player.grounded = false;
      jumped = true; audio.jump();
    }
  }

  let wish = new THREE.Vector3();
  wish.addScaledVector(forward, forwardInput);
  wish.addScaledVector(right, sideInput);
  if (wish.lengthSq() > 1) wish.normalize();
  const hasInput = wish.lengthSq() > 0.001;
  const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  const maxSpeed = player.sliding ? 13.8 : sprinting ? 12.5 : 8.1;
  const acceleration = wasGrounded ? (player.sliding ? 9 : 25) : 7.2;
  if (hasInput) {
    player.velocity.x += (wish.x * maxSpeed - player.velocity.x) * Math.min(1, acceleration * dt);
    player.velocity.z += (wish.z * maxSpeed - player.velocity.z) * Math.min(1, acceleration * dt);
  } else if (wasGrounded && !player.wallRunning) {
    const friction = player.sliding ? 1.9 : 11.8;
    player.velocity.x *= Math.max(0, 1 - friction * dt);
    player.velocity.z *= Math.max(0, 1 - friction * dt);
  } else {
    player.velocity.x *= Math.max(0, 1 - 0.18 * dt);
    player.velocity.z *= Math.max(0, 1 - 0.18 * dt);
  }

  wallContact = findWallContact();
  const shouldWallRun = !wasGrounded && !jumped && forwardInput > 0 && horizontalSpeed > 3.6 && wallContact !== null && player.wallTime < 1.4;
  if (shouldWallRun && wallContact) {
    player.wallRunning = true;
    player.wallNormal = wallContact.normal;
    player.wallTime += dt;
    player.velocity.x = 0;
    player.position.x = wallContact.normal < 0 ? wallContact.collider.minX - 0.342 : wallContact.collider.maxX + 0.342;
  } else if (player.wallRunning) {
    player.wallRunning = false;
    player.wallTime = 0;
  }
  if (!player.wallRunning) player.wallTime = Math.max(0, player.wallTime - dt * 0.6);

  if (!wasGrounded || jumped) {
    const gravityScale = player.wallRunning ? 0.16 : 1;
    player.velocity.y -= 19.2 * gravityScale * dt;
    if (player.wallRunning) player.velocity.y = Math.max(-2.1, player.velocity.y);
  } else {
    player.velocity.y = 0;
  }

  const dx = player.velocity.x * dt;
  const dz = player.velocity.z * dt;
  resolveAxis("x", dx);
  resolveAxis("z", dz);

  const oldGrounded = player.grounded;
  player.grounded = false;
  const fallSpeed = player.velocity.y;
  const nextY = player.position.y + player.velocity.y * dt;
  if (player.velocity.y <= 0) {
    let landingTop = -Infinity;
    for (const collider of colliders) {
      const horizontalOverlap = player.position.x + 0.34 > collider.minX + 0.01 && player.position.x - 0.34 < collider.maxX - 0.01 &&
        player.position.z + 0.34 > collider.minZ + 0.01 && player.position.z - 0.34 < collider.maxZ - 0.01;
      if (!horizontalOverlap) continue;
      if (collider.maxY <= player.position.y + 0.08 && nextY <= collider.maxY && player.position.y >= collider.maxY - 0.28) landingTop = Math.max(landingTop, collider.maxY);
    }
    if (landingTop > -Infinity) {
      player.position.y = landingTop;
      player.velocity.y = 0;
      player.grounded = true;
      player.wallRunning = false;
      player.wallTime = 0;
      if (!oldGrounded && fallSpeed < -3.0) audio.land(Math.abs(fallSpeed));
    } else {
      player.position.y = nextY;
    }
  } else {
    let ceiling = Infinity;
    for (const collider of colliders) {
      const horizontalOverlap = player.position.x + 0.34 > collider.minX + 0.01 && player.position.x - 0.34 < collider.maxX - 0.01 &&
        player.position.z + 0.34 > collider.minZ + 0.01 && player.position.z - 0.34 < collider.maxZ - 0.01;
      if (!horizontalOverlap) continue;
      if (player.position.y + player.height <= collider.minY + 0.02 && nextY + player.height >= collider.minY) ceiling = Math.min(ceiling, collider.minY);
    }
    if (ceiling < Infinity) {
      player.position.y = ceiling - player.height;
      player.velocity.y = 0;
    } else player.position.y = nextY;
  }

  playerSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  player.distance += playerSpeed * dt;
  if (player.grounded && playerSpeed > 2.2) {
    footstepClock += dt;
    const interval = player.sliding ? 0.55 : sprinting ? 0.27 : 0.39;
    if (footstepClock >= interval) { footstepClock = 0; if (!player.sliding) audio.step(); }
  } else footstepClock = 0;

  if (player.position.y < currentCourse.fallLimit || player.position.y > currentCourse.spawn.top + 60 || Math.abs(player.position.x) > 40) {
    restartFromCheckpoint();
    showToast("FALL RECOVERY — SAFE POSITION RESTORED.");
  }
  updateHints();
  updateCamera(dt);
  if (!runStarted && player.position.z < currentCourse.startLineZ) {
    runStarted = true;
    elapsedMs = 0;
    showToast("RUN STARTED — HOLD YOUR MOMENTUM.");
    audio.tone(420, 0.12, "sine", 0.08, 620);
  }
}

function updateCamera(dt: number): void {
  const cameraEffects = settings.cameraEffects && !settings.reducedMotion;
  const isMoving = playerSpeed > 0.8 && player.grounded;
  const bob = cameraEffects && isMoving && !player.sliding ? Math.sin(player.distance * 1.2) * 0.027 : 0;
  const desiredRoll = cameraEffects && player.wallRunning ? -player.wallNormal * 0.11 : 0;
  cameraRoll = THREE.MathUtils.damp(cameraRoll, desiredRoll, 7.5, dt);
  const targetFov = settings.fov + (cameraEffects && (keys.has("ShiftLeft") || keys.has("ShiftRight")) && playerSpeed > 5 ? 3.2 : 0);
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
  camera.updateProjectionMatrix();
  camera.position.set(player.position.x, player.position.y + (player.sliding ? 0.64 : 1.59) + bob, player.position.z);
  camera.rotation.set(pitch, yaw, cameraRoll, "YXZ");
}

function updateHints(): void {
  for (let i = 0; i < currentCourse.hints.length; i++) {
    const hint = currentCourse.hints[i]!;
    if (!visitedHints.has(i) && player.position.z < hint.z) {
      visitedHints.add(i); hintIndex = i;
      el("hud-hint").textContent = hint.text;
      if (i > 0) showToast(hint.text);
    }
  }
}

function updateTriggers(): void {
  for (const checkpoint of checkpointObjects) {
    if (checkpoint.activated) continue;
    const dx = player.position.x - checkpoint.spec.x;
    const dz = player.position.z - checkpoint.spec.z;
    if (Math.hypot(dx, dz) < 1.25 && Math.abs(player.position.y - checkpoint.spec.top) < 1.3) {
      checkpoint.activated = true;
      checkpointCount++;
      activeCheckpointIndex = checkpointObjects.indexOf(checkpoint) + 1;
      activeCheckpoint = checkpoint.spec;
      const material = checkpoint.ring.material as THREE.MeshStandardMaterial;
      material.color.set("#8df4e2"); material.emissive.set("#31cbb4"); material.emissiveIntensity = 1.8;
      showToast("CHECKPOINT " + String(activeCheckpointIndex).padStart(2, "0") + " ACTIVATED.");
      audio.checkpoint();
    }
  }
  for (const token of tokenObjects) {
    if (token.collected) continue;
    token.mesh.rotation.y += 0.025;
    token.mesh.position.y = token.spec.top + 1.05 + Math.sin(totalElapsed * 2.1 + token.spec.z) * 0.08;
    const distance = player.position.distanceTo(token.mesh.position);
    if (distance < 1.35) {
      token.collected = true;
      worldRoot.remove(token.mesh);
      const id = currentCourse.id + ":" + token.spec.id;
      if (!saveData.collected.includes(id)) saveData.collected.push(id);
      collectedThisRun++;
      saveProgress();
      showToast("ROUTE MARKER ACQUIRED.");
      audio.collect();
    }
  }
  if (runStarted && Math.abs(player.position.z - currentCourse.finishZ) < 1.5 && Math.abs(player.position.x) < 4.3 &&
      Math.abs(player.position.y - currentCourse.finishTop) < 1.6) finishCourse();
}

function updateHud(now: number): void {
  if (now - lastHudStamp < 50) return;
  lastHudStamp = now;
  el("hud-timer").textContent = formatTime(elapsedMs);
  const progress = Math.round(progressBetween(player.position.z, currentCourse.startLineZ, currentCourse.finishZ) * 100);
  el("hud-progress").innerHTML = String(progress).padStart(2, "0") + '<span>%</span>';
  el("progress-fill").style.width = progress + "%";
  el("hud-checkpoint").textContent = "CP " + String(activeCheckpointIndex).padStart(2, "0") + " / " + String(currentCourse.checkpoints.length).padStart(2, "0");
  const best = saveData.best[currentCourse.id];
  el("hud-best").textContent = best ? "PB " + formatTime(best) : "PB —:—";
  el("hud-speed").innerHTML = playerSpeed.toFixed(1) + ' <small>M/S</small>';
  let state = "MOVE";
  if (vaultMotion) state = "VAULT";
  else if (player.sliding) state = "SLIDING";
  else if (player.wallRunning) state = "WALL-RUN";
  else if (!player.grounded) state = player.velocity.y > 0.5 ? "AIRBORNE" : "FALLING";
  else if (keys.has("ShiftLeft") || keys.has("ShiftRight")) state = "SPRINT";
  else if (playerSpeed < 0.4) state = "STANDING";
  el("hud-state").textContent = state;
  el("crosshair").classList.toggle("moving", playerSpeed > 4 || player.wallRunning);
}

function renderSettingsForm(): void {
  const content = el("settings-content");
  content.innerHTML =
    '<div class="settings-section"><div class="settings-section-title">LOOK & CAMERA</div>' +
      settingRange("sensitivity", "Mouse sensitivity", settings.sensitivity, 0.1, 2.5, 0.05, settings.sensitivity.toFixed(2)) +
      settingRange("fov", "Field of view", settings.fov, 65, 105, 1, Math.round(settings.fov) + "°") +
      settingToggle("cameraEffects", "Camera movement", "Subtle FOV changes and movement sway.", settings.cameraEffects) +
      settingToggle("reducedMotion", "Reduced motion", "Disable camera sway and transition effects.", settings.reducedMotion) +
    '</div><div class="settings-section"><div class="settings-section-title">GRAPHICS</div>' +
      '<label class="setting-select"><span><strong>Quality preset</strong><small>Resolution scale, shadows, and draw distance.</small></span><select data-setting="quality"><option value="low"' + (settings.quality === "low" ? " selected" : "") + '>Low</option><option value="medium"' + (settings.quality === "medium" ? " selected" : "") + '>Medium</option><option value="high"' + (settings.quality === "high" ? " selected" : "") + '>High</option><option value="ultra"' + (settings.quality === "ultra" ? " selected" : "") + '>Ultra</option></select></label>' +
      settingToggle("showHud", "Show HUD", "Hide the run overlay while keeping controls active.", settings.showHud) +
    '</div><div class="settings-section"><div class="settings-section-title">AUDIO MIX</div>' +
      settingRange("masterVolume", "Master volume", settings.masterVolume, 0, 1, 0.01, Math.round(settings.masterVolume * 100) + "%") +
      settingRange("musicVolume", "Atmosphere", settings.musicVolume, 0, 1, 0.01, Math.round(settings.musicVolume * 100) + "%") +
      settingRange("effectsVolume", "Movement & effects", settings.effectsVolume, 0, 1, 0.01, Math.round(settings.effectsVolume * 100) + "%") +
    '</div><button type="button" id="reset-settings-button" class="button button-quiet reset-settings">RESET TO DEFAULTS</button>';
  content.oninput = settingsInputChanged;
  content.onchange = settingsInputChanged;
  el("reset-settings-button").addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    renderSettingsForm();
    applySettings();
    el("hud").hidden = !isPlaying || isPaused || isFinished || !settings.showHud;
    showToast("SETTINGS RESET.");
  });
}

function settingRange(key: string, label: string, value: number, min: number, max: number, step: number, output: string): string {
  return '<label class="setting-range"><span class="setting-label-row"><strong>' + label + '</strong><output data-output="' + key + '">' + output + '</output></span>' +
    '<input type="range" data-setting="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" /></label>';
}
function settingToggle(key: string, label: string, description: string, checked: boolean): string {
  return '<label class="setting-toggle"><span><strong>' + label + '</strong><small>' + description + '</small></span><input type="checkbox" data-setting="' + key + '"' + (checked ? " checked" : "") + ' /><span class="toggle-track" aria-hidden="true"></span></label>';
}

function settingsInputChanged(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  const key = target.dataset.setting as keyof GameSettings | undefined;
  if (!key) return;
  if (key === "quality") {
    if (target instanceof HTMLSelectElement && ["low", "medium", "high", "ultra"].includes(target.value)) settings.quality = target.value as GameSettings["quality"];
  } else if (key === "cameraEffects" || key === "reducedMotion" || key === "showHud") {
    if (target instanceof HTMLInputElement) settings[key] = target.checked;
  } else if (key === "sensitivity" || key === "fov" || key === "masterVolume" || key === "musicVolume" || key === "effectsVolume") {
    const value = Number(target.value);
    if (Number.isFinite(value)) settings[key] = value;
    const output = el("settings-content").querySelector<HTMLOutputElement>('[data-output="' + key + '"]');
    if (output) output.value = key === "sensitivity" ? value.toFixed(2) : key === "fov" ? Math.round(value) + "°" : Math.round(value * 100) + "%";
  }
  saveSettings();
  applySettings();
  el("hud").hidden = !isPlaying || isPaused || isFinished || !settings.showHud;
}

function openSettings(): void {
  renderSettingsForm();
  el("settings-overlay").hidden = false;
  audio.ui();
}
function closeSettings(): void {
  el("settings-overlay").hidden = true;
  audio.ui();
}
function openInfo(kind: "controls" | "credits"): void {
  const title = el("info-title");
  const eyebrow = el("info-eyebrow");
  const content = el("info-content");
  if (kind === "controls") {
    eyebrow.textContent = "FIELD MANUAL / CONTROLS";
    title.innerHTML = "MOVE WITH<br /><span>INTENT.</span>";
    content.innerHTML =
      '<div class="manual-grid">' +
        manualItem("W A S D", "Move", "Build speed before a gap. Air control is available but weaker than ground control.") +
        manualItem("MOUSE", "Look", "Click Start Run to capture the pointer. Press Escape to pause and release it.") +
        manualItem("SPACE", "Jump", "Jump buffering and a short coyote window forgive tight timing. Jump toward a wall to begin a wall-run.") +
        manualItem("SHIFT", "Sprint", "Higher top speed helps clear long gaps. A clean landing matters more than raw speed.") +
        manualItem("C / CTRL", "Slide", "Hold while moving on the ground. The lower capsule fits beneath the marked beam; release to stand when clear.") +
        manualItem("E", "Vault", "Press near a short, marked barrier. The destination must have safe clearance.") +
        manualItem("R", "Checkpoint", "Respawn at the latest activated checkpoint. Your current run timer continues.") +
        manualItem("ESC", "Pause", "Pause, restart, change settings, or return to course selection.") +
      '</div><p class="info-note">Keyboard and mouse are required. Touchscreen movement controls are not implemented.</p>';
  } else {
    eyebrow.textContent = "PROJECT NOTES / CREDITS";
    title.innerHTML = "ORIGINAL<br /><span>BY DESIGN.</span>";
    content.innerHTML =
      '<p class="info-paragraph">Concrete Velocity is an original browser parkour study inspired by minimalist brutalist architecture and momentum-based traversal. Its courses, geometry, interface, and procedural audio are original creations.</p>' +
      '<div class="credit-list"><div><span>ENGINE</span><strong>THREE.JS / WEBGL 2</strong></div><div><span>TOOLCHAIN</span><strong>TYPESCRIPT + VITE</strong></div><div><span>PHYSICS</span><strong>CUSTOM KINEMATIC CONTROLLER</strong></div><div><span>PROGRESSION</span><strong>LOCAL STORAGE / NO ACCOUNT</strong></div></div>' +
      '<p class="info-note">No VHOLUME levels, assets, artwork, or music are included. Results are local to this browser and are not online rankings.</p>';
  }
  el("info-overlay").hidden = false;
  audio.ui();
}
function manualItem(key: string, label: string, text: string): string {
  return '<div class="manual-item"><span>' + key + '</span><div><strong>' + label + '</strong><p>' + text + '</p></div></div>';
}
function closeInfo(): void { el("info-overlay").hidden = true; audio.ui(); }

function updateMenuCamera(time: number): void {
  const wobble = settings.reducedMotion ? 0 : Math.sin(time * 0.00012) * 0.014;
  camera.position.set(Math.sin(time * 0.00007) * 0.24, currentCourse.spawn.top + 4.6, 14.5);
  camera.lookAt(0, currentCourse.spawn.top + 2.2, -21);
  camera.rotation.z = wobble;
}

function frame(stamp: number): void {
  requestAnimationFrame(frame);
  const rawDt = lastFrameStamp ? (stamp - lastFrameStamp) / 1000 : 1 / 60;
  const dt = Math.max(0.001, Math.min(0.033, rawDt));
  lastFrameStamp = stamp;
  totalElapsed += dt;
  if (isPlaying && !isPaused && !isFinished) {
    if (runStarted) elapsedMs += dt * 1000;
    updatePlayer(dt);
    updateTriggers();
    updateHud(stamp);
  } else if (isMenu) {
    updateMenuCamera(stamp);
    for (const token of tokenObjects) token.mesh.rotation.y += dt * 0.4;
  }
  if (stamp - fpsLastStamp > 750) {
    const fps = frameCount * 1000 / Math.max(1, stamp - fpsLastStamp);
    frameCount = 0; fpsLastStamp = stamp;
    app?.style.setProperty("--fps", String(Math.round(fps)));
  }
  frameCount++;
  try { renderer.render(scene, camera); }
  catch (error) {
    el("error-panel").hidden = false;
    el("error-message").textContent = "Rendering stopped: " + (error instanceof Error ? error.message : "unknown graphics error");
  }
}

function initialize(): void {
  buildWorld(currentCourse);
  resetPlayer();
  renderCourseList();
  applySettings();
  el("hud-course").textContent = currentCourse.title;
  if (window.matchMedia("(pointer: coarse)").matches) el("touch-note").hidden = false;

  el("start-button").addEventListener("click", () => startCourse(selectedCourse));
  el("practice-button").addEventListener("click", () => startCourse("practice"));
  el("settings-button").addEventListener("click", openSettings);
  el("pause-settings-button").addEventListener("click", openSettings);
  el("controls-button").addEventListener("click", () => openInfo("controls"));
  el("credits-button").addEventListener("click", () => openInfo("credits"));
  el("close-settings-button").addEventListener("click", closeSettings);
  el("close-info-button").addEventListener("click", closeInfo);
  el("resume-button").addEventListener("click", resumeGame);
  el("restart-checkpoint-button").addEventListener("click", restartFromCheckpoint);
  el("restart-course-button").addEventListener("click", restartEntireCourse);
  el("return-menu-button").addEventListener("click", returnToMenu);
  el("replay-button").addEventListener("click", () => startCourse(currentCourse.id));
  el("finish-menu-button").addEventListener("click", returnToMenu);
  el("settings-overlay").addEventListener("click", (event) => { if (event.target === el("settings-overlay")) closeSettings(); });
  el("info-overlay").addEventListener("click", (event) => { if (event.target === el("info-overlay")) closeInfo(); });
  canvas.addEventListener("click", () => {
    if (isPlaying && !isFinished && !isPaused && !document.pointerLockElement) {
      try { canvas.requestPointerLock(); } catch { showToast("POINTER LOCK IS NOT AVAILABLE IN THIS BROWSER."); }
    }
  });
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
      if (isPaused) isPaused = false;
      setRunVisibility();
    } else if (isPlaying && !isFinished && !isMenu) {
      isPaused = true;
      keys.clear();
      setRunVisibility();
    }
  });
  document.addEventListener("mousemove", (event) => {
    if (!isPlaying || isPaused || isFinished || document.pointerLockElement !== canvas) return;
    yaw -= event.movementX * settings.sensitivity * 0.00165;
    pitch -= event.movementY * settings.sensitivity * 0.00165;
    pitch = THREE.MathUtils.clamp(pitch, -1.43, 1.43);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!el("settings-overlay").hidden) { closeSettings(); event.preventDefault(); return; }
      if (!el("info-overlay").hidden) { closeInfo(); event.preventDefault(); return; }
      if (isPlaying && !isPaused && !isFinished && !document.pointerLockElement) { pauseGame(); event.preventDefault(); }
      return;
    }
    if (!isPlaying || isPaused || isFinished || !el("settings-overlay").hidden || !el("info-overlay").hidden) return;
    const prevent = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ControlLeft", "ControlRight"];
    if (prevent.includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === "Space") player.jumpBuffer = 0.13;
    if (event.code === "KeyE") {
      if (!tryVault()) showToast("NO SAFE VAULT TARGET IN RANGE.");
    }
    if (event.code === "KeyR") restartFromCheckpoint();
  });
  document.addEventListener("keyup", (event) => { keys.delete(event.code); });
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPlaying && !isPaused && !isFinished) pauseGame();
  });
  window.addEventListener("resize", resizeRenderer);
  window.addEventListener("beforeunload", () => {
    if (saveData) saveProgress();
    if (settings) saveSettings();
  });
  setRunVisibility();
  requestAnimationFrame(frame);
}

initialize();
