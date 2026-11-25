/**
 * Scroll-anchored cinematography.
 *
 * Every shot is a complete description of camera + lighting + scene state. Shots are
 * anchored to DOM markers ([data-shot="id"]). With dwell > 0, the camera holds cleanly
 * on the active hardware feature while the visitor reads/interacts with it, then glides
 * smoothly into the next shot — keeping background 3D visuals 100% synced to the section.
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
  /** narrow raking spotlight (Act I + macro rim accents) */
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
  exposure: 1.06,
  key: 0.65,
  rim: 0.65,
  spot: 0,
  env: 0.44,
  power: 1,
  led: 1,
  screen: 0,
  venue: 0.08,
  crowd: 0,
  signal: 0,
  demo: 0,
  fit: 0.65,
};

// World reference points (metres). Table top is y = 0; DJ stands at +z.
const CDJL: V3 = [-0.396, 0.09, 0.0];
const SCREEN_L: V3 = [-0.45, 0.118, -0.175];
const JOG_L: V3 = [-0.38, 0.105, 0.085];
const PLAY_L: V3 = [-0.515, 0.095, 0.175];

const s = (p: Partial<Shot>): Partial<Shot> => p;

export const SHOTS: Record<string, Partial<Shot>> = {
  // Dramatic hero chiaroscuro raking over the sculpted concave-dimpled jog & glowing PLAY/CUE rings
  hero: s({ pos: [0.68, 0.24, 0.66], target: [-0.34, 0.082, 0.02], fov: 27, exposure: 1.1, key: 0.14, rim: 0.92, spot: 1.12, env: 0.34, power: 0.18, led: 0.96, venue: 0.14, fit: 0.38 }),
  rise: s({ pos: [0.34, 0.88, 1.08], target: [-0.04, 0.025, -0.02], fov: 30, key: 0.58, rim: 0.88, spot: 0.48, env: 0.42, power: 0.56, led: 1, venue: 0.16, fit: 0.9 }),
  overhead: s({ pos: [0.0, 1.92, 0.16], target: [0, 0, 0.0], fov: 31, key: 1.0, rim: 0.54, spot: 0, env: 0.48, power: 1, led: 1, venue: 0.08, fit: 1 }),
  beauty: s({ pos: [1.14, 0.46, 0.98], target: [-0.08, 0.04, -0.01], fov: 25, key: 0.84, rim: 1.18, env: 0.56, venue: 0.18, fit: 0.85 }),
  "cdj-intro": s({ pos: [-0.88, 0.47, 0.62], target: [-0.36, 0.06, 0.02], fov: 28, key: 0.84, rim: 1.08, spot: 0.35, env: 0.52, venue: 0.14, fit: 0.7 }),
  // Tight macro on the tilted 10.1" screen + sculpted bezel buttons & Hot Cues
  "cdj-screen": s({ pos: [-0.34, 0.39, 0.18], target: SCREEN_L, fov: 27, key: 0.58, rim: 0.82, env: 0.48, screen: 1, venue: 0.06, fit: 0.5 }),
  // Dramatic low raking macro directly on the sculpted concave-dimpled Jog Wheel & chrome bevel
  "cdj-jog": s({ pos: [-0.08, 0.195, 0.43], target: JOG_L, fov: 23, key: 0.72, rim: 1.32, spot: 1.05, env: 0.66, venue: 0.12, fit: 0.42 }),
  // Tight macro framing the sculpted green PLAY, amber CUE, Search & IN/OUT halos on the lower-left deck
  "cdj-playcue": s({ pos: [-0.3, 0.22, 0.41], target: PLAY_L, fov: 23, key: 0.56, rim: 1.04, spot: 0.92, env: 0.54, venue: 0.08, fit: 0.35 }),
  // Front-panel NFC touchpoint & USB-C / cloud connectivity macro
  "cdj-front": s({ pos: [-0.24, 0.14, 0.7], target: [-0.4, 0.068, 0.19], fov: 23, key: 0.62, rim: 1.12, spot: 0.62, env: 0.52, screen: 1, venue: 0.1, fit: 0.48 }),
  "cdj-sound": s({ pos: [-1.05, 0.95, 1.3], target: CDJL, fov: 28, key: 0.16, rim: 0.42, env: 0.18, power: 0.5, led: 0.75, venue: 0.08, fit: 0.8 }),
  // Rear-booth cable plug-in: starts dark (no club), normal black cables slide into rear sockets -> club lights turn on!
  signal: s({ pos: [0.06, 0.27, -0.78], target: [0.0, 0.14, 0.18], fov: 44, key: 0.24, rim: 0.72, env: 0.28, power: 0.06, led: 0.12, signal: 1, demo: 0, venue: 0, fit: 0.85 }),
  "djm-intro": s({ pos: [0.0, 0.96, 0.28], target: [0, 0.0, 0.0], fov: 30, key: 0.96, rim: 0.68, env: 0.52, demo: 0.75, venue: 0.14, fit: 0.9 }),
  "djm-channels": s({ pos: [-0.04, 0.38, 0.25], target: [0.0, 0.095, -0.065], fov: 30, key: 0.84, rim: 0.92, env: 0.54, demo: 1, venue: 0.12, fit: 0.55 }),
  "djm-ess": s({ pos: [0.54, 0.42, 0.76], target: [0.0, 0.06, 0.0], fov: 27, key: 0.34, rim: 0.82, env: 0.36, demo: 0.65, venue: 0.1, fit: 0.7 }),
  // Tight macro on DJM-A9 Sound Color FX knobs & CENTER LOCK
  "djm-color": s({ pos: [-0.06, 0.265, 0.2], target: [-0.035, 0.105, -0.015], fov: 26, key: 0.76, rim: 1.05, spot: 0.58, env: 0.58, demo: 0.85, venue: 0.1, fit: 0.45 }),
  // Tight macro on Beat FX colour display, X-PAD & blue ON/OFF dome
  "djm-beatfx": s({ pos: [0.34, 0.34, 0.16], target: [0.16, 0.095, -0.055], fov: 28, key: 0.64, rim: 0.94, env: 0.54, demo: 0.9, venue: 0.14, fit: 0.45 }),
  // Elevated top-down angle showing the 3rd-gen MAGVEL FADER & all 4 channel faders clearly from above
  "djm-fader": s({ pos: [0.02, 0.56, 0.46], target: [-0.008, 0.09, 0.21], fov: 29, key: 0.82, rim: 1.15, spot: 0.56, env: 0.58, demo: 0.78, venue: 0.12, fit: 0.48 }),
  "djm-phones": s({ pos: [0.0, 0.72, 0.78], target: [0, 0.045, 0.05], fov: 33, key: 0.82, rim: 0.92, env: 0.5, demo: 0.75, venue: 0.12, fit: 0.85 }),
  pov: s({ pos: [0.0, 0.48, 0.84], target: [0, 0.34, -3], fov: 50, exposure: 1.08, key: 0.14, rim: 0.52, env: 0.2, venue: 1, crowd: 1, demo: 1, fit: 0.6 }),
  final: s({ pos: [0.92, 0.62, 1.22], target: [-0.02, 0.02, -0.02], fov: 27, exposure: 1.1, key: 0.98, rim: 1.24, env: 0.56, power: 1, led: 1, venue: 0.24, crowd: 0, demo: 0.6, fit: 0.95 }),
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
 * When dwell > 0 (e.g. 0.54), the shot holds cleanly on anchor[i] for the first
 * portion of the section so the 3D subject stays locked while reading/interacting,
 * then transitions smoothly in the remaining travel toward anchor[i + 1].
 */
export function sampleShots(
  anchors: Anchor[],
  y: number,
  out: Shot,
  dwell = 0,
): { segment: number; t: number; activeId: string } {
  if (anchors.length === 0) {
    Object.assign(out, cloneShot(DEFAULT_SHOT));
    return { segment: 0, t: 0, activeId: "hero" };
  }
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (y <= first.y) {
    mixShots(resolveShot(first.id), resolveShot(first.id), 0, out);
    return { segment: 0, t: 0, activeId: first.id };
  }
  if (y >= last.y) {
    mixShots(resolveShot(last.id), resolveShot(last.id), 0, out);
    return { segment: anchors.length - 1, t: 1, activeId: last.id };
  }
  let i = 0;
  while (i < anchors.length - 1 && anchors[i + 1]!.y < y) i++;
  const a = anchors[i]!;
  const b = anchors[i + 1]!;
  const raw = clamp((y - a.y) / Math.max(1, b.y - a.y));
  const clampedDwell = clamp(dwell, 0, 0.85);
  const remapped = clampedDwell > 0 ? clamp((raw - clampedDwell) / (1 - clampedDwell)) : raw;
  const t = smootherstep(remapped);
  mixShots(resolveShot(a.id), resolveShot(b.id), t, out);
  return { segment: i, t: raw, activeId: remapped > 0.65 ? b.id : a.id };
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
