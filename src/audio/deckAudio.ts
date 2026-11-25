/**
 * Focused, section-scoped hardware audio engine.
 *
 * Zero global sound buttons or background noise — audio ONLY plays when the visitor
 * physically interacts with:
 *  - CDJ-3000X Jog Wheel (`cdj-jog`): real-time forward & reverse vinyl scratching of `/assets/audio/ahh-fresh.mp3`
 *  - CDJ-3000X PLAY / CUE (`cdj-playcue`): punchy 124 BPM club beat loop & spammable CUE downbeat stutters
 *
 * Automatically fades out smoothly over 0.55s whenever the visitor scrolls into another section.
 */

class DeckAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private scratchGain: GainNode | null = null;
  private deckGain: GainNode | null = null;

  private sampleFwd: AudioBuffer | null = null;
  private sampleRev: AudioBuffer | null = null;
  private loadingSample = false;

  // Continuous vinyl scratch playhead state (seconds inside ahh-fresh.mp3)
  private scratchPos = 0.08;
  private activeScratchSrc: AudioBufferSourceNode | null = null;
  private activeScratchDir: 1 | -1 | 0 = 0;
  private scratchEnvGain: GainNode | null = null;
  private lastScratchMoveMs = 0;

  // PLAY / CUE 124 BPM club loop scheduler
  private isPlaying = false;
  private cueHolding = false;
  private activeShot = "hero";
  private nextStepTime = 0;
  private stepIndex = 0;
  private schedulerTimer: number | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.scratchGain = this.ctx.createGain();
      this.scratchGain.gain.value = 0.92;
      this.scratchGain.connect(this.masterGain);

      this.scratchEnvGain = this.ctx.createGain();
      this.scratchEnvGain.gain.value = 0;
      this.scratchEnvGain.connect(this.scratchGain);

      this.deckGain = this.ctx.createGain();
      this.deckGain.gain.value = 0.78;
      this.deckGain.connect(this.masterGain);

      // Build short white-noise buffer for crisp club hi-hats & claps
      const nLen = Math.floor(this.ctx.sampleRate * 0.25);
      this.noiseBuf = this.ctx.createBuffer(1, nLen, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    if (!this.sampleFwd && !this.loadingSample) {
      void this.loadScratchSample();
    }
    return this.ctx;
  }

  private async loadScratchSample() {
    if (this.loadingSample || !this.ctx) return;
    this.loadingSample = true;
    try {
      const res = await fetch("/assets/audio/ahh-fresh.mp3");
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arr);
      this.sampleFwd = decoded;

      // Pre-compute reversed copy so backward platter rotation scratches seamlessly in reverse!
      const rev = this.ctx.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const src = decoded.getChannelData(ch);
        const dst = rev.getChannelData(ch);
        for (let i = 0, j = src.length - 1; i < src.length; i++, j--) {
          dst[i] = src[j]!;
        }
      }
      this.sampleRev = rev;
    } catch {
      // Ignore fetch/decode errors in headless environments
    } finally {
      this.loadingSample = false;
    }
  }

  /** Preload sample buffer silently once user interacts with the jog section. */
  warmUpScratch() {
    this.ensureContext();
  }

  /**
   * Real-time variable-speed forward/reverse vinyl scratch driven by circular jog velocity.
   * Positive angularVel = clockwise (forward scratch), negative = counter-clockwise (reverse).
   */
  updateScratch(angularVel: number, deltaAngle: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.scratchEnvGain || !this.sampleFwd || !this.sampleRev) return;

    const now = ctx.currentTime;
    const speed = Math.abs(angularVel);

    // Advance virtual needle position proportionally to physical platter angle (1 rev ≈ 1.45s of vinyl)
    const dur = this.sampleFwd.duration;
    const loopEnd = Math.min(dur, 4.2); // Focus on the iconic "Ahh / Fresh" phrase window
    const deltaSec = (deltaAngle / (Math.PI * 2)) * 1.45;
    this.scratchPos = ((this.scratchPos + deltaSec) % loopEnd + loopEnd) % loopEnd;

    if (speed < 0.25) {
      this.scratchEnvGain.gain.setTargetAtTime(0, now, 0.025);
      return;
    }

    this.lastScratchMoveMs = performance.now();
    const dir: 1 | -1 = angularVel >= 0 ? 1 : -1;
    // Map rad/s (real 33⅓ RPM ≈ 3.49 rad/s) to natural turntable pitch playbackRate
    const rate = Math.max(0.28, Math.min(3.4, speed / 3.6));

    // Restart source when direction flips or no source is playing
    if (!this.activeScratchSrc || this.activeScratchDir !== dir) {
      this.stopScratchSource();
      const src = ctx.createBufferSource();
      src.buffer = dir === 1 ? this.sampleFwd : this.sampleRev;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = loopEnd;
      src.playbackRate.setValueAtTime(rate, now);
      src.connect(this.scratchEnvGain);

      const startOffset = dir === 1 ? this.scratchPos : Math.max(0, loopEnd - this.scratchPos);
      try {
        src.start(now, startOffset % loopEnd);
      } catch {
        src.start(now, 0);
      }
      this.activeScratchSrc = src;
      this.activeScratchDir = dir;
    } else {
      this.activeScratchSrc.playbackRate.setTargetAtTime(rate, now, 0.018);
    }

    const vol = Math.min(1, 0.28 + speed * 0.14);
    this.scratchEnvGain.gain.setTargetAtTime(vol, now, 0.012);
  }

  /** Play a short demo scratch flick of ahh-fresh.mp3 when clicking the Top Platter card. */
  triggerDemoScratch() {
    const ctx = this.ensureContext();
    if (!ctx || !this.scratchEnvGain) return;
    const run = () => {
      if (!this.sampleFwd || !this.sampleRev) return;
      this.scratchPos = 0.06;
      this.updateScratch(5.4, 0.65);
      window.setTimeout(() => this.updateScratch(-6.2, -0.55), 160);
      window.setTimeout(() => this.updateScratch(4.8, 0.6), 310);
      window.setTimeout(() => this.silenceScratch(), 520);
    };
    if (this.sampleFwd) {
      run();
    } else {
      void this.loadScratchSample().then(run);
    }
  }

  silenceScratch() {
    if (!this.ctx || !this.scratchEnvGain) return;
    const now = this.ctx.currentTime;
    this.scratchEnvGain.gain.setTargetAtTime(0, now, 0.03);
    window.setTimeout(() => {
      if (performance.now() - this.lastScratchMoveMs > 120) {
        this.stopScratchSource();
      }
    }, 130);
  }

  private stopScratchSource() {
    if (this.activeScratchSrc) {
      try {
        this.activeScratchSrc.stop();
        this.activeScratchSrc.disconnect();
      } catch {
        // already stopped
      }
      this.activeScratchSrc = null;
      this.activeScratchDir = 0;
    }
  }

  // =========================================================================
  // PLAY / CUE 124 BPM CLUB BEAT + REAL HOLD-TO-PLAY CUE (Fades out outside section)
  // =========================================================================
  setPlaying(playing: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.deckGain) return;

    const now = ctx.currentTime;
    if (playing) {
      // Real CDJ handoff: pressing PLAY while holding CUE latches playback seamlessly without restarting!
      const alreadyGrooving = this.cueHolding && this.schedulerTimer !== null;
      this.isPlaying = true;
      this.cueHolding = false;
      this.deckGain.gain.cancelScheduledValues(now);
      this.deckGain.gain.setTargetAtTime(0.78, now, 0.02);
      if (!alreadyGrooving) {
        this.stepIndex = 0;
        this.nextStepTime = now + 0.01;
        this.startScheduler();
      }
    } else {
      this.isPlaying = false;
      this.cueHolding = false;
      this.deckGain.gain.cancelScheduledValues(now);
      this.deckGain.gain.setTargetAtTime(0.0001, now, 0.045);
      this.stopScheduler();
    }
  }

  /**
   * Real CDJ CUE press:
   * - While paused: plays continuously from the cue point (step 0) for as long as CUE is held.
   * - While playing: stops playback immediately and returns to the cue point.
   */
  startCueHold() {
    const ctx = this.ensureContext();
    if (!ctx || !this.deckGain) return;
    const now = ctx.currentTime;

    this.isPlaying = false;
    this.cueHolding = true;
    this.stopScheduler();
    this.deckGain.gain.cancelScheduledValues(now);
    this.deckGain.gain.setValueAtTime(Math.max(0.001, this.deckGain.gain.value), now);
    this.deckGain.gain.setTargetAtTime(0.8, now, 0.008);
    this.stepIndex = 0;
    this.nextStepTime = now + 0.006;
    this.startScheduler();
  }

  /** Stop active playback and jump back silently to the cue point (step 0). */
  stopToCue() {
    const ctx = this.ensureContext();
    this.isPlaying = false;
    this.cueHolding = false;
    this.stopScheduler();
    this.stepIndex = 0;
    if (!ctx || !this.deckGain) return;
    const now = ctx.currentTime;
    this.deckGain.gain.cancelScheduledValues(now);
    this.deckGain.gain.setTargetAtTime(0.0001, now, 0.015);
  }

  /**
   * Real CDJ CUE release:
   * If PLAY was not latched while holding CUE, stops immediately and snaps back to step 0.
   */
  releaseCueHold() {
    if (!this.cueHolding) return;
    this.cueHolding = false;
    if (this.isPlaying) return;
    this.stopScheduler();
    this.stepIndex = 0;
    if (!this.ctx || !this.deckGain) return;
    const now = this.ctx.currentTime;
    this.deckGain.gain.cancelScheduledValues(now);
    this.deckGain.gain.setTargetAtTime(0.0001, now, 0.014);
  }

  /** Smoothly fades out PLAY/CUE and scratch audio whenever user leaves their sections. */
  syncSection(activeShot: string) {
    if (activeShot === this.activeShot) return;
    this.activeShot = activeShot;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (activeShot !== "cdj-jog" && this.scratchEnvGain) {
      this.scratchEnvGain.gain.setTargetAtTime(0, now, 0.08);
      this.stopScratchSource();
    }

    if (activeShot !== "cdj-playcue" && (this.isPlaying || this.cueHolding) && this.deckGain) {
      // Smooth 0.55s fade-out as the user scrolls to another section
      this.isPlaying = false;
      this.cueHolding = false;
      this.deckGain.gain.cancelScheduledValues(now);
      this.deckGain.gain.setTargetAtTime(0.0001, now, 0.18);
      window.setTimeout(() => {
        if (!this.isPlaying && !this.cueHolding) this.stopScheduler();
      }, 620);
    }
  }

  /** Called every frame to auto-silence scratch if platter velocity decayed to rest. */
  tick(jogVelocity: number) {
    if (this.activeScratchSrc && Math.abs(jogVelocity) < 0.22 && performance.now() - this.lastScratchMoveMs > 90) {
      this.silenceScratch();
    }
  }

  private startScheduler() {
    if (this.schedulerTimer !== null) return;
    const stepDur = 60 / 124 / 4; // 16th-note at 124 BPM
    const loop = () => {
      if (!this.ctx || (!this.isPlaying && !this.cueHolding)) return;
      while (this.nextStepTime < this.ctx.currentTime + 0.1) {
        this.scheduleStep(this.stepIndex, this.nextStepTime);
        this.nextStepTime += stepDur;
        this.stepIndex = (this.stepIndex + 1) % 16;
      }
    };
    loop();
    this.schedulerTimer = window.setInterval(loop, 20);
  }

  private stopScheduler() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleStep(step: number, t: number) {
    // Classic 4-on-the-floor Berlin/Ibiza house groove
    if (step % 4 === 0) this.triggerKick(t);
    if (step % 4 === 2) this.triggerHat(t, 0.22); // crisp offbeat open hat
    else if (step % 2 === 1) this.triggerHat(t, 0.06);
    if (step === 4 || step === 12) this.triggerClap(t);
    const bassNotes = [55, 0, 55, 65.4, 0, 55, 73.4, 0, 55, 0, 55, 82.4, 0, 73.4, 65.4, 0];
    const hz = bassNotes[step] ?? 0;
    if (hz > 0) this.triggerBass(t, hz, 0.11);
  }

  private triggerKick(t: number) {
    if (!this.ctx || !this.deckGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(142, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.09);
    g.gain.setValueAtTime(0.72, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g);
    g.connect(this.deckGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private triggerBass(t: number, hz: number, dur: number) {
    if (!this.ctx || !this.deckGain) return;
    const osc = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(hz, t);
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(460, t);
    flt.frequency.exponentialRampToValueAtTime(140, t + dur);
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.03);
    osc.connect(flt);
    flt.connect(g);
    g.connect(this.deckGain);
    osc.start(t);
    osc.stop(t + dur + 0.04);
  }

  private triggerHat(t: number, vol: number) {
    if (!this.ctx || !this.deckGain || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (vol > 0.15 ? 0.09 : 0.03));
    src.connect(hp);
    hp.connect(g);
    g.connect(this.deckGain);
    src.start(t);
    src.stop(t + 0.1);
  }

  private triggerClap(t: number) {
    if (!this.ctx || !this.deckGain || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1450;
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.deckGain);
    src.start(t);
    src.stop(t + 0.13);
  }

  dispose() {
    this.stopScheduler();
    this.stopScratchSource();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const deckAudio = new DeckAudioEngine();
