"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audioEngine } from "@/audio/engine";
import { CDJ_ACT, DJM_ACT } from "@/content/copy";
import { frame, ui } from "@/lib/store";
import { useExperience } from "./StageCanvas";

const CDJ_INSPECT_VIEWS = [
  { id: "cdj-screen", label: "10.1″ Screen" },
  { id: "cdj-jog", label: "Jog Wheel" },
  { id: "cdj-playcue", label: "PLAY / CUE" },
  { id: "cdj-front", label: "NFC & Front" },
] as const;

const DJM_INSPECT_VIEWS = [
  { id: "djm-channels", label: "4 Channels" },
  { id: "djm-color", label: "Color FX" },
  { id: "djm-beatfx", label: "Beat FX" },
  { id: "djm-fader", label: "MAGVEL" },
] as const;

const HOT_CUE_PADS = [
  { label: "A", color: "#e53946" },
  { label: "B", color: "#38c2f0" },
  { label: "C", color: "#8ce030" },
  { label: "D", color: "#f1f0ec" },
  { label: "E", color: "#2fd065" },
  { label: "F", color: "#f0a228" },
  { label: "G", color: "#3a7cff" },
  { label: "H", color: "#e5d238" },
] as const;

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
  const [jogFeel, setJogFeel] = useState(0.45);
  const [pressCount, setPressCount] = useState(500000);
  const [playRippleKey, setPlayRippleKey] = useState(0);
  const [activeXrayNode, setActiveXrayNode] = useState<"psu" | "dac">("psu");

  const lastHotCue = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().lastHotCue,
    () => null,
  );

  const screenFeat = CDJ_ACT.features[0]!;
  const jogFeat = CDJ_ACT.features[1]!;
  const playFeat = CDJ_ACT.features[2]!;
  const libFeat = CDJ_ACT.features[3]!;
  const connectFeat = CDJ_ACT.features[4]!;

  const switchScreen = (mode: "browse" | "play") => {
    setScreenMode(mode);
    frame.controls.screenMode = mode;
    audioEngine.playClick("button");
  };

  const handleJogFeel = (val: number) => {
    setJogFeel(val);
    frame.controls.jogFeel = val;
    frame.controls.jogVelocity = (1.15 - val * 0.65) * 6.5;
  };

  const triggerPlayPress = () => {
    frame.controls.demoPlayPulse = 1;
    setPressCount((c) => c + 1);
    setPlayRippleKey((k) => k + 1);
    audioEngine.playClick("button");
  };

  const triggerHotCue = (index: number) => {
    frame.controls.hotCuePulses[index] = 1;
    ui.set({ lastHotCue: index });
    audioEngine.playHotCue(index);
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
              <span className="micro-label t-mono">Live 3D Screen</span>
              <div className="micro-seg-group">
                <button
                  type="button"
                  className={`inspect-btn t-mono${screenMode === "browse" ? " inspect-btn--active" : ""}`}
                  onClick={() => switchScreen("browse")}
                  aria-pressed={screenMode === "browse"}
                >
                  16-Track Browse
                </button>
                <button
                  type="button"
                  className={`inspect-btn t-mono${screenMode === "play" ? " inspect-btn--active" : ""}`}
                  onClick={() => switchScreen("play")}
                  aria-pressed={screenMode === "play"}
                >
                  Waveform View
                </button>
              </div>

              <span className="micro-label t-mono" style={{ marginTop: "0.35rem" }}>
                3D Hot Cue Pads · Tap or click deck
              </span>
              <div className="hotcue-strip" role="group" aria-label="Trigger 3D CDJ-3000X Hot Cue pads A through H">
                {HOT_CUE_PADS.map((pad, idx) => (
                  <button
                    key={pad.label}
                    type="button"
                    className={`hotcue-pad-btn t-mono${lastHotCue === idx ? " hotcue-pad-btn--active" : ""}`}
                    style={{ "--pad-color": pad.color } as React.CSSProperties}
                    onClick={() => triggerHotCue(idx)}
                  >
                    <span>{pad.label}</span>
                    <span className="hotcue-pad-led" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div className="inline-specs t-mono">
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

      {/* 2. Sculpted Jog Wheel — 3D Jog macro left + interactive JOG FEEL tension right */}
      <article className="showcase-band showcase-band--right" data-shot="cdj-jog" data-shot-anchor="0">
        <div className="container showcase-rail showcase-rail--right" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{jogFeat.title}</h3>
            <p className="t-body">{jogFeat.body}</p>

            <div className="micro-widget">
              <div className="micro-row t-mono">
                <span className="micro-label">
                  JOG FEEL · {jogFeel < 0.35 ? "LIGHT FLOW" : jogFeel > 0.65 ? "HEAVY PRECISION" : "BALANCED"}
                </span>
                <button
                  type="button"
                  className="inspect-btn t-mono"
                  onClick={() => {
                    frame.controls.jogVelocity = (1.2 - jogFeel * 0.65) * 9.5;
                    audioEngine.playClick("detent");
                  }}
                >
                  Nudge 3D platter ↻
                </button>
              </div>
              <input
                type="range"
                className="knob-range-input"
                min={0}
                max={1}
                step={0.05}
                value={jogFeel}
                onChange={(e) => handleJogFeel(Number(e.target.value))}
                aria-label="Adjust CDJ-3000X Jog Feel tension from light to heavy"
              />
              <div className="knob-axis t-mono">
                <span>LIGHT</span>
                <span>DRAG 3D JOG DIRECTLY</span>
                <span>HEAVY</span>
              </div>
            </div>

            <div className="inline-specs t-mono">
              {jogFeat.evidence.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* 3. Redesigned PLAY & CUE — 3D glowing halos left + slow-mo film & 500k press trigger right */}
      <article className="showcase-band showcase-band--right" data-shot="cdj-playcue" data-shot-anchor="0">
        <div className="container showcase-rail showcase-rail--right" data-reveal="">
          <div className="showcase-rail-copy">
            <h3 className="t-display showcase-h3">{playFeat.title}</h3>
            <p className="t-body">{playFeat.body}</p>

            <div className="micro-widget">
              <div className="micro-row">
                <button
                  type="button"
                  className="btn-tactile t-mono"
                  onClick={triggerPlayPress}
                >
                  <span className="tactile-ring-wrap" aria-hidden="true">
                    <span className="tactile-ring" />
                    {playRippleKey > 0 && <span key={playRippleKey} className="tactile-ripple" />}
                  </span>
                  <span>Press 3D PLAY</span>
                </button>
                <div className="t-mono" style={{ textAlign: "right" }}>
                  <div className="press-counter-val">
                    {pressCount.toLocaleString()}+
                  </div>
                  <div style={{ fontSize: "0.66rem", color: "var(--metallic)", letterSpacing: "0.1em" }}>
                    RATED PRESSES
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
                alt="Transparent chassis cutaway of the CDJ-3000X highlighting the ESS Technology DAC in red and custom AlphaTheta power supply in blue."
                loading="lazy"
                decoding="async"
              />
              <button
                type="button"
                className={`xray-pin xray-pin--dac t-mono${activeXrayNode === "dac" ? " xray-pin--active" : ""}`}
                onClick={() => {
                  setActiveXrayNode("dac");
                  audioEngine.playClick("detent");
                }}
                aria-pressed={activeXrayNode === "dac"}
              >
                <span className="xray-dot xray-dot--red" />
                ESS 32-bit DAC
              </button>
              <button
                type="button"
                className={`xray-pin xray-pin--psu t-mono${activeXrayNode === "psu" ? " xray-pin--active" : ""}`}
                onClick={() => {
                  setActiveXrayNode("psu");
                  audioEngine.playClick("detent");
                }}
                aria-pressed={activeXrayNode === "psu"}
              >
                <span className="xray-dot xray-dot--blue" />
                Custom Power Supply
              </button>
            </div>
          </div>

          <div>
            <p className="chapter-maker t-mono">CDJ-3000X · SOUND ARCHITECTURE</p>
            <h3 className="t-display" style={{ fontSize: "clamp(2.4rem, 5vw, 4.4rem)", marginBottom: "1rem" }}>
              {CDJ_ACT.sound.title}
            </h3>
            <p className="t-body">{CDJ_ACT.sound.body}</p>
            <p key={activeXrayNode} className="xray-note t-mono">
              {activeXrayNode === "dac"
                ? "ESS Technology 96 kHz / 32-bit digital-to-analog stage — 115 dB S/N ratio, 0.0018 % THD."
                : "Newly developed AlphaTheta low-noise power supply unit — isolates digital noise from the audio output stage."}
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
  const centerLock = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().centerLock,
    () => true,
  );

  const chFeat = DJM_ACT.features[0]!;
  const essFeat = DJM_ACT.features[1]!;
  const colorFeat = DJM_ACT.features[2]!;
  const beatFeat = DJM_ACT.features[3]!;
  const magvelFeat = DJM_ACT.features[4]!;
  const b2bFeat = DJM_ACT.features[5]!;

  return (
    <section id="djm-a9" data-act="djm" aria-label="Pioneer DJ DJM-A9">
      {/* Signature 3D Signal Bridge: CDJ-3000X output -> DJM-A9 Channel 2 input */}
      <div className="signal-bridge" data-shot="signal" data-shot-anchor="0">
        <div className="container" data-reveal="">
          <div className="signal-line">
            <span className="signal-pulse-bar" aria-hidden="true" />
            <p className="t-display">{DJM_ACT.signal}</p>
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
                <span>Channel Inputs</span>
              </div>
              <div>
                <strong>32-bit D/A</strong>
                <span>Master &amp; Booth</span>
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
              <div className="micro-row t-mono">
                <span className="micro-label">3D KNOB · CENTER LOCK</span>
                <button
                  type="button"
                  className={`inspect-btn t-mono${centerLock ? " inspect-btn--active" : ""}`}
                  onClick={() => {
                    const next = !frame.controls.centerLock;
                    frame.controls.centerLock = next;
                    ui.set({ centerLock: next });
                    audioEngine.playClick("detent");
                  }}
                  aria-pressed={centerLock}
                >
                  {centerLock ? "CENTER LOCK: ON" : "CENTER LOCK: OFF"}
                </button>
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

      {/* 4. Fourteen Beat FX — 3D Beat FX display & blue dome right + interactive 14-FX selector left */}
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
                      audioEngine.playClick("button");
                    }}
                  >
                    {isNew && <span className="beatfx-new-dot" aria-hidden="true" />}
                    {fx}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="showcase-inset-photo">
            <img src="/assets/img/djm-xpad.webp" alt={beatFeat.media!.alt} loading="lazy" decoding="async" />
          </div>
        </div>
      </article>

      {/* 5. 3rd-gen MAGVEL FADER + Dual B2B Headphones */}
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
