"use client";

import { useSyncExternalStore } from "react";
import { audioEngine } from "@/audio/engine";
import { HERO } from "@/content/copy";
import { ui } from "@/lib/store";
import { useExperience } from "./StageCanvas";

export function Hero() {
  const { scrollTo } = useExperience();
  const sound = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().sound,
    () => "off" as const,
  );

  return (
    <section
      id="top"
      className="hero"
      data-act="hero"
      data-shot="hero"
      data-shot-anchor="0"
      aria-label="Opening"
    >
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="hero-products t-mono hero-enter hero-enter--1">
            <span className="hero-products-rule" aria-hidden="true" />
            {HERO.products}
          </p>
          <h1 className="t-display hero-headline hero-enter hero-enter--2">{HERO.headline}</h1>
          <p className="hero-sub hero-enter hero-enter--3">{HERO.sub}</p>
          <div className="hero-actions hero-enter hero-enter--4">
            <button
              type="button"
              className="btn-primary"
              onClick={() => scrollTo("#instrument", 0)}
            >
              <span>{HERO.cta}</span>
              <span className="btn-arrow" aria-hidden="true">↓</span>
            </button>
            {sound === "off" && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void audioEngine.enable()}
              >
                <span>Enable sound</span>
              </button>
            )}
          </div>
          <p className="hero-touch-hint t-mono hero-enter hero-enter--5">
            <span className="touch-hint-dot" aria-hidden="true" />
            Live 3D booth · Drag the jog wheel or press PLAY directly on the deck
          </p>
        </div>

        <div className="hero-cue t-mono hero-enter hero-enter--5" aria-hidden="true">
          <span>23:52 · Empty room</span>
          <span className="hero-scroll-line" />
        </div>
      </div>
    </section>
  );
}
