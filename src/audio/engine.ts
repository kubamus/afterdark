/**
 * AFTER DARK — Procedural Web Audio Engine (124 BPM, C minor)
 *
 * Original underground club synthesis:
 *  - Deck B (Channel 3): Room track — deep sub-kick, rolling minimal bass, crisp 909 hats,
 *    dub-techno chord stabs. Evolves continuously with the narrative scroll progression.
 *  - Deck A (Channel 2): Visitor's peak-time track — punchy transient kick, driving C-minor
 *    bassline, crisp layered clap, open/closed 909 hats, and hypnotic melodic synth lead.
 *  - Real DJM-A9-inspired DSP routing:
 *      · Sound Color FX modes: FILTER (resonant LP/HP), SWEEP (resonant bandpass vocal sweep),
 *        DUB ECHO (tempo-synced dotted-8th feedback delay!).
 *      · Center Lock detent click at 0.
 *      · Momentary Beat FX tension roll/build trigger.
 *      · MAGVEL Crossfader blending Deck A and Deck B.
 *  - Real-time AnalyserNode metering + coherent 124 BPM silent clock for visual parity.
 *
 * Strictly opt-in: AudioContext is created and resumed only on explicit user interaction.
 */
import { clamp, dbToUnit, gainToDb } from "@/lib/math";
import { frame, ui } from "@/lib/store";

const BPM = 124;
const STEP_SEC = 60 / BPM / 4; // 16th-note (~120.97 ms)
const DOTTED_8TH_SEC = STEP_SEC * 3; // ~362.9 ms dub-echo delay time

const NOTE = {
  C2: 65.41,
  D2: 73.42,
  Eb2: 77.78,
  F2: 87.31,
  G2: 98.0,
  Bb2: 116.54,
  C3: 130.81,
  Eb3: 155.56,
  F3: 174.61,
  G3: 196.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  Eb4: 311.13,
  G4: 392.0,
  Bb4: 466.16,
  C5: 523.25,
} as const;

const DECK_A_BASS: (number | null)[] = [
  NOTE.C2, null, NOTE.C2, NOTE.Eb2, null, NOTE.G2, null, NOTE.F2,
  NOTE.C2, null, NOTE.Bb2 * 0.5, null, NOTE.Eb2, null, NOTE.G2, NOTE.F2,
];
const DECK_A_LEAD: (number | null)[] = [
  NOTE.C4, null, NOTE.Eb4, null, NOTE.G4, null, NOTE.Bb4, NOTE.G4,
  NOTE.C5, null, NOTE.Bb4, NOTE.G4, null, NOTE.Eb4, NOTE.D4, null,
];
const DECK_B_BASS: (number | null)[] = [
  NOTE.C2, null, null, NOTE.C2, null, null, NOTE.Eb2, null,
  NOTE.C2, null, null, NOTE.G2 * 0.5, null, NOTE.Bb2 * 0.5, null, null,
];

function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function createRoomImpulse(ctx: AudioContext, duration = 2.0, decay = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, decay);
      data[i] = (Math.random() * 2 - 1) * env * 0.58;
    }
  }
  return buf;
}

