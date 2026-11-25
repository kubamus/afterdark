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
import { audioEngine } from "@/audio/engine";
import { ui } from "@/lib/store";
import { formatNightClock, startDirector, type DirectorHandle } from "@/scroll/director";
import { resolveShot } from "@/three/shots";
import { createStage, type StageController } from "@/three/stage";

interface ExperienceContextValue {
  scrollTo: (target: string | HTMLElement | number, offset?: number) => void;
  clock: string;
  inspectShotId: string | null;
  setInspectShot: (shotId: string | null) => void;
}

const ExperienceContext = createContext<ExperienceContextValue>({
  scrollTo: () => {},
  clock: formatNightClock(0),
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
    case "control":
      return "top";
    case "cdj-screen":
    case "djm-ess":
    case "djm-beatfx":
      return "left";
    case "cdj-jog":
    case "cdj-playcue":
    case "djm-color":
      return "right";
    case "cdj-front":
    case "djm-channels":
    case "djm-fader":
    case "cdj-intro":
    case "djm-intro":
    case "final":
    case "rise":
    case "overhead":
    case "beauty":
    case "signal":
      return "bottom";
    default:
      return "open";
  }
}

const SPATIAL_CALLOUTS = [
  { id: "jog-collar", tag: "CONCAVE GRIP", sub: "24 sculpted dimples · JOG FEEL", align: "right" },
  { id: "jog-lcd", tag: "ON-JOG LCD", sub: "Artwork & cue phase · Drag 3D", align: "left" },
  { id: "play-halo", tag: "500,000+ PRESSES", sub: "Rebuilt switch · Click 3D PLAY", align: "right" },
  { id: "hot-cues", tag: "HOT CUES A–H", sub: "Tap pads directly in 3D", align: "right" },
  { id: "nfc-front", tag: "NFC TOUCHPOINT", sub: "Hover phone · Instant library", align: "right" },
  { id: "djm-color", tag: "CENTER LOCK", sub: "Zero-overshoot mechanical detent", align: "left" },
  { id: "djm-beatfx", tag: "BEAT FX DOME", sub: "Hold in 3D for live roll", align: "left" },
  { id: "djm-magvel", tag: "3RD-GEN MAGVEL", sub: "Silk blend · Razor cut", align: "right" },
] as const;

const STORY_CHAPTERS = [
  { act: "hero", label: "23:52 · Opening", target: "#top" },
  { act: "instrument", label: "The Instrument", target: "#instrument" },
  { act: "cdj", label: "CDJ-3000X", target: "#cdj-3000x" },
  { act: "djm", label: "DJM-A9", target: "#djm-a9" },
  { act: "control", label: "Take Control", target: "#take-control" },
  { act: "moment", label: "The Moment", target: "#the-moment" },
  { act: "final", label: "05:47 · Yours", target: "#final" },
] as const;

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<StageController | null>(null);
  const directorRef = useRef<DirectorHandle | null>(null);
  const [clock, setClock] = useState(() => formatNightClock(0));
  const [inspectShotId, setInspectShotId] = useState<string | null>(null);

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
  const activeAct = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().act,
    () => "hero",
  );
  const released = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().released,
    () => false,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = createStage(canvas);
    stageRef.current = stage;

    const director = startDirector(stage, (nextClock) => {
      setClock(nextClock);
    });
    directorRef.current = director;

    return () => {
      director.dispose();
      directorRef.current = null;
      stage?.dispose();
      stageRef.current = null;
      audioEngine.dispose();
    };
  }, []);

  const scrollTo = useCallback((target: string | HTMLElement | number, offset = 0) => {
    setInspectShotId(null);
    stageRef.current?.setShotOverride(null);
    directorRef.current?.scrollTo(target, offset);
  }, []);

  const setInspectShot = useCallback((shotId: string | null) => {
    setInspectShotId(shotId);
    if (shotId) {
      stageRef.current?.setShotOverride(resolveShot(shotId));
    } else {
      stageRef.current?.setShotOverride(null);
    }
  }, []);

  const scrimMode = scrimModeForShot(inspectShotId ?? activeShot);

  return (
    <ExperienceContext.Provider value={{ scrollTo, clock, inspectShotId, setInspectShot }}>
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

        {/* Unified viewport-fixed adaptive atmospheric scrims (ZERO hard scrolling seams!) */}
        <div className={`stage-vignette${released ? " stage-vignette--live" : ""}`} />
        <div className="stage-film-grain" />
        <div className={`stage-scrim stage-scrim--hero${scrimMode === "hero" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--left${scrimMode === "left" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--right${scrimMode === "right" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--bottom${scrimMode === "bottom" ? " stage-scrim--on" : ""}`} />
        <div className={`stage-scrim stage-scrim--top${scrimMode === "top" ? " stage-scrim--on" : ""}`} />

        {/* Live 3D-projected hardware storytelling callout pins */}
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
                <span className="spatial-card t-mono">
                  <strong>{c.tag}</strong>
                  <span>{c.sub}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Floating 3D hardware interaction cursor reticle */}
        <div id="hw-cursor-reticle" className="hw-cursor-reticle t-mono" data-active="false">
          <span className="hw-reticle-dot" />
          <span className="hw-reticle-label">INTERACT</span>
        </div>
      </div>

      {/* Whisper-quiet Night Story Rail for chapter pacing & quick navigation */}
      <nav className="story-rail" aria-label="Story chapters">
        {STORY_CHAPTERS.map((ch) => {
          const isCurrent = activeAct === ch.act || (ch.act === "moment" && activeAct === "still");
          return (
            <button
              key={ch.act}
              type="button"
              className={`story-rail-dot${isCurrent ? " story-rail-dot--active" : ""}`}
              onClick={() => scrollTo(ch.target, ch.act === "hero" ? 0 : -20)}
              aria-label={`Jump to ${ch.label}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="story-rail-label t-mono">{ch.label}</span>
              <span className="story-rail-tick" aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <div className="narrative">{children}</div>
    </ExperienceContext.Provider>
  );
}
