/**
 * Shared, framework-agnostic runtime state.
 *
 * High-frequency values (scroll, visual meter levels, control positions, hardware micro-states)
 * are plain mutable fields read by the render loop every frame — no React re-renders.
 * Low-frequency UI state goes through a tiny subscribe/emit store for useSyncExternalStore.
 */

export type ColorFxMode = "filter" | "sweep" | "dubecho";
export type JogInteractionMode = "idle" | "scratch" | "bend";

export interface DeckControls {
  /** deck 1 playing */
  playing: boolean;
  /** CUE physically held down right now (momentary) */
  cueHeld: boolean;
  /** PLAY physically held down right now (momentary) */
  playHeld: boolean;
  /** Momentary spring-back tap impulse for spammable PLAY presses (0..1) */
  playTapImpulse: number;
  /** Momentary spring-back tap impulse for spammable CUE stutters (0..1) */
  cueTapImpulse: number;
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
  /** Active Beat FX rhythmic division */
  beatFxDiv: "1/4" | "1/2" | "3/4" | "1" | "2";
  /** Interactive X-PAD horizontal touch position (0..1) */
  xpadPos: number;
  /** DJM-A9 FX Frequency band toggles */
  fxFreq: { low: boolean; mid: boolean; hi: boolean };
  /** Current manual jog wheel touch zone (top capacitive scratch vs outer dimpled pitch bend) */
  jogMode: JogInteractionMode;
  /** True while hand is resting on the capacitive top platter */
  jogTouchHeld: boolean;
  /** Weighted manual jog angular velocity (rad/s) — never motorized */
  jogVelocity: number;
  /** Instantaneous scratch velocity */
  jogScratchVel: number;
  /** Pitch bend amount (-1..+1) from nudging the outer dimpled rim */
  jogPitchBend: number;
  /** Manual override for CDJ screen display in Act III (null = scroll-driven) */
  screenMode: "play" | "browse" | null;
  /** Individual 8 Hot Cue pad trigger impulses (0..1 decaying) */
  hotCuePulses: Float32Array;
  /** Rear cable plug-in sequence progress (0..1: Power -> PRO DJ LINK -> XLR -> Club Lights) */
  cableIgnite: number;
  /** Active connection animation timer (seconds, -1 when idle) */
  cableIgniteTimer: number;
}

export interface Frame {
  scrollY: number;
  viewportH: number;
  /** 0..1 over the whole document */
  progress: number;
  /** currently active shot id from cinematography sampler */
  activeShot: string;
  /** 0..1 progress within the current shot segment */
  shotLocalT: number;
  /** visual 124 BPM meter levels (ch1..ch4, masterL, masterR) */
  levels: Float32Array;
  bass: number;
  energy: number;
  /** 0..1 visual pulse decaying after each 124 BPM beat */
  kick: number;
  beat: number;
  release: number;
  controls: DeckControls;
  pointerX: number;
  pointerY: number;
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
    playHeld: false,
    playTapImpulse: 0,
    cueTapImpulse: 0,
    filter: -0.78,
    colorFx: "filter",
    centerLock: true,
    fader: 0,
    crossfader: 0,
    beatFxHold: false,
    activeBeatFx: "Mobius",
    beatFxDiv: "1",
    xpadPos: 0.5,
    fxFreq: { low: true, mid: true, hi: true },
    jogMode: "idle",
    jogTouchHeld: false,
    jogVelocity: 0,
    jogScratchVel: 0,
    jogPitchBend: 0,
    screenMode: null,
    hotCuePulses: new Float32Array(8),
    cableIgnite: 0,
    cableIgniteTimer: -1,
  },
  pointerX: 0,
  pointerY: 0,
  canvasHidden: false,
};

export interface UIState {
  webgl: "pending" | "ready" | "unavailable";
  reducedMotion: boolean;
  playing: boolean;
  cueHeld: boolean;
  colorFx: ColorFxMode;
  centerLock: boolean;
  beatFxHold: boolean;
  released: boolean;
  act: string;
  activeShot: string;
  lastHotCue: number | null;
  jogMode: JogInteractionMode;
  ignitionStage: "idle" | "power" | "link" | "xlr" | "club";
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
  jogMode: "idle",
  ignitionStage: "idle",
});
