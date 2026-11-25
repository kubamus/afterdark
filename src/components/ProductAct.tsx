"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deckAudio } from "@/audio/deckAudio";
import { CDJ_ACT, DJM_ACT } from "@/content/copy";
import { frame, ui } from "@/lib/store";
import { useExperience } from "./StageCanvas";

const CDJ_INSPECT_VIEWS = [
  { id: "cdj-screen", label: "10.1-inch screen" },
  { id: "cdj-jog", label: "Jog wheel" },
  { id: "cdj-playcue", label: "PLAY and CUE" },
  { id: "cdj-front", label: "NFC and front" },
] as const;

const DJM_INSPECT_VIEWS = [
  { id: "djm-channels", label: "4 channels" },
  { id: "djm-color", label: "Color FX" },
  { id: "djm-beatfx", label: "Beat FX" },
  { id: "djm-fader", label: "MAGVEL" },
] as const;

const BEAT_FX_DIVISIONS = ["1/4", "1/2", "3/4", "1", "2"] as const;

const BEAT_FX_INFO: Record<string, string> = {
  Delay: "Single-tap rhythmic delay locked to the master beatgrid.",
  Echo: "Feedback echo repeats that continue to decay after you cut the channel fader.",
  "Ping Pong": "Alternating left and right stereo delay repeats locked to tempo.",
  Spiral: "Pitch-shifting feedback delay controlled in real time from the X-PAD.",
  Helix: "Layered forward and reverse tempo-synced echoes.",
  Reverb: "Room reverb tail with low, mid, and high frequency isolation.",
  Flanger: "Comb-filter modulation sweep across the selected beat length.",
  Phaser: "Phase-cancellation sweep through the midrange frequencies.",
  Filter: "Tempo-locked resonant filter sweep in time with the beatgrid.",
  "Triplet Filter": "New on DJM-A9. Three-beat triplet filter sweep locked to BPM.",
  Trans: "Rhythmic amplitude gate that slices the signal on the beatgrid.",
  Roll: "Beat-loop sampler that captures and repeats the active bar division.",
  "Triplet Roll": "New on DJM-A9. Rapid 3/8 triplet beat roll for transitions.",
  Mobius: "New on DJM-A9. Rising or falling Shepard-tone oscillator synced to BPM.",
};

function MacroFilm({
  src,
  poster,
  alt,
  rate,
  className = "",
}: {
  src: string;
  poster: string;
  alt: string;
  rate?: number;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reducedMotion = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().reducedMotion,
    () => false,
  );

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (rate) vid.playbackRate = rate;
    if (reducedMotion) {
      vid.pause();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void vid.play().catch(() => {});
          } else {
            vid.pause();
          }
        }
      },
      { threshold: 0.2 },
    );
    io.observe(vid);
    return () => io.disconnect();
  }, [rate, reducedMotion]);

  return (
    <video
      ref={videoRef}
      className={`macro-video ${className}`}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt}
    />
  );
}

