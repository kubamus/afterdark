// Dev utility: overlays a labelled pixel grid on a source image and writes crops for measurement.
// Usage: bun scripts/grid.ts <src> <out-prefix> <step> [x y w h]...
import sharp from "sharp";

const [src, outPrefix, stepArg, ...rest] = process.argv.slice(2);
if (!src || !outPrefix) throw new Error("usage: grid.ts src outPrefix step [x y w h]...");
const step = Number(stepArg ?? 50);
const img = sharp(src);
const meta = await img.metadata();
const W = meta.width ?? 0;
const H = meta.height ?? 0;
let lines = "";
for (let x = 0; x <= W; x += step) {
  const major = x % (step * 2) === 0;
  lines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${major ? "#ff2040" : "#20d0ff"}" stroke-width="${major ? 1 : 0.6}" opacity="0.75"/>`;
  if (major) for (let y = 0; y < H; y += step * 4) lines += `<text x="${x + 2}" y="${y + 12}" font-size="11" fill="#ff2040" font-family="Arial">${x}</text>`;
}
for (let y = 0; y <= H; y += step) {
  const major = y % (step * 2) === 0;
  lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${major ? "#ff2040" : "#20d0ff"}" stroke-width="${major ? 1 : 0.6}" opacity="0.75"/>`;
  if (major) for (let x = 0; x < W; x += step * 4) lines += `<text x="${x + 2}" y="${y - 2}" font-size="11" fill="#ffd000" font-family="Arial">${y}</text>`;
}
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines}</svg>`);
const base = await sharp(src).flatten({ background: "#6a6a70" }).composite([{ input: svg }]).png().toBuffer();
const crops: number[][] = [];
for (let i = 0; i + 3 < rest.length; i += 4) crops.push(rest.slice(i, i + 4).map(Number));
if (crops.length === 0) crops.push([0, 0, W, H]);
let n = 0;
for (const [x, y, w, h] of crops) {
  await sharp(base).extract({ left: x!, top: y!, width: w!, height: h! }).toFile(`${outPrefix}_${n++}.png`);
}
console.log(W, H, crops.length);
