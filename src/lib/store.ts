/**
 * Shared, framework-agnostic runtime state.
 *
 * High-frequency values (scroll, audio levels, control positions, hardware micro-states)
 * are plain mutable fields read by the render loop every frame — no React re-renders.
 * Low-frequency UI state goes through a tiny subscribe/emit store for useSyncExternalStore.
 */

export type ColorFxMode = "filter" | "sweep" | "dubecho";

export interface DeckControls {
  /** deck 1 playing (the visitor's track) */
  playing: boolean;
  /** CUE held while paused (preview) */
  cueHeld: boolean;
  /** Sound Color FX knob, −1 (LOW) … 0 (CENTER) … +1 (HI) */
  filter: number;
  /** Active Sound Color FX mode on DJM-A9 */
  colorFx: ColorFxMode;
  /** DJM-A9 Center Lock switch (prevents overshooting 0 on fast sweeps) */
  centerLock: boolean;
  /** channel 2 fader, 0 … 1 */
  fader: number;
  /** MAGVEL crossfader, −1 (Deck 1 / A) … 0 (center) … +1 (Deck 2 / B) */
  crossfader: number;
  /** Beat FX momentary roll/echo build trigger */
  beatFxHold: boolean;
  /** Currently selected Beat FX name in Act IV */
  activeBeatFx: string;
  /** CDJ-3000X Jog Feel tension (0 = light, 1 = heavy) */
  jogFeel: number;
  /** Instantaneous jog angular nudge velocity (rad/s) */
  jogVelocity: number;
  /** Manual override for CDJ screen display in Act III (null = scroll-driven) */
  screenMode: "play" | "browse" | null;
  /** Momentary visual button press impulse for Act III 500k-press demo (0..1) */
  demoPlayPulse: number;
  /** Individual 8 Hot Cue pad trigger impulses (0..1 decaying) */
  hotCuePulses: Float32Array;
}

export interface Frame {
  /** smoothed scroll position in px */
  scrollY: number;
  viewportH: number;
  /** 0..1 over the whole document */
  progress: number;
  /** currently active shot id from cinematography sampler */
  activeShot: string;
  /** 0..1 progress within the current shot segment */
  shotLocalT: number;
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
  activeShot: "hero",
  shotLocalT: 0,
  levels: new Float32Array(6),
  bass: 0,
  energy: 0,
  kick: 0,
  beat: 0,
  release: 0,
  controls: {
    playing: false,
    cueHeld: false,
    filter: -0.78,
    colorFx: "filter",
    centerLock: true,
    fader: 0,
    crossfader: 0,
    beatFxHold: false,
    activeBeatFx: "Mobius",
    jogFeel: 0.45,
    jogVelocity: 0,
    screenMode: null,
    demoPlayPulse: 0,
    hotCuePulses: new Float32Array(8),
  },
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
  colorFx: ColorFxMode;
  centerLock: boolean;
  beatFxHold: boolean;
  /** the visitor has released their track into the room */
  released: boolean;
  act: string;
  activeShot: string;
  /** Last triggered Hot Cue pad index (0..7) for subtle UI feedback */
  lastHotCue: number | null;
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
  colorFx: "filter",
  centerLock: true,
  beatFxHold: false,
  released: false,
  act: "hero",
  activeShot: "hero",
  lastHotCue: null,
});
