import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const URL = process.env.SHOTS_URL ?? "http://127.0.0.1:3000";
const OUT = "dev-artifacts/shots";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

interface CheckReport {
  consoleErrors: string[];
  pageErrors: string[];
  failedAssets: string[];
  overflows: string[];
}

const report: CheckReport = {
  consoleErrors: [],
  pageErrors: [],
  failedAssets: [],
  overflows: [],
};

async function captureDesktop() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => report.pageErrors.push(err.message));
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      report.failedAssets.push(`${res.status()} ${res.url()}`);
    }
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);

  // Check horizontal overflow
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (hasOverflow) report.overflows.push("1440x900");

  // Capture Hero
  await page.screenshot({ path: `${OUT}/01-hero-1440.png` });

  // Scroll through key shot anchors (covering Jog Wheel, PLAY/CUE, Screen, Sound, Signal, DJM Color, Beat FX, MAGVEL, Control)
  const targets = [
    { shot: "rise", file: "02-instrument-rise-1440.png" },
    { shot: "overhead", file: "03-instrument-overhead-1440.png" },
    { shot: "beauty", file: "04-instrument-beauty-1440.png" },
    { shot: "cdj-screen", file: "05-cdj-screen-1440.png" },
    { shot: "cdj-jog", file: "06-cdj-jog-1440.png" },
    { shot: "cdj-playcue", file: "07-cdj-playcue-1440.png" },
    { shot: "cdj-sound", file: "08-cdj-sound-1440.png" },
    { shot: "signal", file: "09-signal-bridge-1440.png" },
    { shot: "djm-color", file: "10-djm-color-1440.png" },
    { shot: "djm-beatfx", file: "10b-djm-beatfx-1440.png" },
    { shot: "djm-fader", file: "11-djm-fader-1440.png" },
  ];

  for (const t of targets) {
    await page.evaluate((shotId) => {
      const el = document.querySelector<HTMLElement>(`[data-shot="${shotId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const anchor = Number(el.dataset.shotAnchor ?? "0");
        const y = Math.max(0, rect.top + window.scrollY - window.innerHeight * anchor);
        window.scrollTo({ top: y, behavior: "instant" });
      }
    }, t.shot);
    if (t.shot === "signal") {
      // Capture initial dark empty room + unplugged normal black cables, then wait for full 3-stage plug-in + club lights!
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${OUT}/${t.file}` });
      await page.waitForTimeout(3400);
      await page.screenshot({ path: `${OUT}/09b-signal-club-lit-1440.png` });
    } else {
      await page.waitForTimeout(1050);
      await page.screenshot({ path: `${OUT}/${t.file}` });
    }
  }

  // Continue to Act VI (Moment POV + Gallery) and Act VII (Final & Specs)
  const tailTargets = [
    { selector: '[data-shot="pov"]', file: "13b-moment-pov-1440.png" },
    { selector: ".moment-hero-plate", file: "13-moment-climax-1440.png" },
    { selector: ".final-hero", file: "15-final-1440.png" },
    { selector: "#specs", file: "16-specs-1440.png" },
  ];

  for (const t of tailTargets) {
    await page.evaluate((sel) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: y, behavior: "instant" });
      }
    }, t.selector);
    await page.waitForTimeout(950);
    await page.screenshot({ path: `${OUT}/${t.file}` });
  }

  await ctx.close();
}

async function captureMobileAndLarge() {
  // Large desktop 1920x1080 hero
  const lgCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const lgPage = await lgCtx.newPage();
  await lgPage.goto(URL, { waitUntil: "networkidle" });
  await lgPage.waitForTimeout(1500);
  await lgPage.screenshot({ path: `${OUT}/17-hero-1920.png` });
  await lgCtx.close();

  // Mobile 390x844
  const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mobPage = await mobCtx.newPage();
  await mobPage.goto(URL, { waitUntil: "networkidle" });
  await mobPage.waitForTimeout(1500);
  const mobOverflow = await mobPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (mobOverflow) report.overflows.push("390x844");
  await mobPage.screenshot({ path: `${OUT}/18-hero-mobile.png` });

  for (const [sel, file] of [
    ['[data-shot="overhead"]', "19-overhead-mobile.png"],
    ['[data-shot="cdj-screen"]', "20-cdj-mobile.png"],
    ['[data-shot="pov"]', "21-pov-mobile.png"],
    [".final-hero", "22-final-mobile.png"],
  ] as const) {
    await mobPage.evaluate((s) => {
      const el = document.querySelector<HTMLElement>(s);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
    }, sel);
    await mobPage.waitForTimeout(900);
    await mobPage.screenshot({ path: `${OUT}/${file}` });
  }
  await mobCtx.close();
}

await captureDesktop();
await captureMobileAndLarge();
  // Laptop 1280x800 & Tablet 768x1024 overflow + framing verification
  for (const vp of [
    { name: "1280x800", width: 1280, height: 800, file: "23-hero-1280.png" },
    { name: "768x1024", width: 768, height: 1024, file: "24-hero-tablet.png" },
  ]) {
    const vCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const vPage = await vCtx.newPage();
    await vPage.goto(URL, { waitUntil: "networkidle" });
    await vPage.waitForTimeout(1400);
    const hasOv = await vPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (hasOv) report.overflows.push(vp.name);
    await vPage.screenshot({ path: `${OUT}/${vp.file}` });
    await vCtx.close();
  }

  await browser.close();

console.log(JSON.stringify(report, null, 2));
if (
  report.consoleErrors.length > 0 ||
  report.pageErrors.length > 0 ||
  report.failedAssets.length > 0 ||
  report.overflows.length > 0
) {
  process.exitCode = 1;
}
