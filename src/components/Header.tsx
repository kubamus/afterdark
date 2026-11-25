"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ui } from "@/lib/store";
import { useExperience } from "./StageCanvas";

const NAV_ITEMS = [
  { label: "Instrument", target: "#instrument", act: "instrument" },
  { label: "CDJ-3000X", target: "#cdj-3000x", act: "cdj" },
  { label: "DJM-A9", target: "#djm-a9", act: "djm" },
  { label: "The moment", target: "#the-moment", act: "moment" },
  { label: "Specs", target: "#specs", act: "final" },
] as const;

const ACT_LABELS: Record<string, string> = {
  hero: "Overview",
  instrument: "Instrument",
  cdj: "CDJ-3000X",
  djm: "DJM-A9",
  moment: "The moment",
  final: "Specifications",
};

export function Header() {
  const { scrollTo, scrollPercent } = useExperience();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const act = useSyncExternalStore(
    ui.subscribe,
    () => ui.get().act,
    () => "hero",
  );

  useEffect(() => {
    let lastY = window.scrollY;
    let accumDelta = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;

      setScrolled(y > 36);

      if (y < 48) {
        accumDelta = 0;
        setHidden(false);
        return;
      }

      // Reset directional accumulator whenever scroll direction reverses
      if ((dy > 0 && accumDelta < 0) || (dy < 0 && accumDelta > 0)) {
        accumDelta = 0;
      }
      accumDelta += dy;

      // Apple-style hysteresis (~10px threshold) prevents trackpad bounce flicker
      if (accumDelta > 12 && y > 88) {
        setHidden(true);
        accumDelta = 0;
      } else if (accumDelta < -8) {
        setHidden(false);
        accumDelta = 0;
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = (target: string) => {
    setMenuOpen(false);
    scrollTo(target, -40);
  };

  const sectionLabel = ACT_LABELS[act] ?? "Overview";
  const ringCircumference = 2 * Math.PI * 7;
  const ringOffset = ringCircumference * (1 - scrollPercent / 100);
  const isHidden = hidden && !menuOpen;

  return (
    <>
      <header
        className={`site-header${scrolled ? " site-header--scrolled" : ""}${isHidden ? " site-header--hidden" : ""}`}
        onFocus={() => setHidden(false)}
      >
        <div className="header-glass-bar">
          <a
            href="#top"
            className="brand-mark"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              scrollTo(0);
            }}
          >
            <span className="brand-dot" />
            <span>After Dark</span>
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
            <div
              className="scroll-progress-pill"
              aria-label={`Current section: ${sectionLabel}, ${scrollPercent}% scrolled`}
            >
              <svg className="progress-ring" viewBox="0 0 18 18" aria-hidden="true">
                <circle className="progress-ring-track" cx="9" cy="9" r="7" />
                <circle
                  className="progress-ring-fill"
                  cx="9"
                  cy="9"
                  r="7"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className="scroll-progress-label">{sectionLabel}</span>
              <span className="scroll-progress-pct">{scrollPercent}%</span>
            </div>

            <button
              type="button"
              className="menu-toggle"
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
              </a>
            ))}
          </nav>
          <div className="t-muted" style={{ fontSize: "0.82rem" }}>
            {sectionLabel}, {scrollPercent}%
          </div>
        </div>
      )}
    </>
  );
}
