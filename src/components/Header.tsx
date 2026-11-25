"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { audioEngine } from "@/audio/engine";
import { ui } from "@/lib/store";
import { useExperience } from "./StageCanvas";

const NAV_ITEMS = [
  { label: "Instrument", target: "#instrument", act: "instrument" },
  { label: "CDJ-3000X", target: "#cdj-3000x", act: "cdj" },
  { label: "DJM-A9", target: "#djm-a9", act: "djm" },
  { label: "Take Control", target: "#take-control", act: "control" },
  { label: "Specs", target: "#specs", act: "final" },
] as const;

export function Header() {
  const { scrollTo, clock } = useExperience();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const sound = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().sound,
    () => "off" as const,
  );
  const act = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().act,
    () => "hero",
  );
  const playing = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().playing,
    () => false,
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = (target: string) => {
    setMenuOpen(false);
    scrollTo(target, -40);
  };

  return (
    <>
      <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
        <div className="header-inner">
          <a
            href="#top"
            className="brand-mark"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              scrollTo(0);
            }}
          >
            <span className={`brand-dot${playing || sound === "on" ? " brand-dot--live" : ""}`} />
            AFTER DARK
          </a>

          <nav className="header-nav" aria-label="Campaign sections">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.target}
                href={item.target}
                className={`header-link${act === item.act ? " header-link--active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(item.target);
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-utils">
            <span className="night-clock t-mono" aria-label={`Time of night ${clock}`}>
              {clock}
            </span>

            <button
              type="button"
              className={`sound-btn t-mono${sound === "on" ? " sound-btn--on" : ""}`}
              onClick={() => void audioEngine.toggle()}
              aria-pressed={sound === "on"}
              disabled={sound === "unavailable"}
            >
              <span className="sound-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>{sound === "on" ? "Sound on" : sound === "unavailable" ? "No audio" : "Sound off"}</span>
            </button>

            <button
              type="button"
              className="menu-toggle t-mono"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? "×" : "≡"}
            </button>
          </div>
        </div>
        <div className="header-progress" aria-hidden="true">
          <div className="header-progress-fill" />
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-drawer" role="dialog" aria-label="Site navigation">
          <nav className="mobile-drawer-nav">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.target}
                href={item.target}
                className="mobile-drawer-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(item.target);
                }}
              >
                <span>{item.label}</span>
                <span className="t-mono t-muted" style={{ fontSize: "0.78rem" }}>
                  →
                </span>
              </a>
            ))}
          </nav>
          <div className="t-mono t-muted" style={{ fontSize: "0.78rem", letterSpacing: "0.12em" }}>
            {clock} — CDJ-3000X / DJM-A9
          </div>
        </div>
      )}
    </>
  );
}
