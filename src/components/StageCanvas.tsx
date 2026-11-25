"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { deckAudio } from "@/audio/deckAudio";
import { ui } from "@/lib/store";
import { startDirector, type DirectorHandle } from "@/scroll/director";
import { resolveShot } from "@/three/shots";
import { createStage, type StageController } from "@/three/stage";

interface ExperienceContextValue {
  scrollTo: (target: string | HTMLElement | number, offset?: number) => void;
  scrollPercent: number;
  inspectShotId: string | null;
  setInspectShot: (shotId: string | null) => void;
}

const ExperienceContext = createContext<ExperienceContextValue>({
  scrollTo: () => {},
  scrollPercent: 0,
  inspectShotId: null,
  setInspectShot: () => {},
});

export function useExperience() {
  return useContext(ExperienceContext);
}

type ScrimMode = "hero" | "left" | "right" | "bottom" | "top" | "open";

function scrimModeForShot(shotId: string): ScrimMode {
  switch (shotId) {
    case "hero":
      return "hero";
    case "cdj-screen":
    case "djm-ess":
    case "djm-beatfx":
      return "left";
    case "cdj-jog":
    case "cdj-playcue":
    case "djm-color":
      return "right";
    case "signal":
      return "top";
    case "cdj-front":
    case "djm-channels":
    case "djm-fader":
    case "cdj-intro":
    case "djm-intro":
    case "final":
    case "rise":
    case "overhead":
    case "beauty":
      return "bottom";
    default:
      return "open";
  }
}

const SPATIAL_CALLOUTS = [
  { id: "jog-collar", tag: "Outer rim pitch bend", sub: "Spin the dimpled edge to nudge the beatgrid.", align: "right" },
  { id: "jog-lcd", tag: "Top platter vinyl scratch", sub: "Drag the capacitive center to brake and scratch.", align: "left" },
  { id: "play-halo", tag: "500,000+ press switch", sub: "Press PLAY to latch, or hold CUE to play while held.", align: "right" },
  { id: "hot-cues", tag: "Hot Cues A to H", sub: "Click pads directly on the deck.", align: "right" },
  { id: "nfc-front", tag: "NFC touchpoint", sub: "Hold a phone over the reader to load rekordbox.", align: "right" },
  { id: "djm-color", tag: "Center Lock", sub: "Mechanical detent stops the knob at center.", align: "left" },
  { id: "djm-beatfx", tag: "Beat FX trigger", sub: "Hold the button on the mixer to apply the effect.", align: "left" },
  { id: "djm-magvel", tag: "Third-generation MAGVEL", sub: "Magnetic crossfader for blends and fast cuts.", align: "right" },
] as const;

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<StageController | null>(null);
  const directorRef = useRef<DirectorHandle | null>(null);
  const inspectScrollOriginRef = useRef<number>(0);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [inspectShotId, setInspectShotId] = useState<string | null>(null);
  const [loaderDone, setLoaderDone] = useState(false);

  const webglState = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().webgl,
    () => "pending" as const,
  );
  const activeShot = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().activeShot,
    () => "hero",
  );
  const released = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().released,
    () => false,
  );

  // Smoothly dismiss minimal loading screen once 3D booth textures & WebGL are ready
  useEffect(() => {
    if (webglState === "pending") return;
    const t = window.setTimeout(() => setLoaderDone(true), 240);
    return () => window.clearTimeout(t);
  }, [webglState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = createStage(canvas);
    stageRef.current = stage;

    const director = startDirector(stage, (nextPct) => {
      setScrollPercent(nextPct);
    });
    directorRef.current = director;

    return () => {
      director.dispose();
      directorRef.current = null;
      stage?.dispose();
      stageRef.current = null;
      deckAudio.dispose();
    };
  }, []);

  // Automatically release any active Inspect Angle the moment the visitor resumes scrolling!
  useEffect(() => {
    if (!inspectShotId) return;
    inspectScrollOriginRef.current = window.scrollY;
    const onScrollRelease = () => {
      if (Math.abs(window.scrollY - inspectScrollOriginRef.current) > 32) {
        setInspectShotId(null);
        stageRef.current?.setShotOverride(null, null);
      }
    };
    window.addEventListener("scroll", onScrollRelease, { passive: true });
    return () => window.removeEventListener("scroll", onScrollRelease);
  }, [inspectShotId]);

  const scrollTo = useCallback((target: string | HTMLElement | number, offset = 0) => {
    setInspectShotId(null);
    stageRef.current?.setShotOverride(null, null);
    directorRef.current?.scrollTo(target, offset);
  }, []);

  const setInspectShot = useCallback((shotId: string | null) => {
    setInspectShotId(shotId);
    if (shotId) {
      inspectScrollOriginRef.current = window.scrollY;
      stageRef.current?.setShotOverride(resolveShot(shotId), shotId);
    } else {
      stageRef.current?.setShotOverride(null, null);
    }
  }, []);

  const scrimMode = scrimModeForShot(inspectShotId ?? activeShot);
  const isStageReady = webglState !== "pending";

  return (
    <ExperienceContext.Provider value={{ scrollTo, scrollPercent, inspectShotId, setInspectShot }}>
      {/* Smooth, minimal Apple-style loading overlay while the 3D booth initializes */}
      {!loaderDone && (
        <div
          className={`loading-screen${isStageReady ? " loading-screen--done" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Loading 3D booth"
        >
          <div className="loading-screen-inner">
            <span className="loading-brand">
              <span className="loading-dot" aria-hidden="true" />
              After Dark
            </span>
            <span className="loading-sub">CDJ-3000X and DJM-A9</span>
            <div className="loading-track" aria-hidden="true">
              <div className={`loading-fill${isStageReady ? " loading-fill--full" : ""}`} />
            </div>
          </div>
        </div>
      )}

      <div className="stage-layer" aria-hidden="true">
        <canvas ref={canvasRef} className="stage-canvas" />
        {webglState === "unavailable" && (
          <div className="stage-fallback">
            <picture>
              <source media="(max-width: 768px)" srcSet="/assets/img/cdj-hero-portrait.webp" />
              <img src="/assets/img/cdj-hero.webp" alt="" />
            </picture>
          </div>
        )}

        {/* Unified viewport-fixed adaptive atmospheric scrims */}
        <div className={`stage-vignette${released ? " stage-vignette--live" : ""}`} />
        <div className="stage-film-grain" />
        <div className={`stage-scrim stage-scrim--hero${scrimMode === "hero" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--left${scrimMode === "left" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--right${scrimMode === "right" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--bottom${scrimMode === "bottom" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--top${scrimMode === "top" ? " stage-scrim--on" : ""}`} />

        {/* Live 3D-projected hardware callout pins */}
        <div className="spatial-callouts-layer">
          {SPATIAL_CALLOUTS.map((c) => (
            <div
              key={c.id}
              className={`spatial-callout spatial-callout--${c.align}`}
              data-callout={c.id}
              data-visible="false"
            >
              <div className="spatial-callout-inner">
                <span className="spatial-beacon">
                  <span className="spatial-beacon-ring" />
                  <span className="spatial-beacon-dot" />
                </span>
                <span className="spatial-stem" />
                <span className="spatial-card">
                  <strong>{c.tag}</strong>
                  <span>{c.sub}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Floating 3D hardware interaction cursor reticle (only active in interactive chapters) */}
        <div id="hw-cursor-reticle" className="hw-cursor-reticle" data-active="false">
          <span className="hw-reticle-dot" />
          <span className="hw-reticle-label">Interact</span>
        </div>
      </div>

      <div className="narrative">{children}</div>
    </ExperienceContext.Provider>
  );
}