function rms(buf: Float32Array<ArrayBuffer>): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i]!;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private masterGain: GainNode | null = null;
  private reverbSend: ConvolverNode | null = null;

  // Deck A (Ch 2) signal chain + Sound Color FX (LP, HP, Sweep BP, Tempo Dub Echo)
  private deckABus: GainNode | null = null;
  private deckALowpass: BiquadFilterNode | null = null;
  private deckAHighpass: BiquadFilterNode | null = null;
  private deckASweep: BiquadFilterNode | null = null;
  private deckADubSend: GainNode | null = null;
  private deckADubFilter: BiquadFilterNode | null = null;
  private deckADubFeedback: GainNode | null = null;
  private deckAFader: GainNode | null = null;
  private deckACueBus: GainNode | null = null;
  private deckAAnalyser: AnalyserNode | null = null;

  // Deck B (Ch 3)
  private deckBBus: GainNode | null = null;
  private deckBFilter: BiquadFilterNode | null = null;
  private deckBGain: GainNode | null = null;
  private deckBAnalyser: AnalyserNode | null = null;

  // Master L/R Analysers
  private masterLAnalyser: AnalyserNode | null = null;
  private masterRAnalyser: AnalyserNode | null = null;
  private meterBufA = new Float32Array(256);
  private meterBufB = new Float32Array(256);
  private meterBufL = new Float32Array(256);
  private meterBufR = new Float32Array(256);

  // Ambient sub room tone
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private enabled = false;
  private silentPhase = 0;
  private lastCenterLocked = false;
  private smoothLevels = new Float32Array(6);

  private ensureContext(): boolean {
    if (this.ctx) return true;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      ui.set({ sound: "unavailable" });
      return false;
    }

    const ctx = new AudioCtx();
    this.ctx = ctx;
    this.noiseBuf = createNoiseBuffer(ctx, 2.0);

    // Master limiter -> master gain -> stereo split analysers -> destination
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -7;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    this.masterGain = masterGain;

    const splitter = ctx.createChannelSplitter(2);
    const anaL = ctx.createAnalyser();
    const anaR = ctx.createAnalyser();
    anaL.fftSize = 256;
    anaR.fftSize = 256;
    this.masterLAnalyser = anaL;
    this.masterRAnalyser = anaR;

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);
    masterGain.connect(splitter);
    splitter.connect(anaL, 0);
    splitter.connect(anaR, 1);

    // Dark warehouse space reverb
    const reverb = ctx.createConvolver();
    reverb.buffer = createRoomImpulse(ctx, 2.0, 2.6);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.28;
    reverb.connect(revGain);
    revGain.connect(compressor);
    this.reverbSend = reverb;

    // Deck A (Ch 2) chain: bus -> LP -> HP -> Sweep Peak -> Fader -> Compressor
    const deckABus = ctx.createGain();
    deckABus.gain.value = 0.96;

    const deckALowpass = ctx.createBiquadFilter();
    deckALowpass.type = "lowpass";
    deckALowpass.frequency.value = 18000;
    deckALowpass.Q.value = 1.4;

    const deckAHighpass = ctx.createBiquadFilter();
    deckAHighpass.type = "highpass";
    deckAHighpass.frequency.value = 22;
    deckAHighpass.Q.value = 1.4;

    const deckASweep = ctx.createBiquadFilter();
    deckASweep.type = "peaking";
    deckASweep.frequency.value = 1000;
    deckASweep.Q.value = 3.5;
    deckASweep.gain.value = 0;

    // Parallel Tempo-Synced Dub Echo loop (dotted 8th at 124 BPM)
    const dubSend = ctx.createGain();
    dubSend.gain.value = 0;
    const dubDelay = ctx.createDelay(1.0);
    dubDelay.delayTime.value = DOTTED_8TH_SEC;
    const dubFilter = ctx.createBiquadFilter();
    dubFilter.type = "bandpass";
    dubFilter.frequency.value = 1100;
    dubFilter.Q.value = 1.2;
    const dubFeedback = ctx.createGain();
    dubFeedback.gain.value = 0.56;

    const deckAFader = ctx.createGain();
    deckAFader.gain.value = 0;
    const deckACueBus = ctx.createGain();
    deckACueBus.gain.value = 0;
    const deckAAnalyser = ctx.createAnalyser();
    deckAAnalyser.fftSize = 256;

    deckABus.connect(deckALowpass);
    deckALowpass.connect(deckAHighpass);
    deckAHighpass.connect(deckASweep);
    deckASweep.connect(deckAFader);
    deckASweep.connect(deckACueBus);

    // Dub echo taps post-fader / post-filter so echo tails ring cleanly even on cuts
    deckASweep.connect(dubSend);
    dubSend.connect(dubDelay);
    dubDelay.connect(dubFilter);
    dubFilter.connect(dubFeedback);
    dubFeedback.connect(dubDelay);
    dubFilter.connect(deckAFader);

    deckAFader.connect(compressor);
    deckAFader.connect(deckAAnalyser);
    deckACueBus.connect(compressor);
    deckACueBus.connect(deckAAnalyser);

    this.deckABus = deckABus;
    this.deckALowpass = deckALowpass;
    this.deckAHighpass = deckAHighpass;
    this.deckASweep = deckASweep;
    this.deckADubSend = dubSend;
    this.deckADubFilter = dubFilter;
    this.deckADubFeedback = dubFeedback;
    this.deckAFader = deckAFader;
    this.deckACueBus = deckACueBus;
    this.deckAAnalyser = deckAAnalyser;

    // Deck B (Ch 3) chain
    const deckBBus = ctx.createGain();
    deckBBus.gain.value = 0.88;
    const deckBFilter = ctx.createBiquadFilter();
    deckBFilter.type = "lowpass";
    deckBFilter.frequency.value = 420;
    deckBFilter.Q.value = 1.0;
    const deckBGain = ctx.createGain();
    deckBGain.gain.value = 0.45;
    const deckBAnalyser = ctx.createAnalyser();
    deckBAnalyser.fftSize = 256;

    deckBBus.connect(deckBFilter);
    deckBFilter.connect(deckBGain);
    deckBGain.connect(compressor);
    deckBGain.connect(deckBAnalyser);

    this.deckBBus = deckBBus;
    this.deckBFilter = deckBFilter;
    this.deckBGain = deckBGain;
    this.deckBAnalyser = deckBAnalyser;

    // Subtle dark venue sub-room tone
    const droneOsc = ctx.createOscillator();
    droneOsc.type = "sine";
    droneOsc.frequency.value = NOTE.C2 * 0.5;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.04;
    droneOsc.connect(droneGain);
    droneGain.connect(compressor);
    droneOsc.start();
    this.droneOsc = droneOsc;
    this.droneGain = droneGain;

    return true;
  }

  async toggle(): Promise<void> {
    if (this.enabled) {
      this.disable();
    } else {
      await this.enable();
    }
  }

  async enable(): Promise<void> {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.enabled = true;
    ui.set({ sound: "on" });
    this.masterGain.gain.setTargetAtTime(0.82, this.ctx.currentTime, 0.12);

    if (this.schedulerId === null) {
      this.nextStepTime = this.ctx.currentTime + 0.04;
      this.schedulerId = window.setInterval(() => this.schedule(), 26);
    }
  }

  disable(): void {
    this.enabled = false;
    ui.set({ sound: "off" });
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
    }
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  playClick(kind: "button" | "detent" = "button"): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(kind === "detent" ? 1480 : 960, now);
    osc.frequency.exponentialRampToValueAtTime(kind === "detent" ? 440 : 185, now + 0.022);
    g.gain.setValueAtTime(kind === "detent" ? 0.08 : 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  /** Plays a tactile C-minor club synth stab when triggering any of the 8 CDJ Hot Cue pads A–H. */
  playHotCue(index: number): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const scale = [NOTE.C3, NOTE.Eb3, NOTE.F3, NOTE.G3, NOTE.Bb3, NOTE.C4, NOTE.Eb4, NOTE.G4];
    const freq = scale[Math.abs(index) % scale.length] ?? NOTE.C4;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, now);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3600, now);
    lp.frequency.exponentialRampToValueAtTime(420, now + 0.24);
    lp.Q.value = 3.2;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    if (this.reverbSend) g.connect(this.reverbSend);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  private schedule(): void {
    if (!this.ctx || !this.enabled) return;
    const lookAhead = 0.11;
    while (this.nextStepTime < this.ctx.currentTime + lookAhead) {
      this.triggerStep(this.currentStep, this.nextStepTime);
      this.nextStepTime += STEP_SEC;
      this.currentStep = (this.currentStep + 1) % 16;
    }
  }

  private triggerStep(step: number, time: number): void {
    if (!this.ctx || !this.deckABus || !this.deckBBus) return;
    const act = ui.get().act;
    const isStill = act === "still";
    const isHero = act === "hero";
    const bfxRoll = frame.controls.beatFxHold;

    // ----- Deck B (Room Track) -----
    if (!isStill) {
      if (step % 4 === 0 && !bfxRoll) {
        this.synthKick(time, this.deckBBus, isHero ? 0.58 : 0.88, 122, 42, 0.34);
      }
      if (!isHero && step % 4 === 2) {
        this.synthHat(time, this.deckBBus, 0.19, 0.09, 7400);
      } else if (!isHero && step % 2 === 1) {
        this.synthHat(time, this.deckBBus, 0.075, 0.03, 9200);
      }
      const bNote = DECK_B_BASS[step];
      if (bNote) {
        this.synthBass(time, this.deckBBus, bNote, isHero ? 0.22 : 0.36, 0.2, 280);
      }
      if (!isHero && (step === 6 || step === 14)) {
        this.synthDubChord(time, this.deckBBus, step === 6 ? 0.13 : 0.09);
      }
    }

    // ----- Deck A (Visitor's Peak-Time Track) -----
    const deckAActive = frame.controls.playing || frame.controls.cueHeld;
    if (deckAActive && !isStill) {
      if (bfxRoll) {
        // Beat FX ROLL build: rapid 16th-note tension snare + rising synth stabs!
        this.synthClap(time, this.deckABus, 0.16 + (step % 4) * 0.045);
        this.synthLead(time, this.deckABus, NOTE.C4 * (1 + (step % 8) * 0.06), 0.14);
      } else {
        if (step % 4 === 0) {
          this.synthKick(time, this.deckABus, 1.0, 158, 44, 0.3);
        }
        if (step === 4 || step === 12) {
          this.synthClap(time, this.deckABus, 0.28);
        }
        if (step % 2 === 0) {
          this.synthHat(time, this.deckABus, step % 4 === 2 ? 0.25 : 0.1, step % 4 === 2 ? 0.1 : 0.028, 8200);
        }
        const aBass = DECK_A_BASS[step];
        if (aBass) {
          this.synthBass(time, this.deckABus, aBass, 0.46, 0.16, 560);
        }
        const aLead = DECK_A_LEAD[step];
        if (aLead) {
          this.synthLead(time, this.deckABus, aLead, 0.17);
        }
      }
    }
  }

  private synthKick(time: number, dest: AudioNode, gainAmt: number, startHz: number, endHz: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startHz, time);
    osc.frequency.exponentialRampToValueAtTime(endHz, time + 0.05);
    osc.frequency.exponentialRampToValueAtTime(34, time + dur);
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private synthHat(time: number, dest: AudioNode, gainAmt: number, dur: number, hpHz: number): void {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = hpHz;
    const g = ctxGain(this.ctx, gainAmt, time, dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(dest);
    src.start(time, Math.random() * 0.8, dur + 0.02);
  }

  private synthClap(time: number, dest: AudioNode, gainAmt: number): void {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1420;
    bp.Q.value = 1.5;
    const g = ctxGain(this.ctx, gainAmt, time, 0.14);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    if (this.reverbSend) g.connect(this.reverbSend);
    src.start(time, Math.random() * 0.5, 0.16);
  }

  private synthBass(time: number, dest: AudioNode, freq: number, gainAmt: number, dur: number, cutoff: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(cutoff * 2.1, time);
    lp.frequency.exponentialRampToValueAtTime(cutoff * 0.5, time + dur);
    lp.Q.value = 3.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private synthDubChord(time: number, dest: AudioNode, gainAmt: number): void {
    const ctx = this.ctx!;
    const freqs = [NOTE.C3, NOTE.Eb3, NOTE.G3, NOTE.Bb3];
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1600, time);
    lp.frequency.exponentialRampToValueAtTime(240, time + 0.44);
    lp.Q.value = 2.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.46);
    lp.connect(g);
    g.connect(dest);
    if (this.reverbSend) g.connect(this.reverbSend);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, time);
      osc.connect(lp);
      osc.start(time);
      osc.stop(time + 0.48);
    }
  }

  private synthLead(time: number, dest: AudioNode, freq: number, gainAmt: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, time);
    lp.frequency.exponentialRampToValueAtTime(480, time + 0.17);
    lp.Q.value = 2.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    if (this.reverbSend) g.connect(this.reverbSend);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  tick(dt: number): void {
    const { playing, cueHeld, filter, colorFx, fader, crossfader, beatFxHold } = frame.controls;
    const act = ui.get().act;
    const progress = frame.progress;

    const beatsPerSec = BPM / 60;
    this.silentPhase = (this.silentPhase + dt * beatsPerSec) % 4;
    const beatFrac = this.silentPhase % 1;
    frame.beat = this.silentPhase;

    // Center Lock haptic/audio click when snapping into 0
    const isLocked = Math.abs(filter) < 0.045;
    if (isLocked && !this.lastCenterLocked) {
      this.playClick("detent");
    }
    this.lastCenterLocked = isLocked;

    // Equal-power MAGVEL Crossfader curve (-1 = full Deck A, 0 = both, +1 = full Deck B)
    const xfA = crossfader > 0 ? Math.cos(crossfader * Math.PI * 0.5) : 1;
    const xfB = crossfader < 0 ? Math.cos(-crossfader * Math.PI * 0.5) : 1;

    // Emotional release score: peaks when Deck A is playing, filter is open, and fader is up
    const filterOpenness = 1 - clamp(Math.abs(filter), 0, 1);
    const releaseTarget =
      playing && fader * xfA > 0.5 && filterOpenness > 0.45 && !beatFxHold
        ? clamp(((fader * xfA - 0.45) / 0.55) * filterOpenness, 0, 1)
        : 0;
    frame.release += (releaseTarget - frame.release) * (1 - Math.exp(-3.8 * dt));

    if (releaseTarget > 0.55 && !ui.get().released) {
      ui.set({ released: true });
    }

    if (
      this.enabled &&
      this.ctx &&
      this.deckALowpass &&
      this.deckAHighpass &&
      this.deckASweep &&
      this.deckADubSend &&
      this.deckADubFilter &&
      this.deckADubFeedback &&
      this.deckAFader &&
      this.deckACueBus &&
      this.deckBFilter &&
      this.deckBGain &&
      this.droneGain
    ) {
      const now = this.ctx.currentTime;
      const dead = 0.045;
      const absF = Math.abs(filter);

      if (colorFx === "filter") {
        this.deckASweep.gain.setTargetAtTime(0, now, 0.03);
        this.deckADubSend.gain.setTargetAtTime(beatFxHold ? 0.45 : 0, now, 0.04);
        if (filter < -dead) {
          const norm = clamp((-filter - dead) / (1 - dead), 0, 1);
          const lpHz = 18000 * Math.pow(120 / 18000, norm);
          this.deckALowpass.frequency.setTargetAtTime(lpHz, now, 0.022);
          this.deckALowpass.Q.setTargetAtTime(1.4 + norm * 5.6, now, 0.022);
          this.deckAHighpass.frequency.setTargetAtTime(22, now, 0.022);
          this.deckAHighpass.Q.setTargetAtTime(0.7, now, 0.022);
        } else if (filter > dead) {
          const norm = clamp((filter - dead) / (1 - dead), 0, 1);
          const hpHz = 22 * Math.pow(4200 / 22, norm);
          this.deckAHighpass.frequency.setTargetAtTime(hpHz, now, 0.022);
          this.deckAHighpass.Q.setTargetAtTime(1.4 + norm * 5.2, now, 0.022);
          this.deckALowpass.frequency.setTargetAtTime(18000, now, 0.022);
          this.deckALowpass.Q.setTargetAtTime(0.7, now, 0.022);
        } else {
          this.deckALowpass.frequency.setTargetAtTime(18000, now, 0.02);
          this.deckALowpass.Q.setTargetAtTime(0.7, now, 0.02);
          this.deckAHighpass.frequency.setTargetAtTime(22, now, 0.02);
          this.deckAHighpass.Q.setTargetAtTime(0.7, now, 0.02);
        }
      } else if (colorFx === "sweep") {
        // Resonant DJM Sweep: sweeping vocal bandpass gate & resonant formant boost
        this.deckADubSend.gain.setTargetAtTime(beatFxHold ? 0.4 : 0, now, 0.04);
        const norm = clamp((absF - dead) / (1 - dead), 0, 1);
        const sweepHz = filter < 0 ? 900 * Math.pow(180 / 900, norm) : 900 * Math.pow(4600 / 900, norm);
        this.deckASweep.frequency.setTargetAtTime(sweepHz, now, 0.022);
        this.deckASweep.Q.setTargetAtTime(2.5 + norm * 5.0, now, 0.022);
        this.deckASweep.gain.setTargetAtTime(norm * 13, now, 0.025);
        this.deckALowpass.frequency.setTargetAtTime(filter < -dead ? 16000 * Math.pow(450 / 16000, norm) : 18000, now, 0.025);
        this.deckAHighpass.frequency.setTargetAtTime(filter > dead ? 24 * Math.pow(1400 / 24, norm) : 22, now, 0.025);
      } else {
        // Tempo-synced DUB ECHO (dotted 8th delay tails + filtered dub wash)
        this.deckASweep.gain.setTargetAtTime(0, now, 0.03);
        const norm = clamp((absF - dead) / (1 - dead), 0, 1);
        this.deckADubSend.gain.setTargetAtTime(norm * 0.85 + (beatFxHold ? 0.35 : 0), now, 0.03);
        this.deckADubFilter.frequency.setTargetAtTime(filter < 0 ? 520 : 2100, now, 0.03);
        this.deckADubFeedback.gain.setTargetAtTime(0.35 + norm * 0.38, now, 0.03);
        this.deckALowpass.frequency.setTargetAtTime(filter < -dead ? 18000 * Math.pow(900 / 18000, norm) : 18000, now, 0.025);
        this.deckAHighpass.frequency.setTargetAtTime(filter > dead ? 22 * Math.pow(1200 / 22, norm) : 22, now, 0.025);
      }

      const faderGain = playing ? Math.pow(clamp(fader), 1.55) * xfA * 0.96 : 0;
      const cueGain = !playing && cueHeld ? 0.38 : 0;
      this.deckAFader.gain.setTargetAtTime(faderGain, now, 0.02);
      this.deckACueBus.gain.setTargetAtTime(cueGain, now, 0.015);

      let bCutoff = 280 + progress * 2400;
      let bGain = 0.58 * xfB;
      let droneLevel = 0.045;
      if (act === "hero") {
        bCutoff = 220;
        bGain = 0.38;
        droneLevel = 0.06;
      } else if (act === "control") {
        bCutoff = 1800 + frame.release * 3400;
        bGain = (0.64 - fader * 0.12) * xfB;
        droneLevel = 0.02;
      } else if (act === "moment") {
        bCutoff = 5200;
        bGain = 0.8;
        droneLevel = 0.025;
      } else if (act === "still") {
        bCutoff = 140;
        bGain = 0.02;
        droneLevel = 0.015;
      } else if (act === "final") {
        bCutoff = 1050;
        bGain = 0.45;
        droneLevel = 0.03;
      }
      this.deckBFilter.frequency.setTargetAtTime(bCutoff, now, 0.16);
      this.deckBGain.gain.setTargetAtTime(bGain, now, 0.12);
      this.droneGain.gain.setTargetAtTime(droneLevel, now, 0.25);
    }

    const kickEnv = Math.exp(-beatFrac * 5.6);
    const offHat = Math.exp(-(((beatFrac + 0.5) % 1) * 9.5));
    const isStill = act === "still";

    let ch2 = 0;
    let ch3 = 0;
    let mL = 0;
    let mR = 0;

    if (this.enabled && this.deckAAnalyser && this.deckBAnalyser && this.masterLAnalyser && this.masterRAnalyser) {
      this.deckAAnalyser.getFloatTimeDomainData(this.meterBufA);
      this.deckBAnalyser.getFloatTimeDomainData(this.meterBufB);
      this.masterLAnalyser.getFloatTimeDomainData(this.meterBufL);
      this.masterRAnalyser.getFloatTimeDomainData(this.meterBufR);

      ch2 = dbToUnit(gainToDb(rms(this.meterBufA) * 2.2), -34, 2);
      ch3 = dbToUnit(gainToDb(rms(this.meterBufB) * 2.2), -34, 2);
      mL = dbToUnit(gainToDb(rms(this.meterBufL) * 2.15), -34, 2);
      mR = dbToUnit(gainToDb(rms(this.meterBufR) * 2.15), -34, 2);
    } else if (!isStill) {
      const deckAActive = playing || cueHeld;
      const filterEnergy = colorFx === "dubecho" ? 0.65 + 0.35 * Math.abs(filter) : 0.34 + 0.66 * (1 - Math.abs(filter) * 0.72);
      const effectiveA = playing ? fader * xfA : cueHeld ? 0.58 : 0;
      const rollBoost = beatFxHold ? 0.22 * Math.abs(Math.sin(this.silentPhase * Math.PI * 4)) : 0;
      ch2 = deckAActive ? clamp((0.3 + 0.64 * kickEnv + 0.16 * offHat + rollBoost) * effectiveA * filterEnergy) : 0;
      ch3 = clamp((0.26 + 0.54 * kickEnv + 0.14 * offHat) * xfB);
      const sum = clamp(ch3 * 0.76 + (playing ? ch2 * 0.68 : 0));
      mL = sum;
      mR = clamp(sum * (0.96 + 0.06 * Math.sin(this.silentPhase * 3.1)));
    }

    const targets = [0, ch2, ch3, 0, mL, mR];
    const attack = 1 - Math.exp(-30 * dt);
    const releaseRate = 1 - Math.exp(-9 * dt);
    for (let i = 0; i < 6; i++) {
      const t = targets[i]!;
      const cur = this.smoothLevels[i]!;
      const rate = t > cur ? attack : releaseRate;
      this.smoothLevels[i] = cur + (t - cur) * rate;
      frame.levels[i] = this.smoothLevels[i]!;
    }

    frame.kick = isStill ? 0 : kickEnv * (0.45 + 0.55 * Math.max(mL, ch3));
    frame.bass = isStill ? 0 : clamp(mL * 0.85 + kickEnv * 0.25);
    frame.energy = isStill ? 0 : clamp((mL + mR) * 0.5);
  }

  dispose(): void {
    this.disable();
    if (this.droneOsc) {
      try {
        this.droneOsc.stop();
      } catch {
        // already stopped
      }
      this.droneOsc = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

function ctxGain(ctx: AudioContext, gainAmt: number, time: number, dur: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(gainAmt, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  return g;
}

export const audioEngine = new AudioEngine();
