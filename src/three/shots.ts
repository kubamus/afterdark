/**
 * Scroll-anchored cinematography.
 *
 * Every shot is a complete description of camera + lighting + scene state. Shots are
 * anchored to DOM markers ([data-shot="id"]); the director resolves each marker to a
 * scroll position and interpolates between neighbouring shots, so the camera rests
 * while copy is read and moves with purpose in between. Everything is a pure function
 * of scroll position — fully reversible and under the visitor's control.
 */
import { clamp, lerp, smootherstep } from "@/lib/math";

export type V3 = [number, number, number];

export interface Shot {
  pos: V3;
  target: V3;
  fov: number;
  /** tone-mapping exposure */
  exposure: number;
  /** overhead key light */
  key: number;
  /** back / edge lights */
  rim: number;
  /** narrow raking spotlight (Act I) */
  spot: number;
  /** environment reflections */
  env: number;
  /** displays (0 off → 1 full) */
  power: number;
  /** LEDs and buttons (0 off → 1 full) */
  led: number;
  /** 0 = waveform screen, 1 = track browser */
  screen: number;
  /** venue beams and haze */
  venue: number;
  /** crowd plate */
  crowd: number;
  /** signal pulse progress from player to mixer */
  signal: number;
  /** animated meter demo when no audio (0..1) */
  demo: number;
  /** portrait framing: 0 keep framing tight, 1 fit the same horizontal coverage */
  fit: number;
}

export const DEFAULT_SHOT: Shot = {
  pos: [0, 1.2, 1.2],
  target: [0, 0, 0],
  fov: 30,
  exposure: 1,
  key: 0.6,
  rim: 0.5,
  spot: 0,
  env: 0.35,
  power: 1,
  led: 1,
  screen: 0,
  venue: 0,
  crowd: 0,
  signal: 0,
  demo: 0,
  fit: 0.65,
};

// World reference points (metres). Table top is y = 0; DJ stands at +z.
const CDJL: V3 = [-0.396, 0.09, 0.0];
const SCREEN_L: V3 = [-0.396, 0.115, -0.18];
const JOG_L: V3 = [-0.396, 0.1, 0.06];
const PLAY_L: V3 = [-0.54, 0.093, 0.17];

const s = (p: Partial<Shot>): Partial<Shot> => p;

export const SHOTS: Record<string, Partial<Shot>> = {
  hero: s({ pos: [0.78, 0.19, 0.66], target: [-0.34, 0.07, -0.02], fov: 28, exposure: 1.05, key: 0.0, rim: 0.65, spot: 1, env: 0.18, power: 0.12, led: 0.85, fit: 0.35 }),
  rise: s({ pos: [0.32, 0.92, 1.12], target: [-0.06, 0.02, -0.02], fov: 30, key: 0.45, rim: 0.7, spot: 0.4, env: 0.3, power: 0.45, led: 1, fit: 0.9 }),
  overhead: s({ pos: [0.0, 1.95, 0.16], target: [0, 0, 0.0], fov: 31, key: 1, rim: 0.35, spot: 0, env: 0.35, power: 1, led: 1, fit: 1 }),
  beauty: s({ pos: [1.2, 0.5, 1.02], target: [-0.08, 0.03, -0.03], fov: 25, key: 0.75, rim: 1, env: 0.45, fit: 0.85 }),
  "cdj-intro": s({ pos: [-0.95, 0.52, 0.66], target: [-0.36, 0.05, 0.0], fov: 29, key: 0.8, rim: 0.9, fit: 0.7 }),
  "cdj-screen": s({ pos: [-0.36, 0.44, 0.16], target: SCREEN_L, fov: 30, key: 0.55, rim: 0.6, screen: 1, fit: 0.5 }),
  "cdj-jog": s({ pos: [-0.1, 0.17, 0.44], target: JOG_L, fov: 30, key: 0.8, rim: 1.1, spot: 0.5, env: 0.5, fit: 0.45 }),
  "cdj-playcue": s({ pos: [-0.36, 0.22, 0.4], target: PLAY_L, fov: 26, key: 0.55, rim: 0.8, spot: 0.6, fit: 0.35 }),
  "cdj-library": s({ pos: [-0.13, 0.25, -0.02], target: [-0.42, 0.12, -0.19], fov: 30, key: 0.45, rim: 0.7, screen: 1, fit: 0.45 }),
  "cdj-front": s({ pos: [-0.27, 0.115, 0.82], target: [-0.396, 0.07, 0.2], fov: 24, key: 0.5, rim: 0.9, spot: 0.4, fit: 0.5 }),
  "cdj-sound": s({ pos: [-1.05, 0.95, 1.3], target: CDJL, fov: 28, key: 0.12, rim: 0.35, env: 0.15, power: 0.5, led: 0.7, fit: 0.8 }),
  signal: s({ pos: [-0.28, 0.82, -1.08], target: [-0.18, 0.05, -0.16], fov: 32, key: 0.25, rim: 0.4, env: 0.2, power: 0.6, signal: 1, demo: 0.35, fit: 0.8 }),
  "djm-intro": s({ pos: [0.0, 1.02, 0.26], target: [0, 0.0, 0.0], fov: 30, key: 0.95, rim: 0.5, demo: 0.6, fit: 0.9 }),
  "djm-channels": s({ pos: [-0.03, 0.4, 0.27], target: [0.0, 0.09, -0.07], fov: 33, key: 0.75, rim: 0.7, demo: 1, fit: 0.55 }),
  "djm-ess": s({ pos: [0.52, 0.42, 0.78], target: [0.0, 0.06, 0.0], fov: 28, key: 0.25, rim: 0.6, env: 0.25, demo: 0.6, fit: 0.7 }),
  "djm-color": s({ pos: [-0.05, 0.29, 0.2], target: [-0.03, 0.1, -0.02], fov: 30, key: 0.7, rim: 0.8, demo: 0.8, fit: 0.45 }),
  "djm-beatfx": s({ pos: [0.3, 0.33, 0.14], target: [0.16, 0.09, -0.1], fov: 30, key: 0.55, rim: 0.7, demo: 0.8, fit: 0.45 }),
  "djm-fader": s({ pos: [0.13, 0.16, 0.48], target: [-0.01, 0.095, 0.15], fov: 28, key: 0.6, rim: 1, spot: 0.4, demo: 0.6, fit: 0.4 }),
  "djm-phones": s({ pos: [0.0, 0.74, 0.8], target: [0, 0.04, 0.05], fov: 34, key: 0.8, rim: 0.8, demo: 0.7, fit: 0.85 }),
  control: s({ pos: [-0.16, 0.74, 0.64], target: [-0.2, 0.03, 0.02], fov: 38, key: 0.7, rim: 0.8, env: 0.35, demo: 0, fit: 0.9 }),
  pov: s({ pos: [0.0, 0.52, 0.86], target: [0, 0.36, -3], fov: 52, exposure: 1.05, key: 0.2, rim: 0.6, venue: 1, crowd: 1, demo: 1, fit: 0.6 }),
  still: s({ pos: [0.0, 0.5, 0.9], target: [0, 0.3, -3], fov: 50, exposure: 0.0, key: 0, rim: 0, spot: 0, env: 0, power: 0, led: 0, venue: 0, crowd: 0, demo: 0, fit: 0.6 }),
  final: s({ pos: [0.92, 0.66, 1.26], target: [-0.02, 0.01, -0.03], fov: 27, exposure: 1.05, key: 0.95, rim: 1.1, env: 0.45, power: 1, led: 1, venue: 0.15, crowd: 0, demo: 0.5, fit: 0.95 }),
};

