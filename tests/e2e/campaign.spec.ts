import { expect, test } from "@playwright/test";

test.describe("AFTER DARK campaign", () => {
  test("renders hero, WebGL stage, Liquid Glass navigation, hardware controls, and specs without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await expect(page.getByRole("heading", { level: 1, name: "Built for the club booth." })).toBeVisible();
    await expect(page.locator("canvas.stage-canvas")).toBeVisible();

    // Verify removed audio & fake Take Control elements are gone
    await expect(page.getByRole("button", { name: /Sound off/i })).toHaveCount(0);
    await expect(page.locator("#take-control")).toHaveCount(0);

    // Hardware inspect mode toggle on CDJ-3000X
    const jogInspect = page.getByRole("button", { name: "Jog wheel" });
    await jogInspect.scrollIntoViewIfNeeded();
    await jogInspect.click();
    await expect(jogInspect).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Release" }).first().click();

    // Live 3D screen toggle on CDJ-3000X
    const waveformBtn = page.getByRole("button", { name: "Waveform view" });
    await waveformBtn.scrollIntoViewIfNeeded();
    await waveformBtn.click();
    await expect(waveformBtn).toHaveAttribute("aria-pressed", "true");

    // Authentic hold-to-play CUE behavior
    const cueBtn = page.getByRole("button", { name: "Hold CUE" });
    await cueBtn.scrollIntoViewIfNeeded();
    await cueBtn.dispatchEvent("pointerdown", { pointerId: 1, isPrimary: true });
    await expect(page.getByRole("button", { name: "Playing CUE" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Playing CUE" }).dispatchEvent("pointerup", { pointerId: 1, isPrimary: true });
    await expect(page.getByRole("button", { name: "Hold CUE" })).toHaveAttribute("aria-pressed", "false");

    // Live Beat FX OLED selector on DJM-A9
    const echoFx = page.getByRole("option", { name: "Echo" });
    await echoFx.scrollIntoViewIfNeeded();
    await echoFx.click();
    await expect(echoFx).toHaveAttribute("aria-selected", "true");

    // Official product links & specs accessible outside WebGL
    await expect(page.getByRole("link", { name: /Explore CDJ-3000X/i })).toHaveAttribute(
      "href",
      "https://alphatheta.com/en/product/player/cdj-3000x/black/",
    );
    await expect(page.getByRole("link", { name: /Explore DJM-A9/i })).toHaveAttribute(
      "href",
      "https://www.pioneerdj.com/en/product/dj-mixers/djm-a9/",
    );

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test("respects prefers-reduced-motion and renders cleanly on mobile", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    await expect(page.getByRole("heading", { level: 1, name: "Built for the club booth." })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);

    // Mobile spec tabs switch cleanly
    const djmTab = page.getByRole("tab", { name: "DJM-A9" });
    await djmTab.scrollIntoViewIfNeeded();
    await djmTab.click();
    await expect(djmTab).toHaveAttribute("aria-selected", "true");

    await ctx.close();
  });
});
