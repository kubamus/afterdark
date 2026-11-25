/**
 * Shared, framework-agnostic runtime state.
 *
 * High-frequency values (scroll, audio levels, control positions) are plain mutable
 * fields read by the render loop every frame — no React re-renders involved.
 * Low-frequency UI state (sound on/off, deck transport) goes through a tiny
 * subscribe/emit store consumed with useSyncExternalStore.
 */

export interface DeckControls {
  /** deck 1 playing (the visitor's track) */
  playing: boolean;
  /** CUE held while paused (preview) */
  cueHeld: boolean;
  /** Sound Color FX FILTER, −1 (low-pass) … 0 (off) … +1 (high-pass) */
  filter: number;
  /** channel 2 fader, 0 … 1 */
  fader: number;
}

export interface Frame {
  /** smoothed scroll position in px */
  scrollY: number;
  viewportH: number;
  /** 0..1 over the whole document */
  progress: number;
  /** analysed / simulated audio */
  levels: Float32Array; // ch1, ch2, ch3, ch4, masterL, masterR — 0..1 meter scale
  bass: number;
  energy: number;
  /** 0..1 pulse that decays after each kick */
  kick: number;
  beat: number;
  /** venue intensity driven by the performance (0..1) */
  release: number;
  controls: DeckControls;
  pointerX: number;
  pointerY: number;
  /** true when an opaque DOM layer fully covers the canvas */
  canvasHidden: boolean;
}

export const frame: Frame = {
  scrollY: 0,
  viewportH: 1,
  progress: 0,
  levels: new Float32Array(6),
  bass: 0,
  energy: 0,
  kick: 0,
  beat: 0,
  release: 0,
  controls: { playing: false, cueHeld: false, filter: -0.85, fader: 0 },
  pointerX: 0,
  pointerY: 0,
  canvasHidden: false,
};

export interface UIState {
  sound: "off" | "on" | "unavailable";
  webgl: "pending" | "ready" | "unavailable";
  reducedMotion: boolean;
  playing: boolean;
  cueHeld: boolean;
  /** the visitor has released their track into the room */
  released: boolean;
  act: string;
}

type Listener = () => void;

function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<T>) {
      let changed = false;
      for (const k in patch) {
        if (!Object.is(state[k], patch[k])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const ui = createStore<UIState>({
  sound: "off",
  webgl: "pending",
  reducedMotion: false,
  playing: false,
  cueHeld: false,
  released: false,
  act: "hero",
});
