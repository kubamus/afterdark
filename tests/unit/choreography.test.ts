import { describe, expect, test } from "bun:test";
import { clamp, dbToUnit, gainToDb, smootherstep } from "@/lib/math";
import { formatScrollPercent } from "@/scroll/director";
import { BOOTH, CDJ, DJM, pxToLocal } from "@/three/hardware/layout";
import { cloneShot, DEFAULT_SHOT, fitToAspect, resolveShot, sampleShots, SHOTS } from "@/three/shots";

describe("Math utilities", () => {
  test("clamp & smootherstep bounds", () => {
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(0.5)).toBe(0.5);
    expect(smootherstep(1)).toBe(1);
  });

  test("dB meter scaling stays within 0..1", () => {
    expect(dbToUnit(gainToDb(0))).toBe(0);
    expect(dbToUnit(gainToDb(1))).toBeGreaterThan(0.8);
    expect(dbToUnit(gainToDb(4))).toBe(1);
  });
});

describe("Physical booth dimensions", () => {
  test("CDJ-3000X and DJM-A9 match official published millimetre widths", () => {
    expect(CDJ.width).toBeCloseTo(0.3446, 4);
    expect(DJM.width).toBeCloseTo(0.4074, 4);
    const totalBoothWidth = CDJ.width * 2 + DJM.width + BOOTH.gap * 2;
    expect(totalBoothWidth).toBeGreaterThan(1.1);
    expect(totalBoothWidth).toBeLessThan(1.18);
  });

  test("pxToLocal maps crop centre to origin", () => {
    const [x, z] = pxToLocal(CDJ, CDJ.crop.width / 2, CDJ.crop.height / 2);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });
});

describe("Scroll-anchored cinematography", () => {
  test("all narrative shots resolve cleanly", () => {
    for (const id of Object.keys(SHOTS)) {
      const shot = resolveShot(id);
      expect(shot.pos.length).toBe(3);
      expect(shot.target.length).toBe(3);
      expect(shot.fov).toBeGreaterThan(15);
    }
  });

  test("sampleShots interpolates smoothly and reverses cleanly", () => {
    const anchors = [
      { id: "hero", y: 0 },
      { id: "overhead", y: 1000 },
      { id: "final", y: 2000 },
    ];
    const out = cloneShot(DEFAULT_SHOT);

    const heroShot = resolveShot("hero");
    const overShot = resolveShot("overhead");

    sampleShots(anchors, 0, out);
    expect(out.spot).toBeCloseTo(heroShot.spot, 4);

    sampleShots(anchors, 500, out);
    expect(out.key).toBeCloseTo((heroShot.key + overShot.key) * 0.5, 4);

    sampleShots(anchors, 1000, out);
    expect(out.key).toBeCloseTo(overShot.key, 4);

    // Reversibility back to 0
    sampleShots(anchors, 0, out);
    expect(out.spot).toBeCloseTo(heroShot.spot, 4);

    // Dwell plateau keeps the shot locked on anchor[0] while reading the first half
    const dwellSample = sampleShots(anchors, 450, out, 0.54);
    expect(dwellSample.activeId).toBe("hero");
    expect(out.spot).toBeCloseTo(heroShot.spot, 4);
  });

  test("fitToAspect pulls camera back on portrait screens", () => {
    const overhead = resolveShot("overhead");
    const desktopPos = fitToAspect(overhead, 16 / 9);
    const mobilePos = fitToAspect(overhead, 390 / 844);
    expect(mobilePos[1]).toBeGreaterThan(desktopPos[1]);
  });
});

describe("Scroll progress indicator", () => {
  test("maps scroll ratio 0..1 cleanly to 0..100%", () => {
    expect(formatScrollPercent(0)).toBe(0);
    expect(formatScrollPercent(0.5)).toBe(50);
    expect(formatScrollPercent(1)).toBe(100);
  });
});
