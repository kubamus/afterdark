export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : clamp((v - a) / (b - a)));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (t: number) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
/** Frame-rate independent exponential damping toward a target. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
/** 0 → -inf dB mapping to 0..1 meter scale with a floor (dB). */
export const dbToUnit = (db: number, floor = -36, ceil = 6) => clamp((db - floor) / (ceil - floor));
export const gainToDb = (g: number) => (g <= 1e-6 ? -120 : 20 * Math.log10(g));
