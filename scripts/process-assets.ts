// Produces web-optimised derivatives in public/assets from the originals in assets-src.
// Run: bun scripts/process-assets.ts   (requires scripts/fetch-assets.sh first)
import sharp from "sharp";
import { mkdir, copyFile, stat } from "node:fs/promises";
import { CDJ, DJM, type RectPx } from "../src/three/hardware/layout";

const SRC = "assets-src";
const OUT = "public/assets";
await mkdir(`${OUT}/tex`, { recursive: true });
await mkdir(`${OUT}/img`, { recursive: true });
await mkdir(`${OUT}/film`, { recursive: true });

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const inRect = (r: RectPx, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

interface SplitOpts {
  /** regions that are fully emissive (displays) */
  displays: RectPx[];
  /** circular emissive displays: [cx, cy, r] */
  discs?: [number, number, number][];
  /** regions excluded from LED detection */
  exclude?: RectPx[];
  /** regions whose alpha is cleared (e.g. annotation strokes outside the product) */
  clear?: RectPx[];
}

/**
 * Splits a product photo into a base (unpowered) colour map and an emissive map.
 * Saturated, bright pixels are treated as illuminated LEDs/buttons; display rectangles
 * become fully emissive, and their base colour becomes dark glass.
 */
async function splitEmissive(input: Buffer, width: number, height: number, opts: SplitOpts) {
  const raw = await sharp(input).ensureAlpha().raw().toBuffer();
  const base = Buffer.alloc(raw.length);
  const emis = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = raw[i]! / 255, g = raw[i + 1]! / 255, b = raw[i + 2]! / 255;
      const a = opts.clear?.some((d) => inRect(d, x, y)) ? 0 : raw[i + 3]!;
      const v = Math.max(r, g, b), mn = Math.min(r, g, b);
      const s = v > 0 ? (v - mn) / v : 0;
      let led = smooth(0.32, 0.6, s) * smooth(0.28, 0.55, v);
      const display =
        opts.displays.some((d) => inRect(d, x, y)) ||
        (opts.discs ?? []).some(([cx, cy, cr]) => (x - cx) ** 2 + (y - cy) ** 2 <= cr * cr);
      if (opts.exclude?.some((d) => inRect(d, x, y))) led = 0;
      let br = r, bg = g, bb = b, er = 0, eg = 0, eb = 0;
      if (display) {
        er = r; eg = g; eb = b;
        br = 0.012 + r * 0.035; bg = 0.013 + g * 0.035; bb = 0.016 + b * 0.035;
      } else if (led > 0) {
        er = r * led; eg = g * led; eb = b * led;
        const k = 1 - 0.78 * led;
        // unlit LED: dim, slightly desaturated tinted plastic
        const l = (r + g + b) / 3;
        br = (r * 0.55 + l * 0.45) * k; bg = (g * 0.55 + l * 0.45) * k; bb = (b * 0.55 + l * 0.45) * k;
      }
      base[i] = Math.round(br * 255); base[i + 1] = Math.round(bg * 255); base[i + 2] = Math.round(bb * 255); base[i + 3] = a;
      const j = (y * width + x) * 3;
      emis[j] = Math.round(er * 255); emis[j + 1] = Math.round(eg * 255); emis[j + 2] = Math.round(eb * 255);
    }
  }
  return {
    base: sharp(base, { raw: { width, height, channels: 4 } }),
    emis: sharp(emis, { raw: { width, height, channels: 3 } }),
  };
}

