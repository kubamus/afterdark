import { expect, test } from "@playwright/test";

test.describe("AFTER DARK campaign", () => {
  test("renders hero, WebGL stage, navigation, specs, and interactive Take Control without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await expect(page.getByRole("heading", { level: 1, name: "The night is yours." })).toBeVisible();
    await expect(page.locator("canvas.stage-canvas")).toBeVisible();

    // Sound starts opt-in (off) and toggles on click
    const soundBtn = page.getByRole("button", { name: /Sound off/i });
    await expect(soundBtn).toHaveAttribute("aria-pressed", "false");
    await soundBtn.click();
    await expect(page.getByRole("button", { name: /Sound on/i })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Sound on/i }).click();

    // Hardware inspect mode toggle on CDJ-3000X
    const jogInspect = page.getByRole("button", { name: "Jog Wheel" });
    await jogInspect.click();
    await expect(jogInspect).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Release" }).first().click();

    // Act V Take Control: keyboard & pointer controls
    const playBtn = page.getByRole("button", { name: "Play Deck 1" });
    await playBtn.scrollIntoViewIfNeeded();
    await playBtn.click();
    await expect(page.getByRole("button", { name: "Pause Deck 1" })).toHaveAttribute("aria-pressed", "true");

    // Keyboard fader slider
    const fader = page.getByRole("slider", { name: "Channel 2 volume fader" });
    await fader.focus();
    await page.keyboard.press("ArrowRight");
    const valAfter = Number(await fader.getAttribute("aria-valuenow"));
    expect(valAfter).toBeGreaterThan(0);

    // Sound Color FX mode switch + Center Lock + Choreographed Drop on beat
    await page.getByRole("button", { name: "DUB ECHO" }).click();
    await expect(page.getByRole("button", { name: "DUB ECHO" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Drop on beat" }).click();
    await expect(page.getByRole("status")).toContainText(/Both decks live/i, { timeout: 6000 });

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

    await expect(page.getByRole("heading", { level: 1, name: "The night is yours." })).toBeVisible();
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
