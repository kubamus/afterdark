"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audioEngine } from "@/audio/engine";
import { CONTROL } from "@/content/copy";
import { clamp } from "@/lib/math";
import { frame, ui, type ColorFxMode } from "@/lib/store";

const METER_SEGMENTS = 15;

const COLOR_FX_MODES: { id: ColorFxMode; label: string; desc: string }[] = [
  { id: "filter", label: "FILTER", desc: "Resonant LP / HP" },
  { id: "sweep", label: "SWEEP", desc: "Bandpass Gate" },
  { id: "dubecho", label: "DUB ECHO", desc: "3/16 Tempo Delay" },
];

function formatColorValue(v: number, mode: ColorFxMode): string {
  if (Math.abs(v) < 0.045) return "CENTER LOCK";
  const pct = Math.round(Math.abs(v) * 100);
  if (mode === "dubecho") return v < 0 ? `SUB ECHO ${pct}%` : `HI ECHO ${pct}%`;
  if (mode === "sweep") return v < 0 ? `GATE ${pct}%` : `SWEEP ${pct}%`;
  return v < 0 ? `LPF ${pct}%` : `HPF ${pct}%`;
}

export function ControlAct() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const meterRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const faderTrackRef = useRef<HTMLDivElement | null>(null);
  const crossTrackRef = useRef<HTMLDivElement | null>(null);
  const autoTimerRef = useRef<number | null>(null);

  const [filterVal, setFilterVal] = useState(frame.controls.filter);
  const [faderVal, setFaderVal] = useState(frame.controls.fader);
  const [crossVal, setCrossVal] = useState(frame.controls.crossfader);
  const [autoRunning, setAutoRunning] = useState(false);

  const sound = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().sound,
    () => "off" as const,
  );
  const playing = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().playing,
    () => false,
  );
  const cueHeld = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().cueHeld,
    () => false,
  );
  const colorFx = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().colorFx,
    () => "filter" as ColorFxMode,
  );
  const centerLock = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().centerLock,
    () => true,
  );
  const beatFxHold = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().beatFxHold,
    () => false,
  );
  const released = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().released,
    () => false,
  );

  const stopAutoSequence = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.cancelAnimationFrame(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoRunning(false);
  }, []);

  useEffect(() => () => stopAutoSequence(), [stopAutoSequence]);

  const updateFilter = useCallback(
    (raw: number, prevOverride?: number) => {
      let next = clamp(raw, -1, 1);
      const prev = prevOverride ?? frame.controls.filter;

      // Authentic DJM-A9 CENTER LOCK physics: blocks accidental overshoot across 0 during fast sweeps!
      if (frame.controls.centerLock) {
        if ((prev < -0.05 && next > 0.02) || (prev > 0.05 && next < -0.02)) {
          next = 0;
        } else if (Math.abs(next) < 0.055) {
          next = 0;
        }
      } else if (Math.abs(next) < 0.03) {
        next = 0;
      }

      frame.controls.filter = next;
      setFilterVal(next);
    },
    [],
  );

  const updateFader = useCallback((raw: number) => {
    const next = clamp(raw, 0, 1);
    frame.controls.fader = next;
    setFaderVal(next);
  }, []);

  const updateCrossfader = useCallback((raw: number) => {
    let next = clamp(raw, -1, 1);
    if (Math.abs(next) < 0.04) next = 0;
    frame.controls.crossfader = next;
    setCrossVal(next);
  }, []);

  const setMode = useCallback((mode: ColorFxMode) => {
    frame.controls.colorFx = mode;
    ui.set({ colorFx: mode });
    audioEngine.playClick("button");
  }, []);

  const toggleCenterLock = useCallback(() => {
    const next = !frame.controls.centerLock;
    frame.controls.centerLock = next;
    ui.set({ centerLock: next });
    audioEngine.playClick("detent");
  }, []);

  const togglePlay = useCallback(() => {
    stopAutoSequence();
    const next = !frame.controls.playing;
    frame.controls.playing = next;
    if (next) frame.controls.cueHeld = false;
    ui.set({ playing: next, cueHeld: frame.controls.cueHeld });
    audioEngine.playClick("button");
  }, [stopAutoSequence]);

  const setCue = useCallback((held: boolean) => {
    if (frame.controls.playing) return;
    if (frame.controls.cueHeld === held) return;
    frame.controls.cueHeld = held;
    ui.set({ cueHeld: held });
    if (held) audioEngine.playClick("button");
  }, []);

  const setBeatFx = useCallback((held: boolean) => {
    if (frame.controls.beatFxHold === held) return;
    frame.controls.beatFxHold = held;
    ui.set({ beatFxHold: held });
    if (held) audioEngine.playClick("button");
  }, []);

  /**
   * Choreographed 3.6-second live DJ drop demonstration:
   * Launches Deck 1 -> raises Channel 2 into a high-tension filtered Beat FX roll ->
   * snaps cleanly to Center Lock & drops full bass into the room!
   */
  const runLiveDropDemo = useCallback(() => {
    stopAutoSequence();
    setAutoRunning(true);
    frame.controls.playing = true;
    frame.controls.cueHeld = false;
    frame.controls.centerLock = true;
    ui.set({ playing: true, cueHeld: false, centerLock: true });
    audioEngine.playClick("button");

    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      if (t < 1.35) {
        // Phase 1: Bring fader up while building high-pass / dub-echo tension
        const p = t / 1.35;
        updateFader(0.35 + p * 0.58);
        frame.controls.filter = -0.78 + p * 1.48; // sweeps from LPF into HPF build
        setFilterVal(frame.controls.filter);
        frame.controls.beatFxHold = p > 0.55;
        ui.set({ beatFxHold: frame.controls.beatFxHold });
        autoTimerRef.current = window.requestAnimationFrame(step);
      } else if (t < 1.85) {
        // Phase 2: Hold breathless Beat FX tension right before the bar line
        updateFader(0.95);
        frame.controls.filter = 0.72;
        setFilterVal(0.72);
        frame.controls.beatFxHold = true;
        ui.set({ beatFxHold: true });
        autoTimerRef.current = window.requestAnimationFrame(step);
      } else {
        // Phase 3: DROP! Release Beat FX, snap cleanly into Center Lock, full channel fader!
        frame.controls.beatFxHold = false;
        ui.set({ beatFxHold: false });
        frame.controls.filter = 0;
        setFilterVal(0);
        updateFader(0.96);
        updateCrossfader(0);
        audioEngine.playClick("detent");
        setAutoRunning(false);
        autoTimerRef.current = null;
      }
    };
    autoTimerRef.current = window.requestAnimationFrame(step);
  }, [stopAutoSequence, updateCrossfader, updateFader]);

  // Rotary knob drag
  const onKnobPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopAutoSequence();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startX = e.clientX;
    const startVal = frame.controls.filter;

    const onMove = (ev: PointerEvent) => {
      const delta = (startY - ev.clientY + (ev.clientX - startX) * 0.65) / 105;
      updateFilter(startVal + delta, startVal);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Channel 2 fader drag
  const setFaderFromClientX = useCallback(
    (clientX: number) => {
      const el = faderTrackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      updateFader((clientX - rect.left) / Math.max(1, rect.width));
    },
    [updateFader],
  );

  const onFaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopAutoSequence();
    e.currentTarget.setPointerCapture(e.pointerId);
    setFaderFromClientX(e.clientX);
    const onMove = (ev: PointerEvent) => setFaderFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // MAGVEL Crossfader drag
  const setCrossFromClientX = useCallback(
    (clientX: number) => {
      const el = crossTrackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(1, rect.width);
      updateCrossfader(ratio * 2 - 1);
    },
    [updateCrossfader],
  );

  const onCrossPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopAutoSequence();
    e.currentTarget.setPointerCapture(e.pointerId);
    setCrossFromClientX(e.clientX);
    const onMove = (ev: PointerEvent) => setCrossFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Accessible keyboard shortcuts
  const onConsoleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      setCue(true);
    } else if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      setBeatFx(true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      updateFilter(frame.controls.filter - 0.12);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updateFilter(frame.controls.filter + 0.12);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      updateFader(frame.controls.fader + 0.1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      updateFader(frame.controls.fader - 0.1);
    }
  };

  const onConsoleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "c" || e.key === "C") setCue(false);
    if (e.key === "b" || e.key === "B") setBeatFx(false);
  };

  // Real-time dual-deck CDJ waveform + 15-segment LED meters
  useEffect(() => {
    const sec = sectionRef.current;
    const canvas = waveCanvasRef.current;
    if (!sec || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let visible = false;

    const draw = () => {
      if (!visible) return;
      rafId = window.requestAnimationFrame(draw);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#070709";
      ctx.fillRect(0, 0, w, h);

      const beat = frame.beat;
      const { playing: isPlay, cueHeld: isCue, filter, colorFx: fx, fader, beatFxHold: bfx } = frame.controls;
      const deckAActive = isPlay || isCue;
      const playheadX = w * 0.34;
      const midTop = h * 0.33;
      const midBot = h * 0.72;

      // Subtle beat grid lines (brighten slightly on downbeats)
      const pxPerBeat = 54;
      const offsetPx = (beat * pxPerBeat) % pxPerBeat;
      for (let x = playheadX - offsetPx - pxPerBeat * 8; x < w + pxPerBeat; x += pxPerBeat) {
        if (x < 0) continue;
        ctx.strokeStyle = "rgba(241,240,236,0.085)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 18);
        ctx.lineTo(x, h - 6);
        ctx.stroke();
      }

      // Deck B (Room track — cool steel blue waveform)
      const stepPx = 3;
      for (let x = 0; x < w; x += stepPx) {
        const tBeat = beat + (x - playheadX) / pxPerBeat;
        const frac = ((tBeat % 1) + 1) % 1;
        const kick = Math.exp(-frac * 5.2);
        const hat = Math.exp(-(((frac + 0.5) % 1) * 10));
        const groove = 0.25 + 0.75 * Math.abs(Math.sin(tBeat * 3.14159) * Math.cos(tBeat * 1.57));
        const amp = (0.16 + kick * 0.55 + hat * 0.22 + groove * 0.14) * 15;
        const past = x < playheadX;
        ctx.fillStyle = past ? "rgba(116, 168, 232, 0.36)" : "rgba(116, 168, 232, 0.88)";
        ctx.fillRect(x, midBot - amp, 2, amp * 2);
      }

      // Deck A (Visitor's track — reflects real-time Color FX mode, filter position, fader, & Beat FX roll!)
      const lpDamp = filter < -0.045 ? 1 - Math.abs(filter) * 0.65 : 1;
      const hpThin = filter > 0.045 ? 1 - filter * 0.72 : 1;
      const visGain = isPlay ? 0.38 + fader * 0.62 : isCue ? 0.65 : 0.24;
      const scrollBeatA = deckAActive ? beat : 0;

      for (let x = 0; x < w; x += stepPx) {
        const tBeat = scrollBeatA + (x - playheadX) / pxPerBeat;
        const frac = ((tBeat % 1) + 1) % 1;
        const kick = Math.exp(-frac * 4.8) * hpThin;
        const rollWave = bfx ? Math.abs(Math.sin(tBeat * Math.PI * 8)) * 0.55 : 0;
        const synth = (0.35 + 0.65 * Math.abs(Math.sin(tBeat * 6.283 + 0.7))) * lpDamp;
        const amp = (0.12 + kick * 0.62 + synth * 0.34 + rollWave) * 18 * visGain;
        const past = x < playheadX;
        const alpha = past ? 0.36 : 0.94;
        if (bfx) {
          ctx.fillStyle = `rgba(92, 164, 255, ${alpha})`;
        } else if (fx === "dubecho" && Math.abs(filter) > 0.1) {
          ctx.fillStyle = `rgba(229, 45, 56, ${alpha})`;
        } else if (filter > 0.16) {
          ctx.fillStyle = `rgba(218, 236, 255, ${alpha})`;
        } else if (filter < -0.16) {
          ctx.fillStyle = `rgba(232, 128, 48, ${alpha})`;
        } else {
          ctx.fillStyle = kick > 0.42 ? `rgba(240, 162, 40, ${alpha})` : `rgba(241, 240, 236, ${alpha * 0.88})`;
        }
        ctx.fillRect(x, midTop - amp, 2, amp * 2);
      }

      ctx.fillStyle = "rgba(241, 240, 236, 0.12)";
      ctx.fillRect(0, h * 0.53, w, 1);
      ctx.fillStyle = "#E52D38";
      ctx.fillRect(playheadX - 1, 0, 2, h);

      // Update 15-segment LED meters
      const levelIndices = [1, 2, 4, 5];
      for (let m = 0; m < 4; m++) {
        const colEl = meterRefs.current[m];
        if (!colEl) continue;
        const lvl = frame.levels[levelIndices[m]!] ?? 0;
        const litCount = Math.round(lvl * METER_SEGMENTS);
        const children = colEl.children;
        for (let s = 0; s < children.length; s++) {
          const seg = children[s] as HTMLElement;
          const lit = s < litCount;
          if (!lit) {
            seg.className = "meter-seg";
          } else if (s >= 13) {
            seg.className = "meter-seg meter-seg--red";
          } else if (s >= 10) {
            seg.className = "meter-seg meter-seg--amber";
          } else {
            seg.className = "meter-seg meter-seg--green";
          }
        }
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible && !rafId) {
          rafId = window.requestAnimationFrame(draw);
        } else if (!visible && rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { threshold: 0.05 },
    );
    io.observe(sec);

    return () => {
      io.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const isCenterLocked = Math.abs(filterVal) < 0.045;
  const knobAngleDeg = filterVal * 130;

  // Guided 3-beat progression feedback so visitors immediately feel the DJ transition arc
  const step1Done = playing;
  const step2Done = playing && faderVal >= 0.45;
  const step3Done = playing && faderVal >= 0.55 && Math.abs(filterVal) < 0.35 && !beatFxHold;

  let statusText = "Step 1 · Hit PLAY on Deck 1 (or click the green 3D button)";
  let statusTone = "";
  if (step3Done) {
    statusText = "Both decks live — the room has it";
    statusTone = " status-dot--released";
  } else if (beatFxHold) {
    statusText = "Beat FX Roll building — release to drop";
    statusTone = " status-dot--cued";
  } else if (step2Done) {
    statusText = "Step 3 · Snap COLOR back to CENTER LOCK to drop the bass";
    statusTone = " status-dot--live";
  } else if (step1Done) {
    statusText = "Step 2 · Raise CH 2 Fader & sweep Sound Color FX";
    statusTone = " status-dot--live";
  } else if (cueHeld) {
    statusText = "Cue preview active on Deck 1";
    statusTone = " status-dot--cued";
  }

  return (
    <section
      id="take-control"
      ref={sectionRef}
      className="control-act"
      data-act="control"
      data-shot="control"
      data-shot-anchor="0"
      aria-label="Interactive booth performance"
    >
      <div className="container control-intro">
        <div className="control-intro-copy">
          <h2 className="t-display">{CONTROL.title}</h2>
          <p className="t-body">{CONTROL.body}</p>
        </div>

        <div className="control-top-actions">
          <div className="control-status-pill t-mono" role="status" aria-live="polite">
            <span className={`status-dot${statusTone}`} aria-hidden="true" />
            <span>{statusText}</span>
          </div>
          <div className="control-step-bar t-mono" aria-hidden="true">
            <span className={step1Done ? "step-chip step-chip--done" : "step-chip"}>01 Launch</span>
            <span className={step2Done ? "step-chip step-chip--done" : "step-chip"}>02 Tension</span>
            <span className={step3Done ? "step-chip step-chip--live" : "step-chip"}>03 Drop</span>
          </div>
        </div>
      </div>

      <div className="container">
        <div
          className="control-deck"
          tabIndex={0}
          onKeyDown={onConsoleKeyDown}
          onKeyUp={onConsoleKeyUp}
          aria-label="Interactive CDJ-3000X and DJM-A9 browser controls"
        >
          {/* Top bar: CDJ-3000X Dual Waveform + DJM-A9 15-Segment Meters */}
          <div className="control-deck-top">
            <div className="waveform-panel">
              <canvas ref={waveCanvasRef} className="waveform-canvas" aria-hidden="true" />
              <div className="waveform-meta t-mono">
                <span>DECK 1 · {playing ? "PLAYING" : cueHeld ? "CUE" : "READY"}</span>
                <span>124.0 BPM · {colorFx.toUpperCase()} · {released ? "ROOM LIVE" : "Cm"}</span>
              </div>
            </div>

            <div className="deck-meters" aria-hidden="true">
              {["CH 2", "CH 3", "MST L", "MST R"].map((label, idx) => (
                <div key={label} className="meter-col">
                  <div
                    className="meter-stack"
                    ref={(el) => {
                      meterRefs.current[idx] = el;
                    }}
                  >
                    {Array.from({ length: METER_SEGMENTS }).map((_, seg) => (
                      <span key={seg} className="meter-seg" />
                    ))}
                  </div>
                  <span className="meter-label t-mono">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Performance Console */}
          <div className="control-deck-body">
            {/* 1. CDJ-3000X Transport + Beat FX Roll Tension Pad */}
            <div className="control-cell">
              <div className="control-cell-head t-mono">
                <span>CDJ-3000X · Deck 1</span>
                <span className="control-cell-val">{playing ? "RUNNING" : "STANDBY"}</span>
              </div>
              <div className="transport-pair">
                <button
                  type="button"
                  className={`hw-btn hw-btn--cue${cueHeld ? " hw-btn--active hw-btn--pressed" : ""}`}
                  onPointerDown={() => setCue(true)}
                  onPointerUp={() => setCue(false)}
                  onPointerLeave={() => setCue(false)}
                  onPointerCancel={() => setCue(false)}
                  aria-label="Hold to preview track with CUE"
                >
                  <span>CUE</span>
                </button>
                <button
                  type="button"
                  className={`hw-btn hw-btn--play${playing ? " hw-btn--active" : ""}`}
                  onClick={togglePlay}
                  aria-pressed={playing}
                  aria-label={playing ? "Pause Deck 1" : "Play Deck 1"}
                >
                  <span>{playing ? "PAUSE" : "PLAY"}</span>
                </button>
                <button
                  type="button"
                  className={`hw-btn hw-btn--bfx${beatFxHold ? " hw-btn--active hw-btn--pressed" : ""}`}
                  onPointerDown={() => setBeatFx(true)}
                  onPointerUp={() => setBeatFx(false)}
                  onPointerLeave={() => setBeatFx(false)}
                  onPointerCancel={() => setBeatFx(false)}
                  aria-label="Hold for Beat FX Roll build-up"
                >
                  <span>BEAT</span>
                  <span style={{ fontSize: "0.56rem", opacity: 0.78 }}>ROLL</span>
                </button>
              </div>
            </div>

            {/* 2. DJM-A9 Sound Color FX (3 real modes + Center Lock toggle + rotary knob) */}
            <div className="control-cell">
              <div className="control-cell-head t-mono">
                <span>Sound Color FX</span>
                <span className="control-cell-val">{formatColorValue(filterVal, colorFx)}</span>
              </div>
              <div className="fx-mode-row">
                {COLOR_FX_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`fx-mode-btn t-mono${colorFx === m.id ? " fx-mode-btn--active" : ""}`}
                    onClick={() => setMode(m.id)}
                    aria-pressed={colorFx === m.id}
                    title={m.desc}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`fx-lock-btn t-mono${centerLock ? " fx-lock-btn--on" : ""}`}
                  onClick={toggleCenterLock}
                  aria-pressed={centerLock}
                  title="DJM-A9 Center Lock stops fast sweeps cleanly at 0"
                >
                  LOCK {centerLock ? "ON" : "OFF"}
                </button>
              </div>
              <div className="knob-wrap">
                <div
                  className={`knob-dial${isCenterLocked ? " knob-dial--locked" : ""}`}
                  onPointerDown={onKnobPointerDown}
                  onDoubleClick={() => updateFilter(0, 0)}
                  onWheel={(e) => {
                    e.preventDefault();
                    updateFilter(frame.controls.filter - Math.sign(e.deltaY) * 0.1);
                  }}
                  title="Drag up/down or double-click for Center Lock"
                  aria-hidden="true"
                >
                  <div
                    className="knob-indicator"
                    style={{ transform: `rotate(${knobAngleDeg}deg)` }}
                  />
                </div>
                <div className="knob-scale">
                  <input
                    type="range"
                    className="knob-range-input"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={filterVal}
                    onChange={(e) => {
                      stopAutoSequence();
                      updateFilter(Number(e.target.value));
                    }}
                    aria-label="Channel 2 Sound Color FX knob"
                  />
                  <div className="knob-axis t-mono">
                    <span>LOW</span>
                    <span className={`centerlock-tag${isCenterLocked ? " centerlock-tag--on" : ""}`}>
                      {centerLock ? "CENTER LOCK" : "FREE"}
                    </span>
                    <span>HI</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DJM-A9 Channel 2 Fader + MAGVEL Crossfader */}
            <div className="control-cell">
              <div className="control-cell-head t-mono">
                <span>CH 2 Fader · MAGVEL</span>
                <span className="control-cell-val">{Math.round(faderVal * 100)}%</span>
              </div>
              <div className="fader-wrap">
                <div
                  ref={faderTrackRef}
                  className="fader-track-shell"
                  role="slider"
                  tabIndex={0}
                  aria-label="Channel 2 volume fader"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(faderVal * 100)}
                  onPointerDown={onFaderPointerDown}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                      e.preventDefault();
                      e.stopPropagation();
                      updateFader(frame.controls.fader + 0.08);
                    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                      e.preventDefault();
                      e.stopPropagation();
                      updateFader(frame.controls.fader - 0.08);
                    }
                  }}
                >
                  <div className="fader-rail">
                    <div className="fader-fill" style={{ width: `${faderVal * 100}%` }} />
                  </div>
                  <div className="fader-cap" style={{ left: `${faderVal * 100}%` }} />
                </div>

                {/* MAGVEL Crossfader */}
                <div
                  ref={crossTrackRef}
                  className="fader-track-shell fader-track-shell--sm"
                  role="slider"
                  tabIndex={0}
                  aria-label="MAGVEL Crossfader between Deck 1 and Deck 2"
                  aria-valuemin={-100}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(crossVal * 100)}
                  onPointerDown={onCrossPointerDown}
                  onDoubleClick={() => updateCrossfader(0)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      e.stopPropagation();
                      updateCrossfader(frame.controls.crossfader + 0.15);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      e.stopPropagation();
                      updateCrossfader(frame.controls.crossfader - 0.15);
                    }
                  }}
                >
                  <div className="fader-rail" />
                  <div className="fader-cap fader-cap--sm" style={{ left: `${((crossVal + 1) / 2) * 100}%` }} />
                </div>
                <div className="fader-ticks t-mono" aria-hidden="true">
                  <span>‹ A (DECK 1)</span>
                  <span>MAGVEL</span>
                  <span>(DECK 2) B ›</span>
                </div>
              </div>
            </div>

            {/* 4. Audio Engine + Choreographed Live Drop */}
            <div className="control-cell control-sound-col">
              <div className="control-cell-head t-mono">
                <span>Performance</span>
                <span className="control-cell-val">{sound === "on" ? "AUDIO LIVE" : "SILENT"}</span>
              </div>
              <button
                type="button"
                className={sound === "on" ? "btn-secondary" : "btn-primary"}
                style={{ width: "100%", justifyContent: "center", padding: "0.72rem 0.9rem" }}
                onClick={() => void audioEngine.toggle()}
                disabled={sound === "unavailable"}
              >
                {sound === "on" ? "Mute audio" : sound === "unavailable" ? "No audio" : "Enable sound"}
              </button>
              <button
                type="button"
                className={`inspect-btn t-mono${autoRunning ? " inspect-btn--active" : ""}`}
                style={{ width: "100%", textAlign: "center", padding: "0.58rem 0.7rem" }}
                onClick={runLiveDropDemo}
              >
                {autoRunning ? "Building drop…" : "Drop on beat"}
              </button>
            </div>
          </div>

          <div className="control-deck-foot">
            <p>{CONTROL.disclaimer}</p>
            <div className="kbd-hints t-mono" aria-label="Keyboard shortcuts">
              <span>
                <kbd>Space</kbd>Play
              </span>
              <span>
                <kbd>C</kbd>Cue
              </span>
              <span>
                <kbd>B</kbd>Roll
              </span>
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd>Color FX
              </span>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd>Fader
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