/** Paints over a fader cap by tiling a clean strip of the slot from elsewhere in the same column. */
async function inpaintFader(img: Buffer, width: number, height: number, cx: number, cy: number, w: number, h: number, srcY: number) {
  const raw = await sharp(img).ensureAlpha().raw().toBuffer();
  const x0 = Math.round(cx - w / 2 - 3), x1 = Math.round(cx + w / 2 + 3);
  const y0 = Math.round(cy - h / 2 - 3), y1 = Math.round(cy + h / 2 + 3);
  for (let y = y0; y <= y1; y++) {
    const sy = srcY + (y - y0);
    for (let x = x0; x <= x1; x++) {
      const di = (y * width + x) * 4, si = (sy * width + x) * 4;
      for (let c = 0; c < 4; c++) raw[di + c] = raw[si + c]!;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/* ---------------------------------------------------------------- CDJ-3000X top */
{
  const scale = 2;
  const W = CDJ.crop.width * scale, H = CDJ.crop.height * scale;
  const crop = await sharp(`${SRC}/cdj_3d_01.webp`).extract(CDJ.crop).resize(W, H, { kernel: "lanczos3" }).sharpen({ sigma: 0.6 }).png().toBuffer();
  const s = (r: RectPx): RectPx => ({ x0: r.x0 * scale, y0: r.y0 * scale, x1: r.x1 * scale, y1: r.y1 * scale });
  const jd = CDJ.jog.displayR * scale;
  const [jx, jy] = [CDJ.jog.at[0] * scale, CDJ.jog.at[1] * scale];
  const { base, emis } = await splitEmissive(crop, W, H, {
    displays: [s(CDJ.glass)],
    discs: [[jx, jy, jd * 0.93]],
    clear: [
      { x0: 0, y0: 0, x1: CDJ.screenUnit.x0 * scale - 1, y1: CDJ.body.y0 * scale - 2 },
      { x0: CDJ.screenUnit.x1 * scale + 1, y0: 0, x1: W, y1: CDJ.body.y0 * scale - 2 },
    ],
  });
  await base.webp({ quality: 90, alphaQuality: 100 }).toFile(`${OUT}/tex/cdj-top.webp`);
  await emis.webp({ quality: 88 }).toFile(`${OUT}/tex/cdj-top-emissive.webp`);

  // High-resolution browse screen from the official display image (glass region)
  await sharp(`${SRC}/cdj_display_dark.png`).extract({ left: 952, top: 216, width: 688, height: 450 }).resize(1376, 900, { kernel: "lanczos3" }).sharpen({ sigma: 0.5 }).flatten({ background: "#000" }).webp({ quality: 90 }).toFile(`${OUT}/tex/cdj-screen-browse.webp`);
  // Performance (waveform) screen from the top view
  await sharp(crop).extract({ left: CDJ.glass.x0 * scale, top: CDJ.glass.y0 * scale, width: (CDJ.glass.x1 - CDJ.glass.x0) * scale, height: (CDJ.glass.y1 - CDJ.glass.y0) * scale }).flatten({ background: "#000" }).webp({ quality: 90 }).toFile(`${OUT}/tex/cdj-screen-play.webp`);
  // Front face (front view, spec_04)
  await sharp(`${SRC}/cdj_spec_04.webp`).extract({ left: 86, top: 421, width: 618, height: 98 }).resize(1236, 196, { kernel: "lanczos3" }).flatten({ background: "#0b0b0c" }).webp({ quality: 88 }).toFile(`${OUT}/tex/cdj-front.webp`);
}

/* ---------------------------------------------------------------- DJM-A9 top */
{
  const scale = 1.5;
  const cw = DJM.crop.width, ch = DJM.crop.height;
  let crop = await sharp(`${SRC}/djm_2.png`).extract(DJM.crop).png().toBuffer();
  // Keep one original channel-fader cap as its own texture (caps become movable meshes)
  {
    const f = DJM.faders[0]!;
    await sharp(crop)
      .extract({ left: f.capAt[0] - f.capW / 2, top: f.capAt[1] - Math.ceil(f.capH / 2), width: f.capW, height: f.capH })
      .resize(f.capW * 4, f.capH * 4, { kernel: "lanczos3" })
      .flatten({ background: "#111" })
      .webp({ quality: 90 })
      .toFile(`${OUT}/tex/djm-fadercap.webp`);
  }
  // Remove baked fader caps for all four channels (caps are rendered as movable meshes)
  for (const f of DJM.faders) {
    crop = await inpaintFader(crop, cw, ch, f.capAt[0], f.capAt[1], f.capW, f.capH, f.capAt[1] + 32);
  }
  const W = Math.round(cw * scale), H = Math.round(ch * scale);
  const up = await sharp(crop).resize(W, H, { kernel: "lanczos3" }).sharpen({ sigma: 0.6 }).png().toBuffer();
  const s = (r: RectPx): RectPx => ({ x0: r.x0 * scale, y0: r.y0 * scale, x1: r.x1 * scale, y1: r.y1 * scale });
  const { base, emis } = await splitEmissive(up, W, H, { displays: [s(DJM.beatFxDisplay)] });
  await base.webp({ quality: 90, alphaQuality: 100 }).toFile(`${OUT}/tex/djm-top.webp`);
  await emis.webp({ quality: 88 }).toFile(`${OUT}/tex/djm-top-emissive.webp`);
  await sharp(`${SRC}/djm_4.png`).extract({ left: 84, top: 584, width: 1623, height: 338 }).resize(1200, 250).flatten({ background: "#0b0b0c" }).webp({ quality: 88 }).toFile(`${OUT}/tex/djm-front.webp`);
}

/* ---------------------------------------------------------------- Editorial imagery */
const photo = async (src: string, out: string, width: number, q = 80) => {
  await sharp(`${SRC}/${src}`).resize({ width, withoutEnlargement: true }).webp({ quality: q }).toFile(`${OUT}/img/${out}.webp`);
};
await photo("cdj_kv_pc.webp", "cdj-hero", 1920);
await photo("cdj_kv_sp.webp", "cdj-hero-portrait", 750);
await photo("cdj_motion_02.webp", "cdj-source", 1920);
await photo("cdj_motion_05.webp", "cdj-top-dark", 1920);
await photo("cdj_motion_06.webp", "cdj-qr", 1920);
await photo("cdj_motion_08.webp", "cdj-browse", 1920);
await photo("cdj_sound_xray.webp", "cdj-xray", 1200, 72);
await photo("cdj_3d_02.webp", "cdj-angle", 1280, 85);
await photo("djm_eq.png", "djm-eq", 1280, 84);
await photo("djm_meters_beatfx.png", "djm-beatfx", 1280, 84);
await photo("djm_magvel.png", "djm-magvel", 1280, 84);
await photo("djm_centerlock.png", "djm-centerlock", 960, 84);
await photo("djm_color.png", "djm-color", 1280, 84);
await photo("djm_faders_phones.png", "djm-phones", 1280, 84);
await photo("djm_fx_select.png", "djm-fxselect", 1280, 84);
await photo("djm_xpad_touch.jpg", "djm-xpad", 1053, 82);
await photo("djm_ess.jpg", "djm-ess", 1053, 82);
await photo("djm_1.png", "djm-angle", 1600, 85);
await photo("djm_5.png", "djm-angle-low", 1600, 85);
for (const n of [1, 2, 3, 4]) {
  await photo(`club_munich_${n}.jpg`, `club-${n}`, 2400, 78);
  await photo(`club_munich_${n}.jpg`, `club-${n}-sm`, 1080, 74);
}

const size = async (p: string) => (await stat(p)).size;
console.log("cdj-top", await size(`${OUT}/tex/cdj-top.webp`), "djm-top", await size(`${OUT}/tex/djm-top.webp`));
await copyFile(`${SRC}/cdj_3d_01.webp`, `${OUT}/img/cdj-top-ortho.webp`);
