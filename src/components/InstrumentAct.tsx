"use client";

import { INSTRUMENT } from "@/content/copy";

export function InstrumentAct() {
  return (
    <section id="instrument" className="instrument-act" data-act="instrument" aria-label="The instrument">
      {/* Shot 1: Rise — hardware powers awake from front to rear */}
      <div className="stage-beat" data-shot="rise" data-shot-anchor="0">
        <div className="container">
          <div className="instrument-lead-box" data-reveal="">
            <span className="reveal-rule" aria-hidden="true" />
            <p className="instrument-lead">{INSTRUMENT.lead}</p>
          </div>
        </div>
      </div>

      {/* Shot 2: Full overhead booth silhouette with verified millimetre dimensions */}
      <div className="stage-beat stage-beat--overhead" data-shot="overhead" data-shot-anchor="0">
        <div className="container">
          <div className="booth-dimensions t-mono" aria-label="Booth physical layout dimensions" data-reveal="">
            <div className="booth-dim-cell">
              <strong>CDJ-3000X</strong>
              <span>344.6 mm</span>
            </div>
            <div className="booth-dim-cell">
              <strong>DJM-A9</strong>
              <span>407.4 mm</span>
            </div>
            <div className="booth-dim-cell">
              <strong>CDJ-3000X</strong>
              <span>344.6 mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shot 3: Studio beauty three-quarter angle */}
      <div className="stage-beat" data-shot="beauty" data-shot-anchor="0">
        <div className="container">
          <div className="instrument-statement" data-reveal="">
            <span className="reveal-rule" aria-hidden="true" />
            <h2 className="t-display">{INSTRUMENT.title}</h2>
            <p className="t-body">{INSTRUMENT.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
