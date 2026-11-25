"use client";

import { HERO } from "@/content/copy";
import { useExperience } from "./StageCanvas";

export function Hero() {
  const { scrollTo } = useExperience();

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
          <p className="hero-products hero-enter hero-enter--1">
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
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
