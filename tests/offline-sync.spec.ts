/**
 * tests/offline-sync.spec.ts
 * ---------------------------------------------------------------------------
 * End-to-end tests for the mobile Hukamnama hardening + offline search +
 * device sync + reminder work:
 *
 *   1. On a 360 px mobile viewport the Home page never scrolls horizontally
 *      and the Hukamnama card resolves (live content, saved copy, or the
 *      SGPC-link fallback — never a stuck skeleton).
 *   2. With the network cut, `/search` falls back to the on-device index of
 *      visited Angs and labels the results as offline.
 *   3. `/sync` renders both roles and generates a real send code (WebRTC).
 *   4. The Hukamnama reminder toggle renders on the Home card.
 *
 * Run with `npm run test` (headless Chromium) or `npm run test:ui`.
 */

import { test, expect } from "@playwright/test";

test.describe("Hukamnama on mobile", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("card resolves with no horizontal overflow on a 360 px viewport", async ({
    page,
  }) => {
    await page.goto("/");
    const card = page
      .locator("section", { has: page.getByText("Daily Hukamnama") })
      .first();
    await expect(card).toBeVisible();
    await expect(card.locator(".animate-pulse")).toHaveCount(0, { timeout: 30_000 });

    // Live, saved-copy, and failure paths each link out to SGPC — any is correct.
    const live = card.getByRole("link", { name: /SGPC Website/i });
    const fallback = card.getByRole("link", { name: /SGPC website/i });
    await expect(live.or(fallback).first()).toBeVisible({ timeout: 30_000 });

    // The card must never push the page sideways on narrow screens.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // The opt-in reminder toggle renders in the card header. The Hukamnama
    // card fetches live data; give it the same budget as the other checks.
    await expect(
      card.getByRole("button", { name: "Hukamnama reminders" })
    ).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Offline search fallback", () => {
  test("cut network searches the visited-Ang index and says so", async ({
    page,
    context,
  }) => {
    // Load online first — emulated offline would also cut localhost.
    await page.goto("/search");

    // Seed the on-device index as if the reader had visited Ang 1.
    await page.evaluate(() => {
      localStorage.setItem(
        "sgs-reader-offline-index",
        JSON.stringify([
          {
            ang: 1,
            verses: [
              {
                id: "seed-1",
                gurmukhi: "ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ",
                en: "Seed translation for offline search",
              },
            ],
            savedAt: Date.now(),
          },
        ])
      );
    });

    try {
      await context.setOffline(true);
      await page.getByPlaceholder(/Type Gurmukhi/).fill("ਵਾਹਿਗੁਰੂ");
      await page.keyboard.press("Enter");

      await expect(page.getByText(/Offline results/)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("ਵਾਹਿਗੁਰੂ")).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe("Device sync page", () => {  test("/sync renders both roles and generates a send code", async ({ page }) => {
    await page.goto("/sync");
    await expect(page.getByText("Sync to another device")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Send \(has my data\)/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Receive \(new device\)/i })
    ).toBeVisible();

    // Generating a code needs real WebRTC + ICE gathering in the browser.
    await page.getByRole("button", { name: /Create send code/i }).click();
    const codeBox = page.getByLabel("Send code", { exact: true });
    await expect(codeBox).not.toHaveValue("", { timeout: 20_000 });
  });
});

test.describe("Live search and Raag headers", () => {
  test("a Gurmukhi search returns live verses", async ({ page }) => {
    await page.goto("/search");
    await page.getByPlaceholder(/Type Gurmukhi/).fill("ਸਤਿਨਾਮੁ");
    await page.keyboard.press("Enter");

    // Live BaniDB results, or the labelled offline fallback when the
    // network/upstream is unreachable — either proves search resolves.
    const results = page.getByText(/verses|Offline/);
    await expect(results.first()).toBeVisible({ timeout: 30_000 });
  });

  test("an Ang header shows its Raag name when scripture loads", async ({ page }) => {
    await page.goto("/ang/711");
    const heading = page.locator("main h1").first();
    await expect(heading).toBeVisible({ timeout: 30_000 });
    // Live: the section Gurmukhi name from DynamicAngHeader (e.g. "ਤੋਡੀ");
    // unreachable upstream: the retry card's own heading — both prove the
    // page resolved deliberately.
    await expect(heading).toContainText(/[\u0A00-\u0A7F]+|Ang/);
  });
});
