/**
 * Physical layout of the hardware, measured from AlphaTheta / Pioneer DJ orthographic
 * product photography and the official published dimensions.
 *
 * All "px" coordinates refer to the cropped top-view texture produced by
 * scripts/process-assets.ts. Real-world sizes are in metres.
 *
 * CDJ-3000X: 344.6 × 490.4 × 130.1 mm (W × D × H), 6.0 kg  — alphatheta.com
 * DJM-A9:    407.4 × 458.3 × 107.9 mm (W × D × H), 10.2 kg — pioneerdj.com
 */

export type Px = readonly [number, number];

export interface KnobSpec {
  id: string;
  at: Px;
  /** cap radius in px */
  r: number;
  /** height above the panel, metres */
  h: number;
}

export interface RectPx {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/* ------------------------------------------------------------------ CDJ-3000X */

export const CDJ = {
  /** Source crop inside cdj_3d_01.webp (1280×1280): body plus overhanging screen. */
  crop: { left: 281, top: 126, width: 720, height: 1029 },
  /** px per metre in the crop (344.6 mm across 720 px) */
  pxPerM: 720 / 0.3446,
  width: 0.3446,
  /** body depth (front edge to rear edge of chassis, excluding screen overhang) */
  bodyDepth: 0.4238,
  depth: 0.4904,
  height: 0.1301,
  feetH: 0.031,
  bodyH: 0.056,
  footR: 0.03395,
  /** body rectangle in crop px */
  body: { x0: 0, y0: 141, x1: 720, y1: 1029 } as RectPx,
  /** whole screen unit (bezel) in crop px */
  screenUnit: { x0: 88, y0: 0, x1: 630, y1: 394 } as RectPx,
  /** active glass in crop px */
  glass: { x0: 103, y0: 56, x1: 616, y1: 392 } as RectPx,
  screenFrontH: 0.094,
  screenRearH: 0.1301,
  jog: { at: [359, 732] as Px, ringR: 222, platterR: 176, displayR: 72 },
  play: { at: [57, 971] as Px, r: 36 },
  cue: { at: [57, 874] as Px, r: 36 },
  browse: { at: [656, 262] as Px, r: 27 },
  tempo: { slot: { x0: 641, y0: 724, x1: 687, y1: 990 } as RectPx, capAt: [664, 859] as Px },
  /** smaller knobs that rise above the panel */
  knobs: [
    { id: "vinyl-speed", at: [664, 431], r: 15, h: 0.012 },
    { id: "jog-feel", at: [550, 545], r: 14, h: 0.012 },
    { id: "reloop", at: [152, 482], r: 15, h: 0.008 },
    { id: "delete", at: [538, 482], r: 14, h: 0.008 },
  ] as KnobSpec[],
} as const;

/* ------------------------------------------------------------------ DJM-A9 */

const CH_X = [321, 433, 545, 657] as const; // channel strip centres in crop px

function strip(ch: number): KnobSpec[] {
  const x = CH_X[ch] ?? 0;
  return [
    { id: `ch${ch + 1}-input`, at: [x, 95], r: 12, h: 0.012 },
    { id: `ch${ch + 1}-trim`, at: [x, 175], r: 18, h: 0.017 },
    { id: `ch${ch + 1}-hi`, at: [x, 255], r: 22, h: 0.019 },
    { id: `ch${ch + 1}-mid`, at: [x, 340], r: 22, h: 0.019 },
    { id: `ch${ch + 1}-low`, at: [x, 425], r: 22, h: 0.019 },
  ];
}

export const DJM = {
  /** Source crop inside djm-a9_2.png (1792×1316). */
  crop: { left: 365, top: 150, width: 1062, height: 1105 },
  pxPerM: 1062 / 0.4074,
  width: 0.4074,
  bodyDepth: 1105 / (1062 / 0.4074),
  depth: 0.4583,
  height: 0.1079,
  feetH: 0.003,
  bodyH: 0.085,
  channelX: CH_X,
  knobs: [
    ...strip(0),
    ...strip(1),
    ...strip(2),
    ...strip(3),
    // mic section
    { id: "mic1", at: [68, 185], r: 17, h: 0.015 },
    { id: "mic2", at: [68, 248], r: 17, h: 0.015 },
    { id: "mic-hi", at: [68, 320], r: 17, h: 0.015 },
    { id: "mic-low", at: [68, 385], r: 17, h: 0.015 },
    { id: "micfx-param", at: [68, 698], r: 24, h: 0.017 },
    { id: "micrev-param", at: [68, 873], r: 24, h: 0.017 },
    { id: "scfx-param", at: [192, 698], r: 21, h: 0.017 },
    { id: "phonesA-mix", at: [192, 850], r: 17, h: 0.015 },
    { id: "phonesA-level", at: [192, 925], r: 17, h: 0.015 },
    // master section
    { id: "master", at: [781, 80], r: 21, h: 0.017 },
    { id: "booth-hi", at: [781, 457], r: 15, h: 0.014 },
    { id: "booth-low", at: [781, 510], r: 15, h: 0.014 },
    { id: "booth-level", at: [781, 570], r: 19, h: 0.016 },
    { id: "phonesB-mix", at: [781, 790], r: 17, h: 0.015 },
    { id: "phonesB-level", at: [781, 850], r: 17, h: 0.015 },
    // multi I/O + beat fx
    { id: "send-ch", at: [875, 90], r: 16, h: 0.014 },
    { id: "send-level", at: [875, 168], r: 21, h: 0.017 },
    { id: "fx-select", at: [945, 650], r: 21, h: 0.017 },
    { id: "fx-time", at: [945, 845], r: 20, h: 0.016 },
    { id: "fx-depth", at: [945, 933], r: 21, h: 0.017 },
  ] as KnobSpec[],
  /** Sound Color FX knobs (one per channel) — larger caps */
  color: CH_X.map((x, i) => ({ id: `ch${i + 1}-color`, at: [x, 540] as Px, r: 29, h: 0.02 })),
  /** channel fader caps and slots */
  faders: CH_X.map((x, i) => ({
    id: `ch${i + 1}-fader`,
    slot: { x0: x - 3, y0: 752, x1: x + 3, y1: 880 } as RectPx,
    capAt: [x, 813] as Px,
    capW: 50,
    capH: 17,
  })),
  crossfader: { capAt: [488, 1045] as Px, capW: 17, capH: 48, slot: { x0: 425, x1: 552 } },
  /** LED meter columns (crop px) — 15 segments each */
  meters: [
    { x0: 265, y0: 158, x1: 274, y1: 416 },
    { x0: 377, y0: 158, x1: 386, y1: 416 },
    { x0: 489, y0: 158, x1: 498, y1: 416 },
    { x0: 601, y0: 158, x1: 610, y1: 416 },
    { x0: 750, y0: 155, x1: 760, y1: 415 },
    { x0: 804, y0: 155, x1: 814, y1: 415 },
  ] as RectPx[],
  beatFxDisplay: { x0: 857, y0: 220, x1: 1033, y1: 375 } as RectPx,
  xpad: { x0: 860, y0: 390, x1: 1033, y1: 435 } as RectPx,
  antenna: { at: [64, 0] as Px, h: 0.05, r: 0.0042 },
} as const;

/** Booth arrangement (metres). DJ stands at +z, crowd at −z. */
export const BOOTH = {
  gap: 0.018,
  tableY: 0,
  get cdjX() {
    return DJM.width / 2 + this.gap + CDJ.width / 2;
  },
} as const;

/** Convert crop px to device-local metres (x right, z toward the DJ). */
export function pxToLocal(
  dev: { pxPerM: number; crop: { width: number; height: number } },
  px: number,
  py: number,
  originY = 0,
): [number, number] {
  const cx = dev.crop.width / 2;
  const cy = originY || dev.crop.height / 2;
  return [(px - cx) / dev.pxPerM, (py - cy) / dev.pxPerM];
}
