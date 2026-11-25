"use client";

import { useState } from "react";
import { FINAL, LINKS, SPECS } from "@/content/copy";
import { useExperience } from "./StageCanvas";

export function FinalAct() {
  const { scrollTo } = useExperience();
  const [mobileSpecTab, setMobileSpecTab] = useState<"cdj" | "djm">("cdj");

  return (
    <section id="final" className="final-act" data-act="final" aria-label="Your place behind the decks">
      {/* Return to the complete 3D booth presentation */}
      <div className="final-hero" data-shot="final" data-shot-anchor="0">
        <div className="container final-inner" data-reveal="">
          <div>
            <h2 className="t-display final-title">{FINAL.title}</h2>
            <p className="t-body">{FINAL.body}</p>
          </div>
          <div className="final-ctas">
            <a
              href={LINKS.cdj}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <span>Explore CDJ-3000X</span>
            </a>
            <a
              href={LINKS.djm}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <span>Explore DJM-A9</span>
            </a>
            <a
              href={LINKS.dealer}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <span>Find a dealer</span>
            </a>
          </div>
        </div>
      </div>

      {/* Accessible Technical Specifications outside the WebGL canvas */}
      <div id="specs" className="specs-section" aria-label="Technical specifications">
        <div className="container">
          <div className="specs-header">
            <h2 className="t-display-wide">Technical specifications</h2>
            <div className="specs-tabs" role="tablist" aria-label="Select product specifications">
              <button
                type="button"
                role="tab"
                aria-selected={mobileSpecTab === "cdj"}
                className={`specs-tab t-mono${mobileSpecTab === "cdj" ? " specs-tab--active" : ""}`}
                onClick={() => setMobileSpecTab("cdj")}
              >
                CDJ-3000X
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileSpecTab === "djm"}
                className={`specs-tab t-mono${mobileSpecTab === "djm" ? " specs-tab--active" : ""}`}
                onClick={() => setMobileSpecTab("djm")}
              >
                DJM-A9
              </button>
            </div>
          </div>

          <div className="specs-grid">
            <div className={mobileSpecTab !== "cdj" ? "spec-col--mobile-hidden" : undefined}>
              <div className="spec-col-head">
                <h3 className="t-display-wide">AlphaTheta CDJ-3000X</h3>
                <a
                  href={LINKS.cdj}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-mono"
                >
                  Official page
                </a>
              </div>
              <dl className="spec-list">
                {SPECS.cdj.map(([k, v]) => (
                  <div key={k} className="spec-row">
                    <dt className="t-mono">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className={mobileSpecTab !== "djm" ? "spec-col--mobile-hidden" : undefined}>
              <div className="spec-col-head">
                <h3 className="t-display-wide">Pioneer DJ DJM-A9</h3>
                <a
                  href={LINKS.djm}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-mono"
                >
                  Official page
                </a>
              </div>
              <dl className="spec-list">
                {SPECS.djm.map(([k, v]) => (
                  <div key={k} className="spec-row">
                    <dt className="t-mono">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-credits">
            <p>
              After Dark is an interactive 3D product guide for the AlphaTheta CDJ-3000X and Pioneer
              DJ DJM-A9. Product photography, film clips, and technical specifications come from
              official AlphaTheta and Pioneer DJ documentation. Club photographs are by Arnold
              Jaeger Werner under CC BY 2.0 on Wikimedia Commons.
            </p>
          </div>
          <div className="footer-links">
            <a href={LINKS.cdj} target="_blank" rel="noopener noreferrer">
              CDJ-3000X
            </a>
            <a href={LINKS.djm} target="_blank" rel="noopener noreferrer">
              DJM-A9
            </a>
            <a href={LINKS.dealer} target="_blank" rel="noopener noreferrer">
              Dealers
            </a>
            <button type="button" onClick={() => scrollTo(0)}>
              Back to top
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
