/**
 * Unified choreography director.
 *
 * Coordinates Lenis smooth scrolling, GSAP ScrollTrigger editorial reveals,
 * visual 124 BPM meter/lighting rhythm, and the Three.js Stage on one gsap.ticker clock.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { clamp } from "@/lib/math";
import { frame, ui } from "@/lib/store";
import type { Anchor } from "@/three/shots";
import type { StageController } from "@/three/stage";

gsap.registerPlugin(ScrollTrigger);

export interface DirectorHandle {
  scrollTo(target: string | HTMLElement | number, offset?: number): void;
  refresh(): void;
  dispose(): void;
}

export function formatScrollPercent(progress: number): number {
  return Math.round(clamp(progress, 0, 1) * 100);
}

/** Lightweight silent 124 BPM visual pulse for 15-segment LED meters & club lighting. */
function updateVisualPulse(elapsed: number) {
  const bpm = 124;
  const beat = elapsed * (bpm / 60);
  const beatFrac = beat - Math.floor(beat);
  const kick = Math.exp(-beatFrac * 7.2);
  const offbeat = Math.exp(-((beatFrac + 0.5) % 1) * 9.5);

  frame.beat = beat;
  frame.kick = kick;
  frame.bass = kick * 0.85;
  frame.energy = 0.35 + kick * 0.5 + offbeat * 0.15;

  // Ch 1..4 + Master L/R authentic club meter levels
  const ch2 = frame.controls.playing ? 0.35 + kick * 0.48 : 0.08 + offbeat * 0.1;
  const ch3 = 0.44 + kick * 0.46 + Math.sin(elapsed * 3.1) * 0.05;
  const master = Math.min(0.96, Math.max(ch2, ch3) + 0.08);
  frame.levels[0] = 0.06 + offbeat * 0.08;
  frame.levels[1] = ch2;
  frame.levels[2] = ch3;
  frame.levels[3] = 0.08 + kick * 0.08;
  frame.levels[4] = master;
  frame.levels[5] = Math.min(0.96, master * (0.96 + 0.04 * Math.sin(elapsed * 5.2)));
}

export function startDirector(
  stage: StageController | null,
  onProgress?: (pct: number) => void,
): DirectorHandle {
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const updateReduced = () => ui.set({ reducedMotion: motionQuery.matches });
  updateReduced();
  motionQuery.addEventListener("change", updateReduced);

  let lenis: Lenis | null = null;
  if (!motionQuery.matches) {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.15,
    });
    lenis.on("scroll", ScrollTrigger.update);
  }

  let anchors: Anchor[] = [];
  let actMarkers: { id: string; y: number }[] = [];
  let lastPct = -1;
  const progressBar = document.querySelector<HTMLElement>(".header-progress-fill");

  const measureAnchors = () => {
    const vh = window.innerHeight || 1;
    frame.viewportH = vh;

    const shotEls = Array.from(document.querySelectorAll<HTMLElement>("[data-shot]"));
    const nextAnchors: Anchor[] = [];
    for (const el of shotEls) {
      const id = el.dataset.shot;
      if (!id) continue;
      const rect = el.getBoundingClientRect();
      const offsetRatio = Number(el.dataset.shotAnchor ?? "0");
      const y = Math.max(0, rect.top + window.scrollY - vh * offsetRatio);
      nextAnchors.push({ id, y });
    }
    nextAnchors.sort((a, b) => a.y - b.y);
    if (nextAnchors[0] && nextAnchors[0].id === "hero") {
      nextAnchors[0].y = 0;
    }
    anchors = nextAnchors;
    stage?.setAnchors(anchors);

    const actEls = Array.from(document.querySelectorAll<HTMLElement>("[data-act]"));
    actMarkers = actEls
      .map((el) => ({
        id: el.dataset.act ?? "hero",
        y: el.getBoundingClientRect().top + window.scrollY - vh * 0.42,
      }))
      .sort((a, b) => a.y - b.y);
  };

  // GSAP ScrollTrigger staggered editorial choreography + subtle photographic parallax
  const revealTriggers: ScrollTrigger[] = [];
  if (!motionQuery.matches) {
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    for (const el of revealEls) {
      const children = Array.from(el.children).filter(
        (c): c is HTMLElement => c instanceof HTMLElement,
      );
      const targets = children.length > 1 ? children : [el];
      gsap.set(targets, { opacity: 0, y: 26 });
      const tween = gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.085,
        ease: "power3.out",
        paused: true,
      });
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top 92%",
        onEnter: () => tween.play(),
        onLeaveBack: () => tween.reverse(),
      });
      revealTriggers.push(st);
    }

    const parallaxEls = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    for (const el of parallaxEls) {
      const tw = gsap.fromTo(
        el,
        { y: 18 },
        {
          y: -18,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.65,
          },
        },
      );
      if (tw.scrollTrigger) revealTriggers.push(tw.scrollTrigger);
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    frame.pointerX = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    frame.pointerY = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  let resizeTimer: number | null = null;
  const onResize = () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      stage?.resize();
      measureAnchors();
      ScrollTrigger.refresh();
    }, 100);
  };
  window.addEventListener("resize", onResize);

  measureAnchors();
  if (document.fonts) {
    void document.fonts.ready.then(() => {
      measureAnchors();
      ScrollTrigger.refresh();
    });
  }

  let elapsed = 0;
  const tick = (timeSec: number, deltaMs: number) => {
    const dt = Math.min(0.05, Math.max(0.001, deltaMs / 1000));
    elapsed += dt;

    lenis?.raf(timeSec * 1000);

    const scrollY = lenis ? lenis.scroll : window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    frame.scrollY = scrollY;
    frame.progress = clamp(scrollY / maxScroll, 0, 1);

    if (progressBar) {
      progressBar.style.transform = `scaleX(${frame.progress})`;
    }

    let activeAct = "hero";
    for (let i = 0; i < actMarkers.length; i++) {
      if (scrollY >= actMarkers[i]!.y) {
        activeAct = actMarkers[i]!.id;
      }
    }
    if (ui.get().act !== activeAct) {
      ui.set({ act: activeAct });
    }

    const pct = formatScrollPercent(frame.progress);
    if (pct !== lastPct) {
      lastPct = pct;
      onProgress?.(pct);
    }

    updateVisualPulse(elapsed);
    stage?.render(dt, elapsed);
  };

  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return {
    scrollTo(target, offset = 0) {
      if (lenis) {
        lenis.scrollTo(target, { offset, duration: 1.3 });
      } else {
        if (typeof target === "number") {
          window.scrollTo({ top: target + offset, behavior: "auto" });
        } else {
          const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY + offset;
            window.scrollTo({ top, behavior: "auto" });
          }
        }
      }
    },
    refresh() {
      measureAnchors();
      ScrollTrigger.refresh();
    },
    dispose() {
      gsap.ticker.remove(tick);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      motionQuery.removeEventListener("change", updateReduced);
      revealTriggers.forEach((st) => st.kill());
      lenis?.destroy();
    },
  };
}