export function CdjAct() {
  const { inspectShotId, setInspectShot } = useExperience();
  const [screenMode, setScreenMode] = useState<"browse" | "play">("browse");
  const [pressCount, setPressCount] = useState(500000);
  const [playRippleKey, setPlayRippleKey] = useState(0);
  const [cueRippleKey, setCueRippleKey] = useState(0);
  const [activeXrayNode, setActiveXrayNode] = useState<"psu" | "dac">("psu");

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
  const jogMode = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().jogMode,
    () => "idle" as const,
  );

  useEffect(() => {
    return () => {
      if (frame.controls.cueHeld) {
        frame.controls.cueHeld = false;
        ui.set({ cueHeld: false });
        deckAudio.releaseCueHold();
      }
    };
  }, []);

  const screenFeat = CDJ_ACT.features[0]!;
  const jogFeat = CDJ_ACT.features[1]!;
  const playFeat = CDJ_ACT.features[2]!;
  const libFeat = CDJ_ACT.features[3]!;
  const connectFeat = CDJ_ACT.features[4]!;

  const switchScreen = (mode: "browse" | "play") => {
    setScreenMode(mode);
    frame.controls.screenMode = mode;
  };

  // Real CDJ PLAY button: latches playback seamlessly if pressed while holding CUE, otherwise toggles play/pause.
  const handlePlayPress = () => {
    const next = frame.controls.cueHeld ? true : !frame.controls.playing;
    frame.controls.playing = next;
    frame.controls.playTapImpulse = 1;
    ui.set({ playing: next });
    setPressCount((c) => c + 1);
    setPlayRippleKey((k) => k + 1);
    deckAudio.setPlaying(next);
  };

  // Real CDJ CUE button: while paused, plays from the cue point for as long as held; while playing, stops back to cue.
  const startCueHold = () => {
    const wasPlaying = frame.controls.playing;
    frame.controls.playing = false;
    frame.controls.cueHeld = true;
    frame.controls.cueTapImpulse = 1;
    ui.set({ playing: false, cueHeld: true });
    setPressCount((c) => c + 1);
    setCueRippleKey((k) => k + 1);
    if (wasPlaying) {
      deckAudio.stopToCue();
    } else {
      deckAudio.startCueHold();
    }
  };

  const endCueHold = () => {
    if (!frame.controls.cueHeld) return;
    frame.controls.cueHeld = false;
    ui.set({ cueHeld: false });
    deckAudio.releaseCueHold();
  };

  const demoScratchTop = () => {
    frame.controls.jogMode = "scratch";
    frame.controls.jogVelocity = -6.5;
    frame.controls.jogScratchVel = 6.5;
    ui.set({ jogMode: "scratch" });
    deckAudio.triggerDemoScratch();
    window.setTimeout(() => {
      frame.controls.jogVelocity = 7.2;
      frame.controls.jogScratchVel = -7.2;
    }, 160);
  };

  const demoBendRim = () => {
    frame.controls.jogMode = "bend";
    frame.controls.jogVelocity = -4.2;
    frame.controls.jogPitchBend = 0.72;
    ui.set({ jogMode: "bend" });
  };

  return (
    <section id="cdj-3000x" data-act="cdj" aria-label="AlphaTheta CDJ-3000X">
      {/* Chapter Opener */}
      <div className="chapter-open" data-shot="cdj-intro" data-shot-anchor="0">
        <div className="container chapter-open-inner" data-reveal="">
          <div>
            <p className="chapter-maker t-mono">{CDJ_ACT.maker}</p>
            <h2 className="t-display chapter-name">{CDJ_ACT.name}</h2>
            <p className="chapter-title">{CDJ_ACT.title}</p>
            <p className="t-body" style={{ marginTop: "0.85rem" }}>
              {CDJ_ACT.intro}
            </p>
          </div>

          <div className="inspect-bar" aria-label="Inspect CDJ-3000X hardware angles">
            <span className="inspect-label t-mono">Inspect angle</span>
            <div className="inspect-controls">
              {CDJ_INSPECT_VIEWS.map((v) => {
                const active = inspectShotId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`inspect-btn t-mono${active ? " inspect-btn--active" : ""}`}
                    onClick={() => setInspectShot(active ? null : v.id)}
                    aria-pressed={active}
                  >
                    {v.label}
                  </button>
                );
              })}
              {inspectShotId && (
                <button
                  type="button"
                  className="inspect-btn t-mono"
                  onClick={() => setInspectShot(null)}
                >
                  Release
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1. 10.1" Touchscreen — Left editorial rail + live 3D display switcher + 3D Hot Cue trigger strip */}
      <article className="showcase-band showcase-band--left" data-shot="cdj-screen" data-shot-anchor="0">
        <div className="container showcase-rail" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{screenFeat.title}</h3>
            <p className="t-body">{screenFeat.body}</p>

            <div className="micro-widget" aria-label="Toggle live 3D CDJ-3000X display view">
              <span className="micro-label">Live 3D screen</span>
              <div className="micro-seg-group">
                <button
                  type="button"
                  className={`inspect-btn${screenMode === "browse" ? " inspect-btn--active" : ""}`}
                  onClick={() => switchScreen("browse")}
                  aria-pressed={screenMode === "browse"}
                >
                  16-track browse
                </button>
                <button
                  type="button"
                  className={`inspect-btn${screenMode === "play" ? " inspect-btn--active" : ""}`}
                  onClick={() => switchScreen("play")}
                  aria-pressed={screenMode === "play"}
                >
                  Waveform view
                </button>
              </div>
            </div>

            <div className="inline-specs">
              {screenFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>

          <div className="showcase-inset-film">
            <MacroFilm
              src="/assets/film/screen.mp4"
              poster="/assets/film/screen.webp"
              alt={screenFeat.media!.alt}
            />
          </div>
        </div>
      </article>

      {/* 2. Non-Motorized Capacitive Jog Wheel — Top Platter Vinyl Scratch vs Outer Rim Pitch Bend */}
      <article className="showcase-band showcase-band--right" data-shot="cdj-jog" data-shot-anchor="0">
        <div className="container showcase-rail showcase-rail--right" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{jogFeat.title}</h3>
            <p className="t-body">{jogFeat.body}</p>

            <div className="micro-widget" aria-label="Direct 3D dual-zone jog wheel interaction">
              <div className="micro-row">
                <span className="micro-label">Dual-zone capacitive jog</span>
                <span
                  className={`jog-state-pill${
                    jogMode === "scratch"
                      ? " jog-state-pill--scratch"
                      : jogMode === "bend"
                        ? " jog-state-pill--bend"
                        : ""
                  }`}
                >
                  {jogMode === "scratch"
                    ? "Top platter scratch"
                    : jogMode === "bend"
                      ? "Outer rim pitch bend"
                      : "Drag 3D jog"}
                </span>
              </div>

              <div className="jog-zone-grid">
                <button
                  type="button"
                  className={`jog-zone-card${jogMode === "scratch" ? " jog-zone-card--scratch" : ""}`}
                  onClick={demoScratchTop}
                >
                  <strong>Top platter</strong>
                  <span>Drag the center to brake and scratch.</span>
                </button>
                <button
                  type="button"
                  className={`jog-zone-card${jogMode === "bend" ? " jog-zone-card--bend" : ""}`}
                  onClick={demoBendRim}
                >
                  <strong>Outer dimple rim</strong>
                  <span>Drag the edge to bend pitch.</span>
                </button>
              </div>
            </div>

            <div className="inline-specs">
              {jogFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* 3. Spammable Momentary PLAY & CUE — Rebuilt from the inside out */}
      <article className="showcase-band showcase-band--right" data-shot="cdj-playcue" data-shot-anchor="0">
        <div className="container showcase-rail showcase-rail--right" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{playFeat.title}</h3>
            <p className="t-body">{playFeat.body}</p>

            <div className="micro-widget">
              <div className="micro-row">
                <div className="micro-seg-group">
                  <button
                    type="button"
                    className={`btn-tactile btn-tactile--cue t-mono${cueHeld ? " inspect-btn--active" : ""}`}
                    aria-pressed={cueHeld}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      startCueHold();
                    }}
                    onPointerUp={endCueHold}
                    onPointerCancel={endCueHold}
                    onLostPointerCapture={endCueHold}
                    onKeyDown={(e) => {
                      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                        e.preventDefault();
                        startCueHold();
                      }
                    }}
                    onKeyUp={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        endCueHold();
                      }
                    }}
                    onBlur={endCueHold}
                  >
                    <span className="tactile-ring-wrap" aria-hidden="true">
                      <span className="tactile-ring tactile-ring--amber" />
                      {cueRippleKey > 0 && <span key={cueRippleKey} className="tactile-ripple tactile-ripple--amber" />}
                    </span>
                    <span>{playing ? "Return to CUE" : cueHeld ? "Playing CUE" : "Hold CUE"}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-tactile t-mono"
                    aria-pressed={playing}
                    onPointerDown={handlePlayPress}
                  >
                    <span className="tactile-ring-wrap" aria-hidden="true">
                      <span className="tactile-ring" />
                      {playRippleKey > 0 && <span key={playRippleKey} className="tactile-ripple" />}
                    </span>
                    <span>{playing ? "Pause" : "Press PLAY"}</span>
                  </button>
                </div>
                <div className="t-mono" style={{ textAlign: "right" }}>
                  <div className="press-counter-val">
                    {pressCount.toLocaleString()}+
                  </div>
                  <div style={{ fontSize: "0.66rem", color: "var(--metallic)", letterSpacing: "0.08em" }}>
                    Momentary presses
                  </div>
                </div>
              </div>
            </div>

            <div className="showcase-inset-film showcase-inset-film--compact">
              <MacroFilm
                src="/assets/film/playcue.mp4"
                poster="/assets/film/playcue.webp"
                alt={playFeat.media!.alt}
                rate={0.6}
              />
            </div>
          </div>
        </div>
      </article>

      {/* 4. Cloud, Streaming, Wi-Fi & NFC — Tight asymmetric front-panel composition */}
      <article className="showcase-band showcase-band--bottom" data-shot="cdj-front" data-shot-anchor="0">
        <div className="container connect-grid" data-reveal="">
          <div className="connect-col">
            <h3 className="t-display showcase-h3">{connectFeat.title}</h3>
            <p className="t-body">{connectFeat.body}</p>
            <div className="inline-specs t-mono">
              {connectFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>

          <div className="connect-col connect-col--secondary">
            <p className="connect-subhead t-display-wide">{libFeat.title}</p>
            <p className="t-body" style={{ fontSize: "0.94rem" }}>{libFeat.body}</p>
            <div className="inline-specs t-mono">
              {libFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>

          <div className="connect-film">
            <MacroFilm
              src="/assets/film/nfc.mp4"
              poster="/assets/film/nfc.webp"
              alt={connectFeat.media!.alt}
            />
          </div>
        </div>
      </article>

      {/* 5. Sound Architecture Interlude — Feathered dark studio cutaway */}
      <div className="sound-interlude" data-shot="cdj-sound" data-shot-anchor="0">
        <div className="container sound-grid" data-reveal="">
          <div className="sound-stage">
            <div className="sound-xray-wrap" data-parallax="">
              <img
                src="/assets/img/cdj-xray.webp"
                alt="Transparent chassis cutaway of the CDJ-3000X showing the ESS Technology DAC in red and the custom AlphaTheta power supply in blue."
                loading="lazy"
                decoding="async"
              />
              <button
                type="button"
                className={`xray-pin xray-pin--dac${activeXrayNode === "dac" ? " xray-pin--active" : ""}`}
                onClick={() => setActiveXrayNode("dac")}
                aria-pressed={activeXrayNode === "dac"}
              >
                <span className="xray-dot xray-dot--red" />
                ESS 32-bit DAC
              </button>
              <button
                type="button"
                className={`xray-pin xray-pin--psu${activeXrayNode === "psu" ? " xray-pin--active" : ""}`}
                onClick={() => setActiveXrayNode("psu")}
                aria-pressed={activeXrayNode === "psu"}
              >
                <span className="xray-dot xray-dot--blue" />
                Custom power supply
              </button>
            </div>
          </div>

          <div>
            <p className="chapter-maker t-mono">CDJ-3000X sound architecture</p>
            <h3 className="t-display" style={{ fontSize: "clamp(2.4rem, 5vw, 4.4rem)", marginBottom: "1rem" }}>
              {CDJ_ACT.sound.title}
            </h3>
            <p className="t-body">{CDJ_ACT.sound.body}</p>
            <p key={activeXrayNode} className="xray-note t-mono">
              {activeXrayNode === "dac"
                ? "ESS Technology 96 kHz, 32-bit digital-to-analog converter with 115 dB signal-to-noise ratio and 0.0018% total harmonic distortion."
                : "Custom AlphaTheta low-noise power supply isolates digital circuits from the analog output stage."}
            </p>
            <dl className="sound-stats">
              {CDJ_ACT.sound.evidence.map(([k, v]) => (
                <div key={k} className="sound-stat">
                  <dt className="t-mono">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DjmAct() {
  const { inspectShotId, setInspectShot } = useExperience();
  const [selectedFx, setSelectedFx] = useState("Mobius");
  const [beatDiv, setBeatDiv] = useState<"1/4" | "1/2" | "3/4" | "1" | "2">("1");
  const [xpadVal, setXpadVal] = useState(0.5);
  const [fxFreq, setFxFreq] = useState({ low: true, mid: true, hi: true });
  const [colorSweepVal, setColorSweepVal] = useState(-0.65);
  const [colorManual, setColorManual] = useState(false);
  const colorSweepSideRef = useRef<-1 | 1>(-1);

  const centerLock = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().centerLock,
    () => true,
  );
  const ignitionStage = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().ignitionStage,
    () => "idle" as const,
  );

  const chFeat = DJM_ACT.features[0]!;
  const essFeat = DJM_ACT.features[1]!;
  const colorFeat = DJM_ACT.features[2]!;
  const beatFeat = DJM_ACT.features[3]!;
  const magvelFeat = DJM_ACT.features[4]!;
  const b2bFeat = DJM_ACT.features[5]!;

  const triggerCableIgnition = () => {
    frame.controls.cableIgniteTimer = 0;
    frame.controls.cableIgnite = 0.01;
    ui.set({ ignitionStage: "power" });
  };

  const toggleFreqBand = (band: "low" | "mid" | "hi") => {
    setFxFreq((prev) => {
      const next = { ...prev, [band]: !prev[band] };
      frame.controls.fxFreq = next;
      return next;
    });
  };

  return (
    <section id="djm-a9" data-act="djm" aria-label="Pioneer DJ DJM-A9">
      {/* Rear Cable Plug-In Bridge: fixed-width layout prevents any line-wrap shift during animation! */}
      <div className="signal-bridge" data-shot="signal" data-shot-anchor="0">
        <div className="container signal-bridge-inner" data-reveal="">
          <div className="signal-line">
            <span className="signal-pulse-bar" aria-hidden="true" />
            <p className="t-display">{DJM_ACT.signal}</p>
          </div>

          <div className="cable-ignite-panel">
            <div className="cable-stage-pills">
              <span
                className={`cable-pill${
                  ignitionStage !== "idle" ? " cable-pill--power" : ""
                }`}
              >
                01 Power IEC
              </span>
              <span
                className={`cable-pill${
                  ignitionStage === "link" || ignitionStage === "xlr" || ignitionStage === "club"
                    ? " cable-pill--link"
                    : ""
                }`}
              >
                02 PRO DJ LINK
              </span>
              <span
                className={`cable-pill${
                  ignitionStage === "xlr" || ignitionStage === "club" ? " cable-pill--xlr" : ""
                }`}
              >
                03 XLR master and club lights
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary cable-ignite-btn"
              onClick={triggerCableIgnition}
            >
              <span>{ignitionStage === "club" ? "Replay connection" : "Connect cables"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chapter Opener */}
      <div className="chapter-open" data-shot="djm-intro" data-shot-anchor="0">
        <div className="container chapter-open-inner" data-reveal="">
          <div>
            <p className="chapter-maker t-mono">{DJM_ACT.maker}</p>
            <h2 className="t-display chapter-name">{DJM_ACT.name}</h2>
            <p className="chapter-title">{DJM_ACT.title}</p>
          </div>

          <div className="inspect-bar" aria-label="Inspect DJM-A9 hardware angles">
            <span className="inspect-label t-mono">Inspect angle</span>
            <div className="inspect-controls">
              {DJM_INSPECT_VIEWS.map((v) => {
                const active = inspectShotId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`inspect-btn t-mono${active ? " inspect-btn--active" : ""}`}
                    onClick={() => setInspectShot(active ? null : v.id)}
                    aria-pressed={active}
                  >
                    {v.label}
                  </button>
                );
              })}
              {inspectShotId && (
                <button
                  type="button"
                  className="inspect-btn t-mono"
                  onClick={() => setInspectShot(null)}
                >
                  Release
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1. Four Channels — 3D live meters above, sleek bottom architectural strip */}
      <article className="showcase-band showcase-band--bottom" data-shot="djm-channels" data-shot-anchor="0">
        <div className="container bottom-strip" data-reveal="">
          <div className="bottom-strip-copy">
            <h3 className="t-display showcase-h3">{chFeat.title}</h3>
            <p className="t-body">{chFeat.body}</p>
            <div className="inline-specs t-mono">
              {chFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>
          <div className="bottom-strip-photo">
            <img src="/assets/img/djm-eq.webp" alt={chFeat.media!.alt} loading="lazy" decoding="async" />
          </div>
        </div>
      </article>

      {/* 2. ESS 32-bit Conversion — Clean high-contrast engineering split */}
      <article className="showcase-band showcase-band--left" data-shot="djm-ess" data-shot-anchor="0">
        <div className="container showcase-rail" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{essFeat.title}</h3>
            <p className="t-body">{essFeat.body}</p>
            <div className="ess-callout-pair t-mono">
              <div>
                <strong>32-bit A/D</strong>
                <span>Channel inputs</span>
              </div>
              <div>
                <strong>32-bit D/A</strong>
                <span>Master and booth</span>
              </div>
            </div>
          </div>
          <div className="showcase-inset-photo">
            <img src="/assets/img/djm-ess.webp" alt={essFeat.media!.alt} loading="lazy" decoding="async" />
          </div>
        </div>
      </article>

      {/* 3. Sound Color FX + Live Center Lock Toggle synced to the 3D COLOR knob */}
      <article className="showcase-band showcase-band--right" data-shot="djm-color" data-shot-anchor="0">
        <div className="container showcase-rail showcase-rail--right" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{colorFeat.title}</h3>
            <p className="t-body">{colorFeat.body}</p>

            <div className="micro-widget">
              <div className="micro-row">
                <span className="micro-label">Center Lock detent</span>
                <button
                  type="button"
                  className={`inspect-btn${centerLock ? " inspect-btn--active" : ""}`}
                  onClick={() => {
                    const next = !frame.controls.centerLock;
                    frame.controls.centerLock = next;
                    ui.set({ centerLock: next });
                    if (next && colorManual) {
                      setColorSweepVal(0);
                      frame.controls.filter = 0;
                    }
                  }}
                  aria-pressed={centerLock}
                >
                  {centerLock ? "Center Lock on" : "Center Lock off"}
                </button>
              </div>

              <div className="xpad-control-wrap" style={{ marginTop: "0.55rem" }}>
                <div className="micro-row">
                  <span className="micro-label" style={{ fontWeight: 500, color: "rgba(255,255,255,0.62)" }}>
                    {centerLock ? "Turn knob, stops at center" : "Turn knob, free sweep from LOW to HI"}
                  </span>
                  <span style={{ fontSize: "0.74rem", fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.84)" }}>
                    {colorManual
                      ? colorSweepVal === 0
                        ? "Center locked"
                        : colorSweepVal < 0
                          ? `LOW ${Math.round(Math.abs(colorSweepVal) * 100)}%`
                          : `HI ${Math.round(colorSweepVal * 100)}%`
                      : centerLock
                        ? "Auto lock"
                        : "Auto free"}
                  </span>
                </div>
                <input
                  type="range"
                  className="knob-range-input"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={colorSweepVal}
                  onPointerDown={() => {
                    colorSweepSideRef.current = colorSweepVal >= 0 ? 1 : -1;
                  }}
                  onChange={(e) => {
                    let v = Number(e.target.value);
                    // Authentic DJM-A9 Center Lock: fast sweep from LOW or HI hits a hard mechanical stop at 0 (12:00)!
                    if (centerLock) {
                      if (colorSweepSideRef.current === -1 && v > 0) v = 0;
                      if (colorSweepSideRef.current === 1 && v < 0) v = 0;
                    }
                    setColorManual(true);
                    setColorSweepVal(v);
                    frame.controls.filter = v;
                  }}
                  aria-label="Sweep DJM-A9 Sound Color FX knob"
                />
              </div>
            </div>

            <div className="inline-specs t-mono">
              {colorFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* 4. Fourteen Beat FX — Live Dynamic 3D OLED Display + X-PAD Touch Bar + FX Frequency Isolation */}
      <article className="showcase-band showcase-band--left" data-shot="djm-beatfx" data-shot-anchor="0">
        <div className="container showcase-rail" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{beatFeat.title}</h3>
            <p className="t-body">{beatFeat.body}</p>

            <div className="beatfx-interactive t-mono" role="listbox" aria-label="Fourteen Beat FX">
              {DJM_ACT.beatFx.map((fx) => {
                const isNew = DJM_ACT.beatFxNew.includes(fx);
                const active = selectedFx === fx;
                return (
                  <button
                    key={fx}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`beatfx-chip${active ? " beatfx-chip--active" : ""}${isNew ? " beatfx-chip--new" : ""}`}
                    onClick={() => {
                      setSelectedFx(fx);
                      frame.controls.activeBeatFx = fx;
                    }}
                  >
                    {isNew && <span className="beatfx-new-dot" aria-hidden="true" />}
                    {fx}
                  </button>
                );
              })}
            </div>

            {/* Live Beat FX OLED Capability & Interactive X-PAD Controller (drives 3D mixer OLED!) */}
            <div className="micro-widget beatfx-live-card">
              <div className="micro-row">
                <span className="micro-label" style={{ color: "rgba(255, 255, 255, 0.92)" }}>
                  {selectedFx} live display
                </span>
                <div className="micro-seg-group">
                  {(["low", "mid", "hi"] as const).map((band) => (
                    <button
                      key={band}
                      type="button"
                      className={`fx-band-btn${fxFreq[band] ? " fx-band-btn--on" : ""}`}
                      onClick={() => toggleFreqBand(band)}
                      aria-pressed={fxFreq[band]}
                    >
                      {band === "low" ? "Low" : band === "mid" ? "Mid" : "Hi"}
                    </button>
                  ))}
                </div>
              </div>

              <p className="beatfx-ability-desc">
                {BEAT_FX_INFO[selectedFx] ?? "Tempo-locked effect controlled across the horizontal X-PAD."}
              </p>

              <div className="beatfx-div-row">
                {BEAT_FX_DIVISIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`beatfx-div-btn${beatDiv === d ? " beatfx-div-btn--active" : ""}`}
                    onClick={() => {
                      setBeatDiv(d);
                      frame.controls.beatFxDiv = d;
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="xpad-control-wrap">
                <div className="micro-row">
                  <span className="micro-label">X-PAD position</span>
                  <span style={{ fontSize: "0.74rem", fontVariantNumeric: "tabular-nums", color: "rgba(255, 255, 255, 0.68)" }}>
                    {Math.round(xpadVal * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  className="knob-range-input xpad-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={xpadVal}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setXpadVal(v);
                    frame.controls.xpadPos = v;
                  }}
                  aria-label="Slide across DJM-A9 X-PAD"
                />
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* 5. 3rd-gen MAGVEL FADER + Dual B2B Headphones (Elevated top-down camera!) */}
      <article className="showcase-band showcase-band--bottom" data-shot="djm-fader" data-shot-anchor="0">
        <div className="container connect-grid" data-reveal="">
          <div className="connect-col">
            <h3 className="t-display showcase-h3">{magvelFeat.title}</h3>
            <p className="t-body">{magvelFeat.body}</p>
            <div className="inline-specs t-mono">
              {magvelFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>

          <div className="connect-col connect-col--secondary">
            <p className="connect-subhead t-display-wide">{b2bFeat.title}</p>
            <p className="t-body" style={{ fontSize: "0.94rem" }}>{b2bFeat.body}</p>
            <div className="inline-specs t-mono">
              {b2bFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>

          <div className="connect-photo-magvel">
            <img src="/assets/img/djm-magvel.webp" alt={magvelFeat.media!.alt} loading="lazy" decoding="async" />
          </div>
        </div>
      </article>
    </section>
  );
}