export function resolveShot(id: string): Shot {
  return { ...DEFAULT_SHOT, ...(SHOTS[id] ?? {}) };
}

export interface Anchor {
  id: string;
  y: number;
}

const SCALAR_KEYS = ["fov", "exposure", "key", "rim", "spot", "env", "power", "led", "screen", "venue", "crowd", "signal", "demo", "fit"] as const;

export function mixShots(a: Shot, b: Shot, t: number, out: Shot): Shot {
  for (let i = 0; i < 3; i++) {
    out.pos[i] = lerp(a.pos[i]!, b.pos[i]!, t);
    out.target[i] = lerp(a.target[i]!, b.target[i]!, t);
  }
  for (const k of SCALAR_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

export function cloneShot(s: Shot): Shot {
  return { ...s, pos: [...s.pos] as V3, target: [...s.target] as V3 };
}

/**
 * Samples the choreography at scroll position y. Anchors must be sorted by y.
 * Returns the interpolated shot and the index of the segment.
 */
export function sampleShots(anchors: Anchor[], y: number, out: Shot): { segment: number; t: number } {
  if (anchors.length === 0) {
    Object.assign(out, cloneShot(DEFAULT_SHOT));
    return { segment: 0, t: 0 };
  }
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (y <= first.y) {
    mixShots(resolveShot(first.id), resolveShot(first.id), 0, out);
    return { segment: 0, t: 0 };
  }
  if (y >= last.y) {
    mixShots(resolveShot(last.id), resolveShot(last.id), 0, out);
    return { segment: anchors.length - 1, t: 1 };
  }
  let i = 0;
  while (i < anchors.length - 1 && anchors[i + 1]!.y < y) i++;
  const a = anchors[i]!;
  const b = anchors[i + 1]!;
  const raw = clamp((y - a.y) / Math.max(1, b.y - a.y));
  const t = smootherstep(raw);
  mixShots(resolveShot(a.id), resolveShot(b.id), t, out);
  return { segment: i, t: raw };
}

/**
 * Portrait adaptation: dolly the camera back along its view axis so a shot keeps a
 * share of its horizontal coverage on narrow screens, without fisheye distortion.
 */
export function fitToAspect(shot: Shot, aspect: number, designAspect = 16 / 9): V3 {
  if (aspect >= designAspect * 0.92) return shot.pos;
  const v = (shot.fov * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * designAspect);
  const vNeeded = Math.min(2 * Math.atan(Math.tan(h / 2) / aspect), (100 * Math.PI) / 180);
  const full = Math.tan(vNeeded / 2) / Math.tan(v / 2);
  const factor = lerp(1, full, shot.fit);
  return [
    shot.target[0] + (shot.pos[0] - shot.target[0]) * factor,
    shot.target[1] + (shot.pos[1] - shot.target[1]) * factor,
    shot.target[2] + (shot.pos[2] - shot.target[2]) * factor,
  ];
}
