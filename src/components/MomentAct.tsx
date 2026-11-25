"use client";

import { MOMENT } from "@/content/copy";

export function MomentAct() {
  return (
    <section id="the-moment" className="moment-act" data-act="moment" aria-label="The live moment">
      {/* DJ's point of view rising across the lit booth into the venue */}
      <div className="moment-pov" data-shot="pov" data-shot-anchor="0" aria-hidden="true" />

      {/* Full-bleed authentic underground club photography fading smoothly into the Finale */}
      <div className="moment-gallery">
        <div className="moment-hero-plate">
          <picture>
            <source media="(max-width: 768px)" srcSet="/assets/img/club-2-sm.webp" />
            <img
              src="/assets/img/club-2.webp"
              alt="From behind the DJ booth looking out over a packed dark club bathed in crimson ceiling light."
              loading="lazy"
              decoding="async"
            />
          </picture>
          <div className="moment-hero-scrim" aria-hidden="true" />
          <div className="container moment-headline-wrap">
            <h2 className="t-display moment-headline">{MOMENT.line}</h2>
          </div>
        </div>

        <div className="container moment-diptych">
          <figure className="moment-frame" data-parallax="">
            <picture>
              <source media="(max-width: 768px)" srcSet="/assets/img/club-3-sm.webp" />
              <img
                src="/assets/img/club-3.webp"
                alt="Hands raised across the dance floor under deep red geometric ceiling lights."
                loading="lazy"
                decoding="async"
              />
            </picture>
          </figure>
          <figure className="moment-frame" data-parallax="">
            <picture>
              <source media="(max-width: 768px)" srcSet="/assets/img/club-1-sm.webp" />
              <img
                src="/assets/img/club-1.webp"
                alt="Silhouette of a DJ facing the crowd between two illuminated decks."
                loading="lazy"
                decoding="async"
              />
            </picture>
          </figure>
        </div>
      </div>
    </section>
  );
}
